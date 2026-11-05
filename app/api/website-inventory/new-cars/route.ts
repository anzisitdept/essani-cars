/**
 * SERVER-ONLY: new-car management for the Essani Cars public website project
 * (`essani-cars-pk`). Cars live at `new_cars/{brandSlug}/cars/{carId}`;
 * variants (optional) live in the car's `variants` subcollection.
 */
import { NextResponse } from "next/server";
import { authenticateWebsiteApiRequest } from "@/lib/websiteServerAuth";
import { websiteApiError, readJsonBody } from "@/lib/websiteApiHelpers";
import {
  listWebsiteNewCars,
  createWebsiteNewCar,
  updateWebsiteNewCar,
  deleteWebsiteNewCar,
  type WebsiteNewCarInput,
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
    const brand = url.searchParams.get("brand") || undefined;
    return NextResponse.json({ cars: await listWebsiteNewCars(brand) });
  } catch (error) {
    return websiteApiError(error, "GET /api/website-inventory/new-cars");
  }
}

export async function POST(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const body = await readJsonBody(request);
    const brandSlug = String(body?.brandSlug || "").trim();
    const brandName = String(body?.brandName || "").trim();
    const car: WebsiteNewCarInput | undefined = body?.car;
    if (!brandSlug || !brandName || !car?.model) {
      return NextResponse.json(
        { error: "brandSlug, brandName and car.model are required." },
        { status: 400 },
      );
    }
    const saved = await createWebsiteNewCar(
      { brandSlug, brandName },
      car,
    );
    return NextResponse.json({ car: saved });
  } catch (error) {
    return websiteApiError(error, "POST /api/website-inventory/new-cars");
  }
}

export async function PATCH(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const body = await readJsonBody(request);
    const brandSlug = String(body?.brandSlug || "").trim();
    const carId = String(body?.carId || "").trim();
    const car: WebsiteNewCarInput | undefined = body?.car;
    if (!brandSlug || !carId || !car) {
      return NextResponse.json(
        { error: "brandSlug, carId and car are required." },
        { status: 400 },
      );
    }
    const saved = await updateWebsiteNewCar(
      {
        brandSlug,
        carId,
        // The client always sends brandName for PATCH (needed to rewrite
        // brand-denormalized fields on the car doc).
        brandName: typeof body.brandName === "string" ? body.brandName : "",
      },
      car,
    );
    return NextResponse.json({ car: saved });
  } catch (error) {
    return websiteApiError(error, "PATCH /api/website-inventory/new-cars");
  }
}

export async function DELETE(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    const brand = url.searchParams.get("brand") || "";
    const id = url.searchParams.get("id") || "";
    if (!brand || !id) {
      return NextResponse.json(
        { error: "brand and id are required." },
        { status: 400 },
      );
    }
    await deleteWebsiteNewCar(brand, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return websiteApiError(error, "DELETE /api/website-inventory/new-cars");
  }
}
