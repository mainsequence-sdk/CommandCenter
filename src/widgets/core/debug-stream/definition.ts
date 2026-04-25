import { Bug } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";
import { TABULAR_SOURCE_CONTRACT, TABULAR_SOURCE_INPUT_ID } from "@/widgets/shared/tabular-widget-source";
import { defineWidget, type ResolvedWidgetInputs } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { DebugStreamWidget } from "./DebugStreamWidget";
import {
  DebugStreamWidgetSettings,
  type DebugStreamWidgetProps,
} from "./DebugStreamWidgetSettings";

const debugStreamMockResolvedInputs: ResolvedWidgetInputs = {
  [TABULAR_SOURCE_INPUT_ID]: {
    inputId: TABULAR_SOURCE_INPUT_ID,
    label: "Source data",
    status: "valid",
    sourceWidgetId: "connection-query-demo",
    sourceOutputId: "dataset",
    contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    value: {
      status: "ready",
      columns: ["time_index", "value", "series"],
      rows: [
        { time_index: 1714032000000, value: 101.2, series: "UST" },
        { time_index: 1714118400000, value: 103.6, series: "UST" },
        { time_index: 1714204800000, value: 102.9, series: "UST" },
        { time_index: 1714291200000, value: 105.1, series: "UST" },
      ],
      fields: [
        { key: "time_index", type: "datetime", provenance: "backend" },
        { key: "value", type: "number", provenance: "backend" },
        { key: "series", type: "string", provenance: "backend" },
      ],
      meta: {
        timeSeries: {
          shape: "long",
          timeField: "time_index",
          timeUnit: "ms",
          timezone: "UTC",
          sorted: true,
          valueField: "value",
          seriesField: "series",
          duplicatePolicy: "preserve",
          gapPolicy: "preserve_nulls",
        },
      },
      source: {
        kind: "connection-query",
        label: "Demo connection query",
      },
    },
  },
};

export const debugStreamWidget = defineWidget<DebugStreamWidgetProps>({
  id: "debug_stream",
  widgetVersion: "1.0.0",
  title: "Debug Stream",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Core",
  kind: "custom",
  source: "core",
  requiredPermissions: ["workspaces:view"],
  tags: ["debug", "binding", "tabular", "trace"],
  exampleProps: {},
  mockProps: {},
  mockTitle: "Debug Stream",
  mockResolvedInputs: debugStreamMockResolvedInputs,
  workspaceIcon: Bug,
  showRawPropsEditor: false,
  io: {
    inputs: [
      {
        id: TABULAR_SOURCE_INPUT_ID,
        label: "Source data",
        accepts: [TABULAR_SOURCE_CONTRACT],
        required: true,
        effects: [
          {
            kind: "drives-render",
            sourcePath: "rows",
            target: { kind: "render", id: "debug-preview" },
            description: "Incoming dataset drives the debug preview.",
          },
        ],
      },
    ],
  },
  workspaceRuntimeMode: "consumer",
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Binds to one upstream tabular dataset and exposes the consumer-side resolution state, preview, and debug snapshot.",
      requiredSetupSteps: [
        "Bind the widget to one upstream dataset output.",
        "Open the panel to inspect the resolved binding, source widget runtime, and preview frame.",
      ],
      configurationNotes: [
        "This widget is for debugging workspace dataflow, not final presentation.",
        "It intentionally shows consumer-side resolution details instead of hiding them.",
      ],
    },
    runtime: {
      refreshPolicy: "not-applicable",
      executionTriggers: [],
      executionSummary:
        "Consumes one upstream dataset and surfaces how the consumer path resolved that dataset, including explorer-style preview and debug metadata.",
    },
    io: {
      mode: "consumer",
      summary:
        "Consumes one `core.tabular_frame@v1` input and does not publish an output.",
      inputContracts: [TABULAR_SOURCE_CONTRACT],
      ioNotes: [
        "Use this widget to inspect what a consumer actually sees after binding resolution.",
      ],
    },
    capabilities: {
      acceptedContracts: [TABULAR_SOURCE_CONTRACT],
      previewModes: ["table", "graph", "consumer-snapshot"],
      publishesOutput: false,
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  settingsComponent: DebugStreamWidgetSettings,
  component: DebugStreamWidget,
});
