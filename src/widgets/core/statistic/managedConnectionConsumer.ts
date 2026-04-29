import type { WidgetInstancePresentation } from "@/widgets/types";
import { TABULAR_SOURCE_INPUT_ID } from "@/widgets/shared/tabular-widget-source";
import type { AnyManagedConnectionConsumerAdapter } from "@/widgets/shared/managed-connection-consumer";
import { normalizeConnectionQueryProps } from "@/widgets/core/connection-query/connectionQueryModel";
import {
  normalizeConnectionStreamQueryProps,
  type ConnectionStreamQueryWidgetProps,
} from "@/widgets/core/connection-stream-query/connectionStreamQueryModel";

import {
  normalizeStatisticAuthoringSourceMode,
  resolveStatisticEmbeddedConnectionQueryProps,
  type StatisticWidgetProps,
} from "./statisticModel";

const statisticConnectionMode = "connection";
const statisticStreamConnectionMode = "connection-stream";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export const statisticManagedConnectionConsumerAdapter = {
  widgetId: "statistic",
  sourceInputId: TABULAR_SOURCE_INPUT_ID,
  connectionMode: statisticConnectionMode,
  streamConnectionMode: statisticStreamConnectionMode,
  getSourceMode(props: Record<string, unknown>) {
    return normalizeStatisticAuthoringSourceMode(
      (props as StatisticWidgetProps).statisticSourceMode,
    );
  },
  getDetachedSourceMode() {
    return "bound";
  },
  setSourceMode(props: Record<string, unknown>, mode) {
    return {
      ...(props as StatisticWidgetProps),
      statisticSourceMode: normalizeStatisticAuthoringSourceMode(mode),
    } satisfies StatisticWidgetProps;
  },
  getEmbeddedConnectionQuery(props: Record<string, unknown>) {
    const statisticProps = props as StatisticWidgetProps;

    return normalizeStatisticAuthoringSourceMode(statisticProps.statisticSourceMode) ===
      statisticStreamConnectionMode
      ? normalizeConnectionStreamQueryProps(
          (isPlainRecord(statisticProps.embeddedConnectionQuery)
            ? statisticProps.embeddedConnectionQuery
            : {}) as ConnectionStreamQueryWidgetProps,
        )
      : resolveStatisticEmbeddedConnectionQueryProps(statisticProps);
  },
  setEmbeddedConnectionQuery(props: Record<string, unknown>, value) {
    const statisticProps = props as StatisticWidgetProps;

    return {
      ...statisticProps,
      embeddedConnectionQuery:
        normalizeStatisticAuthoringSourceMode(statisticProps.statisticSourceMode) ===
        statisticStreamConnectionMode
          ? normalizeConnectionStreamQueryProps(value as ConnectionStreamQueryWidgetProps)
          : normalizeConnectionQueryProps(value),
    } satisfies StatisticWidgetProps;
  },
  getEmbeddedConnectionPresentation(props: Record<string, unknown>) {
    const embeddedConnectionPresentation = (props as StatisticWidgetProps)
      .embeddedConnectionPresentation;

    return isPlainRecord(embeddedConnectionPresentation)
      ? (embeddedConnectionPresentation as WidgetInstancePresentation)
      : undefined;
  },
  setEmbeddedConnectionPresentation(props: Record<string, unknown>, value) {
    return {
      ...(props as StatisticWidgetProps),
      embeddedConnectionPresentation: value,
    } satisfies StatisticWidgetProps;
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
      : `${widgetTitle?.trim() || "Statistic"} Source`;
  },
} satisfies AnyManagedConnectionConsumerAdapter;
