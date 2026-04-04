import type { LocalTimeSerieDependencyGraphResponse } from "../../../../common/api";
import type { MainSequenceDependencyGraphRuntimeState } from "./MainSequenceDependencyGraphExplorer";

export interface MainSequenceDependencyGraphWidgetProps extends Record<string, unknown> {
  dataNodeId?: number;
  direction?: "downstream" | "upstream";
  sourceKind?: "data_node" | "simple_table";
  simpleTableUpdateId?: number;
}

export interface MainSequenceDependencyGraphWidgetRuntimeState
  extends MainSequenceDependencyGraphRuntimeState,
    Record<string, unknown> {
  status?: "idle" | "loading" | "success" | "error";
  error?: string;
  sourceKind?: "data_node" | "simple_table";
  direction?: "downstream" | "upstream";
  selectedDataNodeId?: number;
  selectedSimpleTableUpdateId?: number;
  resolvedLocalTimeSerieId?: number;
  payload?: LocalTimeSerieDependencyGraphResponse;
  emptyReason?: "no-linked-updates";
  lastLoadedAtMs?: number;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeDependencyGraphSourceKind(
  value: unknown,
): "data_node" | "simple_table" {
  return value === "simple_table" ? "simple_table" : "data_node";
}

export function normalizeDependencyGraphDirection(
  value: unknown,
): "downstream" | "upstream" {
  return value === "upstream" ? "upstream" : "downstream";
}

export function normalizeDependencyGraphSelectedId(value: unknown) {
  const parsed = Number(value ?? 0);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.trunc(parsed);
}

function normalizeDependencyGraphPayload(
  value: unknown,
): LocalTimeSerieDependencyGraphResponse | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    return undefined;
  }

  return {
    nodes: value.nodes,
    edges: value.edges,
    groups: Array.isArray(value.groups) ? value.groups : [],
  } as LocalTimeSerieDependencyGraphResponse;
}

export function normalizeDependencyGraphRuntimeState(
  runtimeState: Record<string, unknown> | undefined,
): MainSequenceDependencyGraphWidgetRuntimeState {
  const value = isPlainRecord(runtimeState) ? runtimeState : {};

  return {
    zoom:
      typeof value.zoom === "number" && Number.isFinite(value.zoom) ? value.zoom : undefined,
    panX:
      typeof value.panX === "number" && Number.isFinite(value.panX) ? value.panX : undefined,
    panY:
      typeof value.panY === "number" && Number.isFinite(value.panY) ? value.panY : undefined,
    selectedNodeId:
      typeof value.selectedNodeId === "string" && value.selectedNodeId.trim()
        ? value.selectedNodeId
        : null,
    minimapVisible: value.minimapVisible === true,
    status:
      value.status === "loading" ||
      value.status === "success" ||
      value.status === "error"
        ? value.status
        : "idle",
    error:
      typeof value.error === "string" && value.error.trim() ? value.error : undefined,
    sourceKind: normalizeDependencyGraphSourceKind(value.sourceKind),
    direction: normalizeDependencyGraphDirection(value.direction),
    selectedDataNodeId: normalizeDependencyGraphSelectedId(value.selectedDataNodeId) || undefined,
    selectedSimpleTableUpdateId:
      normalizeDependencyGraphSelectedId(value.selectedSimpleTableUpdateId) || undefined,
    resolvedLocalTimeSerieId:
      normalizeDependencyGraphSelectedId(value.resolvedLocalTimeSerieId) || undefined,
    payload: normalizeDependencyGraphPayload(value.payload),
    emptyReason: value.emptyReason === "no-linked-updates" ? "no-linked-updates" : undefined,
    lastLoadedAtMs:
      typeof value.lastLoadedAtMs === "number" && Number.isFinite(value.lastLoadedAtMs)
        ? value.lastLoadedAtMs
        : undefined,
  };
}
