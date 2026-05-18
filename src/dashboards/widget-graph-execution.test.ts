import { describe, expect, it } from "vitest";

import type { DashboardWidgetInstance } from "@/dashboards/types";
import {
  WIDGET_REFERENCE_PROPS_OUTPUT_ID,
  buildWidgetReferencePropInputId,
} from "@/dashboards/widget-instance-references";
import {
  buildDashboardExecutionSnapshot,
  executeDashboardWidgetGraph,
  listDashboardRefreshableExecutionTargets,
  planDashboardVariableDrivenCommit,
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
import { CORE_VALUE_STRING_CONTRACT } from "@/widgets/shared/value-contracts";
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

const definitions = new Map<string, WidgetDefinition>([
  [sourceWidget.id, sourceWidget],
  [consumerWidget.id, consumerWidget],
  [variableSourceWidget.id, variableSourceWidget],
  [variableConsumerWidget.id, variableConsumerWidget],
  [variableExecutionTargetWidget.id, variableExecutionTargetWidget],
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
    expect(plan.executableTargetWidgetIds).toEqual(["variable-execution-target-1"]);
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
    });

    expect(plan.changedVariableEntries).toEqual([]);
    expect(plan.affectedConsumerWidgetIds).toEqual([]);
    expect(plan.passiveConsumerWidgetIds).toEqual([]);
    expect(plan.executableConsumerWidgetIds).toEqual([]);
    expect(plan.executableTargetWidgetIds).toEqual([]);
  });
});
