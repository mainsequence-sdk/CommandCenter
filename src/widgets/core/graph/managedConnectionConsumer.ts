import type { WidgetInstancePresentation } from "@/widgets/types";
import { TABULAR_SOURCE_INPUT_ID } from "@/widgets/shared/tabular-widget-source";
import type { AnyManagedConnectionConsumerAdapter } from "@/widgets/shared/managed-connection-consumer";
import { normalizeConnectionQueryProps } from "@/widgets/core/connection-query/connectionQueryModel";
import {
  normalizeConnectionStreamQueryProps,
  type ConnectionStreamQueryWidgetProps,
} from "@/widgets/core/connection-stream-query/connectionStreamQueryModel";

import {
  normalizeGraphAuthoringSourceMode,
  resolveGraphEmbeddedConnectionQueryProps,
  type GraphWidgetProps,
} from "./graphModel";

const graphConnectionMode = "connection";
const graphStreamConnectionMode = "connection-stream";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export const graphManagedConnectionConsumerAdapter = {
  widgetId: "graph",
  sourceInputId: TABULAR_SOURCE_INPUT_ID,
  connectionMode: graphConnectionMode,
  streamConnectionMode: graphStreamConnectionMode,
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
    const graphProps = props as GraphWidgetProps;

    return normalizeGraphAuthoringSourceMode(graphProps.graphSourceMode) === graphStreamConnectionMode
      ? normalizeConnectionStreamQueryProps(
          (isPlainRecord(graphProps.embeddedConnectionQuery)
            ? graphProps.embeddedConnectionQuery
            : {}) as ConnectionStreamQueryWidgetProps,
        )
      : resolveGraphEmbeddedConnectionQueryProps(graphProps);
  },
  setEmbeddedConnectionQuery(props: Record<string, unknown>, value) {
    const graphProps = props as GraphWidgetProps;

    return {
      ...graphProps,
      embeddedConnectionQuery:
        normalizeGraphAuthoringSourceMode(graphProps.graphSourceMode) === graphStreamConnectionMode
          ? normalizeConnectionStreamQueryProps(value as ConnectionStreamQueryWidgetProps)
          : normalizeConnectionQueryProps(value),
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
