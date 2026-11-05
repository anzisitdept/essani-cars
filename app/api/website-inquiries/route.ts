/**
 * SERVER-ONLY: customer queries captured by the public website project
 * (`queries` collection). GET lists them newest first; PATCH marks a query's
 * status (e.g. new → contacted → resolved).
 */
import { NextResponse } from "next/server";
import { authenticateWebsiteApiRequest } from "@/lib/websiteServerAuth";
import { websiteApiError, readJsonBody } from "@/lib/websiteApiHelpers";
import { listWebsiteQueries, setWebsiteQueryStatus } from "@/lib/websiteInventoryAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await authenticateWebsiteApiRequest(request);
  if (!guard.user) {
    return NextResponse.json(
      { error: guard.error?.message || "Unauthorized" },
      { status: guard.error?.status || 401 },
    );
  }

  try {
    const url = new URL(request.url);
    const requested = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(requested) && requested > 0 ? Math.min(Math.floor(requested), 1000) : 500;
    const rows = await listWebsiteQueries(limit);
    return NextResponse.json({ inquiries: rows });
  } catch (error) {
    return websiteApiError(error, "GET /api/website-inquiries");
  }
}

export async function PATCH(request: Request) {
  const guard = await authenticateWebsiteApiRequest(request);
  if (!guard.user) {
    return NextResponse.json(
      { error: guard.error?.message || "Unauthorized" },
      { status: guard.error?.status || 401 },
    );
  }

  try {
    const body = await readJsonBody(request);
    const id = String(body?.id || "").trim();
    const status = String(body?.status || "").trim();
    if (!id || !status) {
      return NextResponse.json(
        { error: "A query id and new status are required." },
        { status: 400 },
      );
    }
    await setWebsiteQueryStatus(id, status);
    const rows = await listWebsiteQueries(1000);
    return NextResponse.json({ inquiries: rows });
  } catch (error) {
    return websiteApiError(error, "PATCH /api/website-inquiries");
  }
}
