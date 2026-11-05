/**
 * SERVER-ONLY: used-car listing management for the Essani Cars public website
 * project (`essani-cars-pk`). Listings live at `used_cars/{listingId}` with
 * `status: "published" | "draft"`.
 */
import { NextResponse } from "next/server";
import { authenticateWebsiteApiRequest } from "@/lib/websiteServerAuth";
import { websiteApiError, readJsonBody } from "@/lib/websiteApiHelpers";
import {
  listWebsiteUsedCars,
  upsertWebsiteUsedCar,
  setWebsiteUsedCarStatus,
  deleteWebsiteUsedCar,
  getWebsiteUsedCar,
  type WebsiteStatus,
  type WebsiteUsedCarInput,
} from "@/lib/websiteInventoryAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function guard(request: Request) {
  const auth = await authenticateWebsiteApiRequest(request);
  if (!auth.user) {
    return NextResponse.json(
      { error: auth.error?.message || "Unauthorized" },
      { status: auth.error?.status || 401 },
    );
  }
  return null;
}

export async function GET(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (id) {
      const listing = await getWebsiteUsedCar(id);
      if (!listing) {
        return NextResponse.json({ error: "Listing not found." }, { status: 404 });
      }
      return NextResponse.json({ listing });
    }
    return NextResponse.json({ listings: await listWebsiteUsedCars() });
  } catch (error) {
    return websiteApiError(error, "GET /api/website-inventory/used-cars");
  }
}

/** Create a new listing (or update an existing one wholesale). */
export async function POST(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const body = await readJsonBody(request);
    const listingId = String(body?.listingId || "").trim();
    if (!listingId) {
      return NextResponse.json({ error: "listingId is required." }, { status: 400 });
    }
    if (!String(body?.make || "").trim() || !String(body?.model || "").trim()) {
      return NextResponse.json(
        { error: "make and model are required for a used-car listing." },
        { status: 400 },
      );
    }
    const saved = await upsertWebsiteUsedCar(listingId, body as WebsiteUsedCarInput);
    return NextResponse.json({ listing: saved });
  } catch (error) {
    return websiteApiError(error, "POST /api/website-inventory/used-cars");
  }
}

/**
 * Partial update: publish/unpublish (`status`), images, featured or any of
 * the contract fields. Missing fields are preserved from the existing doc.
 */
export async function PATCH(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const body = await readJsonBody(request);
    const listingId = String(body?.listingId || "").trim();
    if (!listingId) {
      return NextResponse.json({ error: "listingId is required." }, { status: 400 });
    }
    const keys = Object.keys(body).filter((k) => k !== "listingId");
    if (keys.length === 1 && keys[0] === "status") {
      const status: WebsiteStatus = body.status === "draft" ? "draft" : "published";
      await setWebsiteUsedCarStatus(listingId, status);
      return NextResponse.json({ success: true, status });
    }
    const saved = await upsertWebsiteUsedCar(listingId, body as WebsiteUsedCarInput);
    return NextResponse.json({ listing: saved });
  } catch (error) {
    return websiteApiError(error, "PATCH /api/website-inventory/used-cars");
  }
}

export async function DELETE(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id") || "";
    if (!id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }
    await deleteWebsiteUsedCar(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return websiteApiError(error, "DELETE /api/website-inventory/used-cars");
  }
}
