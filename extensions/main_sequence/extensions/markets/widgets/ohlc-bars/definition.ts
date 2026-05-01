import { BarChart3 } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import {
  resolveIncrementalTabularOutputFrame,
  TABULAR_LIVE_UPDATES_INPUT_ID,
  TABULAR_SEED_INPUT_ID,
  TABULAR_UPDATES_OUTPUT_ID,
} from "@/widgets/shared/incremental-tabular-consumer";
import { defineWidget } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT } from "../../../workbench/widget-contracts/mainSequenceDataSourceBundle";
import {
  DATA_NODE_SOURCE_INPUT_ID,
  DATA_NODE_SOURCE_OUTPUT_ID,
} from "../../../workbench/widgets/data-node-shared/widgetBindings";
import { mainSequenceOhlcBarsWidgetController } from "./controller";
import { OhlcBarsWidget } from "./OhlcBarsWidget";
import type { MainSequenceOhlcBarsWidgetProps } from "./ohlcBarsModel";
import { buildOhlcBarsFieldOptionsFromRuntime, buildOhlcBarsSeries, resolveOhlcBarsConfig } from "./ohlcBarsModel";
import { ohlcBarsSettingsSchema } from "./schema";

export const mainSequenceOhlcBarsWidget = defineWidget<MainSequenceOhlcBarsWidgetProps>({
  id: "main-sequence-ohlc-bars",
  widgetVersion: "1.1.2",
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
        id: TABULAR_SEED_INPUT_ID,
        label: "Seed data",
        accepts: [MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT],
        acceptedOutputIds: [DATA_NODE_SOURCE_OUTPUT_ID],
        required: false,
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
      {
        id: TABULAR_LIVE_UPDATES_INPUT_ID,
        label: "Live updates",
        accepts: [MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT],
        acceptedOutputIds: [TABULAR_UPDATES_OUTPUT_ID],
        required: false,
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
  buildAgentSnapshot: ({ props, resolvedInputs }) => {
    const incrementalFrame = resolveIncrementalTabularOutputFrame({ resolvedInputs });
    const sourceInput = resolvedInputs?.[DATA_NODE_SOURCE_INPUT_ID];
    const sourceValue =
      incrementalFrame ??
      (sourceInput && !Array.isArray(sourceInput) && sourceInput.status === "valid"
        ? sourceInput.value
        : null);
    const dataset =
      sourceValue && typeof sourceValue === "object" && !Array.isArray(sourceValue)
        ? sourceValue as {
            status?: unknown;
            columns?: unknown;
            fields?: unknown;
            rows?: unknown;
          }
        : null;
    const rows = Array.isArray(dataset?.rows) ? dataset.rows : [];
    const fieldOptions = buildOhlcBarsFieldOptionsFromRuntime(
      dataset
        ? {
            columns: Array.isArray(dataset.columns) ? (dataset.columns as string[]) : [],
            fields: Array.isArray(dataset.fields) ? (dataset.fields as never[]) : [],
            rows: rows as never[],
          }
        : null,
    );
    const config = resolveOhlcBarsConfig(props, undefined, fieldOptions);
    const series = buildOhlcBarsSeries(rows as never[], config);
    const status = typeof dataset?.status === "string" ? dataset.status : "idle";

    return {
      displayKind: "chart",
      state:
        status === "error"
          ? "error"
          : status === "loading"
            ? "loading"
            : series.points.length > 0
              ? "ready"
              : "empty",
      summary:
        series.points.length > 0
          ? `${series.points.length.toLocaleString()} OHLC bars rendered.`
          : "OHLC Bars is waiting for a bound market dataset.",
      data: {
        widgetRole: "presentation",
        contentType: "chart",
        chartType: "ohlc-bars",
        sourceStatus: status,
        rowCount: rows.length,
        pointCount: series.points.length,
        invalidRowCount: series.invalidRowCount,
        filteredRowCount: series.filteredRowCount,
        collapsedPointCount: series.collapsedPointCount,
        volumePointCount: series.volumePointCount,
        fields: {
          timeField: config.timeField ?? null,
          openField: config.openField ?? null,
          highField: config.highField ?? null,
          lowField: config.lowField ?? null,
          closeField: config.closeField ?? null,
          volumeField: config.volumeField ?? null,
          seriesFilterField: config.seriesFilterField ?? null,
          seriesFilterValue: config.seriesFilterValue ?? null,
        },
        studies: config.studies,
        points: series.points.slice(0, 200).map((point) => ({
          timeMs: point.timeMs,
          open: point.open,
          high: point.high,
          low: point.low,
          close: point.close,
          volume: point.volume ?? null,
        })),
      },
    };
  },
  registryContract: {
    configuration: {
      mode: "static-schema",
      summary:
        "Maps a bound tabular market dataset into OHLC bars using time, open, high, low, and close fields.",
      requiredSetupSteps: [
        "Bind the widget to seedData for a retained bootstrap dataset and optionally liveUpdates for incremental updates.",
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
        "seedData accepts retained dataset outputs and establishes the historical baseline for the chart.",
        "liveUpdates accepts only explicit incremental updates outputs and unions those live rows onto the seeded baseline.",
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
