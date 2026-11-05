/**
 * SERVER-ONLY: live counts from the public website project (`essani-cars-pk`).
 * Powers the dashboard's stats cards so they reflect BOTH the used cars and
 * the brands & new cars that are actually live in the public website project.
 */
import { NextResponse } from "next/server";
import type { Firestore, Query } from "firebase-admin/firestore";
import { authenticateWebsiteApiRequest } from "@/lib/websiteServerAuth";
import { websiteApiError } from "@/lib/websiteApiHelpers";
import { getWebsiteFirestore, getWebsiteAuth } from "@/lib/websiteFirebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function safeCount(query: Query, fallback = 0) {
  try {
    const snapshot = await query.count().get();
    return snapshot.data().count;
  } catch {
    // Count aggregation unsupported or the query lacks an index — degrade
    // gracefully by reading a bounded slice instead.
    try {
      const snapshot = await query.limit(500).get();
      return snapshot.size;
    } catch {
      return fallback;
    }
  }
}

export async function GET(request: Request) {
  const auth = await authenticateWebsiteApiRequest(request);
  if (!auth.user) {
    return NextResponse.json(
      { error: auth.error?.message || "Unauthorized" },
      { status: auth.error?.status || 401 },
    );
  }

  try {
    const db: Firestore = getWebsiteFirestore();

    // ---- Used cars: tallied from the docs (bounded read) so the
    //      published/hidden/sold buckets stay exact without composite indexes.
    const usedSnap = await db.collection("used_cars").limit(500).get();
    const used = {
      total: await safeCount(db.collection("used_cars")),
      live: 0,     // published, not sold, not hidden → visible on the site
      hidden: 0,   // drafts / hidden / sold → not reachable by visitors
      published: 0,
      draft: 0,
      sold: 0,
    };
    for (const doc of usedSnap.docs) {
      const data = doc.data() || {};
      const isDraft = data.status === "draft";
      if (isDraft) used.draft++; else used.published++;
      if (data.isSold === true) used.sold++;
      const live = !isDraft && data.isSold !== true && data.isHidden !== true;
      if (live) used.live++; else used.hidden++;
    }

    // ---- New cars & brands: stat projections only. Car docs are scraped and
    //      sizeable — never fetch all of them just to count. A bare projection
    //      of the `status` field has no WHERE filters, so it needs no indexes
    //      (this database has collection-group single-field indexes disabled).
    let newStats = { total: 0, live: 0, draft: 0, brands: 0 };
    try {
      const carStatusSnap = await db.collectionGroup("cars").select("status").limit(2000).get();
      let draft = 0;
      for (const doc of carStatusSnap.docs) {
        const status = (doc.data() || {}).status;
        if (status === "draft") draft++;
      }
      newStats = {
        total: carStatusSnap.size,
        live: Math.max(carStatusSnap.size - draft, 0),
        draft,
        brands: await safeCount(db.collection("new_cars")),
      };
    } catch {
      // Leave zeros — the dashboard falls back to software-side counts.
    }

    // ---- Registered users: actual Firebase Auth accounts of the website
    //      project (Auth is the source of truth for registrations, not any
    //      Firestore copy). Paged 1000 at a time, capped so a huge Auth DB
    //      can never hang this endpoint.
    let users: { total: number | null } = { total: null };
    try {
      const authClient = getWebsiteAuth();
      let total = 0;
      let pageToken: string | undefined;
      let pages = 0;
      while (pages < 25) {
        const res = await authClient.listUsers(1000, pageToken);
        total += res.users.length;
        pages++;
        pageToken = res.pageToken ?? undefined;
        if (!pageToken) break;
      }
      users = { total };
    } catch {
      // Auth listing unavailable for this service account — the dashboard
      // falls back to the software-side count.
    }

    return NextResponse.json({ usedCars: used, newCars: newStats, users });
  } catch (error) {
    return websiteApiError(error, "GET /api/website-inventory/stats");
  }
}
