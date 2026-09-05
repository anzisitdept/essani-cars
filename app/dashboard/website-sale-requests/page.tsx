import { Suspense } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { WebsiteSaleRequestsManager } from "@/features/website-sale-requests/WebsiteSaleRequestsManager";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Website Car Sale Requests | Caruzen Motors Accounts",
  description: "Manage car sale submissions from website visitors",
};

export default function WebsiteSaleRequestsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Website Car Sale Requests"
        description="Review, approve, suspend, and manage customer used car listings submitted on caruzen-motors-website."
      />

      <Suspense
        fallback={
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 size={32} className="animate-spin text-blue-600" />
            <p className="text-sm font-medium">Loading sale requests...</p>
          </div>
        }
      >
        <WebsiteSaleRequestsManager />
      </Suspense>
    </div>
  );
}

