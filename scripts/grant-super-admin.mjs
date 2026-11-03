/**
 * Grants a Firebase user full access by:
 *   1. Ensuring a "Super Admin" role exists with every permission.
 *   2. Writing role/roleId/permissions onto the user's Firestore document.
 *
 * This uses the Firestore Admin REST API with a service-account key, so it
 * bypasses Firestore security rules.
 *
 * Usage:
 *   node scripts/grant-super-admin.mjs --key "C:\\path\\to\\service-account.json" --email user@example.com
 *
 * Get the key from:
 *   Firebase Console > Project settings > Service accounts > Generate new private key
 */

import fs from "fs";
import crypto from "crypto";

const ALL_PERMISSIONS = [
  "dashboard",
  "registry",
  "inventory",
  "purchase_invoice",
  "sale_invoice",
  "status",
  "delivery",
  "clients",
  "investors",
  "banks",
  "accounts",
  "account_types",
  "cash_voucher",
  "general_voucher",
  "general_ledger",
  "logs",
  "reports",
  "settings",
  "users",
  "roles",
  "edit_delivered_vehicle",
  "ALL",
];

function getArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

const keyPath =
  getArg("key") ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  process.env.SERVICE_ACCOUNT_KEY;
const email = getArg("email");
const name = getArg("name") || email?.split("@")[0] || "Super Admin";

if (!keyPath || !email) {
  console.error(
    'Usage: node scripts/grant-super-admin.mjs --key "path/to/service-account.json" --email user@example.com [--name "Full Name"]'
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
const projectId = serviceAccount.project_id;
if (!projectId) {
  console.error("Service account key is missing project_id.");
  process.exit(1);
}

// --- 1. Mint an OAuth access token from the service account ----------------
function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

const now = Math.floor(Date.now() / 1000);
const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
const payload = base64url(
  JSON.stringify({
    iss: serviceAccount.client_email,
    scope: [
      "https://www.googleapis.com/auth/datastore",
      "https://www.googleapis.com/auth/identitytoolkit",
      "https://www.googleapis.com/auth/cloud-platform",
    ].join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })
);
const signer = crypto.createSign("RSA-SHA256");
signer.update(`${header}.${payload}`);
const assertion = `${header}.${payload}.${base64url(signer.sign(serviceAccount.private_key))}`;

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  }),
});
const tokenJson = await tokenRes.json();
if (!tokenRes.ok) {
  console.error("Failed to obtain access token:", tokenRes.status, tokenJson);
  process.exit(1);
}
const accessToken = tokenJson.access_token;

// --- Firestore helpers ------------------------------------------------------
const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

function toValue(value) {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return { integerValue: String(value) };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (value && typeof value === "object") return { mapValue: { fields: toFields(value) } };
  return { nullValue: null };
}

function toFields(object) {
  const fields = {};
  for (const [key, value] of Object.entries(object)) fields[key] = toValue(value);
  return fields;
}

async function firestoreFetch(path, options = {}) {
  const res = await fetch(`${firestoreBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // keep text
  }
  return { res, json, text };
}

async function runQuery(collectionId, fieldPath, value) {
  const { res, json, text } = await firestoreFetch(":runQuery", {
    method: "POST",
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op: "EQUAL",
            value: toValue(value),
          },
        },
        limit: 1,
      },
    }),
  });
  if (!res.ok) throw new Error(`Query ${collectionId} failed (${res.status}): ${text}`);
  const hit = (json || []).find((entry) => entry.document);
  return hit ? hit.document : null;
}

async function patchDocument(documentPath, data) {
  const mask = Object.keys(data)
    .map((key) => `updateMask.fieldPaths=${encodeURIComponent(key)}`)
    .join("&");
  const { res, text } = await firestoreFetch(`/${documentPath}?${mask}`, {
    method: "PATCH",
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error(`Update ${documentPath} failed (${res.status}): ${text}`);
}

async function createDocument(collectionId, documentId, data) {
  const { res, text } = await firestoreFetch(
    `/${collectionId}?documentId=${encodeURIComponent(documentId)}`,
    {
      method: "POST",
      body: JSON.stringify({ fields: toFields(data) }),
    }
  );
  if (!res.ok) throw new Error(`Create ${collectionId}/${documentId} failed (${res.status}): ${text}`);
}

// --- 2. Resolve the Firebase Auth user by email -----------------------------
const lookupRes = await fetch(
  `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ email: [email] }),
  }
);
const lookup = await lookupRes.json();
if (!lookupRes.ok) {
  console.error("Failed to look up user:", lookupRes.status, lookup);
  process.exit(1);
}
const authUser = lookup.users?.[0];
if (!authUser) {
  console.error(`No Firebase Auth user found for ${email}. Create the account first.`);
  process.exit(1);
}
const uid = authUser.localId;
console.log(`Found ${email} -> UID ${uid}`);

// --- 3. Ensure the Super Admin role ----------------------------------------
const timestamp = new Date();
const existingRole = await runQuery("roles", "name", "Super Admin");
let roleId;

if (existingRole) {
  roleId = existingRole.name.split("/").pop();
  await patchDocument(`roles/${roleId}`, {
    name: "Super Admin",
    description: "Full system control with all permissions.",
    permissions: ALL_PERMISSIONS,
    updatedAt: timestamp,
  });
  console.log(`Updated existing role "Super Admin" (${roleId}).`);
} else {
  roleId = "super-admin";
  await createDocument("roles", roleId, {
    name: "Super Admin",
    description: "Full system control with all permissions.",
    permissions: ALL_PERMISSIONS,
    createdAt: timestamp,
    createdBy: "grant-super-admin-script",
  });
  console.log(`Created role "Super Admin" (${roleId}).`);
}

// --- 4. Write the user document --------------------------------------------
await patchDocument(`users/${uid}`, {
  email,
  name,
  role: "Super Admin",
  roleId,
  permissions: ALL_PERMISSIONS,
  createdAt: timestamp,
  updatedAt: timestamp,
  createdBy: "grant-super-admin-script",
});
console.log(`Granted all permissions to ${email} (UID ${uid}).`);
