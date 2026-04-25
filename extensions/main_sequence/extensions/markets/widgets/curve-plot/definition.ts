import { LineChart } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
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
  description: resolveWidgetDescription(usageGuidanceMarkdown),
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
        "Maps a bound tabular curve dataset into a tenor curve chart using maturity and yield fields.",
      requiredSetupSteps: [
        "Bind the widget to an upstream Connection Query or Tabular Transform dataset.",
        "Select maturity and value fields.",
      ],
    },
    runtime: {
      refreshPolicy: "not-applicable",
      executionTriggers: [],
      executionSummary:
        "Consumes a bound dataset and renders a curve chart without owning execution.",
    },
    io: {
      mode: "consumer",
      summary: "Consumes one Main Sequence dataset bundle and maps it into a tenor curve chart.",
    },
    capabilities: {
      acceptedContracts: [MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT],
      supportedMaturityUnits: ["auto", "months", "years"],
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  component: CurvePlotWidget,
});
