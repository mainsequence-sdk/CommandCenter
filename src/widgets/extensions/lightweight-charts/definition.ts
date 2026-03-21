import { HeatmapMatrixWidget } from "@/widgets/extensions/lightweight-charts/HeatmapMatrixWidget";
import { PriceChartWidget } from "@/widgets/extensions/lightweight-charts/PriceChartWidget";
import type { WidgetDefinition } from "@/widgets/types";

export const priceChartWidget: WidgetDefinition<{ symbol?: string }> = {
  id: "price-chart",
  title: "Price Chart",
  description: "Optional Lightweight Charts widget wired to a mock market data stream.",
  category: "Market",
  kind: "chart",
  source: "lightweight-charts",
  defaultSize: { w: 8, h: 6 },
  requiredPermissions: ["marketdata:read"],
  tags: ["realtime", "market", "optional", "charts"],
  exampleProps: { symbol: "AAPL" },
  component: PriceChartWidget,
};

export const heatmapMatrixWidget: WidgetDefinition<{ desk?: string }> = {
  id: "heatmap-matrix-chart",
  title: "Heatmap Matrix",
  description:
    "Mock cross-asset heatmap with a Lightweight Charts drilldown for the selected cell.",
  category: "Market",
  kind: "chart",
  source: "lightweight-charts",
  defaultSize: { w: 10, h: 8 },
  requiredPermissions: ["marketdata:read"],
  tags: ["heatmap", "mock", "market", "matrix", "charts"],
  exampleProps: { desk: "Global Macro" },
  component: HeatmapMatrixWidget,
};
