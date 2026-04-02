import type { DashboardWidgetInstance } from "@/dashboards/types";
import type {
  ResolvedWidgetInput,
  ResolvedWidgetInputs,
  WidgetDefinition,
  WidgetInputEffect,
  WidgetInputPortDefinition,
  WidgetInstanceBindings,
  WidgetIoDefinition,
  WidgetOutputPortDefinition,
  WidgetPortBinding,
  WidgetPortBindingValue,
} from "@/widgets/types";

export interface FlattenedDashboardWidgetEntry {
  instance: DashboardWidgetInstance;
  hiddenInCollapsedRow: boolean;
  parentRowId?: string;
}

export interface DashboardWidgetDependencyGraphNode {
  id: string;
  widgetId: string;
  title: string;
  placementMode?: "canvas" | "sidebar";
  hiddenInCollapsedRow: boolean;
  parentRowId?: string;
  inputs: Array<{
    id: string;
    label: string;
    accepts: string[];
  }>;
  outputs: Array<{
    id: string;
    label: string;
    contract: string;
  }>;
}

export type DashboardWidgetDependencyEdgeStatus =
  | "valid"
  | "unbound"
  | "missing-source"
  | "missing-output"
  | "contract-mismatch"
  | "self-reference-blocked";

export interface DashboardWidgetDependencyGraphEdge {
  id: string;
  from: string;
  fromPort: string;
  to: string;
  toPort: string;
  contract: string | null;
  source: "binding";
  status: DashboardWidgetDependencyEdgeStatus;
  effects: WidgetInputEffect[];
}

export interface DashboardWidgetDependencyGraph {
  nodes: DashboardWidgetDependencyGraphNode[];
  edges: DashboardWidgetDependencyGraphEdge[];
}

export interface DashboardWidgetDependencyModel {
  entries: FlattenedDashboardWidgetEntry[];
  graph: DashboardWidgetDependencyGraph;
  getWidgetDefinition: (widgetId: string) => WidgetDefinition | undefined;
  resolveIo: (instanceId: string) => WidgetIoDefinition | undefined;
  resolveInputs: (instanceId: string) => ResolvedWidgetInputs | undefined;
}

export type WidgetGraphPortKind = "input" | "output";

export interface WidgetGraphHandleDescriptor {
  kind: WidgetGraphPortKind;
  portId: string;
}

export interface WidgetGraphConnectionLike {
  source?: string | null;
  sourceHandle?: string | null;
  target?: string | null;
  targetHandle?: string | null;
}

export interface NormalizedWidgetGraphConnection {
  sourceWidgetId: string;
  sourceOutputId: string;
  targetWidgetId: string;
  targetInputId: string;
}

export interface ResolvedWidgetGraphConnection {
  connection: NormalizedWidgetGraphConnection;
  sourceInstance: DashboardWidgetInstance;
  targetInstance: DashboardWidgetInstance;
  sourceDefinition: WidgetDefinition;
  targetDefinition: WidgetDefinition;
  sourceOutput: WidgetOutputPortDefinition<Record<string, unknown>>;
  targetInput: WidgetInputPortDefinition<Record<string, unknown>>;
}

export function buildWidgetGraphHandleId(kind: WidgetGraphPortKind, portId: string) {
  return `${kind}:${portId}`;
}

export function parseWidgetGraphHandleId(
  handleId: string | null | undefined,
): WidgetGraphHandleDescriptor | null {
  if (!handleId) {
    return null;
  }

  const [kind, ...rest] = handleId.split(":");
  const portId = rest.join(":").trim();

  if ((kind !== "input" && kind !== "output") || !portId) {
    return null;
  }

  return {
    kind,
    portId,
  };
}

function normalizeBinding(value: unknown): WidgetPortBinding | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const sourceWidgetId =
    typeof record.sourceWidgetId === "string" ? record.sourceWidgetId.trim() : "";
  const sourceOutputId =
    typeof record.sourceOutputId === "string" ? record.sourceOutputId.trim() : "";
  const transformId =
    typeof record.transformId === "string" ? record.transformId.trim() : undefined;

  if (!sourceWidgetId || !sourceOutputId) {
    return null;
  }

  return {
    sourceWidgetId,
    sourceOutputId,
    transformId: transformId || undefined,
  };
}

function normalizeBindingValue(value: unknown): WidgetPortBindingValue | null {
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => normalizeBinding(entry))
      .filter((entry): entry is WidgetPortBinding => entry !== null);

    return normalized.length > 0 ? normalized : null;
  }

  return normalizeBinding(value);
}

export function normalizeWidgetInstanceBindings(
  bindings: WidgetInstanceBindings | null | undefined,
): WidgetInstanceBindings | undefined {
  if (!bindings || typeof bindings !== "object" || Array.isArray(bindings)) {
    return undefined;
  }

  const normalizedEntries = Object.entries(bindings).flatMap(([inputId, rawBinding]) => {
    const normalizedInputId = inputId.trim();

    if (!normalizedInputId) {
      return [];
    }

    const normalizedBinding = normalizeBindingValue(rawBinding);

    if (!normalizedBinding) {
      return [];
    }

    return [[normalizedInputId, normalizedBinding] as const];
  });

  if (normalizedEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(normalizedEntries) satisfies WidgetInstanceBindings;
}

export function collectDashboardWidgetEntries(
  widgets: DashboardWidgetInstance[],
  options?: {
    hiddenInCollapsedRow?: boolean;
    parentRowId?: string;
  },
): FlattenedDashboardWidgetEntry[] {
  const hiddenInCollapsedRow = options?.hiddenInCollapsedRow ?? false;
  const parentRowId = options?.parentRowId;

  return widgets.flatMap((instance) => {
    const ownEntry: FlattenedDashboardWidgetEntry = {
      instance,
      hiddenInCollapsedRow,
      parentRowId,
    };

    if (!instance.row?.children?.length) {
      return [ownEntry];
    }

    return [
      ownEntry,
      ...collectDashboardWidgetEntries(instance.row.children, {
        hiddenInCollapsedRow: true,
        parentRowId: instance.id,
      }),
    ];
  });
}

export function createDashboardWidgetEntryIndex(
  entries: FlattenedDashboardWidgetEntry[],
): ReadonlyMap<string, DashboardWidgetInstance> {
  return new Map(entries.map(({ instance }) => [instance.id, instance] as const));
}

function toBindingArray(value: WidgetPortBindingValue | undefined): WidgetPortBinding[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function getOutputDefinition(
  io: WidgetIoDefinition | undefined,
  outputId: string,
): WidgetOutputPortDefinition<Record<string, unknown>> | undefined {
  return io?.outputs?.find((output) => output.id === outputId) as
    | WidgetOutputPortDefinition<Record<string, unknown>>
    | undefined;
}

function getInputDefinition(
  io: WidgetIoDefinition | undefined,
  inputId: string,
): WidgetInputPortDefinition<Record<string, unknown>> | undefined {
  return io?.inputs?.find((input) => input.id === inputId) as
    | WidgetInputPortDefinition<Record<string, unknown>>
    | undefined;
}

function resolveWidgetIoForInstance(
  definition: WidgetDefinition | undefined,
  instance: DashboardWidgetInstance,
): WidgetIoDefinition | undefined {
  if (!definition) {
    return undefined;
  }

  return (
    definition.resolveIo?.({
      widgetId: instance.widgetId,
      instanceId: instance.id,
      props: (instance.props ?? {}) as Record<string, unknown>,
      runtimeState: instance.runtimeState,
    }) ?? definition.io
  );
}

export function resolveWidgetGraphConnection(
  connectionLike: WidgetGraphConnectionLike,
  instanceIndex: ReadonlyMap<string, DashboardWidgetInstance>,
  getWidgetDefinition: (widgetId: string) => WidgetDefinition | undefined,
  resolveWidgetIo?: (instanceId: string) => WidgetIoDefinition | undefined,
): ResolvedWidgetGraphConnection | null {
  const sourceHandle = parseWidgetGraphHandleId(connectionLike.sourceHandle);
  const targetHandle = parseWidgetGraphHandleId(connectionLike.targetHandle);
  const sourceId = connectionLike.source?.trim();
  const targetId = connectionLike.target?.trim();

  if (!sourceHandle || !targetHandle || !sourceId || !targetId) {
    return null;
  }

  let normalized: NormalizedWidgetGraphConnection | null = null;

  if (sourceHandle.kind === "output" && targetHandle.kind === "input") {
    normalized = {
      sourceWidgetId: sourceId,
      sourceOutputId: sourceHandle.portId,
      targetWidgetId: targetId,
      targetInputId: targetHandle.portId,
    };
  } else if (sourceHandle.kind === "input" && targetHandle.kind === "output") {
    normalized = {
      sourceWidgetId: targetId,
      sourceOutputId: targetHandle.portId,
      targetWidgetId: sourceId,
      targetInputId: sourceHandle.portId,
    };
  }

  if (!normalized || normalized.sourceWidgetId === normalized.targetWidgetId) {
    return null;
  }

  const sourceInstance = instanceIndex.get(normalized.sourceWidgetId);
  const targetInstance = instanceIndex.get(normalized.targetWidgetId);

  if (!sourceInstance || !targetInstance) {
    return null;
  }

  const sourceDefinition = getWidgetDefinition(sourceInstance.widgetId);
  const targetDefinition = getWidgetDefinition(targetInstance.widgetId);

  if (!sourceDefinition || !targetDefinition) {
    return null;
  }

  const sourceOutput = getOutputDefinition(
    resolveWidgetIo?.(sourceInstance.id) ?? sourceDefinition.io,
    normalized.sourceOutputId,
  );
  const targetInput = getInputDefinition(
    resolveWidgetIo?.(targetInstance.id) ?? targetDefinition.io,
    normalized.targetInputId,
  );

  if (!sourceOutput || !targetInput) {
    return null;
  }

  if (!targetInput.accepts.includes(sourceOutput.contract)) {
    return null;
  }

  return {
    connection: normalized,
    sourceInstance,
    targetInstance,
    sourceDefinition,
    targetDefinition,
    sourceOutput,
    targetInput,
  };
}

export function addWidgetGraphConnectionToBindings(
  bindings: WidgetInstanceBindings | null | undefined,
  targetInput: WidgetInputPortDefinition<Record<string, unknown>>,
  connection: NormalizedWidgetGraphConnection,
): WidgetInstanceBindings | undefined {
  const nextBinding: WidgetPortBinding = {
    sourceWidgetId: connection.sourceWidgetId,
    sourceOutputId: connection.sourceOutputId,
  };
  const normalizedBindings = normalizeWidgetInstanceBindings(bindings) ?? {};
  const currentBindings = toBindingArray(normalizedBindings[connection.targetInputId]).filter(
    (binding) =>
      !(
        binding.sourceWidgetId === nextBinding.sourceWidgetId &&
        binding.sourceOutputId === nextBinding.sourceOutputId
      ),
  );

  const nextInputBindings =
    targetInput.cardinality === "many"
      ? [...currentBindings, nextBinding]
      : [nextBinding];

  return normalizeWidgetInstanceBindings({
    ...normalizedBindings,
    [connection.targetInputId]:
      targetInput.cardinality === "many" ? nextInputBindings : nextInputBindings[0],
  });
}

export function removeWidgetGraphConnectionFromBindings(
  bindings: WidgetInstanceBindings | null | undefined,
  connection: NormalizedWidgetGraphConnection,
): WidgetInstanceBindings | undefined {
  const normalizedBindings = normalizeWidgetInstanceBindings(bindings);

  if (!normalizedBindings) {
    return undefined;
  }

  const remainingBindings = toBindingArray(normalizedBindings[connection.targetInputId]).filter(
    (binding) =>
      !(
        binding.sourceWidgetId === connection.sourceWidgetId &&
        binding.sourceOutputId === connection.sourceOutputId
      ),
  );

  const nextBindings = { ...normalizedBindings };

  if (remainingBindings.length === 0) {
    delete nextBindings[connection.targetInputId];
  } else {
    nextBindings[connection.targetInputId] =
      remainingBindings.length === 1 ? remainingBindings[0] : remainingBindings;
  }

  return normalizeWidgetInstanceBindings(nextBindings);
}

function resolveSingleInput(
  instance: DashboardWidgetInstance,
  input: WidgetInputPortDefinition<Record<string, unknown>>,
  bindings: WidgetPortBinding[],
  index: ReadonlyMap<string, DashboardWidgetInstance>,
  getWidgetDefinition: (widgetId: string) => WidgetDefinition | undefined,
  resolveIo: (instanceId: string) => WidgetIoDefinition | undefined,
): ResolvedWidgetInput | ResolvedWidgetInput[] {
  if (bindings.length === 0) {
    return {
      inputId: input.id,
      label: input.label,
      status: "unbound",
      effects: input.effects ?? [],
    } satisfies ResolvedWidgetInput;
  }

  const resolvedValues = bindings.map((binding) => {
    if (binding.sourceWidgetId === instance.id) {
      return {
        inputId: input.id,
        label: input.label,
        sourceWidgetId: binding.sourceWidgetId,
        sourceOutputId: binding.sourceOutputId,
        binding,
        status: "self-reference-blocked",
        effects: input.effects ?? [],
      } satisfies ResolvedWidgetInput;
    }

    const sourceInstance = index.get(binding.sourceWidgetId);

    if (!sourceInstance) {
      return {
        inputId: input.id,
        label: input.label,
        sourceWidgetId: binding.sourceWidgetId,
        sourceOutputId: binding.sourceOutputId,
        binding,
        status: "missing-source",
        effects: input.effects ?? [],
      } satisfies ResolvedWidgetInput;
    }

    const sourceOutput = getOutputDefinition(resolveIo(sourceInstance.id), binding.sourceOutputId);

    if (!sourceOutput) {
      return {
        inputId: input.id,
        label: input.label,
        sourceWidgetId: binding.sourceWidgetId,
        sourceOutputId: binding.sourceOutputId,
        binding,
        status: "missing-output",
        effects: input.effects ?? [],
      } satisfies ResolvedWidgetInput;
    }

    if (!input.accepts.includes(sourceOutput.contract)) {
      return {
        inputId: input.id,
        label: input.label,
        sourceWidgetId: binding.sourceWidgetId,
        sourceOutputId: binding.sourceOutputId,
        contractId: sourceOutput.contract,
        binding,
        status: "contract-mismatch",
        effects: input.effects ?? [],
      } satisfies ResolvedWidgetInput;
    }

    const value = sourceOutput.resolveValue?.({
      widgetId: sourceInstance.widgetId,
      instanceId: sourceInstance.id,
      props: (sourceInstance.props ?? {}) as Record<string, unknown>,
      runtimeState: sourceInstance.runtimeState,
    });

    return {
      inputId: input.id,
      label: input.label,
      sourceWidgetId: binding.sourceWidgetId,
      sourceOutputId: binding.sourceOutputId,
      contractId: sourceOutput.contract,
      binding,
      value,
      status: "valid",
      effects: input.effects ?? [],
    } satisfies ResolvedWidgetInput;
  });

  return bindings.length === 1 && input.cardinality !== "many"
    ? resolvedValues[0]!
    : resolvedValues;
}

function buildGraph(
  entries: FlattenedDashboardWidgetEntry[],
  resolveIo: (instanceId: string) => WidgetIoDefinition | undefined,
  resolveInputs: (instanceId: string) => ResolvedWidgetInputs | undefined,
  getWidgetDefinition: (widgetId: string) => WidgetDefinition | undefined,
): DashboardWidgetDependencyGraph {
  const nodes = entries.map(({ instance, hiddenInCollapsedRow, parentRowId }) => {
    const definition = getWidgetDefinition(instance.widgetId);
    const io = resolveIo(instance.id);

    return {
      id: instance.id,
      widgetId: instance.widgetId,
      title: instance.title ?? definition?.title ?? instance.widgetId,
      placementMode: instance.presentation?.placementMode,
      hiddenInCollapsedRow,
      parentRowId,
      inputs: (io?.inputs ?? []).map((input) => ({
        id: input.id,
        label: input.label,
        accepts: [...input.accepts],
      })),
      outputs: (io?.outputs ?? []).map((output) => ({
        id: output.id,
        label: output.label,
        contract: output.contract,
      })),
    } satisfies DashboardWidgetDependencyGraphNode;
  });

  const edges = entries.flatMap(({ instance }) => {
    const resolvedInputs = resolveInputs(instance.id);

    if (!resolvedInputs) {
      return [];
    }

    return Object.values(resolvedInputs).flatMap((resolved) => {
      const values = Array.isArray(resolved) ? resolved : resolved ? [resolved] : [];

      return values.flatMap((entry) => {
        if (!entry.sourceWidgetId || !entry.sourceOutputId) {
          return [];
        }

        return [{
          id: `${entry.sourceWidgetId}:${entry.sourceOutputId}->${instance.id}:${entry.inputId}`,
          from: entry.sourceWidgetId,
          fromPort: entry.sourceOutputId,
          to: instance.id,
          toPort: entry.inputId,
          contract: entry.contractId ?? null,
          source: "binding",
          status: entry.status,
          effects: entry.effects ?? [],
        } satisfies DashboardWidgetDependencyGraphEdge];
      });
    });
  });

  return { nodes, edges };
}

export function createDashboardWidgetDependencyModel(
  widgets: DashboardWidgetInstance[],
  resolveWidgetDefinition: (widgetId: string) => WidgetDefinition | undefined,
): DashboardWidgetDependencyModel {
  const entries = collectDashboardWidgetEntries(widgets);
  const instanceIndex = createDashboardWidgetEntryIndex(entries);
  const definitionCache = new Map<string, WidgetDefinition | undefined>();
  const ioCache = new Map<string, WidgetIoDefinition | undefined>();

  const getWidgetDefinition = (widgetId: string) => {
    if (definitionCache.has(widgetId)) {
      return definitionCache.get(widgetId);
    }

    const resolved = resolveWidgetDefinition(widgetId);
    definitionCache.set(widgetId, resolved);
    return resolved;
  };

  const resolveIo = (instanceId: string) => {
    if (ioCache.has(instanceId)) {
      return ioCache.get(instanceId);
    }

    const instance = instanceIndex.get(instanceId);

    if (!instance) {
      ioCache.set(instanceId, undefined);
      return undefined;
    }

    const resolved = resolveWidgetIoForInstance(
      getWidgetDefinition(instance.widgetId),
      instance,
    );

    ioCache.set(instanceId, resolved);
    return resolved;
  };

  const resolvedInputCache = new Map<string, ResolvedWidgetInputs | undefined>();

  const resolveInputs = (instanceId: string) => {
    if (resolvedInputCache.has(instanceId)) {
      return resolvedInputCache.get(instanceId);
    }

    const instance = instanceIndex.get(instanceId);

    if (!instance) {
      resolvedInputCache.set(instanceId, undefined);
      return undefined;
    }

    const inputs =
      (resolveIo(instanceId)?.inputs ?? []) as WidgetInputPortDefinition<Record<string, unknown>>[];

    if (inputs.length === 0) {
      resolvedInputCache.set(instanceId, undefined);
      return undefined;
    }

    const effectiveBindings = normalizeWidgetInstanceBindings(instance.bindings) ?? {};
    const resolvedInputs = Object.fromEntries(
      inputs.map((input) => [
        input.id,
        resolveSingleInput(
          instance,
          input,
          toBindingArray(effectiveBindings[input.id]),
          instanceIndex,
          getWidgetDefinition,
          resolveIo,
        ),
      ]),
    ) satisfies ResolvedWidgetInputs;

    resolvedInputCache.set(instanceId, resolvedInputs);
    return resolvedInputs;
  };

  const graph = buildGraph(entries, resolveIo, resolveInputs, getWidgetDefinition);

  return {
    entries,
    graph,
    getWidgetDefinition,
    resolveIo,
    resolveInputs,
  };
}
