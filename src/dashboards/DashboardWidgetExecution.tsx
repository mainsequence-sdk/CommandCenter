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
import {
  ConnectionRuntimeStoreProvider,
  createConnectionRuntimeStore,
} from "@/connections/connection-runtime-store";
import { getManagedConnectionConsumerAdapter } from "@/widgets/shared/managed-connection-consumer-registry";
import { useDashboardControls } from "@/dashboards/DashboardControls";
import {
  resolveDashboardSurfaceHydrationState,
  shouldStartDashboardSurfaceReturnHydration,
  shouldSuppressPassiveUpstreamResolution,
  type DashboardExecutionSurface,
  type DashboardSurfaceHydrationReason,
} from "@/dashboards/dashboard-surface-hydration";
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
  planDashboardVariableDrivenCommit,
  type DashboardUpstreamResolutionRequirement,
  type DashboardVariableDrivenCommitPlan,
  type DashboardWidgetGraphExecutionResult,
} from "@/dashboards/widget-graph-execution";
import type {
  WidgetDefinition,
  WidgetExecutionDashboardState,
  WidgetExecutionReason,
  WidgetExecutionSurface,
  WidgetExecutionTargetOverrides,
} from "@/widgets/types";
import {
  createRuntimeDataStore,
  RuntimeDataStoreProvider,
} from "@/widgets/shared/runtime-data-store";

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
  persistTargetRuntimeStateWithOverrides?: boolean;
  signal?: AbortSignal;
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

export interface DashboardVariableDrivenCommitExecutionResult {
  status: "success" | "error" | "skipped";
  error?: string;
  changedWidgetId: string;
  plan: DashboardVariableDrivenCommitPlan;
  widgets: DashboardWidgetInstance[];
  downstreamResults: DashboardWidgetGraphExecutionResult[];
  executedInstanceIds: Set<string>;
}

interface DashboardWidgetExecutionContextValue {
  scopeId: string;
  activeSurface: DashboardExecutionSurface;
  executionSurface: WidgetExecutionSurface;
  publicWorkspaceToken?: string;
  activeRefreshCycleId?: string;
  initialHydrationActive: boolean;
  dashboardSurfaceHydrationActive: boolean;
  dashboardSurfaceHydrationReason?: DashboardSurfaceHydrationReason;
  getWidgetInstance: (instanceId?: string) => DashboardWidgetInstance | undefined;
  executeWidgetGraph: (
    targetInstanceId: string,
    options: ExecuteWidgetGraphOptions,
  ) => Promise<DashboardWidgetGraphExecutionResult>;
  executeWidgetFlow: (
    sourceInstanceId: string,
    options: ExecuteWidgetGraphOptions,
  ) => Promise<DashboardWidgetFlowExecutionResult>;
  executeVariableDrivenWidgetCommit: (input: {
    changedWidgetId: string;
    beforeWidgets: DashboardWidgetInstance[];
    afterWidgets: DashboardWidgetInstance[];
  }) => Promise<DashboardVariableDrivenCommitExecutionResult>;
  resolveUpstream: (
    targetInstanceId: string,
    options?: ResolveWidgetUpstreamOptions,
  ) => Promise<DashboardWidgetGraphExecutionResult>;
  getExecutionState: (instanceId?: string) => WidgetExecutionState | undefined;
  getUpstreamRequirement: (
    instanceId?: string,
    options?: ResolveWidgetUpstreamOptions,
  ) => DashboardUpstreamResolutionRequirement | undefined;
  publishRuntimeState: (
    instanceId: string,
    runtimeState: Record<string, unknown> | undefined,
  ) => void;
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
  activeSurface = "dashboard",
  executionSurface = "private-dashboard",
  enableAutomaticHydration = true,
  publicWorkspaceToken,
  scopeId,
  widgets,
  writeRuntimeState,
  resolveWidgetDefinition,
}: {
  children: ReactNode;
  activeSurface?: DashboardExecutionSurface;
  executionSurface?: WidgetExecutionSurface;
  enableAutomaticHydration?: boolean;
  publicWorkspaceToken?: string;
  scopeId: string;
  widgets: DashboardWidgetInstance[];
  writeRuntimeState: (
    instanceId: string,
    runtimeState: Record<string, unknown> | undefined,
  ) => void;
  resolveWidgetDefinition?: (widgetId: string) => WidgetDefinition | undefined;
}) {
  const effectiveResolveWidgetDefinition = resolveWidgetDefinition ?? getWidgetById;
  const runtimeDataStore = useMemo(
    () => createRuntimeDataStore(scopeId),
    [scopeId],
  );
  const connectionRuntimeStore = useMemo(
    () => createConnectionRuntimeStore(scopeId),
    [scopeId],
  );
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
  const dashboardStateKey = useMemo(
    () => serializeDashboardExecutionState(dashboardState),
    [dashboardState],
  );
  const widgetsRef = useRef(widgets);
  const mountedRef = useRef(true);
  const dashboardStateKeyRef = useRef(dashboardStateKey);
  const inFlightRef = useRef(new Map<string, Promise<DashboardWidgetGraphExecutionResult>>());
  const inFlightFlowRef = useRef(
    new Map<string, Promise<DashboardWidgetFlowExecutionResult>>(),
  );
  const refreshCycleRef = useRef<string | null>(null);
  const initialRefreshCompletedRef = useRef(false);
  const initialRefreshRunIdRef = useRef(0);
  const previousSurfaceRef = useRef<DashboardExecutionSurface>(activeSurface);
  const surfaceReturnHydrationRunIdRef = useRef(0);
  const [activeRefreshCycleId, setActiveRefreshCycleId] = useState<string>();
  const [initialRefreshSettled, setInitialRefreshSettled] = useState(false);
  const [surfaceReturnHydrationActive, setSurfaceReturnHydrationActive] = useState(false);
  const [surfaceReturnHydrationCycleId, setSurfaceReturnHydrationCycleId] = useState<
    string | null
  >(null);
  const [executionStates, setExecutionStates] = useState<Record<string, WidgetExecutionState>>({});
  const initialRefreshCycleId = `initial:${scopeId}`;
  const initialRefreshTargets = useMemo(
    () =>
      enableAutomaticHydration
        ? listDashboardRefreshableExecutionTargets({
            widgets,
            resolveWidgetDefinition: effectiveResolveWidgetDefinition,
            refreshCycleId: initialRefreshCycleId,
            dashboardState,
            executionSurface,
            publicWorkspaceToken,
          })
        : [],
    [
      dashboardState,
      enableAutomaticHydration,
      executionSurface,
      effectiveResolveWidgetDefinition,
      initialRefreshCycleId,
      publicWorkspaceToken,
      widgets,
    ],
  );
  const initialHydrationActive =
    initialRefreshTargets.length > 0 && !initialRefreshSettled;
  const surfaceReturnHydrationPending = enableAutomaticHydration
    ? shouldStartDashboardSurfaceReturnHydration({
        previousSurface: previousSurfaceRef.current,
        nextSurface: activeSurface,
        initialRefreshCompleted: initialRefreshCompletedRef.current,
      })
    : false;
  const {
    active: dashboardSurfaceHydrationActive,
    reason: dashboardSurfaceHydrationReason,
  } = resolveDashboardSurfaceHydrationState({
    activeSurface,
    initialHydrationActive,
    surfaceReturnHydrationActive,
    surfaceReturnHydrationPending,
  });

  widgetsRef.current = widgets;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  useEffect(() => {
    dashboardStateKeyRef.current = dashboardStateKey;
  }, [dashboardStateKey]);

  useEffect(() => {
    previousSurfaceRef.current = activeSurface;

    if (!enableAutomaticHydration || activeSurface !== "dashboard") {
      setSurfaceReturnHydrationActive(false);
      setSurfaceReturnHydrationCycleId(null);
      return;
    }

    if (!surfaceReturnHydrationPending) {
      return;
    }

    const runId = surfaceReturnHydrationRunIdRef.current + 1;
    surfaceReturnHydrationRunIdRef.current = runId;
    setSurfaceReturnHydrationActive(true);
    setSurfaceReturnHydrationCycleId(`surface-return:${scopeId}:${runId.toString(36)}`);
  }, [activeSurface, enableAutomaticHydration, scopeId, surfaceReturnHydrationPending]);

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
      runtimeDataStore,
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
      options.persistTargetRuntimeStateWithOverrides ? "persist-target-runtime" : "",
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

    const executionDashboardState = dashboardState;
    const executionDashboardStateKey = serializeDashboardExecutionState(executionDashboardState);
    const isExecutionCurrent = () =>
      mountedRef.current &&
      !options.signal?.aborted &&
      dashboardStateKeyRef.current === executionDashboardStateKey;

    const executionPromise = executeDashboardWidgetGraph({
      scopeId,
      executionSurface,
      publicWorkspaceToken,
      widgets: widgetsRef.current,
      resolveWidgetDefinition: effectiveResolveWidgetDefinition,
      targetInstanceId,
      reason: options.reason,
      refreshCycleId: options.refreshCycleId,
      targetOverrides: options.targetOverrides,
      persistTargetRuntimeStateWithOverrides: options.persistTargetRuntimeStateWithOverrides,
      signal: options.signal,
      executedInstanceIds: sharedExecutedInstanceIds,
      dashboardState: executionDashboardState,
      runtimeDataStore,
      onRuntimeStateWrite: (instanceId, runtimeState) => {
        if (!isExecutionCurrent()) {
          return;
        }

        writeRuntimeState(instanceId, runtimeState);
      },
      onNodeStart: ({ instanceId, reason, targetInstanceId: activeTargetInstanceId }) => {
        if (!isExecutionCurrent()) {
          return;
        }

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
        if (!isExecutionCurrent()) {
          return;
        }

        clearRunningExecutionState(instanceId, {
          status: status === "error" ? "error" : "success",
          reason,
          targetInstanceId: activeTargetInstanceId,
          finishedAtMs: Date.now(),
          error,
        });
      },
    }).then((result) => {
      if (isExecutionCurrent()) {
        widgetsRef.current = result.widgets;
      }
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
            runtimeDataStore,
          });
          const downstreamTargets = listDashboardDownstreamExecutionTargets(
            sourceInstanceId,
            snapshot,
          );

          for (const targetInstanceId of downstreamTargets) {
            snapshot = buildDashboardExecutionSnapshot({
              widgets: workingWidgets,
              resolveWidgetDefinition: effectiveResolveWidgetDefinition,
              runtimeDataStore,
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

  async function executeVariableDrivenWidgetCommit(input: {
    changedWidgetId: string;
    beforeWidgets: DashboardWidgetInstance[];
    afterWidgets: DashboardWidgetInstance[];
  }): Promise<DashboardVariableDrivenCommitExecutionResult> {
    const beforeSnapshot = buildDashboardExecutionSnapshot({
      widgets: input.beforeWidgets,
      resolveWidgetDefinition: effectiveResolveWidgetDefinition,
      runtimeDataStore,
    });
    const afterSnapshot = buildDashboardExecutionSnapshot({
      widgets: input.afterWidgets,
      resolveWidgetDefinition: effectiveResolveWidgetDefinition,
      runtimeDataStore,
    });
    const plan = planDashboardVariableDrivenCommit({
      changedWidgetId: input.changedWidgetId,
      beforeSnapshot,
      afterSnapshot,
      resolveManagedConnectionConsumerAdapter: getManagedConnectionConsumerAdapter,
    });

    widgetsRef.current = input.afterWidgets;

    if (plan.changedVariableEntries.length === 0) {
      return {
        status: "skipped",
        changedWidgetId: input.changedWidgetId,
        plan,
        widgets: input.afterWidgets,
        downstreamResults: [],
        executedInstanceIds: new Set<string>(),
      };
    }

    if (plan.executableTargetWidgetIds.length === 0) {
      return {
        status: "success",
        changedWidgetId: input.changedWidgetId,
        plan,
        widgets: input.afterWidgets,
        downstreamResults: [],
        executedInstanceIds: new Set<string>(),
      };
    }

    const sharedExecutedInstanceIds = new Set<string>();
    const refreshCycleId = `variable-commit:${scopeId}:${input.changedWidgetId}:${Date.now().toString(36)}`;
    beginDashboardRequestTraceCycle({
      scopeId,
      refreshCycleId,
      kind: "activity",
      activate: false,
      label: "Variable-driven widget commit",
    });

    let workingWidgets = input.afterWidgets;
    const downstreamResults: DashboardWidgetGraphExecutionResult[] = [];
    let executionError: string | undefined;

    try {
      for (const targetInstanceId of plan.executableTargetWidgetIds) {
        widgetsRef.current = workingWidgets;
        const targetOverrides = plan.executableTargetOverridesByWidgetId[targetInstanceId];

        const result = await runGraph(
          targetInstanceId,
          {
            reason: "upstream-update",
            refreshCycleId,
            targetOverrides,
            persistTargetRuntimeStateWithOverrides: Boolean(targetOverrides),
          },
          sharedExecutedInstanceIds,
        );

        downstreamResults.push(result);
        workingWidgets = result.widgets;

        if (result.status === "error" && !executionError) {
          executionError = result.error;
        }
      }

      completeDashboardRequestTraceCycle({
        scopeId,
        refreshCycleId,
        status: executionError ? "error" : "success",
      });

      return {
        status: executionError ? "error" : "success",
        error: executionError,
        changedWidgetId: input.changedWidgetId,
        plan,
        widgets: workingWidgets,
        downstreamResults,
        executedInstanceIds: sharedExecutedInstanceIds,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Variable-driven widget commit execution failed.";

      completeDashboardRequestTraceCycle({
        scopeId,
        refreshCycleId,
        status: "error",
      });

      return {
        status: "error",
        error: message,
        changedWidgetId: input.changedWidgetId,
        plan,
        widgets: workingWidgets,
        downstreamResults,
        executedInstanceIds: sharedExecutedInstanceIds,
      };
    }
  }

  useEffect(() => {
    if (!enableAutomaticHydration) {
      initialRefreshCompletedRef.current = true;
      setInitialRefreshSettled(true);
      return;
    }

    if (initialRefreshCompletedRef.current) {
      return;
    }

    const runId = initialRefreshRunIdRef.current + 1;
    initialRefreshRunIdRef.current = runId;
    setInitialRefreshSettled(false);
    const refreshTargets = listDashboardRefreshableExecutionTargets({
      widgets: widgetsRef.current,
      resolveWidgetDefinition: effectiveResolveWidgetDefinition,
      refreshCycleId: initialRefreshCycleId,
      dashboardState,
      executionSurface,
      publicWorkspaceToken,
    });

    if (refreshTargets.length === 0) {
      initialRefreshCompletedRef.current = true;
      setInitialRefreshSettled(true);
      return;
    }

    const sharedExecutedInstanceIds = new Set<string>();
    const abortController = new AbortController();
    let cancelled = false;
    let hadExecutionError = false;
    const isCurrentRun = () =>
      initialRefreshRunIdRef.current === runId &&
      !cancelled &&
      !abortController.signal.aborted;

    async function executeInitialRefresh() {
      await Promise.resolve();

      if (!isCurrentRun()) {
        return;
      }

      beginDashboardRequestTraceCycle({
        scopeId,
        refreshCycleId: initialRefreshCycleId,
      });
      setActiveRefreshCycleId(initialRefreshCycleId);

      for (const targetInstanceId of refreshTargets) {
        if (!isCurrentRun()) {
          completeDashboardRequestTraceCycle({
            scopeId,
            refreshCycleId: initialRefreshCycleId,
            status: "cancelled",
          });
          setActiveRefreshCycleId((current) =>
            current === initialRefreshCycleId ? undefined : current,
          );
          return;
        }

        try {
          const result = await runGraph(
            targetInstanceId,
            {
              reason: "dashboard-refresh",
              refreshCycleId: initialRefreshCycleId,
              signal: abortController.signal,
            },
            sharedExecutedInstanceIds,
          );

          if (!isCurrentRun()) {
            completeDashboardRequestTraceCycle({
              scopeId,
              refreshCycleId: initialRefreshCycleId,
              status: "cancelled",
            });
            setActiveRefreshCycleId((current) =>
              current === initialRefreshCycleId ? undefined : current,
            );
            return;
          }

          if (result.status === "error") {
            hadExecutionError = true;
          }

          if (isCurrentRun()) {
            widgetsRef.current = result.widgets;
          }
        } catch {
          if (!isCurrentRun()) {
            completeDashboardRequestTraceCycle({
              scopeId,
              refreshCycleId: initialRefreshCycleId,
              status: "cancelled",
            });
            setActiveRefreshCycleId((current) =>
              current === initialRefreshCycleId ? undefined : current,
            );
            return;
          }

          hadExecutionError = true;
          // Keep initial refresh isolated from rendering.
        }
      }

      if (!isCurrentRun()) {
        completeDashboardRequestTraceCycle({
          scopeId,
          refreshCycleId: initialRefreshCycleId,
          status: "cancelled",
        });
        setActiveRefreshCycleId((current) =>
          current === initialRefreshCycleId ? undefined : current,
        );
        return;
      }

      initialRefreshCompletedRef.current = true;
      setInitialRefreshSettled(true);
      completeDashboardRequestTraceCycle({
        scopeId,
        refreshCycleId: initialRefreshCycleId,
        status: hadExecutionError ? "error" : "success",
      });
      setActiveRefreshCycleId((current) =>
        current === initialRefreshCycleId ? undefined : current,
      );
    }

    void executeInitialRefresh();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [
    dashboardState,
    enableAutomaticHydration,
    executionSurface,
    effectiveResolveWidgetDefinition,
    initialRefreshCycleId,
    publicWorkspaceToken,
    scopeId,
  ]);

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
      executionSurface,
      publicWorkspaceToken,
    });

    if (refreshTargets.length === 0) {
      return;
    }

    const sharedExecutedInstanceIds = new Set<string>();
    const abortController = new AbortController();
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
              signal: abortController.signal,
            },
            sharedExecutedInstanceIds,
          );

          if (!cancelled) {
            widgetsRef.current = result.widgets;
          }
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
      abortController.abort();
    };
  }, [
    dashboardState,
    executionSurface,
    effectiveResolveWidgetDefinition,
    lastRefreshedAt,
    publicWorkspaceToken,
    scopeId,
  ]);

  useEffect(() => {
    if (!surfaceReturnHydrationCycleId) {
      return;
    }

    const cycleId = surfaceReturnHydrationCycleId;

    const refreshTargets = listDashboardRefreshableExecutionTargets({
      widgets: widgetsRef.current,
      resolveWidgetDefinition: effectiveResolveWidgetDefinition,
      refreshCycleId: cycleId,
      dashboardState,
      executionSurface,
      publicWorkspaceToken,
    });

    if (refreshTargets.length === 0) {
      setSurfaceReturnHydrationActive(false);
      setSurfaceReturnHydrationCycleId((current) =>
        current === cycleId ? null : current,
      );
      return;
    }

    const sharedExecutedInstanceIds = new Set<string>();
    const abortController = new AbortController();
    let cancelled = false;
    let hadExecutionError = false;

    async function executeSurfaceReturnHydration() {
      beginDashboardRequestTraceCycle({
        scopeId,
        refreshCycleId: cycleId,
        label: "Dashboard surface return hydration",
      });
      setActiveRefreshCycleId(cycleId);

      for (const targetInstanceId of refreshTargets) {
        if (cancelled) {
          completeDashboardRequestTraceCycle({
            scopeId,
            refreshCycleId: cycleId,
            status: "cancelled",
          });
          setActiveRefreshCycleId((current) =>
            current === cycleId ? undefined : current,
          );
          setSurfaceReturnHydrationActive(false);
          return;
        }

        try {
          const result = await runGraph(
            targetInstanceId,
            {
              reason: "dashboard-refresh",
              refreshCycleId: cycleId,
              signal: abortController.signal,
            },
            sharedExecutedInstanceIds,
          );

          if (!cancelled) {
            widgetsRef.current = result.widgets;
          }

          if (result.status === "error") {
            hadExecutionError = true;
          }
        } catch {
          hadExecutionError = true;
        }
      }

      completeDashboardRequestTraceCycle({
        scopeId,
        refreshCycleId: cycleId,
        status: hadExecutionError ? "error" : "success",
      });
      setActiveRefreshCycleId((current) =>
        current === cycleId ? undefined : current,
      );
      setSurfaceReturnHydrationActive(false);
      setSurfaceReturnHydrationCycleId((current) =>
        current === cycleId ? null : current,
      );
    }

    void executeSurfaceReturnHydration();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [
    dashboardState,
    executionSurface,
    effectiveResolveWidgetDefinition,
    publicWorkspaceToken,
    scopeId,
    surfaceReturnHydrationCycleId,
  ]);

  const value = useMemo<DashboardWidgetExecutionContextValue>(
    () => ({
      scopeId,
      activeSurface,
      executionSurface,
      publicWorkspaceToken,
      activeRefreshCycleId,
      initialHydrationActive,
      dashboardSurfaceHydrationActive,
      dashboardSurfaceHydrationReason,
      getWidgetInstance: (instanceId) => {
        if (!instanceId) {
          return undefined;
        }

        const snapshot = buildDashboardExecutionSnapshot({
          widgets: widgetsRef.current,
          resolveWidgetDefinition: effectiveResolveWidgetDefinition,
          runtimeDataStore,
        });

        return snapshot.getInstance(instanceId);
      },
      executeWidgetGraph: (targetInstanceId, options) =>
        runGraph(targetInstanceId, options),
      executeWidgetFlow: (sourceInstanceId, options) =>
        runFlow(sourceInstanceId, options),
      executeVariableDrivenWidgetCommit: (input) =>
        executeVariableDrivenWidgetCommit(input),
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
          runtimeDataStore,
        });
        const requirement = resolveDashboardUpstreamRequirement(instanceId, snapshot);

        return {
          ...requirement,
          requestKey: `${requirement.requestKey}::${serializeDashboardExecutionState(dashboardState)}`,
        };
      },
      publishRuntimeState: (instanceId, runtimeState) => {
        if (!instanceId) {
          return;
        }

        writeRuntimeState(instanceId, runtimeState);
      },
    }),
    [
      activeSurface,
      activeRefreshCycleId,
      dashboardSurfaceHydrationActive,
      dashboardSurfaceHydrationReason,
      dashboardState,
      executionSurface,
      effectiveResolveWidgetDefinition,
      executionStates,
      initialHydrationActive,
      publicWorkspaceToken,
      runtimeDataStore,
      scopeId,
      widgets,
    ],
  );

  return (
    <RuntimeDataStoreProvider store={runtimeDataStore}>
      <ConnectionRuntimeStoreProvider store={connectionRuntimeStore}>
        <DashboardWidgetExecutionContext.Provider value={value}>
          {children}
        </DashboardWidgetExecutionContext.Provider>
      </ConnectionRuntimeStoreProvider>
    </RuntimeDataStoreProvider>
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

    if (
      shouldSuppressPassiveUpstreamResolution({
        dashboardSurfaceHydrationActive:
          context.dashboardSurfaceHydrationActive === true,
      })
    ) {
      lastRequestKeyRef.current = "";
      return;
    }

    const nextRequestKey = `${instanceId}::${upstreamRequirement.requestKey}`;

    if (lastRequestKeyRef.current === nextRequestKey) {
      return;
    }

    lastRequestKeyRef.current = nextRequestKey;
    void context.resolveUpstream(instanceId, { targetOverrides }).catch(() => undefined);
  }, [
    context,
    enabled,
    instanceId,
    targetOverrides,
    upstreamRequirement?.needsResolution,
    upstreamRequirement?.requestKey,
  ]);

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
