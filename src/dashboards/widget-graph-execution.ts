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
  WidgetExecutionReadiness,
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

const CONNECTION_QUERY_EXECUTION_DEBUG_LOGS_ENABLED = false;

function shouldLogConnectionQueryExecutionDebug(widgetId: string | undefined) {
  return CONNECTION_QUERY_EXECUTION_DEBUG_LOGS_ENABLED &&
    import.meta.env.DEV &&
    widgetId === "connection-query";
}

function summarizeExecutionPropsForDebug(props: unknown) {
  if (!isPlainRecord(props)) {
    return {
      hasConnectionRef: false,
      hasConnectionId: false,
      hasQueryModel: false,
      queryKeys: [],
    };
  }

  const connectionRef = props.connectionRef;
  const query = props.query;

  return {
    hasConnectionRef: isPlainRecord(connectionRef),
    hasConnectionId: isPlainRecord(connectionRef) && typeof connectionRef.id === "number",
    hasQueryModel: typeof props.queryModelId === "string" && props.queryModelId.trim().length > 0,
    queryKeys: isPlainRecord(query) ? Object.keys(query).sort() : [],
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

function listGraphDependencyInputs(
  instanceId: string,
  snapshot: DashboardExecutionSnapshot,
) {
  return flattenResolvedInputs(snapshot.dependencies.resolveInputs(instanceId)).filter(
    (input): input is ResolvedWidgetInput & { sourceWidgetId: string } =>
      typeof input.sourceWidgetId === "string" &&
      input.sourceWidgetId.length > 0 &&
      (
        input.status === "valid" ||
        input.status === "contract-mismatch" ||
        input.status === "transform-invalid"
      ),
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

function normalizeExecutionReadinessReason(reason: string | undefined, fallback: string) {
  const trimmed = reason?.trim();

  return trimmed || fallback;
}

export function resolveWidgetExecutionReadiness(
  definition: WidgetDefinition,
  context: WidgetExecutionContext,
): WidgetExecutionReadiness {
  const explicitReadiness = definition.execution?.getExecutionReadiness?.(context);

  if (explicitReadiness) {
    return explicitReadiness;
  }

  if (definition.execution?.canExecute?.(context) === false) {
    return {
      status: "error",
      reason:
        definition.execution.getExecutionBlockedReason?.(context) ??
        `Widget ${context.instanceId} is not currently executable.`,
    };
  }

  return {
    status: "ready",
  };
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

interface DashboardVariableDrivenCommitPlanEntryCandidate
  extends DashboardVariableDrivenCommitPlanEntry {
  beforeValueSignature: string;
  afterValueSignature: string;
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
  includeDownstreamVariableSources?: boolean;
  shouldIncludeChangedVariableEntry?: (
    entry: DashboardVariableDrivenCommitPlanEntryCandidate,
  ) => boolean;
  resolveManagedConnectionConsumerAdapter?: ResolveManagedConnectionConsumerAdapter;
}): DashboardVariableDrivenCommitPlan {
  const candidateSourceWidgetIds = new Set<string>([input.changedWidgetId]);
  const includeDownstreamVariableSources =
    input.includeDownstreamVariableSources ?? true;

  if (includeDownstreamVariableSources) {
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
  }

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

      const candidate = {
        entryId: representativeEntry.id,
        sourceWidgetId: representativeEntry.key.sourceWidgetId,
        sourceOutputId: representativeEntry.key.sourceOutputId,
        transformSignature: representativeEntry.key.transformSignature,
        targetWidgetIds,
        beforeValueSignature: beforeSignature,
        afterValueSignature: afterSignature,
      } satisfies DashboardVariableDrivenCommitPlanEntryCandidate;

      if (
        input.shouldIncludeChangedVariableEntry &&
        !input.shouldIncludeChangedVariableEntry(candidate)
      ) {
        return;
      }

      targetWidgetIds.forEach((targetWidgetId) => {
        affectedConsumerWidgetIds.add(targetWidgetId);
      });

      changedVariableEntries.push({
        entryId: candidate.entryId,
        sourceWidgetId: candidate.sourceWidgetId,
        sourceOutputId: candidate.sourceOutputId,
        transformSignature: candidate.transformSignature,
        targetWidgetIds: candidate.targetWidgetIds,
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

    if (includeDownstreamVariableSources) {
      listDashboardDownstreamExecutionTargets(widgetId, input.afterSnapshot).forEach((targetWidgetId) => {
        executableTargetWidgetIds.add(targetWidgetId);
      });
    }

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

export function planDashboardRuntimeVariableDrivenCommit(input: {
  changedWidgetId: string;
  afterSnapshot: DashboardExecutionSnapshot;
  changedSourceOutputIds?: readonly string[];
  resolvePreviousVariableEntrySignature?: (entryId: string) => string | undefined;
  shouldIncludeChangedVariableEntry?: (
    entry: DashboardVariableDrivenCommitPlanEntryCandidate,
  ) => boolean;
  resolveManagedConnectionConsumerAdapter?: ResolveManagedConnectionConsumerAdapter;
}): DashboardVariableDrivenCommitPlan {
  const changedSourceOutputIds =
    input.changedSourceOutputIds && input.changedSourceOutputIds.length > 0
      ? new Set(input.changedSourceOutputIds)
      : null;
  const sourceEntries = (
    input.afterSnapshot.dependencies.variableRegistry.bySourceWidgetId.get(input.changedWidgetId) ?? []
  ).filter((entry) =>
    changedSourceOutputIds ? changedSourceOutputIds.has(entry.key.sourceOutputId) : true,
  );
  const changedVariableEntries: DashboardVariableDrivenCommitPlanEntry[] = [];
  const affectedConsumerWidgetIds = new Set<string>();

  sourceEntries
    .sort((left, right) => left.id.localeCompare(right.id))
    .forEach((entry) => {
      const afterValue = resolveVariableEntryValue(entry, input.afterSnapshot);
      const afterSignature = buildVariableEntryValueSignature(afterValue);
      const previousSignature = input.resolvePreviousVariableEntrySignature?.(entry.id);

      if (previousSignature === afterSignature) {
        return;
      }

      if (previousSignature === undefined && afterValue.status !== "valid") {
        return;
      }

      const targetWidgetIds = [
        ...new Set(entry.consumers.map((consumer) => consumer.targetWidgetId)),
      ].sort((left, right) => left.localeCompare(right));

      const candidate = {
        entryId: entry.id,
        sourceWidgetId: entry.key.sourceWidgetId,
        sourceOutputId: entry.key.sourceOutputId,
        transformSignature: entry.key.transformSignature,
        targetWidgetIds,
        beforeValueSignature: previousSignature ?? "",
        afterValueSignature: afterSignature,
      } satisfies DashboardVariableDrivenCommitPlanEntryCandidate;

      if (
        input.shouldIncludeChangedVariableEntry &&
        !input.shouldIncludeChangedVariableEntry(candidate)
      ) {
        return;
      }

      targetWidgetIds.forEach((targetWidgetId) => {
        affectedConsumerWidgetIds.add(targetWidgetId);
      });

      changedVariableEntries.push({
        entryId: candidate.entryId,
        sourceWidgetId: candidate.sourceWidgetId,
        sourceOutputId: candidate.sourceOutputId,
        transformSignature: candidate.transformSignature,
        targetWidgetIds: candidate.targetWidgetIds,
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

    resolveManagedExecutableSourceProjections(
      input.afterSnapshot,
      widgetId,
      input.resolveManagedConnectionConsumerAdapter,
    ).forEach((projection) => {
      managedExecutableSourceWidgetIds.add(projection.sourceWidgetId);
      executableTargetWidgetIds.add(projection.sourceWidgetId);
      executableTargetOverridesByWidgetId[projection.sourceWidgetId] =
        projection.targetOverrides;
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

  return {
    changedWidgetId: input.changedWidgetId,
    changedVariableEntries,
    affectedConsumerWidgetIds: affectedConsumerWidgetIdsList,
    passiveConsumerWidgetIds: passiveConsumerWidgetIdsList,
    executableConsumerWidgetIds: executableConsumerWidgetIdsList,
    managedExecutableSourceWidgetIds: managedExecutableSourceWidgetIdsList,
    executableTargetWidgetIds: executableTargetWidgetIdsList,
    executableTargetOverridesByWidgetId,
  } satisfies DashboardVariableDrivenCommitPlan;
}

function listValidDependencyIds(
  instanceId: string,
  snapshot: DashboardExecutionSnapshot,
) {
  const nextDependencyIds = new Set<string>();

  for (const input of listGraphDependencyInputs(instanceId, snapshot)) {
    nextDependencyIds.add(input.sourceWidgetId);
  }

  return [...nextDependencyIds];
}

function isRefreshNotApplicableDefinition(definition: WidgetDefinition | undefined) {
  return definition?.registryContract?.runtime?.refreshPolicy === "not-applicable";
}

function collectTransitiveExecutableDependencyIds(
  instanceId: string,
  snapshot: DashboardExecutionSnapshot,
  executableIds = new Set<string>(),
  visited = new Set<string>(),
  options: {
    excludeRefreshNotApplicable?: boolean;
  } = {},
) {
  if (visited.has(instanceId)) {
    return executableIds;
  }

  visited.add(instanceId);

  for (const dependencyId of listValidDependencyIds(instanceId, snapshot)) {
    const sourceDefinition = snapshot.getDefinition(dependencyId);

    if (
      sourceDefinition?.execution &&
      !(
        options.excludeRefreshNotApplicable === true &&
        isRefreshNotApplicableDefinition(sourceDefinition)
      )
    ) {
      executableIds.add(dependencyId);
    }

    collectTransitiveExecutableDependencyIds(
      dependencyId,
      snapshot,
      executableIds,
      visited,
      options,
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

  for (const input of listGraphDependencyInputs(instanceId, snapshot)) {
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

interface DashboardWidgetExecutionOrderOptions {
  excludeRefreshNotApplicable?: boolean;
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

    if (
      definition?.execution &&
      !(
        options.excludeRefreshNotApplicable === true &&
        isRefreshNotApplicableDefinition(definition)
      )
    ) {
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

export interface DashboardFiniteExecutionPlanNode {
  instanceId: string;
  reason: WidgetExecutionReason;
  targetInstanceIds: string[];
}

export interface DashboardFiniteExecutionPlan {
  nodes: DashboardFiniteExecutionPlanNode[];
  targetInstanceIds: string[];
}

export function planDashboardFiniteExecution(input: {
  reason: WidgetExecutionReason;
  snapshot: DashboardExecutionSnapshot;
  sourceBoundaryInstanceId?: string;
  targetInstanceIds: string[];
}): DashboardFiniteExecutionPlan {
  const targetInstanceIds = [...new Set(input.targetInstanceIds)].filter((instanceId) =>
    Boolean(input.snapshot.getInstance(instanceId)),
  );
  const nodeTargetsByInstanceId = new Map<string, Set<string>>();
  const nodeReasonByInstanceId = new Map<string, WidgetExecutionReason>();

  const addNode = (
    instanceId: string,
    targetInstanceId: string,
    reason: WidgetExecutionReason,
  ) => {
    if (!input.snapshot.getInstance(instanceId)) {
      return;
    }

    const targetIds = nodeTargetsByInstanceId.get(instanceId) ?? new Set<string>();
    targetIds.add(targetInstanceId);
    nodeTargetsByInstanceId.set(instanceId, targetIds);

    if (!nodeReasonByInstanceId.has(instanceId) || instanceId === targetInstanceId) {
      nodeReasonByInstanceId.set(instanceId, reason);
    }
  };

  targetInstanceIds.forEach((targetInstanceId) => {
    let executionOrder: string[] = [];

    try {
      executionOrder = listDashboardWidgetExecutionOrder(targetInstanceId, input.snapshot, {
        excludeRefreshNotApplicable: input.reason === "dashboard-refresh",
        sourceBoundaryInstanceId: input.sourceBoundaryInstanceId,
      });
    } catch {
      executionOrder = [];
    }

    executionOrder.forEach((instanceId) => {
      addNode(
        instanceId,
        targetInstanceId,
        resolveNodeExecutionReason(input.reason, instanceId === targetInstanceId),
      );
    });

    if (!executionOrder.includes(targetInstanceId)) {
      addNode(targetInstanceId, targetInstanceId, resolveNodeExecutionReason(input.reason, true));
    }
  });

  const stableOrder = input.snapshot.dependencies.entries.map(({ instance }) => instance.id);
  const orderIndex = new Map(stableOrder.map((instanceId, index) => [instanceId, index] as const));

  return {
    nodes: [...nodeTargetsByInstanceId.entries()]
      .sort(
        ([left], [right]) =>
          (orderIndex.get(left) ?? Number.MAX_SAFE_INTEGER) -
          (orderIndex.get(right) ?? Number.MAX_SAFE_INTEGER),
      )
      .map(([instanceId, targetIds]) => ({
        instanceId,
        reason: nodeReasonByInstanceId.get(instanceId) ?? input.reason,
        targetInstanceIds: [...targetIds].sort(
          (left, right) =>
            (orderIndex.get(left) ?? Number.MAX_SAFE_INTEGER) -
            (orderIndex.get(right) ?? Number.MAX_SAFE_INTEGER),
        ),
      })),
    targetInstanceIds,
  };
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

export type DashboardWidgetGraphNodeStatus =
  | WidgetExecutionResult["status"]
  | "waiting"
  | "upstream-error";

export interface ExecutedWidgetNodeResult {
  instanceId: string;
  reason: WidgetExecutionReason;
  status: DashboardWidgetGraphNodeStatus;
  error?: string;
  blockedByWidgetId?: string;
  blockedByOutputId?: string;
  runtimeState?: Record<string, unknown>;
}

export interface DashboardWidgetGraphExecutionResult {
  status: "success" | "waiting" | "error" | "skipped";
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
    status: DashboardWidgetGraphNodeStatus;
    error?: string;
    blockedByWidgetId?: string;
    blockedByOutputId?: string;
  }) => void;
}

function resolveDirectBlockingOutputId(
  snapshot: DashboardExecutionSnapshot,
  blockedInstanceId: string,
  blockerInstanceId: string,
) {
  const blockedInstance = snapshot.getInstance(blockedInstanceId);
  const bindings = normalizeWidgetInstanceBindings(blockedInstance?.bindings);

  for (const binding of Object.values(bindings ?? {})) {
    const entries = Array.isArray(binding) ? binding : [binding];
    const match = entries.find(
      (entry) => entry?.sourceWidgetId === blockerInstanceId &&
        typeof entry.sourceOutputId === "string" &&
        entry.sourceOutputId.trim().length > 0,
    );

    if (match?.sourceOutputId) {
      return match.sourceOutputId;
    }
  }

  return undefined;
}

function appendUpstreamErrorNodeResults(input: {
  args: ExecuteDashboardWidgetGraphArgs;
  blockerInstanceId: string;
  blockerTitle: string;
  executionIndex: number;
  executionOrder: string[];
  executedInstanceIds: Set<string>;
  nodeResults: ExecutedWidgetNodeResult[];
  snapshot: DashboardExecutionSnapshot;
}) {
  const {
    args,
    blockerInstanceId,
    blockerTitle,
    executionIndex,
    executionOrder,
    executedInstanceIds,
    nodeResults,
    snapshot,
  } = input;
  const blockedMessage = `Blocked by ${blockerTitle}.`;
  const blockedNodeIds = new Set<string>();

  for (let index = executionIndex + 1; index < executionOrder.length; index += 1) {
    const blockedInstanceId = executionOrder[index];

    if (executedInstanceIds.has(blockedInstanceId)) {
      continue;
    }

    const blockedReason = resolveNodeExecutionReason(
      args.reason,
      blockedInstanceId === args.targetInstanceId,
    );
    const blockedByOutputId = resolveDirectBlockingOutputId(
      snapshot,
      blockedInstanceId,
      blockerInstanceId,
    );

    blockedNodeIds.add(blockedInstanceId);
    nodeResults.push({
      instanceId: blockedInstanceId,
      reason: blockedReason,
      status: "upstream-error",
      error: blockedMessage,
      blockedByWidgetId: blockerInstanceId,
      blockedByOutputId,
    });
    args.onNodeComplete?.({
      instanceId: blockedInstanceId,
      reason: blockedReason,
      targetInstanceId: args.targetInstanceId,
      status: "upstream-error",
      error: blockedMessage,
      blockedByWidgetId: blockerInstanceId,
      blockedByOutputId,
    });
  }

  if (
    !blockedNodeIds.has(args.targetInstanceId) &&
    !executedInstanceIds.has(args.targetInstanceId) &&
    args.targetInstanceId !== blockerInstanceId
  ) {
    const blockedByOutputId = resolveDirectBlockingOutputId(
      snapshot,
      args.targetInstanceId,
      blockerInstanceId,
    );

    nodeResults.push({
      instanceId: args.targetInstanceId,
      reason: resolveNodeExecutionReason(args.reason, true),
      status: "upstream-error",
      error: blockedMessage,
      blockedByWidgetId: blockerInstanceId,
      blockedByOutputId,
    });
    args.onNodeComplete?.({
      instanceId: args.targetInstanceId,
      reason: resolveNodeExecutionReason(args.reason, true),
      targetInstanceId: args.targetInstanceId,
      status: "upstream-error",
      error: blockedMessage,
      blockedByWidgetId: blockerInstanceId,
      blockedByOutputId,
    });
  }
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
      excludeRefreshNotApplicable: args.reason === "dashboard-refresh",
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

  if (CONNECTION_QUERY_EXECUTION_DEBUG_LOGS_ENABLED && import.meta.env.DEV) {
    const connectionOrderRows = executionOrder.flatMap((instanceId, index) => {
      const orderedInstance = snapshot.getInstance(instanceId);

      if (orderedInstance?.widgetId !== "connection-query") {
        return [];
      }

      const resolvedInputs = snapshot.dependencies.resolveInputs(instanceId);
      const effectiveState = resolveReferenceBackedWidgetState({
        instanceTitle: orderedInstance.title,
        props: (orderedInstance.props ?? {}) as Record<string, unknown>,
        resolvedInputs,
      });
      const row = {
        instanceId,
        widgetId: orderedInstance.widgetId,
        widgetTitle: orderedInstance.title,
        targetInstanceId: args.targetInstanceId,
        targetWidgetId: targetInstance.widgetId,
        targetWidgetTitle: targetInstance.title,
        reason: args.reason,
        refreshCycleId: args.refreshCycleId,
        executionOrderIndex: index,
        willSkipAlreadyExecuted: executedInstanceIds.has(instanceId),
        ...summarizeExecutionPropsForDebug(effectiveState.props),
      };

      return [row];
    });

    if (connectionOrderRows.length > 0) {
      console.log("[graph-execution-order]", {
        targetInstanceId: args.targetInstanceId,
        targetWidgetId: targetInstance.widgetId,
        targetWidgetTitle: targetInstance.title,
        reason: args.reason,
        refreshCycleId: args.refreshCycleId,
        executionOrder,
        connectionQueryInstanceIds: connectionOrderRows.map((row) => row.instanceId),
      });
      connectionOrderRows.forEach((row) => {
        console.log("[graph-execution-order-row]", row);
      });
    }
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

  for (let executionIndex = 0; executionIndex < executionOrder.length; executionIndex += 1) {
    const instanceId = executionOrder[executionIndex];

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
      const skippedInstance = snapshot.getInstance(instanceId);

      if (shouldLogConnectionQueryExecutionDebug(skippedInstance?.widgetId)) {
        console.log("[graph-node-skip]", {
          instanceId,
          widgetId: skippedInstance?.widgetId,
          widgetTitle: skippedInstance?.title,
          reason: resolveNodeExecutionReason(args.reason, instanceId === args.targetInstanceId),
          targetInstanceId: args.targetInstanceId,
          refreshCycleId: args.refreshCycleId,
          skipReason: "already-executed-in-shared-cycle",
        });
      }

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

    if (shouldLogConnectionQueryExecutionDebug(instance.widgetId)) {
      console.log("[graph-node-start]", {
        instanceId,
        widgetId: instance.widgetId,
        widgetTitle: instance.title,
        reason: nodeReason,
        targetInstanceId: args.targetInstanceId,
        refreshCycleId: args.refreshCycleId,
        ...summarizeExecutionPropsForDebug(effectiveState.props),
      });
    }

    if (nodeReason === "dashboard-refresh" && instanceId === args.targetInstanceId) {
      const refreshPolicy =
        definition.execution.getRefreshPolicy?.(executionContext) ?? "manual-only";

      if (refreshPolicy !== "allow-refresh") {
        const error = `Widget ${instanceId} is not eligible for dashboard refresh execution.`;

        args.onNodeStart?.({
          instanceId,
          reason: nodeReason,
          targetInstanceId: args.targetInstanceId,
        });
        nodeResults.push({
          instanceId,
          reason: nodeReason,
          status: "error",
          error,
        });
        args.onNodeComplete?.({
          instanceId,
          reason: nodeReason,
          targetInstanceId: args.targetInstanceId,
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

    const readiness = resolveWidgetExecutionReadiness(definition, executionContext);

    if (readiness.status === "waiting") {
      const waitingReason = normalizeExecutionReadinessReason(
        readiness.reason,
        `Widget ${instanceId} is waiting for required upstream data.`,
      );
      const waitingSourceTitle = instance.title?.trim() || instanceId;
      const waitingNodeIds = new Set<string>();

      for (
        let waitingIndex = executionIndex;
        waitingIndex < executionOrder.length;
        waitingIndex += 1
      ) {
        const waitingInstanceId = executionOrder[waitingIndex];

        if (executedInstanceIds.has(waitingInstanceId)) {
          continue;
        }

        const waitingInstance = snapshot.getInstance(waitingInstanceId);
        const waitingNodeReason = resolveNodeExecutionReason(
          args.reason,
          waitingInstanceId === args.targetInstanceId,
        );
        const waitingMessage =
          waitingInstanceId === instanceId
            ? waitingReason
            : `Waiting for ${waitingSourceTitle}.`;

        waitingNodeIds.add(waitingInstanceId);
        nodeResults.push({
          instanceId: waitingInstanceId,
          reason: waitingNodeReason,
          status: "waiting",
          error: waitingMessage,
        });
        args.onNodeComplete?.({
          instanceId: waitingInstanceId,
          reason: waitingNodeReason,
          targetInstanceId: args.targetInstanceId,
          status: "waiting",
          error: waitingMessage,
        });

        if (waitingInstanceId === args.targetInstanceId) {
          targetRuntimeState = waitingInstance?.runtimeState;
        }
      }

      if (
        !waitingNodeIds.has(args.targetInstanceId) &&
        !executedInstanceIds.has(args.targetInstanceId)
      ) {
        const waitingTarget = snapshot.getInstance(args.targetInstanceId);
        const waitingMessage = `Waiting for ${waitingSourceTitle}.`;

        nodeResults.push({
          instanceId: args.targetInstanceId,
          reason: resolveNodeExecutionReason(args.reason, true),
          status: "waiting",
          error: waitingMessage,
        });
        args.onNodeComplete?.({
          instanceId: args.targetInstanceId,
          reason: resolveNodeExecutionReason(args.reason, true),
          targetInstanceId: args.targetInstanceId,
          status: "waiting",
          error: waitingMessage,
        });
        targetRuntimeState = waitingTarget?.runtimeState;
      }

      return {
        status: "waiting",
        error: waitingReason,
        widgets: workingWidgets,
        targetInstanceId: args.targetInstanceId,
        targetRuntimeState,
        nodeResults,
        executedInstanceIds,
      };
    }

    if (readiness.status === "error") {
      const error = normalizeExecutionReadinessReason(
        readiness.reason,
        `Widget ${instanceId} is not currently executable.`,
      );

      args.onNodeStart?.({
        instanceId,
        reason: nodeReason,
        targetInstanceId: args.targetInstanceId,
      });
      nodeResults.push({
        instanceId,
        reason: nodeReason,
        status: "error",
        error,
      });
      args.onNodeComplete?.({
        instanceId,
        reason: nodeReason,
        targetInstanceId: args.targetInstanceId,
        status: "error",
        error,
      });
      appendUpstreamErrorNodeResults({
        args,
        blockerInstanceId: instanceId,
        blockerTitle: instance.title?.trim() || instanceId,
        executionIndex,
        executionOrder,
        executedInstanceIds,
        nodeResults,
        snapshot,
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
      appendUpstreamErrorNodeResults({
        args,
        blockerInstanceId: instanceId,
        blockerTitle: instance.title?.trim() || instanceId,
        executionIndex,
        executionOrder,
        executedInstanceIds,
        nodeResults,
        snapshot,
      });

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
    const upstreamExecutableIds = collectTransitiveExecutableDependencyIds(
      instance.id,
      snapshot,
      new Set<string>(),
      new Set<string>(),
      {
        excludeRefreshNotApplicable: true,
      },
    );

    if (definition?.execution && !isRefreshNotApplicableDefinition(definition)) {
      const resolvedInputs = snapshot.dependencies.resolveInputs(instance.id);

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

      if (refreshPolicy === "allow-refresh") {
        return [instance.id];
      }
    }

    return upstreamExecutableIds.size > 0 ? [instance.id] : [];
  });
  const candidateSet = new Set(candidates);
  const transitiveUpstreamIds = new Set<string>();

  for (const candidateId of candidates) {
    const upstreamIds = collectTransitiveExecutableDependencyIds(
      candidateId,
      snapshot,
      new Set<string>(),
      new Set<string>(),
      {
        excludeRefreshNotApplicable: true,
      },
    );

    for (const upstreamId of upstreamIds) {
      if (candidateSet.has(upstreamId)) {
        transitiveUpstreamIds.add(upstreamId);
      }
    }
  }

  const refreshableTargetIds = candidates.filter((candidateId) =>
    !transitiveUpstreamIds.has(candidateId)
  );

  if (CONNECTION_QUERY_EXECUTION_DEBUG_LOGS_ENABLED && import.meta.env.DEV) {
    const connectionQueryRows = snapshot.dependencies.entries.flatMap(({ instance }) => {
      if (instance.widgetId !== "connection-query") {
        return [];
      }

      const definition = snapshot.getDefinition(instance.id);
      const resolvedInputs = snapshot.dependencies.resolveInputs(instance.id);
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
      const refreshPolicy = definition?.execution
        ? definition.execution.getRefreshPolicy?.(context) ?? "manual-only"
        : "missing-execution";
      const canExecute = definition?.execution
        ? definition.execution.canExecute?.(context) !== false
        : false;

      return [{
        instanceId: instance.id,
        widgetTitle: instance.title,
        refreshPolicy,
        canExecute,
        includedAsCandidate: candidates.includes(instance.id),
        includedAsRefreshTarget: refreshableTargetIds.includes(instance.id),
        ...summarizeExecutionPropsForDebug(effectiveState.props),
      }];
    });

    if (connectionQueryRows.length > 0) {
      console.log("[refresh-targets]", {
        refreshCycleId: args.refreshCycleId,
        executionSurface: args.executionSurface ?? "private-dashboard",
        refreshableTargetIds,
        connectionQueryInstanceIds: connectionQueryRows.map((row) => row.instanceId),
      });
      connectionQueryRows.forEach((row) => {
        console.log("[refresh-target-row]", {
          refreshCycleId: args.refreshCycleId,
          executionSurface: args.executionSurface ?? "private-dashboard",
          ...row,
        });
      });
    }
  }

  return refreshableTargetIds;
}
