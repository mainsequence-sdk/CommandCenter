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
import {
  beginDashboardRequestTraceCycle,
  buildDashboardExecutionRequestTraceMeta,
  completeDashboardRequestTraceCycle,
  type DashboardRequestTraceMeta,
  type DashboardRequestTraceReason,
  type DashboardRequestTraceSource,
} from "@/dashboards/dashboard-request-trace";
import type { DashboardWidgetInstance } from "@/dashboards/types";
import {
  buildDashboardUpstreamResolutionKey,
  resolveDashboardUpstreamRequirement,
  buildDashboardExecutionSnapshot,
  executeDashboardWidgetGraph,
  listDashboardDownstreamExecutionTargets,
  listDashboardWidgetExecutionOrder,
  listDashboardRefreshableExecutionTargets,
  type DashboardUpstreamResolutionRequirement,
  type DashboardWidgetGraphExecutionResult,
} from "@/dashboards/widget-graph-execution";
import type {
  WidgetDefinition,
  WidgetExecutionDashboardState,
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

export interface ResolveWidgetUpstreamOptions {
  targetOverrides?: WidgetExecutionTargetOverrides;
}

export interface ResolveWidgetUpstreamHookOptions
  extends ResolveWidgetUpstreamOptions {
  enabled: boolean;
}

export interface DashboardWidgetFlowExecutionResult {
  status: "success" | "error" | "skipped";
  error?: string;
  widgets: DashboardWidgetInstance[];
  sourceInstanceId: string;
  sourceResult: DashboardWidgetGraphExecutionResult;
  downstreamResults: DashboardWidgetGraphExecutionResult[];
  executedInstanceIds: Set<string>;
}

interface DashboardWidgetExecutionContextValue {
  scopeId: string;
  activeRefreshCycleId?: string;
  executeWidgetGraph: (
    targetInstanceId: string,
    options: ExecuteWidgetGraphOptions,
  ) => Promise<DashboardWidgetGraphExecutionResult>;
  executeWidgetFlow: (
    sourceInstanceId: string,
    options: ExecuteWidgetGraphOptions,
  ) => Promise<DashboardWidgetFlowExecutionResult>;
  resolveUpstream: (
    targetInstanceId: string,
    options?: ResolveWidgetUpstreamOptions,
  ) => Promise<DashboardWidgetGraphExecutionResult>;
  getExecutionState: (instanceId?: string) => WidgetExecutionState | undefined;
  getUpstreamRequirement: (
    instanceId?: string,
    options?: ResolveWidgetUpstreamOptions,
  ) => DashboardUpstreamResolutionRequirement | undefined;
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

function serializeDashboardExecutionState(value: WidgetExecutionDashboardState) {
  return [
    value.timeRangeKey,
    value.rangeStartMs,
    value.rangeEndMs,
    value.refreshIntervalMs ?? "off",
  ].join(":");
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
  const {
    lastRefreshedAt,
    rangeEndMs,
    rangeStartMs,
    refreshIntervalMs,
    timeRangeKey,
  } = useDashboardControls();
  const dashboardState = useMemo<WidgetExecutionDashboardState>(
    () => ({
      timeRangeKey,
      rangeStartMs,
      rangeEndMs,
      refreshIntervalMs,
    }),
    [rangeEndMs, rangeStartMs, refreshIntervalMs, timeRangeKey],
  );
  const widgetsRef = useRef(widgets);
  const inFlightRef = useRef(new Map<string, Promise<DashboardWidgetGraphExecutionResult>>());
  const inFlightFlowRef = useRef(
    new Map<string, Promise<DashboardWidgetFlowExecutionResult>>(),
  );
  const refreshCycleRef = useRef<string | null>(null);
  const initialRefreshCompletedRef = useRef(false);
  const [activeRefreshCycleId, setActiveRefreshCycleId] = useState<string>();
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
    const upstreamResolutionKey = buildDashboardUpstreamResolutionKey(
      targetInstanceId,
      snapshot,
    );

    try {
      executionOrder = listDashboardWidgetExecutionOrder(targetInstanceId, snapshot);
    } catch {
      executionOrder = [];
    }

    const graphExecutionKey =
      executionOrder.length > 0
        ? `${upstreamResolutionKey}::${executionOrder.join("::")}`
        : upstreamResolutionKey;

    return [
      scopeId,
      graphExecutionKey,
      serializeDashboardExecutionState(dashboardState),
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
      scopeId,
      widgets: widgetsRef.current,
      resolveWidgetDefinition: effectiveResolveWidgetDefinition,
      targetInstanceId,
      reason: options.reason,
      refreshCycleId: options.refreshCycleId,
      targetOverrides: options.targetOverrides,
      executedInstanceIds: sharedExecutedInstanceIds,
      dashboardState,
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

  function buildFlowExecutionKey(
    sourceInstanceId: string,
    options: ExecuteWidgetGraphOptions,
  ) {
    return [
      "flow",
      buildExecutionKey(sourceInstanceId, options),
    ].join("::");
  }

  async function runFlow(
    sourceInstanceId: string,
    options: ExecuteWidgetGraphOptions,
  ) {
    const dedupeKey = buildFlowExecutionKey(sourceInstanceId, options);
    const inFlight = inFlightFlowRef.current.get(dedupeKey);

    if (inFlight) {
      return inFlight;
    }

    const executionPromise = (async () => {
      const sharedExecutedInstanceIds = new Set<string>();
      const flowCycleId =
        options.refreshCycleId ??
        `flow:${scopeId}:${sourceInstanceId}:${Date.now().toString(36)}`;

      beginDashboardRequestTraceCycle({
        scopeId,
        refreshCycleId: flowCycleId,
        kind: "activity",
        activate: false,
        label: "Manual widget flow",
      });

      try {
        const sourceResult = await runGraph(
          sourceInstanceId,
          {
            ...options,
            refreshCycleId: flowCycleId,
          },
          sharedExecutedInstanceIds,
        );
        let workingWidgets = sourceResult.widgets;
        const downstreamResults: DashboardWidgetGraphExecutionResult[] = [];
        let flowError = sourceResult.error;
        let flowStatus: DashboardWidgetFlowExecutionResult["status"] =
          sourceResult.status === "error"
            ? "error"
            : sourceResult.status === "success"
              ? "success"
              : "skipped";

        if (sourceResult.status === "success") {
          let snapshot = buildDashboardExecutionSnapshot({
            widgets: workingWidgets,
            resolveWidgetDefinition: effectiveResolveWidgetDefinition,
          });
          const downstreamTargets = listDashboardDownstreamExecutionTargets(
            sourceInstanceId,
            snapshot,
          );

          for (const targetInstanceId of downstreamTargets) {
            snapshot = buildDashboardExecutionSnapshot({
              widgets: workingWidgets,
              resolveWidgetDefinition: effectiveResolveWidgetDefinition,
            });

            const requirement = resolveDashboardUpstreamRequirement(
              targetInstanceId,
              snapshot,
            );

            if (!requirement.executableInstanceIds.includes(sourceInstanceId)) {
              continue;
            }

            const downstreamResult = await runGraph(
              targetInstanceId,
              {
                reason: "upstream-update",
                refreshCycleId: flowCycleId,
              },
              sharedExecutedInstanceIds,
            );

            downstreamResults.push(downstreamResult);
            workingWidgets = downstreamResult.widgets;
            widgetsRef.current = workingWidgets;

            if (downstreamResult.status === "error") {
              flowStatus = "error";
              flowError = flowError ?? downstreamResult.error;
            }
          }
        }

        completeDashboardRequestTraceCycle({
          scopeId,
          refreshCycleId: flowCycleId,
          status: flowStatus === "error" ? "error" : "success",
        });

        return {
          status: flowStatus,
          error: flowError,
          widgets: workingWidgets,
          sourceInstanceId,
          sourceResult,
          downstreamResults,
          executedInstanceIds: sharedExecutedInstanceIds,
        } satisfies DashboardWidgetFlowExecutionResult;
      } catch (error) {
        const fallbackSourceResult: DashboardWidgetGraphExecutionResult = {
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "Widget flow execution failed.",
          widgets: widgetsRef.current,
          targetInstanceId: sourceInstanceId,
          nodeResults: [],
          executedInstanceIds: sharedExecutedInstanceIds,
        };

        completeDashboardRequestTraceCycle({
          scopeId,
          refreshCycleId: flowCycleId,
          status: "error",
        });

        return {
          status: "error",
          error: fallbackSourceResult.error,
          widgets: widgetsRef.current,
          sourceInstanceId,
          sourceResult: fallbackSourceResult,
          downstreamResults: [],
          executedInstanceIds: sharedExecutedInstanceIds,
        } satisfies DashboardWidgetFlowExecutionResult;
      }
    })().finally(() => {
      inFlightFlowRef.current.delete(dedupeKey);
    });

    inFlightFlowRef.current.set(dedupeKey, executionPromise);
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
      dashboardState,
    });

    if (refreshTargets.length === 0) {
      return;
    }

    const sharedExecutedInstanceIds = new Set<string>();
    let cancelled = false;
    let hadExecutionError = false;

    async function executeInitialRefresh() {
      beginDashboardRequestTraceCycle({
        scopeId,
        refreshCycleId,
      });
      setActiveRefreshCycleId(refreshCycleId);

      for (const targetInstanceId of refreshTargets) {
        if (cancelled) {
          completeDashboardRequestTraceCycle({
            scopeId,
            refreshCycleId,
            status: "cancelled",
          });
          setActiveRefreshCycleId((current) =>
            current === refreshCycleId ? undefined : current,
          );
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
          hadExecutionError = true;
          // Keep initial refresh isolated from rendering.
        }
      }

      completeDashboardRequestTraceCycle({
        scopeId,
        refreshCycleId,
        status: hadExecutionError ? "error" : "success",
      });
      setActiveRefreshCycleId((current) =>
        current === refreshCycleId ? undefined : current,
      );
    }

    void executeInitialRefresh();

    return () => {
      cancelled = true;
    };
  }, [dashboardState, effectiveResolveWidgetDefinition, scopeId]);

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
      dashboardState,
    });

    if (refreshTargets.length === 0) {
      return;
    }

    const sharedExecutedInstanceIds = new Set<string>();
    let cancelled = false;
    let hadExecutionError = false;

    async function executeRefreshCycle() {
      beginDashboardRequestTraceCycle({
        scopeId,
        refreshCycleId,
      });
      setActiveRefreshCycleId(refreshCycleId);

      for (const targetInstanceId of refreshTargets) {
        if (cancelled) {
          completeDashboardRequestTraceCycle({
            scopeId,
            refreshCycleId,
            status: "cancelled",
          });
          setActiveRefreshCycleId((current) =>
            current === refreshCycleId ? undefined : current,
          );
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
          hadExecutionError = true;
          // Keep refresh orchestration isolated from render surfaces.
        }
      }

      completeDashboardRequestTraceCycle({
        scopeId,
        refreshCycleId,
        status: hadExecutionError ? "error" : "success",
      });
      setActiveRefreshCycleId((current) =>
        current === refreshCycleId ? undefined : current,
      );
    }

    void executeRefreshCycle();

    return () => {
      cancelled = true;
    };
  }, [dashboardState, effectiveResolveWidgetDefinition, lastRefreshedAt, scopeId]);

  const value = useMemo<DashboardWidgetExecutionContextValue>(
    () => ({
      scopeId,
      activeRefreshCycleId,
      executeWidgetGraph: (targetInstanceId, options) =>
        runGraph(targetInstanceId, options),
      executeWidgetFlow: (sourceInstanceId, options) =>
        runFlow(sourceInstanceId, options),
      resolveUpstream: (targetInstanceId, options) =>
        runGraph(targetInstanceId, {
          reason: "manual-recalculate",
          targetOverrides: options?.targetOverrides,
        }),
      getExecutionState: (instanceId) =>
        instanceId ? executionStates[instanceId] : undefined,
      getUpstreamRequirement: (instanceId, options) => {
        if (!instanceId) {
          return undefined;
        }

        const snapshot = buildDashboardExecutionSnapshot({
          widgets: widgetsRef.current,
          resolveWidgetDefinition: effectiveResolveWidgetDefinition,
          targetInstanceId: instanceId,
          targetOverrides: options?.targetOverrides,
        });
        const requirement = resolveDashboardUpstreamRequirement(instanceId, snapshot);

        return {
          ...requirement,
          requestKey: `${requirement.requestKey}::${serializeDashboardExecutionState(dashboardState)}`,
        };
      },
    }),
    [
      activeRefreshCycleId,
      dashboardState,
      effectiveResolveWidgetDefinition,
      executionStates,
      scopeId,
    ],
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

export function useResolveWidgetUpstream(
  instanceId: string | undefined,
  options: ResolveWidgetUpstreamHookOptions,
) {
  const context = useDashboardWidgetExecution();
  const lastRequestKeyRef = useRef("");
  const { enabled, targetOverrides } = options;
  const upstreamRequirement = useMemo(
    () => context?.getUpstreamRequirement(instanceId, { targetOverrides }),
    [context, instanceId, targetOverrides],
  );

  useEffect(() => {
    if (!context || !instanceId || !enabled || !upstreamRequirement?.needsResolution) {
      lastRequestKeyRef.current = "";
      return;
    }

    const nextRequestKey = `${instanceId}::${upstreamRequirement.requestKey}`;

    if (lastRequestKeyRef.current === nextRequestKey) {
      return;
    }

    lastRequestKeyRef.current = nextRequestKey;
    void context.resolveUpstream(instanceId, { targetOverrides }).catch(() => {
      // Passive consumers surface their own loading/error states from the source binding.
    });
  }, [context, enabled, instanceId, targetOverrides, upstreamRequirement?.needsResolution, upstreamRequirement?.requestKey]);

  return upstreamRequirement;
}

export function useEnsureWidgetGraphResolved(
  instanceId: string | undefined,
  options: ResolveWidgetUpstreamHookOptions,
) {
  return useResolveWidgetUpstream(instanceId, options);
}

export function useWidgetExecutionState(instanceId?: string) {
  const context = useDashboardWidgetExecution();

  return useMemo(
    () => context?.getExecutionState(instanceId),
    [context, instanceId],
  );
}

export function useDashboardWidgetRequestTraceMeta({
  instanceId,
  reason,
  source = "component",
  widgetId,
}: {
  instanceId?: string;
  reason?: DashboardRequestTraceReason;
  source?: DashboardRequestTraceSource;
  widgetId?: string;
}) {
  const context = useDashboardWidgetExecution();

  return useMemo<DashboardRequestTraceMeta | undefined>(() => {
    if (!context?.scopeId) {
      return undefined;
    }

    return {
      scopeId: context.scopeId,
      refreshCycleId: context.activeRefreshCycleId,
      instanceId,
      widgetId,
      source,
      reason:
        reason ??
        (context.activeRefreshCycleId ? "dashboard-refresh" : "component-query"),
    };
  }, [context?.activeRefreshCycleId, context?.scopeId, instanceId, reason, source, widgetId]);
}

export { buildDashboardExecutionRequestTraceMeta };
