"use client";

import { useMemo, useState } from "react";
import { useCurrencyExchangeRate } from "@/hooks/useCurrencyExchangeRate";
import { AlertTriangle, ArrowRightLeft, Coins, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SearchSelector } from "@/components/ui/SearchSelector";

interface CurrencyOption {
  code: string;
  name: string;
}

const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "USD", name: "US Dollar" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "QAR", name: "Qatari Riyal" },
  { code: "OMR", name: "Omani Rial" },
  { code: "KWD", name: "Kuwaiti Dinar" },
  { code: "BHD", name: "Bahraini Dinar" },
  { code: "GBP", name: "British Pound" },
  { code: "EUR", name: "Euro" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "RUB", name: "Russian Ruble" },
  { code: "INR", name: "Indian Rupee" },
  { code: "LKR", name: "Sri Lankan Rupee" },
  { code: "NPR", name: "Nepalese Rupee" },
  { code: "BDT", name: "Bangladeshi Taka" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "KRW", name: "South Korean Won" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "TWD", name: "New Taiwan Dollar" },
  { code: "THB", name: "Thai Baht" },
  { code: "VND", name: "Vietnamese Dong" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "MOP", name: "Macanese Pataca" },
  { code: "ILS", name: "Israeli Shekel" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "TZS", name: "Tanzanian Shilling" },
  { code: "ZAR", name: "South African Rand" },
  { code: "MAD", name: "Moroccan Dirham" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "ARS", name: "Argentine Peso" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "DKK", name: "Danish Krone" },
  { code: "PLN", name: "Polish Zloty" },
  { code: "CZK", name: "Czech Koruna" },
  { code: "HUF", name: "Hungarian Forint" },
  { code: "RON", name: "Romanian Leu" },
];

const currencySearchFields = (currency: CurrencyOption) => [currency.code, currency.name];
const currencyKey = (currency: CurrencyOption) => currency.code;

/**
 * Two temporary currency-conversion fields (PKR Amount + Select Currency & Amount).
 *
 * This component is fully self-contained: it keeps all of its state locally and
 * never exposes it to the parent form, so the values can never be included in a
 * database write or API payload. The exchange-rate API key stays server-side in
 * /api/exchange-rate.
 */
export function CurrencyConverterFields() {
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [currencyAmount, setCurrencyAmount] = useState("");
  const {
    selectedRate, rateInput, changeRate, ratesDate, changeRatesDate,
    ratesLoading, ratesError, fetchExchangeRates, today,
  } = useCurrencyExchangeRate(currencyCode);

  const pkrAmount = useMemo(() => {
    const amount = parseFloat(currencyAmount);
    if (!isFinite(amount) || amount <= 0 || selectedRate === null) return null;
    return amount * selectedRate;
  }, [currencyAmount, selectedRate]);

  return (
    <div className="space-y-4">
      {/* PKR Amount — read-only, derived from the currency + amount below */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
          <Coins size={12} /> PKR Amount
        </label>
        <Input
          readOnly
          value={
            pkrAmount === null
              ? ""
              : pkrAmount.toLocaleString("en-PK", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
          }
          placeholder="0.00"
          className="h-10 font-semibold bg-slate-50 text-slate-600"
        />
        {ratesLoading ? (
          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            <Loader2 size={12} className="animate-spin" /> Loading exchange rate...
          </p>
        ) : ratesError ? (
          <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1">
            <AlertTriangle size={12} /> {ratesError}
            <button
              type="button"
              onClick={fetchExchangeRates}
              className="underline font-medium ml-1"
            >
              Retry
            </button>
          </p>
        ) : null}
        <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap items-center gap-1">
          1 {currencyCode} ={" "}
          <Input
            type="number"
            step="any"
            min="0"
            aria-label={`${currencyCode} to PKR exchange rate`}
            value={rateInput}
            disabled={ratesLoading}
            onChange={(e) => changeRate(e.target.value)}
            className="h-6 w-24 px-1 text-xs md:text-xs"
          />
          <span>PKR •</span>
          <Input
            type="date"
            max={today}
            aria-label="Exchange rate date"
            value={ratesDate.slice(0, 10)}
            onChange={(e) => changeRatesDate(e.target.value)}
            className="h-6 w-auto px-1 text-xs md:text-xs"
          />
        </div>
      </div>

      {/* Select Currency & Amount — editable, searchable currency selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
          <ArrowRightLeft size={12} /> Select Currency &amp; Amount
        </label>
        <div className="flex gap-2">
          <SearchSelector
            items={CURRENCY_OPTIONS}
            value={currencyCode}
            onChange={setCurrencyCode}
            placeholder="Select currency..."
            searchPlaceholder="Search currency..."
            noItemsText="No currency found."
            dropdownWidthClassName="w-[320px] max-w-[calc(100vw-2rem)]"
            className="w-[190px] shrink-0"
            getSearchFields={currencySearchFields}
            itemKey={currencyKey}
            renderTrigger={(selected) =>
              selected ? (
                <span>
                  {selected.code}{" "}
                  <span className="text-slate-400 text-xs ml-1">{selected.name}</span>
                </span>
              ) : (
                <span className="text-slate-400">Select currency...</span>
              )
            }
            renderItem={(currency) => (
              <div className="flex justify-between items-center w-full text-left">
                <span className="font-medium text-slate-800">{currency.code}</span>
                <span className="text-xs text-slate-500">{currency.name}</span>
              </div>
            )}
          />
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={currencyAmount}
            onChange={(e) => setCurrencyAmount(e.target.value)}
            className="h-10 flex-1"
          />
        </div>
      </div>
    </div>
  );
}
