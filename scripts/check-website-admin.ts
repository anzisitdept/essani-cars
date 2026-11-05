/**
 * Validation harness for the Website module's public Firebase connection
 * (`essani-cars-pk`).
 *
 * Usage:
 *   npx tsx scripts/check-website-admin.ts              # config check only
 *   npx tsx scripts/check-website-admin.ts --live       # read-only smoke test
 *   npx tsx scripts/check-website-admin.ts --live --write-test
 *                                                       # full CRUD roundtrip
 *                                                       (creates temporary
 *                                                        docs, cleans up)
 *
 * Never prints credential material. Imports the same server-only modules the
 * API routes use, so it validates the exact connection the Website module
 * will use in production.
 */

import * as fs from "fs";
import * as path from "path";

function loadEnvFile(name: string) {
  const envPath = path.resolve(process.cwd(), name);
  if (!fs.existsSync(envPath)) return;
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    if (line.trim().startsWith("#") || !line.trim()) return;
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let val = match[2] || "";
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      if (!process.env[key] && val.trim() !== "") process.env[key] = val;
    }
  });
}

const live = process.argv.includes("--live");
const writeTest = process.argv.includes("--write-test");

interface CheckResult { name: string; ok: boolean; detail?: string }

const results: CheckResult[] = [];
function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "✅ PASS" : "❌ FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function main() {
  console.log(`🔎 Website module Firebase connection check (target: essani-cars-pk)\n`);
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  // Dynamically import (after env load).
  const admin = require("../lib/websiteFirebaseAdmin");
  const status = admin.describeWebsiteFirebaseConfig();

  check("WEBSITE_FIREBASE_PROJECT_ID set", status.ok || status.projectId.length > 0, `project: ${status.projectId || "(missing)"}`);
  check(
    "Credentials valid for service-account-based Admin access",
    status.ok,
    status.error || `service account: ${status.clientEmailMasked}`,
  );

  if (!status.ok) {
    console.log(`\n💡 ${status.hint || ""}`);
    console.log("\nSummary: configuration invalid — no connection attempt made.");
    const failed = results.filter(r => !r.ok).length;
    console.log(`${results.length - failed}/${results.length} checks passed.`);
    process.exit(2);
  }

  if (!live) {
    console.log("\nSummary: configuration looks valid. Re-run with --live to connect to the project.");
    process.exit(0);
  }

  runLive();
}

async function runLive() {
  process.stdout.write("\n");
  const svc = require("../lib/websiteInventoryAdmin");

  try {
    // --- read-only checks ------------------------------------------------
    const brands = await svc.listWebsiteBrands();
    check("List brands (new_cars collection)", Array.isArray(brands), `${brands.length} brand doc(s)`);

    const cars = await svc.listWebsiteNewCars();
    check("List new cars (new_cars/*/cars)", Array.isArray(cars), `${cars.length} car doc(s)`);

    const used = await svc.listWebsiteUsedCars();
    check("List used cars (used_cars collection)", Array.isArray(used), `${used.length} listing doc(s)`);

    // --- read-only: registered accounts (Firebase Auth is the source of truth)
    try {
      const { getWebsiteAuth } = require("../lib/websiteFirebaseAdmin");
      const authClient = getWebsiteAuth();
      let count = 0;
      let pageToken: string | undefined;
      let pages = 0;
      while (pages < 25) {
        const res = await authClient.listUsers(1000, pageToken);
        count += res.users.length;
        pages++;
        pageToken = res.pageToken ?? undefined;
        if (!pageToken) break;
      }
      check("Count registered users (Firebase Auth)", count >= 0, `${count} account(s)`);
    } catch (err: any) {
      check("Count registered users (Firebase Auth)", false, String(err?.message || err).slice(0, 200));
    }

    // Verify write target identity: the project the credentials name.
    const projectId = process.env.WEBSITE_FIREBASE_PROJECT_ID;
    check("Target project is essani-cars-pk", projectId === "essani-cars-pk", `env says: ${projectId}`);

    if (!writeTest) {
      console.log("\nSummary: read-only checks done. Re-run with --write-test for a full CRUD roundtrip (temporary documents, cleaned up afterwards).");
      finalize();
      return;
    }

    // --- write roundtrip: brand + new car + variants ----------------------
    const stamp = Date.now().toString(36);
    const brandSlug = `zz-selftest-${stamp}`;
    const brandName = "Selftest Brand";

    const brand = await svc.upsertWebsiteBrand(brandSlug, { name: brandName, status: "published" });
    check("Brand create → new_cars/{brandSlug}", !!brand && brand.id === brandSlug, String(brand?.id));

    const car = await svc.createWebsiteNewCar(
      { brandSlug, brandName },
      {
        model: "Test Model",
        priceMin: 1000000,
        priceMax: 1200000,
        images: ["https://example.com/a.jpg", { url: "https://example.com/b.jpg" }],
        specifications: { engine: "1.3L" },
        variantsInput: [{ name: "GLi", price: 1000000 }],
        status: "published",
      },
    );
    check("New car create → new_cars/{brandSlug}/cars/{carId}", !!car?.id, String(car?.id));
    check("Car images normalized to URLs", Array.isArray(car?.images) && car?.images?.length === 2, JSON.stringify(car?.images));
    check("Car brand fields", car?.brand_slug === brandSlug && car?.brand_name === brandName);
    check("Brand car count synced", (await svc.getWebsiteBrand(brandSlug))?.car_count === 1);

    const updated = await svc.updateWebsiteNewCar(
      { brandSlug, brandName, carId: car.id },
      { model: "Test Model", name: "Test Model Renamed", status: "published" },
    );
    check("New car edit preserves stable slug", updated?.slug === car?.slug, `slug: ${updated?.slug}`);

    const draftToggle = await svc.updateWebsiteNewCar(
      { brandSlug, brandName, carId: car.id },
      { model: "Test Model", name: "Test Model Renamed", status: "draft" },
    );
    check("New car unpublish → status draft", draftToggle?.status === "draft");

    // Variants subcollection
    const { getWebsiteFirestore } = require("../lib/websiteFirebaseAdmin");
    const variants = await getWebsiteFirestore()
      .collection("new_cars").doc(brandSlug).collection("cars").doc(car.id)
      .collection("variants").get();
    check("Car variant subcollection written", variants.size === 1 && variants.docs[0].data().name === "GLi");

    await svc.deleteWebsiteNewCar(brandSlug, car.id);
    await svc.deleteWebsiteBrand(brandSlug);
    check("New car + brand delete cleans up", !(await svc.getWebsiteBrand(brandSlug)));

    // --- write roundtrip: used car ----------------------------------------
    const listingId = `zz-selftest-${stamp}`;
    const created = await svc.upsertWebsiteUsedCar(listingId, {
      make: "Selftest Make",
      brand_name: "Selftest Make",
      model: "Selftest Model",
      variant: "VXL",
      year: 2022,
      price: 4500000,
      images: [{ url: "https://example.com/used.jpg" }, "https://example.com/used2.jpg"],
      features: "AC, Sunroof",
      description: "selftest listing",
      status: "published",
    });
    check("Used car create → used_cars/{listingId}", created?.id === listingId);
    check("Used car stable slug", typeof created?.slug === "string" && created.slug.length > 0, String(created?.slug));
    check("Used car embedded details stored",
      created?.make === "Selftest Make" && created?.year === 2022 && created?.price === 4500000 &&
      created?.variant === "VXL" && Array.isArray(created?.features) && created.features.includes("AC"));
    check("Used car images normalized", Array.isArray(created?.images) && created?.images?.length === 2 &&
      created?.cover_image === "https://example.com/used.jpg");
    check("Used car status published", created?.status === "published");

    const featuredOn = await svc.patchWebsiteUsedCar(listingId, { featured: true });
    check("Used car edit (featured) survives save", featuredOn?.featured === true && featuredOn?.status === "published",
      `status: ${featuredOn?.status}, featured: ${featuredOn?.featured}`);

    const imagesUpdated = await svc.patchWebsiteUsedCar(listingId, {
      images: ["https://example.com/replaced.jpg"],
    } as any);
    check("Used car image edit survives save/reload", imagesUpdated?.cover_image === "https://example.com/replaced.jpg" && imagesUpdated?.images?.length === 1);

    const unpublished = await svc.setWebsiteUsedCarStatus(listingId, "draft");
    const reloaded = await svc.getWebsiteUsedCar(listingId);
    check("Used car unpublish → status draft + isHidden", unpublished && reloaded?.status === "draft" && reloaded?.isHidden === true);

    const republished = await svc.setWebsiteUsedCarStatus(listingId, "published");
    const reloaded2 = await svc.getWebsiteUsedCar(listingId);
    check("Used car republish → status published", republished && reloaded2?.status === "published");

    await svc.deleteWebsiteUsedCar(listingId);
    check("Used car delete", !(await svc.getWebsiteUsedCar(listingId)));

    console.log("\nAll write tests used temporary documents and cleaned up after themselves.");
    finalize();
  } catch (error) {
    check("Live connection + operations", false, String((error as any)?.message || error));
    finalize();
  }
}

function finalize() {
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nSummary: ${results.length - failed}/${results.length} checks passed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
