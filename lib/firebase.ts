import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

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