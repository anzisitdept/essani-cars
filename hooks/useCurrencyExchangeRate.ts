"use client";

import { useCallback, useEffect, useState } from "react";

export function useCurrencyExchangeRate(currencyCode: string) {
  const [requestedDate, setRequestedDate] = useState("");
  const [responseDate, setResponseDate] = useState("");
  const [exchangeRates, setExchangeRates] = useState<Record<string, number> | null>(null);
  const [manualRates, setManualRates] = useState<Record<string, string>>({});
  const [ratesLoading, setRatesLoading] = useState(true);
  const [ratesError, setRatesError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadRates() {
      setRatesLoading(true);
      setRatesError("");
      setExchangeRates(null);
      try {
        const query = requestedDate ? `?date=${encodeURIComponent(requestedDate)}` : "";
        const res = await fetch(`/api/exchange-rate${query}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok || !data?.success || !data?.rates) {
          throw new Error(data?.error || "Failed to load exchange rates");
        }
        if (!active) return;
        setExchangeRates(data.rates);
        setResponseDate(data.date?.slice(0, 10) || "");
      } catch (error) {
        if (!active) return;
        setRatesError(error instanceof Error ? error.message : "Failed to load exchange rates");
      } finally {
        if (active) setRatesLoading(false);
      }
    }

    void loadRates();
    return () => {
      active = false;
      controller.abort();
    };
  }, [requestedDate, attempt]);

  const ratesDate = requestedDate || responseDate;
  const changeRatesDate = (date: string) => {
    if (date === ratesDate) return;
    setRatesLoading(true);
    setRatesError("");
    setExchangeRates(null);
    setManualRates({});
    setRequestedDate(date);
    setResponseDate("");
    setAttempt((value) => value + 1);
  };

  const manualRate = manualRates[currencyCode];
  const fromRate = exchangeRates?.[currencyCode];
  const pkrRate = exchangeRates?.PKR;
  const rate = manualRate !== undefined
    ? Number(manualRate)
    : fromRate && pkrRate ? pkrRate / fromRate : null;
  const selectedRate = !ratesLoading && rate !== null && Number.isFinite(rate) && rate > 0
    ? rate : null;

  return {
    selectedRate,
    rateInput: manualRate ?? selectedRate?.toFixed(4) ?? "",
    changeRate: (value: string) => setManualRates((rates) => ({ ...rates, [currencyCode]: value })),
    ratesDate,
    changeRatesDate,
    ratesLoading,
    ratesError,
    fetchExchangeRates: useCallback(() => setAttempt((value) => value + 1), []),
    today: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" }),
  };
}
