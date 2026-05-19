import type { DashboardWidgetInstance } from "@/dashboards/types";
import {
  applyWidgetBindingTransform,
  buildWidgetBindingTransformSignature,
} from "@/dashboards/widget-binding-transforms";
import { resolveReferenceBackedWidgetState } from "@/dashboards/widget-instance-references";
import {
  collectDashboardWidgetEntries,
  createDashboardWidgetDependencyModel,
  createDashboardWidgetEntryIndex,
  listUnresolvedReferenceBackedPropInputs,
  normalizeWidgetInstanceBindings,
  type ResolvedWidgetOutputs,
  type DashboardWidgetDependencyModel,
} from "@/dashboards/widget-dependencies";
import type { WorkspaceVariableReferenceEntry } from "@/dashboards/widget-variable-registry";
import type {
  ResolvedWidgetInput,
  ResolvedWidgetInputs,
  WidgetDefinition,
  WidgetExecutionDashboardState,
  WidgetExecutionContext,
  WidgetExecutionReason,
  WidgetExecutionResult,
  WidgetExecutionSurface,
  WidgetExecutionTargetOverrides,
} from "@/widgets/types";
import type { RuntimeDataStore } from "@/widgets/shared/runtime-data-store";
import { RUNTIME_DATA_REF_KIND } from "@/widgets/shared/runtime-data-store";
import {
  type AnyManagedConnectionConsumerAdapter,
  isManagedConnectionConsumerMode,
  normalizeManagedConnectionEmbeddedSourceProps,
  resolveManagedConnectionConsumerSourceWidgetId,
} from "@/widgets/shared/managed-connection-consumer";

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
    executionSurface: context.executionSurface,
    widgetId: context.widgetId,
    instanceId: context.instanceId,
    reason: context.reason,
    refreshCycleId: context.refreshCycleId,
    hasPublicExecution: Boolean(context.publicExecution),
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

function stableJsonStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJsonStringify(entry)).join(",")}]`;
  }

  if (isPlainRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value) ?? String(value);
}

function sanitizeResolutionSignatureValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeResolutionSignatureValue(entry));
  }

  if (!isPlainRecord(value)) {
    return value;
  }

  if (value.kind === RUNTIME_DATA_REF_KIND) {
    return {
      kind: value.kind,
      refId: typeof value.refId === "string" ? value.refId : undefined,
      workspaceRuntimeId:
        typeof value.workspaceRuntimeId === "string" ? value.workspaceRuntimeId : undefined,
      ownerId: typeof value.ownerId === "string" ? value.ownerId : undefined,
      outputId: typeof value.outputId === "string" ? value.outputId : undefined,
      contractId: typeof value.contractId === "string" ? value.contractId : undefined,
      rowCount: typeof value.rowCount === "number" ? value.rowCount : undefined,
      schemaSignature:
        typeof value.schemaSignature === "string" ? value.schemaSignature : undefined,
      columns: Array.isArray(value.columns) ? value.columns : undefined,
      fields: Array.isArray(value.fields) ? value.fields : undefined,
      status: typeof value.status === "string" ? value.status : undefined,
      error: typeof value.error === "string" ? value.error : undefined,
    };
  }

  const nextEntries = Object.entries(value)
    .filter(([key]) =>
      key !== "updatedAtMs" &&
      key !== "traceId" &&
      key !== "runtimeDataRef" &&
      key !== "outputRef" &&
      key !== "retainedOutputRef" &&
      key !== "deltaOutputRef" &&
      key !== "sourceRunId" &&
      key !== "sequence",
    )
    .map(([key, entryValue]) => [key, sanitizeResolutionSignatureValue(entryValue)] as const)
    .sort(([left], [right]) => left.localeCompare(right));

  return Object.fromEntries(nextEntries);
}

function buildResolvedOutputsResolutionSignature(
  outputs: ResolvedWidgetOutputs | undefined,
) {
  if (!outputs) {
    return "undefined";
  }

  return stableJsonStringify(
    Object.fromEntries(
      Object.entries(outputs)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([outputId, output]) => [
          outputId,
          output
            ? {
                contractId: output.contractId,
                value: sanitizeResolutionSignatureValue(output.value),
              }
            : null,
        ]),
    ),
  );
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

export type ResolveManagedConnectionConsumerAdapter = (
  widgetId: string | undefined,
) => AnyManagedConnectionConsumerAdapter | null | undefined;

interface ResolvedVariableEntryValue {
  status: "valid" | "missing-entry" | "missing-output" | "transform-invalid";
  contractId?: string;
  value?: unknown;
}

export interface DashboardVariableDrivenCommitPlanEntry {
  entryId: string;
  sourceWidgetId: string;
  sourceOutputId: string;
  transformSignature: string;
  targetWidgetIds: string[];
}

export interface DashboardVariableDrivenCommitPlan {
  changedWidgetId: string;
  changedVariableEntries: DashboardVariableDrivenCommitPlanEntry[];
  affectedConsumerWidgetIds: string[];
  passiveConsumerWidgetIds: string[];
  executableConsumerWidgetIds: string[];
  managedExecutableSourceWidgetIds: string[];
  executableTargetWidgetIds: string[];
  executableTargetOverridesByWidgetId: Record<string, WidgetExecutionTargetOverrides>;
}

function resolveVariableEntryValue(
  entry: WorkspaceVariableReferenceEntry | undefined,
  snapshot: DashboardExecutionSnapshot,
): ResolvedVariableEntryValue {
  if (!entry) {
    return {
      status: "missing-entry",
    };
  }

  const sourceOutput = snapshot.dependencies.resolveOutputs(entry.key.sourceWidgetId)?.[entry.key.sourceOutputId];

  if (!sourceOutput) {
    return {
      status: "missing-output",
    };
  }

  const representativeBinding = entry.consumers[0]?.binding;

  if (!representativeBinding) {
    return {
      status: "missing-entry",
    };
  }

  const transformed = applyWidgetBindingTransform(representativeBinding, {
    contractId: sourceOutput.contractId,
    value: sourceOutput.value,
    valueDescriptor: sourceOutput.valueDescriptor,
  });

  if (transformed.status !== "valid") {
    return {
      status: "transform-invalid",
    };
  }

  return {
    status: "valid",
    contractId: transformed.contractId,
    value: transformed.value,
  };
}

function buildVariableEntryValueSignature(value: ResolvedVariableEntryValue) {
  return stableJsonStringify({
    status: value.status,
    contractId: value.contractId,
    value: value.value,
  });
}

function resolveEffectiveSnapshotWidgetState(
  snapshot: DashboardExecutionSnapshot,
  instanceId: string,
) {
  const instance = snapshot.getInstance(instanceId);

  if (!instance) {
    return null;
  }

  return resolveReferenceBackedWidgetState({
    instanceTitle: instance.title,
    props: (instance.props ?? {}) as Record<string, unknown>,
    resolvedInputs: snapshot.dependencies.resolveInputs(instanceId),
  });
}

interface ManagedExecutableSourceProjection {
  ownerWidgetId: string;
  sourceWidgetId: string;
  targetOverrides: WidgetExecutionTargetOverrides;
  signature: string;
}

function resolveManagedExecutableSourceProjections(
  snapshot: DashboardExecutionSnapshot,
  ownerWidgetId: string,
  resolveManagedConnectionConsumerAdapter?: ResolveManagedConnectionConsumerAdapter,
): ManagedExecutableSourceProjection[] {
  const owner = snapshot.getInstance(ownerWidgetId);

  if (!owner) {
    return [];
  }

  const adapter = resolveManagedConnectionConsumerAdapter?.(owner.widgetId);

  if (!adapter) {
    return [];
  }

  const effectiveState = resolveEffectiveSnapshotWidgetState(snapshot, ownerWidgetId);
  const effectiveProps = effectiveState?.props ?? {};
  const sourceMode = adapter.getSourceMode(effectiveProps);

  if (!isManagedConnectionConsumerMode(adapter, sourceMode)) {
    return [];
  }

  const managedSourceWidgetTypeId = resolveManagedConnectionConsumerSourceWidgetId(
    adapter,
    effectiveProps,
  );
  const embeddedConnectionProps = normalizeManagedConnectionEmbeddedSourceProps(
    adapter,
    effectiveProps,
    adapter.getEmbeddedConnectionQuery(effectiveProps),
  );

  const projections = snapshot.dependencies.entries.flatMap(({ instance }) => {
    if (
      instance.managedBy?.ownerInstanceId !== ownerWidgetId ||
      instance.managedBy.role !== "embedded-connection-source" ||
      instance.widgetId !== managedSourceWidgetTypeId ||
      !snapshot.getDefinition(instance.id)?.execution
    ) {
      return [];
    }

    const targetOverrides = {
      props: embeddedConnectionProps,
    } satisfies WidgetExecutionTargetOverrides;

    return [{
      ownerWidgetId,
      sourceWidgetId: instance.id,
      targetOverrides,
      signature: stableJsonStringify({
        widgetId: instance.widgetId,
        props: embeddedConnectionProps,
        publicExecution: instance.publicExecution ?? null,
      }),
    } satisfies ManagedExecutableSourceProjection];
  });

  return projections;
}

export function buildDashboardExecutionSnapshot(args: {
  widgets: DashboardWidgetInstance[];
  resolveWidgetDefinition: (widgetId: string) => WidgetDefinition | undefined;
  targetInstanceId?: string;
  targetOverrides?: WidgetExecutionTargetOverrides;
  runtimeDataStore?: RuntimeDataStore | null;
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
    { runtimeDataStore: args.runtimeDataStore },
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

export function planDashboardVariableDrivenCommit(input: {
  changedWidgetId: string;
  beforeSnapshot: DashboardExecutionSnapshot;
  afterSnapshot: DashboardExecutionSnapshot;
  resolveManagedConnectionConsumerAdapter?: ResolveManagedConnectionConsumerAdapter;
}): DashboardVariableDrivenCommitPlan {
  const candidateSourceWidgetIds = new Set<string>([input.changedWidgetId]);
  const addDownstreamVariableSources = (snapshot: DashboardExecutionSnapshot) => {
    const downstreamIndex = buildCanonicalDownstreamBindingIndex(snapshot);

    collectCanonicalDownstreamReachableIds(
      input.changedWidgetId,
      downstreamIndex,
    ).forEach((instanceId) => {
      candidateSourceWidgetIds.add(instanceId);
    });
  };

  addDownstreamVariableSources(input.beforeSnapshot);
  addDownstreamVariableSources(input.afterSnapshot);

  const beforeEntries = [...candidateSourceWidgetIds].flatMap((sourceWidgetId) =>
    input.beforeSnapshot.dependencies.variableRegistry.bySourceWidgetId.get(sourceWidgetId) ?? [],
  );
  const afterEntries = [...candidateSourceWidgetIds].flatMap((sourceWidgetId) =>
    input.afterSnapshot.dependencies.variableRegistry.bySourceWidgetId.get(sourceWidgetId) ?? [],
  );
  const candidateEntryIds = new Set<string>([
    ...beforeEntries.map((entry) => entry.id),
    ...afterEntries.map((entry) => entry.id),
  ]);
  const changedVariableEntries: DashboardVariableDrivenCommitPlanEntry[] = [];
  const affectedConsumerWidgetIds = new Set<string>();

  [...candidateEntryIds]
    .sort((left, right) => left.localeCompare(right))
    .forEach((entryId) => {
      const beforeEntry = input.beforeSnapshot.dependencies.variableRegistry.byId.get(entryId);
      const afterEntry = input.afterSnapshot.dependencies.variableRegistry.byId.get(entryId);
      const beforeSignature = buildVariableEntryValueSignature(
        resolveVariableEntryValue(beforeEntry, input.beforeSnapshot),
      );
      const afterSignature = buildVariableEntryValueSignature(
        resolveVariableEntryValue(afterEntry, input.afterSnapshot),
      );

      if (beforeSignature === afterSignature) {
        return;
      }

      const representativeEntry = afterEntry ?? beforeEntry;

      if (!representativeEntry) {
        return;
      }

      const targetWidgetIds = [
        ...new Set(representativeEntry.consumers.map((consumer) => consumer.targetWidgetId)),
      ].sort((left, right) => left.localeCompare(right));

      targetWidgetIds.forEach((targetWidgetId) => {
        affectedConsumerWidgetIds.add(targetWidgetId);
      });

      changedVariableEntries.push({
        entryId: representativeEntry.id,
        sourceWidgetId: representativeEntry.key.sourceWidgetId,
        sourceOutputId: representativeEntry.key.sourceOutputId,
        transformSignature: representativeEntry.key.transformSignature,
        targetWidgetIds,
      });
    });

  const executableConsumerWidgetIds = new Set<string>();
  const executableTargetWidgetIds = new Set<string>();
  const managedExecutableSourceWidgetIds = new Set<string>();
  const executableTargetOverridesByWidgetId: Record<string, WidgetExecutionTargetOverrides> = {};

  [...affectedConsumerWidgetIds].forEach((widgetId) => {
    if (input.afterSnapshot.getDefinition(widgetId)?.execution) {
      executableConsumerWidgetIds.add(widgetId);
      executableTargetWidgetIds.add(widgetId);
    }

    listDashboardDownstreamExecutionTargets(widgetId, input.afterSnapshot).forEach((targetWidgetId) => {
      executableTargetWidgetIds.add(targetWidgetId);
    });

    const beforeManagedProjectionBySourceWidgetId = new Map(
      resolveManagedExecutableSourceProjections(
        input.beforeSnapshot,
        widgetId,
        input.resolveManagedConnectionConsumerAdapter,
      ).map((projection) => [
        projection.sourceWidgetId,
        projection,
      ] as const),
    );

    resolveManagedExecutableSourceProjections(
      input.afterSnapshot,
      widgetId,
      input.resolveManagedConnectionConsumerAdapter,
    ).forEach((projection) => {
      const beforeProjection = beforeManagedProjectionBySourceWidgetId.get(
        projection.sourceWidgetId,
      );

      if (beforeProjection?.signature === projection.signature) {
        return;
      }

      managedExecutableSourceWidgetIds.add(projection.sourceWidgetId);
      executableTargetWidgetIds.add(projection.sourceWidgetId);
      executableTargetOverridesByWidgetId[projection.sourceWidgetId] =
        projection.targetOverrides;

      listDashboardDownstreamExecutionTargets(
        projection.sourceWidgetId,
        input.afterSnapshot,
      ).forEach((targetWidgetId) => {
        executableTargetWidgetIds.add(targetWidgetId);
      });
    });
  });

  const stableOrder = input.afterSnapshot.dependencies.entries.map(({ instance }) => instance.id);
  const orderIndex = new Map(stableOrder.map((instanceId, index) => [instanceId, index] as const));
  const sortByStableOrder = (left: string, right: string) =>
    (orderIndex.get(left) ?? Number.MAX_SAFE_INTEGER) -
    (orderIndex.get(right) ?? Number.MAX_SAFE_INTEGER);
  const affectedConsumerWidgetIdsList = [...affectedConsumerWidgetIds].sort(sortByStableOrder);
  const executableConsumerWidgetIdsList = [...executableConsumerWidgetIds].sort(sortByStableOrder);
  const passiveConsumerWidgetIdsList = affectedConsumerWidgetIdsList.filter(
    (widgetId) => !executableConsumerWidgetIds.has(widgetId),
  );
  const managedExecutableSourceWidgetIdsList = [...managedExecutableSourceWidgetIds].sort(sortByStableOrder);
  const executableTargetWidgetIdsList = [
    ...managedExecutableSourceWidgetIdsList,
    ...[...executableTargetWidgetIds]
      .filter((widgetId) => !managedExecutableSourceWidgetIds.has(widgetId))
      .sort(sortByStableOrder),
  ];

  const plan = {
    changedWidgetId: input.changedWidgetId,
    changedVariableEntries,
    affectedConsumerWidgetIds: affectedConsumerWidgetIdsList,
    passiveConsumerWidgetIds: passiveConsumerWidgetIdsList,
    executableConsumerWidgetIds: executableConsumerWidgetIdsList,
    managedExecutableSourceWidgetIds: managedExecutableSourceWidgetIdsList,
    executableTargetWidgetIds: executableTargetWidgetIdsList,
    executableTargetOverridesByWidgetId,
  } satisfies DashboardVariableDrivenCommitPlan;

  return plan;
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

interface UpstreamResolutionSignatureOptions {
  includeResolvedOutputs?: boolean;
}

function collectUpstreamResolutionSignatures(
  instanceId: string,
  snapshot: DashboardExecutionSnapshot,
  signatures = new Set<string>(),
  visited = new Set<string>(),
  options: UpstreamResolutionSignatureOptions = {},
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

    const executableSignature = buildExecutableResolutionSignature(
      input.sourceWidgetId,
      snapshot,
      options,
    );

    if (executableSignature) {
      signatures.add(executableSignature);
    }

    collectUpstreamResolutionSignatures(
      input.sourceWidgetId,
      snapshot,
      signatures,
      visited,
      options,
    );
  }

  return signatures;
}

function buildExecutableResolutionSignature(
  instanceId: string,
  snapshot: DashboardExecutionSnapshot,
  options: UpstreamResolutionSignatureOptions = {},
) {
  const instance = snapshot.getInstance(instanceId);
  const definition = snapshot.getDefinition(instanceId);

  if (!instance || !definition?.execution) {
    return null;
  }

  const resolvedInputs = snapshot.dependencies.resolveInputs(instanceId);
  const effectiveState = resolveReferenceBackedWidgetState({
    instanceTitle: instance.title,
    props: (instance.props ?? {}) as Record<string, unknown>,
    resolvedInputs,
  });
  const context = {
    executionSurface: "private-dashboard",
    widgetId: instance.widgetId,
    instanceId,
    reason: "manual-recalculate",
    props: effectiveState.props,
    runtimeState: instance.runtimeState,
    publicExecution: instance.publicExecution,
    resolvedInputs,
  } satisfies WidgetExecutionContext;
  const resolvedOutputs = snapshot.dependencies.resolveOutputs(instanceId);
  let executionKey: string | undefined;

  try {
    executionKey = definition.execution.getExecutionKey?.(context);
  } catch {
    executionKey = undefined;
  }

  return [
    "exec",
    instanceId,
    instance.widgetId,
    executionKey ?? "",
    stableJsonStringify(effectiveState.props ?? {}),
    stableJsonStringify(instance.publicExecution ?? null),
    options.includeResolvedOutputs === false
      ? ""
      : buildResolvedOutputsResolutionSignature(resolvedOutputs),
  ].join(":");
}

function formatUnresolvedReferenceInputMessage(
  instanceId: string,
  resolvedInputs: ResolvedWidgetInputs | undefined,
) {
  const unresolved = listUnresolvedReferenceBackedPropInputs(resolvedInputs);

  if (unresolved.length === 0) {
    return null;
  }

  const paths = unresolved.map((entry) => entry.propPath.join("."));

  return `Widget ${instanceId} is waiting for referenced setting value${paths.length === 1 ? "" : "s"}: ${paths.join(", ")}.`;
}

interface DashboardWidgetExecutionOrderOptions {
  sourceBoundaryInstanceId?: string;
}

function collectExecutionOrder(
  targetInstanceId: string,
  snapshot: DashboardExecutionSnapshot,
  options: DashboardWidgetExecutionOrderOptions = {},
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

    if (instanceId === options.sourceBoundaryInstanceId) {
      activePath.pop();
      visited.add(instanceId);
      return;
    }

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
  options: DashboardWidgetExecutionOrderOptions = {},
) {
  return collectExecutionOrder(targetInstanceId, snapshot, options);
}

function buildCanonicalDownstreamBindingIndex(
  snapshot: DashboardExecutionSnapshot,
) {
  const downstreamIndex = new Map<string, Set<string>>();

  for (const { instance } of snapshot.dependencies.entries) {
    for (const input of flattenResolvedInputs(snapshot.dependencies.resolveInputs(instance.id))) {
      const sourceWidgetId = input.sourceWidgetId?.trim();

      if (!sourceWidgetId) {
        continue;
      }

      const nextTargets = downstreamIndex.get(sourceWidgetId) ?? new Set<string>();
      nextTargets.add(instance.id);
      downstreamIndex.set(sourceWidgetId, nextTargets);
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

  const executableTargetIds = orderedIds.filter((instanceId) => {
    if (instanceId === sourceInstanceId) {
      return false;
    }

    return Boolean(snapshot.getDefinition(instanceId)?.execution);
  });

  return executableTargetIds;
}

export interface DashboardUpstreamResolutionRequirement {
  executableInstanceIds: string[];
  needsResolution: boolean;
  requestKey: string;
  settledKey: string;
}

function buildDashboardUpstreamResolutionKeyWithOptions(
  targetInstanceId: string,
  snapshot: DashboardExecutionSnapshot,
  options: UpstreamResolutionSignatureOptions = {},
) {
  const signatures = [...collectUpstreamResolutionSignatures(
    targetInstanceId,
    snapshot,
    new Set<string>(),
    new Set<string>(),
    options,
  )].sort();

  if (signatures.length === 0) {
    return `${targetInstanceId}::no-upstream-bindings`;
  }

  return `${targetInstanceId}::${signatures.join("::")}`;
}

export function buildDashboardUpstreamResolutionKey(
  targetInstanceId: string,
  snapshot: DashboardExecutionSnapshot,
) {
  return buildDashboardUpstreamResolutionKeyWithOptions(targetInstanceId, snapshot);
}

export function buildDashboardPassiveUpstreamResolutionKey(
  targetInstanceId: string,
  snapshot: DashboardExecutionSnapshot,
) {
  return buildDashboardUpstreamResolutionKeyWithOptions(targetInstanceId, snapshot, {
    includeResolvedOutputs: false,
  });
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
    settledKey: buildDashboardPassiveUpstreamResolutionKey(targetInstanceId, snapshot),
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
  executionSurface: WidgetExecutionSurface;
  publicWorkspaceToken?: string;
  widgets: DashboardWidgetInstance[];
  resolveWidgetDefinition: (widgetId: string) => WidgetDefinition | undefined;
  targetInstanceId: string;
  reason: WidgetExecutionReason;
  dashboardState?: WidgetExecutionDashboardState;
  refreshCycleId?: string;
  targetOverrides?: WidgetExecutionTargetOverrides;
  persistTargetRuntimeStateWithOverrides?: boolean;
  sourceBoundaryInstanceId?: string;
  signal?: AbortSignal;
  executedInstanceIds?: Set<string>;
  runtimeDataStore?: RuntimeDataStore | null;
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
    runtimeDataStore: args.runtimeDataStore,
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
    executionOrder = listDashboardWidgetExecutionOrder(args.targetInstanceId, snapshot, {
      sourceBoundaryInstanceId: args.sourceBoundaryInstanceId,
    });
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
    if (args.signal?.aborted) {
      return {
        status: "skipped",
        widgets: workingWidgets,
        targetInstanceId: args.targetInstanceId,
        targetRuntimeState,
        nodeResults,
        executedInstanceIds,
      };
    }

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
      runtimeDataStore: args.runtimeDataStore,
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
    const resolvedInputs = snapshot.dependencies.resolveInputs(instanceId);
    const unresolvedReferenceInputMessage = formatUnresolvedReferenceInputMessage(
      instanceId,
      resolvedInputs,
    );

    if (unresolvedReferenceInputMessage) {
      nodeResults.push({
        instanceId,
        reason: nodeReason,
        status: "skipped",
        error: unresolvedReferenceInputMessage,
      });
      args.onNodeComplete?.({
        instanceId,
        reason: nodeReason,
        targetInstanceId: args.targetInstanceId,
        status: "skipped",
        error: unresolvedReferenceInputMessage,
      });

      return {
        status: "skipped",
        error: unresolvedReferenceInputMessage,
        widgets: workingWidgets,
        targetInstanceId: args.targetInstanceId,
        targetRuntimeState,
        nodeResults,
        executedInstanceIds,
      };
    }

    const effectiveState = resolveReferenceBackedWidgetState({
      instanceTitle: instance.title,
      props: (instance.props ?? {}) as Record<string, unknown>,
      resolvedInputs,
    });
    const executionContext = {
      scopeId: args.scopeId,
      executionSurface: args.executionSurface,
      publicWorkspaceToken: args.publicWorkspaceToken,
      widgetId: instance.widgetId,
      instanceId,
      reason: nodeReason,
      props: effectiveState.props,
      runtimeState: instance.runtimeState,
      publicExecution: instance.publicExecution,
      resolvedInputs,
      dashboardState: args.dashboardState,
      runtimeDataStore: args.runtimeDataStore,
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

    if (import.meta.env.DEV && executionContext.widgetId === "connection-query") {
      /*
      console.log("[widget-exec] node start", summarizeExecutionContextForDebug(executionContext));
      */
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

    if (args.signal?.aborted) {
      return {
        status: "skipped",
        widgets: workingWidgets,
        targetInstanceId: args.targetInstanceId,
        targetRuntimeState,
        nodeResults,
        executedInstanceIds,
      };
    }

    const nextRuntimeState = mergeRuntimeStatePatch(
      instance.runtimeState,
      result.runtimeStatePatch,
    );
    const shouldPersistRuntimeState =
      !(
        instanceId === args.targetInstanceId &&
        args.targetOverrides &&
        !args.persistTargetRuntimeStateWithOverrides
      );

    if (import.meta.env.DEV && instance.widgetId === "connection-query") {
      /*
      console.log("[widget-exec] node result", {
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
      */
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
  executionSurface?: WidgetExecutionSurface;
  publicWorkspaceToken?: string;
}) {
  const snapshot = buildDashboardExecutionSnapshot({
    widgets: args.widgets,
    resolveWidgetDefinition: args.resolveWidgetDefinition,
  });
  const candidates = snapshot.dependencies.entries.flatMap(({ instance }) => {
    const definition = snapshot.getDefinition(instance.id);
    const upstreamExecutableIds = collectTransitiveExecutableDependencyIds(instance.id, snapshot);

    if (definition?.execution) {
      const resolvedInputs = snapshot.dependencies.resolveInputs(instance.id);

      if (listUnresolvedReferenceBackedPropInputs(resolvedInputs).length > 0) {
        return [];
      }

      const effectiveState = resolveReferenceBackedWidgetState({
        instanceTitle: instance.title,
        props: (instance.props ?? {}) as Record<string, unknown>,
        resolvedInputs,
      });
      const context = {
        executionSurface: args.executionSurface ?? "private-dashboard",
        publicWorkspaceToken: args.publicWorkspaceToken,
        widgetId: instance.widgetId,
        instanceId: instance.id,
        reason: "dashboard-refresh" as const,
        props: effectiveState.props,
        runtimeState: instance.runtimeState,
        publicExecution: instance.publicExecution,
        resolvedInputs,
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
