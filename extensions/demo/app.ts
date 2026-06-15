import { LayoutDashboard } from "lucide-react";

import { defineSurfaceAssistantContext, type AppDefinition } from "@/apps/types";
import type { DashboardDefinition } from "@/dashboards/types";
import {
  CORE_MARKDOWN_NOTE_WIDGET_ID,
  MAIN_SEQUENCE_MARKETS_POSITION_DETAIL_WIDGET_ID,
} from "@/widgets/widget-type-normalization";
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
  description: "Market monitoring workspace with charts, portfolio state, and desk notes.",
  category: "Demo",
  source: "demo",
  requiredPermissions: ["main_sequence_markets:view"],
  widgets: [
    {
      id: "overview-positions",
      widgetId: MAIN_SEQUENCE_MARKETS_POSITION_DETAIL_WIDGET_ID,
      title: "Book Snapshot",
      props: {
        sourceType: "target_position",
        editableInPlace: true,
        variant: "positions",
        positionRows: [
          {
            rowId: "demo-book-aapl",
            assetId: 101,
            assetName: "Apple Inc.",
            assetTicker: "AAPL",
            uniqueIdentifier: "US0378331005",
            figi: "BBG000B9XRY4",
            date: "2026-05-18",
            positionType: "weight_notional_exposure",
            positionValue: 0.245,
          },
          {
            rowId: "demo-book-msft",
            assetId: 102,
            assetName: "Microsoft Corp.",
            assetTicker: "MSFT",
            uniqueIdentifier: "US5949181045",
            figi: "BBG000BPH459",
            date: "2026-05-18",
            positionType: "weight_notional_exposure",
            positionValue: 0.198,
          },
          {
            rowId: "demo-book-nvda",
            assetId: 103,
            assetName: "NVIDIA Corp.",
            assetTicker: "NVDA",
            uniqueIdentifier: "US67066G1040",
            figi: "BBG000BBJQV0",
            date: "2026-05-18",
            positionType: "constant_notional",
            positionValue: 1250000,
          },
        ],
      },
      layout: { cols: 8, rows: 6 },
      position: { x: 0 },
    },
    {
      id: "overview-notes",
      widgetId: CORE_MARKDOWN_NOTE_WIDGET_ID,
      title: "Desk Notes",
      props: {
        content:
          "## Desk Notes\n\n- Watch the opening rates move.\n- Confirm the first liquidity window.\n- Track any large spread dislocations.",
      },
      layout: { cols: 4, rows: 6 },
      position: { x: 8 },
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
      description: "Financial-markets monitoring surface powered by reusable layouts and a reduced mock widget set.",
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
