import type { ConnectionQueryWidgetProps } from "@/widgets/core/connection-query/connectionQueryModel";
import { normalizeConnectionQueryProps } from "@/widgets/core/connection-query/connectionQueryModel";
import type { WidgetInstancePresentation } from "@/widgets/types";

export type ManagedConnectionConsumerSourceMode = string;

export interface ManagedConnectionConsumerAdapter<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  widgetId: string;
  sourceInputId: string;
  connectionMode: ManagedConnectionConsumerSourceMode;
  getSourceMode: (props: TProps) => ManagedConnectionConsumerSourceMode;
  getDetachedSourceMode?: (props: TProps) => ManagedConnectionConsumerSourceMode;
  setSourceMode: (props: TProps, mode: ManagedConnectionConsumerSourceMode) => TProps;
  getEmbeddedConnectionQuery: (props: TProps) => ConnectionQueryWidgetProps;
  setEmbeddedConnectionQuery: (
    props: TProps,
    value: ConnectionQueryWidgetProps,
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
  return Boolean(adapter && mode === adapter.connectionMode);
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
    embeddedConnectionQuery: normalizeConnectionQueryProps(
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
