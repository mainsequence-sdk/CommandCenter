import { DashboardCanvas } from "@/features/dashboards/DashboardCanvas";

import { adminConsoleDashboard } from "./adminConsoleDashboard";
import { AdminSurfaceLayout } from "./shared";

export function AdminConsolePage() {
  return (
    <AdminSurfaceLayout
      title="Admin console"
      description="Operational dashboard for platform owners and compliance admins."
    >
      <DashboardCanvas dashboard={adminConsoleDashboard} />
    </AdminSurfaceLayout>
  );
}
