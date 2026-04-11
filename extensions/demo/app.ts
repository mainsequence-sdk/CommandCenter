import { LayoutDashboard } from "lucide-react";

import { defineSurfaceAssistantContext, type AppDefinition } from "@/apps/types";
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
  requiredPermissions: ["main_sequence_markets:view"],
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
  requiredPermissions: ["workspaces:view"],
  defaultSurfaceId: "overview",
  surfaces: [
    {
      id: "overview",
      title: "Overview",
      navLabel: "Overview",
      description: "Landing page for the demo application, workspaces, and Main Sequence widget story.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on the Demo overview page. This page introduces the demo application and its mock workflows.",
        availableActions: [
          "Review the demo overview",
          "Navigate to demo surfaces",
        ],
      }),
      kind: "page",
      navigationSection: financialMarketsSection,
      requiredPermissions: ["workspaces:view"],
      component: DemoOverviewPage,
    },
    {
      id: "markets-monitor",
      title: "Markets Monitor",
      navLabel: "Markets Monitor",
      description: "Financial-markets monitoring surface powered by mock widgets and reusable layouts.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on the Demo Markets Monitor dashboard. This page shows a mock financial-markets monitoring layout.",
        availableActions: [
          "Inspect demo widgets",
          "Review mock market signals",
        ],
      }),
      kind: "dashboard",
      navigationSection: financialMarketsSection,
      requiredPermissions: ["main_sequence_markets:view"],
      dashboard: financialMarketsMonitorDashboard,
    },
    {
      id: "supply-chain-control-tower",
      title: "Control Tower",
      navLabel: "Control Tower",
      description: "Mock supply-chain operating view for lane risk, facilities, and supplier exposure.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on the Demo Control Tower page. This page shows a mock supply-chain operating view.",
        availableActions: [
          "Review mock supply-chain signals",
          "Inspect the control-tower layout",
        ],
      }),
      kind: "page",
      navigationSection: supplyChainSection,
      requiredPermissions: ["workspaces:view"],
      component: SupplyChainControlTowerPage,
    },
    {
      id: "healthcare-operations-command",
      title: "Hospital Command",
      navLabel: "Hospital Command",
      description: "Mock healthcare operations view for patient flow, staffing, and unit pressure.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on the Demo Hospital Command page. This page shows a mock healthcare operations view.",
        availableActions: [
          "Review mock healthcare operations signals",
          "Inspect the hospital command layout",
        ],
      }),
      kind: "page",
      navigationSection: healthcareSection,
      requiredPermissions: ["workspaces:view"],
      component: HealthcareOperationsPage,
    },
  ],
};
