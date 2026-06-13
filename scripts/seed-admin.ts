import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, query, where, getDocs, updateDoc } from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

// 1. Helper to load environment variables from .env
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split("\n").forEach((line) => {
      // Ignore comments and empty lines
      if (line.trim().startsWith("#") || !line.trim()) return;
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || "";
        // Strip quotes if present
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        } else if (val.startsWith("'") && val.endsWith("'")) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    });
  }
}

async function runSeed() {
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

  console.log("🔥 Initializing Firebase Client SDK...");
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const ALL_PERMISSIONS = [
    'dashboard',
    'registry',
    'inventory',
    'purchase_invoice',
    'sale_invoice',
    'status',
    'delivery',
    'clients',
    'investors',
    'accounts',
    'account_types',
    'cash_voucher',
    'general_voucher',
    'general_ledger',
    'logs',
    'reports',
    'settings',
    'users',
    'roles',
    'edit_delivered_vehicle'
  ];

  console.log("🛡️ Checking/Creating 'Super Admin' role...");
  const rolesRef = collection(db, "roles");
  const roleQuery = query(rolesRef, where("name", "==", "Super Admin"));
  const roleSnapshot = await getDocs(roleQuery);

  let roleId = "";
  if (roleSnapshot.empty) {
    const newRoleRef = doc(collection(db, "roles"));
    roleId = newRoleRef.id;
    await setDoc(newRoleRef, {
      name: "Super Admin",
      description: "Full system control with all permissions.",
      permissions: ALL_PERMISSIONS,
      createdAt: new Date(),
      createdBy: "seed-script"
    });
    console.log(`✅ Created "Super Admin" role with ID: ${roleId}`);
  } else {
    const roleDoc = roleSnapshot.docs[0];
    roleId = roleDoc.id;
    await updateDoc(doc(db, "roles", roleId), {
      permissions: ALL_PERMISSIONS,
      updatedAt: new Date()
    });
    console.log(`ℹ️ "Super Admin" role already exists (ID: ${roleId}). Updated permissions to ensure all are set.`);
  }

  const email = "admin@anziandco.com";
  const password = "anzi5544332211";
  let uid = "";

  console.log(`👤 Checking/Creating user: ${email}...`);
  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    uid = userCred.user.uid;
    console.log(`✅ Created Auth user for ${email} with UID: ${uid}`);
  } catch (error: any) {
    if (error.code === "auth/email-already-in-use") {
      console.log(`ℹ️ Auth user ${email} already exists. Verifying password by signing in...`);
      try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        uid = userCred.user.uid;
        console.log(`✅ Signed in successfully. UID: ${uid}`);
      } catch (signInError: any) {
        console.log(`⚠️ Sign-in with default password failed: ${signInError.message}`);
        console.log(`🔍 Querying Firestore for user document to retrieve existing UID...`);
        const usersRef = collection(db, "users");
        const userQuery = query(usersRef, where("email", "==", email));
        const userSnapshot = await getDocs(userQuery);
        if (!userSnapshot.empty) {
          uid = userSnapshot.docs[0].id;
          console.log(`✅ Found existing user UID in Firestore: ${uid}`);
        } else {
          console.error(`❌ Error: Auth user exists, but password was incorrect and no Firestore document exists to match.`);
          process.exit(1);
        }
      }
    } else {
      console.error(`❌ Error creating user in Auth: ${error.message}`);
      process.exit(1);
    }
  }

  if (uid) {
    console.log(`💾 Updating Firestore user document for ${email} (UID: ${uid})...`);
    const userDocRef = doc(db, "users", uid);
    await setDoc(userDocRef, {
      email: email,
      name: "Super Admin",
      role: "Super Admin",
      roleId: roleId,
      createdAt: new Date(),
      createdBy: "seed-script"
    }, { merge: true });
    console.log(`🎉 Seeding completed successfully!`);
  }
}

runSeed().catch((err) => {
  console.error("❌ Seed script failed:", err);
  process.exit(1);
});
