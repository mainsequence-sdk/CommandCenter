import { LineChart } from "lucide-react";

import { defineWidget } from "@/widgets/types";

import { MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT } from "../../../workbench/widget-contracts/mainSequenceDataSourceBundle";
import { DATA_NODE_SOURCE_INPUT_ID } from "../../../workbench/widgets/data-node-shared/widgetBindings";
import { mainSequenceCurvePlotWidgetController } from "./controller";
import { CurvePlotWidget } from "./CurvePlotWidget";
import type { MainSequenceCurvePlotWidgetProps } from "./curvePlotModel";
import { curvePlotSettingsSchema } from "./schema";

export const mainSequenceCurvePlotWidget = defineWidget<MainSequenceCurvePlotWidgetProps>({
  id: "main-sequence-curve-plot",
  title: "Curve Plot",
  description: "DataNode-backed tenor curve chart rendered from mapped maturity and yield fields.",
  category: "Main Sequence Markets",
  kind: "chart",
  source: "main_sequence_markets",
  requiredPermissions: ["marketdata:read"],
  tags: ["main-sequence", "markets", "yield-curve", "rates", "lightweight-charts", "data-node"],
  exampleProps: {
    sourceMode: "filter_widget",
    maturityUnit: "auto",
  },
  mockProps: {
    sourceMode: "filter_widget",
    maturityUnit: "auto",
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
            sourcePath: "fields",
            target: { kind: "schema-field", id: "maturityField" },
            description: "Upstream fields populate maturity mapping choices.",
          },
          {
            kind: "drives-options",
            sourcePath: "fields",
            target: { kind: "schema-field", id: "valueField" },
            description: "Upstream fields populate yield mapping choices.",
          },
          {
            kind: "drives-render",
            sourcePath: "rows",
            target: { kind: "render", id: "curve-plot" },
            description: "Incoming rows drive the curve plot series.",
          },
        ],
      },
    ],
  },
  railIcon: LineChart,
  schema: curvePlotSettingsSchema,
  controller: mainSequenceCurvePlotWidgetController,
  workspaceRuntimeMode: "consumer",
  component: CurvePlotWidget,
});
