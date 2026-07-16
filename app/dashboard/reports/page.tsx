import { ReportsManager } from "@/features/reports/ReportsManager";

export default function ReportsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">
          Comprehensive reporting suite for inventory, sales, finance, and operations.
        </p>
      </div>
      <ReportsManager />
    </div>
  );
}