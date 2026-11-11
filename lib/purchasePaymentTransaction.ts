import { doc, type Firestore, type Transaction } from "firebase/firestore";
import { adjustPurchasePayment, type PurchasePaymentState } from "./purchasePayments";

interface PaymentLink {
  invoiceId: string;
  accountId: string;
  amount: number;
}

// Read and validate before the caller writes either ledger leg or voucher.
export async function preparePurchasePayment(
  tx: Transaction, db: Firestore, next?: PaymentLink | null, previous?: PaymentLink | null,
) {
  const ids = [...new Set([previous?.invoiceId, next?.invoiceId].filter((id): id is string => !!id))];
  const updates = [];
  for (const id of ids) {
    const ref = doc(db, "cars", id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("The linked purchase invoice no longer exists.");
    const invoice = snap.data();
    let state: PurchasePaymentState = invoice;
    if (previous?.invoiceId === id) state = { ...state, ...adjustPurchasePayment(state, -previous.amount) };
    if (next?.invoiceId === id) {
      let sellerAccountId = invoice.sellerAccountId;
      if (!sellerAccountId && invoice.sellerClientId) {
        const seller = await tx.get(doc(db, "clients", invoice.sellerClientId));
        sellerAccountId = seller.data()?.accountId;
      }
      if (!sellerAccountId || sellerAccountId !== next.accountId) {
        throw new Error("The selected invoice does not belong to the payment's seller account.");
      }
      if (!Number.isFinite(next.amount) || next.amount <= 0) throw new Error("Enter a valid invoice payment amount.");
      if (state.purchasePaidAtCreation ?? state.isPaid) throw new Error("This purchase invoice was already paid at creation.");
      state = { ...state, ...adjustPurchasePayment(state, next.amount) };
    }
    updates.push({ ref, data: {
      purchasePaidAtCreation: state.purchasePaidAtCreation,
      purchasePaidAmount: state.purchasePaidAmount,
      isPaid: state.isPaid,
    } });
  }
  return updates;
}
