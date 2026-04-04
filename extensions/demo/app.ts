import { LayoutDashboard } from "lucide-react";

import type { AppDefinition } from "@/apps/types";
import type { DashboardDefinition } from "@/dashboards/types";
import { DemoOverviewPage } from "./features/DemoOverviewPage";
import { HealthcareOperationsPage } from "./features/HealthcareOperationsPage";
import { SupplyChainControlTowerPage } from "./features/SupplyChainControlTowerPage";

const financialMarketsSection = {
  id: "financial-markets",
  label: "Financial Markets",
  description: "Capital markets monitoring demo views.",
  order: 10,
};

const supplyChainSection = {
  id: "supply-chain",
  label: "Supply Chain",
  description: "Logistics, inventory, and supplier control-tower views.",
  order: 20,
};

const healthcareSection = {
  id: "healthcare-operations",
  label: "Healthcare Operations",
  description: "Capacity, staffing, and patient-flow operating views.",
  order: 30,
};

const financialMarketsMonitorDashboard: DashboardDefinition = {
  id: "financial-markets-monitor",
  title: "Financial Markets Monitor",
  description: "Market monitoring workspace with KPIs, charts, portfolio state, and live-looking feeds.",
  category: "Demo",
  source: "demo",
  requiredPermissions: ["dashboard:view"],
  widgets: [
    {
      id: "overview-kpis",
      widgetId: "market-kpis",
      title: "Desk KPIs",
      props: { symbol: "NVDA" },
      layout: { cols: 4, rows: 4 },
      position: { x: 0 },
    },
    {
      id: "overview-price",
      widgetId: "price-chart",
      title: "NVDA Tape",
      props: { symbol: "NVDA" },
      layout: { cols: 8, rows: 4 },
      position: { x: 4 },
    },
    {
      id: "overview-positions",
      widgetId: "positions-table",
      title: "Book Snapshot",
      props: {},
      layout: { cols: 8, rows: 6 },
      position: { x: 0 },
    },
    {
      id: "overview-activity",
      widgetId: "activity-feed",
      title: "Operator Activity",
      props: { limit: 6 },
      layout: { cols: 4, rows: 6 },
      position: { x: 8 },
    },
    {
      id: "overview-notes",
      widgetId: "markdown-note",
      title: "Desk Notes",
      props: {
        content:
          "## Desk Notes\n\n- Watch the opening rates move.\n- Confirm the first liquidity window.\n- Track any large spread dislocations.",
      },
      layout: { cols: 12, rows: 5 },
    },
  ],
};

export const demoApp: AppDefinition = {
  id: "demo",
  title: "Demo",
  description: "Mock application suite with industry-specific demo surfaces.",
  source: "demo",
  icon: LayoutDashboard,
  requiredPermissions: ["dashboard:view"],
  defaultSurfaceId: "overview",
  surfaces: [
    {
      id: "overview",
      title: "Overview",
      navLabel: "Overview",
      description: "Landing page for the demo application, workspaces, and Main Sequence widget story.",
      kind: "page",
      navigationSection: financialMarketsSection,
      requiredPermissions: ["dashboard:view"],
      component: DemoOverviewPage,
    },
    {
      id: "markets-monitor",
      title: "Markets Monitor",
      navLabel: "Markets Monitor",
      description: "Financial-markets monitoring surface powered by mock widgets and reusable layouts.",
      kind: "dashboard",
      navigationSection: financialMarketsSection,
      requiredPermissions: ["dashboard:view"],
      dashboard: financialMarketsMonitorDashboard,
    },
    {
      id: "supply-chain-control-tower",
      title: "Control Tower",
      navLabel: "Control Tower",
      description: "Mock supply-chain operating view for lane risk, facilities, and supplier exposure.",
      kind: "page",
      navigationSection: supplyChainSection,
      requiredPermissions: ["dashboard:view"],
      component: SupplyChainControlTowerPage,
    },
    {
      id: "healthcare-operations-command",
      title: "Hospital Command",
      navLabel: "Hospital Command",
      description: "Mock healthcare operations view for patient flow, staffing, and unit pressure.",
      kind: "page",
      navigationSection: healthcareSection,
      requiredPermissions: ["dashboard:view"],
      component: HealthcareOperationsPage,
    },
  ],
};
