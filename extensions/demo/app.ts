import { LayoutDashboard } from "lucide-react";

import type { AppDefinition } from "@/apps/types";
import type { DashboardDefinition } from "@/dashboards/types";
import { HealthcareOperationsPage } from "./features/HealthcareOperationsPage";
import { MarketBriefPage } from "./features/market-brief/MarketBriefPage";
import { SupplyChainControlTowerPage } from "./features/SupplyChainControlTowerPage";

const financialMarketsSection = {
  id: "financial-markets",
  label: "Financial Markets",
  description: "Capital markets, cross-asset, and execution demo views.",
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

const overviewDashboard: DashboardDefinition = {
  id: "overview",
  title: "Demo Overview",
  description: "Mixed mock dashboard with KPIs, charts, portfolio state, and live-looking feeds.",
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
      id: "overview-news",
      widgetId: "news-feed",
      title: "Headline Tape",
      props: { limit: 5 },
      layout: { cols: 12, rows: 5 },
    },
  ],
};

const crossAssetDashboard: DashboardDefinition = {
  id: "cross-asset",
  title: "Cross-Asset",
  description: "Macro pulse board with heatmap context, rates shape, and event tape.",
  category: "Demo",
  source: "demo",
  requiredPermissions: ["dashboard:view"],
  widgets: [
    {
      id: "cross-asset-heatmap",
      widgetId: "heatmap-matrix-chart",
      title: "Regime Matrix",
      props: { desk: "Global Macro" },
      layout: { cols: 7, rows: 8 },
      position: { x: 0 },
    },
    {
      id: "cross-asset-curve-bull",
      widgetId: "yield-curve-plot",
      title: "SOFR Bull Steepener",
      props: { market: "sofr", scenario: "bull-steepener", comparisonMode: "session" },
      layout: { cols: 5, rows: 8 },
      position: { x: 7 },
    },
    {
      id: "cross-asset-crypto",
      widgetId: "price-chart",
      title: "ETHUSD",
      props: { symbol: "ETHUSD" },
      layout: { cols: 6, rows: 5 },
      position: { x: 0 },
    },
    {
      id: "cross-asset-news",
      widgetId: "news-feed",
      title: "Catalysts",
      props: { limit: 4 },
      layout: { cols: 6, rows: 5 },
      position: { x: 6 },
    },
  ],
};

const orderflowLabDashboard: DashboardDefinition = {
  id: "orderflow-lab",
  title: "Flow Lab",
  description: "Experimental demo dashboard that mixes extension-owned widgets into the core app.",
  category: "Demo",
  source: "demo",
  requiredPermissions: ["orders:read"],
  controls: {
    enabled: false,
  },
  widgets: [
    {
      id: "flow-positions",
      widgetId: "positions-table",
      title: "Book Ladder",
      props: {},
      layout: { cols: 7, rows: 7 },
      position: { x: 0 },
    },
    {
      id: "flow-book",
      widgetId: "order-book",
      title: "TSLA Level II",
      props: { symbol: "TSLA" },
      layout: { cols: 5, rows: 3 },
      position: { x: 7 },
    },
    {
      id: "flow-depth",
      widgetId: "order-book-depth",
      title: "NVDA Depth",
      props: { symbol: "NVDA" },
      layout: { cols: 5, rows: 4 },
      position: { x: 7 },
    },
    {
      id: "flow-rates",
      widgetId: "yield-curve-plot",
      title: "Rates Overlay",
      props: { market: "ust", scenario: "desk", comparisonMode: "historical" },
      layout: { cols: 12, rows: 5 },
    },
    {
      id: "flow-activity",
      widgetId: "activity-feed",
      title: "Execution Events",
      props: { limit: 5 },
      layout: { cols: 6, rows: 5 },
      position: { x: 0 },
    },
    {
      id: "flow-headlines",
      widgetId: "news-feed",
      title: "Tape Headlines",
      props: { limit: 4 },
      layout: { cols: 6, rows: 5 },
      position: { x: 6 },
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
      description: "Summary dashboard for the default demo monitoring surface.",
      kind: "dashboard",
      navigationSection: financialMarketsSection,
      requiredPermissions: ["dashboard:view"],
      dashboard: overviewDashboard,
    },
    {
      id: "cross-asset",
      title: "Cross-Asset",
      navLabel: "Cross-Asset",
      description: "Secondary demo dashboard for macro pulse and cross-asset monitoring.",
      kind: "dashboard",
      navigationSection: financialMarketsSection,
      requiredPermissions: ["dashboard:view"],
      dashboard: crossAssetDashboard,
    },
    {
      id: "orderflow-lab",
      title: "Flow Lab",
      navLabel: "Flow Lab",
      description: "Extension-backed demo dashboard narrowed to the strategy book and yield-curve widgets.",
      kind: "dashboard",
      navigationSection: financialMarketsSection,
      requiredPermissions: ["orders:read"],
      dashboard: orderflowLabDashboard,
    },
    {
      id: "market-brief",
      title: "Demo Brief",
      navLabel: "Brief",
      description: "Narrative demo briefing with catalysts, notes, and operator context.",
      kind: "page",
      navigationSection: financialMarketsSection,
      requiredPermissions: ["dashboard:view"],
      component: MarketBriefPage,
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
