import { useCallback, useEffect, useMemo, useState } from "react";

import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  ConnectionMode,
  Controls,
  MarkerType,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, Boxes, Bug, Save } from "lucide-react";

import { getWidgetById } from "@/app/registry";
import { hasAllPermissions } from "@/auth/permissions";
import {
  DashboardControlsProvider,
  DashboardDataControls,
  DashboardRefreshProgressLine,
} from "@/dashboards/DashboardControls";
import {
  DashboardWidgetDependenciesProvider,
  useDashboardWidgetDependencies,
} from "@/dashboards/DashboardWidgetDependencies";
import {
  DashboardWidgetExecutionProvider,
  useDashboardWidgetExecution,
} from "@/dashboards/DashboardWidgetExecution";
import { DashboardWidgetRegistryProvider } from "@/dashboards/DashboardWidgetRegistry";
import {
  addWidgetGraphConnectionToBindings,
  buildWidgetGraphHandleId,
  createDashboardWidgetEntryIndex,
  removeWidgetGraphConnectionFromBindings,
  resolveWidgetGraphConnection,
  type DashboardWidgetDependencyGraph,
} from "@/dashboards/widget-dependencies";
import type { DashboardWidgetInstance } from "@/dashboards/types";
import type { ResolvedWidgetInputs } from "@/widgets/types";

import {
  appendCatalogWidget,
  updateDashboardControlsState,
  updateDashboardWidgetBindings,
  updateDashboardWidgetRuntimeState,
} from "./custom-dashboard-storage";
import { WorkspaceComponentBrowser } from "./WorkspaceComponentBrowser";
import { useCustomWorkspaceStudio } from "./useCustomWorkspaceStudio";
import {
  WorkspaceGraphNode,
  type WorkspaceGraphFlowNode,
  type WorkspaceGraphInputPortData,
  type WorkspaceGraphNodeData,
  type WorkspaceGraphOutputPortData,
} from "./WorkspaceGraphNode";
import {
  WorkspaceSavingStatus,
  WorkspaceToolbarButton,
  WorkspaceWidgetRail,
} from "./WorkspaceChrome";
import { WorkspaceRequestDebugPanel } from "./WorkspaceRequestDebugPanel";

const GRAPH_NODE_HORIZONTAL_GAP = 420;
const GRAPH_NODE_VERTICAL_GAP = 220;
const GRAPH_EXECUTION_HIGHLIGHT_WINDOW_MS = 1800;
const GRAPH_NODE_TYPES = {
  workspaceWidget: WorkspaceGraphNode,
};

function resolveInputPortStatus(
  resolvedInput: ResolvedWidgetInputs | undefined,
  inputId: string,
) {
  const entry = resolvedInput?.[inputId];
  const values = Array.isArray(entry) ? entry : entry ? [entry] : [];

  if (values.some((item) => item.status !== "valid" && item.status !== "unbound")) {
    return "broken" as const;
  }

  if (values.some((item) => item.status === "valid")) {
    return "connected" as const;
  }

  return "unbound" as const;
}

function layoutGraphNodes(graph: DashboardWidgetDependencyGraph) {
  const nodeIds = graph.nodes.map((node) => node.id);
  const nodeIdSet = new Set(nodeIds);
  const outgoing = new Map(nodeIds.map((nodeId) => [nodeId, new Set<string>()]));
  const indegree = new Map(nodeIds.map((nodeId) => [nodeId, 0]));

  for (const edge of graph.edges) {
    if (!nodeIdSet.has(edge.from) || !nodeIdSet.has(edge.to) || edge.from === edge.to) {
      continue;
    }

    const targets = outgoing.get(edge.from);

    if (!targets || targets.has(edge.to)) {
      continue;
    }

    targets.add(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const depth = new Map(nodeIds.map((nodeId) => [nodeId, 0]));
  const queue = nodeIds.filter((nodeId) => (indegree.get(nodeId) ?? 0) === 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = depth.get(current) ?? 0;

    for (const next of outgoing.get(current) ?? []) {
      depth.set(next, Math.max(depth.get(next) ?? 0, currentDepth + 1));
      indegree.set(next, (indegree.get(next) ?? 1) - 1);

      if ((indegree.get(next) ?? 0) === 0) {
        queue.push(next);
      }
    }
  }

  const columns = new Map<number, typeof graph.nodes>();

  for (const node of graph.nodes) {
    const nodeDepth = depth.get(node.id) ?? 0;
    const column = columns.get(nodeDepth) ?? [];
    column.push(node);
    columns.set(nodeDepth, column);
  }

  const positions = new Map<string, XYPosition>();

  for (const [columnIndex, columnNodes] of Array.from(columns.entries()).sort(
    ([left], [right]) => left - right,
  )) {
    columnNodes
      .sort((left, right) => {
        if ((left.placementMode === "sidebar") !== (right.placementMode === "sidebar")) {
          return left.placementMode === "sidebar" ? 1 : -1;
        }

        if (left.hiddenInCollapsedRow !== right.hiddenInCollapsedRow) {
          return left.hiddenInCollapsedRow ? 1 : -1;
        }

        return left.title.localeCompare(right.title);
      })
      .forEach((node, rowIndex) => {
        positions.set(node.id, {
          x: columnIndex * GRAPH_NODE_HORIZONTAL_GAP,
          y: rowIndex * GRAPH_NODE_VERTICAL_GAP,
        });
      });
  }

  return positions;
}

function WorkspaceGraphCanvas({
  onBindingsChange,
}: {
  onBindingsChange: (
    instanceId: string,
    bindings: DashboardWidgetInstance["bindings"],
  ) => void;
}) {
  const dependencyModel = useDashboardWidgetDependencies();
  const widgetExecution = useDashboardWidgetExecution();
  const [nodes, setNodes] = useState<WorkspaceGraphFlowNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [dependencyFocusNodeId, setDependencyFocusNodeId] = useState<string | null>(null);
  const [visibleOutputIdsByNodeId, setVisibleOutputIdsByNodeId] = useState<Record<string, string[]>>(
    {},
  );
  const [animationNowMs, setAnimationNowMs] = useState(() => Date.now());

  const instanceIndex = useMemo(
    () => createDashboardWidgetEntryIndex(dependencyModel?.entries ?? []),
    [dependencyModel],
  );
  const layoutedPositions = useMemo(
    () => (dependencyModel ? layoutGraphNodes(dependencyModel.graph) : new Map<string, XYPosition>()),
    [dependencyModel],
  );
  const executionStateByNodeId = useMemo(
    () =>
      Object.fromEntries(
        (dependencyModel?.graph.nodes ?? []).map((node) => [
          node.id,
          widgetExecution?.getExecutionState(node.id),
        ] as const),
      ),
    [dependencyModel, widgetExecution],
  );

  useEffect(() => {
    const now = Date.now();
    const shouldAnimate = Object.values(executionStateByNodeId).some((state) => {
      if (!state) {
        return false;
      }

      if (state.status === "running") {
        return true;
      }

      return Boolean(
        state.finishedAtMs &&
          now - state.finishedAtMs < GRAPH_EXECUTION_HIGHLIGHT_WINDOW_MS,
      );
    });

    if (!shouldAnimate) {
      setAnimationNowMs(now);
      return undefined;
    }

    setAnimationNowMs(now);
    const intervalId = window.setInterval(() => {
      setAnimationNowMs(Date.now());
    }, 120);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [executionStateByNodeId]);

  useEffect(() => {
    if (!dependencyModel || !dependencyFocusNodeId) {
      return;
    }

    if (!dependencyModel.graph.nodes.some((node) => node.id === dependencyFocusNodeId)) {
      setDependencyFocusNodeId(null);
    }
  }, [dependencyFocusNodeId, dependencyModel]);

  useEffect(() => {
    if (!dependencyModel) {
      setVisibleOutputIdsByNodeId({});
      return;
    }

    setVisibleOutputIdsByNodeId((current) => {
      const validOutputIdsByNodeId = new Map(
        dependencyModel.graph.nodes.map((node) => [
          node.id,
          new Set(node.outputs.map((output) => output.id)),
        ] as const),
      );
      let changed = false;
      const nextState = Object.fromEntries(
        Object.entries(current).flatMap(([nodeId, outputIds]) => {
          const validOutputIds = validOutputIdsByNodeId.get(nodeId);

          if (!validOutputIds) {
            changed = true;
            return [];
          }

          const nextOutputIds = outputIds.filter((outputId) => validOutputIds.has(outputId));

          if (nextOutputIds.length !== outputIds.length) {
            changed = true;
          }

          return nextOutputIds.length > 0 ? [[nodeId, nextOutputIds] as const] : [];
        }),
      );

      return changed ? nextState : current;
    });
  }, [dependencyModel]);

  const dependencyHighlight = useMemo(() => {
    const highlightedNodeIds = new Set<string>();
    const highlightedEdgeIds = new Set<string>();
    const highlightedInputIdsByNodeId = new Map<string, Set<string>>();
    const highlightedOutputIdsByNodeId = new Map<string, Set<string>>();

    if (!dependencyModel || !dependencyFocusNodeId) {
      return {
        highlightedNodeIds,
        highlightedEdgeIds,
        highlightedInputIdsByNodeId,
        highlightedOutputIdsByNodeId,
      };
    }

    const incomingEdgesByNodeId = new Map<string, typeof dependencyModel.graph.edges>();

    for (const edge of dependencyModel.graph.edges) {
      const currentEdges = incomingEdgesByNodeId.get(edge.to) ?? [];
      currentEdges.push(edge);
      incomingEdgesByNodeId.set(edge.to, currentEdges);
    }

    const queue = [dependencyFocusNodeId];
    const visitedNodeIds = new Set<string>();

    while (queue.length > 0) {
      const currentNodeId = queue.shift()!;

      if (visitedNodeIds.has(currentNodeId)) {
        continue;
      }

      visitedNodeIds.add(currentNodeId);
      highlightedNodeIds.add(currentNodeId);

      for (const edge of incomingEdgesByNodeId.get(currentNodeId) ?? []) {
        highlightedEdgeIds.add(edge.id);
        highlightedNodeIds.add(edge.from);
        highlightedNodeIds.add(edge.to);

        const targetInputs = highlightedInputIdsByNodeId.get(edge.to) ?? new Set<string>();
        targetInputs.add(edge.toPort);
        highlightedInputIdsByNodeId.set(edge.to, targetInputs);

        const sourceOutputs = highlightedOutputIdsByNodeId.get(edge.from) ?? new Set<string>();
        sourceOutputs.add(edge.fromPort);
        highlightedOutputIdsByNodeId.set(edge.from, sourceOutputs);

        if (!visitedNodeIds.has(edge.from)) {
          queue.push(edge.from);
        }
      }
    }

    return {
      highlightedNodeIds,
      highlightedEdgeIds,
      highlightedInputIdsByNodeId,
      highlightedOutputIdsByNodeId,
    };
  }, [dependencyFocusNodeId, dependencyModel]);

  const derivedNodes = useMemo<WorkspaceGraphFlowNode[]>(() => {
    if (!dependencyModel) {
      return [];
    }

    return dependencyModel.graph.nodes.map((node) => {
      const widgetDefinition = dependencyModel.getWidgetDefinition(node.widgetId);
      const resolvedIo = dependencyModel.resolveIo(node.id);
      const resolvedInputs = dependencyModel.resolveInputs(node.id);
      const outputsByPort = new Map<string, number>();

      for (const edge of dependencyModel.graph.edges) {
        if (edge.from !== node.id || edge.status !== "valid") {
          continue;
        }

        outputsByPort.set(edge.fromPort, (outputsByPort.get(edge.fromPort) ?? 0) + 1);
      }

      const inputs: WorkspaceGraphInputPortData[] = node.inputs.map((input) => ({
        id: input.id,
        label: input.label,
        accepts: input.accepts,
        description:
          resolvedIo?.inputs?.find((candidate) => candidate.id === input.id)?.description,
        required:
          resolvedIo?.inputs?.find((candidate) => candidate.id === input.id)?.required,
        status: resolveInputPortStatus(resolvedInputs, input.id),
        dependencyHighlighted:
          dependencyHighlight.highlightedInputIdsByNodeId.get(node.id)?.has(input.id) ?? false,
      }));
      const outputs: WorkspaceGraphOutputPortData[] = node.outputs.map((output) => ({
        id: output.id,
        label: output.label,
        contract: output.contract,
        description:
          resolvedIo?.outputs?.find((candidate) => candidate.id === output.id)?.description,
        connectionCount: outputsByPort.get(output.id) ?? 0,
        dependencyHighlighted:
          dependencyHighlight.highlightedOutputIdsByNodeId.get(node.id)?.has(output.id) ?? false,
      }));
      const locallyVisibleOutputIds = new Set(visibleOutputIdsByNodeId[node.id] ?? []);
      const visibleOutputs = outputs.filter(
        (output) => output.connectionCount > 0 || locallyVisibleOutputIds.has(output.id),
      ).map((output) => ({
        ...output,
        removable: output.connectionCount === 0 && locallyVisibleOutputIds.has(output.id),
      }));
      const availableOutputs = outputs.filter(
        (output) => output.connectionCount === 0 && !locallyVisibleOutputIds.has(output.id),
      );
      const executionState = executionStateByNodeId[node.id];

      return {
        id: node.id,
        type: "workspaceWidget",
        position: layoutedPositions.get(node.id) ?? { x: 0, y: 0 },
        draggable: true,
        data: {
          title: node.title,
          widgetId: node.widgetId,
          widgetKind: widgetDefinition?.kind,
          widgetSource: widgetDefinition?.source,
          placementMode: node.placementMode,
          hiddenInCollapsedRow: node.hiddenInCollapsedRow,
          parentRowId: node.parentRowId,
          inputs,
          outputs: visibleOutputs,
          availableOutputs,
          executionStatus: executionState?.status,
          executionFinishedAtMs: executionState?.finishedAtMs,
          animationNowMs,
          dependencyHighlighted:
            dependencyHighlight.highlightedNodeIds.has(node.id) && node.id !== dependencyFocusNodeId,
          dependencyRoot: node.id === dependencyFocusNodeId,
          onRevealOutput: (outputId) => {
            setVisibleOutputIdsByNodeId((current) => {
              const currentOutputIds = current[node.id] ?? [];

              if (currentOutputIds.includes(outputId)) {
                return current;
              }

              return {
                ...current,
                [node.id]: [...currentOutputIds, outputId],
              };
            });
          },
          onHideOutput: (outputId) => {
            setVisibleOutputIdsByNodeId((current) => {
              const currentOutputIds = current[node.id] ?? [];
              const nextOutputIds = currentOutputIds.filter((candidate) => candidate !== outputId);

              if (nextOutputIds.length === currentOutputIds.length) {
                return current;
              }

              if (nextOutputIds.length === 0) {
                const nextState = { ...current };
                delete nextState[node.id];
                return nextState;
              }

              return {
                ...current,
                [node.id]: nextOutputIds,
              };
            });
          },
        } satisfies WorkspaceGraphNodeData,
      } satisfies WorkspaceGraphFlowNode;
    });
  }, [
    animationNowMs,
    dependencyFocusNodeId,
    dependencyHighlight,
    dependencyModel,
    executionStateByNodeId,
    layoutedPositions,
    visibleOutputIdsByNodeId,
  ]);

  const derivedEdges = useMemo<Edge[]>(() => {
    if (!dependencyModel) {
      return [];
    }

    const nodeById = new Map(dependencyModel.graph.nodes.map((node) => [node.id, node] as const));

    return dependencyModel.graph.edges.flatMap((edge) => {
      const sourceNode = nodeById.get(edge.from);
      const targetNode = nodeById.get(edge.to);

      if (!sourceNode || !targetNode) {
        return [];
      }

      const sourcePortExists = sourceNode.outputs.some((output) => output.id === edge.fromPort);
      const targetPortExists = targetNode.inputs.some((input) => input.id === edge.toPort);

      if (!sourcePortExists || !targetPortExists) {
        return [];
      }

      const broken = edge.status !== "valid";
      const sourceExecutionState = executionStateByNodeId[edge.from];
      const targetExecutionState = executionStateByNodeId[edge.to];
      const sourceRecentlyCompleted = Boolean(
        sourceExecutionState?.finishedAtMs &&
          animationNowMs - sourceExecutionState.finishedAtMs < GRAPH_EXECUTION_HIGHLIGHT_WINDOW_MS,
      );
      const targetRecentlyCompleted = Boolean(
        targetExecutionState?.finishedAtMs &&
          animationNowMs - targetExecutionState.finishedAtMs < GRAPH_EXECUTION_HIGHLIGHT_WINDOW_MS,
      );
      const edgeRunning =
        sourceExecutionState?.status === "running" ||
        targetExecutionState?.status === "running";
      const edgeRecentlyCompleted = !edgeRunning && (sourceRecentlyCompleted || targetRecentlyCompleted);
      const edgeStroke = broken
        ? "var(--color-danger)"
        : edgeRunning
          ? "var(--color-primary)"
          : edgeRecentlyCompleted
            ? "var(--color-success)"
            : "color-mix(in srgb, var(--border) 82%, transparent)";
      const dependencyHighlighted = dependencyHighlight.highlightedEdgeIds.has(edge.id);
      const highlightedStroke = broken
        ? "color-mix(in srgb, var(--color-danger) 82%, white 18%)"
        : "color-mix(in srgb, var(--color-primary) 78%, white 22%)";

      return [
        {
          id: edge.id,
          source: edge.from,
          target: edge.to,
          sourceHandle: buildWidgetGraphHandleId("output", edge.fromPort),
          targetHandle: buildWidgetGraphHandleId("input", edge.toPort),
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: dependencyHighlighted ? highlightedStroke : edgeStroke,
          },
          style: {
            stroke: dependencyHighlighted ? highlightedStroke : edgeStroke,
            strokeWidth: dependencyHighlighted
              ? 4
              : broken
                ? 2
                : edgeRunning
                  ? 3.5
                  : edgeRecentlyCompleted
                    ? 3
                    : 2.5,
            strokeDasharray: broken ? "8 6" : undefined,
            filter: dependencyHighlighted
              ? "drop-shadow(0 0 6px color-mix(in srgb, var(--primary) 40%, transparent))"
              : undefined,
          },
          animated: edgeRunning,
          deletable: true,
          selectable: true,
        } satisfies Edge,
      ];
    });
  }, [animationNowMs, dependencyHighlight.highlightedEdgeIds, dependencyModel, executionStateByNodeId]);

  useEffect(() => {
    setNodes((currentNodes) => {
      const currentPositions = new Map(currentNodes.map((node) => [node.id, node.position] as const));

      return derivedNodes.map((node) => ({
        ...node,
        position: currentPositions.get(node.id) ?? node.position,
      }));
    });
  }, [derivedNodes]);

  useEffect(() => {
    setEdges((currentEdges) => {
      const selectedEdgeIds = new Set(
        currentEdges.filter((edge) => edge.selected).map((edge) => edge.id),
      );

      return derivedEdges.map((edge) => ({
        ...edge,
        selected: selectedEdgeIds.has(edge.id),
      }));
    });
  }, [derivedEdges]);

  const onNodesChange = useCallback((changes: NodeChange<WorkspaceGraphFlowNode>[]) => {
    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges));
  }, []);

  const handleConnect = useCallback((connection: Connection) => {
    if (!dependencyModel) {
      return;
    }

    const resolvedConnection = resolveWidgetGraphConnection(
      connection,
      instanceIndex,
      dependencyModel.getWidgetDefinition,
      dependencyModel.resolveIo,
    );

    if (!resolvedConnection) {
      return;
    }

    onBindingsChange(
      resolvedConnection.targetInstance.id,
      addWidgetGraphConnectionToBindings(
        resolvedConnection.targetInstance.bindings,
        resolvedConnection.targetInput,
        resolvedConnection.connection,
      ),
    );
  }, [dependencyModel, instanceIndex, onBindingsChange]);

  const handleEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    if (!dependencyModel || deletedEdges.length === 0) {
      return;
    }

    const nextBindingsByWidget = new Map<string, DashboardWidgetInstance["bindings"]>();

    for (const edge of deletedEdges) {
      const resolvedConnection = resolveWidgetGraphConnection(
        {
          source: edge.source,
          sourceHandle: edge.sourceHandle,
          target: edge.target,
          targetHandle: edge.targetHandle,
        },
        instanceIndex,
        dependencyModel.getWidgetDefinition,
        dependencyModel.resolveIo,
      );

      if (!resolvedConnection) {
        continue;
      }

      const currentBindings =
        nextBindingsByWidget.get(resolvedConnection.targetInstance.id) ??
        resolvedConnection.targetInstance.bindings;

      nextBindingsByWidget.set(
        resolvedConnection.targetInstance.id,
        removeWidgetGraphConnectionFromBindings(
          currentBindings,
          resolvedConnection.connection,
        ),
      );
    }

    nextBindingsByWidget.forEach((bindings, instanceId) => {
      onBindingsChange(instanceId, bindings);
    });
  }, [dependencyModel, instanceIndex, onBindingsChange]);

  const isValidConnection = useCallback((connection: Connection | Edge) => {
    if (!dependencyModel) {
      return false;
    }

    return (
      resolveWidgetGraphConnection(
        connection,
        instanceIndex,
        dependencyModel.getWidgetDefinition,
        dependencyModel.resolveIo,
      ) !== null
    );
  }, [dependencyModel, instanceIndex]);

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={GRAPH_NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onEdgesDelete={handleEdgesDelete}
        isValidConnection={isValidConnection}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        deleteKeyCode={["Backspace", "Delete"]}
        elementsSelectable
        nodesDraggable
        nodesConnectable
        edgesReconnectable={false}
        className="workspace-graph-flow bg-transparent"
        onNodeClick={(_event, node) => {
          setDependencyFocusNodeId(node.id);
        }}
        onPaneClick={() => {
          setDependencyFocusNodeId(null);
        }}
      >
        <Background gap={18} size={1.5} color="color-mix(in srgb, var(--border) 58%, transparent)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export function CustomWorkspaceGraphPage({
  withRuntimeProviders = true,
}: {
  withRuntimeProviders?: boolean;
} = {}) {
  const {
    user,
    permissions,
    selectedWorkspaceDirty,
    isSaving,
    selectedDashboard,
    resolvedDashboard,
    saveWorkspaceDraft,
    openDashboardView,
    openWidgetSettings,
    updateSelectedWorkspace,
    updateSelectedWorkspaceUserState,
  } = useCustomWorkspaceStudio();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [requestDebugOpen, setRequestDebugOpen] = useState(false);

  useEffect(() => {
    setLibraryOpen(false);
    setRequestDebugOpen(false);
  }, [selectedDashboard?.id]);

  if (!user) {
    return (
      <div className="rounded-[var(--radius)] border border-border/80 bg-card/80 p-8 text-sm text-muted-foreground">
        Resolve a user session before opening the workspace graph.
      </div>
    );
  }

  if (!selectedDashboard || !resolvedDashboard) {
    return null;
  }

  const railWidgets = resolvedDashboard.widgets.flatMap((instance) => {
    const widget = getWidgetById(instance.widgetId);
    const required = [
      ...(widget?.requiredPermissions ?? []),
      ...(instance.requiredPermissions ?? []),
    ];

    return widget && hasAllPermissions(permissions, required)
      ? [
          {
            id: instance.id,
            title: instance.title,
            props: instance.props,
            presentation: instance.presentation,
            runtimeState: instance.runtimeState,
            widget,
          },
        ]
      : [];
  });

  const content = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="sticky top-0 z-40 border-b border-primary/55 bg-background/82 px-0 py-2 shadow-[inset_0_-1px_0_color-mix(in_srgb,var(--primary)_22%,transparent)] backdrop-blur-xl">
        <DashboardDataControls
          controls={selectedDashboard.controls}
          leftActions={
            <>
              <WorkspaceToolbarButton
                title="Return to workspace"
                onClick={openDashboardView}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </WorkspaceToolbarButton>
              <WorkspaceToolbarButton
                active={libraryOpen}
                title="Components"
                onClick={() => {
                  setLibraryOpen((current) => !current);
                }}
              >
                <Boxes className="h-3.5 w-3.5" />
              </WorkspaceToolbarButton>
              <WorkspaceToolbarButton
                active={requestDebugOpen}
                title="Debug Request"
                onClick={() => {
                  setRequestDebugOpen((current) => !current);
                }}
              >
                <Bug className="h-3.5 w-3.5" />
              </WorkspaceToolbarButton>
              <WorkspaceToolbarButton
                active={selectedWorkspaceDirty}
                title="Save workspace"
                onClick={() => {
                  void saveWorkspaceDraft();
                }}
                disabled={!selectedWorkspaceDirty || isSaving}
                className={!selectedWorkspaceDirty ? "opacity-50" : undefined}
              >
                {selectedWorkspaceDirty ? (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-warning" />
                ) : null}
                <Save className="h-3.5 w-3.5" />
              </WorkspaceToolbarButton>
              {isSaving ? <WorkspaceSavingStatus /> : null}
            </>
          }
        />
      </div>

      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ backgroundColor: "var(--workspace-canvas-base-color)" }}
      >
        <DashboardRefreshProgressLine className="absolute top-0 left-0 right-0 z-30" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: "var(--workspace-canvas-background)" }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: "var(--workspace-canvas-overlay)" }}
        />

        <WorkspaceWidgetRail
          widgets={railWidgets}
          activeInstanceId={null}
          topOffsetClassName="top-4"
          onOpenWidget={(instanceId) => {
            openWidgetSettings(instanceId);
          }}
        />

        <WorkspaceComponentBrowser
          open={libraryOpen}
          permissions={permissions}
          userId={user.id}
          topOffsetClassName="top-12"
          onOpenChange={setLibraryOpen}
          onAddWidget={(widget) => {
            updateSelectedWorkspace((dashboard) => appendCatalogWidget(dashboard, widget));
          }}
        />

        <div className="absolute inset-0 pl-12">
          <WorkspaceGraphCanvas
            onBindingsChange={(instanceId, bindings) => {
              updateSelectedWorkspace((dashboard) =>
                updateDashboardWidgetBindings(dashboard, instanceId, bindings),
              );
            }}
          />
        </div>

        <WorkspaceRequestDebugPanel
          open={requestDebugOpen}
          onClose={() => {
            setRequestDebugOpen(false);
          }}
          placementClassName="right-4 top-4 bottom-4"
          scopeId={selectedDashboard.id}
          widgets={resolvedDashboard.widgets}
        />
      </div>
    </div>
  );

  if (!withRuntimeProviders) {
    return content;
  }

  return (
    <DashboardControlsProvider
      key={selectedDashboard.id}
      controls={selectedDashboard.controls}
      onStateChange={(state) => {
        updateSelectedWorkspaceUserState((dashboard) =>
          updateDashboardControlsState(dashboard, state),
        );
      }}
    >
      <DashboardWidgetRegistryProvider widgets={resolvedDashboard.widgets}>
        <DashboardWidgetExecutionProvider
          scopeId={selectedDashboard.id}
          widgets={resolvedDashboard.widgets}
          writeRuntimeState={(instanceId, runtimeState) => {
            updateSelectedWorkspaceUserState((dashboard) =>
              updateDashboardWidgetRuntimeState(dashboard, instanceId, runtimeState),
            );
          }}
        >
          <DashboardWidgetDependenciesProvider widgets={resolvedDashboard.widgets}>
            {content}
          </DashboardWidgetDependenciesProvider>
        </DashboardWidgetExecutionProvider>
      </DashboardWidgetRegistryProvider>
    </DashboardControlsProvider>
  );
}
