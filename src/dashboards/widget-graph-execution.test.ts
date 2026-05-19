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
  listDashboardRefreshableExecutionTargets,
  planDashboardVariableDrivenCommit,
  resolveDashboardUpstreamRequirement,
} from "@/dashboards/widget-graph-execution";
import { TABULAR_SEED_INPUT_ID } from "@/widgets/shared/incremental-tabular-consumer";
import type { AnyManagedConnectionConsumerAdapter } from "@/widgets/shared/managed-connection-consumer";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";
import { CORE_VALUE_JSON_CONTRACT, CORE_VALUE_STRING_CONTRACT } from "@/widgets/shared/value-contracts";
import { defineWidget, type WidgetDefinition } from "@/widgets/types";

const TEST_CONNECTION_TYPE_ID = "test.mock-api";
const TEST_CONNECTION_ID = 9001;
const TEST_QUERY_KIND = "test-query";

const testGraphManagedConnectionConsumerAdapter = {
  widgetId: "graph",
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
  id: "connection-query",
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

const tableLikeWidget = defineWidget({
  id: "table",
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
        resolveValue: ({ resolvedInputs }) => {
          const input = resolvedInputs?.[TABULAR_SEED_INPUT_ID];
          const resolved = Array.isArray(input) ? input[0] : input;
          const value = resolved?.value;
          const rows =
            value &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            Array.isArray((value as { rows?: unknown }).rows)
              ? (value as { rows: unknown[] }).rows
              : [];

          return rows[0] ?? null;
        },
      },
    ],
  },
});

const graphLikeWidget = defineWidget({
  id: "graph",
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
  [consumerWidget.id, consumerWidget],
  [variableSourceWidget.id, variableSourceWidget],
  [variableConsumerWidget.id, variableConsumerWidget],
  [variableExecutionTargetWidget.id, variableExecutionTargetWidget],
  [connectionQueryLikeWidget.id, connectionQueryLikeWidget],
  [tableLikeWidget.id, tableLikeWidget],
  [graphLikeWidget.id, graphLikeWidget],
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
      widgetId: "graph",
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
      widgetId: "connection-query",
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
      widgetId: "graph",
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
      widgetId: "connection-query",
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

function managedGraphViaTableVariableWidgets(symbol: string): DashboardWidgetInstance[] {
  const embeddedConnectionQuery = {
    connectionRef: {
      id: TEST_CONNECTION_ID,
      typeId: TEST_CONNECTION_TYPE_ID,
    },
    queryModelId: TEST_QUERY_KIND,
    query: {
      kind: TEST_QUERY_KIND,
      symbols: ["$(table-1).activeRow.symbol"],
      responseBody: [{ symbol }],
    },
    timeRangeMode: "none",
  };

  return [
    {
      id: "upstream-source-1",
      widgetId: "connection-query",
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
      id: "table-1",
      widgetId: "table",
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
      id: "graph-1",
      widgetId: "graph",
      title: "Graph",
      layout: { cols: 6, rows: 4 },
      props: {
        graphSourceMode: "connection",
        embeddedConnectionQuery,
      },
      bindings: {
        [buildWidgetReferencePropInputId(["embeddedConnectionQuery", "query", "symbols"])]: {
          sourceWidgetId: "table-1",
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
      widgetId: "connection-query",
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
        widgetId: "connection-query",
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
        widgetId: "table",
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
        widgetId: "connection-query",
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
        widgetId === "graph" ? testGraphManagedConnectionConsumerAdapter : null,
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
        widgetId === "graph" ? testGraphManagedConnectionConsumerAdapter : null,
    });

    expect(plan.changedVariableEntries).toEqual([]);
    expect(plan.affectedConsumerWidgetIds).toEqual([]);
    expect(plan.passiveConsumerWidgetIds).toEqual([]);
    expect(plan.executableConsumerWidgetIds).toEqual([]);
    expect(plan.managedExecutableSourceWidgetIds).toEqual([]);
    expect(plan.executableTargetWidgetIds).toEqual([]);
    expect(plan.executableTargetOverridesByWidgetId).toEqual({});
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
        widgetId === "graph" ? testGraphManagedConnectionConsumerAdapter : null,
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
        widgetId === "graph" ? testGraphManagedConnectionConsumerAdapter : null,
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
        widgetId === "graph" ? testGraphManagedConnectionConsumerAdapter : null,
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
        widgetId === "graph" ? testGraphManagedConnectionConsumerAdapter : null,
    });

    expect(plan.changedVariableEntries).toEqual([]);
    expect(plan.affectedConsumerWidgetIds).toEqual([]);
    expect(plan.passiveConsumerWidgetIds).toEqual([]);
    expect(plan.executableConsumerWidgetIds).toEqual([]);
    expect(plan.managedExecutableSourceWidgetIds).toEqual([]);
    expect(plan.executableTargetWidgetIds).toEqual([]);
    expect(plan.executableTargetOverridesByWidgetId).toEqual({});
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
        widgetId === "graph" ? testGraphManagedConnectionConsumerAdapter : null,
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
