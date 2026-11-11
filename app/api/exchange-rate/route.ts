
import { NextResponse } from "next/server";

// Always hit the proxy at request time (never prerender the route at build).
export const dynamic = "force-dynamic";

// Keep the upstream request out of the browser and refresh rates at most every 5 minutes.
const RATE_CACHE_TTL_MS = 5 * 60 * 1000;
const BASE_CURRENCY = "USD";

type CachedRates = { rates: Record<string, number>; base: string; date: string; fetchedAt: number };
const rateCache = new Map<string, CachedRates>();

function readUpstreamError(data: { error?: string | { message?: string }; description?: string }): string {
    if (typeof data?.error === "string") return data.error;
    if (typeof data?.error === "object" && typeof data.error?.message === "string") return data.error.message;
    if (typeof data?.description === "string") return data.description;
    return "Exchange rate service returned an invalid response";
}

export async function GET(request: Request) {
    try {
        const date = new URL(request.url).searchParams.get("date") || "";
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
        if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date)
            || !Number.isFinite(Date.parse(date))
            || new Date(date).toISOString().slice(0, 10) !== date
            || date > today)) {
            return NextResponse.json(
                { success: false, error: "Select a valid date that is not in the future" },
                { status: 400 }
            );
        }
        const apiKey = process.env.FXRATES_API_KEY;

        if (!apiKey) {
            console.error("FXRATES_API_KEY is not configured");
            return NextResponse.json(
                { success: false, error: "Server configuration error" },
                { status: 500 }
            );
        }

        const cacheKey = date || "latest";
        const cached = rateCache.get(cacheKey);
        if (cached && Date.now() - cached.fetchedAt < RATE_CACHE_TTL_MS) {
            return NextResponse.json({
                success: true,
                base: cached.base,
                date: cached.date,
                rates: cached.rates
            });
        }

        const upstreamUrl = new URL(`https://api.fxratesapi.com/${date ? "historical" : "latest"}`);
        upstreamUrl.searchParams.set("base", BASE_CURRENCY);
        upstreamUrl.searchParams.set("api_key", apiKey);
        if (date) upstreamUrl.searchParams.set("date", date);
        const response = await fetch(upstreamUrl, { cache: "no-store" });

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

        if (date && data.date?.slice(0, 10) !== date) {
            return NextResponse.json(
                { success: false, error: "Exchange rates are not available for the selected date" },
                { status: 502 }
            );
        }

        const result: CachedRates = {
            rates: data.rates,
            base: data.base || BASE_CURRENCY,
            date: data.date,
            fetchedAt: Date.now()
        };
        // Bound memory usage when users look up many different dates.
        if (rateCache.size >= 100) rateCache.clear();
        rateCache.set(cacheKey, result);

        return NextResponse.json({
            success: true,
            base: result.base,
            date: result.date,
            rates: result.rates
        });

    } catch (error) {
        console.error("Exchange rate proxy error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
