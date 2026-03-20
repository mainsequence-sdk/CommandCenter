import { FactorHeatmapWidget } from "@/widgets/core/factor-heatmap/FactorHeatmapWidget";
import type { WidgetDefinition } from "@/widgets/types";

export const factorHeatmapWidget: WidgetDefinition<Record<string, unknown>> = {
  id: "factor-heatmap",
  title: "Factor Heatmap",
  description: "Cross-impact heatmap showing reinforcing and opposing factor pressure.",
  category: "Quant",
  kind: "custom",
  source: "core",
  defaultSize: { w: 5, h: 8 },
  requiredPermissions: ["dashboard:view"],
  tags: ["quant", "heatmap", "correlation"],
  component: FactorHeatmapWidget,
};
