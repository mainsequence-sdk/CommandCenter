import { resolveWidgetDescription } from "@/widgets/shared/widget-description";
import type { WidgetDefinition } from "@/widgets/types";

import descriptionMarkdown from "./DESCRIPTION.md?raw";
import { HeatmapMatrixWidget } from "./HeatmapMatrixWidget";

export const heatmapMatrixWidget: WidgetDefinition<{ desk?: string }> = {
  id: "heatmap-matrix-chart",
  widgetVersion: "1.0.0",
  title: "Heatmap Matrix",
  description: resolveWidgetDescription(descriptionMarkdown),
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
    agentHints: {
      buildPurpose: "Use this widget only for demo heatmap layouts and mock market storytelling.",
      whenToUse: ["Use in demo surfaces where mock heatmap data is acceptable."],
      whenNotToUse: ["Do not use for production typed workspace authoring."],
      authoringSteps: ["Optionally set the desk label."],
      blockingRequirements: [],
      commonPitfalls: ["This is demo-only and not a production data contract widget."],
    },
  },
  component: HeatmapMatrixWidget,
};
