import type {
  ConnectionAuthoringContract,
  ConnectionQueryDraftDefaults,
  ConnectionQueryDraftDefaultsResolverInput,
} from "@/connections/types";
import { buildRelativeFixedRange } from "@/connections/connectionAuthoringContract";
import { buildDefaultQueryForModel } from "@/connections/connectionQueryDraftDefaults";
import { isConnectionQueryModelStreamable } from "@/connections/types";

const BINANCE_DEFAULT_RANGE_MS = 24 * 60 * 60 * 1000;
const BINANCE_DEFAULT_STREAM_RANGE_MS = 60 * 60 * 1000;
const BINANCE_DEFAULT_MAX_ROWS = 1_000;

export function resolveBinanceDraftDefaults(
  input: ConnectionQueryDraftDefaultsResolverInput,
): ConnectionQueryDraftDefaults {
  const selectedQueryModel = input.authoringMode === "stream"
    ? input.selectedQueryModel ??
      input.queryModels.find((model) => model.id === "binance-spot-ohlc") ??
      input.queryModels.find(isConnectionQueryModelStreamable) ??
      input.queryModels[0]
    : input.selectedQueryModel ??
      input.queryModels.find((model) => model.id === "binance-spot-prices") ??
      input.queryModels[0];

  if (!selectedQueryModel) {
    return {};
  }

  const defaultRange = buildRelativeFixedRange(
    input.authoringMode === "stream"
      ? BINANCE_DEFAULT_STREAM_RANGE_MS
      : BINANCE_DEFAULT_RANGE_MS,
  );

  return {
    queryModelId: selectedQueryModel.id,
    query: buildDefaultQueryForModel(selectedQueryModel),
    fixedStartMs: selectedQueryModel.timeRangeAware ? defaultRange.fixedStartMs : undefined,
    fixedEndMs: selectedQueryModel.timeRangeAware ? defaultRange.fixedEndMs : undefined,
    maxRows: BINANCE_DEFAULT_MAX_ROWS,
  };
}

export const binanceConnectionAuthoringContract: ConnectionAuthoringContract = {
  resolveDraftDefaults: resolveBinanceDraftDefaults,
  exploreTitle: "Binance Market Data Explore",
  exploreDescription:
    "Runs spot and USD-M futures market-data requests through the backend Binance adapter.",
  exploreRunButtonLabel: "Run market data query",
  exploreResultTitle: "Market data result",
  exploreResultDescription:
    "Preview of the normalized Binance tabular frame returned by the backend adapter.",
  streamRunButtonLabel: "Test live market stream",
  streamResultTitle: "Live market stream preview",
  streamResultDescription:
    "Preview of the latest normalized Binance frame received from the backend WebSocket stream bridge.",
};
