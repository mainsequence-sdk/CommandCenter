import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

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
  type DashboardExecutionSurface,
  type DashboardSurfaceHydrationReason,
} from "@/dashboards/dashboard-surface-hydration";
import {
  beginDashboardRequestTraceCycle,
  completeDashboardRequestTraceCycle,
} from "@/dashboards/dashboard-request-trace";
import type { DashboardWidgetInstance } from "@/dashboards/types";
import {
  resolveReferenceBackedWidgetState,
} from "@/dashboards/widget-instance-references";
import { listUnresolvedReferenceBackedPropInputs } from "@/dashboards/widget-dependencies";
import {
  buildDashboardUpstreamResolutionKey,
  resolveDashboardUpstreamRequirement,
  buildDashboardExecutionSnapshot,
  executeDashboardWidgetGraph,
  listDashboardDownstreamExecutionTargets,
  listDashboardWidgetExecutionOrder,
  listDashboardRefreshableExecutionTargets,
  planDashboardVariableDrivenCommit,
  type DashboardWidgetGraphExecutionResult,
} from "@/dashboards/widget-graph-execution";
import type {
  WidgetDefinition,
  WidgetExecutionContext,
  WidgetExecutionDashboardState,
  WidgetExecutionSurface,
  WidgetExecutionTargetOverrides,
} from "@/widgets/types";
import {
  createRuntimeDataStore,
  RuntimeDataStoreProvider,
} from "@/widgets/shared/runtime-data-store";
import {
  DashboardWidgetExecutionContext,
  type DashboardWidgetExecutionContextValue,
  type DashboardVariableDrivenCommitExecutionResult,
  type DashboardWidgetFlowExecutionResult,
  type ExecuteWidgetGraphOptions,
  type ResolveWidgetUpstreamOptions,
  type WidgetExecutionState,
} from "./DashboardWidgetExecutionContext";

interface PassiveUpstreamResolutionOptions extends ResolveWidgetUpstreamOptions {
  settledKey: string;
}

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

function stableJsonStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJsonStringify(entry)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) =>
        `${JSON.stringify(key)}:${stableJsonStringify((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }

  return JSON.stringify(value) ?? String(value);
}

function widgetConfigWithoutRuntime(widget: DashboardWidgetInstance): Record<string, unknown> {
  const { runtimeState: _runtimeState, row, ...rest } = widget;

  return {
    ...rest,
    row: row
      ? {
          ...row,
          children: row.children?.map(widgetConfigWithoutRuntime),
        }
      : undefined,
  };
}

function serializeWidgetConfiguration(value: DashboardWidgetInstance[]) {
  return stableJsonStringify(value.map(widgetConfigWithoutRuntime));
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
  const widgetConfigurationKey = useMemo(
    () => serializeWidgetConfiguration(widgets),
    [widgets],
  );
  const widgetsRef = useRef(widgets);
  const mountedRef = useRef(true);
  const dashboardStateKeyRef = useRef(dashboardStateKey);
  const passiveUpstreamResolutionAttemptsRef = useRef(
    new Map<string, "in-flight" | "settled">(),
  );
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
    passiveUpstreamResolutionAttemptsRef.current.clear();
  }, [lastRefreshedAt, widgetConfigurationKey]);

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
      executionOrder = listDashboardWidgetExecutionOrder(targetInstanceId, snapshot, {
        sourceBoundaryInstanceId: options.sourceBoundaryInstanceId,
      });
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
      options.sourceBoundaryInstanceId ?? "",
    ].join("::");
  }

  function canRunAutomaticExecutionTarget(
    targetInstanceId: string,
    options: Pick<
      ExecuteWidgetGraphOptions,
      "reason" | "refreshCycleId" | "sourceBoundaryInstanceId" | "targetOverrides" | "signal"
    >,
    workingWidgets: DashboardWidgetInstance[],
  ) {
    const snapshot = buildDashboardExecutionSnapshot({
      widgets: workingWidgets,
      resolveWidgetDefinition: effectiveResolveWidgetDefinition,
      targetInstanceId,
      targetOverrides: options.targetOverrides,
      runtimeDataStore,
    });
    const instance = snapshot.getInstance(targetInstanceId);
    const definition = snapshot.getDefinition(targetInstanceId);

    if (!instance || !definition?.execution) {
      return false;
    }

    const resolvedInputs = snapshot.dependencies.resolveInputs(targetInstanceId);

    if (listUnresolvedReferenceBackedPropInputs(resolvedInputs).length > 0) {
      return false;
    }

    const effectiveState = resolveReferenceBackedWidgetState({
      instanceTitle: instance.title,
      props: (instance.props ?? {}) as Record<string, unknown>,
      resolvedInputs,
    });
    const context = {
      executionSurface,
      publicWorkspaceToken,
      scopeId,
      widgetId: instance.widgetId,
      instanceId: targetInstanceId,
      reason: options.reason,
      props: effectiveState.props,
      runtimeState: instance.runtimeState,
      publicExecution: instance.publicExecution,
      resolvedInputs,
      dashboardState,
      runtimeDataStore,
      refreshCycleId: options.refreshCycleId,
      targetOverrides: options.targetOverrides,
      signal: options.signal,
    } satisfies WidgetExecutionContext;

    const executable = definition.execution.canExecute?.(context) !== false;

    if (!executable && import.meta.env.DEV && instance.widgetId === "connection-query") {
      /*
      console.log("[widget-exec:auto-skip]", {
        targetInstanceId,
        widgetId: instance.widgetId,
        reason: options.reason,
        hasTargetOverrides: Boolean(options.targetOverrides),
        query: (effectiveState.props as Record<string, unknown>)?.query,
        variables: (effectiveState.props as Record<string, unknown>)?.variables,
      });
      */
    }

    return executable;
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
      sourceBoundaryInstanceId: options.sourceBoundaryInstanceId,
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

  function buildPassiveUpstreamAttemptKey(
    targetInstanceId: string,
    options: PassiveUpstreamResolutionOptions,
  ) {
    return [
      scopeId,
      targetInstanceId,
      options.settledKey,
      serializeDashboardExecutionState(dashboardState),
      serializeExecutionOverrides(options.targetOverrides),
    ].join("::");
  }

  async function resolvePassiveUpstream(
    targetInstanceId: string,
    options: PassiveUpstreamResolutionOptions,
  ) {
    const attemptKey = buildPassiveUpstreamAttemptKey(targetInstanceId, options);

    if (passiveUpstreamResolutionAttemptsRef.current.has(attemptKey)) {
      return;
    }

    passiveUpstreamResolutionAttemptsRef.current.set(attemptKey, "in-flight");

    try {
      await runGraph(targetInstanceId, {
        reason: "manual-recalculate",
        targetOverrides: options.targetOverrides,
      });
    } finally {
      passiveUpstreamResolutionAttemptsRef.current.set(attemptKey, "settled");
    }
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

            if (!canRunAutomaticExecutionTarget(
              targetInstanceId,
              {
                reason: "upstream-update",
                refreshCycleId: flowCycleId,
              },
              workingWidgets,
            )) {
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
    changeOrigin?: "settings" | "runtime";
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
    const sourceBoundaryInstanceId =
      input.changeOrigin === "runtime" ? input.changedWidgetId : undefined;

    try {
      for (const targetInstanceId of plan.executableTargetWidgetIds) {
        widgetsRef.current = workingWidgets;
        const targetOverrides = plan.executableTargetOverridesByWidgetId[targetInstanceId];

        if (!canRunAutomaticExecutionTarget(
          targetInstanceId,
          {
            reason: "upstream-update",
            refreshCycleId,
            targetOverrides,
            sourceBoundaryInstanceId,
          },
          workingWidgets,
        )) {
          continue;
        }

        const result = await runGraph(
          targetInstanceId,
          {
            reason: "upstream-update",
            refreshCycleId,
            targetOverrides,
            persistTargetRuntimeStateWithOverrides: Boolean(targetOverrides),
            sourceBoundaryInstanceId,
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
    widgetConfigurationKey,
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
      resolvePassiveUpstream: (targetInstanceId, options) =>
        resolvePassiveUpstream(targetInstanceId, options),
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
        const unresolvedReferenceInputs = listUnresolvedReferenceBackedPropInputs(
          snapshot.dependencies.resolveInputs(instanceId),
        );

        if (unresolvedReferenceInputs.length > 0) {
          return {
            executableInstanceIds: [],
            needsResolution: false,
            requestKey: `${instanceId}::waiting-for-reference-backed-settings`,
            settledKey: `${instanceId}::waiting-for-reference-backed-settings`,
          };
        }

        const requirement = resolveDashboardUpstreamRequirement(instanceId, snapshot);

        return {
          ...requirement,
          requestKey: `${requirement.requestKey}::${serializeDashboardExecutionState(dashboardState)}`,
          settledKey: `${requirement.settledKey}::${serializeDashboardExecutionState(dashboardState)}`,
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

export {
  buildDashboardExecutionRequestTraceMeta,
  useDashboardWidgetExecution,
  useDashboardWidgetRequestTraceMeta,
  useEnsureWidgetGraphResolved,
  useResolveWidgetUpstream,
  useWidgetExecutionState,
} from "./DashboardWidgetExecutionContext";
export type { WidgetExecutionState } from "./DashboardWidgetExecutionContext";
