import { BarChart3 } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT } from "../../../workbench/widget-contracts/mainSequenceDataSourceBundle";
import { DATA_NODE_SOURCE_INPUT_ID } from "../../../workbench/widgets/data-node-shared/widgetBindings";
import { mainSequenceOhlcBarsWidgetController } from "./controller";
import { OhlcBarsWidget } from "./OhlcBarsWidget";
import type { MainSequenceOhlcBarsWidgetProps } from "./ohlcBarsModel";
import { ohlcBarsSettingsSchema } from "./schema";

export const mainSequenceOhlcBarsWidget = defineWidget<MainSequenceOhlcBarsWidgetProps>({
  id: "main-sequence-ohlc-bars",
  widgetVersion: "1.0.0",
  title: "OHLC Bars",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Main Sequence Markets",
  kind: "chart",
  source: "main_sequence_markets",
  requiredPermissions: ["main_sequence_markets:view"],
  tags: ["main-sequence", "markets", "ohlc", "bars", "price", "lightweight-charts", "data-node"],
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
            sourcePath: "fields",
            target: { kind: "schema-field", id: "timeField" },
            description: "Upstream fields populate the time mapping choices.",
          },
          {
            kind: "drives-options",
            sourcePath: "fields",
            target: { kind: "schema-field", id: "openField" },
            description: "Upstream fields populate the open price mapping choices.",
          },
          {
            kind: "drives-options",
            sourcePath: "fields",
            target: { kind: "schema-field", id: "highField" },
            description: "Upstream fields populate the high price mapping choices.",
          },
          {
            kind: "drives-options",
            sourcePath: "fields",
            target: { kind: "schema-field", id: "lowField" },
            description: "Upstream fields populate the low price mapping choices.",
          },
          {
            kind: "drives-options",
            sourcePath: "fields",
            target: { kind: "schema-field", id: "closeField" },
            description: "Upstream fields populate the close price mapping choices.",
          },
          {
            kind: "drives-options",
            sourcePath: "fields",
            target: { kind: "schema-field", id: "volumeField" },
            description: "Upstream fields populate the optional volume mapping choices.",
          },
          {
            kind: "drives-options",
            sourcePath: "fields",
            target: { kind: "schema-field", id: "seriesFilterField" },
            description: "Upstream fields populate the optional series filter column choices.",
          },
          {
            kind: "drives-options",
            sourcePath: "rows",
            target: { kind: "schema-field", id: "seriesFilterValue" },
            description: "Upstream rows populate the filter values for the selected series column.",
          },
          {
            kind: "drives-render",
            sourcePath: "rows",
            target: { kind: "render", id: "ohlc-bars" },
            description: "Incoming rows drive the OHLC bar chart.",
          },
        ],
      },
    ],
  },
  railIcon: BarChart3,
  workspaceIcon: BarChart3,
  schema: ohlcBarsSettingsSchema,
  controller: mainSequenceOhlcBarsWidgetController,
  workspaceRuntimeMode: "consumer",
  registryContract: {
    configuration: {
      mode: "static-schema",
      summary:
        "Maps a bound tabular market dataset into OHLC bars using time, open, high, low, and close fields.",
      requiredSetupSteps: [
        "Bind the widget to an upstream Connection Query or Tabular Transform dataset.",
        "Ensure the upstream table publishes one time field and numeric open, high, low, and close fields.",
        "If the upstream table contains several tickers or instruments, select a series filter column and one value.",
        "Optionally map a numeric volume field and add SMA or EMA studies in widget settings.",
        "Review or override the inferred field mappings in widget settings.",
      ],
    },
    runtime: {
      refreshPolicy: "not-applicable",
      executionTriggers: [],
      executionSummary:
        "Consumes a bound dataset and renders OHLC bars without owning execution.",
    },
    io: {
      mode: "consumer",
      summary:
        "Consumes one Main Sequence dataset bundle whose rows can be mapped into time/open/high/low/close bars.",
      inputContracts: [MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT],
      ioNotes: [
        "The bound tabular response must expose rows shaped like { time: string | number, open: number, high: number, low: number, close: number, volume?: number } or equivalent column names selected in settings.",
        "Time values may be ISO date strings, ISO datetime strings, Unix seconds, Unix milliseconds, Unix microseconds, or Unix nanoseconds.",
        "Volume is optional. When volumeField is mapped, numeric volume values render in a lower histogram pane.",
        "Series filtering is optional. When the table contains multiple instruments, map seriesFilterField to a column such as ticker or symbol and set seriesFilterValue to one value.",
        "Studies are local visual overlays calculated from close prices. The initial supported studies are SMA and EMA.",
      ],
    },
    capabilities: {
      acceptedContracts: [MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT],
      renderer: "lightweight-charts",
      supportedStudies: ["sma", "ema"],
      supportedSeriesTypes: ["candlestick", "volume-histogram", "line-study"],
      requiredTabularFields: ["time", "open", "high", "low", "close"],
      optionalTabularFields: ["volume", "ticker", "symbol", "instrument"],
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  component: OhlcBarsWidget,
});
