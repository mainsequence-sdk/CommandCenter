import type { DashboardWidgetInstance } from "@/dashboards/types";
import {
  applyWidgetBindingTransform,
} from "@/dashboards/widget-binding-transforms";
import type {
  DashboardWidgetDependencyModel,
  ResolvedWidgetOutput,
} from "@/dashboards/widget-dependencies";
import type {
  WorkspaceVariableReferenceConsumer,
  WorkspaceVariableReferenceEntry,
} from "@/dashboards/widget-variable-registry";

const DEFAULT_PREVIEW_MAX_LENGTH = 220;
const DEFAULT_DETAIL_MAX_LENGTH = 4_000;

export type WorkspaceVariableExplorerStatus = "ready" | "waiting" | "stale" | "error";

export interface WorkspaceVariableValuePreview {
  kind: "scalar" | "array" | "object" | "null" | "ref" | "unavailable";
  text: string;
  detailText?: string;
  truncated: boolean;
}

export interface WorkspaceVariableExplorerConsumer {
  targetWidgetId: string;
  targetWidgetTitle: string;
  targetInputId: string;
  targetKind: WorkspaceVariableReferenceConsumer["targetKind"];
  propPath?: string[];
}

export interface WorkspaceVariableExplorerEntry {
  id: string;
  normalizedId: string;
  referenceToken: string;
  sourceWidgetId: string;
  sourceWidgetTitle: string;
  sourceOutputId: string;
  transformSignature: string;
  sourceContract?: string;
  sourceOutputLabel?: string;
  status: WorkspaceVariableExplorerStatus;
  statusLabel: string;
  valuePreview: WorkspaceVariableValuePreview;
  consumers: WorkspaceVariableExplorerConsumer[];
}

export interface WorkspaceVariableExplorerModel {
  currentVariables: WorkspaceVariableExplorerEntry[];
  referencedVariables: WorkspaceVariableExplorerEntry[];
  totalConsumers: number;
}

export interface BuildWorkspaceVariableExplorerModelInput {
  dependencyModel: DashboardWidgetDependencyModel | null | undefined;
  widgets: DashboardWidgetInstance[];
}

export function serializeWorkspaceVariableValuePreview(
  value: unknown,
  options?: {
    maxLength?: number;
    detailMaxLength?: number;
  },
): WorkspaceVariableValuePreview {
  const maxLength = options?.maxLength ?? DEFAULT_PREVIEW_MAX_LENGTH;
  const detailMaxLength = options?.detailMaxLength ?? DEFAULT_DETAIL_MAX_LENGTH;

  if (value === undefined) {
    return {
      kind: "unavailable",
      text: "Unavailable",
      truncated: false,
    };
  }

  if (value === null) {
    return {
      kind: "null",
      text: "No current value (null)",
      truncated: false,
    };
  }

  if (typeof value === "string") {
    return truncatePreview(value, maxLength, "scalar");
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return {
      kind: "scalar",
      text: String(value),
      truncated: false,
    };
  }

  const kind = Array.isArray(value) ? "array" : "object";
  let detailText: string;

  try {
    detailText = JSON.stringify(value, null, 2);
  } catch {
    detailText = String(value);
  }

  const compactText = detailText.replace(/\s+/g, " ").trim();
  const preview = truncateText(compactText, maxLength);
  const detail = truncateText(detailText, detailMaxLength);

  return {
    kind,
    text: preview.text,
    detailText: detail.text,
    truncated: preview.truncated || detail.truncated,
  };
}

export function buildWorkspaceVariableExplorerModel({
  dependencyModel,
  widgets,
}: BuildWorkspaceVariableExplorerModelInput): WorkspaceVariableExplorerModel {
  if (!dependencyModel) {
    return {
      currentVariables: [],
      referencedVariables: [],
      totalConsumers: 0,
    };
  }

  const widgetById = new Map(widgets.map((widget) => [widget.id, widget]));
  const currentVariables: WorkspaceVariableExplorerEntry[] = [];
  const referencedVariables: WorkspaceVariableExplorerEntry[] = [];
  let totalConsumers = 0;

  dependencyModel.variableRegistry.entries.forEach((entry) => {
    const output = dependencyModel.resolveOutputs(entry.key.sourceWidgetId)?.[
      entry.key.sourceOutputId
    ];
    const explorerEntry = buildExplorerEntry({
      dependencyModel,
      entry,
      output,
      widgetById,
    });

    totalConsumers += explorerEntry.consumers.length;

    if (explorerEntry.status === "ready") {
      currentVariables.push(explorerEntry);
    } else {
      referencedVariables.push(explorerEntry);
    }
  });

  return {
    currentVariables,
    referencedVariables,
    totalConsumers,
  };
}

export function filterWorkspaceVariableExplorerEntries(
  entries: WorkspaceVariableExplorerEntry[],
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return entries;
  }

  return entries.filter((entry) =>
    [
      entry.normalizedId,
      entry.referenceToken,
      entry.sourceWidgetId,
      entry.sourceWidgetTitle,
      entry.sourceOutputId,
      entry.transformSignature,
      entry.sourceContract,
      entry.valuePreview.text,
      ...entry.consumers.flatMap((consumer) => [
        consumer.targetWidgetId,
        consumer.targetWidgetTitle,
        consumer.targetInputId,
        consumer.propPath?.join("."),
      ]),
    ]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .some((value) => value.toLowerCase().includes(normalizedQuery)),
  );
}

function buildExplorerEntry(input: {
  dependencyModel: DashboardWidgetDependencyModel;
  entry: WorkspaceVariableReferenceEntry;
  output: ResolvedWidgetOutput | undefined;
  widgetById: ReadonlyMap<string, DashboardWidgetInstance>;
}): WorkspaceVariableExplorerEntry {
  const sourceWidget = input.widgetById.get(input.entry.key.sourceWidgetId);
  const sourceWidgetTitle = resolveWidgetTitle(
    input.dependencyModel,
    sourceWidget,
    input.entry.key.sourceWidgetId,
  );
  const consumers = input.entry.consumers.map((consumer) => {
    const targetWidget = input.widgetById.get(consumer.targetWidgetId);

    return {
      targetWidgetId: consumer.targetWidgetId,
      targetWidgetTitle: resolveWidgetTitle(
        input.dependencyModel,
        targetWidget,
        consumer.targetWidgetId,
      ),
      targetInputId: consumer.targetInputId,
      targetKind: consumer.targetKind,
      propPath: consumer.propPath,
    } satisfies WorkspaceVariableExplorerConsumer;
  });
  const transformedOutput = resolveExplorerOutputValue(input.entry, input.output);
  const valuePreview = transformedOutput.output?.valueRef
    ? {
        kind: "ref" as const,
        text: `Runtime data ref: ${transformedOutput.output.valueRef.refId}`,
        truncated: false,
      }
    : transformedOutput.status === "error"
      ? {
          kind: "unavailable" as const,
          text: "Transform could not be applied.",
          truncated: false,
        }
      : serializeWorkspaceVariableValuePreview(transformedOutput.output?.value);

  return {
    id: input.entry.id,
    normalizedId: input.entry.id,
    referenceToken: buildReferenceToken(input.entry),
    sourceWidgetId: input.entry.key.sourceWidgetId,
    sourceWidgetTitle,
    sourceOutputId: input.entry.key.sourceOutputId,
    transformSignature: input.entry.key.transformSignature,
    sourceContract: transformedOutput.output?.contractId,
    sourceOutputLabel: transformedOutput.output?.label,
    status: transformedOutput.status,
    statusLabel: transformedOutput.statusLabel,
    valuePreview,
    consumers,
  };
}

function resolveExplorerOutputValue(
  entry: WorkspaceVariableReferenceEntry,
  output: ResolvedWidgetOutput | undefined,
): {
  output: ResolvedWidgetOutput | undefined;
  status: WorkspaceVariableExplorerStatus;
  statusLabel: string;
} {
  if (!output) {
    return {
      output,
      status: "waiting",
      statusLabel: "Waiting",
    };
  }

  const representativeBinding = entry.consumers[0]?.binding;

  if (!representativeBinding || output.valueRef) {
    return {
      output,
      status: isMaterializedOutput(output) ? "ready" : "waiting",
      statusLabel: isMaterializedOutput(output) ? "Ready" : "Waiting",
    };
  }

  const transformed = applyWidgetBindingTransform(representativeBinding, {
    contractId: output.contractId,
    value: output.value,
    valueDescriptor: output.valueDescriptor,
  });

  if (transformed.status !== "valid") {
    return {
      output,
      status: "error",
      statusLabel: "Invalid transform",
    };
  }

  const transformedOutput = {
    ...output,
    contractId: transformed.contractId,
    value: transformed.value,
    valueDescriptor: transformed.valueDescriptor,
  } satisfies ResolvedWidgetOutput;

  return {
    output: transformedOutput,
    status: isMaterializedOutput(transformedOutput) ? "ready" : "waiting",
    statusLabel: isMaterializedOutput(transformedOutput) ? "Ready" : "Waiting",
  };
}

function isMaterializedOutput(output: ResolvedWidgetOutput | undefined) {
  if (!output) {
    return false;
  }

  if (output.valueRef) {
    return true;
  }

  return output.value !== undefined && output.value !== null;
}

function resolveWidgetTitle(
  dependencyModel: DashboardWidgetDependencyModel,
  widget: DashboardWidgetInstance | undefined,
  fallbackId: string,
) {
  const instanceTitle = widget?.title?.trim();

  if (instanceTitle) {
    return instanceTitle;
  }

  if (widget) {
    return dependencyModel.getWidgetDefinition(widget.widgetId)?.title ?? fallbackId;
  }

  return fallbackId;
}

function buildReferenceToken(entry: WorkspaceVariableReferenceEntry) {
  const baseToken = `$(${entry.key.sourceWidgetId}).${entry.key.sourceOutputId}`;
  const transformSignature = entry.key.transformSignature;

  if (!transformSignature || transformSignature === "identity") {
    return baseToken;
  }

  if (transformSignature.startsWith("extract-path:")) {
    const path = transformSignature.slice("extract-path:".length).trim();

    if (path && path !== "pending") {
      return `${baseToken}.${path}`;
    }
  }

  return baseToken;
}

function truncatePreview(
  value: string,
  maxLength: number,
  kind: WorkspaceVariableValuePreview["kind"],
): WorkspaceVariableValuePreview {
  const preview = truncateText(value, maxLength);

  return {
    kind,
    text: preview.text,
    detailText: preview.truncated ? value : undefined,
    truncated: preview.truncated,
  };
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return {
      text: value,
      truncated: false,
    };
  }

  return {
    text: `${value.slice(0, Math.max(0, maxLength - 1))}…`,
    truncated: true,
  };
}
