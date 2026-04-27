import type { WidgetInstancePresentation } from "@/widgets/types";
import { TABULAR_SOURCE_INPUT_ID } from "@/widgets/shared/tabular-widget-source";
import type { AnyManagedConnectionConsumerAdapter } from "@/widgets/shared/managed-connection-consumer";
import { normalizeConnectionQueryProps } from "@/widgets/core/connection-query/connectionQueryModel";

import {
  normalizeGraphAuthoringSourceMode,
  resolveGraphEmbeddedConnectionQueryProps,
  type GraphWidgetProps,
} from "./graphModel";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export const graphManagedConnectionConsumerAdapter = {
  widgetId: "graph",
  sourceInputId: TABULAR_SOURCE_INPUT_ID,
  connectionMode: "connection",
  getSourceMode(props: Record<string, unknown>) {
    return normalizeGraphAuthoringSourceMode(
      (props as GraphWidgetProps).graphSourceMode,
    );
  },
  setSourceMode(props: Record<string, unknown>, mode) {
    return {
      ...(props as GraphWidgetProps),
      graphSourceMode: normalizeGraphAuthoringSourceMode(mode),
    } satisfies GraphWidgetProps;
  },
  getEmbeddedConnectionQuery(props: Record<string, unknown>) {
    return resolveGraphEmbeddedConnectionQueryProps(props as GraphWidgetProps);
  },
  setEmbeddedConnectionQuery(props: Record<string, unknown>, value) {
    return {
      ...(props as GraphWidgetProps),
      embeddedConnectionQuery: normalizeConnectionQueryProps(value),
    } satisfies GraphWidgetProps;
  },
  getEmbeddedConnectionPresentation(props: Record<string, unknown>) {
    const embeddedConnectionPresentation = (props as GraphWidgetProps)
      .embeddedConnectionPresentation;

    return isPlainRecord(embeddedConnectionPresentation)
      ? (embeddedConnectionPresentation as WidgetInstancePresentation)
      : undefined;
  },
  setEmbeddedConnectionPresentation(props: Record<string, unknown>, value) {
    return {
      ...(props as GraphWidgetProps),
      embeddedConnectionPresentation: value,
    } satisfies GraphWidgetProps;
  },
  buildManagedSourceTitle({
    ownerTitle,
    widgetTitle,
  }: {
    ownerTitle?: string;
    widgetTitle?: string;
  }) {
    const normalizedOwnerTitle = ownerTitle?.trim();
    return normalizedOwnerTitle
      ? `${normalizedOwnerTitle} Source`
      : `${widgetTitle?.trim() || "Graph"} Source`;
  },
} satisfies AnyManagedConnectionConsumerAdapter;
