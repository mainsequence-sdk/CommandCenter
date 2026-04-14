import {
  CORE_VALUE_JSON_CONTRACT,
  CORE_VALUE_STRING_CONTRACT,
} from "@/widgets/shared/value-contracts";
import type {
  WidgetAgentContextValue,
  WidgetAgentSnapshotContext,
  WidgetDefinition,
  WidgetIoDefinition,
  WidgetOutputPortDefinition,
  WidgetValueDescriptor,
} from "@/widgets/types";

export const CORE_WIDGET_AGENT_CONTEXT_CONTRACT = "core.widget-agent-context@v1" as const;
export const WIDGET_AGENT_CONTEXT_OUTPUT_ID = "agent-context";
export const WIDGET_AGENT_CONTEXT_OUTPUT_LABEL = "Agent context";
export const WIDGET_AGENT_CONTEXT_SNAPSHOT_PROFILE = "evidence" as const;

const WIDGET_AGENT_SNAPSHOT_VALUE_DESCRIPTOR: WidgetValueDescriptor = {
  kind: "object",
  contract: CORE_VALUE_JSON_CONTRACT,
  description: "Compact live snapshot describing what this widget is currently showing.",
  fields: [
    {
      key: "displayKind",
      label: "Display kind",
      required: true,
      value: {
        kind: "primitive",
        contract: CORE_VALUE_STRING_CONTRACT,
        primitive: "string",
      },
    },
    {
      key: "state",
      label: "State",
      required: true,
      value: {
        kind: "primitive",
        contract: CORE_VALUE_STRING_CONTRACT,
        primitive: "string",
      },
    },
    {
      key: "summary",
      label: "Summary",
      required: true,
      value: {
        kind: "primitive",
        contract: CORE_VALUE_STRING_CONTRACT,
        primitive: "string",
      },
    },
    {
      key: "data",
      label: "Data",
      value: {
        kind: "unknown",
        contract: CORE_VALUE_JSON_CONTRACT,
        description: "Structured snapshot payload published by the widget for agent reasoning.",
      },
    },
  ],
};

export const WIDGET_AGENT_CONTEXT_VALUE_DESCRIPTOR: WidgetValueDescriptor = {
  kind: "object",
  contract: CORE_WIDGET_AGENT_CONTEXT_CONTRACT,
  description:
    "Agent-facing context derived from the widget's live snapshot and intended for upstream reasoning workflows.",
  fields: [
    {
      key: "contractVersion",
      label: "Contract version",
      required: true,
      value: {
        kind: "primitive",
        contract: CORE_VALUE_STRING_CONTRACT,
        primitive: "string",
      },
    },
    {
      key: "widgetId",
      label: "Widget id",
      required: true,
      value: {
        kind: "primitive",
        contract: CORE_VALUE_STRING_CONTRACT,
        primitive: "string",
      },
    },
    {
      key: "instanceId",
      label: "Instance id",
      required: true,
      value: {
        kind: "primitive",
        contract: CORE_VALUE_STRING_CONTRACT,
        primitive: "string",
      },
    },
    {
      key: "title",
      label: "Title",
      required: true,
      value: {
        kind: "primitive",
        contract: CORE_VALUE_STRING_CONTRACT,
        primitive: "string",
      },
    },
    {
      key: "snapshot",
      label: "Snapshot",
      required: true,
      value: WIDGET_AGENT_SNAPSHOT_VALUE_DESCRIPTOR,
    },
  ],
};

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

export function widgetSupportsAgentContext<TProps extends Record<string, unknown>>(
  widget: WidgetDefinition<TProps>,
) {
  return typeof widget.buildAgentSnapshot === "function";
}

export function buildWidgetAgentContextValue<TProps extends Record<string, unknown>>(
  widget: WidgetDefinition<TProps>,
  context: WidgetAgentSnapshotContext<TProps>,
): WidgetAgentContextValue | undefined {
  if (!widget.buildAgentSnapshot || !context.instanceId) {
    return undefined;
  }

  const snapshot = widget.buildAgentSnapshot({
    ...context,
    snapshotProfile: WIDGET_AGENT_CONTEXT_SNAPSHOT_PROFILE,
  });

  if (isPromiseLike(snapshot)) {
    if (import.meta.env.DEV) {
      console.warn(
        `[widgets] Synthetic agent-context output currently requires synchronous buildAgentSnapshot() for ${widget.id}.`,
      );
    }
    return undefined;
  }

  return {
    contractVersion: "v1",
    widgetId: context.widgetId,
    instanceId: context.instanceId,
    title: context.title,
    snapshot,
  };
}

export function appendWidgetAgentContextOutput<TProps extends Record<string, unknown>>(
  widget: WidgetDefinition<TProps>,
  io: WidgetIoDefinition<TProps> | undefined,
): WidgetIoDefinition<TProps> | undefined {
  if (!widgetSupportsAgentContext(widget)) {
    return io;
  }

  const existingOutputs = io?.outputs ?? [];

  if (existingOutputs.some((output) => output.id === WIDGET_AGENT_CONTEXT_OUTPUT_ID)) {
    return io;
  }

  const agentContextOutput: WidgetOutputPortDefinition<TProps> = {
    id: WIDGET_AGENT_CONTEXT_OUTPUT_ID,
    label: WIDGET_AGENT_CONTEXT_OUTPUT_LABEL,
    contract: CORE_WIDGET_AGENT_CONTEXT_CONTRACT,
    description:
      "Compact live widget context derived from buildAgentSnapshot(...) for agent-facing reasoning and refresh workflows.",
    valueDescriptor: WIDGET_AGENT_CONTEXT_VALUE_DESCRIPTOR,
    resolveValue: (args) =>
      buildWidgetAgentContextValue(widget, {
        widgetId: args.widgetId,
        instanceId: args.instanceId ?? "",
        title: args.instanceTitle?.trim() || widget.title,
        snapshotProfile: WIDGET_AGENT_CONTEXT_SNAPSHOT_PROFILE,
        props: args.props,
        presentation: args.presentation,
        runtimeState: args.runtimeState,
        resolvedInputs: args.resolvedInputs,
      }),
  };

  return {
    ...(io ?? {}),
    ...(io?.inputs ? { inputs: io.inputs } : {}),
    outputs: [...existingOutputs, agentContextOutput],
  };
}
