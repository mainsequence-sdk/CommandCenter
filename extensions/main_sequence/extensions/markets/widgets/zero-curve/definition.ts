import { LineChart } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT } from "../../../workbench/widget-contracts/mainSequenceDataSourceBundle";
import { DATA_NODE_SOURCE_INPUT_ID } from "../../../workbench/widgets/data-node-shared/widgetBindings";
import { mainSequenceZeroCurveWidgetController } from "./controller";
import { zeroCurveSettingsSchema } from "./schema";
import { ZeroCurveWidget } from "./ZeroCurveWidget";
import type { MainSequenceZeroCurveWidgetProps } from "./zeroCurveModel";

export const mainSequenceZeroCurveWidget = defineWidget<MainSequenceZeroCurveWidgetProps>({
  id: "main-sequence-zero-curve",
  widgetVersion: "1.0.0",
  title: "Zero Curve",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Main Sequence Markets",
  kind: "chart",
  source: "main_sequence_markets",
  requiredPermissions: ["main_sequence_markets:view"],
  tags: ["main-sequence", "markets", "zero-curve", "rates", "echarts", "data-node"],
  exampleProps: {
    sourceMode: "filter_widget",
  },
  mockProps: {
    sourceMode: "filter_widget",
  },
  io: {
    inputs: [
      {
        id: DATA_NODE_SOURCE_INPUT_ID,
        label: "Source data",
        accepts: [MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT],
        required: true,
        effects: [
          {
            kind: "drives-options",
            sourcePath: "rows",
            target: { kind: "schema-field", id: "selectedCurveValues" },
            description: "Upstream rows populate the zero-curve selection choices.",
          },
          {
            kind: "drives-render",
            sourcePath: "rows",
            target: { kind: "render", id: "zero-curve" },
            description: "Incoming rows drive the zero-curve chart output.",
          },
        ],
      },
    ],
  },
  railIcon: LineChart,
  schema: zeroCurveSettingsSchema,
  controller: mainSequenceZeroCurveWidgetController,
  workspaceRuntimeMode: "consumer",
  registryContract: {
    configuration: {
      mode: "static-schema",
      summary:
        "Maps a bound compressed curve dataset into a zero-curve chart rendered on a numeric days axis.",
      requiredSetupSteps: [
        "Bind the widget to an upstream Connection Query or Tabular Transform dataset.",
        "Select the curve and value dimensions used by the chart.",
      ],
    },
    runtime: {
      refreshPolicy: "not-applicable",
      executionTriggers: [],
      executionSummary:
        "Consumes a bound compressed curve dataset and renders a zero-curve chart without owning execution.",
    },
    io: {
      mode: "consumer",
      summary: "Consumes one Main Sequence dataset bundle and maps it into a zero-curve view.",
    },
    capabilities: {
      acceptedContracts: [MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT],
      renderer: "echarts",
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  component: ZeroCurveWidget,
});
