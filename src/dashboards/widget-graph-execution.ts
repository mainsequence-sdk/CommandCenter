import type { DashboardWidgetInstance } from "@/dashboards/types";
import {
  collectDashboardWidgetEntries,
  createDashboardWidgetDependencyModel,
  createDashboardWidgetEntryIndex,
  type DashboardWidgetDependencyModel,
} from "@/dashboards/widget-dependencies";
import type {
  ResolvedWidgetInput,
  ResolvedWidgetInputs,
  WidgetDefinition,
  WidgetExecutionContext,
  WidgetExecutionReason,
  WidgetExecutionResult,
  WidgetExecutionTargetOverrides,
} from "@/widgets/types";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function flattenResolvedInputs(
  resolvedInputs: ResolvedWidgetInputs | undefined,
): ResolvedWidgetInput[] {
  if (!resolvedInputs) {
    return [];
  }

  return Object.values(resolvedInputs).flatMap((entry) => {
    if (!entry) {
      return [];
    }

    return Array.isArray(entry) ? entry : [entry];
  });
}

function mergeRuntimeStatePatch(
  runtimeState: Record<string, unknown> | undefined,
  patch: Record<string, unknown> | undefined,
) {
  const base = isPlainRecord(runtimeState) ? runtimeState : {};

  if (!isPlainRecord(patch)) {
    return Object.keys(base).length > 0 ? cloneJson(base) : undefined;
  }

  const nextState = {
    ...base,
    ...patch,
  };

  for (const [key, value] of Object.entries(nextState)) {
    if (value === undefined) {
      delete nextState[key];
    }
  }

  return Object.keys(nextState).length > 0 ? cloneJson(nextState) : undefined;
}

function updateWidgetRuntimeStateInTree(
  widgets: DashboardWidgetInstance[],
  instanceId: string,
  runtimeState: Record<string, unknown> | undefined,
): DashboardWidgetInstance[] {
  return widgets.map((widget) => {
    const nextChildren = widget.row?.children?.length
      ? updateWidgetRuntimeStateInTree(widget.row.children, instanceId, runtimeState)
      : widget.row?.children;

    if (widget.id !== instanceId) {
      return nextChildren === widget.row?.children
        ? widget
        : {
            ...widget,
            row: {
              ...widget.row,
              children: nextChildren,
            },
          };
    }

    return {
      ...widget,
      runtimeState,
      row:
        nextChildren === widget.row?.children
          ? widget.row
          : {
              ...widget.row,
              children: nextChildren,
            },
    };
  });
}

function applyTargetOverridesToTree(
  widgets: DashboardWidgetInstance[],
  targetInstanceId: string,
  targetOverrides: WidgetExecutionTargetOverrides | undefined,
): DashboardWidgetInstance[] {
  if (!targetOverrides) {
    return widgets;
  }

  return widgets.map((widget) => {
    const nextChildren = widget.row?.children?.length
      ? applyTargetOverridesToTree(widget.row.children, targetInstanceId, targetOverrides)
      : widget.row?.children;

    if (widget.id !== targetInstanceId) {
      return nextChildren === widget.row?.children
        ? widget
        : {
            ...widget,
            row: {
              ...widget.row,
              children: nextChildren,
            },
          };
    }

    return {
      ...widget,
      props:
        "props" in targetOverrides
          ? cloneJson(targetOverrides.props ?? {})
          : widget.props,
      runtimeState:
        "runtimeState" in targetOverrides
          ? cloneJson(targetOverrides.runtimeState ?? {})
          : widget.runtimeState,
      row:
        nextChildren === widget.row?.children
          ? widget.row
          : {
              ...widget.row,
              children: nextChildren,
            },
    };
  });
}

function resolveNodeExecutionReason(
  graphReason: WidgetExecutionReason,
  isTarget: boolean,
): WidgetExecutionReason {
  if (graphReason === "dashboard-refresh") {
    return "dashboard-refresh";
  }

  return isTarget ? graphReason : "manual-recalculate";
}

function buildExecutionCycleError(cycle: string[]) {
  const repeatedNode = cycle[0];
  const nextCycle = [...cycle, repeatedNode];

  return `Widget execution cycle detected: ${nextCycle.join(" -> ")}.`;
}

export interface DashboardExecutionSnapshot {
  widgets: DashboardWidgetInstance[];
  dependencies: DashboardWidgetDependencyModel;
  getInstance: (instanceId: string) => DashboardWidgetInstance | undefined;
  getDefinition: (instanceId: string) => WidgetDefinition | undefined;
}

export function buildDashboardExecutionSnapshot(args: {
  widgets: DashboardWidgetInstance[];
  resolveWidgetDefinition: (widgetId: string) => WidgetDefinition | undefined;
  targetInstanceId?: string;
  targetOverrides?: WidgetExecutionTargetOverrides;
}): DashboardExecutionSnapshot {
  const effectiveWidgets =
    args.targetInstanceId && args.targetOverrides
      ? applyTargetOverridesToTree(
          args.widgets,
          args.targetInstanceId,
          args.targetOverrides,
        )
      : args.widgets;
  const entries = collectDashboardWidgetEntries(effectiveWidgets);
  const instanceIndex = createDashboardWidgetEntryIndex(entries);
  const dependencies = createDashboardWidgetDependencyModel(
    effectiveWidgets,
    args.resolveWidgetDefinition,
  );

  return {
    widgets: effectiveWidgets,
    dependencies,
    getInstance: (instanceId) => instanceIndex.get(instanceId),
    getDefinition: (instanceId) => {
      const instance = instanceIndex.get(instanceId);
      return instance ? args.resolveWidgetDefinition(instance.widgetId) : undefined;
    },
  };
}

function listValidExecutableDependencyIds(
  instanceId: string,
  snapshot: DashboardExecutionSnapshot,
) {
  const resolvedInputs = snapshot.dependencies.resolveInputs(instanceId);
  const nextDependencyIds = new Set<string>();

  for (const input of flattenResolvedInputs(resolvedInputs)) {
    if (input.status !== "valid" || !input.sourceWidgetId) {
      continue;
    }

    const sourceDefinition = snapshot.getDefinition(input.sourceWidgetId);

    if (!sourceDefinition?.execution) {
      continue;
    }

    nextDependencyIds.add(input.sourceWidgetId);
  }

  return [...nextDependencyIds];
}

function collectTransitiveExecutableDependencyIds(
  instanceId: string,
  snapshot: DashboardExecutionSnapshot,
  seen = new Set<string>(),
) {
  for (const dependencyId of listValidExecutableDependencyIds(instanceId, snapshot)) {
    if (seen.has(dependencyId)) {
      continue;
    }

    seen.add(dependencyId);
    collectTransitiveExecutableDependencyIds(dependencyId, snapshot, seen);
  }

  return seen;
}

function collectExecutionOrder(
  targetInstanceId: string,
  snapshot: DashboardExecutionSnapshot,
) {
  const visited = new Set<string>();
  const activePath: string[] = [];
  const order: string[] = [];

  function visit(instanceId: string) {
    if (activePath.includes(instanceId)) {
      throw new Error(
        buildExecutionCycleError(activePath.slice(activePath.indexOf(instanceId))),
      );
    }

    if (visited.has(instanceId)) {
      return;
    }

    activePath.push(instanceId);

    for (const dependencyId of listValidExecutableDependencyIds(instanceId, snapshot)) {
      visit(dependencyId);
    }

    activePath.pop();
    visited.add(instanceId);

    const definition = snapshot.getDefinition(instanceId);

    if (definition?.execution) {
      order.push(instanceId);
    }
  }

  visit(targetInstanceId);

  return order;
}

export interface ExecutedWidgetNodeResult {
  instanceId: string;
  reason: WidgetExecutionReason;
  status: WidgetExecutionResult["status"];
  error?: string;
  runtimeState?: Record<string, unknown>;
}

export interface DashboardWidgetGraphExecutionResult {
  status: "success" | "error" | "skipped";
  error?: string;
  widgets: DashboardWidgetInstance[];
  targetInstanceId: string;
  targetRuntimeState?: Record<string, unknown>;
  nodeResults: ExecutedWidgetNodeResult[];
  executedInstanceIds: Set<string>;
}

export interface ExecuteDashboardWidgetGraphArgs {
  widgets: DashboardWidgetInstance[];
  resolveWidgetDefinition: (widgetId: string) => WidgetDefinition | undefined;
  targetInstanceId: string;
  reason: WidgetExecutionReason;
  refreshCycleId?: string;
  targetOverrides?: WidgetExecutionTargetOverrides;
  signal?: AbortSignal;
  executedInstanceIds?: Set<string>;
  onRuntimeStateWrite?: (
    instanceId: string,
    runtimeState: Record<string, unknown> | undefined,
  ) => void;
  onNodeStart?: (node: {
    instanceId: string;
    reason: WidgetExecutionReason;
    targetInstanceId: string;
  }) => void;
  onNodeComplete?: (node: {
    instanceId: string;
    reason: WidgetExecutionReason;
    targetInstanceId: string;
    status: WidgetExecutionResult["status"];
    error?: string;
  }) => void;
}

export async function executeDashboardWidgetGraph(
  args: ExecuteDashboardWidgetGraphArgs,
): Promise<DashboardWidgetGraphExecutionResult> {
  let workingWidgets = args.widgets;
  const executedInstanceIds = args.executedInstanceIds ?? new Set<string>();
  const nodeResults: ExecutedWidgetNodeResult[] = [];
  let targetRuntimeState: Record<string, unknown> | undefined;

  let snapshot = buildDashboardExecutionSnapshot({
    widgets: workingWidgets,
    resolveWidgetDefinition: args.resolveWidgetDefinition,
    targetInstanceId: args.targetInstanceId,
    targetOverrides: args.targetOverrides,
  });
  const targetInstance = snapshot.getInstance(args.targetInstanceId);
  const targetDefinition = snapshot.getDefinition(args.targetInstanceId);

  if (!targetInstance || !targetDefinition?.execution) {
    return {
      status: "error",
      error: "The selected widget does not support graph execution.",
      widgets: workingWidgets,
      targetInstanceId: args.targetInstanceId,
      nodeResults,
      executedInstanceIds,
    };
  }

  let executionOrder: string[];

  try {
    executionOrder = collectExecutionOrder(args.targetInstanceId, snapshot);
  } catch (error) {
    return {
      status: "error",
      error:
        error instanceof Error
          ? error.message
          : "Widget execution graph resolution failed.",
      widgets: workingWidgets,
      targetInstanceId: args.targetInstanceId,
      nodeResults,
      executedInstanceIds,
    };
  }

  for (const instanceId of executionOrder) {
    if (executedInstanceIds.has(instanceId)) {
      nodeResults.push({
        instanceId,
        reason: resolveNodeExecutionReason(args.reason, instanceId === args.targetInstanceId),
        status: "skipped",
      });
      continue;
    }

    snapshot = buildDashboardExecutionSnapshot({
      widgets: workingWidgets,
      resolveWidgetDefinition: args.resolveWidgetDefinition,
      targetInstanceId: args.targetInstanceId,
      targetOverrides: args.targetOverrides,
    });

    const instance = snapshot.getInstance(instanceId);
    const definition = snapshot.getDefinition(instanceId);

    if (!instance || !definition?.execution) {
      return {
        status: "error",
        error: `The executable widget instance ${instanceId} is no longer available.`,
        widgets: workingWidgets,
        targetInstanceId: args.targetInstanceId,
        targetRuntimeState,
        nodeResults,
        executedInstanceIds,
      };
    }

    const nodeReason = resolveNodeExecutionReason(
      args.reason,
      instanceId === args.targetInstanceId,
    );
    const executionContext = {
      widgetId: instance.widgetId,
      instanceId,
      reason: nodeReason,
      props: (instance.props ?? {}) as Record<string, unknown>,
      runtimeState: instance.runtimeState,
      resolvedInputs: snapshot.dependencies.resolveInputs(instanceId),
      targetOverrides:
        instanceId === args.targetInstanceId ? args.targetOverrides : undefined,
      refreshCycleId: args.refreshCycleId,
      signal: args.signal,
    } satisfies WidgetExecutionContext;

    if (nodeReason === "dashboard-refresh") {
      const refreshPolicy =
        definition.execution.getRefreshPolicy?.(executionContext) ?? "manual-only";

      if (refreshPolicy !== "allow-refresh") {
        const error = `Widget ${instanceId} is not eligible for dashboard refresh execution.`;

        nodeResults.push({
          instanceId,
          reason: nodeReason,
          status: "error",
          error,
        });

        return {
          status: "error",
          error,
          widgets: workingWidgets,
          targetInstanceId: args.targetInstanceId,
          targetRuntimeState,
          nodeResults,
          executedInstanceIds,
        };
      }
    }

    if (definition.execution.canExecute?.(executionContext) === false) {
      const error = `Widget ${instanceId} is not currently executable.`;

      nodeResults.push({
        instanceId,
        reason: nodeReason,
        status: "error",
        error,
      });

      return {
        status: "error",
        error,
        widgets: workingWidgets,
        targetInstanceId: args.targetInstanceId,
        targetRuntimeState,
        nodeResults,
        executedInstanceIds,
      };
    }

    args.onNodeStart?.({
      instanceId,
      reason: nodeReason,
      targetInstanceId: args.targetInstanceId,
    });

    let result: WidgetExecutionResult;

    try {
      result = await definition.execution.execute(executionContext);
    } catch (error) {
      result = {
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Widget execution failed before a result was returned.",
      };
    }

    const nextRuntimeState = mergeRuntimeStatePatch(
      instance.runtimeState,
      result.runtimeStatePatch,
    );
    const shouldPersistRuntimeState =
      !(instanceId === args.targetInstanceId && args.targetOverrides);

    if (instanceId === args.targetInstanceId) {
      targetRuntimeState = nextRuntimeState;
    }

    if (shouldPersistRuntimeState) {
      workingWidgets = updateWidgetRuntimeStateInTree(
        workingWidgets,
        instanceId,
        nextRuntimeState,
      );
      args.onRuntimeStateWrite?.(instanceId, nextRuntimeState);
    }

    executedInstanceIds.add(instanceId);
    nodeResults.push({
      instanceId,
      reason: nodeReason,
      status: result.status,
      error: result.error,
      runtimeState: nextRuntimeState,
    });
    args.onNodeComplete?.({
      instanceId,
      reason: nodeReason,
      targetInstanceId: args.targetInstanceId,
      status: result.status,
      error: result.error,
    });

    if (result.status === "error") {
      return {
        status: "error",
        error: result.error,
        widgets: workingWidgets,
        targetInstanceId: args.targetInstanceId,
        targetRuntimeState,
        nodeResults,
        executedInstanceIds,
      };
    }
  }

  return {
    status: nodeResults.some((entry) => entry.status === "success") ? "success" : "skipped",
    widgets: workingWidgets,
    targetInstanceId: args.targetInstanceId,
    targetRuntimeState,
    nodeResults,
    executedInstanceIds,
  };
}

export function listDashboardRefreshableExecutionTargets(args: {
  widgets: DashboardWidgetInstance[];
  resolveWidgetDefinition: (widgetId: string) => WidgetDefinition | undefined;
  refreshCycleId: string;
}) {
  const snapshot = buildDashboardExecutionSnapshot({
    widgets: args.widgets,
    resolveWidgetDefinition: args.resolveWidgetDefinition,
  });
  const candidates = snapshot.dependencies.entries.flatMap(({ instance }) => {
    const definition = snapshot.getDefinition(instance.id);

    if (!definition?.execution) {
      return [];
    }

    const context = {
      widgetId: instance.widgetId,
      instanceId: instance.id,
      reason: "dashboard-refresh" as const,
      props: (instance.props ?? {}) as Record<string, unknown>,
      runtimeState: instance.runtimeState,
      resolvedInputs: snapshot.dependencies.resolveInputs(instance.id),
      refreshCycleId: args.refreshCycleId,
    } satisfies WidgetExecutionContext;
    const refreshPolicy =
      definition.execution.getRefreshPolicy?.(context) ?? "manual-only";

    if (
      refreshPolicy !== "allow-refresh" ||
      definition.execution.canExecute?.(context) === false
    ) {
      return [];
    }

    return [instance.id];
  });
  const candidateSet = new Set(candidates);
  const transitiveUpstreamIds = new Set<string>();

  for (const candidateId of candidates) {
    const upstreamIds = collectTransitiveExecutableDependencyIds(candidateId, snapshot);

    for (const upstreamId of upstreamIds) {
      if (candidateSet.has(upstreamId)) {
        transitiveUpstreamIds.add(upstreamId);
      }
    }
  }

  return candidates.filter((candidateId) => !transitiveUpstreamIds.has(candidateId));
}
