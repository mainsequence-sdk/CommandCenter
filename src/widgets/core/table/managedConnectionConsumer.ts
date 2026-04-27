import type { WidgetInstancePresentation } from "@/widgets/types";
import { TABULAR_SOURCE_INPUT_ID } from "@/widgets/shared/tabular-widget-source";
import type { AnyManagedConnectionConsumerAdapter } from "@/widgets/shared/managed-connection-consumer";
import { normalizeConnectionQueryProps } from "@/widgets/core/connection-query/connectionQueryModel";

import {
  normalizeTableSourceMode,
  resolveTableEmbeddedConnectionQueryProps,
  type TableWidgetProps,
} from "./tableModel";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export const tableManagedConnectionConsumerAdapter = {
  widgetId: "table",
  sourceInputId: TABULAR_SOURCE_INPUT_ID,
  connectionMode: "connection",
  getSourceMode(props: Record<string, unknown>) {
    return normalizeTableSourceMode(
      (props as TableWidgetProps).tableSourceMode,
    );
  },
  getDetachedSourceMode() {
    return "bound";
  },
  setSourceMode(props: Record<string, unknown>, mode) {
    return {
      ...(props as TableWidgetProps),
      tableSourceMode: normalizeTableSourceMode(mode),
    } satisfies TableWidgetProps;
  },
  getEmbeddedConnectionQuery(props: Record<string, unknown>) {
    return resolveTableEmbeddedConnectionQueryProps(props as TableWidgetProps);
  },
  setEmbeddedConnectionQuery(props: Record<string, unknown>, value) {
    return {
      ...(props as TableWidgetProps),
      embeddedConnectionQuery: normalizeConnectionQueryProps(value),
    } satisfies TableWidgetProps;
  },
  getEmbeddedConnectionPresentation(props: Record<string, unknown>) {
    const embeddedConnectionPresentation = (props as TableWidgetProps)
      .embeddedConnectionPresentation;

    return isPlainRecord(embeddedConnectionPresentation)
      ? (embeddedConnectionPresentation as WidgetInstancePresentation)
      : undefined;
  },
  setEmbeddedConnectionPresentation(props: Record<string, unknown>, value) {
    return {
      ...(props as TableWidgetProps),
      embeddedConnectionPresentation: value,
    } satisfies TableWidgetProps;
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
      : `${widgetTitle?.trim() || "Table"} Source`;
  },
} satisfies AnyManagedConnectionConsumerAdapter;
