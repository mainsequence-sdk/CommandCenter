import type { WidgetInstancePresentation } from "@/widgets/types";
import type { AnyManagedConnectionConsumerAdapter } from "@/widgets/shared/managed-connection-consumer";
import { normalizeConnectionQueryProps } from "@/widgets/core/connection-query/connectionQueryModel";
import {
  normalizeConnectionStreamQueryProps,
  type ConnectionStreamQueryWidgetProps,
} from "@/widgets/core/connection-stream-query/connectionStreamQueryModel";
import { TABULAR_UPDATES_OUTPUT_ID } from "@/widgets/shared/incremental-tabular-consumer";
import { TABULAR_SOURCE_OUTPUT_ID } from "@/widgets/shared/tabular-widget-source";
import { MAIN_SEQUENCE_MARKETS_ASSET_SCREENER_WIDGET_ID } from "@/widgets/widget-type-normalization";

import {
  MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID,
  MARKET_ASSET_SCREENER_SEED_INPUT_ID,
} from "../../widget-contracts/marketAssetFrames";
import {
  normalizeAssetScreenerSourceMode,
  type MainSequenceAssetScreenerWidgetProps,
} from "./assetScreenerModel";

const assetScreenerConnectionMode = "connection";
const assetScreenerStreamConnectionMode = "connection-stream";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export const assetScreenerManagedConnectionConsumerAdapter = {
  widgetId: MAIN_SEQUENCE_MARKETS_ASSET_SCREENER_WIDGET_ID,
  sourceInputId: MARKET_ASSET_SCREENER_SEED_INPUT_ID,
  streamSourceInputId: MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID,
  sourceOutputId: TABULAR_SOURCE_OUTPUT_ID,
  streamSourceOutputId: TABULAR_UPDATES_OUTPUT_ID,
  connectionMode: assetScreenerConnectionMode,
  streamConnectionMode: assetScreenerStreamConnectionMode,
  getSourceMode(props: Record<string, unknown>) {
    return normalizeAssetScreenerSourceMode(
      (props as MainSequenceAssetScreenerWidgetProps).assetScreenerSourceMode,
    );
  },
  getDetachedSourceMode() {
    return "bound";
  },
  setSourceMode(props: Record<string, unknown>, mode) {
    return {
      ...(props as MainSequenceAssetScreenerWidgetProps),
      assetScreenerSourceMode: normalizeAssetScreenerSourceMode(mode),
    } satisfies MainSequenceAssetScreenerWidgetProps;
  },
  getEmbeddedConnectionQuery(props: Record<string, unknown>) {
    const assetScreenerProps = props as MainSequenceAssetScreenerWidgetProps;

    return normalizeAssetScreenerSourceMode(assetScreenerProps.assetScreenerSourceMode) ===
      assetScreenerStreamConnectionMode
      ? normalizeConnectionStreamQueryProps(
          (isPlainRecord(assetScreenerProps.embeddedConnectionQuery)
            ? assetScreenerProps.embeddedConnectionQuery
            : {}) as ConnectionStreamQueryWidgetProps,
        )
      : normalizeConnectionQueryProps(
          isPlainRecord(assetScreenerProps.embeddedConnectionQuery)
            ? assetScreenerProps.embeddedConnectionQuery
            : {},
        );
  },
  setEmbeddedConnectionQuery(props: Record<string, unknown>, value) {
    const assetScreenerProps = props as MainSequenceAssetScreenerWidgetProps;

    return {
      ...assetScreenerProps,
      embeddedConnectionQuery:
        normalizeAssetScreenerSourceMode(assetScreenerProps.assetScreenerSourceMode) ===
        assetScreenerStreamConnectionMode
          ? normalizeConnectionStreamQueryProps(value as ConnectionStreamQueryWidgetProps)
          : normalizeConnectionQueryProps(value),
    } satisfies MainSequenceAssetScreenerWidgetProps;
  },
  getEmbeddedConnectionPresentation(props: Record<string, unknown>) {
    const embeddedConnectionPresentation = (props as MainSequenceAssetScreenerWidgetProps)
      .embeddedConnectionPresentation;

    return isPlainRecord(embeddedConnectionPresentation)
      ? (embeddedConnectionPresentation as WidgetInstancePresentation)
      : undefined;
  },
  setEmbeddedConnectionPresentation(props: Record<string, unknown>, value) {
    return {
      ...(props as MainSequenceAssetScreenerWidgetProps),
      embeddedConnectionPresentation: value,
    } satisfies MainSequenceAssetScreenerWidgetProps;
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
      : `${widgetTitle?.trim() || "Asset Screener"} Source`;
  },
} satisfies AnyManagedConnectionConsumerAdapter;
