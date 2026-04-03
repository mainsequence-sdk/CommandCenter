import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { getWidgetById } from "@/app/registry";
import { useDashboardControls } from "@/dashboards/DashboardControls";
import type { DashboardWidgetInstance } from "@/dashboards/types";
import {
  buildDashboardExecutionSnapshot,
  executeDashboardWidgetGraph,
  listDashboardWidgetExecutionOrder,
  listDashboardRefreshableExecutionTargets,
  type DashboardWidgetGraphExecutionResult,
} from "@/dashboards/widget-graph-execution";
import type {
  WidgetDefinition,
  WidgetExecutionReason,
  WidgetExecutionTargetOverrides,
} from "@/widgets/types";

export interface WidgetExecutionState {
  status: "idle" | "running" | "success" | "error";
  reason?: WidgetExecutionReason;
  targetInstanceId?: string;
  startedAtMs?: number;
  finishedAtMs?: number;
  error?: string;
}

export interface ExecuteWidgetGraphOptions {
  reason: WidgetExecutionReason;
  refreshCycleId?: string;
  targetOverrides?: WidgetExecutionTargetOverrides;
}

export interface EnsureWidgetGraphResolvedOptions {
  enabled: boolean;
  requestKey?: string;
}

interface DashboardWidgetExecutionContextValue {
  executeWidgetGraph: (
    targetInstanceId: string,
    options: ExecuteWidgetGraphOptions,
  ) => Promise<DashboardWidgetGraphExecutionResult>;
  getExecutionState: (instanceId?: string) => WidgetExecutionState | undefined;
}

const DashboardWidgetExecutionContext =
  createContext<DashboardWidgetExecutionContextValue | null>(null);

function serializeExecutionOverrides(value: WidgetExecutionTargetOverrides | undefined) {
  if (!value) {
    return "";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "unserializable";
  }
}

export function DashboardWidgetExecutionProvider({
  children,
  scopeId,
  widgets,
  writeRuntimeState,
  resolveWidgetDefinition,
}: {
  children: ReactNode;
  scopeId: string;
  widgets: DashboardWidgetInstance[];
  writeRuntimeState: (
    instanceId: string,
    runtimeState: Record<string, unknown> | undefined,
  ) => void;
  resolveWidgetDefinition?: (widgetId: string) => WidgetDefinition | undefined;
}) {
  const effectiveResolveWidgetDefinition = resolveWidgetDefinition ?? getWidgetById;
  const { lastRefreshedAt } = useDashboardControls();
  const widgetsRef = useRef(widgets);
  const inFlightRef = useRef(new Map<string, Promise<DashboardWidgetGraphExecutionResult>>());
  const refreshCycleRef = useRef<string | null>(null);
  const initialRefreshCompletedRef = useRef(false);
  const [executionStates, setExecutionStates] = useState<Record<string, WidgetExecutionState>>({});

  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  function setExecutionState(instanceId: string, nextState: WidgetExecutionState) {
    setExecutionStates((current) => ({
      ...current,
      [instanceId]: nextState,
    }));
  }

  function clearRunningExecutionState(instanceId: string, nextState: WidgetExecutionState) {
    setExecutionStates((current) => ({
      ...current,
      [instanceId]: nextState,
    }));
  }

  function buildExecutionKey(
    targetInstanceId: string,
    options: ExecuteWidgetGraphOptions,
  ) {
    const snapshot = buildDashboardExecutionSnapshot({
      widgets: widgetsRef.current,
      resolveWidgetDefinition: effectiveResolveWidgetDefinition,
      targetInstanceId,
      targetOverrides: options.targetOverrides,
    });
    let executionOrder: string[] = [];

    try {
      executionOrder = listDashboardWidgetExecutionOrder(targetInstanceId, snapshot);
    } catch {
      executionOrder = [];
    }

    const graphExecutionKey =
      executionOrder.length > 0 ? executionOrder.join("::") : targetInstanceId;

    return [
      scopeId,
      graphExecutionKey,
      options.reason,
      options.refreshCycleId ?? "",
      serializeExecutionOverrides(options.targetOverrides),
    ].join("::");
  }

  async function runGraph(
    targetInstanceId: string,
    options: ExecuteWidgetGraphOptions,
    sharedExecutedInstanceIds?: Set<string>,
  ) {
    const dedupeKey = buildExecutionKey(targetInstanceId, options);
    const inFlight = inFlightRef.current.get(dedupeKey);

    if (inFlight) {
      return inFlight;
    }

    const executionPromise = executeDashboardWidgetGraph({
      widgets: widgetsRef.current,
      resolveWidgetDefinition: effectiveResolveWidgetDefinition,
      targetInstanceId,
      reason: options.reason,
      refreshCycleId: options.refreshCycleId,
      targetOverrides: options.targetOverrides,
      executedInstanceIds: sharedExecutedInstanceIds,
      onRuntimeStateWrite: (instanceId, runtimeState) => {
        writeRuntimeState(instanceId, runtimeState);
      },
      onNodeStart: ({ instanceId, reason, targetInstanceId: activeTargetInstanceId }) => {
        setExecutionState(instanceId, {
          status: "running",
          reason,
          targetInstanceId: activeTargetInstanceId,
          startedAtMs: Date.now(),
        });
      },
      onNodeComplete: ({
        instanceId,
        reason,
        targetInstanceId: activeTargetInstanceId,
        status,
        error,
      }) => {
        clearRunningExecutionState(instanceId, {
          status: status === "error" ? "error" : "success",
          reason,
          targetInstanceId: activeTargetInstanceId,
          finishedAtMs: Date.now(),
          error,
        });
      },
    }).then((result) => {
      widgetsRef.current = result.widgets;
      return result;
    }).finally(() => {
      inFlightRef.current.delete(dedupeKey);
    });

    inFlightRef.current.set(dedupeKey, executionPromise);
    return executionPromise;
  }

  useEffect(() => {
    if (initialRefreshCompletedRef.current) {
      return;
    }

    initialRefreshCompletedRef.current = true;
    const refreshCycleId = `initial:${scopeId}`;
    const refreshTargets = listDashboardRefreshableExecutionTargets({
      widgets: widgetsRef.current,
      resolveWidgetDefinition: effectiveResolveWidgetDefinition,
      refreshCycleId,
    });

    if (refreshTargets.length === 0) {
      return;
    }

    const sharedExecutedInstanceIds = new Set<string>();
    let cancelled = false;

    async function executeInitialRefresh() {
      for (const targetInstanceId of refreshTargets) {
        if (cancelled) {
          return;
        }

        try {
          const result = await runGraph(
            targetInstanceId,
            {
              reason: "dashboard-refresh",
              refreshCycleId,
            },
            sharedExecutedInstanceIds,
          );

          widgetsRef.current = result.widgets;
        } catch {
          // Keep initial refresh isolated from rendering.
        }
      }
    }

    void executeInitialRefresh();

    return () => {
      cancelled = true;
    };
  }, [effectiveResolveWidgetDefinition, scopeId]);

  useEffect(() => {
    if (!lastRefreshedAt) {
      return;
    }

    const refreshCycleId = String(lastRefreshedAt);

    if (refreshCycleRef.current === refreshCycleId) {
      return;
    }

    refreshCycleRef.current = refreshCycleId;

    const refreshTargets = listDashboardRefreshableExecutionTargets({
      widgets: widgetsRef.current,
      resolveWidgetDefinition: effectiveResolveWidgetDefinition,
      refreshCycleId,
    });

    if (refreshTargets.length === 0) {
      return;
    }

    const sharedExecutedInstanceIds = new Set<string>();
    let cancelled = false;

    async function executeRefreshCycle() {
      for (const targetInstanceId of refreshTargets) {
        if (cancelled) {
          return;
        }

        try {
          const result = await runGraph(
            targetInstanceId,
            {
              reason: "dashboard-refresh",
              refreshCycleId,
            },
            sharedExecutedInstanceIds,
          );

          widgetsRef.current = result.widgets;
        } catch {
          // Keep refresh orchestration isolated from render surfaces.
        }
      }
    }

    void executeRefreshCycle();

    return () => {
      cancelled = true;
    };
  }, [effectiveResolveWidgetDefinition, lastRefreshedAt]);

  const value = useMemo<DashboardWidgetExecutionContextValue>(
    () => ({
      executeWidgetGraph: (targetInstanceId, options) =>
        runGraph(targetInstanceId, options),
      getExecutionState: (instanceId) =>
        instanceId ? executionStates[instanceId] : undefined,
    }),
    [executionStates],
  );

  return (
    <DashboardWidgetExecutionContext.Provider value={value}>
      {children}
    </DashboardWidgetExecutionContext.Provider>
  );
}

export function useDashboardWidgetExecution() {
  return useContext(DashboardWidgetExecutionContext);
}

export function useEnsureWidgetGraphResolved(
  instanceId: string | undefined,
  options: EnsureWidgetGraphResolvedOptions,
) {
  const context = useDashboardWidgetExecution();
  const lastRequestKeyRef = useRef("");
  const { enabled, requestKey = "" } = options;

  useEffect(() => {
    if (!context || !instanceId || !enabled) {
      lastRequestKeyRef.current = "";
      return;
    }

    const nextRequestKey = `${instanceId}::${requestKey}`;

    if (lastRequestKeyRef.current === nextRequestKey) {
      return;
    }

    lastRequestKeyRef.current = nextRequestKey;
    void context.executeWidgetGraph(instanceId, {
      reason: "manual-recalculate",
    }).catch(() => {
      // Passive consumers surface their own loading/error states from the source binding.
    });
  }, [context, enabled, instanceId, requestKey]);
}

export function useWidgetExecutionState(instanceId?: string) {
  const context = useDashboardWidgetExecution();

  return useMemo(
    () => context?.getExecutionState(instanceId),
    [context, instanceId],
  );
}
