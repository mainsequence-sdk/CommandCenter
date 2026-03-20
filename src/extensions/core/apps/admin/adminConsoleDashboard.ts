import type { DashboardDefinition } from "@/dashboards/types";

export const adminConsoleDashboard: DashboardDefinition = {
  id: "admin-console",
  title: "Admin Console",
  description: "Operational view for platform owners and compliance admins.",
  category: "Operations",
  source: "core",
  requiredPermissions: ["rbac:view"],
  widgets: [
    {
      id: "admin-kpis",
      widgetId: "market-kpis",
      title: "Platform KPIs",
      props: { symbol: "NVDA" },
      layout: { cols: 4, rows: 4 },
      position: { x: 0 },
    },
    {
      id: "admin-activity",
      widgetId: "activity-feed",
      title: "Platform Events",
      props: { limit: 7 },
      layout: { cols: 4, rows: 5 },
      position: { x: 4 },
    },
    {
      id: "admin-news",
      widgetId: "news-feed",
      title: "External Signals",
      props: { limit: 5 },
      layout: { cols: 4, rows: 5 },
      position: { x: 8 },
    },
    {
      id: "admin-kpis-secondary",
      widgetId: "market-kpis",
      title: "Reference Metrics",
      props: { symbol: "AAPL" },
      layout: { cols: 12, rows: 4 },
    },
  ],
};
