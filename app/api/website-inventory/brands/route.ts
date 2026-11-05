/**
 * SERVER-ONLY: brand management for the Essani Cars public website project
 * (`essani-cars-pk`). Brands live at `new_cars/{brandSlug}` (no separate
 * top-level brands collection).
 */
import { NextResponse } from "next/server";
import { authenticateWebsiteApiRequest } from "@/lib/websiteServerAuth";
import { websiteApiError, readJsonBody } from "@/lib/websiteApiHelpers";
import {
  listWebsiteBrands,
  upsertWebsiteBrand,
  deleteWebsiteBrand,
  getWebsiteBrand,
  reorderWebsiteBrands,
  slugify,
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
    const slug = url.searchParams.get("slug");
    if (slug) {
      const brand = await getWebsiteBrand(slug);
      if (!brand) {
        return NextResponse.json({ error: "Brand not found." }, { status: 404 });
      }
      return NextResponse.json({ brand });
    }
    return NextResponse.json({ brands: await listWebsiteBrands() });
  } catch (error) {
    return websiteApiError(error, "GET /api/website-inventory/brands");
  }
}

export async function POST(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const body = await readJsonBody(request);
    const brand = body?.brand || body;
    if (!brand?.name) {
      return NextResponse.json({ error: "Brand name is required." }, { status: 400 });
    }
    const slug = slugify(brand.slug || brand.name);
    if (!slug) {
      return NextResponse.json({ error: "Could not derive a brand slug from that name." }, { status: 400 });
    }
    const saved = await upsertWebsiteBrand(slug, brand);
    return NextResponse.json({ brand: saved });
  } catch (error) {
    return websiteApiError(error, "POST /api/website-inventory/brands");
  }
}

export async function PATCH(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const body = await readJsonBody(request);
    // Dashboard brand arrangement: { reorder: [brandSlug, ...] } — writes the
    // display position of every brand into Firestore (sort_order).
    if (Array.isArray(body?.reorder)) {
      const reordered = await reorderWebsiteBrands(body.reorder.map(String));
      return NextResponse.json({ success: true, reordered });
    }
    if (!body?.slug) {
      return NextResponse.json({ error: "Brand slug is required." }, { status: 400 });
    }
    const saved = await upsertWebsiteBrand(String(body.slug), body.brand || body);
    return NextResponse.json({ brand: saved });
  } catch (error) {
    return websiteApiError(error, "PATCH /api/website-inventory/brands");
  }
}

export async function DELETE(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");
    if (!slug) {
      return NextResponse.json({ error: "Brand slug is required." }, { status: 400 });
    }
    await deleteWebsiteBrand(slug);
    return NextResponse.json({ success: true });
  } catch (error) {
    return websiteApiError(error, "DELETE /api/website-inventory/brands");
  }
}
