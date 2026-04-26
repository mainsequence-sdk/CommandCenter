import { useSyncExternalStore } from "react";

import type { WidgetExecutionContext, WidgetExecutionReason } from "@/widgets/types";

export type DashboardRequestTraceSource = "execution" | "component" | "ui";
export type DashboardRequestTraceReason =
  | WidgetExecutionReason
  | "component-query"
  | "ui-query";
export type DashboardRequestTraceCycleStatus =
  | "running"
  | "success"
  | "error"
  | "cancelled";
export type DashboardRequestTraceCycleKind = "refresh" | "activity";
export type DashboardRequestTraceResolution =
  | "network"
  | "cache-hit"
  | "shared-promise";

export interface DashboardRequestTraceMeta {
  scopeId: string;
  refreshCycleId?: string;
  instanceId?: string;
  widgetId?: string;
  source: DashboardRequestTraceSource;
  reason: DashboardRequestTraceReason;
  label?: string;
  details?: Record<string, unknown>;
}

export interface DashboardRequestTraceEntry {
  id: string;
  scopeId: string;
  refreshCycleId: string;
  method: string;
  url: string;
  path: string;
  startedAtMs: number;
  completedAtMs?: number;
  durationMs?: number;
  status?: number;
  ok?: boolean;
  error?: string;
  instanceId?: string;
  widgetId?: string;
  source: DashboardRequestTraceSource;
  reason: DashboardRequestTraceReason;
  label?: string;
  resolution?: DashboardRequestTraceResolution;
  details?: Record<string, unknown>;
}

export interface DashboardRequestTraceCycle {
  id: string;
  scopeId: string;
  kind: DashboardRequestTraceCycleKind;
  label?: string;
  status: DashboardRequestTraceCycleStatus;
  startedAtMs: number;
  finishedAtMs?: number;
  requests: DashboardRequestTraceEntry[];
}

interface DashboardRequestTraceScopeState {
  activeCycleId?: string;
  latestCycleId?: string;
  cycles: DashboardRequestTraceCycle[];
}

interface DashboardRequestTraceStoreState {
  scopes: Record<string, DashboardRequestTraceScopeState | undefined>;
}

const MAX_CYCLES_PER_SCOPE = 20;
const MAX_REQUESTS_PER_CYCLE = 250;
const EMPTY_SCOPE_STATE: DashboardRequestTraceScopeState = {
  activeCycleId: undefined,
  latestCycleId: undefined,
  cycles: [],
};

let storeState: DashboardRequestTraceStoreState = {
  scopes: {},
};

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => {
    listener();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function buildRequestPath(url: string) {
  try {
    const resolvedUrl =
      typeof window !== "undefined"
        ? new URL(url, window.location.origin)
        : new URL(url, "http://localhost");

    return `${resolvedUrl.pathname}${resolvedUrl.search}`;
  } catch {
    return url;
  }
}

function updateStore(
  updater: (state: DashboardRequestTraceStoreState) => DashboardRequestTraceStoreState,
) {
  storeState = updater(storeState);
  emitChange();
}

function upsertCycle(
  cycles: DashboardRequestTraceCycle[],
  nextCycle: DashboardRequestTraceCycle,
) {
  const existingIndex = cycles.findIndex((cycle) => cycle.id === nextCycle.id);

  if (existingIndex >= 0) {
    return cycles.map((cycle, index) => (index === existingIndex ? nextCycle : cycle));
  }

  return [nextCycle, ...cycles].slice(0, MAX_CYCLES_PER_SCOPE);
}

function resolveScopeState(scopeId: string) {
  return storeState.scopes[scopeId] ?? EMPTY_SCOPE_STATE;
}

export function beginDashboardRequestTraceCycle({
  activate = true,
  kind = "refresh",
  label,
  refreshCycleId,
  scopeId,
}: {
  activate?: boolean;
  kind?: DashboardRequestTraceCycleKind;
  label?: string;
  refreshCycleId: string;
  scopeId: string;
}) {
  updateStore((currentState) => {
    const currentScopeState = currentState.scopes[scopeId] ?? EMPTY_SCOPE_STATE;
    const existingCycle = currentScopeState.cycles.find((cycle) => cycle.id === refreshCycleId);
    const nextCycle =
      existingCycle && existingCycle.status === "running"
        ? existingCycle
        : {
            id: refreshCycleId,
            scopeId,
            kind,
            label,
            status: "running" as const,
            startedAtMs: Date.now(),
            finishedAtMs: undefined,
            requests: [],
          };

    return {
      scopes: {
        ...currentState.scopes,
        [scopeId]: {
          activeCycleId: activate ? refreshCycleId : currentScopeState.activeCycleId,
          latestCycleId: refreshCycleId,
          cycles: upsertCycle(currentScopeState.cycles, nextCycle),
        },
      },
    };
  });
}

function buildSyntheticActivityCycleId(
  meta: DashboardRequestTraceMeta,
  startedAtMs: number,
) {
  const activityWindow = Math.floor(startedAtMs / 750);
  const actor = meta.instanceId ?? meta.widgetId ?? meta.source;
  return `activity:${actor}:${meta.reason}:${activityWindow}`;
}

export function completeDashboardRequestTraceCycle({
  refreshCycleId,
  scopeId,
  status = "success",
}: {
  refreshCycleId: string;
  scopeId: string;
  status?: DashboardRequestTraceCycleStatus;
}) {
  updateStore((currentState) => {
    const currentScopeState = currentState.scopes[scopeId];

    if (!currentScopeState) {
      return currentState;
    }

    const existingCycle = currentScopeState.cycles.find((cycle) => cycle.id === refreshCycleId);

    if (!existingCycle) {
      return currentState;
    }

    const nextCycle: DashboardRequestTraceCycle = {
      ...existingCycle,
      status,
      finishedAtMs: Date.now(),
    };

    return {
      scopes: {
        ...currentState.scopes,
        [scopeId]: {
          ...currentScopeState,
          activeCycleId:
            currentScopeState.activeCycleId === refreshCycleId
              ? undefined
              : currentScopeState.activeCycleId,
          latestCycleId: refreshCycleId,
          cycles: upsertCycle(currentScopeState.cycles, nextCycle),
        },
      },
    };
  });
}

export function startDashboardRequestTrace(
  meta: DashboardRequestTraceMeta | undefined,
  request: {
    method?: string;
    url: string;
  },
) {
  if (!meta?.scopeId) {
    return null;
  }

  const startedAtMs = Date.now();
  const scopeState = resolveScopeState(meta.scopeId);
  const scopeId = meta.scopeId;
  const syntheticActivityCycle = !meta.refreshCycleId && !scopeState.activeCycleId;
  const refreshCycleId =
    meta.refreshCycleId ??
    scopeState.activeCycleId ??
    buildSyntheticActivityCycleId(meta, startedAtMs);

  beginDashboardRequestTraceCycle({
    scopeId: meta.scopeId,
    refreshCycleId,
    kind: syntheticActivityCycle ? "activity" : "refresh",
    label: meta.label,
    activate: !syntheticActivityCycle,
  });

  const requestId = `${refreshCycleId}:${startedAtMs}:${Math.random().toString(36).slice(2, 8)}`;
  const nextEntry: DashboardRequestTraceEntry = {
    id: requestId,
    scopeId: meta.scopeId,
    refreshCycleId,
    method: (request.method ?? "GET").trim().toUpperCase(),
    url: request.url,
    path: buildRequestPath(request.url),
    startedAtMs,
    instanceId: meta.instanceId,
    widgetId: meta.widgetId,
    source: meta.source,
    reason: meta.reason,
    label: meta.label,
    details: meta.details,
  };

  updateStore((currentState) => {
    const currentScopeState = currentState.scopes[meta.scopeId] ?? EMPTY_SCOPE_STATE;
    const currentCycle =
      currentScopeState.cycles.find((cycle) => cycle.id === refreshCycleId) ?? {
        id: refreshCycleId,
        scopeId: meta.scopeId,
        kind: syntheticActivityCycle ? "activity" : "refresh",
        label: meta.label,
        status: "running" as const,
        startedAtMs,
        requests: [],
      };
    const nextCycle: DashboardRequestTraceCycle = {
      ...currentCycle,
      requests: [...currentCycle.requests, nextEntry].slice(-MAX_REQUESTS_PER_CYCLE),
    };

    return {
      scopes: {
        ...currentState.scopes,
        [meta.scopeId]: {
          activeCycleId: currentScopeState.activeCycleId ?? refreshCycleId,
          latestCycleId: refreshCycleId,
          cycles: upsertCycle(currentScopeState.cycles, nextCycle),
        },
      },
    };
  });

  let completed = false;

  function updateEntry(patch: Partial<DashboardRequestTraceEntry>) {
    if (completed) {
      return;
    }

    completed = true;
    updateStore((currentState) => {
      const currentScopeState = currentState.scopes[scopeId];

      if (!currentScopeState) {
        return currentState;
      }

      const currentCycle = currentScopeState.cycles.find((cycle) => cycle.id === refreshCycleId);

      if (!currentCycle) {
        return currentState;
      }

      const nextCycle: DashboardRequestTraceCycle = {
        ...currentCycle,
        requests: currentCycle.requests.map((entry) =>
          entry.id === requestId
            ? {
                ...entry,
                ...patch,
              }
            : entry,
        ),
      };
      const allCompleted = nextCycle.requests.every((entry) => entry.completedAtMs != null);
      const hasError = nextCycle.requests.some(
        (entry) => entry.ok === false || (entry.status ?? 0) >= 400,
      );
      const finalizedCycle: DashboardRequestTraceCycle =
        nextCycle.kind === "activity" && allCompleted
          ? {
              ...nextCycle,
              status: hasError ? "error" : "success",
              finishedAtMs: Math.max(
                ...nextCycle.requests.map((entry) => entry.completedAtMs ?? entry.startedAtMs),
              ),
            }
          : nextCycle;

      return {
        scopes: {
          ...currentState.scopes,
          [scopeId]: {
            ...currentScopeState,
            cycles: upsertCycle(currentScopeState.cycles, finalizedCycle),
          },
        },
      };
    });
  }

  return {
    fail(error: string) {
      const completedAtMs = Date.now();
      updateEntry({
        completedAtMs,
        durationMs: completedAtMs - startedAtMs,
        error,
        ok: false,
        resolution: "network",
      });
    },
    finish({
      error,
      ok,
      resolution,
      status,
    }: {
      error?: string;
      ok?: boolean;
      resolution?: DashboardRequestTraceResolution;
      status?: number;
    }) {
      const completedAtMs = Date.now();
      updateEntry({
        completedAtMs,
        durationMs: completedAtMs - startedAtMs,
        error,
        ok,
        resolution: resolution ?? "network",
        status,
      });
    },
  };
}

export function useDashboardRequestTrace(scopeId?: string) {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!scopeId) {
        return EMPTY_SCOPE_STATE;
      }

      return storeState.scopes[scopeId] ?? EMPTY_SCOPE_STATE;
    },
    () => EMPTY_SCOPE_STATE,
  );
}

export function clearDashboardRequestTrace(scopeId: string) {
  updateStore((currentState) => {
    if (!(scopeId in currentState.scopes)) {
      return currentState;
    }

    const nextScopes = { ...currentState.scopes };
    delete nextScopes[scopeId];

    return {
      scopes: nextScopes,
    };
  });
}

export function buildDashboardExecutionRequestTraceMeta(
  context: Pick<
    WidgetExecutionContext,
    "instanceId" | "reason" | "refreshCycleId" | "scopeId" | "widgetId"
  >,
): DashboardRequestTraceMeta | undefined {
  if (!context.scopeId) {
    return undefined;
  }

  return {
    scopeId: context.scopeId,
    refreshCycleId: context.refreshCycleId,
    instanceId: context.instanceId,
    widgetId: context.widgetId,
    source: "execution",
    reason: context.reason,
  };
}
