import type { WidgetInstancePresentation } from "@/widgets/types";
import type { AnyManagedConnectionConsumerAdapter } from "@/widgets/shared/managed-connection-consumer";
import { normalizeConnectionQueryProps } from "@/widgets/core/connection-query/connectionQueryModel";
import {
  normalizeConnectionStreamQueryProps,
  type ConnectionStreamQueryWidgetProps,
} from "@/widgets/core/connection-stream-query/connectionStreamQueryModel";
import {
  TABULAR_LIVE_UPDATES_INPUT_ID,
  TABULAR_SEED_INPUT_ID,
  TABULAR_UPDATES_OUTPUT_ID,
} from "@/widgets/shared/incremental-tabular-consumer";
import { TABULAR_SOURCE_OUTPUT_ID } from "@/widgets/shared/tabular-widget-source";

import {
  normalizeTableSourceMode,
  resolveTableEmbeddedConnectionQueryProps,
  type TableWidgetProps,
} from "./tableModel";
import {
  CORE_PRO_TABLE_WIDGET_ID,
  CORE_TABLE_WIDGET_ID,
} from "@/widgets/widget-type-normalization";

const tableConnectionMode = "connection";
const tableStreamConnectionMode = "connection-stream";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createTableManagedConnectionConsumerAdapter(widgetId: string) {
  return {
    widgetId,
    sourceInputId: TABULAR_SEED_INPUT_ID,
    streamSourceInputId: TABULAR_LIVE_UPDATES_INPUT_ID,
    sourceOutputId: TABULAR_SOURCE_OUTPUT_ID,
    streamSourceOutputId: TABULAR_UPDATES_OUTPUT_ID,
    connectionMode: tableConnectionMode,
    streamConnectionMode: tableStreamConnectionMode,
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
      const tableProps = props as TableWidgetProps;

      return normalizeTableSourceMode(tableProps.tableSourceMode) === tableStreamConnectionMode
        ? normalizeConnectionStreamQueryProps(
            (isPlainRecord(tableProps.embeddedConnectionQuery)
              ? tableProps.embeddedConnectionQuery
              : {}) as ConnectionStreamQueryWidgetProps,
          )
        : resolveTableEmbeddedConnectionQueryProps(tableProps);
    },
    setEmbeddedConnectionQuery(props: Record<string, unknown>, value) {
      const baseProps = props as TableWidgetProps;

      return {
        ...baseProps,
        embeddedConnectionQuery:
          normalizeTableSourceMode(baseProps.tableSourceMode) === tableStreamConnectionMode
            ? normalizeConnectionStreamQueryProps(value as ConnectionStreamQueryWidgetProps)
            : normalizeConnectionQueryProps(value),
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
}

export const tableManagedConnectionConsumerAdapter =
  createTableManagedConnectionConsumerAdapter(CORE_TABLE_WIDGET_ID);
export const proTableManagedConnectionConsumerAdapter =
  createTableManagedConnectionConsumerAdapter(CORE_PRO_TABLE_WIDGET_ID);
