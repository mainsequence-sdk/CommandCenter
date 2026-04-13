import { LineChart } from "lucide-react";

import { defineWidget } from "@/widgets/types";

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
  description: "Compressed Curve Data Node chart rendered on a numeric days axis with ECharts.",
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
        "Maps a bound Data Node dataset into a zero-curve chart rendered on a numeric days axis.",
      requiredSetupSteps: [
        "Bind the widget to an upstream Data Node dataset.",
        "Select the curve and value dimensions used by the chart.",
      ],
    },
    runtime: {
      refreshPolicy: "not-applicable",
      executionTriggers: [],
      executionSummary:
        "Consumes a bound Data Node dataset and renders a zero-curve chart without owning execution.",
    },
    io: {
      mode: "consumer",
      summary: "Consumes one Main Sequence dataset bundle and maps it into a zero-curve view.",
    },
    capabilities: {
      acceptedContracts: [MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT],
      renderer: "echarts",
    },
    agentHints: {
      buildPurpose:
        "Use this widget to visualize compressed curve data on a days-based zero-curve axis.",
      whenToUse: [
        "Use when the dataset is already shaped for zero-curve style rendering.",
      ],
      whenNotToUse: [
        "Do not use when the source data should be visualized as a time series or generic table.",
      ],
      authoringSteps: [
        "Bind the widget to a Data Node dataset.",
        "Choose the fields that identify the curve values to render.",
      ],
      blockingRequirements: ["A compatible upstream Data Node binding is required."],
      commonPitfalls: [
        "This widget assumes a curve-oriented shape, not a generic time series schema.",
      ],
    },
  },
  component: ZeroCurveWidget,
});
