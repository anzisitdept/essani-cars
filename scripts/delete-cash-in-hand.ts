import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, deleteDoc, writeBatch } from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

// Helper to load environment variables from .env.local or .env
function loadEnv() {
  const envPaths = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env")
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      console.log(`Loading env from: ${envPath}`);
      const envContent = fs.readFileSync(envPath, "utf-8");
      envContent.split("\n").forEach((line) => {
        if (line.trim().startsWith("#") || !line.trim()) return;
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let val = match[2] || "";
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.substring(1, val.length - 1);
          } else if (val.startsWith("'") && val.endsWith("'")) {
            val = val.substring(1, val.length - 1);
          }
          process.env[key] = val;
        }
      });
      return; // Loaded successfully
    }
  }
}

async function runDelete() {
  console.log("🌱 Loading environment variables...");
  loadEnv();

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  };

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error("❌ Firebase Configuration is missing in environment variables.");
    process.exit(1);
  }

  console.log("🔥 Initializing Firebase...");
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  console.log("🔍 Finding 'Cash in Hand' account...");
  const accountsSnap = await getDocs(collection(db, "accounts"));
  
  const cashInHandAccounts = accountsSnap.docs.filter(d => {
    const name = (d.data().name || "").toLowerCase();
    return name.includes("cash in hand");
  });

  if (cashInHandAccounts.length === 0) {
    console.log("⚠️ No 'Cash in Hand' account found in the 'accounts' collection.");
    process.exit(0);
  }

  for (const acc of cashInHandAccounts) {
    const accountId = acc.id;
    const accountName = acc.data().name;
    console.log(`\n=================================================`);
    console.log(`🛠️ Processing account: "${accountName}" (ID: ${accountId})`);
    console.log(`=================================================`);

    console.log("📥 Fetching all vouchers...");
    const vouchersSnap = await getDocs(collection(db, "vouchers"));
    
    // Find vouchers where this account is used either as cashAccountId, counterAccountId, or accountId (backward compat)
    const vouchersToDelete = vouchersSnap.docs.filter(d => {
      const data = d.data();
      return (
        data.cashAccountId === accountId || 
        data.counterAccountId === accountId || 
        data.accountId === accountId
      );
    });

    console.log(`⚠️ Found ${vouchersToDelete.length} vouchers linked to this account.`);

    if (vouchersToDelete.length > 0) {
      console.log("🗑️ Deleting vouchers...");
      let batch = writeBatch(db);
      let count = 0;
      let totalDeleted = 0;
      
      for (const v of vouchersToDelete) {
        batch.delete(doc(db, "vouchers", v.id));
        count++;
        totalDeleted++;
        
        // Firestore batch limit is 500
        if (count === 500) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
          console.log(`...deleted ${totalDeleted} vouchers`);
        }
      }
      
      if (count > 0) {
        await batch.commit();
        console.log(`...deleted ${totalDeleted} vouchers (final batch)`);
      }
      console.log("✅ All linked vouchers deleted successfully.");
    } else {
      console.log("✅ No vouchers to delete for this account.");
    }

    console.log(`🗑️ Deleting account "${accountName}"...`);
    await deleteDoc(doc(db, "accounts", accountId));
    console.log(`✅ Account "${accountName}" deleted successfully.`);
  }

  console.log("\n🎉 Process completed successfully!");
  process.exit(0);
}

runDelete().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
