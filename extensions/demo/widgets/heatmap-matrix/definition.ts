import type { WidgetDefinition } from "@/widgets/types";

import { HeatmapMatrixWidget } from "./HeatmapMatrixWidget";

export const heatmapMatrixWidget: WidgetDefinition<{ desk?: string }> = {
  id: "heatmap-matrix-chart",
  title: "Heatmap Matrix",
  description:
    "Mock cross-asset heatmap with a Lightweight Charts drilldown for the selected cell.",
  category: "Market",
  kind: "chart",
  source: "demo",
  defaultSize: { w: 10, h: 8 },
  requiredPermissions: ["marketdata:read"],
  tags: ["heatmap", "mock", "market", "matrix", "charts", "demo"],
  exampleProps: { desk: "Global Macro" },
  component: HeatmapMatrixWidget,
};
