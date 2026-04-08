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
  component: ZeroCurveWidget,
});
