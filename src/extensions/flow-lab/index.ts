import { Sparkles } from "lucide-react";

import type { AppExtension } from "@/app/registry/types";
import type { AppDefinition } from "@/apps/types";
import type { DashboardDefinition } from "@/dashboards/types";
import { neonMintTheme } from "@/extensions/flow-lab/theme";
import { orderBookWidget } from "@/widgets/extensions/order-book/definition";

const orderflowLabDashboard: DashboardDefinition = {
  id: "orderflow-lab",
  title: "Orderflow Lab",
  description: "Example extension dashboard showing how third-party modules compose widgets.",
  category: "Research",
  source: "flow-lab",
  requiredPermissions: ["orders:read"],
  widgets: [
    {
      id: "flow-chart",
      widgetId: "price-chart",
      title: "TSLA — Micro Structure",
      props: { symbol: "TSLA" },
      layout: { cols: 8, rows: 5 },
      position: { x: 0 },
    },
    {
      id: "flow-orderbook",
      widgetId: "order-book",
      title: "Level II Snapshot",
      props: { symbol: "TSLA" },
      layout: { cols: 4, rows: 5 },
      position: { x: 8 },
    },
    {
      id: "flow-positions",
      widgetId: "positions-table",
      title: "Strategy Book",
      props: {},
      layout: { cols: 8, rows: 6 },
      position: { x: 0 },
    },
    {
      id: "flow-activity",
      widgetId: "activity-feed",
      title: "Routing Events",
      props: { limit: 6 },
      layout: { cols: 4, rows: 6 },
      position: { x: 8 },
    },
  ],
};

const flowLabApp: AppDefinition = {
  id: "flow-lab",
  title: "Flow Lab",
  description: "Example extension app that combines a custom order book with grid surfaces.",
  source: "flow-lab",
  icon: Sparkles,
  requiredPermissions: ["orders:read"],
  defaultSurfaceId: "orderflow-lab",
  surfaces: [
    {
      id: "orderflow-lab",
      title: "Orderflow Lab",
      navLabel: "Lab",
      description: "Experimental desk surface built from extension-owned widgets.",
      kind: "dashboard",
      requiredPermissions: ["orders:read"],
      dashboard: orderflowLabDashboard,
    },
  ],
};

const flowLabExtension: AppExtension = {
  id: "flow-lab",
  title: "Flow Lab",
  description: "Example extension that ships a custom app, dashboard surface, widget, and theme.",
  widgets: [orderBookWidget],
  apps: [flowLabApp],
  themes: [neonMintTheme],
};

export default flowLabExtension;
