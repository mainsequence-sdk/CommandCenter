import type { DashboardWidgetInstance } from "@/dashboards/types";
import { buildWidgetBindingTransformSignature } from "@/dashboards/widget-binding-transforms";
import {
  collectDashboardWidgetEntries,
  createDashboardWidgetDependencyModel,
  createDashboardWidgetEntryIndex,
  normalizeWidgetInstanceBindings,
  type DashboardWidgetDependencyModel,
} from "@/dashboards/widget-dependencies";
import type {
  ResolvedWidgetInput,
  ResolvedWidgetInputs,
  WidgetPortBinding,
  WidgetPortBindingValue,
  WidgetDefinition,
  WidgetExecutionDashboardState,
  WidgetExecutionContext,
  WidgetExecutionReason,
  WidgetExecutionResult,
  WidgetExecutionTargetOverrides,
} from "@/widgets/types";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function summarizeExecutionValueForDebug(value: unknown) {
  if (!isPlainRecord(value)) {
    return value === undefined ? { kind: "undefined" } : { kind: typeof value };
  }

  if (typeof value.contract === "string" && Array.isArray(value.fields)) {
    return {
      kind: "frame",
      status: typeof value.status === "string" ? value.status : undefined,
      contract: value.contract,
      fieldCount: value.fields.length,
      fieldNames: value.fields
        .flatMap((field) =>
          isPlainRecord(field) && typeof field.name === "string" ? [field.name] : [],
        )
        .slice(0, 6),
      traceId: typeof value.traceId === "string" ? value.traceId : undefined,
    };
  }

  if (Array.isArray(value.columns) && Array.isArray(value.rows)) {
    return {
      kind: "tabular-frame",
      status: typeof value.status === "string" ? value.status : undefined,
      columnCount: value.columns.length,
      rowCount: value.rows.length,
      fieldCount: Array.isArray(value.fields) ? value.fields.length : 0,
    };
  }

  return {
    kind: "record",
    status: typeof value.status === "string" ? value.status : undefined,
    keys: Object.keys(value).slice(0, 10),
  };
}

function summarizeExecutionContextForDebug(context: WidgetExecutionContext) {
  return {
    scopeId: context.scopeId,
    widgetId: context.widgetId,
    instanceId: context.instanceId,
    reason: context.reason,
    refreshCycleId: context.refreshCycleId,
    dashboardState: context.dashboardState,
    hasTargetOverrides: Boolean(context.targetOverrides),
    propsKeys: isPlainRecord(context.props) ? Object.keys(context.props).sort() : [],
    runtimeState: summarizeExecutionValueForDebug(context.runtimeState),
    resolvedInputIds: context.resolvedInputs ? Object.keys(context.resolvedInputs).sort() : [],
  };
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

function toBindingArray(value: WidgetPortBindingValue | undefined): WidgetPortBinding[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function listValidResolvedInputs(
  instanceId: string,
  snapshot: DashboardExecutionSnapshot,
) {
  return flattenResolvedInputs(snapshot.dependencies.resolveInputs(instanceId)).filter(
    (input): input is ResolvedWidgetInput & { sourceWidgetId: string } =>
      input.status === "valid" &&
      typeof input.sourceWidgetId === "string" &&
      input.sourceWidgetId.length > 0,
  );
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
      bindings:
        "bindings" in targetOverrides
          ? normalizeWidgetInstanceBindings(targetOverrides.bindings)
          : widget.bindings,
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

function listValidDependencyIds(
  instanceId: string,
  snapshot: DashboardExecutionSnapshot,
) {
  const nextDependencyIds = new Set<string>();

  for (const input of listValidResolvedInputs(instanceId, snapshot)) {
    nextDependencyIds.add(input.sourceWidgetId);
  }

  return [...nextDependencyIds];
}

function collectTransitiveExecutableDependencyIds(
  instanceId: string,
  snapshot: DashboardExecutionSnapshot,
  executableIds = new Set<string>(),
  visited = new Set<string>(),
) {
  if (visited.has(instanceId)) {
    return executableIds;
  }

  visited.add(instanceId);

  for (const dependencyId of listValidDependencyIds(instanceId, snapshot)) {
    const sourceDefinition = snapshot.getDefinition(dependencyId);

    if (sourceDefinition?.execution) {
      executableIds.add(dependencyId);
    }

    collectTransitiveExecutableDependencyIds(
      dependencyId,
      snapshot,
      executableIds,
      visited,
    );
  }

  return executableIds;
}

function collectUpstreamResolutionSignatures(
  instanceId: string,
  snapshot: DashboardExecutionSnapshot,
  signatures = new Set<string>(),
  visited = new Set<string>(),
) {
  if (visited.has(instanceId)) {
    return signatures;
  }

  visited.add(instanceId);

  for (const input of listValidResolvedInputs(instanceId, snapshot)) {
    signatures.add(
      [
        instanceId,
        input.inputId,
        input.sourceWidgetId,
        input.sourceOutputId ?? "",
        buildWidgetBindingTransformSignature(input.binding),
      ].join(":"),
    );

    collectUpstreamResolutionSignatures(
      input.sourceWidgetId,
      snapshot,
      signatures,
      visited,
    );
  }

  return signatures;
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

    for (const dependencyId of listValidDependencyIds(instanceId, snapshot)) {
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

export function listDashboardWidgetExecutionOrder(
  targetInstanceId: string,
  snapshot: DashboardExecutionSnapshot,
) {
  return collectExecutionOrder(targetInstanceId, snapshot);
}

function buildCanonicalDownstreamBindingIndex(
  snapshot: DashboardExecutionSnapshot,
) {
  const downstreamIndex = new Map<string, Set<string>>();

  for (const { instance } of snapshot.dependencies.entries) {
    const bindings = normalizeWidgetInstanceBindings(instance.bindings);

    if (!bindings) {
      continue;
    }

    for (const bindingValue of Object.values(bindings)) {
      for (const binding of toBindingArray(bindingValue)) {
        const sourceWidgetId = binding.sourceWidgetId.trim();

        if (!sourceWidgetId) {
          continue;
        }

        const nextTargets = downstreamIndex.get(sourceWidgetId) ?? new Set<string>();
        nextTargets.add(instance.id);
        downstreamIndex.set(sourceWidgetId, nextTargets);
      }
    }
  }

  return downstreamIndex;
}

function collectCanonicalDownstreamReachableIds(
  sourceInstanceId: string,
  downstreamIndex: ReadonlyMap<string, Set<string>>,
) {
  const reachable = new Set<string>();
  const queue = [...(downstreamIndex.get(sourceInstanceId) ?? [])];

  while (queue.length > 0) {
    const instanceId = queue.shift();

    if (!instanceId || reachable.has(instanceId)) {
      continue;
    }

    reachable.add(instanceId);

    for (const downstreamId of downstreamIndex.get(instanceId) ?? []) {
      if (!reachable.has(downstreamId)) {
        queue.push(downstreamId);
      }
    }
  }

  return reachable;
}

export function listDashboardDownstreamExecutionTargets(
  sourceInstanceId: string,
  snapshot: DashboardExecutionSnapshot,
) {
  const downstreamIndex = buildCanonicalDownstreamBindingIndex(snapshot);
  const reachableIds = collectCanonicalDownstreamReachableIds(
    sourceInstanceId,
    downstreamIndex,
  );

  if (reachableIds.size === 0) {
    return [];
  }

  const stableOrder = snapshot.dependencies.entries.map(({ instance }) => instance.id);
  const stableOrderIndex = new Map(
    stableOrder.map((instanceId, index) => [instanceId, index] as const),
  );
  const indegreeById = new Map<string, number>();

  for (const instanceId of reachableIds) {
    indegreeById.set(instanceId, 0);
  }

  for (const [fromId, nextTargets] of downstreamIndex.entries()) {
    if (fromId !== sourceInstanceId && !reachableIds.has(fromId)) {
      continue;
    }

    for (const targetId of nextTargets) {
      if (!reachableIds.has(targetId)) {
        continue;
      }

      if (fromId === sourceInstanceId) {
        continue;
      }

      indegreeById.set(targetId, (indegreeById.get(targetId) ?? 0) + 1);
    }
  }

  const queue = stableOrder.filter(
    (instanceId) =>
      reachableIds.has(instanceId) && (indegreeById.get(instanceId) ?? 0) === 0,
  );
  const orderedIds: string[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    queue.sort(
      (left, right) =>
        (stableOrderIndex.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (stableOrderIndex.get(right) ?? Number.MAX_SAFE_INTEGER),
    );
    const instanceId = queue.shift();

    if (!instanceId || visited.has(instanceId)) {
      continue;
    }

    visited.add(instanceId);
    orderedIds.push(instanceId);

    for (const downstreamId of downstreamIndex.get(instanceId) ?? []) {
      if (!reachableIds.has(downstreamId)) {
        continue;
      }

      const nextDegree = (indegreeById.get(downstreamId) ?? 0) - 1;
      indegreeById.set(downstreamId, nextDegree);

      if (nextDegree <= 0 && !visited.has(downstreamId)) {
        queue.push(downstreamId);
      }
    }
  }

  for (const instanceId of stableOrder) {
    if (reachableIds.has(instanceId) && !visited.has(instanceId)) {
      orderedIds.push(instanceId);
    }
  }

  return orderedIds.filter((instanceId) => {
    if (instanceId === sourceInstanceId) {
      return false;
    }

    return Boolean(snapshot.getDefinition(instanceId)?.execution);
  });
}

export interface DashboardUpstreamResolutionRequirement {
  executableInstanceIds: string[];
  needsResolution: boolean;
  requestKey: string;
}

export function buildDashboardUpstreamResolutionKey(
  targetInstanceId: string,
  snapshot: DashboardExecutionSnapshot,
) {
  const signatures = [...collectUpstreamResolutionSignatures(targetInstanceId, snapshot)].sort();

  if (signatures.length === 0) {
    return `${targetInstanceId}::no-upstream-bindings`;
  }

  return `${targetInstanceId}::${signatures.join("::")}`;
}

export function resolveDashboardUpstreamRequirement(
  targetInstanceId: string,
  snapshot: DashboardExecutionSnapshot,
): DashboardUpstreamResolutionRequirement {
  const executableInstanceIds = [...collectTransitiveExecutableDependencyIds(targetInstanceId, snapshot)];

  return {
    executableInstanceIds,
    needsResolution: executableInstanceIds.length > 0,
    requestKey: buildDashboardUpstreamResolutionKey(targetInstanceId, snapshot),
  };
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
  scopeId: string;
  widgets: DashboardWidgetInstance[];
  resolveWidgetDefinition: (widgetId: string) => WidgetDefinition | undefined;
  targetInstanceId: string;
  reason: WidgetExecutionReason;
  dashboardState?: WidgetExecutionDashboardState;
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

  if (!targetInstance) {
    return {
      status: "error",
      error: "The selected widget is no longer available.",
      widgets: workingWidgets,
      targetInstanceId: args.targetInstanceId,
      nodeResults,
      executedInstanceIds,
    };
  }

  let executionOrder: string[];

  try {
    executionOrder = listDashboardWidgetExecutionOrder(args.targetInstanceId, snapshot);
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

  if (executionOrder.length === 0) {
    return {
      status: "skipped",
      widgets: workingWidgets,
      targetInstanceId: args.targetInstanceId,
      targetRuntimeState,
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
      scopeId: args.scopeId,
      widgetId: instance.widgetId,
      instanceId,
      reason: nodeReason,
      props: (instance.props ?? {}) as Record<string, unknown>,
      runtimeState: instance.runtimeState,
      resolvedInputs: snapshot.dependencies.resolveInputs(instanceId),
      dashboardState: args.dashboardState,
      targetOverrides:
        instanceId === args.targetInstanceId ? args.targetOverrides : undefined,
      refreshCycleId: args.refreshCycleId,
      signal: args.signal,
    } satisfies WidgetExecutionContext;

    if (nodeReason === "dashboard-refresh" && instanceId === args.targetInstanceId) {
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

    if (import.meta.env.DEV) {
      console.debug("[widget-exec] node start", summarizeExecutionContextForDebug(executionContext));
    }

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

    if (import.meta.env.DEV) {
      console.debug("[widget-exec] node result", {
        instanceId,
        widgetId: instance.widgetId,
        targetInstanceId: args.targetInstanceId,
        reason: nodeReason,
        resultStatus: result.status,
        resultError: result.error,
        runtimeStatePatch: summarizeExecutionValueForDebug(result.runtimeStatePatch),
        nextRuntimeState: summarizeExecutionValueForDebug(nextRuntimeState),
        shouldPersistRuntimeState,
      });
    }

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
  dashboardState?: WidgetExecutionDashboardState;
  refreshCycleId: string;
}) {
  const snapshot = buildDashboardExecutionSnapshot({
    widgets: args.widgets,
    resolveWidgetDefinition: args.resolveWidgetDefinition,
  });
  const candidates = snapshot.dependencies.entries.flatMap(({ instance }) => {
    const definition = snapshot.getDefinition(instance.id);
    const upstreamExecutableIds = collectTransitiveExecutableDependencyIds(instance.id, snapshot);

    if (definition?.execution) {
      const context = {
        widgetId: instance.widgetId,
        instanceId: instance.id,
        reason: "dashboard-refresh" as const,
        props: (instance.props ?? {}) as Record<string, unknown>,
        runtimeState: instance.runtimeState,
        resolvedInputs: snapshot.dependencies.resolveInputs(instance.id),
        dashboardState: args.dashboardState,
        refreshCycleId: args.refreshCycleId,
      } satisfies WidgetExecutionContext;
      const refreshPolicy =
        definition.execution.getRefreshPolicy?.(context) ?? "manual-only";

      if (
        refreshPolicy === "allow-refresh" &&
        definition.execution.canExecute?.(context) !== false
      ) {
        return [instance.id];
      }
    }

    return upstreamExecutableIds.size > 0 ? [instance.id] : [];
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
