import type {
  WidgetBindingTransformStep,
  WidgetContractId,
  WidgetExtractPathTransformStep,
  WidgetPortBinding,
  WidgetSelectArrayItemMode,
  WidgetValueDescriptor,
} from "@/widgets/types";
import {
  coerceTabularFrameValueDescriptorContract,
  resolveTabularFrameDescriptorContract,
} from "@/widgets/shared/tabular-frame-source";
import {
  CORE_VALUE_BOOLEAN_CONTRACT,
  CORE_VALUE_INTEGER_CONTRACT,
  CORE_VALUE_JSON_CONTRACT,
  CORE_VALUE_NUMBER_CONTRACT,
  CORE_VALUE_STRING_CONTRACT,
} from "@/widgets/shared/value-contracts";

const DEFAULT_DESCRIPTOR_MAX_DEPTH = 4;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function coerceDescriptorContract(
  descriptor: WidgetValueDescriptor | undefined,
): WidgetValueDescriptor | undefined {
  return coerceTabularFrameValueDescriptorContract(descriptor) ?? descriptor;
}

function resolveSourceValueDescriptor(source: {
  contractId: WidgetContractId;
  value: unknown;
  valueDescriptor?: WidgetValueDescriptor;
}): WidgetValueDescriptor {
  const declaredDescriptor = coerceDescriptorContract(source.valueDescriptor);

  if (source.value !== undefined) {
    const rawInferredDescriptor = inferWidgetValueDescriptor(
      source.value,
      declaredDescriptor?.contract ?? source.contractId,
    );
    const inferredDescriptor =
      coerceDescriptorContract(rawInferredDescriptor) ?? rawInferredDescriptor;

    if (!declaredDescriptor || declaredDescriptor.kind === "unknown") {
      return inferredDescriptor;
    }

    if (
      declaredDescriptor.kind === "object" &&
      declaredDescriptor.fields.length === 0 &&
      inferredDescriptor?.kind === "object" &&
      inferredDescriptor.fields.length > 0
    ) {
      return inferredDescriptor;
    }

    if (
      declaredDescriptor.kind === "array" &&
      !declaredDescriptor.items &&
      inferredDescriptor?.kind === "array" &&
      inferredDescriptor.items
    ) {
      return inferredDescriptor;
    }
  }

  return declaredDescriptor ?? inferWidgetValueDescriptor(source.value, source.contractId);
}

function isValidArrayItemIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function normalizePath(path: unknown): string[] | undefined {
  if (!Array.isArray(path)) {
    return undefined;
  }

  const normalized = path.flatMap((entry) =>
    typeof entry === "string" && entry.trim() ? [entry.trim()] : [],
  );

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeArrayItemMode(value: unknown): WidgetSelectArrayItemMode | undefined {
  if (value === "first" || value === "last" || value === "index") {
    return value;
  }

  return undefined;
}

function normalizeTransformStep(
  value: unknown,
): WidgetBindingTransformStep | null {
  if (!isPlainRecord(value) || typeof value.id !== "string") {
    return null;
  }

  if (value.id === "select-array-item") {
    const mode = normalizeArrayItemMode(value.mode);
    const index = isValidArrayItemIndex(value.index) ? value.index : undefined;

    return {
      id: "select-array-item",
      mode,
      index,
    };
  }

  if (value.id === "extract-path") {
    const path = normalizePath(value.path);
    const contractId =
      typeof value.contractId === "string" && value.contractId.trim()
        ? (value.contractId.trim() as WidgetContractId)
        : undefined;

    return {
      id: "extract-path",
      path,
      contractId,
    };
  }

  return null;
}

function inferPrimitiveContract(value: unknown): WidgetContractId {
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? CORE_VALUE_INTEGER_CONTRACT
      : CORE_VALUE_NUMBER_CONTRACT;
  }

  if (typeof value === "boolean") {
    return CORE_VALUE_BOOLEAN_CONTRACT;
  }

  if (typeof value === "string") {
    return CORE_VALUE_STRING_CONTRACT;
  }

  return CORE_VALUE_JSON_CONTRACT;
}

export function inferWidgetValueDescriptor(
  value: unknown,
  fallbackContractId?: WidgetContractId,
  depth = 0,
): WidgetValueDescriptor {
  if (value === null) {
    return {
      kind: "primitive",
      contract: fallbackContractId ?? CORE_VALUE_JSON_CONTRACT,
      primitive: "null",
    };
  }

  if (typeof value === "string") {
    return {
      kind: "primitive",
      contract: fallbackContractId ?? CORE_VALUE_STRING_CONTRACT,
      primitive: "string",
    };
  }

  if (typeof value === "number") {
    const primitive = Number.isInteger(value) ? "integer" : "number";

    return {
      kind: "primitive",
      contract: fallbackContractId ?? inferPrimitiveContract(value),
      primitive,
    };
  }

  if (typeof value === "boolean") {
    return {
      kind: "primitive",
      contract: fallbackContractId ?? CORE_VALUE_BOOLEAN_CONTRACT,
      primitive: "boolean",
    };
  }

  if (Array.isArray(value)) {
    return {
      kind: "array",
      contract: fallbackContractId ?? CORE_VALUE_JSON_CONTRACT,
      items:
        depth >= DEFAULT_DESCRIPTOR_MAX_DEPTH || value.length === 0
          ? undefined
          : inferWidgetValueDescriptor(value[0], undefined, depth + 1),
    };
  }

  if (isPlainRecord(value)) {
    return {
      kind: "object",
      contract: fallbackContractId ?? CORE_VALUE_JSON_CONTRACT,
      fields:
        depth >= DEFAULT_DESCRIPTOR_MAX_DEPTH
          ? []
          : Object.entries(value).map(([key, entryValue]) => ({
              key,
              label: key,
              value: inferWidgetValueDescriptor(entryValue, undefined, depth + 1),
            })),
    };
  }

  return {
    kind: "unknown",
    contract: fallbackContractId ?? CORE_VALUE_JSON_CONTRACT,
  };
}

export function getWidgetValueAtPath(value: unknown, path: string[]): unknown {
  if (path.length === 0) {
    return value;
  }

  let currentValue = value;

  for (const segment of path) {
    if (!isPlainRecord(currentValue) || !(segment in currentValue)) {
      return undefined;
    }

    currentValue = currentValue[segment];
  }

  return currentValue;
}

export function getWidgetValueDescriptorAtPath(
  descriptor: WidgetValueDescriptor | undefined,
  path: string[],
): WidgetValueDescriptor | undefined {
  if (!descriptor) {
    return undefined;
  }

  if (path.length === 0) {
    return descriptor;
  }

  const [head, ...rest] = path;

  if (descriptor.kind !== "object") {
    return undefined;
  }

  const field = descriptor.fields.find((entry) => entry.key === head);

  if (!field) {
    return undefined;
  }

  return rest.length === 0
    ? field.value
    : getWidgetValueDescriptorAtPath(field.value, rest);
}

export function normalizeWidgetBindingTransformSteps(
  value: unknown,
): WidgetBindingTransformStep[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((entry) => normalizeTransformStep(entry))
    .filter((entry): entry is WidgetBindingTransformStep => entry !== null);

  return normalized.length > 0 ? normalized : undefined;
}

export function resolveWidgetBindingTransformSteps(
  binding:
    | Pick<
        WidgetPortBinding,
        "transformSteps" | "transformId" | "transformPath" | "transformContractId"
      >
    | undefined,
): WidgetBindingTransformStep[] {
  const normalizedSteps = normalizeWidgetBindingTransformSteps(binding?.transformSteps);

  if (normalizedSteps?.length) {
    return normalizedSteps;
  }

  const transformId = binding?.transformId?.trim();

  if (!transformId || transformId === "identity") {
    return [];
  }

  if (transformId === "extract-path") {
    return [{
      id: "extract-path",
      path: normalizePath(binding?.transformPath),
      contractId: binding?.transformContractId,
    } satisfies WidgetExtractPathTransformStep];
  }

  return [];
}

export function buildWidgetBindingTransformSignature(
  binding:
    | Pick<
        WidgetPortBinding,
        "transformSteps" | "transformId" | "transformPath" | "transformContractId"
      >
    | undefined,
): string {
  const steps = resolveWidgetBindingTransformSteps(binding);

  if (steps.length === 0) {
    const transformId = binding?.transformId?.trim();
    return !transformId || transformId === "identity" ? "identity" : transformId;
  }

  return steps
    .map((step) => {
      if (step.id === "select-array-item") {
        if (step.mode === "index") {
          return `select-array-item:index:${isValidArrayItemIndex(step.index) ? step.index : "pending"}`;
        }

        return `select-array-item:${step.mode ?? "pending"}`;
      }

      return `extract-path:${step.path?.join(".") ?? "pending"}`;
    })
    .join("|");
}

export function resolveLegacyWidgetBindingTransformFields(
  binding:
    | Pick<
        WidgetPortBinding,
        "transformSteps" | "transformId" | "transformPath" | "transformContractId"
      >
    | undefined,
): Pick<WidgetPortBinding, "transformId" | "transformPath" | "transformContractId"> {
  const steps = resolveWidgetBindingTransformSteps(binding);

  if (steps.length === 1 && steps[0]?.id === "extract-path") {
    return {
      transformId: "extract-path",
      transformPath: steps[0].path,
      transformContractId: steps[0].contractId,
    };
  }

  const transformId = binding?.transformId?.trim();

  return {
    transformId: transformId || undefined,
    transformPath: normalizePath(binding?.transformPath),
    transformContractId: binding?.transformContractId,
  };
}

function resolveArrayItemIndex(
  items: readonly unknown[],
  step: Extract<WidgetBindingTransformStep, { id: "select-array-item" }>,
) {
  if (step.mode === "first") {
    return items.length > 0 ? 0 : null;
  }

  if (step.mode === "last") {
    return items.length > 0 ? items.length - 1 : null;
  }

  if (step.mode === "index" && isValidArrayItemIndex(step.index)) {
    return step.index < items.length ? step.index : null;
  }

  return null;
}

export interface WidgetValuePathOption {
  path: string[];
  label: string;
  contractId: WidgetContractId;
  valueDescriptor: WidgetValueDescriptor;
  description?: string;
  required?: boolean;
  depth: number;
}

export function listWidgetValueDescriptorPaths(
  descriptor: WidgetValueDescriptor | undefined,
  options?: {
    path?: string[];
    labelPrefix?: string;
  },
): WidgetValuePathOption[] {
  if (!descriptor || descriptor.kind !== "object") {
    return [];
  }

  const pathPrefix = options?.path ?? [];
  const labelPrefix = options?.labelPrefix ?? "";

  return descriptor.fields.flatMap((field) => {
    const nextPath = [...pathPrefix, field.key];
    const nextLabel = labelPrefix ? `${labelPrefix} / ${field.label}` : field.label;
    const ownOption: WidgetValuePathOption = {
      path: nextPath,
      label: nextLabel,
      contractId: field.value.contract,
      valueDescriptor: field.value,
      description: field.description ?? field.value.description,
      required: field.required === true,
      depth: nextPath.length - 1,
    };

    if (field.value.kind !== "object") {
      return [ownOption];
    }

    return [
      ownOption,
      ...listWidgetValueDescriptorPaths(field.value, {
        path: nextPath,
        labelPrefix: nextLabel,
      }),
    ];
  });
}

export function applyWidgetBindingTransform(
  binding: WidgetPortBinding | undefined,
  source: {
    contractId: WidgetContractId;
    value: unknown;
    valueDescriptor?: WidgetValueDescriptor;
  },
): {
  status: "valid" | "transform-invalid";
  value: unknown;
  contractId: WidgetContractId;
  valueDescriptor?: WidgetValueDescriptor;
} {
  const baseDescriptor = resolveSourceValueDescriptor(source);
  const transformSteps = resolveWidgetBindingTransformSteps(binding);
  const transformId = binding?.transformId?.trim();

  if (transformSteps.length === 0 && (!transformId || transformId === "identity")) {
    return {
      status: "valid",
      value: source.value,
      contractId:
        resolveTabularFrameDescriptorContract(baseDescriptor) ?? baseDescriptor.contract,
      valueDescriptor: baseDescriptor,
    };
  }

  if (transformSteps.length === 0) {
    return {
      status: "transform-invalid",
      value: source.value,
      contractId: source.contractId,
      valueDescriptor: baseDescriptor,
    };
  }

  let currentValue = source.value;
  let currentDescriptor = baseDescriptor;
  let currentContractId =
    resolveTabularFrameDescriptorContract(baseDescriptor) ?? baseDescriptor.contract;

  for (const step of transformSteps) {
    if (step.id === "select-array-item") {
      if (currentDescriptor.kind !== "array") {
        return {
          status: "transform-invalid",
          value: source.value,
          contractId: source.contractId,
          valueDescriptor: baseDescriptor,
        };
      }

      const itemDescriptor =
        coerceTabularFrameValueDescriptorContract(
          currentDescriptor.items ??
          (Array.isArray(currentValue) && currentValue.length > 0
            ? inferWidgetValueDescriptor(currentValue[0])
            : undefined),
        ) ??
        currentDescriptor.items ??
        (Array.isArray(currentValue) && currentValue.length > 0
          ? inferWidgetValueDescriptor(currentValue[0])
          : undefined);

      if (currentValue === undefined) {
        if (!itemDescriptor) {
          return {
            status: "transform-invalid",
            value: source.value,
            contractId: source.contractId,
            valueDescriptor: baseDescriptor,
          };
        }

        currentValue = undefined;
        currentDescriptor = itemDescriptor;
        currentContractId =
          resolveTabularFrameDescriptorContract(itemDescriptor) ?? itemDescriptor.contract;
        continue;
      }

      if (!Array.isArray(currentValue)) {
        return {
          status: "transform-invalid",
          value: source.value,
          contractId: source.contractId,
          valueDescriptor: baseDescriptor,
        };
      }

      const selectedIndex = resolveArrayItemIndex(currentValue, step);

      if (selectedIndex === null) {
        if (!itemDescriptor) {
          return {
            status: "transform-invalid",
            value: source.value,
            contractId: source.contractId,
            valueDescriptor: baseDescriptor,
          };
        }

        currentValue = undefined;
        currentDescriptor = itemDescriptor;
        currentContractId =
          resolveTabularFrameDescriptorContract(itemDescriptor) ?? itemDescriptor.contract;
        continue;
      }

      const nestedValue = currentValue[selectedIndex];

      if (nestedValue === undefined) {
        if (!itemDescriptor) {
          return {
            status: "transform-invalid",
            value: source.value,
            contractId: source.contractId,
            valueDescriptor: baseDescriptor,
          };
        }

        currentValue = undefined;
        currentDescriptor = itemDescriptor;
        currentContractId =
          resolveTabularFrameDescriptorContract(itemDescriptor) ?? itemDescriptor.contract;
        continue;
      }

      const nestedDescriptor =
        coerceTabularFrameValueDescriptorContract(
          itemDescriptor ?? inferWidgetValueDescriptor(nestedValue),
        ) ??
        itemDescriptor ??
        inferWidgetValueDescriptor(nestedValue);

      currentValue = nestedValue;
      currentDescriptor = nestedDescriptor;
      currentContractId =
        resolveTabularFrameDescriptorContract(nestedDescriptor) ?? nestedDescriptor.contract;
      continue;
    }

    const path = step.path ?? [];

    if (path.length === 0) {
      return {
        status: "transform-invalid",
        value: source.value,
        contractId: source.contractId,
        valueDescriptor: baseDescriptor,
      };
    }

    const nestedDescriptor =
      coerceTabularFrameValueDescriptorContract(
        getWidgetValueDescriptorAtPath(currentDescriptor, path),
      ) ?? getWidgetValueDescriptorAtPath(currentDescriptor, path);
    const nestedValue =
      currentValue === undefined ? undefined : getWidgetValueAtPath(currentValue, path);

    if (!nestedDescriptor && nestedValue === undefined) {
      return {
        status: "transform-invalid",
        value: source.value,
        contractId: source.contractId,
        valueDescriptor: baseDescriptor,
      };
    }

    const resolvedNestedDescriptor =
      nestedDescriptor ??
      (nestedValue !== undefined ? inferWidgetValueDescriptor(nestedValue) : undefined);

    if (!resolvedNestedDescriptor) {
      return {
        status: "transform-invalid",
        value: source.value,
        contractId: source.contractId,
        valueDescriptor: baseDescriptor,
      };
    }

    currentValue = nestedValue;
    currentDescriptor = resolvedNestedDescriptor;
    currentContractId =
      step.contractId ??
      resolveTabularFrameDescriptorContract(resolvedNestedDescriptor) ??
      resolvedNestedDescriptor.contract;
  }

  return {
    status: "valid",
    value: currentValue,
    contractId: currentContractId,
    valueDescriptor: currentDescriptor,
  };
}
