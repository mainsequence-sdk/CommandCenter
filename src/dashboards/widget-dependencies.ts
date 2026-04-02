import type { DashboardWidgetInstance } from "@/dashboards/types";
import type {
  ResolvedWidgetInput,
  ResolvedWidgetInputs,
  WidgetDefinition,
  WidgetInputEffect,
  WidgetInputPortDefinition,
  WidgetInstanceBindings,
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
  resolveInputs: (instanceId: string) => ResolvedWidgetInputs | undefined;
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

function toBindingArray(value: WidgetPortBindingValue | undefined): WidgetPortBinding[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function getOutputDefinition(
  definition: WidgetDefinition | undefined,
  outputId: string,
): WidgetOutputPortDefinition<Record<string, unknown>> | undefined {
  return definition?.io?.outputs?.find((output) => output.id === outputId) as
    | WidgetOutputPortDefinition<Record<string, unknown>>
    | undefined;
}

function resolveSingleInput(
  instance: DashboardWidgetInstance,
  input: WidgetInputPortDefinition<Record<string, unknown>>,
  bindings: WidgetPortBinding[],
  index: ReadonlyMap<string, DashboardWidgetInstance>,
  getWidgetDefinition: (widgetId: string) => WidgetDefinition | undefined,
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

    const sourceDefinition = getWidgetDefinition(sourceInstance.widgetId);
    const sourceOutput = getOutputDefinition(sourceDefinition, binding.sourceOutputId);

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
  resolveInputs: (instanceId: string) => ResolvedWidgetInputs | undefined,
  getWidgetDefinition: (widgetId: string) => WidgetDefinition | undefined,
): DashboardWidgetDependencyGraph {
  const nodes = entries.map(({ instance, hiddenInCollapsedRow, parentRowId }) => {
    const definition = getWidgetDefinition(instance.widgetId);

    return {
      id: instance.id,
      widgetId: instance.widgetId,
      title: instance.title ?? definition?.title ?? instance.widgetId,
      placementMode: instance.presentation?.placementMode,
      hiddenInCollapsedRow,
      parentRowId,
      inputs: (definition?.io?.inputs ?? []).map((input) => ({
        id: input.id,
        label: input.label,
        accepts: [...input.accepts],
      })),
      outputs: (definition?.io?.outputs ?? []).map((output) => ({
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
  const instanceIndex = new Map(entries.map((entry) => [entry.instance.id, entry.instance] as const));
  const definitionCache = new Map<string, WidgetDefinition | undefined>();

  const getWidgetDefinition = (widgetId: string) => {
    if (definitionCache.has(widgetId)) {
      return definitionCache.get(widgetId);
    }

    const resolved = resolveWidgetDefinition(widgetId);
    definitionCache.set(widgetId, resolved);
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

    const definition = getWidgetDefinition(instance.widgetId);
    const inputs =
      (definition?.io?.inputs ?? []) as WidgetInputPortDefinition<Record<string, unknown>>[];

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
        ),
      ]),
    ) satisfies ResolvedWidgetInputs;

    resolvedInputCache.set(instanceId, resolvedInputs);
    return resolvedInputs;
  };

  const graph = buildGraph(entries, resolveInputs, getWidgetDefinition);

  return {
    entries,
    graph,
    getWidgetDefinition,
    resolveInputs,
  };
}
