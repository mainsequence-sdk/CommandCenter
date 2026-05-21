import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";

import {
  Background,
  BaseEdge,
  ConnectionMode,
  Controls,
  EdgeLabelRenderer,
  MarkerType,
  ReactFlow,
  getBezierPath,
  type EdgeProps,
  type EdgeTypes,
  type ReactFlowInstance,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, Boxes, Braces, Bug, Eye, Loader2, Save } from "lucide-react";

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
  createDashboardWidgetDependencyModel,
  createDashboardWidgetEntryIndex,
  removeWidgetGraphConnectionFromBindings,
  resolveWidgetGraphConnection,
  type DashboardWidgetDependencyGraph,
  type DashboardWidgetDependencyGraphEdge,
} from "@/dashboards/widget-dependencies";
import { isWidgetReferenceSourceOutputId } from "@/dashboards/widget-instance-references";
import type { DashboardDefinition, DashboardWidgetInstance } from "@/dashboards/types";
import type { ResolvedWidgetInput, ResolvedWidgetInputs } from "@/widgets/types";
import { WIDGET_AGENT_CONTEXT_OUTPUT_ID } from "@/widgets/shared/agent-context";

import {
  appendCatalogWidget,
  updateDashboardControlsState,
  updateDashboardWidgetBindings,
  updateDashboardWidgetSettings,
  updateDashboardWidgetRuntimeState,
} from "./custom-dashboard-storage";
import { WorkspaceComponentBrowser } from "./WorkspaceComponentBrowser";
import { useCustomWorkspaceStudio } from "./useCustomWorkspaceStudio";
import {
  WORKSPACE_GRAPH_REFERENCE_FRAME_OUTPUT_ID,
  WORKSPACE_GRAPH_REFERENCE_SOURCE_INPUT_ID,
  WorkspaceGraphNode,
  type WorkspaceGraphFlowNode,
  type WorkspaceGraphInputPortData,
  type WorkspaceGraphNodeData,
  type WorkspaceGraphOutputPortData,
} from "./WorkspaceGraphNode";
import {
  WorkspaceSavingStatus,
  WorkspaceLoadingStatus,
  WorkspaceToolbarButton,
  WorkspaceWidgetRail,
} from "./WorkspaceChrome";
import { WorkspaceRequestDebugPanel } from "./WorkspaceRequestDebugPanel";
import { WorkspaceVariableExplorerPanel } from "./WorkspaceVariableExplorerPanel";
import { loadPersistedWorkspaceDetail } from "./workspace-persistence";
import {
  isManagedDashboardWidgetHiddenFromNormalRail,
  resolveVisibleWorkspaceGraph,
} from "./workspace-widget-visibility";
import {
  buildWorkspaceStudioCanvasPath,
  useWorkspaceStudioSurfaceConfig,
} from "./workspace-studio-surface-config";

const GRAPH_NODE_HORIZONTAL_GAP = 420;
const GRAPH_NODE_VERTICAL_GAP = 28;
const GRAPH_NODE_COLLAPSED_HEIGHT_PX = 118;
const GRAPH_NODE_EXPANDED_ESTIMATED_HEIGHT_PX = 360;
const REFERENCED_GRAPH_NODE_PREFIX = "ref::";
const REFERENCED_WORKSPACE_BOUNDARY_WIDGET_ID = "workspace-reference-boundary";
const REFERENCED_WORKSPACE_FRAME_GAP_X = 96;
const REFERENCED_WORKSPACE_FRAME_HEADER_HEIGHT = 112;
const REFERENCED_WORKSPACE_FRAME_PADDING_X = 28;
const REFERENCED_WORKSPACE_FRAME_PADDING_Y = 24;
const REFERENCED_WORKSPACE_FRAME_MIN_HEIGHT = 220;
const REFERENCED_WORKSPACE_FRAME_MIN_WIDTH = 380;
const REFERENCED_WORKSPACE_NODE_WIDTH = 300;
const REFERENCED_WORKSPACE_STACK_GAP_Y = 40;
const WORKSPACE_REFERENCE_WIDGET_ID = "main-sequence-ai-workspace";
const WORKSPACE_REFERENCE_OUTPUT_ID = "workspace-reference";
const GRAPH_NODE_TYPES = {
  workspaceWidget: WorkspaceGraphNode,
};

type DashboardWidgetDependencyModel = ReturnType<typeof createDashboardWidgetDependencyModel>;

type WorkspaceGraphEdgeDiagnosticTone = "danger" | "primary" | "muted";

interface WorkspaceGraphEdgeDiagnostic {
  contractLabel: string;
  expressionLabel?: string;
  reason: string;
  sourceLabel: string;
  statusLabel: string;
  targetLabel: string;
  tone: WorkspaceGraphEdgeDiagnosticTone;
  typeLabel: string;
  valueLabel?: string;
}

interface WorkspaceGraphEdgeData extends Record<string, unknown> {
  diagnostic?: WorkspaceGraphEdgeDiagnostic;
  label?: string;
}

type WorkspaceGraphFlowEdge = Edge<WorkspaceGraphEdgeData, "workspaceGraphEdge">;

const GRAPH_EDGE_STATUS_LABELS: Record<DashboardWidgetDependencyGraphEdge["status"], string> = {
  "contract-mismatch": "Contract mismatch",
  "missing-output": "Missing output",
  "missing-source": "Missing source widget",
  "self-reference-blocked": "Self reference blocked",
  "transform-invalid": "Invalid transform",
  "unbound": "Unbound",
  "valid": "Resolved",
};

type ReferencedWorkspaceLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; workspace: DashboardDefinition }
  | { status: "missing" }
  | { status: "error"; error: string };

interface WorkspaceReferenceExpansionTarget {
  workspaceId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeWorkspaceId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeWorkspaceReferenceId(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  return normalizeWorkspaceId(value.id);
}

function isReferencedGraphElementId(id: string | null | undefined) {
  return Boolean(id?.startsWith(REFERENCED_GRAPH_NODE_PREFIX));
}

function buildReferencedGraphNodeId(
  sourceNodeId: string,
  workspaceId: string,
  referencedNodeId: string,
) {
  return `${REFERENCED_GRAPH_NODE_PREFIX}${sourceNodeId}::${workspaceId}::${referencedNodeId}`;
}

function buildReferencedWorkspaceBoundaryNodeId(sourceNodeId: string, workspaceId: string) {
  return buildReferencedGraphNodeId(sourceNodeId, workspaceId, "__boundary__");
}

function resolveGraphNodeTitle(
  node: DashboardWidgetDependencyGraph["nodes"][number],
  widgetDefinition: ReturnType<typeof getWidgetById>,
) {
  if (node.widgetId === WORKSPACE_REFERENCE_WIDGET_ID && node.title === "WorkspaceReference") {
    return widgetDefinition?.title ?? "Workspace";
  }

  return node.title;
}

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

function getResolvedInputEntries(
  resolvedInputs: ResolvedWidgetInputs | undefined,
  inputId: string,
) {
  const entry = resolvedInputs?.[inputId];
  return Array.isArray(entry) ? entry : entry ? [entry] : [];
}

function findResolvedEdgeInput(
  edge: DashboardWidgetDependencyGraphEdge,
  dependencyModel: DashboardWidgetDependencyModel | null,
): ResolvedWidgetInput | null {
  if (!dependencyModel) {
    return null;
  }

  const entries = getResolvedInputEntries(dependencyModel.resolveInputs(edge.to), edge.toPort);

  return (
    entries.find(
      (entry) => entry.sourceWidgetId === edge.from && entry.sourceOutputId === edge.fromPort,
    ) ?? null
  );
}

function summarizeGraphEdgeValue(value: unknown) {
  if (value === undefined) {
    return "undefined";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return value.length > 72 ? `${value.slice(0, 69)}...` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `array (${value.length})`;
  }

  if (isRecord(value)) {
    const keys = Object.keys(value);
    return keys.length > 0 ? `object: ${keys.slice(0, 5).join(", ")}` : "object";
  }

  return typeof value;
}

function isEmptyGraphEdgeValue(value: unknown) {
  return (
    value == null ||
    (typeof value === "string" && value.trim().length === 0) ||
    (Array.isArray(value) && value.length === 0)
  );
}

function describeGraphEdgeReason(
  edge: DashboardWidgetDependencyGraphEdge,
  resolvedInput: ResolvedWidgetInput | null,
) {
  if (edge.status === "valid" && edge.source === "variable-reference") {
    if (isEmptyGraphEdgeValue(resolvedInput?.value)) {
      return "The variable edge is registered, but the source value is empty right now.";
    }

    return "The variable reference is resolved through the workspace graph.";
  }

  if (edge.status === "valid" && edge.source === "system-managed") {
    return "The edge is created by a managed widget relationship.";
  }

  switch (edge.status) {
    case "contract-mismatch":
      return "The source output contract does not satisfy the target input contract.";
    case "missing-output":
      return "The source widget no longer exposes the selected output.";
    case "missing-source":
      return "The source widget is missing from this workspace graph.";
    case "self-reference-blocked":
      return "A widget cannot reference its own output.";
    case "transform-invalid":
      return "The variable transform or extract path cannot be applied to the current source value.";
    case "unbound":
      return "No source output is connected to this input.";
    case "valid":
      return "The binding is resolved through the workspace graph.";
    default:
      return "The edge cannot be resolved.";
  }
}

function buildGraphEdgeTargetLabel(edge: DashboardWidgetDependencyGraphEdge) {
  if (edge.reference?.targetKind === "title") {
    return "title";
  }

  return edge.reference?.targetPath?.join(".") ?? edge.toPort;
}

function buildGraphEdgeDiagnostic(
  edge: DashboardWidgetDependencyGraphEdge,
  sourceNode: DashboardWidgetDependencyGraph["nodes"][number],
  targetNode: DashboardWidgetDependencyGraph["nodes"][number],
  dependencyModel: DashboardWidgetDependencyModel | null,
): WorkspaceGraphEdgeDiagnostic | undefined {
  const shouldExposeDiagnostic =
    edge.source === "variable-reference" ||
    edge.source === "system-managed" ||
    edge.status !== "valid";

  if (!shouldExposeDiagnostic) {
    return undefined;
  }

  const resolvedInput = findResolvedEdgeInput(edge, dependencyModel);
  const targetLabel = buildGraphEdgeTargetLabel(edge);
  const typeLabel =
    edge.source === "variable-reference"
      ? "Variable reference"
      : edge.source === "system-managed"
        ? "Managed edge"
        : "Binding";
  const valueLabel = resolvedInput ? summarizeGraphEdgeValue(resolvedInput.value) : undefined;
  const tone: WorkspaceGraphEdgeDiagnosticTone =
    edge.status !== "valid" ||
    (edge.source === "variable-reference" && isEmptyGraphEdgeValue(resolvedInput?.value))
      ? "danger"
      : edge.source === "variable-reference"
        ? "primary"
        : "muted";

  return {
    contractLabel: edge.contract ?? "unknown contract",
    expressionLabel: edge.reference?.expression,
    reason: describeGraphEdgeReason(edge, resolvedInput),
    sourceLabel: `${sourceNode.title}.${edge.fromPort}`,
    statusLabel: GRAPH_EDGE_STATUS_LABELS[edge.status],
    targetLabel: `${targetNode.title}.${targetLabel}`,
    tone,
    typeLabel,
    valueLabel,
  };
}

function getWorkspaceGraphDiagnosticChipClassName(tone: WorkspaceGraphEdgeDiagnosticTone) {
  if (tone === "danger") {
    return "border-danger/70 bg-danger/14 text-danger";
  }

  if (tone === "primary") {
    return "border-primary/70 bg-primary/14 text-primary";
  }

  return "border-border/80 bg-card/92 text-muted-foreground";
}

function WorkspaceGraphDiagnosticEdge({
  id,
  markerEnd,
  markerStart,
  sourcePosition,
  sourceX,
  sourceY,
  style,
  targetPosition,
  targetX,
  targetY,
  data,
}: EdgeProps<WorkspaceGraphFlowEdge>) {
  const [hovered, setHovered] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourcePosition,
    sourceX,
    sourceY,
    targetPosition,
    targetX,
    targetY,
  });
  const diagnostic = data?.diagnostic;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={style}
        interactionWidth={0}
      />
      {diagnostic ? (
        <path
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeWidth={28}
          className="react-flow__edge-interaction"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        />
      ) : null}
      {diagnostic ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute z-50"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <div
              className={`max-w-48 truncate border px-2 py-1 text-[10px] font-semibold tracking-[0.08em] uppercase shadow-[var(--shadow-panel)] ${getWorkspaceGraphDiagnosticChipClassName(diagnostic.tone)}`}
            >
              {data?.label ?? diagnostic.typeLabel}
            </div>
            {hovered ? (
              <div className="absolute top-full left-1/2 mt-2 w-80 -translate-x-1/2 border border-border/80 bg-background/96 p-3 text-left text-xs text-foreground shadow-[var(--shadow-panel)] backdrop-blur-md">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="font-semibold">{diagnostic.typeLabel}</div>
                  <div className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                    {diagnostic.statusLabel}
                  </div>
                </div>
                <div className="space-y-2 text-muted-foreground">
                  {diagnostic.expressionLabel ? (
                    <div>
                      <div className="text-[10px] tracking-[0.08em] uppercase">Expression</div>
                      <div className="mt-0.5 break-all font-mono text-[11px] text-foreground">
                        {diagnostic.expressionLabel}
                      </div>
                    </div>
                  ) : null}
                  <div>
                    <div className="text-[10px] tracking-[0.08em] uppercase">Source</div>
                    <div className="mt-0.5 break-all text-foreground">{diagnostic.sourceLabel}</div>
                  </div>
                  <div>
                    <div className="text-[10px] tracking-[0.08em] uppercase">Target</div>
                    <div className="mt-0.5 break-all text-foreground">{diagnostic.targetLabel}</div>
                  </div>
                  <div>
                    <div className="text-[10px] tracking-[0.08em] uppercase">Reason</div>
                    <div className="mt-0.5 text-foreground">{diagnostic.reason}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] tracking-[0.08em] uppercase">Contract</div>
                      <div className="mt-0.5 break-all font-mono text-[11px] text-foreground">
                        {diagnostic.contractLabel}
                      </div>
                    </div>
                    {diagnostic.valueLabel ? (
                      <div>
                        <div className="text-[10px] tracking-[0.08em] uppercase">Value</div>
                        <div className="mt-0.5 break-all font-mono text-[11px] text-foreground">
                          {diagnostic.valueLabel}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const GRAPH_EDGE_TYPES: EdgeTypes = {
  workspaceGraphEdge: WorkspaceGraphDiagnosticEdge,
};

function layoutGraphNodes(
  graph: DashboardWidgetDependencyGraph,
  options?: {
    expandedNodeIds?: ReadonlySet<string>;
    measuredHeightByNodeId?: Readonly<Record<string, number>>;
  },
) {
  const nodeIds = graph.nodes.map((node) => node.id);
  const nodeIdSet = new Set(nodeIds);
  const outgoing = new Map(nodeIds.map((nodeId) => [nodeId, new Set<string>()]));
  const indegree = new Map(nodeIds.map((nodeId) => [nodeId, 0]));
  const expandedNodeIds = options?.expandedNodeIds ?? new Set<string>();
  const measuredHeightByNodeId = options?.measuredHeightByNodeId ?? {};
  const incidentEdgeCountByNodeId = new Map(nodeIds.map((nodeId) => [nodeId, 0]));

  for (const edge of graph.edges) {
    if (!nodeIdSet.has(edge.from) || !nodeIdSet.has(edge.to) || edge.from === edge.to) {
      continue;
    }

    incidentEdgeCountByNodeId.set(
      edge.from,
      (incidentEdgeCountByNodeId.get(edge.from) ?? 0) + 1,
    );
    incidentEdgeCountByNodeId.set(
      edge.to,
      (incidentEdgeCountByNodeId.get(edge.to) ?? 0) + 1,
    );

    const targets = outgoing.get(edge.from);

    if (!targets || targets.has(edge.to)) {
      continue;
    }

    targets.add(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const unboundPureSources = graph.nodes.filter(
    (node) =>
      (incidentEdgeCountByNodeId.get(node.id) ?? 0) === 0 &&
      node.inputs.length === 0 &&
      node.outputs.length > 0,
  );
  const unboundConsumers = graph.nodes.filter(
    (node) =>
      (incidentEdgeCountByNodeId.get(node.id) ?? 0) === 0 &&
      node.inputs.length > 0,
  );

  for (const sourceNode of unboundPureSources) {
    const sourceContracts = new Set(sourceNode.outputs.map((output) => output.contract));

    for (const targetNode of unboundConsumers) {
      if (sourceNode.id === targetNode.id) {
        continue;
      }

      const compatible = targetNode.inputs.some((input) =>
        input.accepts.some((contractId) => sourceContracts.has(contractId)),
      );

      if (!compatible) {
        continue;
      }

      const targets = outgoing.get(sourceNode.id);

      if (!targets || targets.has(targetNode.id)) {
        continue;
      }

      targets.add(targetNode.id);
      indegree.set(targetNode.id, (indegree.get(targetNode.id) ?? 0) + 1);
    }
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
    let nextY = 0;

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
      .forEach((node) => {
        positions.set(node.id, {
          x: columnIndex * GRAPH_NODE_HORIZONTAL_GAP,
          y: nextY,
        });

        const measuredHeight = measuredHeightByNodeId[node.id];
        const estimatedHeight = expandedNodeIds.has(node.id)
          ? GRAPH_NODE_EXPANDED_ESTIMATED_HEIGHT_PX
          : GRAPH_NODE_COLLAPSED_HEIGHT_PX;

        nextY += (measuredHeight ?? estimatedHeight) + GRAPH_NODE_VERTICAL_GAP;
      });
  }

  return positions;
}

function WorkspaceGraphCanvas({
  currentWorkspaceId,
  includeManagedHiddenNodes,
  onBindingsChange,
  onOpenWidgetSettings,
  onWidgetPropsChange,
  onShowManagedWidgets,
  userId,
  workspaceListPath,
}: {
  currentWorkspaceId: string;
  includeManagedHiddenNodes: boolean;
  onBindingsChange: (
    instanceId: string,
    bindings: DashboardWidgetInstance["bindings"],
  ) => void;
  onOpenWidgetSettings: (instanceId: string) => void;
  onWidgetPropsChange: (instanceId: string, props: Record<string, unknown>) => void;
  onShowManagedWidgets: () => void;
  userId: string;
  workspaceListPath: string;
}) {
  const dependencyModel = useDashboardWidgetDependencies();
  const widgetExecution = useDashboardWidgetExecution();
  const [attachedEditorState, setAttachedEditorState] = useState<{
    draft: string;
    editMode: boolean;
    nodeId: string;
  } | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null);
  const [dependencyFocusNodeId, setDependencyFocusNodeId] = useState<string | null>(null);
  const [visibleOutputIdsByNodeId, setVisibleOutputIdsByNodeId] = useState<Record<string, string[]>>(
    {},
  );
  const [expandedNodeIds, setExpandedNodeIds] = useState<Record<string, true>>({});
  const [expandedReferenceNodeIds, setExpandedReferenceNodeIds] = useState<Record<string, true>>({});
  const [referencedWorkspaceLoadStateById, setReferencedWorkspaceLoadStateById] = useState<
    Record<string, ReferencedWorkspaceLoadState>
  >({});
  const [pinnedNodePositionsById, setPinnedNodePositionsById] = useState<Record<string, XYPosition>>(
    {},
  );
  const [measuredNodeHeightsById, setMeasuredNodeHeightsById] = useState<Record<string, number>>(
    {},
  );
  const reactFlowInstanceRef = useRef<ReactFlowInstance<WorkspaceGraphFlowNode, Edge> | null>(
    null,
  );
  const lastAutoFitGraphSignatureRef = useRef<string | null>(null);

  const instanceIndex = useMemo(
    () => createDashboardWidgetEntryIndex(dependencyModel?.entries ?? []),
    [dependencyModel],
  );
  const visibleGraph = useMemo(
    () =>
      dependencyModel
        ? resolveVisibleWorkspaceGraph(dependencyModel.graph, {
            includeManagedHiddenNodes,
          })
        : {
            nodes: [],
            edges: [],
            hiddenManagedNodeCount: 0,
            hiddenNonGraphNodeCount: 0,
            hiddenNodeCount: 0,
          },
    [dependencyModel, includeManagedHiddenNodes],
  );
  const workspaceReferenceTargetByNodeId = useMemo(() => {
    if (!dependencyModel) {
      return {} satisfies Record<string, WorkspaceReferenceExpansionTarget>;
    }

    const entries = visibleGraph.nodes.flatMap((node) => {
      if (node.widgetId !== WORKSPACE_REFERENCE_WIDGET_ID) {
        return [];
      }

      const outputValue = dependencyModel.resolveOutputs(node.id)?.[WORKSPACE_REFERENCE_OUTPUT_ID]?.value;
      const instance = instanceIndex.get(node.id);
      const workspaceId =
        normalizeWorkspaceReferenceId(outputValue) ??
        normalizeWorkspaceId(instance?.props?.workspaceId);

      if (!workspaceId || workspaceId === currentWorkspaceId) {
        return [];
      }

      return [[node.id, { workspaceId }] as const];
    });

    return Object.fromEntries(entries) satisfies Record<string, WorkspaceReferenceExpansionTarget>;
  }, [currentWorkspaceId, dependencyModel, instanceIndex, visibleGraph.nodes]);
  const layoutedPositions = useMemo(
    () =>
      layoutGraphNodes(visibleGraph, {
        expandedNodeIds: new Set(Object.keys(expandedNodeIds)),
        measuredHeightByNodeId: measuredNodeHeightsById,
      }),
    [expandedNodeIds, measuredNodeHeightsById, visibleGraph],
  );
  const graphStructureSignature = useMemo(
    () =>
      JSON.stringify({
        nodeIds: visibleGraph.nodes.map((node) => node.id).sort(),
        edgeIds: visibleGraph.edges.map((edge) => edge.id).sort(),
        referencedNodes: Object.keys(expandedReferenceNodeIds).sort(),
        referencedWorkspaces: Object.entries(referencedWorkspaceLoadStateById)
          .map(([workspaceId, state]) => ({
            workspaceId,
            status: state.status,
            widgetIds: state.status === "ready"
              ? state.workspace.widgets.map((widget) => widget.id).sort()
              : null,
          }))
          .sort((left, right) => left.workspaceId.localeCompare(right.workspaceId)),
      }),
    [
      expandedReferenceNodeIds,
      referencedWorkspaceLoadStateById,
      visibleGraph.edges,
      visibleGraph.nodes,
    ],
  );
  const executionStateByNodeId = useMemo(
    () =>
      Object.fromEntries(
        visibleGraph.nodes.map((node) => [
          node.id,
          widgetExecution?.getExecutionState(node.id),
        ] as const),
      ),
    [visibleGraph.nodes, widgetExecution],
  );

  useEffect(() => {
    if (!dependencyModel || !dependencyFocusNodeId) {
      return;
    }

    if (!visibleGraph.nodes.some((node) => node.id === dependencyFocusNodeId)) {
      setDependencyFocusNodeId(null);
    }
  }, [dependencyFocusNodeId, dependencyModel, visibleGraph.nodes]);

  useEffect(() => {
    if (!activeNodeId) {
      return;
    }

    if (
      !isReferencedGraphElementId(activeNodeId) &&
      !visibleGraph.nodes.some((node) => node.id === activeNodeId)
    ) {
      setActiveNodeId(null);
    }
  }, [activeNodeId, visibleGraph.nodes]);

  useEffect(() => {
    if (!activeEdgeId) {
      return;
    }

    if (
      !isReferencedGraphElementId(activeEdgeId) &&
      !visibleGraph.edges.some((edge) => edge.id === activeEdgeId)
    ) {
      setActiveEdgeId(null);
    }
  }, [activeEdgeId, visibleGraph.edges]);

  useEffect(() => {
    if (!attachedEditorState) {
      return;
    }

    if (!visibleGraph.nodes.some((node) => node.id === attachedEditorState.nodeId)) {
      setAttachedEditorState(null);
    }
  }, [attachedEditorState, visibleGraph.nodes]);

  useEffect(() => {
    if (!dependencyModel) {
      setVisibleOutputIdsByNodeId({});
      return;
    }

    setVisibleOutputIdsByNodeId((current) => {
      const validOutputIdsByNodeId = new Map(
        visibleGraph.nodes.map((node) => [
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
  }, [dependencyModel, visibleGraph.nodes]);

  useEffect(() => {
    const visibleNodeIdSet = new Set(visibleGraph.nodes.map((node) => node.id));

    setExpandedNodeIds((current) => {
      const nextEntries = Object.entries(current).filter(([nodeId]) => visibleNodeIdSet.has(nodeId));

      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }

      return Object.fromEntries(nextEntries);
    });

    setMeasuredNodeHeightsById((current) => {
      const nextEntries = Object.entries(current).filter(([nodeId]) => visibleNodeIdSet.has(nodeId));

      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }

      return Object.fromEntries(nextEntries);
    });
  }, [visibleGraph.nodes]);

  useEffect(() => {
    const expandableNodeIds = new Set(Object.keys(workspaceReferenceTargetByNodeId));

    setExpandedReferenceNodeIds((current) => {
      const nextEntries = Object.entries(current).filter(([nodeId]) =>
        expandableNodeIds.has(nodeId),
      );

      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }

      return Object.fromEntries(nextEntries);
    });
  }, [workspaceReferenceTargetByNodeId]);

  const expandedReferenceWorkspaceIds = useMemo(() => {
    return Array.from(
      new Set(
        Object.keys(expandedReferenceNodeIds).flatMap((nodeId) => {
          const target = workspaceReferenceTargetByNodeId[nodeId];
          return target ? [target.workspaceId] : [];
        }),
      ),
    );
  }, [expandedReferenceNodeIds, workspaceReferenceTargetByNodeId]);

  useEffect(() => {
    const workspaceIdsToLoad = expandedReferenceWorkspaceIds.filter((workspaceId) => {
      const state = referencedWorkspaceLoadStateById[workspaceId];
      return !state || state.status === "idle";
    });

    if (workspaceIdsToLoad.length === 0) {
      return;
    }

    setReferencedWorkspaceLoadStateById((current) => ({
      ...current,
      ...Object.fromEntries(
        workspaceIdsToLoad.map((workspaceId) => [
          workspaceId,
          { status: "loading" } satisfies ReferencedWorkspaceLoadState,
        ]),
      ),
    }));

    for (const workspaceId of workspaceIdsToLoad) {
      void loadPersistedWorkspaceDetail(userId, workspaceId)
        .then((workspace) => {
          setReferencedWorkspaceLoadStateById((current) => ({
            ...current,
            [workspaceId]: workspace
              ? ({ status: "ready", workspace } satisfies ReferencedWorkspaceLoadState)
              : ({ status: "missing" } satisfies ReferencedWorkspaceLoadState),
          }));
        })
        .catch((error) => {
          setReferencedWorkspaceLoadStateById((current) => ({
            ...current,
            [workspaceId]: {
              status: "error",
              error: error instanceof Error ? error.message : "Unable to load workspace.",
            } satisfies ReferencedWorkspaceLoadState,
          }));
        });
    }
  }, [expandedReferenceWorkspaceIds, referencedWorkspaceLoadStateById, userId]);

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

    const incomingEdgesByNodeId = new Map<string, typeof visibleGraph.edges>();

    for (const edge of visibleGraph.edges) {
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
  }, [dependencyFocusNodeId, dependencyModel, visibleGraph.edges]);
  const widgetPropsByNodeId = useMemo(
    () =>
      dependencyModel
        ? new Map(
            dependencyModel.entries.map(({ instance }) => [
              instance.id,
              (instance.props ?? {}) as Record<string, unknown>,
            ]),
          )
        : new Map<string, Record<string, unknown>>(),
    [dependencyModel],
  );

  const derivedNodes = useMemo<WorkspaceGraphFlowNode[]>(() => {
    if (!dependencyModel) {
      return [];
    }

    return visibleGraph.nodes.map((node) => {
      const widgetDefinition = dependencyModel.getWidgetDefinition(node.widgetId);
      const resolvedIo = dependencyModel.resolveIo(node.id);
      const resolvedInputs = dependencyModel.resolveInputs(node.id);
      const outputsByPort = new Map<string, number>();

      for (const edge of visibleGraph.edges) {
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
      const nonAgentContextOutputs = outputs.filter(
        (output) => output.id !== WIDGET_AGENT_CONTEXT_OUTPUT_ID,
      );
      const defaultVisibleOutputIds = new Set<string>(
        nonAgentContextOutputs
          .filter((output) => !isWidgetReferenceSourceOutputId(output.id))
          .map((output) => output.id),
      );
      const locallyVisibleOutputIds = new Set(visibleOutputIdsByNodeId[node.id] ?? []);
      const visibleOutputs = outputs.filter(
        (output) =>
          outputs.length === 1 ||
          defaultVisibleOutputIds.has(output.id) ||
          output.connectionCount > 0 ||
          locallyVisibleOutputIds.has(output.id) ||
          output.id === WIDGET_AGENT_CONTEXT_OUTPUT_ID,
      ).map((output) => ({
        ...output,
        removable:
          output.connectionCount === 0 &&
          locallyVisibleOutputIds.has(output.id) &&
          output.id !== WIDGET_AGENT_CONTEXT_OUTPUT_ID,
      }));
      const availableOutputs = outputs.filter(
        (output) =>
          outputs.length !== 1 &&
          !defaultVisibleOutputIds.has(output.id) &&
          output.connectionCount === 0 &&
          !locallyVisibleOutputIds.has(output.id) &&
          output.id !== WIDGET_AGENT_CONTEXT_OUTPUT_ID,
      );
      const executionState = executionStateByNodeId[node.id];
      const referenceTarget = workspaceReferenceTargetByNodeId[node.id];
      const referenceExpanded = Boolean(expandedReferenceNodeIds[node.id]);
      const referenceLoadState = referenceTarget
        ? referencedWorkspaceLoadStateById[referenceTarget.workspaceId]
        : undefined;
      const editorOpen = attachedEditorState?.nodeId === node.id;

      return ({
        id: node.id,
        type: "workspaceWidget",
        position: layoutedPositions.get(node.id) ?? { x: 0, y: 0 },
        draggable: true,
        style: {
          cursor: "default",
        },
        data: {
          title: resolveGraphNodeTitle(node, widgetDefinition),
          widgetId: node.widgetId,
          widgetKind: widgetDefinition?.kind,
          widgetProps: widgetPropsByNodeId.get(node.id),
          widgetSource: widgetDefinition?.source,
          ownedManagedConnectionSourceCount: node.ownedManagedConnectionSourceCount,
          managedSourcesVisible:
            includeManagedHiddenNodes && (node.ownedManagedConnectionSourceCount ?? 0) > 0,
          placementMode: node.placementMode,
          managedRole: node.managedRole,
          railVisibility: node.railVisibility,
          hiddenFromNormalRail: node.hiddenFromNormalRail,
          hiddenInCollapsedRow: node.hiddenInCollapsedRow,
          parentRowId: node.parentRowId,
          expanded: Boolean(expandedNodeIds[node.id]),
          inputs,
          outputs: visibleOutputs,
          availableOutputs,
          executionStatus: executionState?.status,
          executionFinishedAtMs: executionState?.finishedAtMs,
          referenceExpansion: referenceTarget
            ? {
                expanded: referenceExpanded,
                status: referenceExpanded ? (referenceLoadState?.status ?? "idle") : "idle",
                targetWorkspaceId: referenceTarget.workspaceId,
                onToggle: () => {
                  setExpandedReferenceNodeIds((current) => {
                    if (current[node.id]) {
                      const nextState = { ...current };
                      delete nextState[node.id];
                      return nextState;
                    }

                    return {
                      ...current,
                      [node.id]: true,
                    };
                  });
                },
              }
            : undefined,
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
          onOpenSettings: () => {
            onOpenWidgetSettings(node.id);
          },
          onUpdateWidgetProps: (props) => {
            onWidgetPropsChange(node.id, props);
          },
          attachedEditorState:
            widgetPropsByNodeId.has(node.id)
              ? {
                  close: () => {
                    setAttachedEditorState((current) =>
                      current?.nodeId === node.id ? null : current,
                    );
                  },
                  draft: editorOpen ? attachedEditorState?.draft ?? "" : "",
                  editMode: editorOpen ? attachedEditorState?.editMode ?? false : false,
                  open: editorOpen,
                  setDraft: (draft) => {
                    setAttachedEditorState((current) =>
                      current?.nodeId === node.id ? { ...current, draft } : current,
                    );
                  },
                  startEditing: (draft) => {
                    setAttachedEditorState({
                      nodeId: node.id,
                      editMode: true,
                      draft,
                    });
                  },
                  stopEditing: (draft) => {
                    setAttachedEditorState((current) =>
                      current?.nodeId === node.id
                        ? {
                            ...current,
                            draft,
                            editMode: false,
                          }
                        : current,
                    );
                  },
                  toggle: (draft) => {
                    setAttachedEditorState((current) =>
                      current?.nodeId === node.id
                        ? null
                        : {
                            nodeId: node.id,
                            editMode: false,
                            draft,
                          },
                    );
                  },
                }
              : undefined,
          onRevealManagedSources:
            (node.ownedManagedConnectionSourceCount ?? 0) > 0 && !includeManagedHiddenNodes
              ? () => {
                  onShowManagedWidgets();
                  setDependencyFocusNodeId(node.id);
                  setExpandedNodeIds((current) =>
                    current[node.id]
                      ? current
                      : {
                          ...current,
                          [node.id]: true,
                        },
                  );
                }
              : undefined,
          onToggleExpanded: () => {
            setExpandedNodeIds((current) => {
              if (current[node.id]) {
                const nextState = { ...current };
                delete nextState[node.id];
                return nextState;
              }

              return {
                ...current,
                [node.id]: true,
              };
            });
          },
          onHeightChange: (height) => {
            const nextHeight = Math.max(0, Math.ceil(height));

            setMeasuredNodeHeightsById((current) =>
              current[node.id] === nextHeight
                ? current
                : {
                    ...current,
                    [node.id]: nextHeight,
                  },
            );
          },
        } satisfies WorkspaceGraphNodeData,
      } satisfies WorkspaceGraphFlowNode);
    });
  }, [
    dependencyFocusNodeId,
    dependencyHighlight,
    dependencyModel,
    executionStateByNodeId,
    expandedNodeIds,
    expandedReferenceNodeIds,
    attachedEditorState,
    layoutedPositions,
    onOpenWidgetSettings,
    onWidgetPropsChange,
    referencedWorkspaceLoadStateById,
    visibleGraph.edges,
    visibleGraph.nodes,
    visibleOutputIdsByNodeId,
    widgetPropsByNodeId,
    workspaceReferenceTargetByNodeId,
    includeManagedHiddenNodes,
    onShowManagedWidgets,
  ]);

  const derivedEdges = useMemo<WorkspaceGraphFlowEdge[]>(() => {
    if (!dependencyModel) {
      return [];
    }

    const nodeById = new Map(visibleGraph.nodes.map((node) => [node.id, node] as const));

    return visibleGraph.edges.flatMap((edge) => {
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
      const edgeRunning =
        sourceExecutionState?.status === "running" ||
        targetExecutionState?.status === "running";
      const variableEdge = edge.source === "variable-reference";
      const systemManagedEdge = edge.source === "system-managed";
      const edgeStroke = broken
        ? "var(--color-danger)"
        : edgeRunning
          ? "var(--color-primary)"
          : variableEdge
            ? "color-mix(in srgb, var(--primary) 78%, transparent)"
            : systemManagedEdge
              ? "color-mix(in srgb, var(--primary) 52%, transparent)"
              : "color-mix(in srgb, var(--border) 82%, transparent)";
      const dependencyHighlighted = dependencyHighlight.highlightedEdgeIds.has(edge.id);
      const highlightedStroke = broken
        ? "color-mix(in srgb, var(--color-danger) 82%, white 18%)"
        : "color-mix(in srgb, var(--color-primary) 78%, white 22%)";
      const targetLabel =
        edge.reference?.targetKind === "title"
          ? "title"
          : edge.reference?.targetPath?.join(".");
      const edgeLabel = variableEdge
        ? targetLabel
          ? `variable -> ${targetLabel}`
          : "variable"
        : systemManagedEdge
          ? "managed"
          : undefined;
      const diagnostic = buildGraphEdgeDiagnostic(edge, sourceNode, targetNode, dependencyModel);

      return [
        {
          id: edge.id,
          type: "workspaceGraphEdge",
          source: edge.from,
          target: edge.to,
          sourceHandle: buildWidgetGraphHandleId("output", edge.fromPort),
          targetHandle: buildWidgetGraphHandleId("input", edge.toPort),
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: dependencyHighlighted ? highlightedStroke : edgeStroke,
          },
          data: {
            diagnostic,
            label: edgeLabel,
          },
          style: {
            stroke: dependencyHighlighted ? highlightedStroke : edgeStroke,
            strokeWidth: dependencyHighlighted
              ? 4
              : broken
                ? 2
                : edgeRunning
                  ? 3.5
                  : variableEdge
                    ? 3
                  : 2.5,
            strokeDasharray: broken
              ? "8 6"
              : variableEdge
                ? "5 5"
                : systemManagedEdge
                  ? "2 5"
                  : undefined,
            filter: dependencyHighlighted
              ? "drop-shadow(0 0 6px color-mix(in srgb, var(--primary) 40%, transparent))"
              : undefined,
          },
          animated: edgeRunning,
          deletable: edge.source === "binding",
          selectable: true,
        } satisfies WorkspaceGraphFlowEdge,
      ];
    });
  }, [
    dependencyHighlight.highlightedEdgeIds,
    dependencyModel,
    executionStateByNodeId,
    visibleGraph.edges,
    visibleGraph.nodes,
  ]);

  const localFlowNodes = useMemo<WorkspaceGraphFlowNode[]>(() => {
    return derivedNodes.map((node) => ({
      ...node,
      position: pinnedNodePositionsById[node.id] ?? node.position,
      dragHandle: ".workspace-graph-node-drag-handle",
      selected: node.id === activeNodeId,
      style: {
        cursor: "default",
      },
    }));
  }, [activeNodeId, derivedNodes, pinnedNodePositionsById]);

  const referencedGraphProjection = useMemo(() => {
    const nodes: WorkspaceGraphFlowNode[] = [];
    const edges: Edge[] = [];
    const localNodeById = new Map(localFlowNodes.map((node) => [node.id, node] as const));
    const localMinX = localFlowNodes.reduce(
      (min, node) => Math.min(min, node.position.x),
      Number.POSITIVE_INFINITY,
    );
    const frameLaneRightX =
      (Number.isFinite(localMinX) ? localMinX : 0) - REFERENCED_WORKSPACE_FRAME_GAP_X;
    const referenceEdgeStyle = {
      stroke: "color-mix(in srgb, var(--primary) 58%, transparent)",
      strokeDasharray: "5 6",
      strokeWidth: 2,
    };
    const referencedFrames = Object.entries(workspaceReferenceTargetByNodeId)
      .flatMap(([sourceNodeId, target]) => {
        if (!expandedReferenceNodeIds[sourceNodeId]) {
          return [];
        }

        const sourceNode = localNodeById.get(sourceNodeId);

        if (!sourceNode) {
          return [];
        }

        const workspaceId = target.workspaceId;
        const loadState = referencedWorkspaceLoadStateById[workspaceId] ?? { status: "loading" };
        const openPath = buildWorkspaceStudioCanvasPath(workspaceListPath, workspaceId);
        const readyWorkspace = loadState.status === "ready" ? loadState.workspace : null;
        const referencedModel = readyWorkspace
          ? createDashboardWidgetDependencyModel(readyWorkspace.widgets, getWidgetById)
          : null;
        const referencedVisibleGraph = referencedModel
          ? resolveVisibleWorkspaceGraph(referencedModel.graph, {
              includeManagedHiddenNodes,
            })
          : null;
        const referencedLayout = referencedVisibleGraph
          ? layoutGraphNodes(referencedVisibleGraph)
          : new Map<string, XYPosition>();
        const frameStatus = loadState.status === "idle" ? "loading" : loadState.status;
        const referencedNodes = referencedVisibleGraph?.nodes ?? [];
        const maxChildX = referencedNodes.reduce((max, node) => {
          const position = referencedLayout.get(node.id) ?? { x: 0, y: 0 };
          return Math.max(max, position.x + REFERENCED_WORKSPACE_NODE_WIDTH);
        }, 0);
        const maxChildY = referencedNodes.reduce((max, node) => {
          const position = referencedLayout.get(node.id) ?? { x: 0, y: 0 };
          return Math.max(max, position.y + GRAPH_NODE_COLLAPSED_HEIGHT_PX);
        }, 0);
        const frameWidth = Math.max(
          REFERENCED_WORKSPACE_FRAME_MIN_WIDTH,
          maxChildX + REFERENCED_WORKSPACE_FRAME_PADDING_X * 2,
        );
        const frameHeight = Math.max(
          REFERENCED_WORKSPACE_FRAME_MIN_HEIGHT,
          REFERENCED_WORKSPACE_FRAME_HEADER_HEIGHT +
            maxChildY +
            REFERENCED_WORKSPACE_FRAME_PADDING_Y * 2,
        );

        return [{
          frameHeight,
          frameNodeId: buildReferencedWorkspaceBoundaryNodeId(sourceNodeId, workspaceId),
          frameStatus,
          frameWidth,
          loadState,
          openPath,
          readyWorkspace,
          referencedLayout,
          referencedModel,
          referencedVisibleGraph,
          sourceNode,
          sourceNodeId,
          workspaceId,
        }] as const;
      })
      .sort((left, right) => {
        if (left.sourceNode.position.y !== right.sourceNode.position.y) {
          return left.sourceNode.position.y - right.sourceNode.position.y;
        }

        return left.sourceNode.position.x - right.sourceNode.position.x;
      });
    let nextAvailableFrameY = Number.NEGATIVE_INFINITY;

    for (const referencedFrame of referencedFrames) {
      const {
        frameHeight,
        frameNodeId,
        frameStatus,
        frameWidth,
        loadState,
        openPath,
        readyWorkspace,
        referencedLayout,
        referencedModel,
        referencedVisibleGraph,
        sourceNode,
        sourceNodeId,
        workspaceId,
      } = referencedFrame;
      const preferredFrameY = sourceNode.position.y - 24;
      const framePosition = {
        x: frameLaneRightX - frameWidth,
        y: Number.isFinite(nextAvailableFrameY)
          ? Math.max(preferredFrameY, nextAvailableFrameY)
          : preferredFrameY,
      };
      nextAvailableFrameY = framePosition.y + frameHeight + REFERENCED_WORKSPACE_STACK_GAP_Y;

      nodes.push({
        id: frameNodeId,
        type: "workspaceWidget",
        position: framePosition,
        draggable: false,
        selectable: false,
        zIndex: 0,
        data: {
          title: readyWorkspace?.title ?? "Referenced workspace",
          widgetId: REFERENCED_WORKSPACE_BOUNDARY_WIDGET_ID,
          widgetKind: "custom",
          widgetSource: "workspace_reference",
          hiddenInCollapsedRow: false,
          inputs: [],
          outputs: [],
          availableOutputs: [],
          expanded: false,
          readOnly: true,
          referenceFrame: {
            childCount: referencedVisibleGraph?.nodes.length ?? 0,
            error:
              loadState.status === "error"
                ? loadState.error
                : loadState.status === "missing"
                  ? "Workspace not found."
                  : undefined,
            height: frameHeight,
            openPath,
            status: frameStatus,
            width: frameWidth,
            workspaceId,
            workspaceTitle: readyWorkspace?.title,
          },
        } satisfies WorkspaceGraphNodeData,
      } satisfies WorkspaceGraphFlowNode);

      edges.push({
        id: `${frameNodeId}->${sourceNodeId}`,
        source: frameNodeId,
        sourceHandle: buildWidgetGraphHandleId("output", WORKSPACE_GRAPH_REFERENCE_FRAME_OUTPUT_ID),
        target: sourceNodeId,
        targetHandle: buildWidgetGraphHandleId("input", WORKSPACE_GRAPH_REFERENCE_SOURCE_INPUT_ID),
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "color-mix(in srgb, var(--primary) 58%, transparent)",
        },
        style: referenceEdgeStyle,
        animated: loadState.status === "loading" || loadState.status === "idle",
        deletable: false,
        selectable: false,
        zIndex: 1,
      } satisfies Edge);

      if (!referencedModel || !referencedVisibleGraph) {
        continue;
      }

      const referencedGraphNodeById = new Map(
        referencedVisibleGraph.nodes.map((node) => [node.id, node] as const),
      );

      for (const node of referencedVisibleGraph.nodes) {
        const widgetDefinition = referencedModel.getWidgetDefinition(node.widgetId);
        const resolvedIo = referencedModel.resolveIo(node.id);
        const resolvedInputs = referencedModel.resolveInputs(node.id);
        const outputsByPort = new Map<string, number>();

        for (const edge of referencedVisibleGraph.edges) {
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
        const referencedNodeId = buildReferencedGraphNodeId(sourceNodeId, workspaceId, node.id);
        const childPosition = referencedLayout.get(node.id) ?? { x: 0, y: 0 };

        nodes.push({
          id: referencedNodeId,
          type: "workspaceWidget",
          parentId: frameNodeId,
          position: {
            x: REFERENCED_WORKSPACE_FRAME_PADDING_X + childPosition.x,
            y:
              REFERENCED_WORKSPACE_FRAME_HEADER_HEIGHT +
              REFERENCED_WORKSPACE_FRAME_PADDING_Y +
              childPosition.y,
          },
          extent: "parent",
          draggable: false,
          selectable: false,
          zIndex: 2,
          data: {
            title: node.title,
            widgetId: node.widgetId,
            widgetKind: widgetDefinition?.kind,
            widgetSource: widgetDefinition?.source,
            placementMode: node.placementMode,
            hiddenInCollapsedRow: node.hiddenInCollapsedRow,
            parentRowId: node.parentRowId
              ? buildReferencedGraphNodeId(sourceNodeId, workspaceId, node.parentRowId)
              : undefined,
            inputs,
            outputs,
            availableOutputs: [],
            expanded: false,
            readOnly: true,
          } satisfies WorkspaceGraphNodeData,
        } satisfies WorkspaceGraphFlowNode);
      }

      for (const edge of referencedVisibleGraph.edges) {
        const sourceGraphNode = referencedGraphNodeById.get(edge.from);
        const targetGraphNode = referencedGraphNodeById.get(edge.to);

        if (!sourceGraphNode || !targetGraphNode) {
          continue;
        }

        const source = buildReferencedGraphNodeId(sourceNodeId, workspaceId, edge.from);
        const targetNode = buildReferencedGraphNodeId(sourceNodeId, workspaceId, edge.to);
        const broken = edge.status !== "valid";
        const variableEdge = edge.source === "variable-reference";
        const systemManagedEdge = edge.source === "system-managed";
        const edgeStroke = broken
          ? "var(--color-danger)"
          : variableEdge
            ? "color-mix(in srgb, var(--primary) 72%, transparent)"
            : systemManagedEdge
              ? "color-mix(in srgb, var(--primary) 48%, transparent)"
              : "color-mix(in srgb, var(--border) 78%, transparent)";
        const targetLabel =
          edge.reference?.targetKind === "title"
            ? "title"
            : edge.reference?.targetPath?.join(".");
        const edgeLabel = variableEdge
          ? targetLabel
            ? `variable -> ${targetLabel}`
            : "variable"
          : systemManagedEdge
            ? "managed"
            : undefined;
        const diagnostic = buildGraphEdgeDiagnostic(
          edge,
          sourceGraphNode,
          targetGraphNode,
          referencedModel,
        );

        edges.push({
          id: buildReferencedGraphNodeId(sourceNodeId, workspaceId, edge.id),
          type: "workspaceGraphEdge",
          source,
          sourceHandle: buildWidgetGraphHandleId("output", edge.fromPort),
          target: targetNode,
          targetHandle: buildWidgetGraphHandleId("input", edge.toPort),
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edgeStroke,
          },
          data: {
            diagnostic,
            label: edgeLabel,
          },
          style: {
            stroke: edgeStroke,
            strokeDasharray: broken
              ? "8 6"
              : variableEdge
                ? "5 5"
                : systemManagedEdge
                  ? "2 5"
                  : undefined,
            strokeWidth: broken ? 2 : variableEdge ? 2.75 : 2.25,
          },
          deletable: false,
          selectable: false,
          zIndex: 4,
        } satisfies Edge);
      }
    }

    return { edges, nodes };
  }, [
    expandedReferenceNodeIds,
    includeManagedHiddenNodes,
    localFlowNodes,
    referencedWorkspaceLoadStateById,
    workspaceListPath,
    workspaceReferenceTargetByNodeId,
  ]);

  const flowNodes = useMemo<WorkspaceGraphFlowNode[]>(
    () => [...localFlowNodes, ...referencedGraphProjection.nodes],
    [localFlowNodes, referencedGraphProjection.nodes],
  );

  useEffect(() => {
    const visibleNodeIds = new Set(localFlowNodes.map((node) => node.id));

    setPinnedNodePositionsById((current) => {
      const nextEntries = Object.entries(current).filter(([nodeId]) => visibleNodeIds.has(nodeId));

      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }

      return Object.fromEntries(nextEntries);
    });
  }, [localFlowNodes]);

  useEffect(() => {
    if (flowNodes.length === 0) {
      lastAutoFitGraphSignatureRef.current = null;
      return;
    }

    if (!reactFlowInstanceRef.current) {
      return;
    }

    if (lastAutoFitGraphSignatureRef.current === graphStructureSignature) {
      return;
    }

    lastAutoFitGraphSignatureRef.current = graphStructureSignature;
    void reactFlowInstanceRef.current.fitView({ padding: 0.18 });
  }, [flowNodes.length, graphStructureSignature]);

  const flowEdges = useMemo<Edge[]>(
    () =>
      [...derivedEdges, ...referencedGraphProjection.edges].map((edge) => ({
        ...edge,
        selected: edge.id === activeEdgeId,
      })),
    [activeEdgeId, derivedEdges, referencedGraphProjection.edges],
  );

  useEffect(() => {
    if (!activeNodeId) {
      return;
    }

    if (!flowNodes.some((node) => node.id === activeNodeId)) {
      setActiveNodeId(null);
    }
  }, [activeNodeId, flowNodes]);

  useEffect(() => {
    if (!activeEdgeId) {
      return;
    }

    if (!flowEdges.some((edge) => edge.id === activeEdgeId)) {
      setActiveEdgeId(null);
    }
  }, [activeEdgeId, flowEdges]);

  const onNodesChange = useCallback((changes: NodeChange<WorkspaceGraphFlowNode>[]) => {
    setPinnedNodePositionsById((current) => {
      let changed = false;
      const next = { ...current };

      for (const change of changes) {
        if (change.type === "remove") {
          if (isReferencedGraphElementId(change.id)) {
            continue;
          }

          if (change.id in next) {
            delete next[change.id];
            changed = true;
          }
          continue;
        }

        if (change.type !== "position" || !change.position) {
          continue;
        }

        if (isReferencedGraphElementId(change.id)) {
          continue;
        }

        const previous = next[change.id];

        if (
          previous &&
          previous.x === change.position.x &&
          previous.y === change.position.y
        ) {
          continue;
        }

        next[change.id] = change.position;
        changed = true;
      }

      return changed ? next : current;
    });
  }, []);

  const onEdgesChange = useCallback((_changes: EdgeChange<Edge>[]) => {}, []);

  const handleConnect = useCallback((connection: Connection) => {
    if (!dependencyModel) {
      return;
    }

    if (
      isReferencedGraphElementId(connection.source) ||
      isReferencedGraphElementId(connection.target)
    ) {
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
      if (isReferencedGraphElementId(edge.id) || isReferencedGraphElementId(edge.source) || isReferencedGraphElementId(edge.target)) {
        continue;
      }

      const graphEdge = visibleGraph.edges.find((candidate) => candidate.id === edge.id);

      if (graphEdge && graphEdge.source !== "binding") {
        continue;
      }

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
  }, [dependencyModel, instanceIndex, onBindingsChange, visibleGraph.edges]);

  const isValidConnection = useCallback((connection: Connection | Edge) => {
    if (!dependencyModel) {
      return false;
    }

    if (
      isReferencedGraphElementId(connection.source) ||
      isReferencedGraphElementId(connection.target)
    ) {
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

  useEffect(() => {
    if (!activeEdgeId) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Backspace" && event.key !== "Delete") {
        return;
      }

      const target = event.target as HTMLElement | null;

      if (
        target?.closest("input, textarea, select, [contenteditable='true'], [role='textbox']")
      ) {
        return;
      }

      const selectedEdge = flowEdges.find((edge) => edge.id === activeEdgeId);

      if (!selectedEdge) {
        return;
      }

      event.preventDefault();
      handleEdgesDelete([selectedEdge]);
      setActiveEdgeId(null);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeEdgeId, flowEdges, handleEdgesDelete]);

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      {visibleGraph.hiddenNodeCount > 0 ? (
        <div className="pointer-events-none absolute top-3 right-3 z-20 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/82 px-3 py-2 text-xs text-muted-foreground shadow-[var(--shadow-panel)] backdrop-blur-md">
          {visibleGraph.hiddenManagedNodeCount > 0 && visibleGraph.hiddenNonGraphNodeCount > 0
            ? `${visibleGraph.hiddenManagedNodeCount} managed and ${visibleGraph.hiddenNonGraphNodeCount} non-graph widgets hidden`
            : visibleGraph.hiddenManagedNodeCount > 0
              ? `${visibleGraph.hiddenManagedNodeCount} managed widget${visibleGraph.hiddenManagedNodeCount === 1 ? "" : "s"} hidden`
              : `${visibleGraph.hiddenNonGraphNodeCount} non-graph widget${visibleGraph.hiddenNonGraphNodeCount === 1 ? "" : "s"} hidden`}
        </div>
      ) : null}
      {visibleGraph.nodes.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
          <div className="max-w-md rounded-[calc(var(--radius)-4px)] border border-dashed border-border/70 bg-background/28 px-5 py-4 text-center text-sm text-muted-foreground">
            No connected or graph-relevant widgets to display.
          </div>
        </div>
      ) : null}
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={GRAPH_NODE_TYPES}
        edgeTypes={GRAPH_EDGE_TYPES}
        onInit={(instance) => {
          reactFlowInstanceRef.current = instance;
        }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onEdgesDelete={handleEdgesDelete}
        onEdgeClick={(_event, edge) => {
          if (isReferencedGraphElementId(edge.id)) {
            return;
          }

          setActiveEdgeId(edge.id);
          setActiveNodeId(null);
        }}
        isValidConnection={isValidConnection}
        connectionMode={ConnectionMode.Loose}
        connectOnClick={false}
        elementsSelectable={false}
        selectNodesOnDrag={false}
        nodesDraggable
        nodesConnectable
        edgesReconnectable={false}
        connectionDragThreshold={0}
        nodeDragThreshold={4}
        nodeClickDistance={2}
        connectionRadius={42}
        panOnDrag={false}
        panActivationKeyCode={["Meta", "Control"]}
        className="workspace-graph-flow bg-transparent"
        onNodeClick={(_event, node) => {
          setActiveNodeId(node.id);
          setActiveEdgeId(null);
          setDependencyFocusNodeId(isReferencedGraphElementId(node.id) ? null : node.id);
        }}
        onPaneClick={() => {
          setActiveNodeId(null);
          setActiveEdgeId(null);
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
  const navigate = useNavigate();
  const { savedWidgetsPath, workspaceListPath } = useWorkspaceStudioSurfaceConfig();
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
    commitSelectedWorkspaceControlsState,
  } = useCustomWorkspaceStudio();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [requestDebugOpen, setRequestDebugOpen] = useState(false);
  const [variableExplorerOpen, setVariableExplorerOpen] = useState(false);
  const [showManagedWidgets, setShowManagedWidgets] = useState(false);
  const [returningToDashboard, setReturningToDashboard] = useState(false);
  const pendingReturnFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setLibraryOpen(false);
    setRequestDebugOpen(false);
    setVariableExplorerOpen(false);
    setShowManagedWidgets(false);
    setReturningToDashboard(false);
  }, [selectedDashboard?.id]);

  useEffect(() => {
    return () => {
      if (pendingReturnFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingReturnFrameRef.current);
      }
    };
  }, []);

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

    return widget &&
      hasAllPermissions(permissions, required) &&
      !isManagedDashboardWidgetHiddenFromNormalRail(instance)
      ? [
          {
            id: instance.id,
            title: instance.title,
            layout: instance.layout,
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
                disabled={returningToDashboard}
                onClick={() => {
                  if (returningToDashboard) {
                    return;
                  }

                  flushSync(() => {
                    setReturningToDashboard(true);
                  });

                  pendingReturnFrameRef.current = window.requestAnimationFrame(() => {
                    pendingReturnFrameRef.current = null;
                    openDashboardView();
                  });
                }}
              >
                {returningToDashboard ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowLeft className="h-3.5 w-3.5" />
                )}
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
                active={showManagedWidgets}
                title="Show managed widgets"
                onClick={() => {
                  setShowManagedWidgets((current) => !current);
                }}
              >
                <Eye className="h-3.5 w-3.5" />
              </WorkspaceToolbarButton>
              <WorkspaceToolbarButton
                active={variableExplorerOpen}
                title="Variable Explorer"
                onClick={() => {
                  setVariableExplorerOpen((current) => !current);
                  setRequestDebugOpen(false);
                }}
              >
                <Braces className="h-3.5 w-3.5" />
              </WorkspaceToolbarButton>
              <WorkspaceToolbarButton
                active={requestDebugOpen}
                title="Debug Request"
                onClick={() => {
                  setRequestDebugOpen((current) => !current);
                  setVariableExplorerOpen(false);
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
              <WorkspaceLoadingStatus />
              {isSaving ? <WorkspaceSavingStatus /> : null}
            </>
          }
        />
      </div>

      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ backgroundColor: "var(--workspace-canvas-base-color)" }}
      >
        {returningToDashboard ? (
          <div className="absolute inset-0 z-45 flex items-center justify-center bg-background/32 backdrop-blur-sm">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/90 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>Returning to canvas…</span>
            </div>
          </div>
        ) : null}
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
          onOpenSavedWidgets={
            savedWidgetsPath
              ? () => {
                  navigate(savedWidgetsPath);
                }
              : undefined
          }
          onOpenChange={setLibraryOpen}
          onAddWidget={(widget) => {
            updateSelectedWorkspace((dashboard) => appendCatalogWidget(dashboard, widget));
          }}
        />

        <div className="absolute inset-0 pl-12">
          <WorkspaceGraphCanvas
            currentWorkspaceId={selectedDashboard.id}
            includeManagedHiddenNodes={showManagedWidgets}
            onShowManagedWidgets={() => {
              setShowManagedWidgets(true);
            }}
            userId={user.id}
            workspaceListPath={workspaceListPath}
            onBindingsChange={(instanceId, bindings) => {
              updateSelectedWorkspace((dashboard) =>
                updateDashboardWidgetBindings(dashboard, instanceId, bindings),
              );
            }}
            onOpenWidgetSettings={(instanceId) => {
              openWidgetSettings(instanceId);
            }}
            onWidgetPropsChange={(instanceId, props) => {
              updateSelectedWorkspace((dashboard) =>
                updateDashboardWidgetSettings(dashboard, instanceId, { props }),
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
        <WorkspaceVariableExplorerPanel
          open={variableExplorerOpen}
          onClose={() => {
            setVariableExplorerOpen(false);
          }}
          placementClassName="right-4 top-4 bottom-4"
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
      onStateCommit={commitSelectedWorkspaceControlsState}
    >
      <DashboardWidgetRegistryProvider widgets={resolvedDashboard.widgets}>
        <DashboardWidgetExecutionProvider
          activeSurface="graph"
          scopeId={selectedDashboard.id}
          widgets={resolvedDashboard.widgets}
          writeRuntimeState={(instanceId, runtimeState) => {
            updateSelectedWorkspaceUserState((dashboard) =>
              updateDashboardWidgetRuntimeState(dashboard, instanceId, runtimeState),
              { bumpRevision: false },
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
