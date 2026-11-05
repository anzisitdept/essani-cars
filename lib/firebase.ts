import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

// NOTE: typed as `undefined`-prone simply so `Boolean()` sees presence.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

/**
 * True when the public Firebase keys are present in this environment.
 * Deployments MUST set the NEXT_PUBLIC_FIREBASE_* variables (see
 * .env.example). When they are missing we skip initialization instead of
 * crashing every import with auth/invalid-api-key during static prerender.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
);

let app: FirebaseApp | null = null;
if (isFirebaseConfigured) {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
}

// Cast keeps every existing consumer's `Auth`/`Firestore` type intact; with a
// missing config these are null at runtime and the auth provider surfaces a
// clear configuration error instead of the build failing.
export const auth: Auth = (app ? getAuth(app) : null) as unknown as Auth;
export const db: Firestore = (app ? getFirestore(app) : null) as unknown as Firestore;
export const storage: FirebaseStorage = (app ? getStorage(app) : null) as unknown as FirebaseStorage;

// Public Website Firebase Project (caruzen-motors-website)
const websiteFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_WEBSITE_FIREBASE_API_KEY || "AIzaSyBLySaR5ZogJTT0VsabL99GxzufbWIVjT0",
  authDomain: process.env.NEXT_PUBLIC_WEBSITE_FIREBASE_AUTH_DOMAIN || "caruzen-motors-website.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_WEBSITE_FIREBASE_PROJECT_ID || "caruzen-motors-website",
  storageBucket: process.env.NEXT_PUBLIC_WEBSITE_FIREBASE_STORAGE_BUCKET || "caruzen-motors-website.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_WEBSITE_FIREBASE_MESSAGING_SENDER_ID || "549022539571",
  appId: process.env.NEXT_PUBLIC_WEBSITE_FIREBASE_APP_ID || "1:549022539571:web:e0f6f70c14bf0ba93de846",
  measurementId: process.env.NEXT_PUBLIC_WEBSITE_FIREBASE_MEASUREMENT_ID || "G-K4YMP3DRYM"
};

const websiteAppName = "caruzen-motors-website";
const websiteApp = getApps().find(a => a.name === websiteAppName)
  || initializeApp(websiteFirebaseConfig, websiteAppName);

export const websiteDb: Firestore = getFirestore(websiteApp);