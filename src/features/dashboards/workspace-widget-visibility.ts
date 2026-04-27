import type { DashboardWidgetDependencyGraph } from "@/dashboards/widget-dependencies";
import type { DashboardWidgetInstance } from "@/dashboards/types";

export function resolveWorkspaceWidgetRailVisibility(
  presentation: DashboardWidgetInstance["presentation"] | undefined,
) {
  return presentation?.railVisibility === "hidden" ? "hidden" : "visible";
}

export function isManagedDashboardWidget(
  widget: Pick<DashboardWidgetInstance, "managedBy">,
) {
  return Boolean(widget.managedBy?.ownerInstanceId && widget.managedBy?.role);
}

export function isManagedDashboardWidgetHiddenFromNormalRail(
  widget: Pick<DashboardWidgetInstance, "managedBy" | "presentation">,
) {
  return (
    isManagedDashboardWidget(widget) &&
    resolveWorkspaceWidgetRailVisibility(widget.presentation) === "hidden"
  );
}

export function resolveVisibleWorkspaceGraph(
  graph: DashboardWidgetDependencyGraph,
  options?: {
    includeManagedHiddenNodes?: boolean;
  },
) {
  const includeManagedHiddenNodes = options?.includeManagedHiddenNodes === true;
  const incidentEdgeCountByNodeId = new Map<string, number>(
    graph.nodes.map((node) => [node.id, 0]),
  );

  for (const edge of graph.edges) {
    incidentEdgeCountByNodeId.set(
      edge.from,
      (incidentEdgeCountByNodeId.get(edge.from) ?? 0) + 1,
    );
    incidentEdgeCountByNodeId.set(
      edge.to,
      (incidentEdgeCountByNodeId.get(edge.to) ?? 0) + 1,
    );
  }

  const graphRelevantNodeIds = new Set(
    graph.nodes.flatMap((node) => {
      const incidentEdgeCount = incidentEdgeCountByNodeId.get(node.id) ?? 0;
      const graphRelevant =
        incidentEdgeCount > 0 || node.inputs.length > 0 || node.outputs.length > 0;

      return graphRelevant ? [node.id] : [];
    }),
  );
  const hiddenManagedNodeIds = new Set(
    graph.nodes.flatMap((node) => {
      if (!graphRelevantNodeIds.has(node.id) || !node.hiddenFromNormalRail) {
        return [];
      }

      return [node.id];
    }),
  );
  const nodes = graph.nodes.filter((node) => {
    if (!graphRelevantNodeIds.has(node.id)) {
      return false;
    }

    if (!includeManagedHiddenNodes && hiddenManagedNodeIds.has(node.id)) {
      return false;
    }

    return true;
  });
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter(
    (edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to),
  );

  return {
    nodes,
    edges,
    hiddenManagedNodeCount: includeManagedHiddenNodes ? 0 : hiddenManagedNodeIds.size,
    hiddenNonGraphNodeCount: Math.max(0, graph.nodes.length - graphRelevantNodeIds.size),
    hiddenNodeCount: Math.max(0, graph.nodes.length - nodes.length),
  };
}
