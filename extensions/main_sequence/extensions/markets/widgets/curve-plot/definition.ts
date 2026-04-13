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
  widgetVersion: "1.0.0",
  title: "Curve Plot",
  description: "DataNode-backed tenor curve chart rendered from mapped maturity and yield fields.",
  category: "Main Sequence Markets",
  kind: "chart",
  source: "main_sequence_markets",
  requiredPermissions: ["main_sequence_markets:view"],
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
  registryContract: {
    configuration: {
      mode: "static-schema",
      summary:
        "Maps a bound Data Node dataset into a tenor curve chart using maturity and yield fields.",
      requiredSetupSteps: [
        "Bind the widget to an upstream Data Node dataset.",
        "Select maturity and value fields.",
      ],
    },
    runtime: {
      refreshPolicy: "not-applicable",
      executionTriggers: [],
      executionSummary:
        "Consumes a bound Data Node dataset and renders a curve chart without owning execution.",
    },
    io: {
      mode: "consumer",
      summary: "Consumes one Main Sequence dataset bundle and maps it into a tenor curve chart.",
    },
    capabilities: {
      acceptedContracts: [MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT],
      supportedMaturityUnits: ["auto", "months", "years"],
    },
    agentHints: {
      buildPurpose:
        "Use this widget to render a yield-curve style chart from a bound Data Node dataset.",
      whenToUse: [
        "Use when the dataset has one maturity axis field and one numeric value field.",
      ],
      whenNotToUse: [
        "Do not use when the desired chart is time-based instead of curve-based.",
      ],
      authoringSteps: [
        "Bind the widget to a Data Node dataset.",
        "Choose the maturity and value fields.",
      ],
      blockingRequirements: ["A compatible upstream Data Node binding is required."],
      commonPitfalls: [
        "The maturity field must contain values that can be interpreted as curve tenors.",
      ],
    },
  },
  component: CurvePlotWidget,
});
