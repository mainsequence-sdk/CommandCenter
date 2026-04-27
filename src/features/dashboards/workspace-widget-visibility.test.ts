import { describe, expect, it } from "vitest";

import type { DashboardWidgetDependencyGraph } from "@/dashboards/widget-dependencies";
import type { DashboardWidgetInstance } from "@/dashboards/types";

import {
  isManagedDashboardWidgetHiddenFromNormalRail,
  resolveVisibleWorkspaceGraph,
  resolveWorkspaceWidgetRailVisibility,
} from "./workspace-widget-visibility";

function widget(overrides: Partial<DashboardWidgetInstance> = {}): DashboardWidgetInstance {
  return {
    id: "widget-1",
    widgetId: "graph",
    layout: {
      cols: 12,
      rows: 8,
    },
    ...overrides,
  };
}

describe("workspace widget visibility", () => {
  it("treats hidden rail visibility as visible by default and hides only managed widgets from the normal rail", () => {
    expect(resolveWorkspaceWidgetRailVisibility(undefined)).toBe("visible");
    expect(
      isManagedDashboardWidgetHiddenFromNormalRail(
        widget({
          presentation: {
            railVisibility: "hidden",
          },
        }),
      ),
    ).toBe(false);
    expect(
      isManagedDashboardWidgetHiddenFromNormalRail(
        widget({
          managedBy: {
            ownerInstanceId: "graph-1",
            role: "embedded-connection-source",
          },
          presentation: {
            railVisibility: "hidden",
          },
        }),
      ),
    ).toBe(true);
  });

  it("hides managed hidden graph nodes by default but can reveal them explicitly", () => {
    const graph: DashboardWidgetDependencyGraph = {
      nodes: [
        {
          id: "graph-1",
          widgetId: "graph",
          title: "Visible graph",
          placementMode: "canvas",
          railVisibility: "visible",
          hiddenFromNormalRail: false,
          hiddenInCollapsedRow: false,
          inputs: [
            {
              id: "sourceData",
              label: "Source data",
              accepts: ["core.tabular_frame@v1"],
            },
          ],
          outputs: [],
        },
        {
          id: "managed-1",
          widgetId: "connection-query",
          title: "Managed source",
          managedRole: "embedded-connection-source",
          placementMode: "sidebar",
          railVisibility: "hidden",
          hiddenFromNormalRail: true,
          hiddenInCollapsedRow: false,
          inputs: [],
          outputs: [
            {
              id: "dataset",
              label: "Dataset",
              contract: "core.tabular_frame@v1",
            },
          ],
        },
        {
          id: "note-1",
          widgetId: "markdown-note",
          title: "Loose note",
          placementMode: "canvas",
          railVisibility: "visible",
          hiddenFromNormalRail: false,
          hiddenInCollapsedRow: false,
          inputs: [],
          outputs: [],
        },
      ],
      edges: [
        {
          id: "managed-1:dataset->graph-1:sourceData",
          from: "managed-1",
          fromPort: "dataset",
          to: "graph-1",
          toPort: "sourceData",
          contract: "core.tabular_frame@v1",
          source: "binding",
          status: "valid",
          effects: [],
        },
      ],
    };

    const defaultVisible = resolveVisibleWorkspaceGraph(graph);
    expect(defaultVisible.nodes.map((node) => node.id)).toEqual(["graph-1"]);
    expect(defaultVisible.edges).toHaveLength(0);
    expect(defaultVisible.hiddenManagedNodeCount).toBe(1);
    expect(defaultVisible.hiddenNonGraphNodeCount).toBe(1);

    const expandedVisible = resolveVisibleWorkspaceGraph(graph, {
      includeManagedHiddenNodes: true,
    });
    expect(expandedVisible.nodes.map((node) => node.id).sort()).toEqual([
      "graph-1",
      "managed-1",
    ]);
    expect(expandedVisible.edges).toHaveLength(1);
    expect(expandedVisible.hiddenManagedNodeCount).toBe(0);
    expect(expandedVisible.hiddenNonGraphNodeCount).toBe(1);
  });
});
