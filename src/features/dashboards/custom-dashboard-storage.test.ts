import { describe, expect, it } from "vitest";

import { buildDashboardExecutionSnapshot, listDashboardWidgetExecutionOrder } from "@/dashboards/widget-graph-execution";
import { createDashboardWidgetDependencyModel } from "@/dashboards/widget-dependencies";
import type { DashboardDefinition, DashboardWidgetInstance } from "@/dashboards/types";
import {
  WORKSPACE_ROW_WIDGET_ID,
  WORKSPACE_SLIDE_WIDGET_ID,
} from "@/dashboards/structural-widgets";
import { defineWidget } from "@/widgets/types";
import {
  WORKSPACE_SLIDE_GRID_COLUMNS,
  WORKSPACE_SLIDE_GRID_ROW_HEIGHT,
} from "@/widgets/core/workspace-slide/slide-model";

import {
  createManagedDashboardWidget,
  detachManagedDashboardWidget,
  duplicateDashboardWidget,
  duplicateManagedDashboardWidgets,
  findManagedDashboardWidget,
  findManagedDashboardWidgets,
  moveDashboardWidgetToRootCanvas,
  moveDashboardWidgetToSlideRegion,
  removeDashboardWidget,
  removeManagedDashboardWidgets,
  sanitizeDashboardDefinition,
  updateDashboardWidgetRuntimeState,
  updateDashboardWidgetSettings,
  updateDashboardWidgetBindings,
  updateManagedDashboardWidget,
} from "./custom-dashboard-storage";

const TABULAR_CONTRACT = "core.tabular_frame@v1" as const;

const graphWidgetDefinition = defineWidget({
  id: "graph",
  widgetVersion: "1.0.0",
  title: "Graph",
  description: "Graph",
  category: "Core",
  kind: "chart",
  source: "test",
  component: () => null,
  io: {
    inputs: [
      {
        id: "sourceData",
        label: "Source data",
        accepts: [TABULAR_CONTRACT],
      },
    ],
  },
});

const connectionQueryWidgetDefinition = defineWidget({
  id: "connection-query",
  widgetVersion: "1.0.0",
  title: "Connection Query",
  description: "Connection Query",
  category: "Core",
  kind: "custom",
  source: "test",
  component: () => null,
  defaultPresentation: {
    placementMode: "sidebar",
  },
  io: {
    outputs: [
      {
        id: "dataset",
        label: "Dataset",
        contract: TABULAR_CONTRACT,
      },
    ],
  },
  execution: {
    execute: async () => ({
      status: "success",
      runtimeStatePatch: {
        status: "ready",
      },
    }),
    getExecutionKey: (context) => context.instanceId ?? context.widgetId,
  },
});

function dashboardWithWidgets(
  widgets: DashboardWidgetInstance[],
): DashboardDefinition {
  return sanitizeDashboardDefinition({
    id: "workspace-1",
    title: "Workspace",
    description: "Managed widget tests",
    source: "test",
    widgets,
  });
}

function graphWidget(
  id: string,
  position?: { x: number; y: number },
): DashboardWidgetInstance {
  return {
    id,
    widgetId: "graph",
    title: id,
    layout: {
      cols: 12,
      rows: 8,
    },
    position,
  };
}

function tableWidget(
  id: string,
  position?: { x: number; y: number },
): DashboardWidgetInstance {
  return {
    id,
    widgetId: "table",
    title: id,
    layout: {
      cols: 12,
      rows: 8,
    },
    position,
  };
}

function statisticWidget(
  id: string,
  position?: { x: number; y: number },
): DashboardWidgetInstance {
  return {
    id,
    widgetId: "statistic",
    title: id,
    layout: {
      cols: 12,
      rows: 8,
    },
    position,
  };
}

function slideWidget(
  id: string,
  position?: { x: number; y: number },
): DashboardWidgetInstance {
  return {
    id,
    widgetId: WORKSPACE_SLIDE_WIDGET_ID,
    title: id,
    layout: {
      cols: 48,
      rows: 48,
    },
    position,
    props: {},
  };
}

function rowWidget(
  id: string,
  children: DashboardWidgetInstance[],
  position?: { x: number; y: number },
): DashboardWidgetInstance {
  return {
    id,
    widgetId: WORKSPACE_ROW_WIDGET_ID,
    title: id,
    layout: {
      cols: 12,
      rows: 2,
    },
    position,
    row: {
      collapsed: false,
      children,
    },
  };
}

function connectionQueryWidget(
  id: string,
  title = "Connection Query",
): DashboardWidgetInstance {
  return {
    id,
    widgetId: "connection-query",
    title,
    layout: {
      cols: 12,
      rows: 8,
    },
    position: {
      x: 0,
      y: 0,
    },
  };
}

function buildRuntimeDataRef(version: number, updatedAtMs: number) {
  return {
    kind: "runtime-data-ref" as const,
    refId: "ohlc-1:dataset",
    workspaceRuntimeId: "workspace-runtime",
    ownerId: "ohlc-1",
    outputId: "dataset",
    contractId: TABULAR_CONTRACT,
    version,
    rowCount: 2,
    schemaSignature: "schema-v1",
    updatedAtMs,
    columns: ["openTime", "open", "high", "low", "close"],
    status: "ready" as const,
  };
}

function buildRefBackedRuntimeState(input: {
  sourceUpdatedAtMs: number;
  refVersion: number;
  refUpdatedAtMs: number;
}) {
  const outputRef = buildRuntimeDataRef(input.refVersion, input.refUpdatedAtMs);

  return {
    status: "ready",
    columns: ["openTime", "open", "high", "low", "close"],
    rows: [],
    runtimeDataRef: outputRef,
    source: {
      kind: "runtime-data-store",
      updatedAtMs: input.sourceUpdatedAtMs,
      context: {
        runtimeDataRef: outputRef,
        incrementalConsumer: {
          mode: "incremental-tabular-consumer",
          outputRef,
        },
      },
    },
  } satisfies Record<string, unknown>;
}

describe("custom dashboard storage managed widgets", () => {
  it("normalizes managed ownership and hidden rail visibility in workspace storage", () => {
    const normalized = sanitizeDashboardDefinition({
      id: "workspace-1",
      title: "Workspace",
      description: "Managed widget tests",
      source: "test",
      widgets: [
        {
          id: "connection-1",
          widgetId: "connection-query",
          title: "Hidden source",
          managedBy: {
            ownerInstanceId: " graph-1 ",
            role: "embedded-connection-source",
          },
          presentation: {
            placementMode: "sidebar",
            railVisibility: "hidden",
            surfaceMode: "transparent",
          },
          layout: {
            cols: 12,
            rows: 8,
          },
        },
        {
          id: "connection-2",
          widgetId: "connection-query",
          title: "Invalid hidden source",
          managedBy: {
            ownerInstanceId: "   ",
            role: "bad-role" as never,
          },
          presentation: {
            railVisibility: "bad" as never,
          },
          layout: {
            cols: 12,
            rows: 8,
          },
        },
      ],
    });

    expect(normalized.widgets[0]?.managedBy).toEqual({
      ownerInstanceId: "graph-1",
      role: "embedded-connection-source",
    });
    expect(normalized.widgets[0]?.presentation).toEqual({
      placementMode: "sidebar",
      railVisibility: "hidden",
      surfaceMode: "transparent",
    });
    expect(normalized.widgets[1]?.managedBy).toBeUndefined();
    expect(normalized.widgets[1]?.presentation).toBeUndefined();
  });

  it("ignores volatile runtime frame timestamps when comparing ref-backed runtime state", () => {
    const initialRuntimeState = buildRefBackedRuntimeState({
      sourceUpdatedAtMs: 1_000,
      refVersion: 4,
      refUpdatedAtMs: 2_000,
    });
    const dashboard = dashboardWithWidgets([
      {
        ...graphWidget("ohlc-1", { x: 0, y: 0 }),
        runtimeState: initialRuntimeState,
      },
    ]);

    const updated = updateDashboardWidgetRuntimeState(
      dashboard,
      "ohlc-1",
      buildRefBackedRuntimeState({
        sourceUpdatedAtMs: 3_000,
        refVersion: 4,
        refUpdatedAtMs: 4_000,
      }),
    );

    expect(updated).toBe(dashboard);
  });

  it("still writes runtime state when the ref-backed payload version changes", () => {
    const initialRuntimeState = buildRefBackedRuntimeState({
      sourceUpdatedAtMs: 1_000,
      refVersion: 4,
      refUpdatedAtMs: 2_000,
    });
    const dashboard = dashboardWithWidgets([
      {
        ...graphWidget("ohlc-1", { x: 0, y: 0 }),
        runtimeState: initialRuntimeState,
      },
    ]);

    const updated = updateDashboardWidgetRuntimeState(
      dashboard,
      "ohlc-1",
      buildRefBackedRuntimeState({
        sourceUpdatedAtMs: 3_000,
        refVersion: 5,
        refUpdatedAtMs: 4_000,
      }),
    );

    expect(updated).not.toBe(dashboard);
    expect(updated.widgets[0]?.runtimeState).toMatchObject({
      runtimeDataRef: {
        version: 5,
      },
    });
  });

  it("creates, updates, detaches, and removes managed widgets", () => {
    const dashboard = dashboardWithWidgets([
      graphWidget("graph-1", { x: 0, y: 0 }),
    ]);

    const created = createManagedDashboardWidget(dashboard, {
      ownerInstanceId: "graph-1",
      role: "embedded-connection-source",
      widget: connectionQueryWidgetDefinition,
      props: {
        queryModelId: "cpu",
      },
      title: "Graph 1 Source",
    });

    expect(created.widget).not.toBeNull();
    expect(created.widget?.managedBy).toEqual({
      ownerInstanceId: "graph-1",
      role: "embedded-connection-source",
    });
    expect(created.widget?.presentation).toMatchObject({
      placementMode: "sidebar",
      railVisibility: "hidden",
    });
    expect(
      findManagedDashboardWidget(created.dashboard, {
        ownerInstanceId: "graph-1",
        role: "embedded-connection-source",
      })?.id,
    ).toBe(created.widget?.id);

    const updated = updateManagedDashboardWidget(
      {
        ...created.dashboard,
        widgets: created.dashboard.widgets.map((widget) =>
          widget.id === created.widget?.id
            ? {
                ...widget,
                runtimeState: {
                  status: "ready",
                },
              }
            : widget,
        ),
      },
      created.widget!.id,
      {
        title: "Graph 1 Source Updated",
        props: {
          queryModelId: "memory",
        },
        presentation: {
          surfaceMode: "transparent",
        },
      },
    );

    expect(updated.widget?.title).toBe("Graph 1 Source Updated");
    expect(updated.widget?.props).toEqual({
      queryModelId: "memory",
    });
    expect(updated.widget?.runtimeState).toBeUndefined();
    expect(updated.widget?.presentation).toMatchObject({
      placementMode: "sidebar",
      railVisibility: "hidden",
      surfaceMode: "transparent",
    });

    const detached = detachManagedDashboardWidget(updated.dashboard, created.widget!.id);

    expect(detached.widget?.managedBy).toBeUndefined();
    expect(detached.widget?.presentation).toEqual({
      placementMode: "sidebar",
      surfaceMode: "transparent",
    });

    const removed = removeManagedDashboardWidgets(created.dashboard, {
      ownerInstanceId: "graph-1",
      role: "embedded-connection-source",
    });

    expect(
      findManagedDashboardWidgets(removed, {
        ownerInstanceId: "graph-1",
      }),
    ).toHaveLength(0);
    expect(removed.widgets).toHaveLength(1);
  });

  it("duplicates managed widgets for a new owner and remaps internal bindings", () => {
    const dashboard = dashboardWithWidgets([
      graphWidget("graph-1", { x: 0, y: 0 }),
      graphWidget("graph-2", { x: 12, y: 0 }),
    ]);

    const firstManaged = createManagedDashboardWidget(dashboard, {
      ownerInstanceId: "graph-1",
      role: "embedded-connection-source",
      widget: connectionQueryWidgetDefinition,
      title: "Managed Source A",
    });
    const secondManaged = createManagedDashboardWidget(firstManaged.dashboard, {
      ownerInstanceId: "graph-1",
      role: "embedded-connection-source",
      widget: connectionQueryWidgetDefinition,
      title: "Managed Source B",
      bindings: {
        sourceData: {
          sourceWidgetId: firstManaged.widget!.id,
          sourceOutputId: "dataset",
        },
      },
    });

    const duplicated = duplicateManagedDashboardWidgets(secondManaged.dashboard, {
      ownerInstanceId: "graph-1",
      nextOwnerInstanceId: "graph-2",
      role: "embedded-connection-source",
    });

    expect(duplicated.widgets).toHaveLength(2);
    expect(duplicated.widgets.map((widget) => widget.managedBy?.ownerInstanceId)).toEqual([
      "graph-2",
      "graph-2",
    ]);

    const duplicatedSecond = duplicated.widgets.find(
      (widget) => widget.title === "Managed Source B",
    );

    expect(duplicatedSecond?.bindings).toEqual({
      sourceData: {
        sourceWidgetId: duplicated.idMap.get(firstManaged.widget!.id),
        sourceOutputId: "dataset",
      },
    });
  });

  it("keeps hidden managed widgets in dependency extraction and execution planning", () => {
    const dashboard = dashboardWithWidgets([
      graphWidget("graph-1", { x: 0, y: 0 }),
    ]);
    const created = createManagedDashboardWidget(dashboard, {
      ownerInstanceId: "graph-1",
      role: "embedded-connection-source",
      widget: connectionQueryWidgetDefinition,
      title: "Managed Source",
    });
    const boundDashboard = updateDashboardWidgetBindings(
      created.dashboard,
      "graph-1",
      {
        sourceData: {
          sourceWidgetId: created.widget!.id,
          sourceOutputId: "dataset",
        },
      },
    );
    const definitions = new Map([
      ["graph", graphWidgetDefinition],
      ["connection-query", connectionQueryWidgetDefinition],
    ]);
    const resolveWidgetDefinition = (widgetId: string) => definitions.get(widgetId);
    const dependencyModel = createDashboardWidgetDependencyModel(
      boundDashboard.widgets,
      resolveWidgetDefinition,
    );

    expect(
      dependencyModel.entries.map(({ instance }) => instance.id).sort(),
    ).toEqual(["graph-1", created.widget!.id].sort());
    expect(
      dependencyModel.graph.edges.some(
        (edge) =>
          edge.from === created.widget!.id &&
          edge.to === "graph-1" &&
          edge.status === "valid",
      ),
    ).toBe(true);

    const snapshot = buildDashboardExecutionSnapshot({
      widgets: boundDashboard.widgets,
      resolveWidgetDefinition,
    });

    expect(listDashboardWidgetExecutionOrder("graph-1", snapshot)).toEqual([
      created.widget!.id,
    ]);
  });

  it("creates and binds a managed connection-query source when graph connection mode is saved", () => {
    const dashboard = dashboardWithWidgets([
      graphWidget("graph-1", { x: 0, y: 0 }),
    ]);

    const updated = updateDashboardWidgetSettings(dashboard, "graph-1", {
      title: "CPU Graph",
      props: {
        graphSourceMode: "connection",
        embeddedConnectionQuery: {
          connectionRef: {
            id: 42,
            typeId: "prometheus",
          },
          queryModelId: "promql-range",
          query: {
            kind: "promql-range",
            expr: "rate(node_cpu_seconds_total[5m])",
          },
          incrementalRefreshMode: "incremental",
          incrementalTimeField: "timestamp",
          incrementalMergeKeyFields: ["timestamp", "cpu"],
        },
      },
    });

    const managedSource = findManagedDashboardWidget(updated, {
      ownerInstanceId: "graph-1",
      role: "embedded-connection-source",
    });
    const owner = updated.widgets.find((widget) => widget.id === "graph-1");

    expect(managedSource).not.toBeNull();
    expect(managedSource?.widgetId).toBe("connection-query");
    expect(managedSource?.title).toBe("CPU Graph Source");
    expect(managedSource?.props).toMatchObject({
      connectionRef: {
        id: 42,
        typeId: "prometheus",
      },
      queryModelId: "promql-range",
      incrementalRefreshMode: "incremental",
      incrementalTimeField: "timestamp",
      incrementalMergeKeyFields: ["timestamp", "cpu"],
    });
    expect(managedSource?.presentation).toMatchObject({
      placementMode: "sidebar",
      railVisibility: "hidden",
    });
    expect(owner?.bindings).toMatchObject({
      seedData: {
        sourceWidgetId: managedSource?.id,
        sourceOutputId: "dataset",
      },
    });
  });

  it("creates and binds a managed connection-stream-query source when graph stream mode is saved", () => {
    const dashboard = dashboardWithWidgets([
      graphWidget("graph-1", { x: 0, y: 0 }),
    ]);

    const updated = updateDashboardWidgetSettings(dashboard, "graph-1", {
      title: "Ticker Graph",
      props: {
        graphSourceMode: "connection-stream",
        embeddedConnectionQuery: {
          connectionRef: {
            id: 88,
            typeId: "binance",
          },
          query: {
            kind: "ticker",
            symbols: ["BTCUSDT"],
          },
          mergeKeyFields: ["symbol"],
          retentionMaxRows: 250,
        },
      },
    });

    const managedSource = findManagedDashboardWidget(updated, {
      ownerInstanceId: "graph-1",
      role: "embedded-connection-source",
    });
    const owner = updated.widgets.find((widget) => widget.id === "graph-1");

    expect(managedSource?.widgetId).toBe("connection-stream-query");
    expect(managedSource?.title).toBe("Ticker Graph Source");
    expect(managedSource?.props).toMatchObject({
      connectionRef: {
        id: 88,
        typeId: "binance",
      },
      mergeKeyFields: ["symbol"],
      retentionMaxRows: 250,
    });
    expect(owner?.bindings).toMatchObject({
      liveUpdates: {
        sourceWidgetId: managedSource?.id,
        sourceOutputId: "updates",
      },
    });
  });

  it("migrates legacy OHLC sourceData bindings to seedData", () => {
    const normalized = sanitizeDashboardDefinition({
      id: "workspace-ohlc",
      title: "OHLC Workspace",
      description: "Legacy OHLC binding migration",
      source: "test",
      widgets: [
        {
          id: "ohlc-1",
          widgetId: "main-sequence-ohlc-bars",
          title: "OHLC Bars",
          layout: {
            cols: 12,
            rows: 8,
          },
          bindings: {
            sourceData: {
              sourceWidgetId: "connection-1",
              sourceOutputId: "dataset",
            },
          },
        },
      ],
    });

    expect(normalized.widgets[0]?.bindings).toEqual({
      seedData: {
        sourceWidgetId: "connection-1",
        sourceOutputId: "dataset",
      },
    });
  });

  it("keeps managed stream mode from saving when the selected query model is not streamable", () => {
    const dashboard = dashboardWithWidgets([
      graphWidget("graph-1", { x: 0, y: 0 }),
    ]);

    const updated = updateDashboardWidgetSettings(dashboard, "graph-1", {
      props: {
        graphSourceMode: "connection-stream",
        embeddedConnectionQuery: {
          connectionRef: {
            id: 7,
            typeId: "unknown-connection-type",
          },
          queryModelId: "not-streamable",
          query: {
            kind: "not-streamable",
          },
        },
      },
    });

    const managedSource = findManagedDashboardWidget(updated, {
      ownerInstanceId: "graph-1",
      role: "embedded-connection-source",
    });
    const owner = updated.widgets.find((widget) => widget.id === "graph-1");

    expect(owner?.props?.graphSourceMode).toBe("connection");
    expect(managedSource?.widgetId).toBe("connection-query");
  });

  it("updates the existing managed connection-query source when graph connection settings change", () => {
    const dashboard = updateDashboardWidgetSettings(
      dashboardWithWidgets([graphWidget("graph-1", { x: 0, y: 0 })]),
      "graph-1",
      {
        title: "Latency Graph",
        props: {
          graphSourceMode: "connection",
          embeddedConnectionQuery: {
            connectionRef: {
              id: 7,
              typeId: "prometheus",
            },
            queryModelId: "promql-range",
            query: {
              kind: "promql-range",
              expr: "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            },
          },
        },
      },
    );
    const initialManagedSource = findManagedDashboardWidget(dashboard, {
      ownerInstanceId: "graph-1",
      role: "embedded-connection-source",
    });
    const dashboardWithRuntime = sanitizeDashboardDefinition({
      ...dashboard,
      widgets: dashboard.widgets.map((widget) =>
        widget.id === initialManagedSource?.id
          ? {
              ...widget,
              runtimeState: {
                status: "ready",
                columns: ["timestamp", "value"],
                rows: [{ timestamp: "2026-01-01T00:00:00Z", value: 10 }],
              },
            }
          : widget,
      ),
    });

    const updated = updateDashboardWidgetSettings(dashboardWithRuntime, "graph-1", {
      title: "Latency Graph v2",
      props: {
        graphSourceMode: "connection",
        embeddedConnectionQuery: {
          connectionRef: {
            id: 7,
            typeId: "prometheus",
          },
          queryModelId: "promql-range",
          query: {
            kind: "promql-range",
            expr: "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))",
          },
          maxRows: 5000,
          incrementalRefreshMode: "incremental",
          incrementalTimeField: "timestamp",
          incrementalMergeKeyFields: ["timestamp", "le"],
        },
      },
    });

    const managedSource = findManagedDashboardWidget(updated, {
      ownerInstanceId: "graph-1",
      role: "embedded-connection-source",
    });

    expect(managedSource?.id).toBe(initialManagedSource?.id);
    expect(managedSource?.title).toBe("Latency Graph v2 Source");
    expect(managedSource?.props).toMatchObject({
      maxRows: 5000,
      incrementalRefreshMode: "incremental",
      incrementalTimeField: "timestamp",
      incrementalMergeKeyFields: ["timestamp", "le"],
      query: {
        kind: "promql-range",
        expr: "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))",
      },
    });
    expect(managedSource?.runtimeState).toBeUndefined();
  });

  it("duplicates the graph-managed source and rebinds the duplicated graph", () => {
    const dashboard = updateDashboardWidgetSettings(
      dashboardWithWidgets([graphWidget("graph-1", { x: 0, y: 0 })]),
      "graph-1",
      {
        title: "CPU Graph",
        props: {
          graphSourceMode: "connection",
          embeddedConnectionQuery: {
            connectionRef: {
              id: 42,
              typeId: "prometheus",
            },
            queryModelId: "promql-range",
            query: {
              kind: "promql-range",
              expr: "rate(node_cpu_seconds_total[5m])",
            },
          },
        },
      },
    );
    const originalManagedSource = findManagedDashboardWidget(dashboard, {
      ownerInstanceId: "graph-1",
      role: "embedded-connection-source",
    });

    const duplicated = duplicateDashboardWidget(dashboard, "graph-1");
    const duplicatedGraph = duplicated.widgets.find(
      (widget) => widget.widgetId === "graph" && widget.id !== "graph-1",
    );

    expect(duplicatedGraph).toBeDefined();

    const duplicatedManagedSource = duplicatedGraph
      ? findManagedDashboardWidget(duplicated, {
          ownerInstanceId: duplicatedGraph.id,
          role: "embedded-connection-source",
        })
      : null;

    expect(duplicatedManagedSource).not.toBeNull();
    expect(duplicatedManagedSource?.id).not.toBe(originalManagedSource?.id);
    expect(duplicatedManagedSource?.props).toEqual(originalManagedSource?.props);
    expect(duplicatedGraph?.bindings).toMatchObject({
      seedData: {
        sourceWidgetId: duplicatedManagedSource?.id,
        sourceOutputId: "dataset",
      },
    });
  });

  it("removes the managed source when the graph owner is deleted", () => {
    const dashboard = updateDashboardWidgetSettings(
      dashboardWithWidgets([graphWidget("graph-1", { x: 0, y: 0 })]),
      "graph-1",
      {
        props: {
          graphSourceMode: "connection",
          embeddedConnectionQuery: {
            connectionRef: {
              id: 42,
              typeId: "prometheus",
            },
            queryModelId: "promql-range",
            query: {
              kind: "promql-range",
              expr: "up",
            },
          },
        },
      },
    );

    const removed = removeDashboardWidget(dashboard, "graph-1");

    expect(removed.widgets.some((widget) => widget.id === "graph-1")).toBe(false);
    expect(
      findManagedDashboardWidgets(removed, {
        ownerInstanceId: "graph-1",
        role: "embedded-connection-source",
      }),
    ).toHaveLength(0);
  });

  it("keeps explicit source bindings unchanged for backward-compatible bound graphs", () => {
    const dashboard = updateDashboardWidgetBindings(
      dashboardWithWidgets([
        graphWidget("graph-1", { x: 0, y: 0 }),
        connectionQueryWidget("source-explicit", "Shared Source"),
      ]),
      "graph-1",
      {
        sourceData: {
          sourceWidgetId: "source-explicit",
          sourceOutputId: "dataset",
        },
      },
    );

    const updated = updateDashboardWidgetSettings(dashboard, "graph-1", {
      props: {
        provider: "echarts",
      },
    });
    const owner = updated.widgets.find((widget) => widget.id === "graph-1");

    expect(owner?.bindings).toEqual({
      sourceData: {
        sourceWidgetId: "source-explicit",
        sourceOutputId: "dataset",
      },
    });
    expect(
      findManagedDashboardWidgets(updated, {
        ownerInstanceId: "graph-1",
        role: "embedded-connection-source",
      }),
    ).toHaveLength(0);
  });

  it("creates and binds a managed connection-query source when table connection mode is saved", () => {
    const dashboard = dashboardWithWidgets([
      tableWidget("table-1", { x: 0, y: 0 }),
    ]);

    const updated = updateDashboardWidgetSettings(dashboard, "table-1", {
      title: "Orders Table",
      props: {
        tableSourceMode: "connection",
        embeddedConnectionQuery: {
          connectionRef: {
            id: 101,
            typeId: "postgresql",
          },
          queryModelId: "sql",
          query: {
            kind: "sql",
            sql: "select * from orders limit 100",
          },
          maxRows: 100,
        },
      },
    });

    const managedSource = findManagedDashboardWidget(updated, {
      ownerInstanceId: "table-1",
      role: "embedded-connection-source",
    });
    const owner = updated.widgets.find((widget) => widget.id === "table-1");

    expect(managedSource?.widgetId).toBe("connection-query");
    expect(managedSource?.title).toBe("Orders Table Source");
    expect(managedSource?.props).toMatchObject({
      connectionRef: {
        id: 101,
        typeId: "postgresql",
      },
      queryModelId: "sql",
      maxRows: 100,
    });
    expect(owner?.bindings).toMatchObject({
      seedData: {
        sourceWidgetId: managedSource?.id,
        sourceOutputId: "dataset",
      },
    });
  });

  it("updates the existing managed connection-query source when table connection settings change", () => {
    const dashboard = updateDashboardWidgetSettings(
      dashboardWithWidgets([tableWidget("table-1", { x: 0, y: 0 })]),
      "table-1",
      {
        title: "Orders Table",
        props: {
          tableSourceMode: "connection",
          embeddedConnectionQuery: {
            connectionRef: {
              id: 101,
              typeId: "postgresql",
            },
            queryModelId: "sql",
            query: {
              kind: "sql",
              sql: "select * from orders limit 100",
            },
          },
        },
      },
    );
    const initialManagedSource = findManagedDashboardWidget(dashboard, {
      ownerInstanceId: "table-1",
      role: "embedded-connection-source",
    });

    const updated = updateDashboardWidgetSettings(dashboard, "table-1", {
      title: "Orders Table v2",
      props: {
        tableSourceMode: "connection",
        embeddedConnectionQuery: {
          connectionRef: {
            id: 101,
            typeId: "postgresql",
          },
          queryModelId: "sql",
          query: {
            kind: "sql",
            sql: "select id, status from orders limit 50",
          },
          maxRows: 50,
        },
      },
    });
    const managedSource = findManagedDashboardWidget(updated, {
      ownerInstanceId: "table-1",
      role: "embedded-connection-source",
    });

    expect(managedSource?.id).toBe(initialManagedSource?.id);
    expect(managedSource?.title).toBe("Orders Table v2 Source");
    expect(managedSource?.props).toMatchObject({
      maxRows: 50,
      query: {
        kind: "sql",
        sql: "select id, status from orders limit 50",
      },
    });
  });

  it("removes the managed table source and binding when the table switches to manual mode", () => {
    const dashboard = updateDashboardWidgetSettings(
      dashboardWithWidgets([tableWidget("table-1", { x: 0, y: 0 })]),
      "table-1",
      {
        props: {
          tableSourceMode: "connection",
          embeddedConnectionQuery: {
            connectionRef: {
              id: 101,
              typeId: "postgresql",
            },
            queryModelId: "sql",
            query: {
              kind: "sql",
              sql: "select * from orders",
            },
          },
        },
      },
    );

    const updated = updateDashboardWidgetSettings(dashboard, "table-1", {
      props: {
        tableSourceMode: "manual",
        manualColumns: [{ key: "name", type: "string" }],
        manualRows: [{ name: "alpha" }],
      },
    });
    const owner = updated.widgets.find((widget) => widget.id === "table-1");

    expect(owner?.bindings).toBeUndefined();
    expect(owner?.props).toMatchObject({
      tableSourceMode: "manual",
      manualColumns: [{ key: "name", type: "string" }],
      manualRows: [{ name: "alpha" }],
    });
    expect(
      findManagedDashboardWidgets(updated, {
        ownerInstanceId: "table-1",
        role: "embedded-connection-source",
      }),
    ).toHaveLength(0);
  });

  it("duplicates the table-managed source and rebinds the duplicated table", () => {
    const dashboard = updateDashboardWidgetSettings(
      dashboardWithWidgets([tableWidget("table-1", { x: 0, y: 0 })]),
      "table-1",
      {
        title: "Orders Table",
        props: {
          tableSourceMode: "connection",
          embeddedConnectionQuery: {
            connectionRef: {
              id: 101,
              typeId: "postgresql",
            },
            queryModelId: "sql",
            query: {
              kind: "sql",
              sql: "select * from orders",
            },
          },
        },
      },
    );
    const originalManagedSource = findManagedDashboardWidget(dashboard, {
      ownerInstanceId: "table-1",
      role: "embedded-connection-source",
    });

    const duplicated = duplicateDashboardWidget(dashboard, "table-1");
    const duplicatedTable = duplicated.widgets.find(
      (widget) => widget.widgetId === "table" && widget.id !== "table-1",
    );
    const duplicatedManagedSource = duplicatedTable
      ? findManagedDashboardWidget(duplicated, {
          ownerInstanceId: duplicatedTable.id,
          role: "embedded-connection-source",
        })
      : null;

    expect(duplicatedManagedSource?.id).not.toBe(originalManagedSource?.id);
    expect(duplicatedManagedSource?.props).toEqual(originalManagedSource?.props);
    expect(duplicatedTable?.bindings).toMatchObject({
      seedData: {
        sourceWidgetId: duplicatedManagedSource?.id,
        sourceOutputId: "dataset",
      },
    });
  });

  it("removes the managed source when the table owner is deleted", () => {
    const dashboard = updateDashboardWidgetSettings(
      dashboardWithWidgets([tableWidget("table-1", { x: 0, y: 0 })]),
      "table-1",
      {
        props: {
          tableSourceMode: "connection",
          embeddedConnectionQuery: {
            connectionRef: {
              id: 101,
              typeId: "postgresql",
            },
            queryModelId: "sql",
            query: {
              kind: "sql",
              sql: "select * from orders",
            },
          },
        },
      },
    );

    const removed = removeDashboardWidget(dashboard, "table-1");

    expect(removed.widgets.some((widget) => widget.id === "table-1")).toBe(false);
    expect(
      findManagedDashboardWidgets(removed, {
        ownerInstanceId: "table-1",
        role: "embedded-connection-source",
      }),
    ).toHaveLength(0);
  });

  it("duplicates slide-contained widgets recursively and remaps internal slide bindings", () => {
    const dashboard = dashboardWithWidgets([
      slideWidget("slide-1", { x: 0, y: 0 }),
      {
        ...connectionQueryWidget("connection-1", "Slide Source"),
        slidePlacement: {
          slideWidgetId: "slide-1",
          region: "body",
        },
        position: {
          x: 0,
          y: 0,
        },
      },
      {
        ...rowWidget(
          "row-1",
          [
            {
              ...graphWidget("graph-child"),
              bindings: {
                sourceData: {
                  sourceWidgetId: "connection-1",
                  sourceOutputId: "dataset",
                },
              },
            },
          ],
          { x: 0, y: 8 },
        ),
        slidePlacement: {
          slideWidgetId: "slide-1",
          region: "body",
        },
      },
    ]);

    const duplicated = duplicateDashboardWidget(dashboard, "slide-1");

    const duplicatedSlide = duplicated.widgets.find(
      (widget) => widget.widgetId === WORKSPACE_SLIDE_WIDGET_ID && widget.id !== "slide-1",
    );
    const duplicatedSource = duplicated.widgets.find(
      (widget) =>
        widget.id !== "connection-1" &&
        widget.title === "Slide Source" &&
        widget.slidePlacement?.slideWidgetId === duplicatedSlide?.id,
    );
    const duplicatedRow = duplicated.widgets.find(
      (widget) =>
        widget.id !== "row-1" &&
        widget.widgetId === WORKSPACE_ROW_WIDGET_ID &&
        widget.slidePlacement?.slideWidgetId === duplicatedSlide?.id,
    );
    const duplicatedGraph = duplicatedRow?.row?.children?.find(
      (child) => child.id !== "graph-child" && child.widgetId === "graph",
    );

    expect(duplicatedSlide).toBeDefined();
    expect(duplicatedSource?.slidePlacement).toEqual({
      slideWidgetId: duplicatedSlide?.id,
      region: "body",
    });
    expect(duplicatedRow?.slidePlacement).toEqual({
      slideWidgetId: duplicatedSlide?.id,
      region: "body",
    });
    expect(duplicatedRow?.position?.x).toBe(0);
    expect(typeof duplicatedRow?.position?.y).toBe("number");
    expect((duplicatedRow?.position?.y ?? 0)).toBeGreaterThanOrEqual(
      duplicatedSource?.position?.y ?? 0,
    );
    expect(duplicatedGraph?.bindings).toMatchObject({
      seedData: {
        sourceWidgetId: duplicatedSource?.id,
        sourceOutputId: "dataset",
      },
    });
  });

  it("moves a slide widget back to the root canvas and clears slide placement", () => {
    const dashboard = dashboardWithWidgets([
      slideWidget("slide-1", { x: 0, y: 0 }),
      {
        ...graphWidget("graph-1"),
        slidePlacement: {
          slideWidgetId: "slide-1",
          region: "body",
        },
        position: {
          x: 2,
          y: 3,
        },
      },
    ]);

    const moved = moveDashboardWidgetToRootCanvas(
      dashboard,
      "graph-1",
      {
        x: 18,
        y: 60,
        w: 6,
        h: 4,
      },
      {
        sourceColumns: WORKSPACE_SLIDE_GRID_COLUMNS,
        sourceRowHeight: WORKSPACE_SLIDE_GRID_ROW_HEIGHT,
      },
    );

    const graph = moved.widgets.find((widget) => widget.id === "graph-1");

    expect(graph?.slidePlacement).toBeUndefined();
    expect(graph?.position?.x).toBe(18);
    expect(graph?.position?.y).toBeGreaterThanOrEqual(60);
    expect(graph?.layout).toEqual({
      cols: 24,
      rows: 7,
    });
  });

  it("reassigns a slide widget to a different slide region", () => {
    const dashboard = dashboardWithWidgets([
      slideWidget("slide-1", { x: 0, y: 0 }),
      slideWidget("slide-2", { x: 0, y: 60 }),
      {
        ...graphWidget("graph-1"),
        slidePlacement: {
          slideWidgetId: "slide-1",
          region: "body",
        },
        position: {
          x: 0,
          y: 0,
        },
      },
    ]);

    const moved = moveDashboardWidgetToSlideRegion(
      dashboard,
      "graph-1",
      "slide-2",
      "right",
      {
        x: 4,
        y: 5,
        w: 12,
        h: 8,
      },
    );

    const graph = moved.widgets.find((widget) => widget.id === "graph-1");

    expect(graph?.slidePlacement).toEqual({
      slideWidgetId: "slide-2",
      region: "right",
    });
  });

  it("keeps explicit source bindings unchanged for backward-compatible bound tables", () => {
    const dashboard = updateDashboardWidgetBindings(
      dashboardWithWidgets([
        tableWidget("table-1", { x: 0, y: 0 }),
        connectionQueryWidget("source-explicit", "Shared Source"),
      ]),
      "table-1",
      {
        sourceData: {
          sourceWidgetId: "source-explicit",
          sourceOutputId: "dataset",
        },
      },
    );

    const updated = updateDashboardWidgetSettings(dashboard, "table-1", {
      props: {
        density: "compact",
      },
    });
    const owner = updated.widgets.find((widget) => widget.id === "table-1");

    expect(owner?.bindings).toEqual({
      sourceData: {
        sourceWidgetId: "source-explicit",
        sourceOutputId: "dataset",
      },
    });
    expect(
      findManagedDashboardWidgets(updated, {
        ownerInstanceId: "table-1",
        role: "embedded-connection-source",
      }),
    ).toHaveLength(0);
  });

  it("creates and binds a managed connection-query source when statistic connection mode is saved", () => {
    const dashboard = dashboardWithWidgets([
      statisticWidget("stat-1", { x: 0, y: 0 }),
    ]);

    const updated = updateDashboardWidgetSettings(dashboard, "stat-1", {
      title: "Yield KPI",
      props: {
        statisticSourceMode: "connection",
        embeddedConnectionQuery: {
          connectionRef: {
            id: 77,
            typeId: "prometheus",
          },
          queryModelId: "promql-range",
          query: {
            kind: "promql-range",
            expr: "avg(rate(cpu_usage_seconds_total[5m]))",
          },
        },
      },
    });

    const managedSource = findManagedDashboardWidget(updated, {
      ownerInstanceId: "stat-1",
      role: "embedded-connection-source",
    });
    const owner = updated.widgets.find((widget) => widget.id === "stat-1");

    expect(managedSource?.title).toBe("Yield KPI Source");
    expect(managedSource?.props).toMatchObject({
      connectionRef: {
        id: 77,
        typeId: "prometheus",
      },
      queryModelId: "promql-range",
    });
    expect(owner?.bindings).toMatchObject({
      seedData: {
        sourceWidgetId: managedSource?.id,
        sourceOutputId: "dataset",
      },
    });
  });

  it("duplicates and removes the managed source for statistic widgets", () => {
    const dashboard = updateDashboardWidgetSettings(
      dashboardWithWidgets([statisticWidget("stat-1", { x: 0, y: 0 })]),
      "stat-1",
      {
        props: {
          statisticSourceMode: "connection",
          embeddedConnectionQuery: {
            connectionRef: {
              id: 77,
              typeId: "prometheus",
            },
            queryModelId: "promql-range",
            query: {
              kind: "promql-range",
              expr: "up",
            },
          },
        },
      },
    );
    const originalManagedSource = findManagedDashboardWidget(dashboard, {
      ownerInstanceId: "stat-1",
      role: "embedded-connection-source",
    });

    const duplicated = duplicateDashboardWidget(dashboard, "stat-1");
    const duplicatedStatistic = duplicated.widgets.find(
      (widget) => widget.widgetId === "statistic" && widget.id !== "stat-1",
    );
    const duplicatedManagedSource = duplicatedStatistic
      ? findManagedDashboardWidget(duplicated, {
          ownerInstanceId: duplicatedStatistic.id,
          role: "embedded-connection-source",
        })
      : null;

    expect(duplicatedManagedSource?.id).not.toBe(originalManagedSource?.id);
    expect(duplicatedStatistic?.bindings).toMatchObject({
      seedData: {
        sourceWidgetId: duplicatedManagedSource?.id,
        sourceOutputId: "dataset",
      },
    });

    const removed = removeDashboardWidget(dashboard, "stat-1");

    expect(
      findManagedDashboardWidgets(removed, {
        ownerInstanceId: "stat-1",
        role: "embedded-connection-source",
      }),
    ).toHaveLength(0);
  });

  it("keeps explicit source bindings unchanged for backward-compatible bound statistics", () => {
    const dashboard = updateDashboardWidgetBindings(
      dashboardWithWidgets([
        statisticWidget("stat-1", { x: 0, y: 0 }),
        connectionQueryWidget("source-explicit", "Shared Source"),
      ]),
      "stat-1",
      {
        sourceData: {
          sourceWidgetId: "source-explicit",
          sourceOutputId: "dataset",
        },
      },
    );

    const updated = updateDashboardWidgetSettings(dashboard, "stat-1", {
      props: {
        statisticMode: "max",
      },
    });
    const owner = updated.widgets.find((widget) => widget.id === "stat-1");

    expect(owner?.bindings).toEqual({
      sourceData: {
        sourceWidgetId: "source-explicit",
        sourceOutputId: "dataset",
      },
    });
    expect(
      findManagedDashboardWidgets(updated, {
        ownerInstanceId: "stat-1",
        role: "embedded-connection-source",
      }),
    ).toHaveLength(0);
  });
});
