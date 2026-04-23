import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import type { WidgetDefinition } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { HeatmapMatrixWidget } from "./HeatmapMatrixWidget";

export const heatmapMatrixWidget: WidgetDefinition<{ desk?: string }> = {
  id: "heatmap-matrix-chart",
  widgetVersion: "1.0.0",
  title: "Heatmap Matrix",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Market",
  kind: "chart",
  source: "demo",
  defaultSize: { w: 10, h: 8 },
  requiredPermissions: ["main_sequence_markets:view"],
  tags: ["heatmap", "mock", "market", "matrix", "charts", "demo"],
  exampleProps: { desk: "Global Macro" },
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary: "Configures a desk-scoped demo heatmap widget.",
      fields: [{ id: "desk", label: "Desk", type: "string", source: "custom-settings" }],
    },
    io: {
      mode: "none",
      summary: "This demo widget does not participate in the standardized typed IO model.",
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  component: HeatmapMatrixWidget,
};
