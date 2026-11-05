/**
 * SERVER-ONLY: shared helpers for the Website module's server API routes.
 *
 * Error logging scrubs anything that could carry credential material:
 * only the message string is logged, never headers, bodies or env contents.
 */

import { NextResponse } from "next/server";

export function websiteApiError(error: unknown, context: string): NextResponse {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unexpected server error while managing the website inventory.";
  console.error(`[WebsiteInventoryAPI] ${context}:`, message);
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function readJsonBody(request: Request): Promise<any> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
