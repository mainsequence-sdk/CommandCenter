import { describe, expect, it } from "vitest";

import type { DashboardWidgetInstance } from "@/dashboards/types";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";
import {
  createRuntimeDataStore,
  materializeRuntimeTabularFrame,
  storeTabularFrameRuntimeState,
} from "@/widgets/shared/runtime-data-store";
import { defineWidget, type WidgetDefinition } from "@/widgets/types";

import { createDashboardWidgetDependencyModel } from "./widget-dependencies";

const graphWidget = defineWidget({
  id: "graph",
  widgetVersion: "1.0.0",
  title: "Graph",
  description: "Graph",
  category: "Core",
  kind: "chart",
  source: "core",
  io: {
    inputs: [
      {
        id: "sourceData",
        label: "Source data",
        accepts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
      },
    ],
  },
  buildAgentSnapshot: () => ({
    displayKind: "chart",
    state: "idle",
    summary: "Graph test widget.",
  }),
  component: () => null,
});

const connectionQueryWidget = defineWidget({
  id: "connection-query",
  widgetVersion: "1.0.0",
  title: "Connection Query",
  description: "Connection Query",
  category: "Core",
  kind: "custom",
  source: "core",
  io: {
    outputs: [
      {
        id: "dataset",
        label: "Dataset",
        contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        resolveValue: ({ runtimeState }) => runtimeState,
      },
    ],
  },
  buildAgentSnapshot: () => ({
    displayKind: "custom",
    state: "idle",
    summary: "Connection query test widget.",
  }),
  component: () => null,
});

const widgetDefinitions = new Map<string, WidgetDefinition>([
  ["graph", graphWidget],
  ["connection-query", connectionQueryWidget],
]);

function resolveWidgetDefinition(widgetId: string) {
  return widgetDefinitions.get(widgetId);
}

function widget(overrides: Partial<DashboardWidgetInstance>): DashboardWidgetInstance {
  return {
    id: "widget-1",
    widgetId: "graph",
    layout: {
      cols: 8,
      rows: 6,
    },
    ...overrides,
  };
}

describe("createDashboardWidgetDependencyModel", () => {
  it("marks widgets that own hidden managed connection sources", () => {
    const widgets: DashboardWidgetInstance[] = [
      widget({
        id: "graph-1",
        widgetId: "graph",
        bindings: {
          sourceData: {
            sourceWidgetId: "managed-1",
            sourceOutputId: "dataset",
          },
        },
      }),
      widget({
        id: "managed-1",
        widgetId: "connection-query",
        managedBy: {
          ownerInstanceId: "graph-1",
          role: "embedded-connection-source",
        },
        presentation: {
          placementMode: "sidebar",
          railVisibility: "hidden",
        },
      }),
    ];

    const model = createDashboardWidgetDependencyModel(widgets, resolveWidgetDefinition);
    const ownerNode = model.graph.nodes.find((node) => node.id === "graph-1");
    const managedNode = model.graph.nodes.find((node) => node.id === "managed-1");

    expect(ownerNode?.ownedManagedConnectionSourceCount).toBe(1);
    expect(managedNode?.managedRole).toBe("embedded-connection-source");
    expect(managedNode?.hiddenFromNormalRail).toBe(true);
  });

  it("propagates runtime data refs without materializing identity bindings", () => {
    const runtimeDataStore = createRuntimeDataStore("workspace-1");
    const sourceRuntimeState = storeTabularFrameRuntimeState({
      frame: {
        status: "ready",
        columns: ["id", "value"],
        rows: [
          { id: "a", value: 1 },
          { id: "b", value: 2 },
        ],
        source: {
          kind: "test-frame",
        },
      },
      ownerId: "source-1",
      outputId: "dataset",
      store: runtimeDataStore,
    });
    const widgets: DashboardWidgetInstance[] = [
      widget({
        id: "graph-1",
        widgetId: "graph",
        bindings: {
          sourceData: {
            sourceWidgetId: "source-1",
            sourceOutputId: "dataset",
          },
        },
      }),
      widget({
        id: "source-1",
        widgetId: "connection-query",
        runtimeState: sourceRuntimeState as unknown as Record<string, unknown>,
      }),
    ];

    const model = createDashboardWidgetDependencyModel(widgets, resolveWidgetDefinition, {
      runtimeDataStore,
    });
    const input = model.resolveInputs("graph-1")?.sourceData;
    const resolvedInput = Array.isArray(input) ? input[0] : input;

    expect(resolvedInput?.status).toBe("valid");
    expect(resolvedInput?.valueRef?.rowCount).toBe(2);
    expect(materializeRuntimeTabularFrame(resolvedInput?.value, runtimeDataStore)?.rows).toEqual([
      { id: "a", value: 1 },
      { id: "b", value: 2 },
    ]);
    expect(
      (resolvedInput?.value as { rows?: Array<Record<string, unknown>> } | undefined)?.rows,
    ).toEqual([]);
  });
});
