import { PurchaseInvoiceManager } from "@/features/invoices/PurchaseInvoiceManager";

export default function PurchaseInvoicePage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Purchase Invoice</h1>
        <p className="text-sm text-slate-500 mt-1">
          Create a purchase invoice by selecting a registered vehicle and entering financial details.
        </p>
      </div>
      <PurchaseInvoiceManager />
    </div>
  );
}
