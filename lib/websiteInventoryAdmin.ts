/**
 * SERVER-ONLY: Web ivory inventory service for the Essani Cars public website
 * (`essani-cars-pk`). Implements the inventory data contract:
 *
 *   Brands:     new_cars/{brandSlug}                     (no separate brands collection)
 *   New cars:   new_cars/{brandSlug}/cars/{carId}
 *   Variants:   new_cars/{brandSlug}/cars/{carId}/variants/{variantId}
 *   Used cars:  used_cars/{listingId}                    (status: "published" | "draft")
 *
 * All writes go through the named Admin app from `websiteFirebaseAdmin.ts`,
 * so nothing here can touch the software's own Firebase project.
 *
 * Only called by API routes in `app/api/website-inventory/*` which first
 * verify the caller's identity (see `websiteServerAuth.ts`).
 */

import type { DocumentData } from "firebase-admin/firestore";
import { getWebsiteFirestore } from "./websiteFirebaseAdmin";

/**
 * FieldValue.serverTimestamp(), resolved lazily so a host without a working
 * firebase-admin install reports an actionable error from the routes rather
 * than a bare module-load 500.
 */
function fireTimestamp() {
  try {
    const { FieldValue } = require("firebase-admin/firestore");
    return FieldValue.serverTimestamp();
  } catch (error: any) {
    throw new Error(
      "[Website Firestore] The server SDK (firebase-admin) failed to load on this server. " +
      "Pull the latest code, run `npm install` with Node.js 20+ and restart. " +
      `Detail: ${String(error?.message || error).slice(0, 300)}`
    );
  }
}

export type WebsiteStatus = "published" | "draft";

/* ---------------------------------------------------------------- helpers */

export function slugify(input: string): string {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u00c0-\u017f]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** "toyota-corolla" -> "Toyota Corolla" (display fallback for legacy docs). */
export function titleCaseFromSlug(slug: string): string {
  return slugify(slug)
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Brand docs that already exist in the website project may name the brand in
 * a different field (`title`, `brand_name`) or not at all — the id doubles as
 * the slug. Returns a guaranteed display name + resolved logo url for the UI.
 */
function normalizeBrandForClient(id: string, data: Record<string, unknown>) {
  const name =
    (data.name as string) ||
    (data.title as string) ||
    (data.brand_name as string) ||
    (data.brandName as string) ||
    titleCaseFromSlug(id);
  const logo =
    (data.logo_url as string) ||
    (data.logoUrl as string) ||
    (data.logo as string) ||
    (data.icon as string) ||
    "";
  const status =
    (data.status as string) === "draft" ? "draft" : "published";
  return {
    id,
    ...data,
    name,
    logo_url: logo,
    logoUrl: logo,
    status,
    // The website scout stores the brand's car count as `total_cars`; surface
    // it under the contract's `car_count` name for the dashboard.
    car_count: parseNumber(data.car_count) ?? parseNumber(data.carCount) ?? parseNumber(data.total_cars) ?? null,
    // Display arrangement (drag & drop) — null until the brands are arranged once.
    sort_order: parseNumber(data.sort_order) ?? parseNumber(data.sortOrder) ?? null,
  };
}

/** Image values may be URL strings or objects containing a `url` field. */
export function normalizeImages(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .map((img) => {
      if (typeof img === "string") return img.trim();
      if (img && typeof img === "object") {
        const url = (img as any).url ?? (img as any).src ?? "";
        return typeof url === "string" ? url.trim() : "";
      }
      return "";
    })
    .filter(Boolean);
}

function withTimestamps(
  data: Record<string, unknown>,
  isNew: boolean,
): Record<string, unknown> {
  const now = fireTimestamp();
  if (isNew) {
    return { ...data, createdAt: data.createdAt || now, updatedAt: now };
  }
  return { ...data, updatedAt: now };
}

function parseNumber(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Keeps values this module cannot express intact: when an existing document
 * holds a price as nearly-free text (e.g. "PKR 3.5 crore"), an edit that
 * doesn't supply the field anymore keeps the original value instead of
 * overwriting it with null.
 */
function keepValueOrNumber(value: unknown): number | string | null {
  const n = parseNumber(value);
  if (n != null) return n;
  // Preserve strings the form can't express (e.g. "PKR 2.5 crore").
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  return null;
}

/* ------------------------------------------------------------- brands */

export interface WebsiteBrandInput {
  name: string;
  slug?: string;
  logoUrl?: string;
  description?: string;
  status?: WebsiteStatus;
  sortOrder?: number;
}

function brandDocId(input: WebsiteBrandInput): string {
  return slugify(input.slug || input.name);
}

function brandPayload(
  input: WebsiteBrandInput,
  isNew: boolean,
  existingStatus?: string,
  existingDoc?: DocumentData | null,
): DocumentData {
  // Explicit status wins; otherwise keep the existing one; default published
  // on create (and never downgrade an existing live brand by omission).
  const status: WebsiteStatus =
    input.status === "draft" || input.status === "published"
      ? input.status
      : ((existingStatus as WebsiteStatus) || "published");

  // Arrangement lives on the brand document (set by drag & drop reordering).
  // Preserve the existing value when the caller doesn't manage this field.
  const retainedOrder =
    parseNumber(input.sortOrder) ??
    keepValueOrNumber(existingDoc?.sort_order ?? existingDoc?.sortOrder) ??
    0;

  return withTimestamps(
    {
      slug: brandDocId(input),
      name: (input.name || "").trim(),
      // Logo reachable on both naming conventions for website compatibility.
      logo_url: (input.logoUrl || "").trim(),
      logoUrl: (input.logoUrl || "").trim(),
      description: (input.description || "").trim(),
      status,
      sort_order: retainedOrder,
      sortOrder: retainedOrder,
    },
    isNew,
  );
}

/**
 * Brand docs can be arranged in the dashboard. Firestore has no native
 * ordering across a plain collection read, so we persist an explicit
 * `sort_order` (set by drag & drop) and sort here: assigned indexes first in
 * ascending order, then unassigned brands alphabetically.
 */
function sortBrandDocs<T extends { id: string; data(): DocumentData }>(docs: T[]): T[] {
  const rankOf = (d: T): number | null =>
    parseNumber(d.data()?.sort_order) ?? parseNumber(d.data()?.sortOrder);
  const nameOf = (d: T): string => String(d.data()?.name || d.id).toLowerCase();
  return [...docs].sort((a, b) => {
    const ra = rankOf(a);
    const rb = rankOf(b);
    if (ra != null && rb != null) {
      return ra !== rb ? ra - rb : nameOf(a).localeCompare(nameOf(b));
    }
    if (ra != null) return -1;
    if (rb != null) return 1;
    return nameOf(a).localeCompare(nameOf(b));
  });
}

export async function listWebsiteBrands() {
  const db = getWebsiteFirestore();
  const snap = await db.collection("new_cars").get();
  return sortBrandDocs(snap.docs).map((d) => normalizeBrandForClient(d.id, d.data()));
}

/**
 * Persists the dashboard's brand arrangement into Firestore by writing
 * `sort_order` on every brand document in one batched commit. Slugs not
 * included in the list keep their spots after the arranged ones.
 */
export async function reorderWebsiteBrands(orderedSlugs: string[]) {
  const db = getWebsiteFirestore();
  const snap = await db.collection("new_cars").get();
  const existing = new Map(snap.docs.map((d) => [d.id, d]));
  const ordered = [...new Set(orderedSlugs.map(String))].filter((slug) => existing.has(slug));
  const rest = snap.docs.map((d) => d.id).filter((id) => !ordered.includes(id));
  const finalOrder = [...ordered, ...rest];

  const batch = db.batch();
  finalOrder.forEach((slug, index) => {
    batch.set(
      db.collection("new_cars").doc(slug),
      {
        sort_order: index,
        sortOrder: index,
        updatedAt: fireTimestamp(),
      },
      { merge: true },
    );
  });
  await batch.commit();
  return finalOrder.length;
}

export async function getWebsiteBrand(brandSlug: string) {
  const db = getWebsiteFirestore();
  const brand = await db.collection("new_cars").doc(brandSlug).get();
  if (!brand.exists) return null;
  return normalizeBrandForClient(brand.id, brand.data() || {});
}

export async function upsertWebsiteBrand(slug: string, input: WebsiteBrandInput) {
  const db = getWebsiteFirestore();
  const ref = db.collection("new_cars").doc(slug);
  const existing = await ref.get();
  const payload = brandPayload(
    input,
    !existing.exists,
    existing.exists ? String(existing.data()?.status || "") : undefined,
    existing.exists ? existing.data() : null,
  );
  // A brand created without an explicit order joins the end of the list.
  if (!existing.exists && input.sortOrder == null) {
    const top = await db.collection("new_cars").orderBy("sort_order", "desc").limit(1).get();
    const maxRank = top.empty ? -1 : (parseNumber(top.docs[0].data()?.sort_order) ?? -1);
    payload.sort_order = maxRank + 1;
    payload.sortOrder = maxRank + 1;
  }
  await ref.set(payload, { merge: true });
  const saved = await ref.get();
  return { id: saved.id, ...saved.data() };
}

export async function deleteWebsiteBrand(brandSlug: string) {
  const db = getWebsiteFirestore();
  const brand = await db.collection("new_cars").doc(brandSlug).get();
  if (!brand.exists) {
    throw new Error(`Brand "${brandSlug}" does not exist in the website project.`);
  }
  // Cascade: brand -> cars -> variants.
  const cars = await db.collection("new_cars").doc(brandSlug).collection("cars").get();
  for (const car of cars.docs) {
    const variants = await car.ref.collection("variants").get();
    for (const variant of variants.docs) await variant.ref.delete();
    await car.ref.delete();
  }
  await brand.ref.delete();
  return true;
}

/**
 * Classifies whether an existing `new_cars/{id}` document looks like a BRAND
 * document (per the data contract) or like a CAR document that was stored
 * flat in the same collection. Used by both the inspector and the listing
 * code to interpret legacy/imported website data.
 */
export function explainBrandDocShape(data: Record<string, unknown>): {
  kind: "brand" | "car" | "ambiguous";
  reasons: string[];
} {
  const reasons: string[] = [];
  const carOnlyKeys = [
    "model", "vehicles_removed", "engine_cc", "cover_image", "price_min",
    "price_max", "mileage", "transmission", "fuel_type", "fuelType",
    "body_type", "variant", "year",
  ];
  const brandOnlyKeys = [
    "logo_url", "logoUrl", "logo", "brand_url", "car_count", "carCount",
    "total_cars", "totalCars", "url", "scraped_at", "scrapedAt",
  ];

  const hasCarKeys = carOnlyKeys.filter((k) => k in data);
  const hasBrandKeys = brandOnlyKeys.filter((k) => k in data);
  if (hasCarKeys.length) reasons.push(`car-only fields: ${hasCarKeys.join(", ")}`);
  if (hasBrandKeys.length) reasons.push(`brand-only fields: ${hasBrandKeys.join(", ")}`);

  const brandish = hasBrandKeys.length > 0;
  const carish = hasCarKeys.length >= 2;
  const kind: "brand" | "car" | "ambiguous" = carish ? "car" : brandish ? "brand" : "ambiguous";
  if (kind === "ambiguous") reasons.push("no brand- or car-specific fields found");
  return { kind, reasons };
}

/** Keeps the car-count fields on the brand document in sync. */
export async function updateWebsiteBrandCarCount(brandSlug: string): Promise<number> {
  const db = getWebsiteFirestore();
  const cars = await db.collection("new_cars").doc(brandSlug).collection("cars").get();
  const count = cars.size;
  // The public website reads `total_cars`; older contract fields kept in sync
  // too so any reader of either naming finds the same number.
  await db.collection("new_cars").doc(brandSlug).set(
    { total_cars: count, totalCars: count, car_count: count, carCount: count, updatedAt: fireTimestamp() },
    { merge: true },
  );
  return count;
}

/* ------------------------------------------------------------ new cars */

export interface WebsiteNewCarInput {
  name?: string;
  model: string;
  slug?: string;
  price?: string | number;
  priceMin?: string | number;
  priceMax?: string | number;
  description?: string;
  bodyType?: string;
  transmission?: string;
  fuelType?: string;
  city?: string;
  images?: unknown[];
  specifications?: Record<string, unknown>;
  variantsInput?: Array<Record<string, unknown>>;
  status?: WebsiteStatus;
  featured?: boolean;
}

export interface WebsiteCarContext {
  brandSlug: string;
  brandName: string;
  carId?: string;
}

export function buildWebsiteNewCarPayload(
  input: WebsiteNewCarInput,
  ctx: WebsiteCarContext,
  existingDoc?: DocumentData | null,
): DocumentData {
  const images = normalizeImages(input.images || existingDoc?.images || []);
  const slugSource =
    input.slug ||
    (existingDoc?.slug as string) ||
    slugify(`${ctx.brandSlug}-${input.model || input.name || existingDoc?.name || "car"}`);
  const status: WebsiteStatus =
    input.status === "published" || input.status === "draft"
      ? input.status
      : ((existingDoc?.status as WebsiteStatus) || "published");
  // Live docs keep the display title in `name` but may lack `model` — fall
  // back through every sensible source so editing one field never blanks the
  // visible name on an already-published car.
  const name = (input.name || input.model || existingDoc?.name || existingDoc?.model || "").trim();
  const model = (input.model || input.name || existingDoc?.model || existingDoc?.name || "").trim();

  return {
    slug: slugSource,
    name,
    model,
    brand_slug: ctx.brandSlug,
    brandSlug: ctx.brandSlug,
    brand_name: ctx.brandName,
    brandName: ctx.brandName,
    // Prices may exist on scraped docs as free text — preserve them verbatim
    // when the form doesn't provide a clean number.
    price: parseNumber(input.price) ?? keepValueOrNumber(existingDoc?.price),
    price_min: parseNumber(input.priceMin) ?? keepValueOrNumber(existingDoc?.price_min),
    price_max: parseNumber(input.priceMax) ?? keepValueOrNumber(existingDoc?.price_max),
    description: (input.description ?? existingDoc?.description ?? "").trim(),
    body_type: (input.bodyType ?? existingDoc?.body_type ?? "").trim(),
    transmission: (input.transmission ?? existingDoc?.transmission ?? "").trim(),
    fuelType: (input.fuelType ?? existingDoc?.fuelType ?? "").trim(),
    fuel_type: (input.fuelType ?? existingDoc?.fuel_type ?? "").trim(),
    city: (input.city ?? existingDoc?.city ?? "").trim(),
    image: images[0] || "",
    cover_image: images[0] || "",
    images,
    specifications: input.specifications || existingDoc?.specifications || {},
    featured: Boolean(input.featured ?? existingDoc?.featured ?? false),
    status,
  };
}

export async function listWebsiteNewCars(brandSlug?: string) {
  const db = getWebsiteFirestore();
  const brands = brandSlug
    ? [await db.collection("new_cars").doc(brandSlug).get()]
    // Same arranged order as the brands listing for grouped "all brands" views.
    : sortBrandDocs((await db.collection("new_cars").get()).docs);

  const result: any[] = [];
  for (const brand of brands) {
    if (!brand.exists) continue;
    const cars = await brand.ref.collection("cars").get();
    for (const car of cars.docs) {
      const carData = car.data() || {};
      // When a single brand is requested (the manager's cars panel), embed
      // the variants subcollection so edit dialogs prefill the REAL variant
      // rows instead of wiping them on save.
      let variants: any[] = [];
      if (brandSlug) {
        const variantSnap = await car.ref.collection("variants").get();
        variants = variantSnap.docs.map((v) => {
          const d = v.data() || {};
          return {
            id: v.id,
            name: d.name || v.id,
            price: d.price ?? null,
            status: d.status === "draft" ? "draft" : "published",
          };
        });
      }
      result.push({
        id: car.id,
        ...carData,
        ...(brandSlug ? { variants } : {}),
        // Car data first, then re-assert grouping fields so car docs that
        // (stale)ly carry their own brand_* fields cannot mislabel the row.
        brand_slug: brand.id,
        brand_name: normalizeBrandForClient(brand.id, brand.data() || {}).name,
      });
    }
  }
  return result;
}

export async function createWebsiteNewCar(
  ctx: Omit<WebsiteCarContext, "carId">,
  input: WebsiteNewCarInput,
) {
  const brandRef = getWebsiteFirestore().collection("new_cars").doc(ctx.brandSlug);
  const brandDoc = await brandRef.get();
  if (!brandDoc.exists) {
    throw new Error(`Brand "${ctx.brandSlug}" does not exist in the website project. Create the brand first.`);
  }
  const carRef = brandRef.collection("cars").doc();
  const payload = buildWebsiteNewCarPayload(input, ctx, null);
  await carRef.set(withTimestamps(payload, true));
  await syncWebsiteCarVariants(ctx.brandSlug, carRef.id, input.variantsInput);
  await updateWebsiteBrandCarCount(ctx.brandSlug);
  const saved = await carRef.get();
  return { id: saved.id, ...saved.data() };
}

async function loadCarDoc(brandSlug: string, carId: string) {
  const db = getWebsiteFirestore();
  const carRef = db.collection("new_cars").doc(brandSlug).collection("cars").doc(carId);
  const snap = await carRef.get();
  return { carRef, snap };
}

export async function updateWebsiteNewCar(
  ctx: WebsiteCarContext,
  input: WebsiteNewCarInput,
) {
  const { carRef, snap } = await loadCarDoc(ctx.brandSlug, ctx.carId!);
  if (!snap.exists) throw new Error("New car not found in the website project.");
  const payload = buildWebsiteNewCarPayload(input, ctx, snap.data());
  await carRef.set(withTimestamps(payload, false), { merge: true });
  if (Array.isArray(input.variantsInput)) {
    await syncWebsiteCarVariants(ctx.brandSlug, ctx.carId!, input.variantsInput);
  }
  await updateWebsiteBrandCarCount(ctx.brandSlug);
  const saved = await carRef.get();
  return { id: saved.id, ...saved.data() };
}

export async function deleteWebsiteNewCar(brandSlug: string, carId: string) {
  const { carRef } = await loadCarDoc(brandSlug, carId);
  const variants = await carRef.collection("variants").get();
  for (const variant of variants.docs) await variant.ref.delete();
  await carRef.delete();
  await updateWebsiteBrandCarCount(brandSlug);
  return true;
}

/** Writes the variants subcollection to match the provided input rows. */
export async function syncWebsiteCarVariants(
  brandSlug: string,
  carId: string,
  variantsInput?: Array<Record<string, unknown>>,
) {
  const db = getWebsiteFirestore();
  const carRef = db.collection("new_cars").doc(brandSlug).collection("cars").doc(carId);
  const existing = await carRef.collection("variants").get();
  const existingById = new Map(existing.docs.map((d) => [d.id, d]));

  const desired = (variantsInput || [])
    .map((v) => ({
      name: String(v.name || "").trim(),
      price: parseNumber(v.price),
      status: v.status === "draft" ? "draft" : "published",
      specifications: (v.specifications || {}) as Record<string, unknown>,
    }))
    .filter((v) => v.name);

  const desiredIds = new Set(desired.map((v) => slugify(v.name)));
  // Remove variants no longer present.
  for (const doc of existing.docs) {
    const name = doc.data().name || "";
    if (!desiredIds.has(doc.id) && !desiredIds.has(slugify(name))) {
      await doc.ref.delete();
    }
  }
  for (const variant of desired) {
    const docId = slugify(variant.name);
    await carRef
      .collection("variants")
      .doc(docId)
      .set(withTimestamps(variant, !existingById.has(docId)), { merge: true });
  }
  return true;
}

/* ----------------------------------------------------------- used cars */

export interface WebsiteUsedCarInput {
  sourceVehicleId?: string | null;
  type?: string;
  make: string;
  brand_name?: string;
  model: string;
  variant?: string;
  year: unknown;
  price: unknown;
  color?: string;
  fuelType?: string;
  transmission?: string;
  engine?: string;
  engineCC?: string | number;
  mileage?: string | number;
  city?: string;
  engine_no?: string;
  chassis_no?: string;
  registration_no?: string;
  images?: unknown[];
  description?: string;
  features?: unknown;
  body_type?: string;
  specifications?: Record<string, unknown>;
  status?: WebsiteStatus;
  featured?: unknown;
  barcode?: string;
  isSold?: boolean;
}

function featuresToArray(features: unknown): string[] {
  if (Array.isArray(features)) return features.filter((f) => typeof f === "string" && f.trim()) as string[];
  if (typeof features === "string") {
    return features.split(/[\n,]/).map((f) => f.trim()).filter(Boolean);
  }
  return [];
}

export function buildUsedCarSlug(
  input: WebsiteUsedCarInput,
  listingId: string,
): string {
  const parts = [
    input.make || input.brand_name,
    input.model,
    input.variant,
    input.year,
  ].filter(Boolean);
  const base = slugify(parts.join(" ")) || "car";
  const suffix = slugify(listingId).split("-").filter(Boolean).pop() || listingId.slice(0, 6);
  return `${base}-${suffix}`.slice(0, 80);
}

export function buildWebsiteUsedCarPayload(
  input: WebsiteUsedCarInput,
  existingDoc?: DocumentData | null,
): DocumentData {
  const images = normalizeImages(input.images ?? existingDoc?.images ?? []);
  const provided = (input as any).status as string | undefined;
  const existingStatus = (existingDoc?.status as string) || "";

  // Map software-side/website statuses onto the contract's published/draft.
  // "Hidden" and "Sold" source listings are hidden from the website ("draft").
  let status: WebsiteStatus = "published";
  if (provided === "published" || provided === "draft") {
    status = provided;
  } else if (provided === "Hidden" || (input as any).isHidden === true) {
    status = "draft";
  } else if (provided === "Sold") {
    status = "draft";
  } else if (!provided && existingStatus === "draft") {
    status = "draft";
  }

  const isSold = provided === "Sold" || Boolean((input as any).isSold) || Boolean(existingDoc?.isSold);

  const year = parseNumber(input.year) ?? parseNumber(existingDoc?.year) ?? null;
  const price = parseNumber(input.price) ?? parseNumber(existingDoc?.price) ?? null;
  // Mileage may be numeric or a display string like "45,000 km" — keep both
  // kinds of value instead of silently nulling non-numeric text.
  const mileageRaw = input.mileage ?? existingDoc?.mileage ?? null;
  const mileage = parseNumber(mileageRaw) ?? (typeof mileageRaw === "string" && mileageRaw.trim() ? mileageRaw.trim() : null);
  const variant = (input.variant ?? existingDoc?.variant ?? "").trim();
  const make = (input.make ?? existingDoc?.make ?? "").trim();
  const model = (input.model ?? existingDoc?.model ?? "").trim();
  const engineCcText = String(input.engineCC ?? existingDoc?.vehicleCC ?? "").trim();
  return {
    slug: existingDoc?.slug || "",
    make,
    brand_name: (input.brand_name || make || existingDoc?.brandName || "").trim(),
    model,
    variant,
    year,
    price,
    mileage,
    engine: String(input.engine ?? existingDoc?.engine ?? "").trim(),
    engine_cc: engineCcText,
    transmission: (input.transmission ?? existingDoc?.transmission ?? "").trim(),
    fuelType: (input.fuelType ?? existingDoc?.fuelType ?? "").trim(),
    fuel_type: (input.fuelType ?? existingDoc?.fuel_type ?? "").trim(),
    city: (input.city ?? existingDoc?.city ?? "").trim(),
    cover_image: images[0] || "",
    images,
    featured: Boolean(input.featured ?? existingDoc?.featured ?? false),
    features: featuresToArray(input.features ?? existingDoc?.features),
    description: (input.description ?? existingDoc?.description ?? "").trim(),
    body_type: (input.body_type ?? existingDoc?.body_type ?? existingDoc?.bodyType ?? "").trim(),
    specifications: input.specifications || existingDoc?.specifications || {},
    color: (input.color ?? existingDoc?.color ?? "").trim(),
    engine_no: (input.engine_no ?? existingDoc?.engineNo ?? "").trim(),
    chassis_no: (input.chassis_no ?? existingDoc?.chassisNo ?? "").trim(),
    registration_no: (input.registration_no ?? existingDoc?.registrationNo ?? "").trim(),
    barcode: (input.barcode ?? existingDoc?.barcode ?? "").trim(),
    sourceVehicleId: input.sourceVehicleId ?? existingDoc?.sourceVehicleId ?? null,
    type: (input.type ?? existingDoc?.type ?? "Physical Showroom").trim(),
    isSold,
    // Derived for websites that only check isHidden.
    isHidden: status === "draft",
    status,
  };
}

/** Writes `slug` only when missing so slugs stay stable. */
export async function upsertWebsiteUsedCar(listingId: string, input: WebsiteUsedCarInput) {
  const db = getWebsiteFirestore();
  const ref = db.collection("used_cars").doc(listingId);
  const existing = await ref.get();

  const payload = buildWebsiteUsedCarPayload(input, existing.exists ? existing.data() : null);
  if (!payload.slug) {
    payload.slug = buildUsedCarSlug(input, listingId);
  }

  if (existing.exists) {
    await ref.set(withTimestamps(payload, false), { merge: true });
  } else {
    await ref.set(withTimestamps(payload, true));
  }
  const saved = await ref.get();
  return { id: saved.id, ...saved.data() };
}

export async function patchWebsiteUsedCar(
  listingId: string,
  patch: Partial<WebsiteUsedCarInput> & { status?: WebsiteStatus; images?: unknown[]; featured?: boolean },
) {
  return upsertWebsiteUsedCar(listingId, patch as WebsiteUsedCarInput);
}

export async function setWebsiteUsedCarStatus(listingId: string, status: WebsiteStatus) {
  const db = getWebsiteFirestore();
  await db.collection("used_cars").doc(listingId).set(
    { status, isHidden: status === "draft", updatedAt: fireTimestamp() },
    { merge: true },
  );
  return true;
}

export async function deleteWebsiteUsedCar(listingId: string) {
  const db = getWebsiteFirestore();
  await db.collection("used_cars").doc(listingId).delete();
  return true;
}

export async function getWebsiteUsedCar(listingId: string) {
  const db = getWebsiteFirestore();
  const snap = await db.collection("used_cars").doc(listingId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

export async function listWebsiteUsedCars(limit = 500) {
  const db = getWebsiteFirestore();
  // Order by document id: deterministic and doesn't require updatedAt to
  // exist on every doc (listings may also be created by other tooling).
  const snap = await db
    .collection("used_cars")
    .orderBy("__name__", "asc")
    .limit(limit)
    .get();
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // Most recently updated first for the dashboard view.
  return items.sort((a, b) => {
    const ta = Number(((a as any).updatedAt?.seconds ?? (a as any).updatedAt?._seconds) || 0);
    const tb = Number(((b as any).updatedAt?.seconds ?? (b as any).updatedAt?._seconds) || 0);
    return tb - ta;
  });
}

/* --------------------------------------------------------------- queries (customer inquiries) */

/**
 * Customer queries captured by the public website (`queries` collection):
 * find-a-car requests with brand / budget / fuel / condition details plus
 * the customer's own notes. Read-only — the dashboard displays them and the
 * team answers people offline.
 */
export async function listWebsiteQueries(limit = 500) {
  const db = getWebsiteFirestore();
  // Order by document id: deterministic and needs no custom indexes.
  const snap = await db
    .collection("queries")
    .orderBy("__name__", "asc")
    .limit(limit)
    .get();

  return snap.docs
    .map((d) => normalizeWebsiteQuery(d.id, d.data()))
    .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
}

/** Shape tolerant of the timestamps the website app may write. */
function normalizeWebsiteQuery(id: string, data: DocumentData) {
  const createdAny = (data.createdAt ?? null) as any;
  let createdAtMs = 0;
  let createdAtIso = "";
  if (createdAny) {
    if (typeof createdAny.toDate === "function") {
      const d = createdAny.toDate();
      createdAtMs = d.getTime();
      createdAtIso = d.toISOString();
    } else if (typeof createdAny?.seconds === "number") {
      createdAtMs = createdAny.seconds * 1000;
      createdAtIso = new Date(createdAtMs).toISOString();
    } else if (typeof createdAny === "string") {
      const parsed = new Date(createdAny);
      const ok = !isNaN(parsed.getTime());
      createdAtMs = ok ? parsed.getTime() : 0;
      createdAtIso = ok ? parsed.toISOString() : String(createdAny);
    } else if (typeof createdAny === "number") {
      createdAtMs = createdAny;
      createdAtIso = new Date(createdAny).toISOString();
    }
  }
  return {
    id,
    name: data.name || "",
    phone: data.phone || "",
    email: data.email || "",
    // `notes` carries the customer's own message.
    message: data.notes || "",
    brand: data.brand || "",
    carType: data.carType || "",
    condition: data.condition || "",
    fuel: data.fuel || "",
    budget: data.budget || "",
    source: data.source || "",
    time: data.time || "",
    status: data.status || "new",
    createdAtMs,
    createdAt: createdAtIso,
  };
}

/** Marks a website query with a new status (`queries/{id}`, lower-cased). */
export async function setWebsiteQueryStatus(id: string, status: string) {
  const db = getWebsiteFirestore();
  const trimmed = String(status || "").trim().toLowerCase();
  if (!trimmed) throw new Error("A non-empty status is required.");
  await db.collection("queries").doc(id).set(
    { status: trimmed, updatedAt: fireTimestamp() },
    { merge: true },
  );
  return true;
}
