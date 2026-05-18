import type { DashboardWidgetDependencyModel } from "@/dashboards/widget-dependencies";
import {
  WIDGET_REFERENCE_PROPS_OUTPUT_ID,
  WIDGET_REFERENCE_RUNTIME_STATE_OUTPUT_ID,
  WIDGET_REFERENCE_TITLE_INPUT_ID,
  WIDGET_REFERENCE_TITLE_OUTPUT_ID,
  buildWidgetReferencePropInputId,
} from "@/dashboards/widget-instance-references";
import type { DashboardWidgetInstance } from "@/dashboards/types";
import type {
  WidgetBindingTransformStep,
  WidgetContractId,
  WidgetIoDefinition,
  WidgetPortBinding,
  WidgetOutputPortDefinition,
  WidgetValueDescriptor,
} from "@/widgets/types";
import {
  CORE_VALUE_JSON_CONTRACT,
  CORE_VALUE_STRING_CONTRACT,
} from "@/widgets/shared/value-contracts";

export interface ParsedWidgetReferenceExpression {
  raw: string;
  widgetToken: string;
  root: string;
  accessors: WidgetReferenceExpressionAccessor[];
}

export type WidgetReferenceExpressionAccessor =
  | {
      kind: "path";
      segment: string;
    }
  | {
      kind: "array-item";
      mode: "first" | "last" | "index";
      index?: number;
    };

export interface WidgetReferenceLanguageSourceWidget {
  id: string;
  title?: string;
  widgetId: string;
  widgetTypeTitle?: string;
  outputs: Array<{
    id: string;
    label?: string;
    contract?: WidgetContractId;
    description?: string;
    valueDescriptor?: WidgetValueDescriptor;
  }>;
}

export type WidgetReferenceCompletionKind = "widget" | "source" | "field";

export interface WidgetReferenceCompletionOption {
  id: string;
  label: string;
  detail?: string;
  description?: string;
  insertText: string;
  kind: WidgetReferenceCompletionKind;
}

export interface WidgetReferenceCompletionContext {
  kind: WidgetReferenceCompletionKind;
  replacementStart: number;
  replacementEnd: number;
  query: string;
  options: WidgetReferenceCompletionOption[];
}

export interface WidgetReferenceDisplayToken {
  expression: string;
  widgetId: string;
  widgetLabel: string;
  sourceLabel: string;
  pathLabel?: string;
  label: string;
  detail: string;
}

export interface CompiledWidgetReferenceExpression {
  sourceWidgetId: string;
  sourceOutputId: string;
  transformSteps?: WidgetBindingTransformStep[];
}

export interface DerivedWidgetReferenceBindingTarget {
  expression: string;
  inputId: string;
  binding: WidgetPortBinding;
}

export interface DerivedWidgetReferenceBindings {
  errors: string[];
  managedInputIds: string[];
  targets: DerivedWidgetReferenceBindingTarget[];
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeWidgetReferenceToken(value: string) {
  return value.trim().toLowerCase();
}

function normalizeWidgetReferenceExpressionRoot(root: string) {
  switch (normalizeWidgetReferenceToken(root)) {
    case "title":
      return WIDGET_REFERENCE_TITLE_OUTPUT_ID;
    case "props":
    case "properties":
      return WIDGET_REFERENCE_PROPS_OUTPUT_ID;
    case "runtimestate":
    case "runtime-state":
    case "runtime_state":
    case "state":
      return WIDGET_REFERENCE_RUNTIME_STATE_OUTPUT_ID;
    default:
      return null;
  }
}

function publicWidgetReferenceRoot(outputId: string) {
  switch (outputId) {
    case WIDGET_REFERENCE_TITLE_OUTPUT_ID:
      return "title";
    case WIDGET_REFERENCE_PROPS_OUTPUT_ID:
      return "props";
    case WIDGET_REFERENCE_RUNTIME_STATE_OUTPUT_ID:
      return "runtimeState";
    default:
      return outputId;
  }
}

function defaultRootDescriptor(root: string): WidgetValueDescriptor | undefined {
  switch (normalizeWidgetReferenceToken(root)) {
    case "title":
      return {
        kind: "primitive",
        primitive: "string",
        contract: CORE_VALUE_STRING_CONTRACT,
      };
    case "props":
    case "runtimestate":
      return {
        kind: "object",
        contract: CORE_VALUE_JSON_CONTRACT,
        fields: [],
      };
    default:
      return undefined;
  }
}

function parseArrayAccessorToken(
  token: string,
): Extract<WidgetReferenceExpressionAccessor, { kind: "array-item" }> | null {
  const normalized = token.trim();

  if (normalized === "first" || normalized === "last") {
    return {
      kind: "array-item",
      mode: normalized,
    };
  }

  if (/^\d+$/.test(normalized)) {
    return {
      kind: "array-item",
      mode: "index",
      index: Number(normalized),
    };
  }

  return null;
}

function parseAccessors(raw: string): WidgetReferenceExpressionAccessor[] | null {
  const accessors: WidgetReferenceExpressionAccessor[] = [];
  let current = "";
  let index = 0;

  while (index < raw.length) {
    const character = raw[index];

    if (character === ".") {
      if (current.trim().length === 0) {
        const previousAccessor = accessors.at(-1);

        if (previousAccessor?.kind === "array-item") {
          index += 1;
          continue;
        }

        return null;
      }

      accessors.push({
        kind: "path",
        segment: current.trim(),
      });
      current = "";
      index += 1;
      continue;
    }

    if (character === "[") {
      if (current.trim().length > 0) {
        accessors.push({
          kind: "path",
          segment: current.trim(),
        });
        current = "";
      }

      const closeIndex = raw.indexOf("]", index + 1);

      if (closeIndex === -1) {
        return null;
      }

      const accessor = parseArrayAccessorToken(raw.slice(index + 1, closeIndex));

      if (!accessor) {
        return null;
      }

      accessors.push(accessor);
      index = closeIndex + 1;
      continue;
    }

    current += character;
    index += 1;
  }

  if (current.trim().length > 0) {
    accessors.push({
      kind: "path",
      segment: current.trim(),
    });
  }

  return accessors.length > 0 ? accessors : null;
}

export function parseWidgetReferenceExpression(
  value: string,
): ParsedWidgetReferenceExpression | null {
  const trimmed = value.trim();

  if (!trimmed.startsWith("$(")) {
    return null;
  }

  const closeIndex = trimmed.indexOf(")");

  if (closeIndex <= 2) {
    return null;
  }

  const widgetToken = trimmed.slice(2, closeIndex).trim();

  if (!widgetToken) {
    return null;
  }

  const remainder = trimmed.slice(closeIndex + 1);

  if (!remainder.startsWith(".")) {
    return null;
  }

  const accessors = parseAccessors(remainder.slice(1));

  if (!accessors || accessors[0]?.kind !== "path") {
    return null;
  }

  return {
    raw: trimmed,
    widgetToken,
    root: accessors[0].segment,
    accessors: accessors.slice(1),
  };
}

export function isWidgetReferenceExpression(value: string) {
  return parseWidgetReferenceExpression(value) !== null;
}

export function isWidgetReferenceExpressionValue(value: unknown) {
  if (typeof value === "string") {
    return isWidgetReferenceExpression(value);
  }

  return Array.isArray(value) && value.length === 1 && typeof value[0] === "string"
    ? isWidgetReferenceExpression(value[0])
    : false;
}

function buildTransformSteps(accessors: WidgetReferenceExpressionAccessor[]) {
  const steps: WidgetBindingTransformStep[] = [];
  let bufferedPath: string[] = [];

  const flushBufferedPath = () => {
    if (bufferedPath.length === 0) {
      return;
    }

    steps.push({
      id: "extract-path",
      path: [...bufferedPath],
    });
    bufferedPath = [];
  };

  accessors.forEach((accessor) => {
    if (accessor.kind === "path") {
      bufferedPath.push(accessor.segment);
      return;
    }

    flushBufferedPath();
    steps.push({
      id: "select-array-item",
      mode: accessor.mode,
      index: accessor.mode === "index" ? accessor.index : undefined,
    });
  });

  flushBufferedPath();

  return steps.length > 0 ? steps : undefined;
}

function resolveWidgetReferenceExpressionSourceWidget(
  widgetToken: string,
  sourceWidgets: WidgetReferenceLanguageSourceWidget[],
) {
  const normalizedWidgetToken = normalizeWidgetReferenceToken(widgetToken);
  const byId = sourceWidgets.find((entry) =>
    normalizeWidgetReferenceToken(entry.id) === normalizedWidgetToken,
  );

  if (byId) {
    return {
      ok: true as const,
      widget: byId,
    };
  }

  const titleMatches = sourceWidgets.filter((entry) =>
    entry.title && normalizeWidgetReferenceToken(entry.title) === normalizedWidgetToken,
  );

  if (titleMatches.length === 1) {
    return {
      ok: true as const,
      widget: titleMatches[0]!,
    };
  }

  if (titleMatches.length > 1) {
    return {
      ok: false as const,
      error: `Widget reference "${widgetToken}" is ambiguous. Use the widget instance id instead of the shared title.`,
    };
  }

  return {
    ok: false as const,
    error: `Widget reference "${widgetToken}" does not match any widget instance id or unique widget title in this workspace.`,
  };
}

function resolveWidgetReferenceExpressionOutputId(
  widget: WidgetReferenceLanguageSourceWidget,
  root: string,
) {
  const platformRoot = normalizeWidgetReferenceExpressionRoot(root);

  if (platformRoot) {
    return {
      ok: true as const,
      outputId: platformRoot,
    };
  }

  const normalizedRoot = normalizeWidgetReferenceToken(root);
  const output = widget.outputs.find((entry) =>
    normalizeWidgetReferenceToken(entry.id) === normalizedRoot,
  );

  if (output) {
    return {
      ok: true as const,
      outputId: output.id,
    };
  }

  return {
    ok: false as const,
    error: `Widget "${widget.title?.trim() || widget.id}" does not expose a source named "${root}". Use one of its output ids or the built-in roots title, props, or runtimeState.`,
  };
}

function resolveWidgetReferenceRootOutput(
  widget: WidgetReferenceLanguageSourceWidget,
  root: string,
) {
  const resolvedOutput = resolveWidgetReferenceExpressionOutputId(widget, root);

  if (!resolvedOutput.ok) {
    return null;
  }

  return widget.outputs.find((output) => output.id === resolvedOutput.outputId) ?? null;
}

function resolveWidgetReferenceRootDescriptor(
  widget: WidgetReferenceLanguageSourceWidget,
  root: string,
) {
  const output = resolveWidgetReferenceRootOutput(widget, root);

  return output?.valueDescriptor ?? defaultRootDescriptor(root);
}

function formatWidgetReferenceAccessor(accessor: WidgetReferenceExpressionAccessor) {
  if (accessor.kind === "array-item") {
    if (accessor.mode === "index") {
      return `[${accessor.index ?? 0}]`;
    }

    return `[${accessor.mode}]`;
  }

  return accessor.segment;
}

function formatWidgetReferencePath(accessors: WidgetReferenceExpressionAccessor[]) {
  let path = "";

  accessors.forEach((accessor) => {
    const segment = formatWidgetReferenceAccessor(accessor);

    if (accessor.kind === "array-item") {
      path += segment;
      return;
    }

    path += path ? `.${segment}` : segment;
  });

  return path || undefined;
}

export function resolveWidgetReferenceDisplayToken(input: {
  sourceWidgets: WidgetReferenceLanguageSourceWidget[];
  value: unknown;
}): WidgetReferenceDisplayToken | null {
  const expression = typeof input.value === "string"
    ? input.value
    : Array.isArray(input.value) && input.value.length === 1 && typeof input.value[0] === "string"
      ? input.value[0]
      : null;

  if (!expression) {
    return null;
  }

  const parsed = parseWidgetReferenceExpression(expression);

  if (!parsed || parsed.raw !== expression.trim()) {
    return null;
  }

  const sourceWidget = resolveWidgetReferenceExpressionSourceWidget(
    parsed.widgetToken,
    input.sourceWidgets,
  );

  if (!sourceWidget.ok) {
    return null;
  }

  const sourceOutput = resolveWidgetReferenceExpressionOutputId(sourceWidget.widget, parsed.root);

  if (!sourceOutput.ok) {
    return null;
  }

  const canonicalAccessors = canonicalizeWidgetReferenceAccessors({
    descriptor: resolveWidgetReferenceRootDescriptor(sourceWidget.widget, parsed.root),
    accessors: parsed.accessors,
  });
  const output = resolveWidgetReferenceRootOutput(sourceWidget.widget, parsed.root);
  const root = publicWidgetReferenceRoot(sourceOutput.outputId);
  const widgetLabel = sourceWidget.widget.title?.trim() || sourceWidget.widget.id;
  const sourceLabel = output?.label?.trim() || root;
  const pathLabel = formatWidgetReferencePath(canonicalAccessors);
  const label = pathLabel ? `${widgetLabel} · ${sourceLabel}.${pathLabel}` : `${widgetLabel} · ${sourceLabel}`;

  return {
    expression: parsed.raw,
    widgetId: sourceWidget.widget.id,
    widgetLabel,
    sourceLabel,
    pathLabel,
    label,
    detail: sourceWidget.widget.id,
  };
}

function widgetReferenceRootCompletionOptions(widget: WidgetReferenceLanguageSourceWidget) {
  const byRoot = new Map<string, WidgetReferenceCompletionOption>();

  widget.outputs.forEach((output) => {
    const root = publicWidgetReferenceRoot(output.id);
    const descriptor = output.valueDescriptor ?? defaultRootDescriptor(root);

    byRoot.set(root, {
      id: root,
      label: output.label?.trim() || root,
      detail: output.contract ?? descriptor?.contract,
      description: output.description ?? descriptor?.description,
      insertText: root,
      kind: "source",
    });
  });

  [
    {
      root: "title",
      label: "Widget title",
      detail: CORE_VALUE_STRING_CONTRACT,
    },
    {
      root: "props",
      label: "Widget props",
      detail: CORE_VALUE_JSON_CONTRACT,
    },
    {
      root: "runtimeState",
      label: "Runtime state",
      detail: CORE_VALUE_JSON_CONTRACT,
    },
  ].forEach((entry) => {
    if (!byRoot.has(entry.root)) {
      byRoot.set(entry.root, {
        id: entry.root,
        label: entry.label,
        detail: entry.detail,
        insertText: entry.root,
        kind: "source",
      });
    }
  });

  return [...byRoot.values()].sort((left, right) =>
    left.insertText.localeCompare(right.insertText),
  );
}

function descriptorFieldOptions(
  descriptor: WidgetValueDescriptor | undefined,
): WidgetReferenceCompletionOption[] {
  if (!descriptor || descriptor.kind !== "object") {
    return [];
  }

  return descriptor.fields.map((field) => ({
    id: field.key,
    label: field.label || field.key,
    detail: field.value.contract,
    description: field.description ?? field.value.description,
    insertText: field.key,
    kind: "field",
  }));
}

function resolveDescriptorField(
  descriptor: WidgetValueDescriptor | undefined,
  segment: string,
) {
  if (!descriptor || descriptor.kind !== "object") {
    return undefined;
  }

  const normalizedSegment = normalizeWidgetReferenceToken(segment);
  return descriptor.fields.find((field) =>
    normalizeWidgetReferenceToken(field.key) === normalizedSegment,
  );
}

function descriptorAtAccessors(
  descriptor: WidgetValueDescriptor | undefined,
  accessors: WidgetReferenceExpressionAccessor[],
) {
  let current = descriptor;

  for (const accessor of accessors) {
    if (!current) {
      return undefined;
    }

    if (accessor.kind === "array-item") {
      if (current.kind !== "array") {
        return undefined;
      }

      current = current.items;
      continue;
    }

    if (current.kind !== "object") {
      return undefined;
    }

    current = resolveDescriptorField(current, accessor.segment)?.value;
  }

  return current;
}

function canonicalizeWidgetReferenceAccessors(input: {
  descriptor: WidgetValueDescriptor | undefined;
  accessors: WidgetReferenceExpressionAccessor[];
}) {
  let current = input.descriptor;

  return input.accessors.map((accessor) => {
    if (accessor.kind === "array-item") {
      current = current?.kind === "array" ? current.items : undefined;
      return accessor;
    }

    const field = resolveDescriptorField(current, accessor.segment);
    current = field?.value;

    return field
      ? {
          kind: "path" as const,
          segment: field.key,
        }
      : accessor;
  });
}

function filterCompletionOptions(
  options: WidgetReferenceCompletionOption[],
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return options;
  }

  return options.filter((option) =>
    [option.id, option.label, option.detail ?? ""].some((candidate) =>
      candidate.toLowerCase().includes(normalizedQuery),
    ),
  );
}

function parsePartialWidgetReferenceBody(body: string) {
  if (!body) {
    return {
      root: "",
      completedAccessors: [] as WidgetReferenceExpressionAccessor[],
      query: "",
      sourceMode: true,
    };
  }

  const segments = body.split(".");

  if (segments.length === 1) {
    return {
      root: "",
      completedAccessors: [] as WidgetReferenceExpressionAccessor[],
      query: segments[0] ?? "",
      sourceMode: true,
    };
  }

  const root = segments[0] ?? "";
  const query = segments.at(-1) ?? "";
  const completed = segments.slice(1, -1).join(".");
  const completedAccessors = completed ? parseAccessors(completed) : [];

  return {
    root,
    completedAccessors,
    query,
    sourceMode: false,
  };
}

export function resolveWidgetReferenceCompletionContext(input: {
  sourceWidgets: WidgetReferenceLanguageSourceWidget[];
  value: string;
  selectionStart?: number | null;
}): WidgetReferenceCompletionContext | null {
  const cursor = input.selectionStart ?? input.value.length;
  const prefix = input.value.slice(0, cursor);
  const triggerStart = prefix.lastIndexOf("$(");

  if (triggerStart === -1) {
    return null;
  }

  const closeIndex = prefix.indexOf(")", triggerStart + 2);

  if (closeIndex === -1) {
    const query = prefix.slice(triggerStart + 2);

    if (query.includes("\n")) {
      return null;
    }

    const options = input.sourceWidgets.map((widget) => ({
      id: widget.id,
      label: widget.title?.trim() || widget.id,
      detail: `${widget.widgetTypeTitle?.trim() || widget.widgetId} - ${widget.id}`,
      insertText: `$(${widget.id})`,
      kind: "widget" as const,
    }));

    return {
      kind: "widget",
      replacementStart: triggerStart,
      replacementEnd: cursor,
      query,
      options: filterCompletionOptions(options, query),
    };
  }

  if (prefix[closeIndex + 1] !== ".") {
    return null;
  }

  const widgetToken = prefix.slice(triggerStart + 2, closeIndex).trim();
  const resolvedWidget = resolveWidgetReferenceExpressionSourceWidget(
    widgetToken,
    input.sourceWidgets,
  );

  if (!resolvedWidget.ok) {
    return null;
  }

  const bodyStart = closeIndex + 2;
  const body = prefix.slice(bodyStart);
  const parsedBody = parsePartialWidgetReferenceBody(body);
  const replacementStart = cursor - parsedBody.query.length;

  if (parsedBody.sourceMode) {
    const options = widgetReferenceRootCompletionOptions(resolvedWidget.widget);

    return {
      kind: "source",
      replacementStart,
      replacementEnd: cursor,
      query: parsedBody.query,
      options: filterCompletionOptions(options, parsedBody.query),
    };
  }

  if (!parsedBody.root || !parsedBody.completedAccessors) {
    return null;
  }

  const rootDescriptor = resolveWidgetReferenceRootDescriptor(
    resolvedWidget.widget,
    parsedBody.root,
  );
  const descriptor = descriptorAtAccessors(rootDescriptor, parsedBody.completedAccessors);
  const options = descriptorFieldOptions(descriptor);

  return {
    kind: "field",
    replacementStart,
    replacementEnd: cursor,
    query: parsedBody.query,
    options: filterCompletionOptions(options, parsedBody.query),
  };
}

export function compileWidgetReferenceExpression(
  expression: string,
  sourceWidgets: WidgetReferenceLanguageSourceWidget[],
): { ok: true; compiled: CompiledWidgetReferenceExpression } | { ok: false; error: string } {
  const parsed = parseWidgetReferenceExpression(expression);

  if (!parsed) {
    return {
      ok: false,
      error: `Reference expression "${expression}" is invalid. Use $(widget-identifier).source.path.`,
    };
  }

  const sourceWidget = resolveWidgetReferenceExpressionSourceWidget(
    parsed.widgetToken,
    sourceWidgets,
  );

  if (!sourceWidget.ok) {
    return sourceWidget;
  }

  const sourceOutput = resolveWidgetReferenceExpressionOutputId(sourceWidget.widget, parsed.root);

  if (!sourceOutput.ok) {
    return sourceOutput;
  }

  const canonicalAccessors = canonicalizeWidgetReferenceAccessors({
    descriptor: resolveWidgetReferenceRootDescriptor(sourceWidget.widget, parsed.root),
    accessors: parsed.accessors,
  });

  return {
    ok: true,
    compiled: {
      sourceWidgetId: sourceWidget.widget.id,
      sourceOutputId: sourceOutput.outputId,
      transformSteps: buildTransformSteps(canonicalAccessors),
    },
  };
}

function walkReferenceExpressionProps(
  value: unknown,
  path: string[],
  targets: DerivedWidgetReferenceBindingTarget[],
  errors: string[],
  sourceWidgets: WidgetReferenceLanguageSourceWidget[],
) {
  if (typeof value === "string") {
    const parsed = parseWidgetReferenceExpression(value);

    if (!parsed) {
      return;
    }

    const compiled = compileWidgetReferenceExpression(value, sourceWidgets);

    if (!compiled.ok) {
      errors.push(`${path.join(".")}: ${compiled.error}`);
      return;
    }

    targets.push({
      expression: parsed.raw,
      inputId: buildWidgetReferencePropInputId(path),
      binding: {
        sourceWidgetId: compiled.compiled.sourceWidgetId,
        sourceOutputId: compiled.compiled.sourceOutputId,
        transformSteps: compiled.compiled.transformSteps,
      },
    });
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 1 && typeof value[0] === "string") {
      const parsed = parseWidgetReferenceExpression(value[0]);

      if (!parsed) {
        return;
      }

      const compiled = compileWidgetReferenceExpression(value[0], sourceWidgets);

      if (!compiled.ok) {
        errors.push(`${path.join(".")}: ${compiled.error}`);
        return;
      }

      targets.push({
        expression: parsed.raw,
        inputId: buildWidgetReferencePropInputId(path),
        binding: {
          sourceWidgetId: compiled.compiled.sourceWidgetId,
          sourceOutputId: compiled.compiled.sourceOutputId,
          transformSteps: compiled.compiled.transformSteps,
        },
      });
    }

    return;
  }

  if (!isPlainRecord(value)) {
    return;
  }

  Object.entries(value).forEach(([key, entryValue]) => {
    walkReferenceExpressionProps(
      entryValue,
      [...path, key],
      targets,
      errors,
      sourceWidgets,
    );
  });
}

export function deriveWidgetReferenceExpressionBindings(input: {
  props?: Record<string, unknown>;
  sourceWidgets: WidgetReferenceLanguageSourceWidget[];
  title?: string;
}) {
  const targets: DerivedWidgetReferenceBindingTarget[] = [];
  const errors: string[] = [];

  if (typeof input.title === "string") {
    const parsed = parseWidgetReferenceExpression(input.title);

    if (parsed) {
      const compiled = compileWidgetReferenceExpression(input.title, input.sourceWidgets);

      if (!compiled.ok) {
        errors.push(`title: ${compiled.error}`);
      } else {
        targets.push({
          expression: parsed.raw,
          inputId: WIDGET_REFERENCE_TITLE_INPUT_ID,
          binding: {
            sourceWidgetId: compiled.compiled.sourceWidgetId,
            sourceOutputId: compiled.compiled.sourceOutputId,
            transformSteps: compiled.compiled.transformSteps,
          },
        });
      }
    }
  }

  if (isPlainRecord(input.props)) {
    walkReferenceExpressionProps(
      input.props,
      [],
      targets,
      errors,
      input.sourceWidgets,
    );
  }

  return {
    errors,
    managedInputIds: targets.map((target) => target.inputId),
    targets,
  } satisfies DerivedWidgetReferenceBindings;
}

export function syncWidgetReferenceExpressionBindings(input: {
  bindings?: Record<string, unknown>;
  managedInputIds: string[];
  nextExpressions: DerivedWidgetReferenceBindings;
}) {
  const nextBindings = isPlainRecord(input.bindings)
    ? cloneJson(input.bindings)
    : {};

  input.managedInputIds.forEach((inputId) => {
    delete nextBindings[inputId];
  });

  input.nextExpressions.targets.forEach((target) => {
    nextBindings[target.inputId] = target.binding;
  });

  return Object.keys(nextBindings).length > 0 ? nextBindings : undefined;
}

function resolveSourceWidgetOutputs(
  instance: DashboardWidgetInstance,
  io: WidgetIoDefinition | undefined,
  resolvedOutputs?: ReturnType<DashboardWidgetDependencyModel["resolveOutputs"]>,
) {
  return (io?.outputs ?? []).map((output: WidgetOutputPortDefinition<Record<string, unknown>>) => {
    const resolvedOutput = resolvedOutputs?.[output.id];

    return {
      id: output.id,
      label: output.label,
      contract: output.contract,
      description: output.description,
      valueDescriptor: resolvedOutput?.valueDescriptor ?? output.valueDescriptor,
    };
  });
}

export function buildWidgetReferenceLanguageSourceWidgets(
  model: DashboardWidgetDependencyModel | null | undefined,
  options?: {
    excludeInstanceId?: string;
  },
) {
  if (!model) {
    return [] satisfies WidgetReferenceLanguageSourceWidget[];
  }

  return model.entries.flatMap(({ instance }) => {
    if (instance.id === options?.excludeInstanceId) {
      return [];
    }

    const io = model.resolveIo(instance.id);
    const outputs = resolveSourceWidgetOutputs(instance, io, model.resolveOutputs(instance.id));

    if (outputs.length === 0) {
      return [];
    }

    const widgetTypeTitle = model.getWidgetDefinition(instance.widgetId)?.title?.trim();

    return [{
      id: instance.id,
      title: instance.title?.trim() || undefined,
      widgetId: instance.widgetId,
      ...(widgetTypeTitle ? { widgetTypeTitle } : {}),
      outputs,
    } satisfies WidgetReferenceLanguageSourceWidget];
  });
}
