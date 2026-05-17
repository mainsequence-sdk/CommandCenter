import { Table } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  TABULAR_FRAME_SOURCE_VALUE_DESCRIPTOR,
} from "@/widgets/shared/tabular-frame-source";
import { CORE_VALUE_JSON_CONTRACT } from "@/widgets/shared/value-contracts";
import { defineWidget } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import {
  TABULAR_LIVE_UPDATES_INPUT_ID,
  TABULAR_SEED_INPUT_ID,
  TABULAR_UPDATES_OUTPUT_ID,
} from "@/widgets/shared/incremental-tabular-consumer";
import {
  isEmptyTabularFrameSource,
  TABULAR_SOURCE_CONTRACT,
  TABULAR_SOURCE_OUTPUT_ID,
} from "@/widgets/shared/tabular-widget-source";
import { TableWidget } from "./TableWidget";
import { TableWidgetSettings } from "./TableWidgetSettings";
import {
  TABLE_WIDGET_DATASET_OUTPUT_ID,
  TABLE_WIDGET_ACTIVE_CELL_OUTPUT_ID,
  TABLE_WIDGET_ACTIVE_CELL_VALUE_OUTPUT_ID,
  TABLE_WIDGET_ACTIVE_ROW_OUTPUT_ID,
  TABLE_WIDGET_SELECTED_ROWS_OUTPUT_ID,
  type TableWidgetCellValue,
  buildTableWidgetRowObjects,
  resolveTableWidgetActiveCellOutput,
  resolveTableWidgetActiveCellValueOutput,
  resolveTableWidgetActiveRowOutput,
  resolveTableWidgetOutput,
  resolveTableWidgetSelectedRowsOutput,
  resolveTableWidgetSourceDataset,
  tableWidgetDefaultProps,
  resolveTableWidgetColumns,
  resolveTableWidgetPropsWithFrame,
  type TableWidgetProps,
} from "./tableModel";

const TABLE_WIDGET_JSON_VALUE_DESCRIPTOR = {
  kind: "unknown",
  contract: CORE_VALUE_JSON_CONTRACT,
  description: "JSON value derived from table interaction runtime state.",
} as const;

export const tableWidget = defineWidget<TableWidgetProps>({
  id: "table",
  widgetVersion: "3.1.0",
  title: "Table",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Core",
  kind: "table",
  source: "core",
  requiredPermissions: ["workspaces:view"],
  tags: ["tabular", "grid", "ag-grid", "formatter", "table", "selection"],
  exampleProps: tableWidgetDefaultProps,
  mockProps: {
    ...tableWidgetDefaultProps,
    tableSourceMode: "manual",
    manualColumns: [
      { key: "name", type: "string" },
      { key: "value", type: "number" },
      { key: "status", type: "string" },
      { key: "updatedAt", type: "datetime" },
    ],
    manualRows: [
      { name: "Alpha", value: "42", status: "Ready", updatedAt: "2026-04-26T10:21:02.203Z" },
      { name: "Beta", value: "17", status: "Watch", updatedAt: "2026-04-26T10:26:31.000Z" },
    ],
  },
  io: {
    inputs: [
      {
        id: TABULAR_SEED_INPUT_ID,
        label: "Seed data",
        accepts: [TABULAR_SOURCE_CONTRACT],
        acceptedOutputIds: [TABULAR_SOURCE_OUTPUT_ID],
        required: false,
        effects: [
          {
            kind: "drives-render",
            sourcePath: "rows",
            target: { kind: "render", id: "table" },
            description: "Incoming rows drive the rendered table frame.",
          },
          {
            kind: "drives-options",
            sourcePath: "fields",
            target: { kind: "render", id: "schema" },
            description: "Upstream fields define the table schema and formatter choices.",
          },
        ],
      },
      {
        id: TABULAR_LIVE_UPDATES_INPUT_ID,
        label: "Live updates",
        accepts: [TABULAR_SOURCE_CONTRACT],
        acceptedOutputIds: [TABULAR_UPDATES_OUTPUT_ID],
        required: false,
        effects: [
          {
            kind: "drives-render",
            sourcePath: "rows",
            target: { kind: "render", id: "table" },
            description: "Incoming incremental rows update the rendered table frame.",
          },
          {
            kind: "drives-options",
            sourcePath: "fields",
            target: { kind: "render", id: "schema" },
            description: "Incremental source fields define the table schema and formatter choices.",
          },
        ],
      },
    ],
    outputs: [
      {
        id: TABLE_WIDGET_DATASET_OUTPUT_ID,
        label: "Dataset",
        contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        description:
          "Publishes the table's canonical tabular dataset so downstream widgets can consume either a bound or manual table source.",
        valueDescriptor: TABULAR_FRAME_SOURCE_VALUE_DESCRIPTOR,
        resolveValue: ({ props, resolvedInputs, runtimeState, runtimeDataStore }) =>
          resolveTableWidgetOutput(
            props as TableWidgetProps,
            resolvedInputs,
            runtimeState,
            runtimeDataStore,
          ),
      },
      {
        id: TABLE_WIDGET_SELECTED_ROWS_OUTPUT_ID,
        label: "Selected rows",
        contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        description:
          "Publishes the current table frame filtered to the rows selected by the user.",
        valueDescriptor: TABULAR_FRAME_SOURCE_VALUE_DESCRIPTOR,
        resolveValue: ({ props, resolvedInputs, runtimeState, runtimeDataStore }) =>
          resolveTableWidgetSelectedRowsOutput(
            props as TableWidgetProps,
            resolvedInputs,
            runtimeState,
            runtimeDataStore,
          ),
      },
      {
        id: TABLE_WIDGET_ACTIVE_ROW_OUTPUT_ID,
        label: "Active row",
        contract: CORE_VALUE_JSON_CONTRACT,
        description:
          "Publishes the current active row object selected in the table, or null.",
        valueDescriptor: TABLE_WIDGET_JSON_VALUE_DESCRIPTOR,
        resolveValue: ({ props, resolvedInputs, runtimeState, runtimeDataStore }) =>
          resolveTableWidgetActiveRowOutput(
            props as TableWidgetProps,
            resolvedInputs,
            runtimeState,
            runtimeDataStore,
          ),
      },
      {
        id: TABLE_WIDGET_ACTIVE_CELL_OUTPUT_ID,
        label: "Active cell",
        contract: CORE_VALUE_JSON_CONTRACT,
        description:
          "Publishes the current active cell with row index, column key, value, and row payload.",
        valueDescriptor: TABLE_WIDGET_JSON_VALUE_DESCRIPTOR,
        resolveValue: ({ props, resolvedInputs, runtimeState, runtimeDataStore }) =>
          resolveTableWidgetActiveCellOutput(
            props as TableWidgetProps,
            resolvedInputs,
            runtimeState,
            runtimeDataStore,
          ),
      },
      {
        id: TABLE_WIDGET_ACTIVE_CELL_VALUE_OUTPUT_ID,
        label: "Active cell value",
        contract: CORE_VALUE_JSON_CONTRACT,
        description:
          "Publishes the current active cell value, or null when no cell is active.",
        valueDescriptor: TABLE_WIDGET_JSON_VALUE_DESCRIPTOR,
        resolveValue: ({ props, resolvedInputs, runtimeState, runtimeDataStore }) =>
          resolveTableWidgetActiveCellValueOutput(
            props as TableWidgetProps,
            resolvedInputs,
            runtimeState,
            runtimeDataStore,
          ),
      },
    ],
  },
  workspaceRuntimeMode: "consumer",
  workspaceIcon: Table,
  buildAgentSnapshot: ({ props, resolvedInputs, runtimeState, runtimeDataStore }) => {
    const resolvedSourceDataset = resolveTableWidgetSourceDataset(
      resolvedInputs,
      runtimeState,
      runtimeDataStore,
    );
    const sourceDataset =
      resolvedSourceDataset && !isEmptyTabularFrameSource(resolvedSourceDataset)
        ? resolvedSourceDataset
        : null;
    const resolvedProps = resolveTableWidgetPropsWithFrame(props, sourceDataset
      ? {
          columns: sourceDataset.columns,
          rows: sourceDataset.rows.map((row) =>
            sourceDataset.columns.map<TableWidgetCellValue>((columnKey) => {
              const value = row[columnKey];

              if (
                typeof value === "number" ||
                typeof value === "string" ||
                typeof value === "boolean" ||
                value === null ||
                value === undefined
              ) {
                return value ?? null;
              }

              return JSON.stringify(value);
            }),
          ),
          schemaFallback:
            sourceDataset.fields?.map((field) => ({
              key: field.key,
              label: field.label ?? field.key,
              description: field.description ?? undefined,
              format: "text",
            })) ?? [],
          supportsUniqueIdentifierList: Boolean(sourceDataset.source?.context?.uniqueIdentifierList),
          sourceLabel: sourceDataset.source?.label,
        }
      : null);
    const resolvedColumns = resolveTableWidgetColumns(resolvedProps).filter(
      (column) => column.visible,
    );
    const resolvedRows = buildTableWidgetRowObjects(
      resolvedProps.columns,
      resolvedProps.rows,
    );
    const hasManualSource = resolvedProps.tableSourceMode === "manual";
    const sourceStatus = sourceDataset?.status ?? (hasManualSource ? "ready" : "idle");

    return {
      displayKind: "table",
      state: sourceDataset
        ? sourceDataset.status === "error"
          ? "error"
          : sourceDataset.status === "loading"
            ? "loading"
            : sourceDataset.rows.length > 0
            ? "ready"
            : "empty"
        : hasManualSource
          ? resolvedProps.columns.length === 0
            ? "idle"
            : resolvedRows.length > 0
              ? "ready"
              : "empty"
        : "idle",
      summary: sourceDataset
        ? `${sourceDataset.rows.length.toLocaleString()} rows across ${resolvedColumns.length.toLocaleString()} visible columns.`
        : hasManualSource
          ? `${resolvedRows.length.toLocaleString()} manual rows across ${resolvedColumns.length.toLocaleString()} visible columns.`
        : "Table is waiting for a bound dataset.",
      data: {
        widgetRole: "presentation",
        contentType: "table",
        sourceStatus,
        rowCount: sourceDataset?.rows.length ?? resolvedRows.length,
        columnCount: resolvedColumns.length,
        columns: resolvedColumns.map((column) => ({
          key: column.key,
          label: column.label,
          format: column.format,
        })),
        rows: (sourceDataset?.rows ?? resolvedRows).slice(0, 25).map((row) =>
          Object.fromEntries(
            resolvedColumns.map((column) => [column.key, row[column.key] ?? null]),
          ),
        ),
        tableOptions: {
          pagination: resolvedProps.pagination,
          pageSize: resolvedProps.pageSize,
          density: resolvedProps.density,
          showSearch: resolvedProps.showSearch,
          showColumnFilters: resolvedProps.showColumnFilters,
          zebraRows: resolvedProps.zebraRows,
        },
      },
    };
  },
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Formats a bound tabular dataset, a widget-owned hidden connection or stream source, or a manually authored table into a user-facing table with saved field formatting and visibility preferences.",
      requiredSetupSteps: [
        "Choose Bound dataset, Connection query, Stream connection, or Manual table in settings.",
        "For Bound dataset, bind the widget to one upstream tabular dataset.",
        "For Connection query or Stream connection, use Bindings -> Add connection and configure the Connection tab.",
        "For Manual table, add columns and rows in the table editor.",
        "Adjust visible fields and formatting options in settings.",
      ],
    },
    runtime: {
      refreshPolicy: "not-applicable",
      executionTriggers: [],
      executionSummary:
        "Consumes the canonical upstream dataset bundle when bound, or materializes saved manual rows directly, and republishes one canonical tabular frame for downstream widgets without owning execution.",
    },
    io: {
      mode: "static",
      summary:
        "Consumes one canonical tabular frame and publishes the full dataset plus optional user selection outputs for downstream widgets.",
      inputContracts: [TABULAR_SOURCE_CONTRACT],
      outputContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT, CORE_VALUE_JSON_CONTRACT],
      ioNotes: [
        "seedData initializes or replaces the local table frame. liveUpdates applies incremental publications when bound.",
        "Display formatting, hidden columns, and value styling do not mutate the published dataset.",
        "selectedRows republishes the current frame filtered to the selected rows when selection mode is enabled.",
        "activeRow, activeCell, and activeCellValue publish JSON interaction state derived from the user's current table selection.",
      ],
    },
    capabilities: {
      acceptedContracts: [TABULAR_SOURCE_CONTRACT],
      publishesContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      supportedSourceModes: ["bound", "connection", "manual"],
      renderingSurface: "table",
      columnConfiguration: [
        "visibility",
        "key",
        "label",
        "description",
        "format",
        "datetimeInputFormat",
        "datetimeOutputFormat",
        "alignment",
        "pinning",
        "decimals",
        "prefix",
        "suffix",
        "compactNumbers",
      ],
      numericVisuals: [
        "heatmap",
        "heatmapPalette",
        "dataBar",
        "ringGauge",
        "autoBounds",
        "fixedBounds",
        "thresholdRules",
      ],
      categoricalDisplay: [
        "valueLabelMappings",
        "semanticTones",
        "customTextColor",
        "customFillColor",
      ],
      tableControls: [
        "toolbar",
        "quickFilter",
        "columnFilters",
        "zebraRows",
        "pagination",
        "pageSize",
        "density",
        "selectionMode",
        "stableSelectionKeys",
      ],
      interactionOutputs: [
        TABLE_WIDGET_SELECTED_ROWS_OUTPUT_ID,
        TABLE_WIDGET_ACTIVE_ROW_OUTPUT_ID,
        TABLE_WIDGET_ACTIVE_CELL_OUTPUT_ID,
        TABLE_WIDGET_ACTIVE_CELL_VALUE_OUTPUT_ID,
      ],
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  settingsComponent: TableWidgetSettings,
  component: TableWidget,
});
