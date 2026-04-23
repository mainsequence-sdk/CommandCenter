import { PositionsTableWidget } from "@/widgets/extensions/ag-grid/PositionsTableWidget";
import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";

export const positionsTableWidget = defineWidget<Record<string, unknown>>({
  id: "positions-table",
  widgetVersion: "1.0.0",
  title: "Positions Table",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Main Sequence Markets",
  kind: "table",
  source: "main_sequence_markets",
  requiredPermissions: ["main_sequence_markets:view"],
  tags: ["main-sequence", "markets", "portfolio", "positions", "ag-grid", "table"],
  exampleProps: {},
  registryContract: {
    configuration: {
      mode: "none",
      summary: "This legacy extension widget does not expose authored configuration in the shared settings model.",
    },
    io: {
      mode: "none",
      summary: "This widget does not publish a standardized typed IO contract.",
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  component: PositionsTableWidget,
});
