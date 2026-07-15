/**
 * rebuild-vehicle-accounts.ts
 *
 * WHAT THIS DOES:
 *  1. Loads Firebase config from .env.local
 *  2. Deletes every account whose typeName === "Vehicle Asset"
 *  3. Ensures the "Vehicle Asset" account-type document exists
 *  4. For every car in the `cars` collection, creates a fresh ledger account:
 *       name    : "Vehicle: {Brand} {Model} ({last-4 chassis})"
 *       balance : purchasePrice (or 0 if no purchase invoice yet)
 *  5. Patches the car document with the new vehicleAccountId + vehicleAccountName
 *
 * HOW TO RUN (from the project root):
 *   npx ts-node --project tsconfig.json -e "require('ts-node/register'); require('./scripts/rebuild-vehicle-accounts.ts')"
 * OR, simpler with tsx installed:
 *   npx tsx scripts/rebuild-vehicle-accounts.ts
 */

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

// ─── Load .env.local ──────────────────────────────────────────────────────────
function loadEnv() {
  const candidates = [".env.local", ".env"];
  for (const file of candidates) {
    const envPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      content.split("\n").forEach((line) => {
        if (line.trim().startsWith("#") || !line.trim()) return;
        const match = line.replace(/\r$/, "").match(/^\s*([\w.-]+)\s*=\s*(.*)?$/);
        if (match) {
          let val = (match[2] || "").trim();
          if ((val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          process.env[match[1]] = val;
        }
      });
      console.log(`📂 Loaded env from: ${file}`);
      return;
    }
  }
  console.warn("⚠️  No .env.local or .env file found — relying on process.env");
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  loadEnv();

  const firebaseConfig = {
    apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error("❌  Firebase config is missing. Check your .env.local file.");
    process.exit(1);
  }

  console.log(`🔥  Connecting to Firebase project: ${firebaseConfig.projectId}`);
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // ── STEP 1: Delete all Vehicle Asset accounts ─────────────────────────────
  console.log("\n🗑️   STEP 1 — Deleting all existing Vehicle Asset accounts...");
  const vehicleAccountsSnap = await getDocs(
    query(collection(db, "accounts"), where("typeName", "==", "Vehicle Asset"))
  );
  let deleted = 0;
  for (const d of vehicleAccountsSnap.docs) {
    await deleteDoc(doc(db, "accounts", d.id));
    deleted++;
    process.stdout.write(`\r   Deleted ${deleted}/${vehicleAccountsSnap.size} accounts...`);
  }
  console.log(`\n✅  Deleted ${deleted} Vehicle Asset accounts.`);

  // ── STEP 2: Ensure "Vehicle Asset" account-type exists ────────────────────
  console.log("\n📋  STEP 2 — Ensuring 'Vehicle Asset' account type exists...");
  let vehicleAssetTypeId = "";
  const typeSnap = await getDocs(
    query(collection(db, "account-types"), where("name", "==", "Vehicle Asset"))
  );
  if (!typeSnap.empty) {
    vehicleAssetTypeId = typeSnap.docs[0].id;
    console.log(`   ✔  Found existing account-type ID: ${vehicleAssetTypeId}`);
  } else {
    const typeRef = await addDoc(collection(db, "account-types"), {
      name: "Vehicle Asset",
      description: "Accounts to track vehicle assets and capitalize costs",
      createdAt: serverTimestamp(),
      createdBy: "rebuild-script",
    });
    vehicleAssetTypeId = typeRef.id;
    console.log(`   ✔  Created new account-type ID: ${vehicleAssetTypeId}`);
  }

  // ── STEP 3: Fetch all cars ────────────────────────────────────────────────
  console.log("\n🚗  STEP 3 — Fetching all vehicles...");
  const carsSnap = await getDocs(collection(db, "cars"));
  const cars = carsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
  console.log(`   Found ${cars.length} vehicles.`);

  // ── STEP 4: Re-create one account per vehicle ─────────────────────────────
  console.log("\n🏦  STEP 4 — Creating fresh accounts for each vehicle...");
  let created = 0;
  let errors  = 0;

  for (const car of cars) {
    try {
      const brand   = car.brandName || "Unknown";
      const model   = car.model     || "Vehicle";
      const chassis = (car.chassisNumber || car.chassisNo || "").slice(-4) || "0000";
      const balance = Number(car.purchasePrice) || 0;

      const accountName = `Vehicle: ${brand} ${model} (${chassis})`;

      const accountRef = await addDoc(collection(db, "accounts"), {
        name:        accountName,
        typeId:      vehicleAssetTypeId,
        typeName:    "Vehicle Asset",
        balance:     balance,
        description: `Ledger for: ${brand} ${model} — Chassis: ${car.chassisNumber || car.chassisNo || "N/A"}`,
        createdAt:   serverTimestamp(),
        createdBy:   "rebuild-script",
        updatedAt:   serverTimestamp(),
        updatedBy:   "rebuild-script",
      });

      // Patch the car document with the new account reference
      await updateDoc(doc(db, "cars", car.id), {
        vehicleAccountId:   accountRef.id,
        vehicleAccountName: accountName,
        updatedAt:          serverTimestamp(),
      });

      created++;
      process.stdout.write(`\r   Created ${created}/${cars.length} accounts...`);
    } catch (err: any) {
      errors++;
      console.error(`\n   ❌  Failed for car ${car.id}: ${err.message}`);
    }
  }

  // ── DONE ──────────────────────────────────────────────────────────────────
  console.log(`\n\n🎉  Done!`);
  console.log(`   ✅  Created : ${created} vehicle accounts`);
  if (errors > 0) {
    console.log(`   ⚠️   Errors  : ${errors} vehicles failed (see above)`);
  }
  console.log(`\n   Each car document has been updated with the new vehicleAccountId.`);
  console.log(`   Balances are set to each vehicle's existing purchasePrice (0 if not yet purchased).\n`);
}

run().catch((err) => {
  console.error("\n❌  Script failed:", err);
  process.exit(1);
});
