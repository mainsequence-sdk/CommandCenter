import { Table } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import {
  isEmptyTabularFrameSource,
  TABULAR_SOURCE_CONTRACT,
} from "@/widgets/shared/tabular-widget-source";
import {
  CORE_TIME_SERIES_FRAME_SOURCE_CONTRACT,
} from "@/widgets/shared/timeseries-frame-source";
import { TABULAR_SOURCE_INPUT_ID } from "@/widgets/shared/tabular-widget-source";
import { TableWidget } from "./TableWidget";
import { TableWidgetSettings } from "./TableWidgetSettings";
import {
  type TableWidgetCellValue,
  buildTableWidgetRowObjects,
  resolveTableWidgetSourceDataset,
  tableWidgetDefaultProps,
  resolveTableWidgetColumns,
  resolveTableWidgetPropsWithFrame,
  type TableWidgetProps,
} from "./tableModel";

export const tableWidget = defineWidget<TableWidgetProps>({
  id: "table",
  widgetVersion: "2.1.0",
  title: "Table",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Core",
  kind: "table",
  source: "core",
  requiredPermissions: ["workspaces:view"],
  tags: ["tabular", "grid", "ag-grid", "formatter", "table"],
  exampleProps: tableWidgetDefaultProps,
  mockProps: {
    ...tableWidgetDefaultProps,
    tableSourceMode: "manual",
    manualColumns: [
      { key: "name", type: "string" },
      { key: "value", type: "number" },
      { key: "status", type: "string" },
    ],
    manualRows: [
      { name: "Alpha", value: "42", status: "Ready" },
      { name: "Beta", value: "17", status: "Watch" },
    ],
  },
  io: {
    inputs: [
      {
        id: TABULAR_SOURCE_INPUT_ID,
        label: "Source data",
        accepts: [TABULAR_SOURCE_CONTRACT, CORE_TIME_SERIES_FRAME_SOURCE_CONTRACT],
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
    ],
  },
  workspaceRuntimeMode: "consumer",
  workspaceIcon: Table,
  buildAgentSnapshot: ({ props, resolvedInputs, snapshotProfile }) => {
    const resolvedSourceDataset = resolveTableWidgetSourceDataset(resolvedInputs);
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
        sourceStatus,
        rowCount: sourceDataset?.rows.length ?? resolvedRows.length,
        visibleColumns: resolvedColumns.map((column) => ({
          key: column.key,
          label: column.label,
          format: column.format,
        })),
        rows: (
          snapshotProfile === "full-data"
            ? (sourceDataset?.rows ?? resolvedRows)
            : (sourceDataset?.rows ?? resolvedRows).slice(0, 25)
        ).map((row) =>
          Object.fromEntries(
            resolvedColumns.map((column) => [column.key, row[column.key] ?? null]),
          ),
        ),
        pagination: resolvedProps.pagination,
        pageSize: resolvedProps.pageSize,
        density: resolvedProps.density,
        showSearch: resolvedProps.showSearch,
        zebraRows: resolvedProps.zebraRows,
      },
    };
  },
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Formats either a bound tabular or time-series dataset, or a manually authored table, into a user-facing table with saved field formatting and visibility preferences.",
      requiredSetupSteps: [
        "Choose Bound dataset or Manual table in settings.",
        "For Bound dataset, bind the widget to one upstream tabular or time-series dataset.",
        "For Manual table, add columns and rows in the table editor.",
        "Adjust visible fields and formatting options in settings.",
      ],
    },
    runtime: {
      refreshPolicy: "not-applicable",
      executionTriggers: [],
      executionSummary:
        "Consumes the canonical upstream dataset bundle when bound, or renders saved manual rows directly, without publishing a new dataset.",
    },
    io: {
      mode: "consumer",
      summary: "Consumes one tabular or time-series frame and renders its rows as a table.",
      ioNotes: [
        "The sourceData input is optional because manual table mode stores rows on this table widget.",
        "The widget does not publish a new canonical runtime contract.",
      ],
    },
    capabilities: {
      acceptedContracts: [TABULAR_SOURCE_CONTRACT, CORE_TIME_SERIES_FRAME_SOURCE_CONTRACT],
      supportedSourceModes: ["bound", "manual"],
      renderingSurface: "table",
      columnConfiguration: [
        "visibility",
        "key",
        "label",
        "description",
        "format",
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
        "search",
        "zebraRows",
        "pagination",
        "pageSize",
        "density",
      ],
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  settingsComponent: TableWidgetSettings,
  component: TableWidget,
});
