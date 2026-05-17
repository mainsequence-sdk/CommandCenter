import { describe, expect, it } from "vitest";

import type { DashboardWidgetInstance } from "@/dashboards/types";
import {
  buildDashboardExecutionSnapshot,
  executeDashboardWidgetGraph,
  listDashboardRefreshableExecutionTargets,
  resolveDashboardUpstreamRequirement,
} from "@/dashboards/widget-graph-execution";
import { getWidgetById } from "@/app/registry";
import {
  MOCK_API_CONNECTION_TYPE_ID,
  MOCK_API_LOCAL_INSTANCE_ID,
  MOCK_API_QUERY_KIND,
} from "@/connections/mock-api";
import { TABULAR_SEED_INPUT_ID } from "@/widgets/shared/incremental-tabular-consumer";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";
import { defineWidget, type WidgetDefinition } from "@/widgets/types";

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

const definitions = new Map<string, WidgetDefinition>([
  [sourceWidget.id, sourceWidget],
  [consumerWidget.id, consumerWidget],
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

  it("refreshes an actual Mock API connection source through a passive table consumer", async () => {
    const mockWidgets: DashboardWidgetInstance[] = [
      {
        id: "mock-source-1",
        widgetId: "connection-query",
        title: "Mock source",
        layout: { cols: 6, rows: 4 },
        props: {
          connectionRef: {
            id: MOCK_API_LOCAL_INSTANCE_ID,
            typeId: MOCK_API_CONNECTION_TYPE_ID,
          },
          queryModelId: MOCK_API_QUERY_KIND,
          query: {
            kind: MOCK_API_QUERY_KIND,
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
      resolveWidgetDefinition: getWidgetById,
      refreshCycleId: "test-refresh",
    });

    expect(refreshTargets).toEqual(["table-1"]);

    const result = await executeDashboardWidgetGraph({
      scopeId: "workspace-test",
      executionSurface: "private-dashboard",
      widgets: workingWidgets,
      resolveWidgetDefinition: getWidgetById,
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
});
