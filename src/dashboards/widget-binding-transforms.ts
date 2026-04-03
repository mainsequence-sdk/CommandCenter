import type {
  WidgetContractId,
  WidgetPortBinding,
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
  const baseDescriptor =
    coerceTabularFrameValueDescriptorContract(
      source.valueDescriptor ?? inferWidgetValueDescriptor(source.value, source.contractId),
    ) ?? inferWidgetValueDescriptor(source.value, source.contractId);
  const transformId = binding?.transformId?.trim();

  if (!transformId || transformId === "identity") {
    return {
      status: "valid",
      value: source.value,
      contractId:
        resolveTabularFrameDescriptorContract(baseDescriptor) ?? baseDescriptor.contract,
      valueDescriptor: baseDescriptor,
    };
  }

  if (transformId === "extract-path") {
    const path = binding?.transformPath ?? [];

    if (path.length === 0) {
      return {
        status: "transform-invalid",
        value: source.value,
        contractId: source.contractId,
        valueDescriptor: baseDescriptor,
      };
    }

    const nestedValue = getWidgetValueAtPath(source.value, path);
    const nestedDescriptor =
      coerceTabularFrameValueDescriptorContract(
        getWidgetValueDescriptorAtPath(baseDescriptor, path) ??
        inferWidgetValueDescriptor(nestedValue),
      ) ?? inferWidgetValueDescriptor(nestedValue);

    if (nestedValue === undefined) {
      return {
        status: "transform-invalid",
        value: source.value,
        contractId: source.contractId,
        valueDescriptor: baseDescriptor,
      };
    }

    return {
      status: "valid",
      value: nestedValue,
      contractId:
        binding?.transformContractId ??
        resolveTabularFrameDescriptorContract(nestedDescriptor) ??
        nestedDescriptor.contract,
      valueDescriptor: nestedDescriptor,
    };
  }

  return {
    status: "transform-invalid",
    value: source.value,
    contractId: source.contractId,
    valueDescriptor: baseDescriptor,
  };
}
