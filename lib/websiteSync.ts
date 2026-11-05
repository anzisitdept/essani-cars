/**
 * CLIENT-SIDE sync layer for the Website module.
 *
 * All writes to the public website (project `essani-cars-pk`) go through the
 * server routes in `app/api/website-inventory/*`, which use the isolated
 * Firebase Admin connection (`lib/websiteFirebaseAdmin.ts`). The browser
 * never talks to Firestore directly for the website project and never sees
 * the website service-account credentials.
 *
 * The software's OWN Firestore (`db` from `lib/firebase.ts`) keeps receiving
 * the module's audit copies in `website-inventory` exactly as before, so the
 * software project behavior is unchanged.
 */

import { doc, updateDoc, deleteDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "./firebase";

/* ------------------------------------------------------------ API helper */

/** Calls a website-inventory server route with the signed-in user's token. */
export async function websiteApiFetch(path: string, init: RequestInit = {}) {
  let authError: string | null = null;
  try {
    if (!auth.currentUser) {
      authError = "You must be signed in to manage the website inventory.";
      throw new Error(authError);
    }

    const send = async (forceRefresh: boolean) => {
      const token = await auth.currentUser!.getIdToken(forceRefresh);
      return fetch(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(init.headers || {}),
        },
      });
    };

    let response: Response = await send(false);
    // A cached token may have just expired (or keys rotated) — force refresh once.
    if (response.status === 401) {
      response = await send(true);
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.error) {
      throw new Error(data?.error || `Website API request failed (${response.status}).`);
    }
    return data;
  } catch (error: any) {
    if (/Failed to fetch|network/i.test(String(error?.message || ""))) {
      throw new Error(
        "Could not reach the website inventory server. Check your connection and the server's WEBSITE_FIREBASE_* configuration.",
      );
    }
    throw error;
  }
}

/* ------------------------------------------------------------ target info */

export interface WebsiteTargetInfo {
  projectId: string;
  databaseId?: string;
  serviceAccount: string;
  configured: boolean;
  error?: string | null;
  hint?: string | null;
}

/** Which public website project this module writes to + its health. */
export async function fetchWebsiteTargetInfo(): Promise<WebsiteTargetInfo> {
  const data = await websiteApiFetch("/api/website-inventory/config");
  return {
    projectId: data.projectId,
    databaseId: data.databaseId,
    serviceAccount: data.serviceAccount,
    configured: data.configured,
    error: data.error || null,
    hint: data.hint || null,
  };
}

/**
 * Read-only structural inspection of the website project — shows where the
 * existing new cars/listings actually live (sample ids, subcollections, shapes).
 */
export async function inspectWebsiteData(): Promise<Record<string, any>> {
  return websiteApiFetch("/api/website-inventory/inspect");
}

/**
 * Live counts from the public website project: used-car status buckets plus
 * brands & new cars (powers the dashboard's stats cards).
 */
export async function fetchWebsiteStats(): Promise<Record<string, any>> {
  return websiteApiFetch("/api/website-inventory/stats");
}

/**
 * Fetches the live used-car listings straight from the public website
 * project's `used_cars` collection — the same list visitors currently see.
 * Rows carry website fields (make, brand_name, images, status…); the module
 * maps them onto the dashboard's vehicle shape before display.
 */
export async function fetchWebsiteUsedCarListings(): Promise<any[]> {
  const res = await websiteApiFetch("/api/website-inventory/used-cars");
  return res?.listings || [];
}

/**
 * Registered user accounts of the public website project (real Firebase
 * Auth registrations), newest first, bounded to the most recent 2000.
 */
export async function fetchWebsiteRegisteredUsers(): Promise<any[]> {
  const res = await websiteApiFetch("/api/website-inventory/users");
  return res?.users || [];
}

/**
 * Customer queries captured by the public website's `queries` collection —
 * find-a-car requests (brand/budget/fuel/condition) with contact details.
 */
export async function fetchWebsiteInquiries(): Promise<any[]> {
  const res = await websiteApiFetch("/api/website-inquiries");
  return res?.inquiries || [];
}

/**
 * ALL customer queries of the public website project, newest first, for the
 * dedicated Website Inquiries page (bounded to the most recent 1000).
 */
export async function fetchWebsiteQueries(): Promise<any[]> {
  const res = await websiteApiFetch("/api/website-inquiries?limit=1000");
  return res?.inquiries || [];
}

/** Marks a website query's status (id + lower-cased status, e.g. "resolved"). */
export async function updateWebsiteQueryStatus(id: string, status: string): Promise<any[]> {
  const res = await websiteApiFetch("/api/website-inquiries", {
    method: "PATCH",
    body: JSON.stringify({ id, status }),
  });
  return res?.inquiries || [];
}

/* ------------------------------------------------- used cars (used_cars/{listingId}) */

/**
 * Upserts a used-car listing in the public website project
 * (`used_cars/{listingId}`, status "published" | "draft").
 */
export async function syncVehicleToWebsite(vehicleDocId: string, vehicleData: any) {
  try {
    await websiteApiFetch("/api/website-inventory/used-cars", {
      method: "POST",
      body: JSON.stringify({ listingId: vehicleDocId, ...vehicleData }),
    });
    console.log(`[WebsiteSync] Synced vehicle ${vehicleDocId} to the website project.`);
    return { success: true };
  } catch (error) {
    console.error(`[WebsiteSync] Error syncing vehicle ${vehicleDocId}:`, error);
    return { success: false, error };
  }
}

/**
 * Toggles hide/unhide of a listing: updates the software-side audit copy and
 * the public listing's status ("published" | "draft").
 */
export async function toggleWebsiteVehicleVisibility(vehicleDocId: string, currentIsHidden: boolean) {
  const newIsHidden = !currentIsHidden;
  const newStatus = newIsHidden ? "Hidden" : "Available";

  try {
    // 1. Software project audit copy (unchanged behavior).
    await updateDoc(doc(db, "website-inventory", vehicleDocId), {
      status: newStatus,
      isHidden: newIsHidden,
      updatedAt: serverTimestamp(),
    });

    // 2. Public website project.
    await websiteApiFetch("/api/website-inventory/used-cars", {
      method: "PATCH",
      body: JSON.stringify({
        listingId: vehicleDocId,
        status: newIsHidden ? "draft" : "published",
      }),
    });

    console.log(`[WebsiteSync] Vehicle ${vehicleDocId} visibility -> ${newStatus}`);
    return { success: true, isHidden: newIsHidden };
  } catch (error) {
    console.error(`[WebsiteSync] Error toggling vehicle ${vehicleDocId} visibility:`, error);
    throw error;
  }
}

/** Sets the public status of a listing ("Available", "Hidden", "Sold"). */
export async function updateWebsiteVehicleStatus(vehicleDocId: string, status: string) {
  try {
    const publicStatus = status === "Hidden" || status === "Sold" ? "draft" : "published";
    await websiteApiFetch("/api/website-inventory/used-cars", {
      method: "PATCH",
      body: JSON.stringify({
        listingId: vehicleDocId,
        status: publicStatus,
        ...(status === "Sold" ? { isSold: true, sold: true } : {}),
      }),
    });
    console.log(`[WebsiteSync] Vehicle ${vehicleDocId} status -> ${publicStatus}`);
    return { success: true };
  } catch (error) {
    console.error(`[WebsiteSync] Error updating status for vehicle ${vehicleDocId}:`, error);
    return { success: false, error };
  }
}

/**
 * Replaces the images (and derived cover_image) of a listing on both the
 * software audit copy and the public website project.
 */
export async function updateWebsiteVehicleImages(vehicleDocId: string, images: string[]) {
  try {
    await updateDoc(doc(db, "website-inventory", vehicleDocId), {
      images,
      updatedAt: serverTimestamp(),
    }).catch(() => {
      // The listing may not exist in the audit collection (website-only listing).
      setDoc(doc(db, "website-inventory", vehicleDocId), { images, updatedAt: serverTimestamp() }, { merge: true });
    });

    await websiteApiFetch("/api/website-inventory/used-cars", {
      method: "PATCH",
      body: JSON.stringify({ listingId: vehicleDocId, images }),
    });

    console.log(`[WebsiteSync] Images updated for vehicle ${vehicleDocId}`);
    return { success: true };
  } catch (error) {
    console.error(`[WebsiteSync] Error updating images for vehicle ${vehicleDocId}:`, error);
    return { success: false, error };
  }
}

/** Sets a listing's featured flag on both stores. */
export async function updateWebsiteVehicleFeatured(vehicleDocId: string, featured: boolean) {
  try {
    await updateDoc(doc(db, "website-inventory", vehicleDocId), {
      featured,
      updatedAt: serverTimestamp(),
    });
    await websiteApiFetch("/api/website-inventory/used-cars", {
      method: "PATCH",
      body: JSON.stringify({ listingId: vehicleDocId, featured }),
    });
    return { success: true };
  } catch (error) {
    console.error(`[WebsiteSync] Error updating featured for vehicle ${vehicleDocId}:`, error);
    throw error;
  }
}

/**
 * Deletes a listing from the public website project. When the software-side
 * audit copy exists it is removed as well, and the originating showroom car
 * (if any) is un-flagged so it can be published again later.
 */
export async function removeVehicleFromWebsite(vehicleDocId: string, sourceVehicleId?: string | null) {
  try {
    // 1. Public website project.
    await websiteApiFetch(`/api/website-inventory/used-cars?id=${encodeURIComponent(vehicleDocId)}`, {
      method: "DELETE",
    });

    // 2. Software project audit copy + source flag (module-owned data).
    try {
      await deleteDoc(doc(db, "website-inventory", vehicleDocId));
    } catch {
      // No audit copy existed — fine.
    }
    if (sourceVehicleId) {
      await updateDoc(doc(db, "cars", sourceVehicleId), {
        publishedToWeb: false,
        publishedAt: null,
      }).catch(() => undefined);
    }

    console.log(`[WebsiteSync] Removed vehicle ${vehicleDocId} from the website project.`);
    return { success: true };
  } catch (error) {
    console.error(`[WebsiteSync] Error removing vehicle ${vehicleDocId}:`, error);
    throw error;
  }
}

/* ------------------------------------- brands + new cars (new_cars/{brandSlug}) */

export const websiteBrandApi = {
  list: () => websiteApiFetch("/api/website-inventory/brands"),
  get: (slug: string) => websiteApiFetch(`/api/website-inventory/brands?slug=${encodeURIComponent(slug)}`),
  save: (brand: any) =>
    websiteApiFetch("/api/website-inventory/brands", {
      method: "POST",
      body: JSON.stringify({ brand }),
    }),
  patch: (slug: string, brand: any) =>
    websiteApiFetch("/api/website-inventory/brands", {
      method: "PATCH",
      body: JSON.stringify({ slug, brand }),
    }),
  remove: (slug: string) =>
    websiteApiFetch(`/api/website-inventory/brands?slug=${encodeURIComponent(slug)}`, {
      method: "DELETE",
    }),
  /**
   * Persist the dashboard's brand arrangement: pass every brand slug in the
   * order they should appear (websites read the written `sort_order`).
   */
  reorder: (orderedSlugs: string[]) =>
    websiteApiFetch("/api/website-inventory/brands", {
      method: "PATCH",
      body: JSON.stringify({ reorder: orderedSlugs }),
    }),
};

export const websiteNewCarApi = {
  listAll: () => websiteApiFetch("/api/website-inventory/new-cars"),
  listForBrand: (brandSlug: string) =>
    websiteApiFetch(`/api/website-inventory/new-cars?brand=${encodeURIComponent(brandSlug)}`),
  create: (brandSlug: string, brandName: string, car: any) =>
    websiteApiFetch("/api/website-inventory/new-cars", {
      method: "POST",
      body: JSON.stringify({ brandSlug, brandName, car }),
    }),
  patch: (brandSlug: string, brandName: string, carId: string, car: any) =>
    websiteApiFetch("/api/website-inventory/new-cars", {
      method: "PATCH",
      body: JSON.stringify({ brandSlug, brandName, carId, car }),
    }),
  remove: (brandSlug: string, carId: string) =>
    websiteApiFetch(
      `/api/website-inventory/new-cars?brand=${encodeURIComponent(brandSlug)}&id=${encodeURIComponent(carId)}`,
      { method: "DELETE" },
    ),
};
