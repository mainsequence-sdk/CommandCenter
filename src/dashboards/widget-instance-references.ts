import {
  getWidgetValueAtPath,
  inferWidgetValueDescriptor,
  listWidgetValueDescriptorPaths,
} from "@/dashboards/widget-binding-transforms";
import type { DashboardWidgetInstance } from "@/dashboards/types";
import type {
  ResolvedWidgetInput,
  ResolvedWidgetInputs,
  WidgetContractId,
  WidgetInputPortDefinition,
  WidgetInstanceBindings,
  WidgetIoDefinition,
  WidgetOutputPortDefinition,
} from "@/widgets/types";
import {
  CORE_VALUE_BOOLEAN_CONTRACT,
  CORE_VALUE_INTEGER_CONTRACT,
  CORE_VALUE_JSON_CONTRACT,
  CORE_VALUE_NUMBER_CONTRACT,
  CORE_VALUE_SCALAR_CONTRACTS,
  CORE_VALUE_STRING_CONTRACT,
} from "@/widgets/shared/value-contracts";

const WIDGET_REFERENCE_SOURCE_PREFIX = "__widget-reference.source.";
const WIDGET_REFERENCE_TARGET_PREFIX = "__widget-reference.target.";
const WIDGET_REFERENCE_PROP_INPUT_PREFIX = `${WIDGET_REFERENCE_TARGET_PREFIX}prop:`;

export const WIDGET_REFERENCE_TITLE_OUTPUT_ID = `${WIDGET_REFERENCE_SOURCE_PREFIX}title`;
export const WIDGET_REFERENCE_PROPS_OUTPUT_ID = `${WIDGET_REFERENCE_SOURCE_PREFIX}props`;
export const WIDGET_REFERENCE_RUNTIME_STATE_OUTPUT_ID = `${WIDGET_REFERENCE_SOURCE_PREFIX}runtime-state`;

export const WIDGET_REFERENCE_TITLE_INPUT_ID = `${WIDGET_REFERENCE_TARGET_PREFIX}title`;

export function isWidgetReferenceSourceOutputId(outputId: string) {
  return outputId.startsWith(WIDGET_REFERENCE_SOURCE_PREFIX);
}

export function isWidgetReferenceTargetInputId(inputId: string) {
  return inputId.startsWith(WIDGET_REFERENCE_TARGET_PREFIX);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function isWidgetReferenceTitleLiteral(value: unknown) {
  return typeof value === "string" &&
    /^\$\([^)]+\)\.[A-Za-z0-9_$-]+(?:\.[A-Za-z0-9_$-]+|\[(?:first|last|\d+)\])*$/.test(
      value.trim(),
    );
}

function encodeReferencePath(path: string[]) {
  return encodeURIComponent(path.join("/"));
}

function decodeReferencePath(value: string): string[] | null {
  try {
    const decoded = decodeURIComponent(value);
    const normalized = decoded
      .split("/")
      .flatMap((segment) => (segment.trim() ? [segment.trim()] : []));

    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

export function buildWidgetReferencePropInputId(path: string[]) {
  return `${WIDGET_REFERENCE_PROP_INPUT_PREFIX}${encodeReferencePath(path)}`;
}

export function parseWidgetReferencePropInputPath(inputId: string): string[] | null {
  if (!inputId.startsWith(WIDGET_REFERENCE_PROP_INPUT_PREFIX)) {
    return null;
  }

  return decodeReferencePath(inputId.slice(WIDGET_REFERENCE_PROP_INPUT_PREFIX.length));
}

function resolveFirstValidResolvedInput(
  value: ResolvedWidgetInput | ResolvedWidgetInput[] | undefined,
) {
  const entries = !value ? [] : Array.isArray(value) ? value : [value];
  return entries.find((entry) => entry.status === "valid");
}

function setWidgetValueAtPath(
  target: Record<string, unknown>,
  path: string[],
  value: unknown,
) {
  if (path.length === 0) {
    return;
  }

  let current: Record<string, unknown> = target;

  for (const segment of path.slice(0, -1)) {
    const nextValue = current[segment];

    if (!isPlainRecord(nextValue)) {
      current[segment] = {};
    }

    current = current[segment] as Record<string, unknown>;
  }

  current[path[path.length - 1]!] = cloneJson(value);
}

function listBoundReferencePropPaths(
  bindings: WidgetInstanceBindings | undefined,
) {
  if (!bindings) {
    return [];
  }

  return Object.keys(bindings).flatMap((inputId) => {
    const path = parseWidgetReferencePropInputPath(inputId);
    return path ? [path] : [];
  });
}

function buildWidgetReferencePropInput(
  path: string[],
  sampleValue: unknown,
) {
  const descriptor =
    sampleValue === undefined
      ? undefined
      : inferWidgetValueDescriptor(sampleValue);
  const contractId = descriptor?.contract ?? CORE_VALUE_JSON_CONTRACT;
  const pathLabel = path.join(".");

  return {
    id: buildWidgetReferencePropInputId(path),
    label: `Setting: ${pathLabel}`,
    accepts: resolveWidgetReferenceAcceptedContracts(descriptor),
    description: `Reference-backed override for saved setting path \`${pathLabel}\`.`,
    effects: [{
      kind: "drives-value",
      sourcePath: "$",
      target: {
        kind: "prop",
        path: pathLabel,
      },
      description: `Overrides saved setting path \`${pathLabel}\` from an upstream widget binding.`,
    }],
  } satisfies WidgetInputPortDefinition<Record<string, unknown>>;
}

function resolveWidgetReferenceAcceptedContracts(
  descriptor:
    | ReturnType<typeof inferWidgetValueDescriptor>
    | undefined,
): WidgetContractId[] {
  if (!descriptor) {
    return [CORE_VALUE_JSON_CONTRACT];
  }

  if (descriptor.kind === "primitive") {
    if (descriptor.primitive === "string") {
      return [...CORE_VALUE_SCALAR_CONTRACTS];
    }

    if (descriptor.primitive === "number" || descriptor.primitive === "integer") {
      return [
        CORE_VALUE_NUMBER_CONTRACT,
        CORE_VALUE_INTEGER_CONTRACT,
        CORE_VALUE_STRING_CONTRACT,
      ];
    }

    if (descriptor.primitive === "boolean") {
      return [
        CORE_VALUE_BOOLEAN_CONTRACT,
        CORE_VALUE_STRING_CONTRACT,
      ];
    }

    return [descriptor.contract];
  }

  if (descriptor.kind === "array") {
    const itemDescriptor = descriptor.items;
    const itemContracts: WidgetContractId[] =
      itemDescriptor?.kind === "primitive"
        ? resolveWidgetReferenceAcceptedContracts(itemDescriptor)
        : itemDescriptor
          ? [itemDescriptor.contract]
          : [];

    return [...new Set([contractIdForDescriptor(descriptor), ...itemContracts])];
  }

  return [contractIdForDescriptor(descriptor)];
}

function contractIdForDescriptor(
  descriptor: ReturnType<typeof inferWidgetValueDescriptor>,
) {
  return descriptor.contract ?? CORE_VALUE_JSON_CONTRACT;
}

function coercePrimitiveReferenceValue(
  targetDescriptor: ReturnType<typeof inferWidgetValueDescriptor>,
  value: unknown,
): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (targetDescriptor.kind !== "primitive") {
    return value;
  }

  if (targetDescriptor.primitive === "string") {
    if (value === null || typeof value === "string") {
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    return value;
  }

  if (targetDescriptor.primitive === "number" || targetDescriptor.primitive === "integer") {
    if (typeof value === "number" && Number.isFinite(value)) {
      return targetDescriptor.primitive === "integer" ? Math.trunc(value) : value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return targetDescriptor.primitive === "integer" ? Math.trunc(parsed) : parsed;
      }
    }

    return value;
  }

  if (targetDescriptor.primitive === "boolean") {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      if (value === "true" || value === "1") {
        return true;
      }

      if (value === "false" || value === "0") {
        return false;
      }
    }
  }

  return value;
}

function coerceReferenceValueToDescriptor(
  descriptor: ReturnType<typeof inferWidgetValueDescriptor> | undefined,
  value: unknown,
): unknown {
  if (!descriptor || value === undefined) {
    return value;
  }

  if (descriptor.kind === "primitive") {
    return coercePrimitiveReferenceValue(descriptor, value);
  }

  if (descriptor.kind === "array") {
    const itemDescriptor = descriptor.items;

    if (Array.isArray(value)) {
      if (!itemDescriptor) {
        return value;
      }

      return value.map((entry) => coerceReferenceValueToDescriptor(itemDescriptor, entry));
    }

    return [itemDescriptor ? coerceReferenceValueToDescriptor(itemDescriptor, value) : value];
  }

  return value;
}

export function appendWidgetInstanceReferenceIo(
  io: WidgetIoDefinition<Record<string, unknown>> | undefined,
  input: {
    bindings?: WidgetInstanceBindings;
    props?: Record<string, unknown>;
  },
) {
  const baseProps = isPlainRecord(input.props) ? input.props : {};
  const propsDescriptor = inferWidgetValueDescriptor(baseProps, CORE_VALUE_JSON_CONTRACT);
  const discoveredPropPaths = listWidgetValueDescriptorPaths(propsDescriptor).map(
    (option) => option.path,
  );
  const persistedPropPaths = listBoundReferencePropPaths(input.bindings);
  const propPathMap = new Map<string, string[]>();

  [...discoveredPropPaths, ...persistedPropPaths].forEach((path) => {
    propPathMap.set(path.join("."), path);
  });

  const platformInputs = [
    {
      id: WIDGET_REFERENCE_TITLE_INPUT_ID,
      label: "Display title",
      accepts: [...CORE_VALUE_SCALAR_CONTRACTS],
      description: "Reference-backed override for the widget instance title.",
    } satisfies WidgetInputPortDefinition<Record<string, unknown>>,
    ...[...propPathMap.values()]
      .sort((left, right) => {
        if (left.length !== right.length) {
          return left.length - right.length;
        }

        return left.join(".").localeCompare(right.join("."));
      })
      .map((path) =>
        buildWidgetReferencePropInput(path, getWidgetValueAtPath(baseProps, path)),
      ),
  ];

  const platformOutputs = [
    {
      id: WIDGET_REFERENCE_TITLE_OUTPUT_ID,
      label: "Widget title",
      contract: CORE_VALUE_STRING_CONTRACT,
      description: "Current widget instance title before shell fallback.",
      resolveValue: ({ instanceTitle }) => instanceTitle,
    } satisfies WidgetOutputPortDefinition<Record<string, unknown>>,
    {
      id: WIDGET_REFERENCE_PROPS_OUTPUT_ID,
      label: "Widget props",
      contract: CORE_VALUE_JSON_CONTRACT,
      description: "Current saved widget props, including any resolved reference-backed overrides.",
      resolveValue: ({ props }) => props,
    } satisfies WidgetOutputPortDefinition<Record<string, unknown>>,
    {
      id: WIDGET_REFERENCE_RUNTIME_STATE_OUTPUT_ID,
      label: "Runtime state",
      contract: CORE_VALUE_JSON_CONTRACT,
      description: "Current widget runtime state owned by this widget instance.",
      resolveValue: ({ runtimeState }) => runtimeState,
    } satisfies WidgetOutputPortDefinition<Record<string, unknown>>,
  ];

  return {
    ...io,
    inputs: [...(io?.inputs ?? []), ...platformInputs],
    outputs: [...(io?.outputs ?? []), ...platformOutputs],
  } satisfies WidgetIoDefinition<Record<string, unknown>>;
}

export function resolveReferenceBackedWidgetState(input: {
  instanceTitle?: string;
  props?: Record<string, unknown>;
  resolvedInputs?: ResolvedWidgetInputs;
}) {
  const nextProps = cloneJson(
    isPlainRecord(input.props) ? input.props : {},
  ) as Record<string, unknown>;
  let nextTitle = isWidgetReferenceTitleLiteral(input.instanceTitle)
    ? undefined
    : input.instanceTitle;
  const titleInput = resolveFirstValidResolvedInput(
    input.resolvedInputs?.[WIDGET_REFERENCE_TITLE_INPUT_ID],
  );

  if (titleInput && typeof titleInput.value === "string") {
    nextTitle = titleInput.value;
  } else if (
    titleInput &&
    (typeof titleInput.value === "number" || typeof titleInput.value === "boolean")
  ) {
    nextTitle = String(titleInput.value);
  }

  Object.entries(input.resolvedInputs ?? {})
    .flatMap(([inputId, resolvedValue]) => {
      const path = parseWidgetReferencePropInputPath(inputId);
      const resolvedInput = resolveFirstValidResolvedInput(resolvedValue);

      if (!path || !resolvedInput) {
        return [];
      }

      return [{
        path,
        value: resolvedInput.value,
      }];
    })
    .sort((left, right) => {
      if (left.path.length !== right.path.length) {
        return left.path.length - right.path.length;
      }

      return left.path.join(".").localeCompare(right.path.join("."));
    })
    .forEach(({ path, value }) => {
      const nextValue = coerceReferenceValueToDescriptor(
        inferWidgetValueDescriptor(getWidgetValueAtPath(nextProps, path)),
        value,
      );
      setWidgetValueAtPath(nextProps, path, nextValue);
    });

  return {
    title: nextTitle,
    props: nextProps,
  };
}

export function resolveWidgetReferenceBaseProps(
  instance: Pick<DashboardWidgetInstance, "props">,
  defaultProps?: Record<string, unknown>,
) {
  if (isPlainRecord(instance.props)) {
    return instance.props;
  }

  if (isPlainRecord(defaultProps)) {
    return defaultProps;
  }

  return {};
}
