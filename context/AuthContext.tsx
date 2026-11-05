"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
  User,
  UserCredential
} from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";

// Fix for: Property '__initial_auth_token' does not exist on type 'Window'
declare global {
  interface Window {
    __initial_auth_token?: string;
  }
}

// Define the shape of the user data stored in Firestore
interface UserData {
  role: 'admin' | 'manager' | string;
  roleId?: string;
  permissions?: string[];
  name?: string;
  [key: string]: any;
}

// Accounts in this list always receive full system access, even if their
// Firestore user/role document is missing or has incomplete permissions.
const SUPER_ADMIN_EMAILS = ["shayane.essani21@gmail.com"];

// Keep in sync with the permissions in features/roles/RoleManagement.tsx.
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

const isSuperAdminEmail = (email?: string | null) =>
  !!email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase());

interface AuthContextType {
  user: User | null;
  userData: UserData | null; // Added userData to context
  loading: boolean;
  login: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Missing public Firebase configuration (deploy without env vars):
    // finish loading with no user and log a clear, actionable error
    // instead of crashing on auth/invalid-api-key.
    if (!isFirebaseConfigured || !auth || !db) {
      console.error(
        "Firebase client configuration is missing. Set the NEXT_PUBLIC_FIREBASE_* " +
        "environment variables on this environment (see .env.example) and redeploy."
      );
      setLoading(false);
      return;
    }

    // Check for custom token if provided by server context
    if (typeof window !== 'undefined' && window.__initial_auth_token) {
      signInWithCustomToken(auth, window.__initial_auth_token).catch(console.error);
    }

    let userDataUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      // Clean up previous user data listener
      if (userDataUnsubscribe) {
        userDataUnsubscribe();
        userDataUnsubscribe = null;
      }

      if (u) {
        // Set up real-time listener for user data (including signature updates)
        const docRef = doc(db, "users", u.uid);
        userDataUnsubscribe = onSnapshot(docRef, async (docSnap) => {
          const data = docSnap.exists() ? (docSnap.data() as UserData) : null;

          // Full access for the configured super-admin emails. Also treat the
          // "Super Admin" role as all-powerful so it behaves like the sidebar.
          if (isSuperAdminEmail(u.email) || data?.role === "Super Admin") {
            setUserData({
              ...(data ?? {}),
              email: u.email ?? data?.email,
              role: "Super Admin",
              permissions: ALL_PERMISSIONS,
            });
            return;
          }

          if (!data) {
            // Handle case where auth exists but no db record (fallback)
            console.warn("No user document found in Firestore for this UID");
            setUserData({ role: 'manager', permissions: [] });
            return;
          }

          let permissions: string[] = [];

          // 1. If user has a roleId, fetch dynamic permissions
          if (data.roleId) {
            try {
              const roleRef = doc(db, "roles", data.roleId);
              const roleSnap = await getDoc(roleRef);
              if (roleSnap.exists()) {
                permissions = roleSnap.data().permissions || [];
              }
            } catch (err) {
              console.error("Error fetching permissions for role:", data.roleId, err);
            }
          }
          // 2. Fallback/Legacy Logic
          else if (data.role === 'admin') {
            permissions = ['ALL']; // admin gets everything
          } else if (data.role === 'manager') {
            // Default manager permissions if no roleId attached
            permissions = ['dashboard', 'inventory', 'status', 'logs'];
          }

          setUserData({ ...data, permissions });
        }, (error) => {
          console.error("Error listening to user data:", error);
          // Even if Firestore rules block the read, the configured super-admin
          // accounts keep full access to the app.
          if (isSuperAdminEmail(u.email)) {
            setUserData({
              email: u.email ?? undefined,
              role: "Super Admin",
              permissions: ALL_PERMISSIONS,
            });
          } else {
            setUserData(null);
          }
        });
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => {
      authUnsubscribe();
      if (userDataUnsubscribe) {
        userDataUnsubscribe();
      }
    };
  }, []);

  const login = (email: string, password: string) => {
    if (!auth) {
      return Promise.reject(
        new Error(
          "Sign-in is unavailable: the environment is missing its Firebase configuration " +
          "(NEXT_PUBLIC_FIREBASE_* variables). Add them on the server and redeploy."
        )
      );
    }
    return signInWithEmailAndPassword(auth, email, password);
  };
  const logout = async () => {
    if (!auth) return;
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};