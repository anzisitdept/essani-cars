/**
 * SERVER-ONLY: Authorization for the Website module's server routes.
 *
 * Software users authenticate with the software's own Firebase project
 * (`essani-cars-software`). The browser sends that Firebase Auth ID token as a
 * Bearer header, and this module verifies the token against Google's public
 * Secure Token service keys. This does NOT require a service account for the
 * software project and leaves its configuration untouched.
 *
 * On top of the signed-in check, every page/action in the Website module keeps
 * using the software's existing permission model (`inventory` permission /
 * admin / Super Admin) exactly like the other dashboards modules, enforced in
 * the same way (AuthContext + Firestore rules).
 *
 * No credential material is ever logged.
 */

import { createPublicKey, verify as cryptoVerify } from "crypto";

const FIREBASE_SECURE_TOKEN_ISSUER_PREFIX = "https://securetoken.google.com/";
const JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

interface JsonWebKey {
  kty: string;
  alg?: string;
  use?: string;
  kid: string;
  n: string;
  e: string;
}

interface JwksCache {
  keys: JsonWebKey[];
  fetchedAt: number;
  maxAgeMs: number;
}

let jwksCache: JwksCache | null = null;
let jwksFetchPromise: Promise<JwksCache> | null = null;

function decodeSegment(segment: string): any {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  const buf = Buffer.from(padded, "base64");
  return JSON.parse(buf.toString("utf8"));
}

async function fetchJwks(): Promise<JwksCache> {
  if (jwksFetchPromise) return jwksFetchPromise;
  jwksFetchPromise = (async () => {
    const response = await fetch(JWKS_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Could not load Google Secure Token public keys (${response.status}).`);
    }
    const data = (await response.json()) as { keys: JsonWebKey[] };
    const cacheControl = response.headers.get("cache-control") || "";
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    const maxAgeMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 60 * 60 * 1000;
    return { keys: data.keys || [], fetchedAt: Date.now(), maxAgeMs };
  })();
  try {
    return await jwksFetchPromise;
  } finally {
    jwksFetchPromise = null;
  }
}

async function getJwks(): Promise<JwksCache> {
  if (!jwksCache || Date.now() - jwksCache.fetchedAt > jwksCache.maxAgeMs) {
    jwksCache = await fetchJwks();
  }
  return jwksCache;
}

export interface VerifiedSoftwareUser {
  uid: string;
  email: string | null;
}

function getSoftwareProjectId(): string {
  return (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "").trim();
}

/**
 * Verifies a Firebase Auth ID token issued by the software project.
 * Throws a descriptive error for any invalid token.
 */
export async function verifySoftwareIdToken(idToken: string): Promise<VerifiedSoftwareUser> {
  const projectId = getSoftwareProjectId();
  if (!projectId) {
    throw new Error("Software Firebase project id is not configured (NEXT_PUBLIC_FIREBASE_PROJECT_ID).");
  }

  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed authorization token.");
  }

  const header = decodeSegment(parts[0]);
  const payload = decodeSegment(parts[1]);

  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Unsupported authorization token format.");
  }
  if (payload.aud !== projectId) {
    throw new Error("Authorization token is not for this application.");
  }
  if (payload.iss !== FIREBASE_SECURE_TOKEN_ISSUER_PREFIX + projectId) {
    throw new Error("Authorization token issuer mismatch.");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const backdate = 5 * 60; // clock skew tolerance
  if (typeof payload.exp !== "number" || payload.exp <= nowSec) {
    throw new Error("Authorization token has expired. Sign in again.");
  }
  if (typeof payload.iat !== "number" || payload.iat > nowSec + backdate) {
    throw new Error("Authorization token issued in the future.");
  }
  if (typeof payload.auth_time !== "number" || payload.auth_time > nowSec + backdate) {
    throw new Error("Authorization token authentication time is invalid.");
  }

  const { keys } = await getJwks();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    // Keys just rotated — force a refresh on the next call.
    jwksCache = null;
    throw new Error("Authorization token signed with an unrecognized key. Sign in again.");
  }

  const publicKey = createPublicKey({ key: jwk as any, format: "jwk" });
  const signatureOk = cryptoVerify(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    publicKey,
    Buffer.from(parts[2].replace(/-/g, "+").replace(/_/g, "/"), "base64"),
  );
  if (!signatureOk) {
    throw new Error("Authorization token signature check failed.");
  }

  if (!payload.sub) {
    throw new Error("Authorization token has no user id.");
  }

  return { uid: payload.sub, email: typeof payload.email === "string" ? payload.email : null };
}

export interface ApiAuthResult {
  user: VerifiedSoftwareUser | null;
  error?: { message: string; status: number };
}

/** Extracts and verifies the Bearer ID token from a Next.js request. */
export async function authenticateWebsiteApiRequest(
  request: Request,
): Promise<ApiAuthResult> {
  const authHeader = request.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return {
      user: null,
      error: { message: "Missing authorization token. Please sign in again.", status: 401 },
    };
  }
  try {
    const user = await verifySoftwareIdToken(match[1].trim());
    return { user };
  } catch (error: any) {
    return {
      user: null,
      error: {
        message: String(error?.message || "Authorization failed."),
        status: 401,
      },
    };
  }
}
