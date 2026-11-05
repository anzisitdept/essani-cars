import { WebsiteInventoryManager } from "@/features/website-inventory/WebsiteInventoryManager";
import { PageHeader } from "@/components/shared/PageHeader";

export default function WebsiteInventoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Website Inventory"
        description="Manage the public Essani Cars website inventory: used cars, brands & new cars."
      />
      <WebsiteInventoryManager />
    </div>
  );
}
