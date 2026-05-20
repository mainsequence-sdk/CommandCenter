import { Search } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  TABULAR_FRAME_SOURCE_VALUE_DESCRIPTOR,
} from "@/widgets/shared/tabular-frame-source";
import { CORE_VALUE_JSON_CONTRACT } from "@/widgets/shared/value-contracts";
import {
  defineWidget,
  type WidgetIoDefinition,
  type WidgetInputPortDefinition,
  type WidgetObjectValueDescriptor,
  type WidgetOutputResolverArgs,
} from "@/widgets/types";

import {
  buildMarketAssetFrameSemanticMeta,
  buildMarketTableFrameMeta,
  MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
  MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID,
  MARKET_ASSET_SCREENER_SEED_INPUT_ID,
  MARKET_ASSET_SCREENER_INPUT_CONTRACTS,
} from "../../widget-contracts/marketAssetFrames";
import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import {
  AssetScreenerWidget,
  resolveAssetScreenerActiveCellOutput,
  resolveAssetScreenerActiveCellValueOutput,
  resolveAssetScreenerActiveRowOutput,
  resolveAssetScreenerSelectedCellValuesOutput,
  resolveAssetScreenerSelectedRowsOutput,
} from "./AssetScreenerWidget";
import { AssetScreenerWidgetSettings } from "./AssetScreenerWidgetSettings";
import {
  assetScreenerDefaultProps,
  buildAssetScreenerActiveRowValueDescriptor,
  resolveAssetScreenerState,
  type MainSequenceAssetScreenerWidgetProps,
} from "./assetScreenerModel";
import {
  TABLE_WIDGET_ACTIVE_CELL_OUTPUT_ID,
  TABLE_WIDGET_ACTIVE_CELL_VALUE_OUTPUT_ID,
  TABLE_WIDGET_ACTIVE_ROW_OUTPUT_ID,
  TABLE_WIDGET_SELECTED_CELL_VALUES_OUTPUT_ID,
  TABLE_WIDGET_SELECTED_ROWS_OUTPUT_ID,
} from "@/widgets/core/table/tableModel";

const datasetOutputId = "dataset";
const updatesOutputId = "updates";
const screenerJsonValueDescriptor = {
  kind: "unknown",
  contract: CORE_VALUE_JSON_CONTRACT,
  description: "JSON value derived from asset screener interaction runtime state.",
} as const;
const screenerJsonValueArrayDescriptor = {
  kind: "array",
  contract: CORE_VALUE_JSON_CONTRACT,
  description: "JSON list derived from asset screener interaction runtime state.",
  items: screenerJsonValueDescriptor,
} as const;

const assetScreenerInputs: WidgetInputPortDefinition<MainSequenceAssetScreenerWidgetProps>[] = [
  {
    id: MARKET_ASSET_SCREENER_SEED_INPUT_ID,
    label: "Seed data",
    accepts: [...MARKET_ASSET_SCREENER_INPUT_CONTRACTS],
    acceptedOutputIds: [datasetOutputId],
    required: false,
    description: "Latest/current snapshot used to initialize the screener.",
    effects: [
      {
        kind: "drives-render",
        sourcePath: "rows",
        target: { kind: "render", id: "asset-screener" },
        description: "Snapshot rows initialize latest asset state.",
      },
    ],
  },
  {
    id: MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID,
    label: "Live updates",
    accepts: [...MARKET_ASSET_SCREENER_INPUT_CONTRACTS],
    acceptedOutputIds: [updatesOutputId],
    required: false,
    description: "Incremental latest updates that recalculate columns against seeded references.",
    effects: [
      {
        kind: "drives-render",
        sourcePath: "rows",
        target: { kind: "render", id: "asset-screener" },
        description: "Live rows update latest asset state without mutating references.",
      },
    ],
  },
] ;

function buildAssetScreenerIo(props: MainSequenceAssetScreenerWidgetProps) {
  const activeRowDescriptor = buildAssetScreenerActiveRowValueDescriptor(props);
  const activeCellDescriptor = {
    kind: "object",
    contract: CORE_VALUE_JSON_CONTRACT,
    description: "Selected asset screener cell.",
    fields: [
      {
        key: "rowKey",
        label: "Row key",
        value: {
          kind: "primitive",
          contract: "core.value.string@v1",
          primitive: "string",
          description: "Stable row selection key.",
        },
      },
      {
        key: "rowIndex",
        label: "Row index",
        value: {
          kind: "primitive",
          contract: "core.value.integer@v1",
          primitive: "integer",
          description: "Active row index inside the current screener rows.",
        },
      },
      {
        key: "columnKey",
        label: "Column key",
        value: {
          kind: "primitive",
          contract: "core.value.string@v1",
          primitive: "string",
          description: "Active column key.",
        },
      },
      {
        key: "value",
        label: "Value",
        value: screenerJsonValueDescriptor,
      },
      {
        key: "row",
        label: "Row",
        value: activeRowDescriptor,
      },
    ],
  } satisfies WidgetObjectValueDescriptor;

  const resolveSelectedRows = ({
    props,
    resolvedInputs,
    runtimeState,
    runtimeDataStore,
  }: WidgetOutputResolverArgs<MainSequenceAssetScreenerWidgetProps>) =>
    resolveAssetScreenerSelectedRowsOutput({
      props,
      resolvedInputs,
      runtimeState,
      runtimeDataStore,
    });
  const resolveActiveRow = ({
    props,
    resolvedInputs,
    runtimeState,
    runtimeDataStore,
  }: WidgetOutputResolverArgs<MainSequenceAssetScreenerWidgetProps>) =>
    resolveAssetScreenerActiveRowOutput({
      props,
      resolvedInputs,
      runtimeState,
      runtimeDataStore,
    });
  const resolveActiveCell = ({
    props,
    resolvedInputs,
    runtimeState,
    runtimeDataStore,
  }: WidgetOutputResolverArgs<MainSequenceAssetScreenerWidgetProps>) =>
    resolveAssetScreenerActiveCellOutput({
      props,
      resolvedInputs,
      runtimeState,
      runtimeDataStore,
    });
  const resolveActiveCellValue = ({
    props,
    resolvedInputs,
    runtimeState,
    runtimeDataStore,
  }: WidgetOutputResolverArgs<MainSequenceAssetScreenerWidgetProps>) =>
    resolveAssetScreenerActiveCellValueOutput({
      props,
      resolvedInputs,
      runtimeState,
      runtimeDataStore,
    });
  const resolveSelectedCellValues = ({
    props,
    resolvedInputs,
    runtimeState,
    runtimeDataStore,
  }: WidgetOutputResolverArgs<MainSequenceAssetScreenerWidgetProps>) =>
    resolveAssetScreenerSelectedCellValuesOutput({
      props,
      resolvedInputs,
      runtimeState,
      runtimeDataStore,
    });

  return {
    inputs: assetScreenerInputs,
    outputs: [
      {
        id: TABLE_WIDGET_SELECTED_ROWS_OUTPUT_ID,
        label: "Selected rows",
        contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        description:
          "Publishes the current asset screener rows selected by the user.",
        valueDescriptor: TABULAR_FRAME_SOURCE_VALUE_DESCRIPTOR,
        resolveValue: resolveSelectedRows,
      },
      {
        id: TABLE_WIDGET_ACTIVE_ROW_OUTPUT_ID,
        label: "Active row",
        contract: CORE_VALUE_JSON_CONTRACT,
        description:
          "Publishes the current active asset row selected in the screener, or null.",
        valueDescriptor: activeRowDescriptor,
        resolveValue: resolveActiveRow,
      },
      {
        id: TABLE_WIDGET_ACTIVE_CELL_OUTPUT_ID,
        label: "Active cell",
        contract: CORE_VALUE_JSON_CONTRACT,
        description:
          "Publishes the current active screener cell with row index, column key, value, and row payload.",
        valueDescriptor: activeCellDescriptor,
        resolveValue: resolveActiveCell,
      },
      {
        id: TABLE_WIDGET_ACTIVE_CELL_VALUE_OUTPUT_ID,
        label: "Active cell value",
        contract: CORE_VALUE_JSON_CONTRACT,
        description:
          "Publishes the current active screener cell value, or null when no cell is active.",
        valueDescriptor: screenerJsonValueDescriptor,
        resolveValue: resolveActiveCellValue,
      },
      {
        id: TABLE_WIDGET_SELECTED_CELL_VALUES_OUTPUT_ID,
        label: "Selected cell values",
        contract: CORE_VALUE_JSON_CONTRACT,
        description:
          "Publishes the current selected screener cell values as an ordered JSON list.",
        valueDescriptor: screenerJsonValueArrayDescriptor,
        resolveValue: resolveSelectedCellValues,
      },
    ],
  } satisfies WidgetIoDefinition<MainSequenceAssetScreenerWidgetProps>;
}

const mockSeedData = {
  status: "ready",
  columns: [
    "unique_identifier",
    "Symbol",
    "display_name",
    "sector",
    "time",
    "last_price",
    "previous_close",
    "one_month_ago",
    "year_start",
    "one_year_ago",
    "volume",
    "price_sparkline",
  ],
  rows: [
    {
      unique_identifier: "uid:AAPL",
      Symbol: "AAPL",
      display_name: "Apple Inc.",
      sector: "Technology",
      time: "2026-05-16T13:00:00.000Z",
      last_price: 110,
      previous_close: 100,
      one_month_ago: 96,
      year_start: 88,
      one_year_ago: 82,
      volume: 42_000_000,
      price_sparkline: "101,104,106,108,107,110",
    },
    {
      unique_identifier: "uid:MSFT",
      Symbol: "MSFT",
      display_name: "Microsoft Corp.",
      sector: "Technology",
      time: "2026-05-16T13:00:00.000Z",
      last_price: 204,
      previous_close: 210,
      one_month_ago: 190,
      year_start: 178,
      one_year_ago: 165,
      volume: 31_000_000,
      price_sparkline: "196,199,201,205,202,204",
    },
    {
      unique_identifier: "uid:JPM",
      Symbol: "JPM",
      display_name: "JPMorgan Chase",
      sector: "Financials",
      time: "2026-05-16T13:00:00.000Z",
      last_price: 158,
      previous_close: 151,
      one_month_ago: 149,
      year_start: 141,
      one_year_ago: 137,
      volume: 12_000_000,
      price_sparkline: "151,153,156,155,157,158",
    },
  ],
  meta: {
    ...buildMarketAssetFrameSemanticMeta({
      role: MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
      fieldRoles: [
        { field: "unique_identifier", role: "assetKey" },
        { field: "Symbol", role: "symbol" },
        { field: "display_name", role: "displayName" },
        { field: "sector", role: "sector" },
        { field: "time", role: "observedAt" },
        { field: "last_price", role: "value", valueKey: "price" },
        { field: "volume", role: "value", valueKey: "volume" },
        { field: "previous_close", role: "referenceValue", referenceKey: "previousClose", valueKey: "price" },
        { field: "one_month_ago", role: "referenceValue", referenceKey: "oneMonthAgo", valueKey: "price" },
        { field: "year_start", role: "referenceValue", referenceKey: "yearStart", valueKey: "price" },
        { field: "one_year_ago", role: "referenceValue", referenceKey: "oneYearAgo", valueKey: "price" },
        { field: "price_sparkline", role: "sparklineSeries", valueKey: "price", encoding: "csv-number" },
        { field: "one_day_return", role: "value", valueKey: "oneDayReturn" },
        { field: "one_month_return", role: "value", valueKey: "oneMonthReturn" },
        { field: "ytd_return", role: "value", valueKey: "ytdReturn" },
        { field: "one_year_return", role: "value", valueKey: "oneYearReturn" },
      ],
    }),
    ...buildMarketTableFrameMeta({
      tableTransforms: {
        computedColumns: [
          {
            id: "one_day_return",
            label: "1D",
            type: "number",
            expression: {
              op: "percentChange",
              current: { field: "last_price" },
              reference: { field: "previous_close" },
            },
          },
          {
            id: "one_month_return",
            label: "1M",
            type: "number",
            expression: {
              op: "percentChange",
              current: { field: "last_price" },
              reference: { field: "one_month_ago" },
            },
          },
          {
            id: "ytd_return",
            label: "YTD",
            type: "number",
            expression: {
              op: "percentChange",
              current: { field: "last_price" },
              reference: { field: "year_start" },
            },
          },
          {
            id: "one_year_return",
            label: "1Y",
            type: "number",
            expression: {
              op: "percentChange",
              current: { field: "last_price" },
              reference: { field: "one_year_ago" },
            },
          },
        ],
      },
      tableVisuals: {
        columns: {
          last_price: {
            format: "price",
          },
          one_day_return: {
            format: "percent",
            thresholds: [
              { operator: "lt", value: 0, tone: "warning" },
              { operator: "eq", value: 0, tone: "neutral" },
              { operator: "gt", value: 0, tone: "success" },
            ],
            heatmap: true,
            gradientMode: "fill",
            visualRangeMode: "fixed",
            visualMin: -10,
            visualMax: 10,
          },
          one_month_return: {
            format: "percent",
            thresholds: [
              { operator: "lt", value: 0, tone: "warning" },
              { operator: "eq", value: 0, tone: "neutral" },
              { operator: "gt", value: 0, tone: "success" },
            ],
          },
          ytd_return: {
            format: "percent",
            thresholds: [
              { operator: "lt", value: 0, tone: "warning" },
              { operator: "eq", value: 0, tone: "neutral" },
              { operator: "gt", value: 0, tone: "success" },
            ],
          },
          one_year_return: {
            format: "percent",
            thresholds: [
              { operator: "lt", value: 0, tone: "warning" },
              { operator: "eq", value: 0, tone: "neutral" },
              { operator: "gt", value: 0, tone: "success" },
            ],
          },
          price_sparkline: {
            kind: "sparkline",
            encoding: "csv-number",
            order: "oldest-to-newest",
          },
        },
      },
    }),
  },
  source: {
    kind: "mock-market-snapshot",
    updatedAtMs: 1_779_000_000_000,
  },
};

export const mainSequenceAssetScreenerWidget = defineWidget<MainSequenceAssetScreenerWidgetProps>({
  id: "ms-markets-asset-screener",
  widgetVersion: "1.11.0",
  title: "Asset Screener",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Main Sequence Markets",
  kind: "table",
  source: "main_sequence_markets",
  requiredPermissions: ["main_sequence_markets:view"],
  tags: ["main-sequence", "markets", "asset", "screener", "terminal", "table", "live"],
  defaultSize: { w: 14, h: 8 },
  exampleProps: assetScreenerDefaultProps,
  mockProps: assetScreenerDefaultProps,
  mockRuntimeState: {
    marketAssetScreenerDemoFrames: {
      seedData: mockSeedData,
    },
  },
  io: buildAssetScreenerIo(assetScreenerDefaultProps),
  resolveIo: ({ props }) => buildAssetScreenerIo(props as MainSequenceAssetScreenerWidgetProps),
  workspaceRuntimeMode: "consumer",
  workspaceIcon: Search,
  railIcon: Search,
  settingsComponent: AssetScreenerWidgetSettings,
  settingsSchemaPlacement: "custom",
  buildAgentSnapshot: ({ props, resolvedInputs, runtimeState, runtimeDataStore }) => {
    const state = resolveAssetScreenerState({
      props,
      resolvedInputs,
      runtimeDataStore,
      fallbackFrames: runtimeState?.marketAssetScreenerDemoFrames as never,
    });

    return {
      displayKind: "table",
      state: state.filteredRows.length > 0 ? "ready" : state.hasAnyBinding ? "empty" : "idle",
      summary: state.filteredRows.length > 0
        ? `${state.filteredRows.length.toLocaleString()} assets rendered with ${state.columns.length} configured columns.`
        : "Asset Screener is waiting for a seedData binding.",
      data: {
        widgetRole: "presentation",
        contentType: "market-asset-screener",
        rowCount: state.filteredRows.length,
        columnConfigSource: state.columnConfigSource,
        columns: state.columns.map((column) => ({
          id: column.id,
          label: column.label,
          kind: column.kind,
        })),
        rows: state.filteredRows.slice(0, 25).map((row) => ({
          asset: row.asset,
          metrics: row.metrics,
          status: row.status,
        })),
      },
    };
  },
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Configures a dense market asset screener from a semantic seed snapshot plus optional live updates.",
      requiredSetupSteps: [
        "Bind the full semantic snapshot to seedData, or click Add connection to create a hidden managed source.",
        "Put referenceValue and sparklineSeries fields in seedData metadata.",
        "Optionally bind WebSocket or incremental latest rows to liveUpdates.",
      ],
      configurationNotes: [
        "Generic tabular frames can use explicit field mappings or meta.marketAsset field roles.",
        "Row-local meta.tableTransforms can compute derived value keys before market semantic adaptation.",
        "Columns are dynamic view config over stable value keys such as price, volume, or marketCap.",
        "Managed connection mode still uses generic connection-query or connection-stream-query widgets; it does not create a market-specific connection contract.",
      ],
    },
    runtime: {
      refreshPolicy: "not-applicable",
      executionTriggers: [],
      executionSummary:
        "Consumes bound or hidden managed source data and derives rows locally; connection-query and connection-stream-query remain the request/WebSocket owners.",
    },
    io: {
      mode: "consumer",
      summary:
        "Consumes seedData and optional liveUpdates to derive latest values, return columns, sparkline columns, and runtime interaction outputs.",
      inputContracts: [...MARKET_ASSET_SCREENER_INPUT_CONTRACTS],
      ioNotes: [
        "seedData initializes latest state and carries referenceValue or sparklineSeries fields.",
        "liveUpdates mutates latest state only.",
        "Selection outputs are published from screener runtime state and stay keyed to canonical asset identity.",
      ],
    },
    capabilities: {
      supportsDynamicColumns: true,
      supportsHistorySeries: true,
      supportsLiveUpdates: true,
      supportsManagedConnectionSource: true,
      supportsReferencePoints: true,
      supportedSourceModes: ["bound", "connection", "connection-stream"],
      supportsVirtualizedRows: true,
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  component: AssetScreenerWidget,
});
