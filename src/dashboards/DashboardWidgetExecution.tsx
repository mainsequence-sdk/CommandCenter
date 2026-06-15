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
import { CORE_CONNECTION_QUERY_WIDGET_ID } from "@/widgets/widget-type-normalization";
import { listUnresolvedReferenceBackedPropInputs } from "@/dashboards/widget-dependencies";
import {
  buildDashboardUpstreamResolutionKey,
  resolveDashboardUpstreamRequirement,
  buildDashboardExecutionSnapshot,
  executeDashboardWidgetGraph,
  listDashboardDownstreamExecutionTargets,
  listDashboardWidgetExecutionOrder,
  listDashboardRefreshableExecutionTargets,
  planDashboardFiniteExecution,
  planDashboardRuntimeVariableDrivenCommit,
  planDashboardVariableDrivenCommit,
  resolveWidgetExecutionReadiness,
  type DashboardWidgetGraphExecutionResult,
  type DashboardWidgetGraphNodeStatus,
} from "@/dashboards/widget-graph-execution";
import type {
  ResolvedWidgetInput,
  ResolvedWidgetInputs,
  WidgetDefinition,
  WidgetExecutionContext,
  WidgetExecutionDashboardState,
  WidgetExecutionSurface,
  WidgetExecutionTargetOverrides,
} from "@/widgets/types";
import {
  createRuntimeDataStore,
  RuntimeDataStoreProvider,
  type RuntimeDataStore,
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

const MIN_VISIBLE_EXECUTION_RUNNING_MS = 400;
const VARIABLE_COMMIT_DEBUG_LOGS_ENABLED = false;
const LAUNCH_PLAN_DEBUG_LOGS_ENABLED = false;
const CONNECTION_QUERY_EXECUTION_DEBUG_LOGS_ENABLED = false;

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

function summarizeDebugValue(value: unknown): unknown {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return {
      kind: "array",
      length: value.length,
      sample: value.slice(0, 5).map(summarizeDebugValue),
    };
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);

    return {
      kind: "object",
      keys,
      sample: Object.fromEntries(
        keys.slice(0, 8).map((key) => [key, summarizeDebugValue(record[key])]),
      ),
    };
  }

  return String(value);
}

function summarizeResolvedInputForDebug(input: ResolvedWidgetInput | undefined) {
  if (!input) {
    return null;
  }

  return {
    status: input.status,
    sourceWidgetId: input.sourceWidgetId,
    sourceOutputId: input.sourceOutputId,
    contractId: input.contractId,
    value: summarizeDebugValue(input.value),
    upstreamBase: summarizeDebugValue(input.upstreamBase),
    upstreamDelta: summarizeDebugValue(input.upstreamDelta),
  };
}

function summarizeResolvedReferenceInputsForDebug(
  resolvedInputs: ResolvedWidgetInputs | undefined,
) {
  return Object.fromEntries(
    Object.entries(resolvedInputs ?? {})
      .filter(([inputId]) => inputId.startsWith("__widget-reference.target."))
      .map(([inputId, value]) => [
        inputId,
        Array.isArray(value)
          ? value.map((entry) => summarizeResolvedInputForDebug(entry))
          : summarizeResolvedInputForDebug(value),
      ]),
  );
}

function shouldLogVariableCommitDebug(refreshCycleId: string | undefined) {
  return VARIABLE_COMMIT_DEBUG_LOGS_ENABLED &&
    import.meta.env.DEV &&
    Boolean(refreshCycleId?.startsWith("variable-commit:"));
}

function shouldLogConnectionQueryExecutionDebug(widgetId: string | undefined) {
  return CONNECTION_QUERY_EXECUTION_DEBUG_LOGS_ENABLED &&
    import.meta.env.DEV &&
    widgetId === CORE_CONNECTION_QUERY_WIDGET_ID;
}

function summarizeRefreshTargetForDebug(
  targetInstanceId: string,
  widgets: DashboardWidgetInstance[],
  resolveWidgetDefinition: (widgetId: string) => WidgetDefinition | undefined,
  runtimeDataStore: RuntimeDataStore,
) {
  const snapshot = buildDashboardExecutionSnapshot({
    widgets,
    resolveWidgetDefinition,
    targetInstanceId,
    runtimeDataStore,
  });
  const instance = snapshot.getInstance(targetInstanceId);
  const definition = snapshot.getDefinition(targetInstanceId);

  return {
    targetInstanceId,
    widgetId: instance?.widgetId,
    widgetTitle: instance?.title,
    hasExecution: Boolean(definition?.execution),
  };
}

function logRefreshLaunchPlan(input: {
  phase: string;
  refreshCycleId: string;
  refreshTargets: string[];
  widgets: DashboardWidgetInstance[];
  resolveWidgetDefinition: (widgetId: string) => WidgetDefinition | undefined;
  runtimeDataStore: RuntimeDataStore;
}) {
  if (!LAUNCH_PLAN_DEBUG_LOGS_ENABLED || !import.meta.env.DEV) {
    return;
  }

  const baseSnapshot = buildDashboardExecutionSnapshot({
    widgets: input.widgets,
    resolveWidgetDefinition: input.resolveWidgetDefinition,
    runtimeDataStore: input.runtimeDataStore,
  });

  console.log(
    `[launch-plan] phase=${input.phase} refreshCycleId=${input.refreshCycleId} targetCount=${input.refreshTargets.length} targets=${input.refreshTargets.join(",")}`,
  );

  input.refreshTargets.forEach((targetInstanceId) => {
    const targetSnapshot = buildDashboardExecutionSnapshot({
      widgets: input.widgets,
      resolveWidgetDefinition: input.resolveWidgetDefinition,
      targetInstanceId,
      runtimeDataStore: input.runtimeDataStore,
    });
    const targetInstance = baseSnapshot.getInstance(targetInstanceId);
    let executionOrder: string[] = [];
    let orderError: string | undefined;

    try {
      executionOrder = listDashboardWidgetExecutionOrder(targetInstanceId, targetSnapshot, {
        excludeRefreshNotApplicable: true,
      });
    } catch (error) {
      orderError = error instanceof Error ? error.message : String(error);
    }

    const executionOrderSummary = executionOrder
      .map((nodeInstanceId, executionOrderIndex) => {
        const nodeInstance = targetSnapshot.getInstance(nodeInstanceId);

        return `${executionOrderIndex}:${nodeInstance?.widgetId ?? "missing"}:${nodeInstance?.title ?? "untitled"}:${nodeInstanceId}`;
      })
      .join(" | ");

    console.log(
      `[launch-plan-inline] phase=${input.phase} target=${targetInstance?.widgetId ?? "missing"} title="${targetInstance?.title ?? ""}" targetId=${targetInstanceId} order=${executionOrderSummary || "(empty)"} error=${orderError ?? ""}`,
    );
  });
}

function findWidgetInstanceInTree(
  widgets: DashboardWidgetInstance[],
  instanceId: string,
): DashboardWidgetInstance | undefined {
  for (const widget of widgets) {
    if (widget.id === instanceId) {
      return widget;
    }

    const child = widget.row?.children?.length
      ? findWidgetInstanceInTree(widget.row.children, instanceId)
      : undefined;

    if (child) {
      return child;
    }
  }

  return undefined;
}

function formatLaunchTraceWidget(
  widgets: DashboardWidgetInstance[],
  instanceId: string,
) {
  const widget = findWidgetInstanceInTree(widgets, instanceId);
  return `${widget?.widgetId ?? "missing"}:${widget?.title ?? "untitled"}:${instanceId}`;
}

function logLaunchTrace(message: string) {
  if (!LAUNCH_PLAN_DEBUG_LOGS_ENABLED || !import.meta.env.DEV) {
    return;
  }

  console.log(message);
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
  const variableEffectiveSignatureCacheRef = useRef(new Map<string, string>());
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
  const executionStatesRef = useRef<Record<string, WidgetExecutionState>>({});
  const executionCompletionTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
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
      for (const timer of executionCompletionTimersRef.current.values()) {
        clearTimeout(timer);
      }
      executionCompletionTimersRef.current.clear();
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
    variableEffectiveSignatureCacheRef.current.clear();
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

  function commitExecutionStates(nextStates: Record<string, WidgetExecutionState>) {
    executionStatesRef.current = nextStates;
    setExecutionStates(nextStates);
  }

  function clearPendingExecutionCompletion(instanceId: string) {
    const pendingTimer = executionCompletionTimersRef.current.get(instanceId);
    if (!pendingTimer) {
      return;
    }

    clearTimeout(pendingTimer);
    executionCompletionTimersRef.current.delete(instanceId);
  }

  function setExecutionState(instanceId: string, nextState: WidgetExecutionState) {
    clearPendingExecutionCompletion(instanceId);
    commitExecutionStates({
      ...executionStatesRef.current,
      [instanceId]: nextState,
    });
  }

  function isSameExecutionState(
    left: WidgetExecutionState | undefined,
    right: WidgetExecutionState,
  ) {
    return (
      left?.status === right.status &&
      left.reason === right.reason &&
      left.targetInstanceId === right.targetInstanceId &&
      left.error === right.error &&
      left.blockedByWidgetId === right.blockedByWidgetId &&
      left.blockedByOutputId === right.blockedByOutputId
    );
  }

  function markFiniteExecutionPlanWaiting(input: {
    reason: ExecuteWidgetGraphOptions["reason"];
    sourceBoundaryInstanceId?: string;
    targetInstanceIds: string[];
    targetOverrides?: WidgetExecutionTargetOverrides;
    widgets: DashboardWidgetInstance[];
  }) {
    if (input.targetInstanceIds.length === 0) {
      return;
    }

    const snapshot = buildDashboardExecutionSnapshot({
      widgets: input.widgets,
      resolveWidgetDefinition: effectiveResolveWidgetDefinition,
      targetOverrides: input.targetOverrides,
      runtimeDataStore,
    });
    const plan = planDashboardFiniteExecution({
      reason: input.reason,
      snapshot,
      sourceBoundaryInstanceId: input.sourceBoundaryInstanceId,
      targetInstanceIds: input.targetInstanceIds,
    });

    if (plan.nodes.length === 0) {
      return;
    }

    const now = Date.now();
    const nextStates = { ...executionStatesRef.current };
    let changed = false;

    plan.nodes.forEach((node) => {
      if (!snapshot.getDefinition(node.instanceId)?.execution) {
        return;
      }

      const current = nextStates[node.instanceId];

      if (current?.status === "running") {
        return;
      }

      const targetInstanceId = node.targetInstanceIds[0] ?? node.instanceId;
      const nextState = {
        status: "waiting",
        reason: node.reason,
        targetInstanceId,
        startedAtMs: now,
        error:
          node.instanceId === targetInstanceId
            ? "Queued for execution."
            : `Waiting for ${formatLaunchTraceWidget(input.widgets, targetInstanceId)}.`,
      } satisfies WidgetExecutionState;

      if (isSameExecutionState(current, nextState)) {
        return;
      }

      clearPendingExecutionCompletion(node.instanceId);
      nextStates[node.instanceId] = nextState;
      changed = true;
    });

    if (changed) {
      commitExecutionStates(nextStates);
    }
  }

  function clearRunningExecutionState(instanceId: string, nextState: WidgetExecutionState) {
    const currentStates = executionStatesRef.current;
    const currentState = currentStates[instanceId];
    const startedAtMs = currentState?.status === "running" ? currentState.startedAtMs : undefined;
    const elapsedMs = startedAtMs ? Date.now() - startedAtMs : MIN_VISIBLE_EXECUTION_RUNNING_MS;
    const remainingMs = Math.max(0, MIN_VISIBLE_EXECUTION_RUNNING_MS - elapsedMs);

    if (currentState?.status === "running" && startedAtMs && remainingMs > 0) {
      clearPendingExecutionCompletion(instanceId);
      const timer = setTimeout(() => {
        executionCompletionTimersRef.current.delete(instanceId);
        if (!mountedRef.current) {
          return;
        }

        const latestStates = executionStatesRef.current;
        const latestState = latestStates[instanceId];

        if (latestState?.status !== "running" || latestState.startedAtMs !== startedAtMs) {
          return;
        }

        commitExecutionStates({
          ...latestStates,
          [instanceId]: nextState,
        });
      }, remainingMs);
      executionCompletionTimersRef.current.set(instanceId, timer);
      return;
    }

    clearPendingExecutionCompletion(instanceId);
    commitExecutionStates({
      ...currentStates,
      [instanceId]: nextState,
    });
  }

  function markSkippedExecutionState(
    instanceId: string,
    input: {
      reason: ExecuteWidgetGraphOptions["reason"];
      status: Extract<DashboardWidgetGraphNodeStatus, "waiting" | "error">;
      error: string;
    },
  ) {
    setExecutionState(instanceId, {
      status: "running",
      reason: input.reason,
      targetInstanceId: instanceId,
      startedAtMs: Date.now(),
    });
    clearRunningExecutionState(instanceId, {
      status: input.status,
      reason: input.reason,
      targetInstanceId: instanceId,
      finishedAtMs: Date.now(),
      error: input.error,
    });
  }

  function resolveCurrentExecutionState(instanceId?: string) {
    if (!instanceId) {
      return undefined;
    }

    const currentState = executionStates[instanceId];

    if (currentState?.status !== "waiting" && currentState?.status !== "error") {
      return currentState;
    }

    const snapshot = buildDashboardExecutionSnapshot({
      widgets: widgetsRef.current,
      resolveWidgetDefinition: effectiveResolveWidgetDefinition,
      targetInstanceId: instanceId,
      runtimeDataStore,
    });
    const instance = snapshot.getInstance(instanceId);
    const definition = snapshot.getDefinition(instanceId);

    if (!instance || !definition?.execution) {
      return currentState;
    }

    const resolvedInputs = snapshot.dependencies.resolveInputs(instanceId);
    const effectiveState = resolveReferenceBackedWidgetState({
      instanceTitle: instance.title,
      props: (instance.props ?? {}) as Record<string, unknown>,
      resolvedInputs,
    });
    const readinessContext = {
      executionSurface,
      publicWorkspaceToken,
      scopeId,
      widgetId: instance.widgetId,
      instanceId,
      reason: currentState.reason ?? "manual-recalculate",
      props: effectiveState.props,
      runtimeState: instance.runtimeState,
      publicExecution: instance.publicExecution,
      resolvedInputs,
      dashboardState,
      runtimeDataStore,
    } satisfies WidgetExecutionContext;
    const explicitReadiness = definition.execution.getExecutionReadiness?.(readinessContext);
    const readiness = explicitReadiness ?? resolveWidgetExecutionReadiness(
      definition,
      readinessContext,
    );

    if (explicitReadiness?.status === "ready") {
      return {
        status: "success",
        reason: currentState.reason,
        targetInstanceId: currentState.targetInstanceId,
        finishedAtMs: currentState.finishedAtMs,
      } satisfies WidgetExecutionState;
    }

    if (readiness.status !== "ready") {
      if (
        readiness.status !== currentState.status ||
        (readiness.reason && readiness.reason !== currentState.error)
      ) {
        return {
          ...currentState,
          status: readiness.status,
          error: readiness.reason ?? currentState.error,
        } satisfies WidgetExecutionState;
      }
    }

    return currentState;
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
        excludeRefreshNotApplicable: options.reason === "dashboard-refresh",
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
      if (shouldLogVariableCommitDebug(options.refreshCycleId)) {
        console.log("[widget-variable-commit:target-gate]", {
          targetInstanceId,
          reason: options.reason,
          result: "skip",
          skipReason: !instance ? "missing-instance" : "missing-execution-definition",
          hasTargetOverrides: Boolean(options.targetOverrides),
          sourceBoundaryInstanceId: options.sourceBoundaryInstanceId,
        });
      }

      return false;
    }

    const resolvedInputs = snapshot.dependencies.resolveInputs(targetInstanceId);
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

    const readiness = resolveWidgetExecutionReadiness(definition, context);
    const executable = readiness.status === "ready";
    const effectiveProps = effectiveState.props as Record<string, unknown>;
    const effectiveQuery = effectiveProps.query;

    if (readiness.status !== "ready") {
      markSkippedExecutionState(targetInstanceId, {
        reason: options.reason,
        status: readiness.status,
        error: readiness.reason ?? "Required inputs are not available.",
      });
    }

    if (shouldLogConnectionQueryExecutionDebug(instance.widgetId)) {
      console.log("[auto-execution-gate]", {
        targetInstanceId,
        widgetId: instance.widgetId,
        widgetTitle: instance.title,
        reason: options.reason,
        refreshCycleId: options.refreshCycleId,
        result: executable ? "run" : "skip",
        skipReason: executable ? undefined : readiness.status,
        hasConnectionRef: Boolean(effectiveProps.connectionRef),
        hasConnectionId:
          typeof (effectiveProps.connectionRef as { id?: unknown } | undefined)?.id === "number",
        hasQueryModel: typeof effectiveProps.queryModelId === "string" &&
          effectiveProps.queryModelId.trim().length > 0,
        queryKeys: effectiveQuery && typeof effectiveQuery === "object" && !Array.isArray(effectiveQuery)
          ? Object.keys(effectiveQuery).sort()
          : [],
        hasTargetOverrides: Boolean(options.targetOverrides),
        sourceBoundaryInstanceId: options.sourceBoundaryInstanceId,
      });
    }

    if (shouldLogVariableCommitDebug(options.refreshCycleId)) {
      console.log("[widget-variable-commit:target-gate]", {
        targetInstanceId,
        widgetId: instance.widgetId,
        widgetTitle: instance.title,
        reason: options.reason,
        result: executable ? "run" : "skip",
        skipReason: executable ? undefined : readiness.status,
        hasTargetOverrides: Boolean(options.targetOverrides),
        sourceBoundaryInstanceId: options.sourceBoundaryInstanceId,
        resolvedReferenceInputs: summarizeResolvedReferenceInputsForDebug(resolvedInputs),
        effectiveTitle: effectiveState.title,
        effectiveQuery: summarizeDebugValue(effectiveQuery),
        effectiveVariables: summarizeDebugValue(
          effectiveProps.variables,
        ),
      });
    }

    if (
      !executable &&
      shouldLogVariableCommitDebug(options.refreshCycleId) &&
      instance.widgetId === CORE_CONNECTION_QUERY_WIDGET_ID
    ) {
      console.log("[widget-exec:auto-skip]", {
        targetInstanceId,
        widgetId: instance.widgetId,
        reason: options.reason,
        hasTargetOverrides: Boolean(options.targetOverrides),
        query: effectiveQuery,
        variables: effectiveProps.variables,
      });
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
    const targetTrace = formatLaunchTraceWidget(widgetsRef.current, targetInstanceId);

    if (inFlight) {
      logLaunchTrace(
        `[launch-run-dedupe] target=${targetTrace} reason=${options.reason} refreshCycleId=${options.refreshCycleId ?? ""}`,
      );
      return inFlight;
    }

    const executionDashboardState = dashboardState;
    const executionDashboardStateKey = serializeDashboardExecutionState(executionDashboardState);
    const isExecutionCurrent = () =>
      mountedRef.current &&
      !options.signal?.aborted &&
      dashboardStateKeyRef.current === executionDashboardStateKey;

    logLaunchTrace(
      `[launch-run-start] target=${targetTrace} reason=${options.reason} refreshCycleId=${options.refreshCycleId ?? ""} sourceBoundary=${options.sourceBoundaryInstanceId ?? ""}`,
    );

    markFiniteExecutionPlanWaiting({
      reason: options.reason,
      sourceBoundaryInstanceId: options.sourceBoundaryInstanceId,
      targetInstanceIds: [targetInstanceId],
      targetOverrides: options.targetOverrides,
      widgets: widgetsRef.current,
    });

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
        logLaunchTrace(
          `[launch-node-start] target=${formatLaunchTraceWidget(widgetsRef.current, activeTargetInstanceId)} node=${formatLaunchTraceWidget(widgetsRef.current, instanceId)} reason=${reason} refreshCycleId=${options.refreshCycleId ?? ""}`,
        );

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
        blockedByWidgetId,
        blockedByOutputId,
      }) => {
        logLaunchTrace(
          `[launch-node-complete] target=${formatLaunchTraceWidget(widgetsRef.current, activeTargetInstanceId)} node=${formatLaunchTraceWidget(widgetsRef.current, instanceId)} reason=${reason} status=${status} error=${error ?? ""} refreshCycleId=${options.refreshCycleId ?? ""}`,
        );

        if (!isExecutionCurrent()) {
          return;
        }

        clearRunningExecutionState(instanceId, {
          status:
            status === "error"
              ? "error"
              : status === "upstream-error"
                ? "upstream-error"
              : status === "waiting"
                ? "waiting"
                : "success",
          reason,
          targetInstanceId: activeTargetInstanceId,
          finishedAtMs: Date.now(),
          error,
          blockedByWidgetId,
          blockedByOutputId,
        });
      },
    }).then((result) => {
      logLaunchTrace(
        `[launch-run-result] target=${targetTrace} reason=${options.reason} status=${result.status} error=${result.error ?? ""} nodes=${result.nodeResults.map((node) => `${node.instanceId}:${node.status}${node.error ? `:${node.error}` : ""}`).join(",")} refreshCycleId=${options.refreshCycleId ?? ""}`,
      );

      if (isExecutionCurrent()) {
        widgetsRef.current = result.widgets;
      } else {
        logLaunchTrace(
          `[launch-run-stale] target=${targetTrace} reason=${options.reason} refreshCycleId=${options.refreshCycleId ?? ""}`,
        );
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
            : sourceResult.status === "waiting"
              ? "waiting"
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
            } else if (downstreamResult.status === "waiting" && flowStatus !== "error") {
              flowStatus = "waiting";
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
    const afterSnapshot = buildDashboardExecutionSnapshot({
      widgets: input.afterWidgets,
      resolveWidgetDefinition: effectiveResolveWidgetDefinition,
      runtimeDataStore,
    });
    const plan =
      input.changeOrigin === "runtime"
        ? planDashboardRuntimeVariableDrivenCommit({
            changedWidgetId: input.changedWidgetId,
            afterSnapshot,
            resolvePreviousVariableEntrySignature: (entryId) =>
              variableEffectiveSignatureCacheRef.current.get(entryId),
            shouldIncludeChangedVariableEntry: (entry) => {
              variableEffectiveSignatureCacheRef.current.set(
                entry.entryId,
                entry.afterValueSignature,
              );

              return true;
            },
            resolveManagedConnectionConsumerAdapter: getManagedConnectionConsumerAdapter,
          })
        : planDashboardVariableDrivenCommit({
            changedWidgetId: input.changedWidgetId,
            beforeSnapshot: buildDashboardExecutionSnapshot({
              widgets: input.beforeWidgets,
              resolveWidgetDefinition: effectiveResolveWidgetDefinition,
              runtimeDataStore,
            }),
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

    const refreshCycleId = `variable-commit:${scopeId}:${input.changedWidgetId}:${Date.now().toString(36)}`;
    const planTargetWidgetIds = [
      ...new Set([
        ...plan.affectedConsumerWidgetIds,
        ...plan.executableTargetWidgetIds,
      ]),
    ];

    if (shouldLogVariableCommitDebug(refreshCycleId)) {
      console.log("[widget-variable-commit:plan]", {
        changedWidgetId: input.changedWidgetId,
        changeOrigin: input.changeOrigin,
        changedVariableEntries: plan.changedVariableEntries,
        affectedConsumerWidgetIds: plan.affectedConsumerWidgetIds,
        passiveConsumerWidgetIds: plan.passiveConsumerWidgetIds,
        executableConsumerWidgetIds: plan.executableConsumerWidgetIds,
        managedExecutableSourceWidgetIds: plan.managedExecutableSourceWidgetIds,
        executableTargetWidgetIds: plan.executableTargetWidgetIds,
        executableTargetOverrideIds: Object.keys(plan.executableTargetOverridesByWidgetId),
        targets: planTargetWidgetIds.map((targetWidgetId) => {
          const instance = afterSnapshot.getInstance(targetWidgetId);
          const definition = afterSnapshot.getDefinition(targetWidgetId);
          const resolvedInputs = afterSnapshot.dependencies.resolveInputs(targetWidgetId);

          return {
            targetWidgetId,
            widgetId: instance?.widgetId,
            title: instance?.title,
            hasExecution: Boolean(definition?.execution),
            resolvedReferenceInputs: summarizeResolvedReferenceInputsForDebug(resolvedInputs),
            unresolvedReferenceInputs: listUnresolvedReferenceBackedPropInputs(resolvedInputs)
              .map((entry) => ({
                inputId: entry.inputId,
                propPath: entry.propPath,
                reason: entry.reason,
                status: entry.status,
                value: summarizeDebugValue(entry.value),
              })),
          };
        }),
      });
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
    let executionWaiting: string | undefined;
    const sourceBoundaryInstanceId =
      input.changeOrigin === "runtime" ? input.changedWidgetId : undefined;

    logRefreshLaunchPlan({
      phase: "variable-commit",
      refreshCycleId,
      refreshTargets: plan.executableTargetWidgetIds,
      widgets: workingWidgets,
      resolveWidgetDefinition: effectiveResolveWidgetDefinition,
      runtimeDataStore,
    });

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
        } else if (result.status === "waiting" && !executionWaiting) {
          executionWaiting = result.error;
        }
      }

      completeDashboardRequestTraceCycle({
        scopeId,
        refreshCycleId,
        status: executionError ? "error" : "success",
      });

      return {
        status: executionError ? "error" : executionWaiting ? "waiting" : "success",
        error: executionError ?? executionWaiting,
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

    if (CONNECTION_QUERY_EXECUTION_DEBUG_LOGS_ENABLED && import.meta.env.DEV) {
      refreshTargets.forEach((targetInstanceId) => {
        console.log("[hydration-target]", {
          phase: "initial",
          refreshCycleId: initialRefreshCycleId,
          ...summarizeRefreshTargetForDebug(
            targetInstanceId,
            widgetsRef.current,
            effectiveResolveWidgetDefinition,
            runtimeDataStore,
          ),
        });
      });
    }
    logRefreshLaunchPlan({
      phase: "initial",
      refreshCycleId: initialRefreshCycleId,
      refreshTargets,
      widgets: widgetsRef.current,
      resolveWidgetDefinition: effectiveResolveWidgetDefinition,
      runtimeDataStore,
    });

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

    if (CONNECTION_QUERY_EXECUTION_DEBUG_LOGS_ENABLED && import.meta.env.DEV) {
      refreshTargets.forEach((targetInstanceId) => {
        console.log("[hydration-target]", {
          phase: "manual-refresh",
          refreshCycleId,
          ...summarizeRefreshTargetForDebug(
            targetInstanceId,
            widgetsRef.current,
            effectiveResolveWidgetDefinition,
            runtimeDataStore,
          ),
        });
      });
    }
    logRefreshLaunchPlan({
      phase: "manual-refresh",
      refreshCycleId,
      refreshTargets,
      widgets: widgetsRef.current,
      resolveWidgetDefinition: effectiveResolveWidgetDefinition,
      runtimeDataStore,
    });

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

    logRefreshLaunchPlan({
      phase: "surface-return",
      refreshCycleId: cycleId,
      refreshTargets,
      widgets: widgetsRef.current,
      resolveWidgetDefinition: effectiveResolveWidgetDefinition,
      runtimeDataStore,
    });

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
      getExecutionState: (instanceId) => resolveCurrentExecutionState(instanceId),
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
