/**
 * SERVER-ONLY: Firebase Admin connection to the Essani Cars PUBLIC WEBSITE
 * project (`essani-cars-pk`).
 *
 * This is a completely separate Firebase project from the software itself
 * (`essani-cars-software`, which is configured in `lib/firebase.ts` and must
 * remain untouched). To make any accidental mixing impossible, this module
 * initializes a NAMED Admin app (`essani-cars-website-admin`) that never
 * becomes the default app, and it is only imported by the Website module's
 * server routes.
 *
 * Credentials live in server-side environment variables only:
 *   - WEBSITE_FIREBASE_PROJECT_ID
 *   - WEBSITE_FIREBASE_CLIENT_EMAIL
 *   - WEBSITE_FIREBASE_PRIVATE_KEY
 *
 * The private key is never logged, never sent to the browser and must stay
 * out of source control (`.env.local` is gitignored; `.env.example` only
 * contains the placeholder names).
 */

import type { App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";

/** Named app so this connection cannot replace/conflict with any other app. */
const WEBSITE_ADMIN_APP_NAME = "essani-cars-website-admin";

/**
 * Optional: if the website project stores its Firestore data in a named
 * database (not the default one), set e.g.
 *   WEBSITE_FIREBASE_DATABASE_ID=<database-id>
 * Empty/unset means the (default) database.
 */
export function getWebsiteDatabaseId(): string {
  const dbId = (process.env.WEBSITE_FIREBASE_DATABASE_ID || "").trim();
  return dbId || "(default)";
}

export interface WebsiteFirebaseConfigStatus {
  ok: boolean;
  projectId: string;
  /** Service account email with the local part masked for display. */
  clientEmailMasked: string;
  error?: string;
  /** Human-readable fix hint for the dashboard banner. */
  hint?: string;
}

function getRawConfig() {
  return {
    projectId: (process.env.WEBSITE_FIREBASE_PROJECT_ID || "").trim(),
    clientEmail: (process.env.WEBSITE_FIREBASE_CLIENT_EMAIL || "").trim(),
    privateKey: process.env.WEBSITE_FIREBASE_PRIVATE_KEY || "",
  };
}

export function maskServiceAccountEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "********";
  return `${"*".repeat(8)}${email.slice(at)}`;
}

/**
 * Reads + validates the website credentials WITHOUT initializing anything.
 * Returns a human-readable error message when the credentials are missing
 * or invalid, so the module can fail clearly.
 */
export function describeWebsiteFirebaseConfig(): WebsiteFirebaseConfigStatus {
  const { projectId, clientEmail, privateKey } = getRawConfig();
  const masked = maskServiceAccountEmail(clientEmail);
  const hintBase =
    "Create a service account key for the public website project at " +
    "Firebase console -> essani-cars-pk -> Project settings -> Service accounts " +
    "-> Generate new private key (JSON), then set the three " +
    "WEBSITE_FIREBASE_* environment variables on the server only.";

  if (!projectId && !clientEmail && !privateKey) {
    return {
      ok: false,
      projectId: "essani-cars-pk",
      clientEmailMasked: masked,
      error:
        "Website Firebase credentials are missing. Set WEBSITE_FIREBASE_PROJECT_ID, " +
        "WEBSITE_FIREBASE_CLIENT_EMAIL and WEBSITE_FIREBASE_PRIVATE_KEY on the server.",
      hint: hintBase,
    };
  }
  if (!projectId) {
    return {
      ok: false,
      projectId: "",
      clientEmailMasked: masked,
      error: "WEBSITE_FIREBASE_PROJECT_ID is not set.",
      hint: hintBase,
    };
  }
  if (!clientEmail) {
    return {
      ok: false,
      projectId,
      clientEmailMasked: masked,
      error: "WEBSITE_FIREBASE_CLIENT_EMAIL is not set.",
      hint: hintBase,
    };
  }
  if (!/^[^\s@]+@([^\s@]+)\.iam\.gserviceaccount\.com$/i.test(clientEmail)) {
    return {
      ok: false,
      projectId,
      clientEmailMasked: masked,
      error:
        "WEBSITE_FIREBASE_CLIENT_EMAIL is not a valid Firebase service account email. " +
        "It must look like firebase-adminsdk-xxxxx@<project-id>.iam.gserviceaccount.com " +
        `(received: "${masked}").`,
      hint: hintBase,
    };
  }
  if (!privateKey) {
    return {
      ok: false,
      projectId,
      clientEmailMasked: masked,
      error: "WEBSITE_FIREBASE_PRIVATE_KEY is not set.",
      hint: hintBase,
    };
  }
  const normalized = privateKey.replace(/\\n/g, "\n").trim();
  if (!normalized.startsWith("-----BEGIN PRIVATE KEY-----")) {
    return {
      ok: false,
      projectId,
      clientEmailMasked: masked,
      error:
        "WEBSITE_FIREBASE_PRIVATE_KEY does not look like a service account private key. " +
        "It must be the PEM key that starts with '-----BEGIN PRIVATE KEY-----' from the " +
        "service account JSON file (the provided value looks like a web API key instead).",
      hint: hintBase,
    };
  }
  return { ok: true, projectId, clientEmailMasked: masked };
}

/**
 * Loads the firebase-admin SDK pieces lazily (inside the functions that need
 * them) so that a missing/incompatible install on a host surfaces an
 * actionable error message from the routes instead of crashing the module at
 * import time and hiding the cause behind a bare HTTP 500.
 */
function loadAdminSdk() {
  try {
    const appModule = require("firebase-admin/app");
    const fireModule = require("firebase-admin/firestore");
    const authModule = require("firebase-admin/auth");
    return {
      initializeApp: appModule.initializeApp as typeof import("firebase-admin/app").initializeApp,
      getApps: appModule.getApps as typeof import("firebase-admin/app").getApps,
      cert: appModule.cert as typeof import("firebase-admin/app").cert,
      getFirestore: fireModule.getFirestore as typeof import("firebase-admin/firestore").getFirestore,
      getAuth: authModule.getAuth as typeof import("firebase-admin/auth").getAuth,
    };
  } catch (error: any) {
    throw new Error(
      "[Website Firebase] The server SDK (firebase-admin) failed to load on this server. " +
      "Pull the latest code, run `npm install` on the server with Node.js 20+ " +
      "(firebase-admin 14 requires Node 20) and restart the app. " +
      `Detail: ${String(error?.message || error).slice(0, 300)}`
    );
  }
}

/**
 * Lazily creates (a cached instance of) the named Admin app + Firestore for
 * the public website project. Throws with a clear message when credentials
 * are missing or invalid — never when the site env is simply unset.
 */
function getWebsiteAdminApp(): App {
  const status = describeWebsiteFirebaseConfig();
  if (!status.ok) {
    throw new Error(`[Website Firebase] ${status.error}`);
  }
  const { getApps, initializeApp, cert } = loadAdminSdk();
  const existing = getApps().find((a) => a.name === WEBSITE_ADMIN_APP_NAME);
  if (existing) return existing;

  const { clientEmail, privateKey } = getRawConfig();
  const normalizedPrivateKey = privateKey.replace(/\\n/g, "\n");
  try {
    // Named app: has its own name, so it can never become/replace the
    // default app or any app used by other modules.
    return initializeApp(
      {
        credential: cert({
          projectId: status.projectId,
          clientEmail,
          // Stored keys often contain escaped "\n" sequences.
          privateKey: normalizedPrivateKey,
        }),
        projectId: status.projectId,
      },
      WEBSITE_ADMIN_APP_NAME,
    );
  } catch (error) {
    const detail = String(
      error instanceof Error ? error.message : error || "unknown error",
    );
    // Never include the key material in any error message.
    if (/invalid|PEM|private key/i.test(detail)) {
      throw new Error(
        "[Website Firebase] WEBSITE_FIREBASE_PRIVATE_KEY could not be parsed as a " +
          "service account private key. Verify the key (including escaped \\n newlines) " +
          "and try again.",
      );
    }
    throw new Error(`[Website Firebase] Failed to initialize Admin connection: ${detail}`);
  }
}

/** Admin Firestore client for the `essani-cars-pk` website project. */
export function getWebsiteFirestore(): Firestore {
  const app = getWebsiteAdminApp();
  const { getFirestore } = loadAdminSdk();
  const databaseId = getWebsiteDatabaseId();
  if (databaseId === "(default)") {
    return getFirestore(app);
  }
  // Named (non-default) Firestore database on the website project.
  return getFirestore(app, databaseId);
}

/** Admin Auth client for the `essani-cars-pk` website project (registered users). */
export function getWebsiteAuth(): Auth {
  const { getAuth } = loadAdminSdk();
  return getAuth(getWebsiteAdminApp());
}
