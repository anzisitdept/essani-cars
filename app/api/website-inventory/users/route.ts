/**
 * SERVER-ONLY: registered accounts of the Essani Cars public website project.
 * Real registrations live in that project's Firebase Auth — this lists them
 * newest first (bounded to the most recent 2000).
 */
import { NextResponse } from "next/server";
import { authenticateWebsiteApiRequest } from "@/lib/websiteServerAuth";
import { websiteApiError } from "@/lib/websiteApiHelpers";
import { getWebsiteAuth } from "@/lib/websiteFirebaseAdmin";

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
    const authClient = getWebsiteAuth();
    const rows: Array<Record<string, unknown>> = [];
    let pageToken: string | undefined;
    let pages = 0;
    // Two pages (2000 accounts) is plenty for the dashboard listing; the
    // exact lifetime total lives in the stats endpoint's `users.total`.
    while (pages < 2) {
      const res = await authClient.listUsers(1000, pageToken);
      for (const u of res.users) {
        rows.push({
          id: u.uid,
          name: u.displayName || "",
          email: u.email || "",
          phone: u.phoneNumber || "",
          disabled: u.disabled === true,
          createdAt: u.metadata?.creationTime || "",
          lastLogin: u.metadata?.lastSignInTime || "",
        });
      }
      pages++;
      pageToken = res.pageToken ?? undefined;
      if (!pageToken) break;
    }
    // listUsers walks by uid (≈ registration order), so newest is last.
    rows.reverse();
    return NextResponse.json({ users: rows });
  } catch (error) {
    return websiteApiError(error, "GET /api/website-inventory/users");
  }
}
