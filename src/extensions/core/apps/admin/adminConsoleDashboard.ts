import type { DashboardDefinition } from "@/dashboards/types";

export const adminConsoleDashboard: DashboardDefinition = {
  id: "admin-console",
  title: "Admin Console",
  description: "Operational view for platform owners and compliance admins.",
  category: "Operations",
  source: "core",
  requiredPermissions: ["org_admin:view"],
  widgets: [
    {
      id: "admin-curve-ust",
      widgetId: "yield-curve-plot",
      title: "US Treasury Curve",
      props: { market: "ust", scenario: "desk", comparisonMode: "historical" },
      layout: { cols: 6, rows: 6 },
      position: { x: 0 },
    },
    {
      id: "admin-curve-sofr",
      widgetId: "yield-curve-plot",
      title: "SOFR Curve",
      props: { market: "sofr", scenario: "bear-flattener", comparisonMode: "session" },
      layout: { cols: 6, rows: 6 },
      position: { x: 6 },
    },
    {
      id: "admin-curve-bund",
      widgetId: "yield-curve-plot",
      title: "Bund Curve",
      props: { market: "bund", scenario: "inverted", comparisonMode: "historical" },
      layout: { cols: 12, rows: 6 },
    },
  ],
};
