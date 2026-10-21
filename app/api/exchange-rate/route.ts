
import { NextResponse } from "next/server";

// Always hit the proxy at request time (never prerender the route at build).
export const dynamic = "force-dynamic";

// Keep the upstream request out of the browser and refresh rates at most every 5 minutes.
const RATE_CACHE_TTL_MS = 5 * 60 * 1000;
const BASE_CURRENCY = "USD";

let cached: { rates: Record<string, number>; base: string; date: string; fetchedAt: number } | null = null;

function readUpstreamError(data: any): string {
    if (typeof data?.error === "string") return data.error;
    if (typeof data?.error?.message === "string") return data.error.message;
    if (typeof data?.description === "string") return data.description;
    return "Exchange rate service returned an invalid response";
}

export async function GET() {
    try {
        const apiKey = process.env.FXRATES_API_KEY;

        if (!apiKey) {
            console.error("FXRATES_API_KEY is not configured");
            return NextResponse.json(
                { success: false, error: "Server configuration error" },
                { status: 500 }
            );
        }

        if (cached && Date.now() - cached.fetchedAt < RATE_CACHE_TTL_MS) {
            return NextResponse.json({
                success: true,
                base: cached.base,
                date: cached.date,
                rates: cached.rates
            });
        }

        const response = await fetch(
            `https://api.fxratesapi.com/latest?base=${BASE_CURRENCY}&apikey=${apiKey}`,
            { cache: "no-store" }
        );

        if (!response.ok) {
            let upstreamError = `Exchange rate request failed (${response.status})`;
            try {
                const errBody = await response.json();
                upstreamError = readUpstreamError(errBody);
            } catch {
                // keep the status-code based message
            }
            return NextResponse.json(
                { success: false, error: upstreamError },
                { status: 502 }
            );
        }

        const data = await response.json();

        if (!data?.success || !data?.rates || !data.rates.PKR) {
            return NextResponse.json(
                { success: false, error: readUpstreamError(data) },
                { status: 502 }
            );
        }

        cached = {
            rates: data.rates,
            base: data.base || BASE_CURRENCY,
            date: data.date,
            fetchedAt: Date.now()
        };

        return NextResponse.json({
            success: true,
            base: cached.base,
            date: cached.date,
            rates: cached.rates
        });

    } catch (error) {
        console.error("Exchange rate proxy error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
