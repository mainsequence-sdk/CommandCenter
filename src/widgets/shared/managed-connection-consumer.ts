import type { ConnectionQueryWidgetProps } from "@/widgets/core/connection-query/connectionQueryModel";
import { normalizeConnectionQueryProps } from "@/widgets/core/connection-query/connectionQueryModel";
import {
  normalizeConnectionStreamQueryProps,
  type ConnectionStreamQueryWidgetProps,
} from "@/widgets/core/connection-stream-query/connectionStreamQueryModel";
import type { WidgetInstancePresentation } from "@/widgets/types";

export type ManagedConnectionConsumerSourceMode = string;
export type ManagedConnectionEmbeddedSourceProps =
  | ConnectionQueryWidgetProps
  | ConnectionStreamQueryWidgetProps;

export interface ManagedConnectionConsumerAdapter<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  widgetId: string;
  sourceInputId: string;
  streamSourceInputId?: string;
  sourceOutputId?: string;
  streamSourceOutputId?: string;
  connectionMode: ManagedConnectionConsumerSourceMode;
  streamConnectionMode?: ManagedConnectionConsumerSourceMode;
  getSourceMode: (props: TProps) => ManagedConnectionConsumerSourceMode;
  getDetachedSourceMode?: (props: TProps) => ManagedConnectionConsumerSourceMode;
  setSourceMode: (props: TProps, mode: ManagedConnectionConsumerSourceMode) => TProps;
  getEmbeddedConnectionQuery: (props: TProps) => ManagedConnectionEmbeddedSourceProps;
  setEmbeddedConnectionQuery: (
    props: TProps,
    value: ManagedConnectionEmbeddedSourceProps,
  ) => TProps;
  getEmbeddedConnectionPresentation: (
    props: TProps,
  ) => WidgetInstancePresentation | undefined;
  setEmbeddedConnectionPresentation: (
    props: TProps,
    value: WidgetInstancePresentation | undefined,
  ) => TProps;
  buildManagedSourceTitle: (input: {
    ownerTitle?: string;
    widgetTitle?: string;
  }) => string;
}

export type AnyManagedConnectionConsumerAdapter =
  ManagedConnectionConsumerAdapter<Record<string, unknown>>;

export function isManagedConnectionConsumerMode(
  adapter: AnyManagedConnectionConsumerAdapter | null | undefined,
  mode: ManagedConnectionConsumerSourceMode | null | undefined,
) {
  return Boolean(
    adapter &&
      (mode === adapter.connectionMode ||
        (adapter.streamConnectionMode && mode === adapter.streamConnectionMode)),
  );
}

export function isManagedConnectionConsumerStreamMode(
  adapter: AnyManagedConnectionConsumerAdapter | null | undefined,
  mode: ManagedConnectionConsumerSourceMode | null | undefined,
) {
  return Boolean(adapter?.streamConnectionMode && mode === adapter.streamConnectionMode);
}

export function resolveManagedConnectionConsumerSourceWidgetId(
  adapter: AnyManagedConnectionConsumerAdapter,
  props: Record<string, unknown> | undefined,
) {
  const mode = adapter.getSourceMode((props ?? {}) as Record<string, unknown>);

  return isManagedConnectionConsumerStreamMode(adapter, mode)
    ? "connection-stream-query"
    : "connection-query";
}

export function resolveManagedConnectionConsumerInputId(
  adapter: AnyManagedConnectionConsumerAdapter,
  props: Record<string, unknown> | undefined,
) {
  const mode = adapter.getSourceMode((props ?? {}) as Record<string, unknown>);

  if (isManagedConnectionConsumerStreamMode(adapter, mode) && adapter.streamSourceInputId) {
    return adapter.streamSourceInputId;
  }

  return adapter.sourceInputId;
}

export function resolveManagedConnectionConsumerOutputId(
  adapter: AnyManagedConnectionConsumerAdapter,
  props: Record<string, unknown> | undefined,
) {
  const mode = adapter.getSourceMode((props ?? {}) as Record<string, unknown>);

  if (isManagedConnectionConsumerStreamMode(adapter, mode) && adapter.streamSourceOutputId) {
    return adapter.streamSourceOutputId;
  }

  return adapter.sourceOutputId ?? "dataset";
}

export function normalizeManagedConnectionEmbeddedSourceProps(
  adapter: AnyManagedConnectionConsumerAdapter,
  props: Record<string, unknown> | undefined,
  value: ManagedConnectionEmbeddedSourceProps,
) {
  return resolveManagedConnectionConsumerSourceWidgetId(adapter, props) === "connection-stream-query"
    ? normalizeConnectionStreamQueryProps(value as ConnectionStreamQueryWidgetProps)
    : normalizeConnectionQueryProps(value as ConnectionQueryWidgetProps);
}

export function resolveManagedConnectionConsumerDetachedSourceMode(
  adapter: AnyManagedConnectionConsumerAdapter,
  props: Record<string, unknown> | undefined,
) {
  return adapter.getDetachedSourceMode?.((props ?? {}) as Record<string, unknown>) ?? "bound";
}

export function buildManagedConnectionConsumerDraftSignature(
  adapter: AnyManagedConnectionConsumerAdapter | null | undefined,
  props: Record<string, unknown> | undefined,
) {
  if (!adapter) {
    return JSON.stringify(null);
  }

  const normalizedProps = (props ?? {}) as Record<string, unknown>;

  return JSON.stringify({
    sourceMode: adapter.getSourceMode(normalizedProps),
    embeddedConnectionQuery: normalizeManagedConnectionEmbeddedSourceProps(
      adapter,
      normalizedProps,
      adapter.getEmbeddedConnectionQuery(normalizedProps),
    ),
    embeddedConnectionPresentation:
      adapter.getEmbeddedConnectionPresentation(normalizedProps) ?? null,
  });
}

export function applyManagedConnectionConsumerDraftProps(
  adapter: AnyManagedConnectionConsumerAdapter,
  targetProps: Record<string, unknown> | undefined,
  sourceProps: Record<string, unknown> | undefined,
) {
  const baseProps = { ...(targetProps ?? {}) };
  const draftProps = (sourceProps ?? {}) as Record<string, unknown>;
  const nextMode = adapter.getSourceMode(draftProps);
  const nextConnectionQuery = adapter.getEmbeddedConnectionQuery(draftProps);
  const nextPresentation = adapter.getEmbeddedConnectionPresentation(draftProps);

  let nextProps = adapter.setSourceMode(baseProps, nextMode);
  nextProps = adapter.setEmbeddedConnectionQuery(nextProps, nextConnectionQuery);
  nextProps = adapter.setEmbeddedConnectionPresentation(nextProps, nextPresentation);

  return nextProps;
}
