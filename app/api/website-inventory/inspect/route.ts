/**
 * SERVER-ONLY: reads-only structural inspection of the public website project
 * (`essani-cars-pk`). Helps identify where the EXISTING new cars actually
 * live when the dashboard's Brands & New Cars tab appears empty, e.g.:
 *   - brand docs without a `name` field,
 *   - cars stored in a differently-named subcollection,
 *   - a flat `new_cars` collection (docs are cars, not brands),
 *   - data in a named (non-default) Firestore database.
 *
 * Never returns credential material. Read-only.
 */
import { NextResponse } from "next/server";
import type { CollectionReference, Firestore } from "firebase-admin/firestore";
import { authenticateWebsiteApiRequest } from "@/lib/websiteServerAuth";
import { websiteApiError } from "@/lib/websiteApiHelpers";
import { getWebsiteFirestore, getWebsiteDatabaseId } from "@/lib/websiteFirebaseAdmin";
import { explainBrandDocShape } from "@/lib/websiteInventoryAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function countDocs(colRef: CollectionReference) {
  try {
    const snapshot = await colRef.count().get();
    return snapshot.data().count;
  } catch {
    // Count-aggregation unsupported (older datastore) — fall back to size.
    try {
      const snap = await colRef.limit(500).get();
      return snap.size;
    } catch {
      return -1;
    }
  }
}

async function probeCollection(db: Firestore, name: string) {
  try {
    const total = await countDocs(db.collection(name));
    const sample = await db.collection(name).limit(3).get();
    return {
      collection: name,
      totalDocs: total,
      sampleDocIds: sample.docs.map((d) => d.id),
      sampleFieldKeys: sample.docs[0] ? Object.keys(sample.docs[0].data()).slice(0, 15) : [],
      carLike: sample.docs[0] ? explainBrandDocShape(sample.docs[0].data()) : null,
    };
  } catch (error: any) {
    return { collection: name, error: String(error?.message || error) };
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
    const db = getWebsiteFirestore();
    const report: Record<string, any> = {
      databaseId: getWebsiteDatabaseId(),
    };

    // 1. Every top-level doc in `new_cars` + its subcollections.
    const brandsSnap = await db.collection("new_cars").get();
    const brandDocs = [];
    for (const doc of brandsSnap.docs.slice(0, 50)) {
      const subcollections = [];
      try {
        const cols = await doc.ref.listCollections();
        for (const col of cols) {
          subcollections.push({
            id: col.id,
            docs: await countDocs(col),
          });
        }
      } catch (error: any) {
        subcollections.push({ error: String(error?.message || error) });
      }
      brandDocs.push({
        id: doc.id,
        fieldKeys: Object.keys(doc.data()).slice(0, 15),
        shape: explainBrandDocShape(doc.data()),
        subcollections,
      });
    }
    report.new_cars = { totalDocs: brandsSnap.size, docs: brandDocs };

    // 2. All `cars` subcollections anywhere (catches alternate parents).
    try {
      const group = await db.collectionGroup("cars").limit(5).get();
      const groupCount = await db.collectionGroup("cars").count().get();
      report.collectionGroup_cars = {
        totalDocs: groupCount.data().count,
        samplePaths: group.docs.map((d) => d.ref.path),
      };
    } catch (error: any) {
      report.collectionGroup_cars = { error: String(error?.message || error) };
    }

    // 3. Alternate top-level collections the website might have used.
    report.alternativeCollections = [];
    for (const name of ["newCars", "cars", "brands", "new_cars_flat"]) {
      report.alternativeCollections.push(await probeCollection(db, name));
    }

    // 4. Used cars (for reference).
    try {
      report.used_cars = { totalDocs: await countDocs(db.collection("used_cars")) };
    } catch (error: any) {
      report.used_cars = { error: String(error?.message || error) };
    }

    return NextResponse.json(report);
  } catch (error) {
    return websiteApiError(error, "GET /api/website-inventory/inspect");
  }
}
