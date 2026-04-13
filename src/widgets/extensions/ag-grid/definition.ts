import { PositionsTableWidget } from "@/widgets/extensions/ag-grid/PositionsTableWidget";
import { defineWidget } from "@/widgets/types";

export const positionsTableWidget = defineWidget<Record<string, unknown>>({
  id: "positions-table",
  widgetVersion: "1.0.0",
  title: "Positions Table",
  description: "Main Sequence Markets positions table widget backed by AG Grid.",
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
    agentHints: {
      buildPurpose: "Use this widget to show a legacy AG Grid positions table.",
      whenToUse: ["Use only when this legacy extension widget is explicitly required."],
      whenNotToUse: ["Do not use when the newer typed portfolio widgets cover the same need."],
      authoringSteps: ["Add the widget to a surface that already knows how to provide its data."],
      blockingRequirements: [],
      commonPitfalls: ["This widget is not part of the modern typed workspace runtime model."],
    },
  },
  component: PositionsTableWidget,
});
