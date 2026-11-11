"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { purchaseOutstanding, type PurchasePaymentState } from "@/lib/purchasePayments";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Invoice extends PurchasePaymentState {
  id: string;
  sellerAccountId?: string;
  sellerClientId?: string;
  brandName?: string;
  model?: string;
  chassisNumber?: string;
}

export function PurchaseInvoicePaymentSelector({ accountId, value, onChange, originalInvoiceId, originalAmount = 0 }: {
  accountId: string;
  value: string;
  onChange: (value: string) => void;
  originalInvoiceId?: string;
  originalAmount?: number;
}) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [sellerAccounts, setSellerAccounts] = useState<Record<string, string>>({});
  const [error, setError] = useState(false);
  useEffect(() => {
    const stopInvoices = onSnapshot(query(collection(db, "cars"), where("purchasePrice", ">", 0)),
      snap => setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => setError(true));
    const stopSellers = onSnapshot(collection(db, "clients"), snap => {
      setSellerAccounts(Object.fromEntries(snap.docs.map(d => [d.id, d.data().accountId || ""])));
    }, () => setError(true));
    return () => { stopInvoices(); stopSellers(); };
  }, []);

  const available = invoices.filter(invoice =>
    (invoice.sellerAccountId || sellerAccounts[invoice.sellerClientId || ""]) === accountId
    && (purchaseOutstanding(invoice) > 0 || invoice.id === originalInvoiceId));
  if (!available.length && !value && !error) return null;

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-slate-500 block">Purchase Invoice</label>
      <Select value={value || "none"} onValueChange={id => onChange(id === "none" ? "" : id)}>
        <SelectTrigger><SelectValue placeholder="Select purchase invoice" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">General payment (no invoice)</SelectItem>
          {available.map(invoice => (
            <SelectItem key={invoice.id} value={invoice.id}>
              {invoice.brandName} {invoice.model} · {invoice.chassisNumber || invoice.id} · Outstanding Rs. {(purchaseOutstanding(invoice) + (invoice.id === originalInvoiceId ? originalAmount : 0)).toLocaleString()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[10px] text-slate-500">Select an invoice to adjust its outstanding amount with this payment.</p>
      {error && <p className="text-xs text-red-600">Could not load purchase invoices. Reopen the payment form to retry.</p>}
    </div>
  );
}
