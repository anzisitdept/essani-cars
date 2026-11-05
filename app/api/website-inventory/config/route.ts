/**
 * SERVER-ONLY: configuration/status endpoint for the Website module.
 * Reports which Firebase project the inventory is aimed at so dashboard
 * users cannot confuse the public website project (`essani-cars-pk`) with
 * the software's own project. Never returns credential material.
 */
import { NextResponse } from "next/server";
import { describeWebsiteFirebaseConfig, getWebsiteDatabaseId } from "@/lib/websiteFirebaseAdmin";
import { authenticateWebsiteApiRequest } from "@/lib/websiteServerAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Any signed-in software user may read the target indicator.
  const auth = await authenticateWebsiteApiRequest(request);
  if (!auth.user) {
    return NextResponse.json(
      { error: auth.error?.message || "Unauthorized" },
      { status: auth.error?.status || 401 },
    );
  }

  const status = describeWebsiteFirebaseConfig();
  return NextResponse.json({
    target: "Essani Cars public website",
    projectId: status.projectId,
    databaseId: getWebsiteDatabaseId(),
    serviceAccount: status.clientEmailMasked,
    configured: status.ok,
    error: status.error || null,
    hint: status.hint || null,
  });
}
