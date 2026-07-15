import { BalanceSheetReport } from "@/features/reports/BalanceSheetReport";
import { PageHeader } from "@/components/shared/PageHeader";

export default function BalanceSheetPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Balance Sheet"
        description="Generate a full balance sheet grouped by account type as of any date."
      />
      <BalanceSheetReport />
    </div>
  );
}
