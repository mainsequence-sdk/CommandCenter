import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";

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
import { ArrowLeft, Boxes, Save } from "lucide-react";

import { getWidgetById } from "@/app/registry";
import { hasAllPermissions } from "@/auth/permissions";
import {
  DashboardControlsProvider,
  DashboardDataControls,
} from "@/dashboards/DashboardControls";
import {
  DashboardWidgetDependenciesProvider,
  useDashboardWidgetDependencies,
} from "@/dashboards/DashboardWidgetDependencies";
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
import type { ResolvedWidgetInputs, WidgetInstancePresentation } from "@/widgets/types";

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

const GRAPH_NODE_HORIZONTAL_GAP = 420;
const GRAPH_NODE_VERTICAL_GAP = 220;
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

function HiddenWidgetRuntimeMount({
  instances,
  permissions,
  onRuntimeStateChange,
}: {
  instances: DashboardWidgetInstance[];
  permissions: string[];
  onRuntimeStateChange: (instanceId: string, state: Record<string, unknown> | undefined) => void;
}) {
  return (
    <div className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-hidden opacity-0">
      {instances.map((instance) => {
        const widget = getWidgetById(instance.widgetId);

        if (!widget) {
          return null;
        }

        const required = [
          ...(widget.requiredPermissions ?? []),
          ...(instance.requiredPermissions ?? []),
        ];

        if (!hasAllPermissions(permissions, required)) {
          return null;
        }

        const Component = widget.component as ComponentType<{
          widget: typeof widget;
          instanceId?: string;
          instanceTitle?: string;
          props: Record<string, unknown>;
          presentation?: WidgetInstancePresentation;
          runtimeState?: Record<string, unknown>;
          onRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
        }>;

        return (
          <div key={instance.id} className="h-px w-px overflow-hidden">
            <Component
              widget={widget}
              instanceId={instance.id}
              instanceTitle={instance.title}
              props={instance.props ?? {}}
              presentation={instance.presentation}
              runtimeState={instance.runtimeState}
              onRuntimeStateChange={(state) => {
                onRuntimeStateChange(instance.id, state);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function WorkspaceGraphCanvas({
  permissions,
  onBindingsChange,
  onRuntimeStateChange,
}: {
  permissions: string[];
  onBindingsChange: (
    instanceId: string,
    bindings: DashboardWidgetInstance["bindings"],
  ) => void;
  onRuntimeStateChange: (instanceId: string, state: Record<string, unknown> | undefined) => void;
}) {
  const dependencyModel = useDashboardWidgetDependencies();
  const [nodes, setNodes] = useState<WorkspaceGraphFlowNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [visibleOutputIdsByNodeId, setVisibleOutputIdsByNodeId] = useState<Record<string, string[]>>(
    {},
  );

  const widgetInstances = useMemo(
    () => dependencyModel?.entries.map(({ instance }) => instance) ?? [],
    [dependencyModel],
  );
  const instanceIndex = useMemo(
    () => createDashboardWidgetEntryIndex(dependencyModel?.entries ?? []),
    [dependencyModel],
  );
  const layoutedPositions = useMemo(
    () => (dependencyModel ? layoutGraphNodes(dependencyModel.graph) : new Map<string, XYPosition>()),
    [dependencyModel],
  );

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
      }));
      const outputs: WorkspaceGraphOutputPortData[] = node.outputs.map((output) => ({
        id: output.id,
        label: output.label,
        contract: output.contract,
        description:
          resolvedIo?.outputs?.find((candidate) => candidate.id === output.id)?.description,
        connectionCount: outputsByPort.get(output.id) ?? 0,
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
  }, [dependencyModel, layoutedPositions, visibleOutputIdsByNodeId]);

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

      return [
        {
          id: edge.id,
          source: edge.from,
          target: edge.to,
          sourceHandle: buildWidgetGraphHandleId("output", edge.fromPort),
          targetHandle: buildWidgetGraphHandleId("input", edge.toPort),
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: broken ? "var(--color-danger)" : "var(--color-primary)",
          },
          style: {
            stroke: broken ? "var(--color-danger)" : "var(--color-primary)",
            strokeWidth: broken ? 2 : 2.5,
            strokeDasharray: broken ? "8 6" : undefined,
          },
          animated: false,
          deletable: true,
          selectable: true,
        } satisfies Edge,
      ];
    });
  }, [dependencyModel]);

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
      <HiddenWidgetRuntimeMount
        instances={widgetInstances}
        permissions={permissions}
        onRuntimeStateChange={onRuntimeStateChange}
      />
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
        className="bg-transparent"
      >
        <Background gap={18} size={1.5} color="color-mix(in srgb, var(--border) 58%, transparent)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export function CustomWorkspaceGraphPage() {
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

  useEffect(() => {
    setLibraryOpen(false);
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
        <DashboardWidgetDependenciesProvider widgets={resolvedDashboard.widgets}>
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
                  permissions={permissions}
                  onBindingsChange={(instanceId, bindings) => {
                    updateSelectedWorkspace((dashboard) =>
                      updateDashboardWidgetBindings(dashboard, instanceId, bindings),
                    );
                  }}
                  onRuntimeStateChange={(instanceId, state) => {
                    updateSelectedWorkspaceUserState((dashboard) =>
                      updateDashboardWidgetRuntimeState(dashboard, instanceId, state),
                    );
                  }}
                />
              </div>
            </div>
          </div>
        </DashboardWidgetDependenciesProvider>
      </DashboardWidgetRegistryProvider>
    </DashboardControlsProvider>
  );
}
