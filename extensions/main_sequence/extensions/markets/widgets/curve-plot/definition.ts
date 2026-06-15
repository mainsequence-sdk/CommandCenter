import { LineChart } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget, type ResolvedWidgetInputs } from "@/widgets/types";
import { MAIN_SEQUENCE_MARKETS_CURVE_PLOT_WIDGET_ID } from "@/widgets/widget-type-normalization";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import {
  MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT,
  type MainSequenceDataSourceBundleV1,
} from "../../../workbench/widget-contracts/mainSequenceDataSourceBundle";
import {
  DATA_NODE_SOURCE_INPUT_ID,
  DATA_NODE_SOURCE_OUTPUT_ID,
} from "../../../workbench/widgets/data-node-shared/widgetBindings";
import { mainSequenceCurvePlotWidgetController } from "./controller";
import { CurvePlotWidget } from "./CurvePlotWidget";
import type { MainSequenceCurvePlotWidgetProps } from "./curvePlotModel";
import { curvePlotSettingsSchema } from "./schema";

const curvePlotDemoSourceFrame = {
  status: "ready",
  columns: ["curve", "maturity", "yield"],
  fields: [
    {
      key: "curve",
      label: "Curve",
      type: "string",
      provenance: "manual",
    },
    {
      key: "maturity",
      label: "Maturity",
      type: "string",
      provenance: "manual",
    },
    {
      key: "yield",
      label: "Yield",
      type: "number",
      provenance: "manual",
    },
  ],
  rows: [
    { curve: "Current", maturity: "1M", yield: 5.12 },
    { curve: "Current", maturity: "3M", yield: 5.08 },
    { curve: "Current", maturity: "6M", yield: 4.96 },
    { curve: "Current", maturity: "1Y", yield: 4.72 },
    { curve: "Current", maturity: "2Y", yield: 4.28 },
    { curve: "Current", maturity: "5Y", yield: 4.05 },
    { curve: "Current", maturity: "10Y", yield: 4.18 },
    { curve: "Current", maturity: "30Y", yield: 4.42 },
    { curve: "Previous close", maturity: "1M", yield: 5.1 },
    { curve: "Previous close", maturity: "3M", yield: 5.03 },
    { curve: "Previous close", maturity: "6M", yield: 4.89 },
    { curve: "Previous close", maturity: "1Y", yield: 4.66 },
    { curve: "Previous close", maturity: "2Y", yield: 4.19 },
    { curve: "Previous close", maturity: "5Y", yield: 3.98 },
    { curve: "Previous close", maturity: "10Y", yield: 4.11 },
    { curve: "Previous close", maturity: "30Y", yield: 4.36 },
    { curve: "One month ago", maturity: "1M", yield: 5.2 },
    { curve: "One month ago", maturity: "3M", yield: 5.16 },
    { curve: "One month ago", maturity: "6M", yield: 5.04 },
    { curve: "One month ago", maturity: "1Y", yield: 4.82 },
    { curve: "One month ago", maturity: "2Y", yield: 4.38 },
    { curve: "One month ago", maturity: "5Y", yield: 4.12 },
    { curve: "One month ago", maturity: "10Y", yield: 4.24 },
    { curve: "One month ago", maturity: "30Y", yield: 4.5 },
    { curve: "Steepener scenario", maturity: "1M", yield: 5.04 },
    { curve: "Steepener scenario", maturity: "3M", yield: 4.96 },
    { curve: "Steepener scenario", maturity: "6M", yield: 4.74 },
    { curve: "Steepener scenario", maturity: "1Y", yield: 4.46 },
    { curve: "Steepener scenario", maturity: "2Y", yield: 4.08 },
    { curve: "Steepener scenario", maturity: "5Y", yield: 4.18 },
    { curve: "Steepener scenario", maturity: "10Y", yield: 4.52 },
    { curve: "Steepener scenario", maturity: "30Y", yield: 4.9 },
  ],
  source: {
    kind: "main-sequence-data-node",
    label: "Demo yield curve",
    updatedAtMs: Date.UTC(2026, 4, 21, 12, 0, 0),
  },
} satisfies MainSequenceDataSourceBundleV1;

const curvePlotDemoResolvedInputs = {
  [DATA_NODE_SOURCE_INPUT_ID]: {
    inputId: DATA_NODE_SOURCE_INPUT_ID,
    label: "Source data",
    status: "valid",
    sourceWidgetId: "curve-plot-demo-source",
    sourceOutputId: DATA_NODE_SOURCE_OUTPUT_ID,
    contractId: MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT,
    value: curvePlotDemoSourceFrame,
    upstreamBase: curvePlotDemoSourceFrame,
  },
} satisfies ResolvedWidgetInputs;

export const mainSequenceCurvePlotWidget = defineWidget<MainSequenceCurvePlotWidgetProps>({
  id: MAIN_SEQUENCE_MARKETS_CURVE_PLOT_WIDGET_ID,
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
    curveField: "curve",
    maturityUnit: "auto",
  },
  mockResolvedInputs: curvePlotDemoResolvedInputs,
  mockRuntimeState: curvePlotDemoSourceFrame,
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
  buildAgentSnapshot: ({ props, domTextContent }) => ({
    displayKind: "chart",
    state: domTextContent?.trim() ? "ready" : "idle",
    summary: domTextContent?.trim()
      ? domTextContent.trim().slice(0, 240)
      : "Curve Plot is waiting for a bound curve dataset.",
    data: {
      widgetRole: "presentation",
      contentType: "chart",
      sourceMode: props.sourceMode ?? null,
      maturityUnit: props.maturityUnit ?? null,
    },
  }),
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
