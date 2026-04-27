import type {
  ConnectionAuthoringContract,
  ConnectionQueryDraftDefaults,
  ConnectionQueryDraftDefaultsResolverInput,
} from "@/connections/types";
import { buildRelativeFixedRange } from "@/connections/connectionAuthoringContract";
import { buildDefaultQueryForModel } from "@/connections/connectionQueryDraftDefaults";

const ALPACA_DEFAULT_RANGE_MS = 24 * 60 * 60 * 1000;
const ALPACA_DEFAULT_MAX_ROWS = 1_000;

export function resolveAlpacaDraftDefaults(
  input: ConnectionQueryDraftDefaultsResolverInput,
): ConnectionQueryDraftDefaults {
  const selectedQueryModel =
    input.selectedQueryModel ??
    input.queryModels.find((model) => model.id === "alpaca-equity-ohlc") ??
    input.queryModels[0];

  if (!selectedQueryModel) {
    return {};
  }

  const defaultRange = buildRelativeFixedRange(ALPACA_DEFAULT_RANGE_MS);

  return {
    queryModelId: selectedQueryModel.id,
    query: buildDefaultQueryForModel(selectedQueryModel),
    fixedStartMs: defaultRange.fixedStartMs,
    fixedEndMs: defaultRange.fixedEndMs,
    maxRows: ALPACA_DEFAULT_MAX_ROWS,
  };
}

export const alpacaConnectionAuthoringContract: ConnectionAuthoringContract = {
  resolveDraftDefaults: resolveAlpacaDraftDefaults,
  exploreTitle: "Alpaca Market Data Explore",
  exploreDescription:
    "Runs equities and crypto market-data requests through the backend Alpaca adapter.",
  exploreRunButtonLabel: "Run market data query",
  exploreResultTitle: "Market data result",
  exploreResultDescription:
    "Preview of the normalized Alpaca tabular frame returned by the backend adapter.",
};
