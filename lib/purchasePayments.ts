export interface PurchasePaymentState {
  purchasePrice?: number;
  isPaid?: boolean;
  purchasePaidAtCreation?: boolean;
  purchasePaidAmount?: number;
}

export function purchasePaidAmount(invoice: PurchasePaymentState): number {
  return invoice.purchasePaidAmount ?? (invoice.isPaid ? Number(invoice.purchasePrice) || 0 : 0);
}

export function purchaseOutstanding(invoice: PurchasePaymentState): number {
  return Math.max(0, Math.round(((Number(invoice.purchasePrice) || 0) - purchasePaidAmount(invoice)) * 100) / 100);
}

export function adjustPurchasePayment(invoice: PurchasePaymentState, delta: number) {
  const price = Math.round((Number(invoice.purchasePrice) || 0) * 100);
  const paid = Math.round(purchasePaidAmount(invoice) * 100) + Math.round(delta * 100);
  if (price <= 0) throw new Error("The selected purchase invoice no longer exists.");
  if (paid < 0 || paid > price) throw new Error("Payment exceeds the invoice's outstanding amount or cannot be reversed.");
  return {
    purchasePaidAtCreation: invoice.purchasePaidAtCreation ?? !!invoice.isPaid,
    purchasePaidAmount: paid / 100,
    isPaid: paid === price,
  };
}

export function canReversePurchase(invoice: PurchasePaymentState): boolean {
  return (invoice.purchasePaidAtCreation ?? invoice.isPaid) || purchasePaidAmount(invoice) === 0;
}

export function isClientPayable(account: { typeName?: string; name?: string; balance?: number }): boolean {
  const type = (account.typeName || "").toLowerCase();
  return (type === "client" || type === "customer")
    && !(account.name || "").toLowerCase().includes("cash")
    && Number(account.balance) < 0;
}
