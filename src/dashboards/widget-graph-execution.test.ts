import { describe, expect, it } from "vitest";

import type { DashboardWidgetInstance } from "@/dashboards/types";
import {
  WIDGET_REFERENCE_PROPS_OUTPUT_ID,
  buildWidgetReferencePropInputId,
} from "@/dashboards/widget-instance-references";
import {
  buildDashboardPassiveUpstreamResolutionKey,
  buildDashboardExecutionSnapshot,
  executeDashboardWidgetGraph,
  listDashboardDownstreamExecutionTargets,
  listDashboardWidgetExecutionOrder,
  listDashboardRefreshableExecutionTargets,
  planDashboardFiniteExecution,
  planDashboardRuntimeVariableDrivenCommit,
  planDashboardVariableDrivenCommit,
  resolveDashboardUpstreamRequirement,
} from "@/dashboards/widget-graph-execution";
import { TABULAR_SEED_INPUT_ID } from "@/widgets/shared/incremental-tabular-consumer";
import type { AnyManagedConnectionConsumerAdapter } from "@/widgets/shared/managed-connection-consumer";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";
import { CORE_VALUE_JSON_CONTRACT, CORE_VALUE_STRING_CONTRACT } from "@/widgets/shared/value-contracts";
import { defineWidget, type WidgetBindingTransformStep, type WidgetDefinition } from "@/widgets/types";
import {
  CORE_CONNECTION_QUERY_WIDGET_ID,
  CORE_CONNECTION_STREAM_QUERY_WIDGET_ID,
  CORE_GRAPH_WIDGET_ID,
  CORE_PRO_TABLE_WIDGET_ID,
  CORE_TABLE_WIDGET_ID,
  MAIN_SEQUENCE_MARKETS_ASSET_SCREENER_WIDGET_ID,
} from "@/widgets/widget-type-normalization";

const TEST_CONNECTION_TYPE_ID = "test.mock-api";
const TEST_CONNECTION_ID = 9001;
const TEST_QUERY_KIND = "test-query";

const testGraphManagedConnectionConsumerAdapter = {
  widgetId: CORE_GRAPH_WIDGET_ID,
  sourceInputId: TABULAR_SEED_INPUT_ID,
  sourceOutputId: "dataset",
  connectionMode: "connection",
  getSourceMode(props) {
    return typeof props.graphSourceMode === "string" ? props.graphSourceMode : "bound";
  },
  setSourceMode(props, mode) {
    return {
      ...props,
      graphSourceMode: mode,
    };
  },
  getEmbeddedConnectionQuery(props) {
    return (
      props.embeddedConnectionQuery &&
      typeof props.embeddedConnectionQuery === "object" &&
      !Array.isArray(props.embeddedConnectionQuery)
        ? props.embeddedConnectionQuery
        : {}
    ) as Record<string, unknown>;
  },
  setEmbeddedConnectionQuery(props, value) {
    return {
      ...props,
      embeddedConnectionQuery: value,
    };
  },
  getEmbeddedConnectionPresentation() {
    return undefined;
  },
  setEmbeddedConnectionPresentation(props) {
    return props;
  },
  buildManagedSourceTitle() {
    return "Graph Source";
  },
} satisfies AnyManagedConnectionConsumerAdapter;

const sourceWidget = defineWidget({
  id: "test-source",
  widgetVersion: "1.0.0",
  title: "Test Source",
  description: "Test executable source.",
  category: "Test",
  kind: "custom",
  source: "test",
  component: () => null,
  workspaceRuntimeMode: "execution-owner",
  io: {
    outputs: [
      {
        id: "dataset",
        label: "Dataset",
        contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        resolveValue: ({ runtimeState }) =>
          runtimeState ?? {
            status: "idle",
            columns: [],
            rows: [],
          },
      },
    ],
  },
  execution: {
    execute: async () => ({
      status: "success" as const,
      runtimeStatePatch: {
        status: "ready",
        columns: ["value"],
        rows: [{ value: 1 }],
      },
    }),
    getExecutionKey: (context) => `test-source:${context.instanceId}`,
  },
});

const waitingSourceWidget = defineWidget({
  id: "test-waiting-source",
  widgetVersion: "1.0.0",
  title: "Waiting Source",
  description: "Executable source that is waiting for upstream data.",
  category: "Test",
  kind: "custom",
  source: "test",
  component: () => null,
  workspaceRuntimeMode: "execution-owner",
  io: {
    outputs: [
      {
        id: "dataset",
        label: "Dataset",
        contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        resolveValue: ({ runtimeState }) =>
          runtimeState ?? {
            status: "idle",
            columns: [],
            rows: [],
          },
      },
    ],
  },
  execution: {
    getExecutionReadiness: () => ({
      status: "waiting",
      reason: "Waiting for seed dataset.",
    }),
    execute: async () => {
      throw new Error("Waiting source should not execute while it is waiting.");
    },
    getExecutionKey: (context) => `test-waiting-source:${context.instanceId}`,
  },
});

const errorSourceWidget = defineWidget({
  id: "test-error-source",
  widgetVersion: "1.0.0",
  title: "Error Source",
  description: "Executable source that fails for upstream-error propagation tests.",
  category: "Test",
  kind: "custom",
  source: "test",
  component: () => null,
  workspaceRuntimeMode: "execution-owner",
  io: {
    outputs: [
      {
        id: "dataset",
        label: "Dataset",
        contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        resolveValue: ({ runtimeState }) =>
          runtimeState ?? {
            status: "idle",
            columns: [],
            rows: [],
          },
      },
    ],
  },
  execution: {
    execute: async () => ({
      status: "error" as const,
      error: "Backend failed.",
    }),
    getExecutionKey: (context) => `test-error-source:${context.instanceId}`,
  },
});

const consumerWidget = defineWidget({
  id: "test-consumer",
  widgetVersion: "1.0.0",
  title: "Test Consumer",
  description: "Test passive consumer.",
  category: "Test",
  kind: "custom",
  source: "test",
  component: () => null,
  workspaceRuntimeMode: "consumer",
  io: {
    inputs: [
      {
        id: "sourceData",
        label: "Source data",
        accepts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
      },
    ],
  },
});

const variableSourceWidget = defineWidget({
  id: "test-variable-source",
  widgetVersion: "1.0.0",
  title: "Variable Source",
  description: "Source widget for variable-driven commit planning.",
  category: "Test",
  kind: "custom",
  source: "test",
  component: () => null,
  workspaceRuntimeMode: "consumer",
});

const variableConsumerWidget = defineWidget({
  id: "test-variable-consumer",
  widgetVersion: "1.0.0",
  title: "Variable Consumer",
  description: "Passive widget with a reference-backed prop output.",
  category: "Test",
  kind: "custom",
  source: "test",
  component: () => null,
  workspaceRuntimeMode: "consumer",
  io: {
    outputs: [
      {
        id: "selectedSymbol",
        label: "Selected symbol",
        contract: CORE_VALUE_STRING_CONTRACT,
        resolveValue: ({ props }) =>
          typeof props.symbol === "string" ? props.symbol : undefined,
      },
    ],
  },
});

const variableExecutionTargetWidget = defineWidget({
  id: "test-variable-execution-target",
  widgetVersion: "1.0.0",
  title: "Variable Execution Target",
  description: "Executable downstream consumer for variable-driven planning.",
  category: "Test",
  kind: "custom",
  source: "test",
  component: () => null,
  workspaceRuntimeMode: "execution-owner",
  io: {
    inputs: [
      {
        id: "symbol",
        label: "Symbol",
        accepts: [CORE_VALUE_STRING_CONTRACT],
      },
    ],
  },
  execution: {
    execute: async () => ({
      status: "success" as const,
      runtimeStatePatch: {
        status: "ready",
      },
    }),
    getExecutionKey: (context) => `variable-execution-target:${context.instanceId}`,
  },
});

const connectionQueryLikeWidget = defineWidget({
  id: CORE_CONNECTION_QUERY_WIDGET_ID,
  widgetVersion: "1.0.0",
  title: "Connection Query",
  description: "Connection-query compatible executable source for graph tests.",
  category: "Test",
  kind: "custom",
  source: "test",
  component: () => null,
  workspaceRuntimeMode: "execution-owner",
  io: {
    outputs: [
      {
        id: "dataset",
        label: "Dataset",
        contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        resolveValue: ({ runtimeState }) =>
          runtimeState ?? {
            status: "idle",
            columns: [],
            rows: [],
          },
      },
    ],
  },
  execution: {
    execute: async (context) => {
      const query =
        context.props.query &&
        typeof context.props.query === "object" &&
        !Array.isArray(context.props.query)
          ? (context.props.query as Record<string, unknown>)
          : {};
      const rows = Array.isArray(query.responseBody)
        ? query.responseBody
        : [];
      const firstRow =
        rows[0] && typeof rows[0] === "object" && !Array.isArray(rows[0])
          ? (rows[0] as Record<string, unknown>)
          : {};

      return {
        status: "success" as const,
        runtimeStatePatch: {
          status: "ready",
          columns: Object.keys(firstRow),
          rows,
        },
      };
    },
    getExecutionKey: (context) => `connection-query:${context.instanceId}`,
  },
});

const streamQueryLikeWidget = defineWidget({
  id: CORE_CONNECTION_STREAM_QUERY_WIDGET_ID,
  widgetVersion: "1.0.0",
  title: "Connection Stream Query",
  description: "Connection-stream-query compatible source for graph tests.",
  category: "Test",
  kind: "custom",
  source: "test",
  component: () => null,
  workspaceRuntimeMode: "execution-owner",
  registryContract: {
    runtime: {
      refreshPolicy: "not-applicable",
      executionTriggers: [],
      executionSummary: "Socket lifecycle owns publication; refresh must not execute it.",
    },
    usageGuidance: {
      buildPurpose: "Publishes a retained stream frame.",
      whenToUse: ["Use as a live source."],
      whenNotToUse: ["Do not use for finite refresh requests."],
      authoringSteps: ["Configure the stream."],
    },
  },
  io: {
    outputs: [
      {
        id: "updates",
        label: "Updates",
        contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        resolveValue: ({ runtimeState }) =>
          runtimeState ?? {
            status: "idle",
            streamStatus: "idle",
            columns: [],
            rows: [],
          },
      },
    ],
  },
  execution: {
    getRefreshPolicy: () => "allow-refresh",
    execute: async () => {
      throw new Error("Refresh must not execute WebSocket stream sources.");
    },
    getExecutionKey: (context) => `connection-stream-query:${context.instanceId}`,
  },
});

function resolveTableLikeRows(resolvedInputs: Record<string, unknown> | undefined) {
  const input = resolvedInputs?.[TABULAR_SEED_INPUT_ID];
  const resolved = Array.isArray(input) ? input[0] : input;
  const value =
    resolved &&
    typeof resolved === "object" &&
    !Array.isArray(resolved) &&
    "value" in resolved
      ? (resolved as { value?: unknown }).value
      : undefined;

  return value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Array.isArray((value as { rows?: unknown }).rows)
      ? (value as { rows: unknown[] }).rows
      : [];
}

const tableLikeWidget = defineWidget({
  id: CORE_TABLE_WIDGET_ID,
  widgetVersion: "1.0.0",
  title: "Table",
  description: "Passive table-like consumer for graph tests.",
  category: "Test",
  kind: "custom",
  source: "test",
  component: () => null,
  workspaceRuntimeMode: "consumer",
  io: {
    inputs: [
      {
        id: TABULAR_SEED_INPUT_ID,
        label: "Seed data",
        accepts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
      },
    ],
    outputs: [
      {
        id: "activeRow",
        label: "Active row",
        contract: CORE_VALUE_JSON_CONTRACT,
        resolveValue: ({ resolvedInputs }) =>
          resolveTableLikeRows(resolvedInputs)[0] ?? null,
      },
      {
        id: "selectedRows",
        label: "Selected rows",
        contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        resolveValue: ({ resolvedInputs }) => {
          const rows = resolveTableLikeRows(resolvedInputs);
          const selectedRows = rows[0] ? [rows[0]] : [];
          const selectedRow =
            selectedRows[0] &&
            typeof selectedRows[0] === "object" &&
            !Array.isArray(selectedRows[0])
              ? selectedRows[0] as Record<string, unknown>
              : {};

          return {
            status: "ready",
            columns: Object.keys(selectedRow),
            rows: selectedRows,
          };
        },
      },
      {
        id: "activeCell",
        label: "Active cell",
        contract: CORE_VALUE_JSON_CONTRACT,
        resolveValue: ({ resolvedInputs }) => {
          const row = resolveTableLikeRows(resolvedInputs)[0];
          const record =
            row && typeof row === "object" && !Array.isArray(row)
              ? row as Record<string, unknown>
              : {};

          return {
            columnKey: "symbol",
            row,
            value: record.symbol,
          };
        },
      },
      {
        id: "selectedCellValues",
        label: "Selected cell values",
        contract: CORE_VALUE_JSON_CONTRACT,
        resolveValue: ({ resolvedInputs }) => {
          const row = resolveTableLikeRows(resolvedInputs)[0];
          const record =
            row && typeof row === "object" && !Array.isArray(row)
              ? row as Record<string, unknown>
              : {};

          return record.symbol === undefined ? [] : [record.symbol];
        },
      },
    ],
  },
});

const proTableLikeWidget = {
  ...tableLikeWidget,
  id: CORE_PRO_TABLE_WIDGET_ID,
  title: "Pro Table",
} satisfies WidgetDefinition;

const graphLikeWidget = defineWidget({
  id: CORE_GRAPH_WIDGET_ID,
  widgetVersion: "1.0.0",
  title: "Graph",
  description: "Passive graph-like managed connection consumer for graph tests.",
  category: "Test",
  kind: "custom",
  source: "test",
  component: () => null,
  workspaceRuntimeMode: "consumer",
  io: {
    inputs: [
      {
        id: TABULAR_SEED_INPUT_ID,
        label: "Seed data",
        accepts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
      },
    ],
  },
});

const assetScreenerLikeWidget = defineWidget({
  id: MAIN_SEQUENCE_MARKETS_ASSET_SCREENER_WIDGET_ID,
  widgetVersion: "1.0.0",
  title: "Asset Screener",
  description: "Passive asset-screener-like consumer for active-row variable tests.",
  category: "Test",
  kind: "custom",
  source: "test",
  component: () => null,
  workspaceRuntimeMode: "consumer",
  io: {
    inputs: [
      {
        id: TABULAR_SEED_INPUT_ID,
        label: "Seed data",
        accepts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
      },
    ],
    outputs: [
      {
        id: "activeRow",
        label: "Active row",
        contract: CORE_VALUE_JSON_CONTRACT,
        resolveValue: ({ resolvedInputs }) =>
          resolveTableLikeRows(resolvedInputs)[0] ?? null,
      },
    ],
  },
});

const managedDatasetExecutionTargetWidget = defineWidget({
  id: "test-managed-dataset-execution-target",
  widgetVersion: "1.0.0",
  title: "Managed Dataset Execution Target",
  description: "Executable target downstream from a managed source.",
  category: "Test",
  kind: "custom",
  source: "test",
  component: () => null,
  workspaceRuntimeMode: "execution-owner",
  io: {
    inputs: [
      {
        id: "sourceData",
        label: "Source data",
        accepts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
      },
    ],
  },
  execution: {
    execute: async () => ({
      status: "success" as const,
      runtimeStatePatch: {
        status: "ready",
      },
    }),
    getExecutionKey: (context) => `managed-dataset-target:${context.instanceId}`,
  },
});

const definitions = new Map<string, WidgetDefinition>([
  [sourceWidget.id, sourceWidget],
  [waitingSourceWidget.id, waitingSourceWidget],
  [errorSourceWidget.id, errorSourceWidget],
  [consumerWidget.id, consumerWidget],
  [variableSourceWidget.id, variableSourceWidget],
  [variableConsumerWidget.id, variableConsumerWidget],
  [variableExecutionTargetWidget.id, variableExecutionTargetWidget],
  [connectionQueryLikeWidget.id, connectionQueryLikeWidget],
  [streamQueryLikeWidget.id, streamQueryLikeWidget],
  [tableLikeWidget.id, tableLikeWidget],
  [proTableLikeWidget.id, proTableLikeWidget],
  [graphLikeWidget.id, graphLikeWidget],
  [assetScreenerLikeWidget.id, assetScreenerLikeWidget],
  [managedDatasetExecutionTargetWidget.id, managedDatasetExecutionTargetWidget],
]);

function resolveWidgetDefinition(widgetId: string) {
  return definitions.get(widgetId);
}

function requestKeyFor(widgets: DashboardWidgetInstance[]) {
  const snapshot = buildDashboardExecutionSnapshot({
    widgets,
    resolveWidgetDefinition,
  });

  return resolveDashboardUpstreamRequirement("consumer-1", snapshot).requestKey;
}

function passiveRequestKeyFor(widgets: DashboardWidgetInstance[]) {
  const snapshot = buildDashboardExecutionSnapshot({
    widgets,
    resolveWidgetDefinition,
  });

  return buildDashboardPassiveUpstreamResolutionKey("consumer-1", snapshot);
}

function widgets(source: Partial<DashboardWidgetInstance> = {}): DashboardWidgetInstance[] {
  return [
    {
      id: "source-1",
      widgetId: "test-source",
      title: "Source",
      props: {
        query: {
          responseBody: [{ value: 1 }],
        },
      },
      layout: { cols: 6, rows: 4 },
      ...source,
    },
    {
      id: "consumer-1",
      widgetId: "test-consumer",
      title: "Consumer",
      layout: { cols: 6, rows: 4 },
      bindings: {
        sourceData: {
          sourceWidgetId: "source-1",
          sourceOutputId: "dataset",
        },
      },
    },
  ];
}

function variableDrivenWidgets(
  sourceProps: Record<string, unknown> = {
    symbol: "AAPL",
    interval: "1m",
  },
): DashboardWidgetInstance[] {
  return [
    {
      id: "variable-source-1",
      widgetId: "test-variable-source",
      title: "Variable Source",
      layout: { cols: 6, rows: 4 },
      props: sourceProps,
    },
    {
      id: "variable-consumer-1",
      widgetId: "test-variable-consumer",
      title: "Variable Consumer",
      layout: { cols: 6, rows: 4 },
      props: {
        symbol: "",
      },
      bindings: {
        [buildWidgetReferencePropInputId(["symbol"])]: {
          sourceWidgetId: "variable-source-1",
          sourceOutputId: WIDGET_REFERENCE_PROPS_OUTPUT_ID,
          transformSteps: [
            {
              id: "extract-path",
              path: ["symbol"],
            },
          ],
        },
      },
    },
    {
      id: "variable-execution-target-1",
      widgetId: "test-variable-execution-target",
      title: "Variable Execution Target",
      layout: { cols: 6, rows: 4 },
      bindings: {
        symbol: {
          sourceWidgetId: "variable-consumer-1",
          sourceOutputId: "selectedSymbol",
        },
      },
    },
  ];
}

function managedGraphVariableWidgets(symbol: string): DashboardWidgetInstance[] {
  const embeddedConnectionQuery = {
    connectionRef: {
      id: TEST_CONNECTION_ID,
      typeId: TEST_CONNECTION_TYPE_ID,
    },
    queryModelId: TEST_QUERY_KIND,
    query: {
      kind: TEST_QUERY_KIND,
      symbols: [symbol],
      responseBody: [{ symbol }],
    },
    timeRangeMode: "none",
  };

  return [
    {
      id: "variable-source-1",
      widgetId: "test-variable-source",
      title: "Variable Source",
      layout: { cols: 6, rows: 4 },
      props: {
        symbol,
      },
    },
    {
      id: "graph-1",
      widgetId: CORE_GRAPH_WIDGET_ID,
      title: "Graph",
      layout: { cols: 6, rows: 4 },
      props: {
        graphSourceMode: "connection",
        embeddedConnectionQuery,
      },
      bindings: {
        [buildWidgetReferencePropInputId(["embeddedConnectionQuery", "query", "symbols"])]: {
          sourceWidgetId: "variable-source-1",
          sourceOutputId: WIDGET_REFERENCE_PROPS_OUTPUT_ID,
          transformSteps: [
            {
              id: "extract-path",
              path: ["symbol"],
            },
          ],
        },
        [TABULAR_SEED_INPUT_ID]: {
          sourceWidgetId: "managed-source-1",
          sourceOutputId: "dataset",
        },
      },
    },
    {
      id: "managed-source-1",
      widgetId: CORE_CONNECTION_QUERY_WIDGET_ID,
      title: "Graph Source",
      layout: { cols: 6, rows: 4 },
      props: embeddedConnectionQuery,
      managedBy: {
        ownerInstanceId: "graph-1",
        role: "embedded-connection-source",
      },
      presentation: {
        placementMode: "sidebar",
        railVisibility: "hidden",
      },
    },
    {
      id: "managed-downstream-1",
      widgetId: "test-managed-dataset-execution-target",
      title: "Managed Downstream",
      layout: { cols: 6, rows: 4 },
      bindings: {
        sourceData: {
          sourceWidgetId: "managed-source-1",
          sourceOutputId: "dataset",
        },
      },
    },
  ];
}

function managedGraphExpressionVariableWidgets(symbol: string): DashboardWidgetInstance[] {
  const expression = "$(variable-source-1).props.symbol";
  const embeddedConnectionQuery = {
    connectionRef: {
      id: TEST_CONNECTION_ID,
      typeId: TEST_CONNECTION_TYPE_ID,
    },
    queryModelId: TEST_QUERY_KIND,
    query: {
      kind: TEST_QUERY_KIND,
      symbols: [expression],
      responseBody: [{ symbol }],
    },
    timeRangeMode: "none",
  };

  return [
    {
      id: "variable-source-1",
      widgetId: "test-variable-source",
      title: "Variable Source",
      layout: { cols: 6, rows: 4 },
      props: {
        symbol,
      },
    },
    {
      id: "graph-1",
      widgetId: CORE_GRAPH_WIDGET_ID,
      title: "Graph",
      layout: { cols: 6, rows: 4 },
      props: {
        graphSourceMode: "connection",
        embeddedConnectionQuery,
      },
      bindings: {
        [TABULAR_SEED_INPUT_ID]: {
          sourceWidgetId: "managed-source-1",
          sourceOutputId: "dataset",
        },
      },
    },
    {
      id: "managed-source-1",
      widgetId: CORE_CONNECTION_QUERY_WIDGET_ID,
      title: "Graph Source",
      layout: { cols: 6, rows: 4 },
      props: embeddedConnectionQuery,
      managedBy: {
        ownerInstanceId: "graph-1",
        role: "embedded-connection-source",
      },
      presentation: {
        placementMode: "sidebar",
        railVisibility: "hidden",
      },
    },
    {
      id: "managed-downstream-1",
      widgetId: "test-managed-dataset-execution-target",
      title: "Managed Downstream",
      layout: { cols: 6, rows: 4 },
      bindings: {
        sourceData: {
          sourceWidgetId: "managed-source-1",
          sourceOutputId: "dataset",
        },
      },
    },
  ];
}

function managedGraphViaTableVariableWidgets(
  symbol: string,
  options: {
    tableInstanceId?: string;
    tableWidgetId?: string;
  } = {},
): DashboardWidgetInstance[] {
  const tableInstanceId = options.tableInstanceId ?? "table-1";
  const tableWidgetId = options.tableWidgetId ?? CORE_TABLE_WIDGET_ID;
  const embeddedConnectionQuery = {
    connectionRef: {
      id: TEST_CONNECTION_ID,
      typeId: TEST_CONNECTION_TYPE_ID,
    },
    queryModelId: TEST_QUERY_KIND,
    query: {
      kind: TEST_QUERY_KIND,
      symbols: [`$(${tableInstanceId}).activeRow.symbol`],
      responseBody: [{ symbol }],
    },
    timeRangeMode: "none",
  };

  return [
    {
      id: "upstream-source-1",
      widgetId: CORE_CONNECTION_QUERY_WIDGET_ID,
      title: "Upstream Source",
      layout: { cols: 6, rows: 4 },
      props: {
        connectionRef: {
          id: TEST_CONNECTION_ID,
          typeId: TEST_CONNECTION_TYPE_ID,
        },
        queryModelId: TEST_QUERY_KIND,
        query: {
          kind: TEST_QUERY_KIND,
          responseBody: [{ symbol }],
        },
        timeRangeMode: "none",
      },
      runtimeState: {
        status: "ready",
        columns: ["symbol"],
        rows: [{ symbol }],
      },
    },
    {
      id: tableInstanceId,
      widgetId: tableWidgetId,
      title: tableWidgetId === CORE_PRO_TABLE_WIDGET_ID ? "Pro Table" : "Table",
      layout: { cols: 6, rows: 4 },
      bindings: {
        [TABULAR_SEED_INPUT_ID]: {
          sourceWidgetId: "upstream-source-1",
          sourceOutputId: "dataset",
        },
      },
    },
    {
      id: "graph-1",
      widgetId: CORE_GRAPH_WIDGET_ID,
      title: "Graph",
      layout: { cols: 6, rows: 4 },
      props: {
        graphSourceMode: "connection",
        embeddedConnectionQuery,
      },
      bindings: {
        [buildWidgetReferencePropInputId(["embeddedConnectionQuery", "query", "symbols"])]: {
          sourceWidgetId: tableInstanceId,
          sourceOutputId: "activeRow",
          transformSteps: [
            {
              id: "extract-path",
              path: ["symbol"],
            },
          ],
        },
        [TABULAR_SEED_INPUT_ID]: {
          sourceWidgetId: "managed-source-1",
          sourceOutputId: "dataset",
        },
      },
    },
    {
      id: "managed-source-1",
      widgetId: CORE_CONNECTION_QUERY_WIDGET_ID,
      title: "Graph Source",
      layout: { cols: 6, rows: 4 },
      props: embeddedConnectionQuery,
      managedBy: {
        ownerInstanceId: "graph-1",
        role: "embedded-connection-source",
      },
      presentation: {
        placementMode: "sidebar",
        railVisibility: "hidden",
      },
    },
  ];
}

function managedGraphViaTableVariableWidgetsWithRow(
  row: Record<string, unknown>,
): DashboardWidgetInstance[] {
  const symbol = typeof row.symbol === "string" ? row.symbol : "";
  const widgets = managedGraphViaTableVariableWidgets(symbol);
  const upstreamSource = widgets.find((widget) => widget.id === "upstream-source-1");

  if (!upstreamSource) {
    return widgets;
  }

  upstreamSource.props = {
    connectionRef: {
      id: TEST_CONNECTION_ID,
      typeId: TEST_CONNECTION_TYPE_ID,
    },
    queryModelId: TEST_QUERY_KIND,
    query: {
      kind: TEST_QUERY_KIND,
      responseBody: [row],
    },
    timeRangeMode: "none",
  };
  upstreamSource.runtimeState = {
    status: "ready",
    columns: Object.keys(row),
    rows: [row],
  };

  return widgets;
}

function tableInteractionVariableWidgets(row: Record<string, unknown>): DashboardWidgetInstance[] {
  const makeConsumer = (
    id: string,
    sourceOutputId: string,
    transformSteps: WidgetBindingTransformStep[],
  ): DashboardWidgetInstance => ({
    id,
    widgetId: "test-variable-consumer",
    title: id,
    layout: { cols: 6, rows: 4 },
    props: {
      symbol: "",
    },
    bindings: {
      [buildWidgetReferencePropInputId(["symbol"])]: {
        sourceWidgetId: "table-1",
        sourceOutputId,
        transformSteps,
      },
    },
  });

  return [
    {
      id: "upstream-source-1",
      widgetId: CORE_CONNECTION_QUERY_WIDGET_ID,
      title: "Upstream Source",
      layout: { cols: 6, rows: 4 },
      props: {
        connectionRef: {
          id: TEST_CONNECTION_ID,
          typeId: TEST_CONNECTION_TYPE_ID,
        },
        queryModelId: TEST_QUERY_KIND,
        query: {
          kind: TEST_QUERY_KIND,
          responseBody: [row],
        },
        timeRangeMode: "none",
      },
      runtimeState: {
        status: "ready",
        columns: Object.keys(row),
        rows: [row],
      },
    },
    {
      id: "table-1",
      widgetId: CORE_TABLE_WIDGET_ID,
      title: "Table",
      layout: { cols: 6, rows: 4 },
      bindings: {
        [TABULAR_SEED_INPUT_ID]: {
          sourceWidgetId: "upstream-source-1",
          sourceOutputId: "dataset",
        },
      },
    },
    makeConsumer("active-row-consumer", "activeRow", [
      {
        id: "extract-path",
        path: ["symbol"],
      },
    ]),
    makeConsumer("selected-rows-consumer", "selectedRows", [
      {
        id: "extract-path",
        path: ["rows"],
      },
      {
        id: "select-array-item",
        mode: "first",
      },
      {
        id: "extract-path",
        path: ["symbol"],
      },
    ]),
    makeConsumer("active-cell-consumer", "activeCell", [
      {
        id: "extract-path",
        path: ["value"],
      },
    ]),
    makeConsumer("selected-cell-values-consumer", "selectedCellValues", [
      {
        id: "select-array-item",
        mode: "first",
      },
    ]),
  ];
}

function assetScreenerVariableWidgets(row: Record<string, unknown>): DashboardWidgetInstance[] {
  return [
    {
      id: "upstream-source-1",
      widgetId: CORE_CONNECTION_QUERY_WIDGET_ID,
      title: "Upstream Source",
      layout: { cols: 6, rows: 4 },
      props: {
        connectionRef: {
          id: TEST_CONNECTION_ID,
          typeId: TEST_CONNECTION_TYPE_ID,
        },
        queryModelId: TEST_QUERY_KIND,
        query: {
          kind: TEST_QUERY_KIND,
          responseBody: [row],
        },
        timeRangeMode: "none",
      },
      runtimeState: {
        status: "ready",
        columns: Object.keys(row),
        rows: [row],
      },
    },
    {
      id: "asset-screener-1",
      widgetId: MAIN_SEQUENCE_MARKETS_ASSET_SCREENER_WIDGET_ID,
      title: "Asset Screener",
      layout: { cols: 6, rows: 4 },
      bindings: {
        [TABULAR_SEED_INPUT_ID]: {
          sourceWidgetId: "upstream-source-1",
          sourceOutputId: "dataset",
        },
      },
    },
    {
      id: "asset-row-consumer",
      widgetId: "test-variable-consumer",
      title: "Asset Row Consumer",
      layout: { cols: 6, rows: 4 },
      props: {
        symbol: "",
      },
      bindings: {
        [buildWidgetReferencePropInputId(["symbol"])]: {
          sourceWidgetId: "asset-screener-1",
          sourceOutputId: "activeRow",
          transformSteps: [
            {
              id: "extract-path",
              path: ["symbol"],
            },
          ],
        },
      },
    },
  ];
}

describe("dashboard upstream resolution keys", () => {
  it("changes when an executable upstream source changes props", () => {
    const firstKey = requestKeyFor(widgets());
    const nextKey = requestKeyFor(
      widgets({
        props: {
          query: {
            responseBody: [{ value: 2 }],
          },
        },
      }),
    );

    expect(nextKey).not.toBe(firstKey);
  });

  it("changes when an executable upstream source runtime is cleared or populated", () => {
    const idleKey = requestKeyFor(widgets());
    const readyKey = requestKeyFor(
      widgets({
        runtimeState: {
          status: "ready",
          columns: ["value"],
          rows: [{ value: 1 }],
        },
      }),
    );

    expect(readyKey).not.toBe(idleKey);
  });

  it("does not change when upstream runtime only changes volatile trace metadata", () => {
    const firstKey = requestKeyFor(
      widgets({
        runtimeState: {
          status: "ready",
          columns: ["value"],
          rows: [{ value: 1 }],
          runtimeDataRef: {
            kind: "runtime-data-ref",
            refId: "source-1:dataset",
            workspaceRuntimeId: "workspace-1",
            ownerId: "source-1",
            outputId: "dataset",
            contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
            version: 1,
            rowCount: 1,
            schemaSignature: "schema-1",
            updatedAtMs: 100,
          },
          source: {
            kind: "connection-query",
            updatedAtMs: 100,
            context: {
              traceId: "trace-1",
              runtimeDataRef: {
                kind: "runtime-data-ref",
                refId: "source-1:dataset",
                workspaceRuntimeId: "workspace-1",
                ownerId: "source-1",
                outputId: "dataset",
                contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
                version: 1,
                rowCount: 1,
                schemaSignature: "schema-1",
                updatedAtMs: 100,
              },
            },
          },
        },
      }),
    );
    const nextKey = requestKeyFor(
      widgets({
        runtimeState: {
          status: "ready",
          columns: ["value"],
          rows: [{ value: 1 }],
          runtimeDataRef: {
            kind: "runtime-data-ref",
            refId: "source-1:dataset",
            workspaceRuntimeId: "workspace-1",
            ownerId: "source-1",
            outputId: "dataset",
            contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
            version: 2,
            rowCount: 1,
            schemaSignature: "schema-1",
            updatedAtMs: 999,
          },
          source: {
            kind: "connection-query",
            updatedAtMs: 999,
            context: {
              traceId: "trace-2",
              runtimeDataRef: {
                kind: "runtime-data-ref",
                refId: "source-1:dataset",
                workspaceRuntimeId: "workspace-1",
                ownerId: "source-1",
                outputId: "dataset",
                contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
                version: 2,
                rowCount: 1,
                schemaSignature: "schema-1",
                updatedAtMs: 999,
              },
            },
          },
        },
      }),
    );

    expect(nextKey).toBe(firstKey);
  });

  it("changes when upstream published rows change even if row count stays the same", () => {
    const firstKey = requestKeyFor(
      widgets({
        runtimeState: {
          status: "ready",
          columns: ["value"],
          rows: [{ value: 1 }],
        },
      }),
    );
    const nextKey = requestKeyFor(
      widgets({
        runtimeState: {
          status: "ready",
          columns: ["value"],
          rows: [{ value: 2 }],
        },
      }),
    );

    expect(nextKey).not.toBe(firstKey);
  });

  it("keeps the passive one-shot key stable when upstream runtime output changes", () => {
    const firstKey = passiveRequestKeyFor(widgets());
    const nextKey = passiveRequestKeyFor(
      widgets({
        runtimeState: {
          status: "error",
          error: "Backend rejected the query.",
          columns: [],
          rows: [],
          source: {
            kind: "connection-query",
            updatedAtMs: 999,
          },
        },
      }),
    );

    expect(nextKey).toBe(firstKey);
  });

  it("refreshes an actual Mock API connection source through a passive table consumer", async () => {
    const mockWidgets: DashboardWidgetInstance[] = [
      {
        id: "mock-source-1",
        widgetId: CORE_CONNECTION_QUERY_WIDGET_ID,
        title: "Mock source",
        layout: { cols: 6, rows: 4 },
        props: {
          connectionRef: {
            id: TEST_CONNECTION_ID,
            typeId: TEST_CONNECTION_TYPE_ID,
          },
          queryModelId: TEST_QUERY_KIND,
          query: {
            kind: TEST_QUERY_KIND,
            responseBody: [{ value: 7 }],
          },
          timeRangeMode: "none",
        },
        managedBy: {
          ownerInstanceId: "table-1",
          role: "embedded-connection-source",
        },
        presentation: {
          placementMode: "sidebar",
          railVisibility: "hidden",
        },
      },
      {
        id: "table-1",
        widgetId: CORE_TABLE_WIDGET_ID,
        title: "Table",
        layout: { cols: 6, rows: 4 },
        props: {
          tableSourceMode: "connection",
        },
        bindings: {
          [TABULAR_SEED_INPUT_ID]: {
            sourceWidgetId: "mock-source-1",
            sourceOutputId: "dataset",
          },
        },
      },
    ];
    let workingWidgets = mockWidgets;

    const refreshTargets = listDashboardRefreshableExecutionTargets({
      widgets: workingWidgets,
      resolveWidgetDefinition: resolveWidgetDefinition,
      refreshCycleId: "test-refresh",
    });

    expect(refreshTargets).toEqual(["table-1"]);

    const result = await executeDashboardWidgetGraph({
      scopeId: "workspace-test",
      executionSurface: "private-dashboard",
      widgets: workingWidgets,
      resolveWidgetDefinition: resolveWidgetDefinition,
      targetInstanceId: "table-1",
      reason: "dashboard-refresh",
      refreshCycleId: "test-refresh",
      onRuntimeStateWrite(instanceId, runtimeState) {
        workingWidgets = workingWidgets.map((widget) =>
          widget.id === instanceId
            ? {
                ...widget,
                runtimeState,
              }
            : widget,
        );
      },
    });

    expect(result.status).toBe("success");
    expect(result.nodeResults).toMatchObject([
      {
        instanceId: "mock-source-1",
        reason: "dashboard-refresh",
        status: "success",
      },
    ]);
    expect(workingWidgets.find((widget) => widget.id === "mock-source-1")?.runtimeState)
      .toMatchObject({
        status: "ready",
        columns: ["value"],
        rows: [{ value: 7 }],
      });
  });

  it("does not refresh or restart WebSocket stream sources", async () => {
    const mockWidgets: DashboardWidgetInstance[] = [
      {
        id: "stream-source-1",
        widgetId: CORE_CONNECTION_STREAM_QUERY_WIDGET_ID,
        title: "Live stream source",
        layout: { cols: 6, rows: 4 },
        runtimeState: {
          status: "ready",
          streamStatus: "live",
          columns: ["value"],
          rows: [{ value: 1 }],
        },
      },
      {
        id: "table-1",
        widgetId: CORE_TABLE_WIDGET_ID,
        title: "Table",
        layout: { cols: 6, rows: 4 },
        bindings: {
          [TABULAR_SEED_INPUT_ID]: {
            sourceWidgetId: "stream-source-1",
            sourceOutputId: "updates",
          },
        },
      },
    ];
    const snapshot = buildDashboardExecutionSnapshot({
      widgets: mockWidgets,
      resolveWidgetDefinition,
    });

    expect(listDashboardWidgetExecutionOrder("table-1", snapshot)).toEqual([
      "stream-source-1",
    ]);
    expect(
      listDashboardWidgetExecutionOrder("table-1", snapshot, {
        excludeRefreshNotApplicable: true,
      }),
    ).toEqual([]);

    const refreshTargets = listDashboardRefreshableExecutionTargets({
      widgets: mockWidgets,
      resolveWidgetDefinition,
      refreshCycleId: "test-refresh",
    });

    expect(refreshTargets).toEqual([]);

    const result = await executeDashboardWidgetGraph({
      scopeId: "workspace-test",
      executionSurface: "private-dashboard",
      widgets: mockWidgets,
      resolveWidgetDefinition,
      targetInstanceId: "table-1",
      reason: "dashboard-refresh",
      refreshCycleId: "test-refresh",
    });

    expect(result.status).toBe("skipped");
    expect(result.nodeResults).toEqual([]);
  });

  it("builds a finite execution plan for executable upstream nodes and passive targets", () => {
    const snapshot = buildDashboardExecutionSnapshot({
      widgets: managedGraphViaTableVariableWidgets("AAPL"),
      resolveWidgetDefinition,
    });

    const plan = planDashboardFiniteExecution({
      reason: "manual-recalculate",
      snapshot,
      targetInstanceIds: ["graph-1"],
    });

    expect(plan.targetInstanceIds).toEqual(["graph-1"]);
    expect(plan.nodes).toEqual([
      {
        instanceId: "upstream-source-1",
        reason: "manual-recalculate",
        targetInstanceIds: ["graph-1"],
      },
      {
        instanceId: "graph-1",
        reason: "manual-recalculate",
        targetInstanceIds: ["graph-1"],
      },
      {
        instanceId: "managed-source-1",
        reason: "manual-recalculate",
        targetInstanceIds: ["graph-1"],
      },
    ]);
  });

  it("keeps stream sources out of finite dashboard refresh plans", () => {
    const mockWidgets: DashboardWidgetInstance[] = [
      {
        id: "stream-source-1",
        widgetId: CORE_CONNECTION_STREAM_QUERY_WIDGET_ID,
        title: "Live stream source",
        layout: { cols: 6, rows: 4 },
        runtimeState: {
          status: "ready",
          streamStatus: "live",
          columns: ["value"],
          rows: [{ value: 1 }],
        },
      },
      {
        id: "table-1",
        widgetId: CORE_TABLE_WIDGET_ID,
        title: "Table",
        layout: { cols: 6, rows: 4 },
        bindings: {
          [TABULAR_SEED_INPUT_ID]: {
            sourceWidgetId: "stream-source-1",
            sourceOutputId: "updates",
          },
        },
      },
    ];
    const snapshot = buildDashboardExecutionSnapshot({
      widgets: mockWidgets,
      resolveWidgetDefinition,
    });

    const plan = planDashboardFiniteExecution({
      reason: "dashboard-refresh",
      snapshot,
      targetInstanceIds: ["table-1"],
    });

    expect(plan.nodes).toEqual([
      {
        instanceId: "table-1",
        reason: "dashboard-refresh",
        targetInstanceIds: ["table-1"],
      },
    ]);
  });

  it("marks a waiting executable and its downstream target as waiting instead of error", async () => {
    const mockWidgets: DashboardWidgetInstance[] = [
      {
        id: "waiting-source-1",
        widgetId: "test-waiting-source",
        title: "Waiting source",
        layout: { cols: 6, rows: 4 },
      },
      {
        id: "consumer-1",
        widgetId: "test-consumer",
        title: "Consumer",
        layout: { cols: 6, rows: 4 },
        bindings: {
          sourceData: {
            sourceWidgetId: "waiting-source-1",
            sourceOutputId: "dataset",
          },
        },
      },
    ];
    const completions: Array<{
      instanceId: string;
      status: string;
      error?: string;
    }> = [];

    const result = await executeDashboardWidgetGraph({
      scopeId: "workspace-test",
      executionSurface: "private-dashboard",
      widgets: mockWidgets,
      resolveWidgetDefinition,
      targetInstanceId: "consumer-1",
      reason: "manual-recalculate",
      onNodeComplete(node) {
        completions.push({
          instanceId: node.instanceId,
          status: node.status,
          error: node.error,
        });
      },
    });

    expect(result.status).toBe("waiting");
    expect(result.error).toBe("Waiting for seed dataset.");
    expect(result.nodeResults).toMatchObject([
      {
        instanceId: "waiting-source-1",
        status: "waiting",
        error: "Waiting for seed dataset.",
      },
      {
        instanceId: "consumer-1",
        status: "waiting",
        error: "Waiting for Waiting source.",
      },
    ]);
    expect(result.executedInstanceIds.size).toBe(0);
    expect(completions).toMatchObject([
      {
        instanceId: "waiting-source-1",
        status: "waiting",
        error: "Waiting for seed dataset.",
      },
      {
        instanceId: "consumer-1",
        status: "waiting",
        error: "Waiting for Waiting source.",
      },
    ]);
  });

  it("marks downstream nodes as upstream-error when an executable parent fails", async () => {
    const mockWidgets: DashboardWidgetInstance[] = [
      {
        id: "error-source-1",
        widgetId: "test-error-source",
        title: "Error source",
        layout: { cols: 6, rows: 4 },
      },
      {
        id: "consumer-1",
        widgetId: "test-consumer",
        title: "Consumer",
        layout: { cols: 6, rows: 4 },
        bindings: {
          sourceData: {
            sourceWidgetId: "error-source-1",
            sourceOutputId: "dataset",
          },
        },
      },
    ];
    const completions: Array<{
      instanceId: string;
      status: string;
      error?: string;
      blockedByWidgetId?: string;
      blockedByOutputId?: string;
    }> = [];

    const result = await executeDashboardWidgetGraph({
      scopeId: "workspace-test",
      executionSurface: "private-dashboard",
      widgets: mockWidgets,
      resolveWidgetDefinition,
      targetInstanceId: "consumer-1",
      reason: "manual-recalculate",
      onNodeComplete(node) {
        completions.push({
          instanceId: node.instanceId,
          status: node.status,
          error: node.error,
          blockedByWidgetId: node.blockedByWidgetId,
          blockedByOutputId: node.blockedByOutputId,
        });
      },
    });

    expect(result.status).toBe("error");
    expect(result.error).toBe("Backend failed.");
    expect(result.nodeResults).toMatchObject([
      {
        instanceId: "error-source-1",
        status: "error",
        error: "Backend failed.",
      },
      {
        instanceId: "consumer-1",
        status: "upstream-error",
        error: "Blocked by Error source.",
        blockedByWidgetId: "error-source-1",
        blockedByOutputId: "dataset",
      },
    ]);
    expect(result.executedInstanceIds).toEqual(new Set(["error-source-1"]));
    expect(completions).toMatchObject([
      {
        instanceId: "error-source-1",
        status: "error",
        error: "Backend failed.",
      },
      {
        instanceId: "consumer-1",
        status: "upstream-error",
        error: "Blocked by Error source.",
        blockedByWidgetId: "error-source-1",
        blockedByOutputId: "dataset",
      },
    ]);
  });

  it("persists runtime from execution-only target overrides without persisting the override props", async () => {
    const originalProps = {
      connectionRef: {
        id: TEST_CONNECTION_ID,
        typeId: TEST_CONNECTION_TYPE_ID,
      },
      queryModelId: TEST_QUERY_KIND,
      query: {
        kind: TEST_QUERY_KIND,
        responseBody: [{ value: 1 }],
      },
      timeRangeMode: "none",
    };
    let workingWidgets: DashboardWidgetInstance[] = [
      {
        id: "mock-source-1",
        widgetId: CORE_CONNECTION_QUERY_WIDGET_ID,
        title: "Mock source",
        layout: { cols: 6, rows: 4 },
        props: originalProps,
      },
    ];

    const result = await executeDashboardWidgetGraph({
      scopeId: "workspace-test",
      executionSurface: "private-dashboard",
      widgets: workingWidgets,
      resolveWidgetDefinition: resolveWidgetDefinition,
      targetInstanceId: "mock-source-1",
      reason: "upstream-update",
      targetOverrides: {
        props: {
          ...originalProps,
          query: {
            kind: TEST_QUERY_KIND,
            responseBody: [{ value: 9 }],
          },
        },
      },
      persistTargetRuntimeStateWithOverrides: true,
      onRuntimeStateWrite(instanceId, runtimeState) {
        workingWidgets = workingWidgets.map((widget) =>
          widget.id === instanceId
            ? {
                ...widget,
                runtimeState,
              }
            : widget,
        );
      },
    });

    const resultWidget = result.widgets.find((widget) => widget.id === "mock-source-1");

    expect(result.status).toBe("success");
    expect(resultWidget?.props).toEqual(originalProps);
    expect(resultWidget?.runtimeState).toMatchObject({
      status: "ready",
      columns: ["value"],
      rows: [{ value: 9 }],
    });
  });

  it("plans variable-driven downstream refresh only for referenced source values", () => {
    const beforeSnapshot = buildDashboardExecutionSnapshot({
      widgets: variableDrivenWidgets({
        symbol: "AAPL",
        interval: "1m",
      }),
      resolveWidgetDefinition,
    });
    const afterSnapshot = buildDashboardExecutionSnapshot({
      widgets: variableDrivenWidgets({
        symbol: "MSFT",
        interval: "1m",
      }),
      resolveWidgetDefinition,
    });

    const plan = planDashboardVariableDrivenCommit({
      changedWidgetId: "variable-source-1",
      beforeSnapshot,
      afterSnapshot,
      resolveManagedConnectionConsumerAdapter: (widgetId) =>
        widgetId === CORE_GRAPH_WIDGET_ID ? testGraphManagedConnectionConsumerAdapter : null,
    });

    expect(plan.changedVariableEntries).toEqual([
      {
        entryId:
          '["variable-source-1","__widget-reference.source.props","extract-path:symbol"]',
        sourceWidgetId: "variable-source-1",
        sourceOutputId: "__widget-reference.source.props",
        transformSignature: "extract-path:symbol",
        targetWidgetIds: ["variable-consumer-1"],
      },
    ]);
    expect(plan.affectedConsumerWidgetIds).toEqual(["variable-consumer-1"]);
    expect(plan.passiveConsumerWidgetIds).toEqual(["variable-consumer-1"]);
    expect(plan.executableConsumerWidgetIds).toEqual([]);
    expect(plan.managedExecutableSourceWidgetIds).toEqual([]);
    expect(plan.executableTargetWidgetIds).toEqual(["variable-execution-target-1"]);
    expect(plan.executableTargetOverridesByWidgetId).toEqual({});
  });

  it("discovers expression-derived downstream execution targets", () => {
    const snapshot = buildDashboardExecutionSnapshot({
      widgets: [
        {
          id: "variable-source-1",
          widgetId: "test-variable-source",
          title: "Variable Source",
          layout: { cols: 6, rows: 4 },
          props: {
            symbol: "AAPL",
          },
        },
        {
          id: "variable-execution-target-1",
          widgetId: "test-variable-execution-target",
          title: "Variable Execution Target",
          layout: { cols: 6, rows: 4 },
          props: {
            symbol: "$(variable-source-1).props.symbol",
          },
        },
      ],
      resolveWidgetDefinition,
    });

    expect(listDashboardDownstreamExecutionTargets("variable-source-1", snapshot)).toEqual([
      "variable-execution-target-1",
    ]);
  });

  it("keeps not-yet-resolved reference-backed props in execution order", () => {
    const snapshot = buildDashboardExecutionSnapshot({
      widgets: [
        {
          id: "upstream-source-1",
          widgetId: CORE_CONNECTION_QUERY_WIDGET_ID,
          title: "Upstream Source",
          layout: { cols: 6, rows: 4 },
          props: {
            connectionRef: {
              id: TEST_CONNECTION_ID,
              typeId: TEST_CONNECTION_TYPE_ID,
            },
            queryModelId: TEST_QUERY_KIND,
            query: {
              kind: TEST_QUERY_KIND,
              responseBody: [{ symbol: "MSFT" }],
            },
            timeRangeMode: "none",
          },
        },
        {
          id: "table-1",
          widgetId: CORE_TABLE_WIDGET_ID,
          title: "Table",
          layout: { cols: 6, rows: 4 },
          bindings: {
            [TABULAR_SEED_INPUT_ID]: {
              sourceWidgetId: "upstream-source-1",
              sourceOutputId: "dataset",
            },
          },
        },
        {
          id: "http-1",
          widgetId: CORE_CONNECTION_QUERY_WIDGET_ID,
          title: "HTTP Query",
          layout: { cols: 6, rows: 4 },
          props: {
            connectionRef: {
              id: TEST_CONNECTION_ID,
              typeId: TEST_CONNECTION_TYPE_ID,
            },
            queryModelId: TEST_QUERY_KIND,
            query: {
              kind: TEST_QUERY_KIND,
              symbols: ["$(table-1).activeRow.symbol"],
              responseBody: [{ value: 1 }],
            },
            timeRangeMode: "none",
          },
        },
        {
          id: "chart-1",
          widgetId: "test-consumer",
          title: "Chart",
          layout: { cols: 6, rows: 4 },
          bindings: {
            sourceData: {
              sourceWidgetId: "http-1",
              sourceOutputId: "dataset",
            },
          },
        },
      ],
      resolveWidgetDefinition,
    });

    expect(listDashboardWidgetExecutionOrder("chart-1", snapshot)).toEqual([
      "upstream-source-1",
      "http-1",
    ]);
  });

  it("ignores unrelated source prop changes for variable-driven commit planning", () => {
    const beforeSnapshot = buildDashboardExecutionSnapshot({
      widgets: variableDrivenWidgets({
        symbol: "AAPL",
        interval: "1m",
      }),
      resolveWidgetDefinition,
    });
    const afterSnapshot = buildDashboardExecutionSnapshot({
      widgets: variableDrivenWidgets({
        symbol: "AAPL",
        interval: "5m",
      }),
      resolveWidgetDefinition,
    });

    const plan = planDashboardVariableDrivenCommit({
      changedWidgetId: "variable-source-1",
      beforeSnapshot,
      afterSnapshot,
      resolveManagedConnectionConsumerAdapter: (widgetId) =>
        widgetId === CORE_GRAPH_WIDGET_ID ? testGraphManagedConnectionConsumerAdapter : null,
    });

    expect(plan.changedVariableEntries).toEqual([]);
    expect(plan.affectedConsumerWidgetIds).toEqual([]);
    expect(plan.passiveConsumerWidgetIds).toEqual([]);
    expect(plan.executableConsumerWidgetIds).toEqual([]);
    expect(plan.managedExecutableSourceWidgetIds).toEqual([]);
    expect(plan.executableTargetWidgetIds).toEqual([]);
    expect(plan.executableTargetOverridesByWidgetId).toEqual({});
  });

  it("allows runtime variable planning to suppress unchanged effective signatures", () => {
    const beforeSnapshot = buildDashboardExecutionSnapshot({
      widgets: variableDrivenWidgets({
        symbol: "AAPL",
        interval: "1m",
      }),
      resolveWidgetDefinition,
    });
    const afterSnapshot = buildDashboardExecutionSnapshot({
      widgets: variableDrivenWidgets({
        symbol: "MSFT",
        interval: "1m",
      }),
      resolveWidgetDefinition,
    });
    const inspectedEntryIds: string[] = [];

    const plan = planDashboardVariableDrivenCommit({
      changedWidgetId: "variable-source-1",
      beforeSnapshot,
      afterSnapshot,
      shouldIncludeChangedVariableEntry: (entry) => {
        inspectedEntryIds.push(entry.entryId);
        expect(entry.beforeValueSignature).not.toEqual(entry.afterValueSignature);
        return false;
      },
      resolveManagedConnectionConsumerAdapter: (widgetId) =>
        widgetId === CORE_GRAPH_WIDGET_ID ? testGraphManagedConnectionConsumerAdapter : null,
    });

    expect(inspectedEntryIds).toEqual([
      '["variable-source-1","__widget-reference.source.props","extract-path:symbol"]',
    ]);
    expect(plan.changedVariableEntries).toEqual([]);
    expect(plan.affectedConsumerWidgetIds).toEqual([]);
    expect(plan.passiveConsumerWidgetIds).toEqual([]);
    expect(plan.executableConsumerWidgetIds).toEqual([]);
    expect(plan.managedExecutableSourceWidgetIds).toEqual([]);
    expect(plan.executableTargetWidgetIds).toEqual([]);
    expect(plan.executableTargetOverridesByWidgetId).toEqual({});
  });

  it("does not fan out from passive runtime consumers to their downstream execution targets", () => {
    const beforeSnapshot = buildDashboardExecutionSnapshot({
      widgets: variableDrivenWidgets({
        symbol: "AAPL",
        interval: "1m",
      }),
      resolveWidgetDefinition,
    });
    const afterSnapshot = buildDashboardExecutionSnapshot({
      widgets: variableDrivenWidgets({
        symbol: "MSFT",
        interval: "1m",
      }),
      resolveWidgetDefinition,
    });

    const plan = planDashboardVariableDrivenCommit({
      changedWidgetId: "variable-source-1",
      beforeSnapshot,
      afterSnapshot,
      includeDownstreamVariableSources: false,
      resolveManagedConnectionConsumerAdapter: (widgetId) =>
        widgetId === CORE_GRAPH_WIDGET_ID ? testGraphManagedConnectionConsumerAdapter : null,
    });

    expect(plan.changedVariableEntries).toHaveLength(1);
    expect(plan.affectedConsumerWidgetIds).toEqual(["variable-consumer-1"]);
    expect(plan.passiveConsumerWidgetIds).toEqual(["variable-consumer-1"]);
    expect(plan.executableTargetWidgetIds).toEqual([]);
  });

  it("plans managed executable source projection when variable-backed owner source props change", () => {
    const beforeSnapshot = buildDashboardExecutionSnapshot({
      widgets: managedGraphVariableWidgets("AAPL"),
      resolveWidgetDefinition: resolveWidgetDefinition,
    });
    const afterSnapshot = buildDashboardExecutionSnapshot({
      widgets: managedGraphVariableWidgets("MSFT"),
      resolveWidgetDefinition: resolveWidgetDefinition,
    });

    const plan = planDashboardVariableDrivenCommit({
      changedWidgetId: "variable-source-1",
      beforeSnapshot,
      afterSnapshot,
      resolveManagedConnectionConsumerAdapter: (widgetId) =>
        widgetId === CORE_GRAPH_WIDGET_ID ? testGraphManagedConnectionConsumerAdapter : null,
    });

    expect(plan.affectedConsumerWidgetIds).toEqual(["graph-1"]);
    expect(plan.passiveConsumerWidgetIds).toEqual(["graph-1"]);
    expect(plan.managedExecutableSourceWidgetIds).toEqual(["managed-source-1"]);
    expect(plan.executableTargetWidgetIds).toEqual([
      "managed-source-1",
      "managed-downstream-1",
    ]);
    expect(plan.executableTargetOverridesByWidgetId["managed-source-1"]?.props)
      .toMatchObject({
        query: {
          symbols: ["MSFT"],
        },
      });
    expect(plan.executableTargetOverridesByWidgetId["managed-downstream-1"]).toBeUndefined();
  });

  it("plans managed source refresh when its connection props are expression-backed", () => {
    const beforeSnapshot = buildDashboardExecutionSnapshot({
      widgets: managedGraphExpressionVariableWidgets("AAPL"),
      resolveWidgetDefinition: resolveWidgetDefinition,
    });
    const afterSnapshot = buildDashboardExecutionSnapshot({
      widgets: managedGraphExpressionVariableWidgets("MSFT"),
      resolveWidgetDefinition: resolveWidgetDefinition,
    });

    const plan = planDashboardVariableDrivenCommit({
      changedWidgetId: "variable-source-1",
      beforeSnapshot,
      afterSnapshot,
      resolveManagedConnectionConsumerAdapter: (widgetId) =>
        widgetId === CORE_GRAPH_WIDGET_ID ? testGraphManagedConnectionConsumerAdapter : null,
    });

    expect(plan.changedVariableEntries).toEqual([
      {
        entryId:
          '["variable-source-1","__widget-reference.source.props","extract-path:symbol"]',
        sourceWidgetId: "variable-source-1",
        sourceOutputId: "__widget-reference.source.props",
        transformSignature: "extract-path:symbol",
        targetWidgetIds: ["graph-1", "managed-source-1"],
      },
    ]);
    expect(plan.managedExecutableSourceWidgetIds).toEqual(["managed-source-1"]);
    expect(plan.executableTargetWidgetIds).toEqual([
      "managed-source-1",
      "managed-downstream-1",
    ]);
    expect(plan.executableTargetOverridesByWidgetId["managed-source-1"]?.props)
      .toMatchObject({
        query: {
          symbols: ["MSFT"],
        },
      });
  });

  it("plans variable refresh for active variables owned by passive downstream widgets", () => {
    const beforeSnapshot = buildDashboardExecutionSnapshot({
      widgets: managedGraphViaTableVariableWidgets("AAPL"),
      resolveWidgetDefinition,
    });
    const afterSnapshot = buildDashboardExecutionSnapshot({
      widgets: managedGraphViaTableVariableWidgets("MSFT"),
      resolveWidgetDefinition,
    });

    const plan = planDashboardVariableDrivenCommit({
      changedWidgetId: "upstream-source-1",
      beforeSnapshot,
      afterSnapshot,
      resolveManagedConnectionConsumerAdapter: (widgetId) =>
        widgetId === CORE_GRAPH_WIDGET_ID ? testGraphManagedConnectionConsumerAdapter : null,
    });

    expect(plan.changedVariableEntries).toEqual([
      {
        entryId: '["table-1","activeRow","extract-path:symbol"]',
        sourceWidgetId: "table-1",
        sourceOutputId: "activeRow",
        transformSignature: "extract-path:symbol",
        targetWidgetIds: ["graph-1", "managed-source-1"],
      },
    ]);
    expect(plan.managedExecutableSourceWidgetIds).toEqual(["managed-source-1"]);
    expect(plan.executableTargetOverridesByWidgetId["managed-source-1"]?.props)
      .toMatchObject({
        query: {
          symbols: ["MSFT"],
        },
      });
  });

  it("executes runtime variable refresh from the changed source boundary without rerunning ancestors", async () => {
    const beforeWidgets = managedGraphViaTableVariableWidgets("AAPL");
    let workingWidgets = managedGraphViaTableVariableWidgets("MSFT");
    const beforeSnapshot = buildDashboardExecutionSnapshot({
      widgets: beforeWidgets,
      resolveWidgetDefinition,
    });
    const afterSnapshot = buildDashboardExecutionSnapshot({
      widgets: workingWidgets,
      resolveWidgetDefinition,
    });
    const plan = planDashboardVariableDrivenCommit({
      changedWidgetId: "upstream-source-1",
      beforeSnapshot,
      afterSnapshot,
      resolveManagedConnectionConsumerAdapter: (widgetId) =>
        widgetId === CORE_GRAPH_WIDGET_ID ? testGraphManagedConnectionConsumerAdapter : null,
    });

    expect(listDashboardWidgetExecutionOrder("managed-source-1", afterSnapshot))
      .toEqual(["upstream-source-1", "managed-source-1"]);
    expect(
      listDashboardWidgetExecutionOrder("managed-source-1", afterSnapshot, {
        sourceBoundaryInstanceId: "table-1",
      }),
    ).toEqual(["managed-source-1"]);

    const result = await executeDashboardWidgetGraph({
      scopeId: "workspace-test",
      executionSurface: "private-dashboard",
      widgets: workingWidgets,
      resolveWidgetDefinition,
      targetInstanceId: "managed-source-1",
      reason: "upstream-update",
      sourceBoundaryInstanceId: "table-1",
      targetOverrides: plan.executableTargetOverridesByWidgetId["managed-source-1"],
      persistTargetRuntimeStateWithOverrides: true,
      onRuntimeStateWrite(instanceId, runtimeState) {
        workingWidgets = workingWidgets.map((widget) =>
          widget.id === instanceId
            ? {
                ...widget,
                runtimeState,
              }
            : widget,
        );
      },
    });

    expect(result.status).toBe("success");
    expect(result.nodeResults.map((nodeResult) => nodeResult.instanceId))
      .toEqual(["managed-source-1"]);
    expect(workingWidgets.find((widget) => widget.id === "upstream-source-1")?.runtimeState)
      .toMatchObject({
        rows: [{ symbol: "MSFT" }],
      });
    expect(workingWidgets.find((widget) => widget.id === "managed-source-1")?.runtimeState)
      .toMatchObject({
        rows: [{ symbol: "MSFT" }],
      });
  });

  it.each([
    { tableInstanceId: "table-1", tableWidgetId: CORE_TABLE_WIDGET_ID },
    { tableInstanceId: "pro-table-1", tableWidgetId: CORE_PRO_TABLE_WIDGET_ID },
  ])(
    "plans runtime variable changes from $tableWidgetId without rebuilding before topology",
    ({ tableInstanceId, tableWidgetId }) => {
      const afterSnapshot = buildDashboardExecutionSnapshot({
        widgets: managedGraphViaTableVariableWidgets("MSFT", {
          tableInstanceId,
          tableWidgetId,
        }),
        resolveWidgetDefinition,
      });
      const inspectedEntryIds: string[] = [];
      const signatureCache = new Map<string, string>();

      const firstPlan = planDashboardRuntimeVariableDrivenCommit({
        changedWidgetId: tableInstanceId,
        afterSnapshot,
        resolvePreviousVariableEntrySignature: (entryId) => signatureCache.get(entryId),
        shouldIncludeChangedVariableEntry: (entry) => {
          inspectedEntryIds.push(entry.entryId);
          signatureCache.set(entry.entryId, entry.afterValueSignature);
          return true;
        },
        resolveManagedConnectionConsumerAdapter: (widgetId) =>
          widgetId === CORE_GRAPH_WIDGET_ID ? testGraphManagedConnectionConsumerAdapter : null,
      });

      expect(inspectedEntryIds).toEqual([
        `["${tableInstanceId}","activeRow","extract-path:symbol"]`,
      ]);
      expect(firstPlan.changedVariableEntries).toEqual([
        {
          entryId: `["${tableInstanceId}","activeRow","extract-path:symbol"]`,
          sourceWidgetId: tableInstanceId,
          sourceOutputId: "activeRow",
          transformSignature: "extract-path:symbol",
          targetWidgetIds: ["graph-1", "managed-source-1"],
        },
      ]);
      expect(firstPlan.managedExecutableSourceWidgetIds).toEqual(["managed-source-1"]);
      expect(firstPlan.executableTargetWidgetIds).toEqual(["managed-source-1"]);
      expect(firstPlan.executableTargetOverridesByWidgetId["managed-source-1"]?.props)
        .toMatchObject({
          query: {
            symbols: ["MSFT"],
          },
        });

      const secondPlan = planDashboardRuntimeVariableDrivenCommit({
        changedWidgetId: tableInstanceId,
        afterSnapshot,
        resolvePreviousVariableEntrySignature: (entryId) => signatureCache.get(entryId),
        shouldIncludeChangedVariableEntry: () => {
          throw new Error("unchanged runtime signatures should not be inspected");
        },
        resolveManagedConnectionConsumerAdapter: (widgetId) =>
          widgetId === CORE_GRAPH_WIDGET_ID ? testGraphManagedConnectionConsumerAdapter : null,
      });

      expect(secondPlan.changedVariableEntries).toEqual([]);
      expect(secondPlan.executableTargetWidgetIds).toEqual([]);
    },
  );

  it("does not schedule managed sources when downstream passive variable values stay the same", () => {
    const beforeWidgets = managedGraphViaTableVariableWidgetsWithRow({
      symbol: "AAPL",
      price: 100,
    });
    const afterWidgets = managedGraphViaTableVariableWidgetsWithRow({
      symbol: "AAPL",
      price: 250,
    });
    const beforeSnapshot = buildDashboardExecutionSnapshot({
      widgets: beforeWidgets,
      resolveWidgetDefinition,
    });
    const afterSnapshot = buildDashboardExecutionSnapshot({
      widgets: afterWidgets,
      resolveWidgetDefinition,
    });

    const plan = planDashboardVariableDrivenCommit({
      changedWidgetId: "upstream-source-1",
      beforeSnapshot,
      afterSnapshot,
      resolveManagedConnectionConsumerAdapter: (widgetId) =>
        widgetId === CORE_GRAPH_WIDGET_ID ? testGraphManagedConnectionConsumerAdapter : null,
    });

    expect(plan.changedVariableEntries).toEqual([]);
    expect(plan.affectedConsumerWidgetIds).toEqual([]);
    expect(plan.passiveConsumerWidgetIds).toEqual([]);
    expect(plan.executableConsumerWidgetIds).toEqual([]);
    expect(plan.managedExecutableSourceWidgetIds).toEqual([]);
    expect(plan.executableTargetWidgetIds).toEqual([]);
    expect(plan.executableTargetOverridesByWidgetId).toEqual({});
  });

  it("suppresses unchanged table interaction output signatures", () => {
    const beforeSnapshot = buildDashboardExecutionSnapshot({
      widgets: tableInteractionVariableWidgets({
        symbol: "AAPL",
        price: 100,
      }),
      resolveWidgetDefinition,
    });
    const afterSnapshot = buildDashboardExecutionSnapshot({
      widgets: tableInteractionVariableWidgets({
        symbol: "AAPL",
        price: 250,
      }),
      resolveWidgetDefinition,
    });

    const plan = planDashboardVariableDrivenCommit({
      changedWidgetId: "upstream-source-1",
      beforeSnapshot,
      afterSnapshot,
      resolveManagedConnectionConsumerAdapter: (widgetId) =>
        widgetId === CORE_GRAPH_WIDGET_ID ? testGraphManagedConnectionConsumerAdapter : null,
    });

    expect(plan.changedVariableEntries).toEqual([]);
    expect(plan.affectedConsumerWidgetIds).toEqual([]);
    expect(plan.executableTargetWidgetIds).toEqual([]);
  });

  it("detects effective table interaction output changes when referenced values change", () => {
    const beforeSnapshot = buildDashboardExecutionSnapshot({
      widgets: tableInteractionVariableWidgets({
        symbol: "AAPL",
        price: 100,
      }),
      resolveWidgetDefinition,
    });
    const afterSnapshot = buildDashboardExecutionSnapshot({
      widgets: tableInteractionVariableWidgets({
        symbol: "MSFT",
        price: 100,
      }),
      resolveWidgetDefinition,
    });

    const plan = planDashboardVariableDrivenCommit({
      changedWidgetId: "upstream-source-1",
      beforeSnapshot,
      afterSnapshot,
      resolveManagedConnectionConsumerAdapter: (widgetId) =>
        widgetId === CORE_GRAPH_WIDGET_ID ? testGraphManagedConnectionConsumerAdapter : null,
    });

    expect(plan.changedVariableEntries.map((entry) => entry.sourceOutputId)).toEqual([
      "activeCell",
      "activeRow",
      "selectedCellValues",
      "selectedRows",
    ]);
    expect(plan.affectedConsumerWidgetIds).toEqual([
      "active-row-consumer",
      "selected-rows-consumer",
      "active-cell-consumer",
      "selected-cell-values-consumer",
    ]);
  });

  it("gates Asset Screener active-row variables by the transformed referenced value", () => {
    const beforeSnapshot = buildDashboardExecutionSnapshot({
      widgets: assetScreenerVariableWidgets({
        Symbol: "AAPL",
        last_price: 100,
      }),
      resolveWidgetDefinition,
    });
    const sameSymbolSnapshot = buildDashboardExecutionSnapshot({
      widgets: assetScreenerVariableWidgets({
        Symbol: "AAPL",
        last_price: 250,
      }),
      resolveWidgetDefinition,
    });
    const changedSymbolSnapshot = buildDashboardExecutionSnapshot({
      widgets: assetScreenerVariableWidgets({
        Symbol: "MSFT",
        last_price: 250,
      }),
      resolveWidgetDefinition,
    });

    const unchangedPlan = planDashboardVariableDrivenCommit({
      changedWidgetId: "upstream-source-1",
      beforeSnapshot,
      afterSnapshot: sameSymbolSnapshot,
      resolveManagedConnectionConsumerAdapter: (widgetId) =>
        widgetId === CORE_GRAPH_WIDGET_ID ? testGraphManagedConnectionConsumerAdapter : null,
    });
    const changedPlan = planDashboardVariableDrivenCommit({
      changedWidgetId: "upstream-source-1",
      beforeSnapshot,
      afterSnapshot: changedSymbolSnapshot,
      resolveManagedConnectionConsumerAdapter: (widgetId) =>
        widgetId === CORE_GRAPH_WIDGET_ID ? testGraphManagedConnectionConsumerAdapter : null,
    });

    expect(unchangedPlan.changedVariableEntries).toEqual([]);
    expect(changedPlan.changedVariableEntries).toMatchObject([
      {
        sourceWidgetId: "asset-screener-1",
        sourceOutputId: "activeRow",
        targetWidgetIds: ["asset-row-consumer"],
      },
    ]);
  });

  it("keeps saved owner props and managed source props unchanged when projecting runtime overrides", () => {
    const beforeWidgets = managedGraphViaTableVariableWidgets("AAPL");
    const afterWidgets = managedGraphViaTableVariableWidgets("MSFT");
    const beforeSnapshot = buildDashboardExecutionSnapshot({
      widgets: beforeWidgets,
      resolveWidgetDefinition,
    });
    const afterSnapshot = buildDashboardExecutionSnapshot({
      widgets: afterWidgets,
      resolveWidgetDefinition,
    });

    const afterGraph = afterWidgets.find((widget) => widget.id === "graph-1");
    const afterManagedSource = afterWidgets.find((widget) => widget.id === "managed-source-1");

    expect(afterGraph?.props).toMatchObject({
      embeddedConnectionQuery: {
        query: {
          symbols: ["$(table-1).activeRow.symbol"],
        },
      },
    });
    expect(afterManagedSource?.props).toMatchObject({
      query: {
        symbols: ["$(table-1).activeRow.symbol"],
      },
    });

    const plan = planDashboardVariableDrivenCommit({
      changedWidgetId: "upstream-source-1",
      beforeSnapshot,
      afterSnapshot,
      resolveManagedConnectionConsumerAdapter: (widgetId) =>
        widgetId === CORE_GRAPH_WIDGET_ID ? testGraphManagedConnectionConsumerAdapter : null,
    });

    expect(plan.executableTargetOverridesByWidgetId["managed-source-1"]?.props)
      .toMatchObject({
        query: {
          symbols: ["MSFT"],
        },
      });
    expect(afterGraph?.props).toMatchObject({
      embeddedConnectionQuery: {
        query: {
          symbols: ["$(table-1).activeRow.symbol"],
        },
      },
    });
    expect(afterManagedSource?.props).toMatchObject({
      query: {
        symbols: ["$(table-1).activeRow.symbol"],
      },
    });
  });
});
