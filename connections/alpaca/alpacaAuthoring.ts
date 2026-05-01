import type {
  ConnectionAuthoringMode,
  ConnectionAuthoringContract,
  ConnectionAuthoringQueryModelsResolverInput,
  ConnectionQueryDraftDefaults,
  ConnectionQueryDraftDefaultsResolverInput,
} from "@/connections/types";
import { buildRelativeFixedRange } from "@/connections/connectionAuthoringContract";
import { buildDefaultQueryForModel } from "@/connections/connectionQueryDraftDefaults";
import { isConnectionQueryModelStreamable } from "@/connections/types";

const ALPACA_DEFAULT_RANGE_MS = 24 * 60 * 60 * 1000;
const ALPACA_DEFAULT_MAX_ROWS = 1_000;

function normalizeAssetClasses(value: unknown) {
  return Array.isArray(value) && value.length > 0 ? value : ["us_equity"];
}

function isAlpacaAuthoringModeStream(authoringMode: ConnectionAuthoringMode | undefined) {
  return authoringMode === "stream";
}

export function resolveAlpacaQueryModels(
  input: ConnectionAuthoringQueryModelsResolverInput,
) {
  const enabledAssetClasses = new Set(
    normalizeAssetClasses(input.connectionInstance.publicConfig.assetClasses),
  );
  const streamAuthoring = isAlpacaAuthoringModeStream(input.authoringMode);

  return input.queryModels.filter((model) => {
    const isEquityModel = model.id.startsWith("alpaca-equity-");
    const isCryptoModel = model.id.startsWith("alpaca-crypto-");

    if (isEquityModel && !enabledAssetClasses.has("us_equity")) {
      return false;
    }

    if (isCryptoModel && !enabledAssetClasses.has("crypto")) {
      return false;
    }

    return streamAuthoring
      ? isConnectionQueryModelStreamable(model)
      : !isConnectionQueryModelStreamable(model);
  });
}

export function resolveAlpacaDraftDefaults(
  input: ConnectionQueryDraftDefaultsResolverInput,
): ConnectionQueryDraftDefaults {
  const streamAuthoring = isAlpacaAuthoringModeStream(input.authoringMode);
  const selectedQueryModel = streamAuthoring
    ? input.selectedQueryModel ??
      input.queryModels.find((model) => model.id === "alpaca-equity-live-trades") ??
      input.queryModels.find((model) => model.id === "alpaca-crypto-live-trades") ??
      input.queryModels.find(isConnectionQueryModelStreamable) ??
      input.queryModels[0]
    : input.selectedQueryModel ??
      input.queryModels.find((model) => model.id === "alpaca-equity-ohlc") ??
      input.queryModels.find((model) => model.id === "alpaca-crypto-ohlc") ??
      input.queryModels[0];

  if (!selectedQueryModel) {
    return {};
  }

  const defaultRange = buildRelativeFixedRange(ALPACA_DEFAULT_RANGE_MS);

  return {
    queryModelId: selectedQueryModel.id,
    query: buildDefaultQueryForModel(selectedQueryModel),
    fixedStartMs: selectedQueryModel.timeRangeAware ? defaultRange.fixedStartMs : undefined,
    fixedEndMs: selectedQueryModel.timeRangeAware ? defaultRange.fixedEndMs : undefined,
    maxRows: ALPACA_DEFAULT_MAX_ROWS,
  };
}

export const alpacaConnectionAuthoringContract: ConnectionAuthoringContract = {
  resolveQueryModels: resolveAlpacaQueryModels,
  resolveDraftDefaults: resolveAlpacaDraftDefaults,
  exploreTitle: "Alpaca Market Data Explore",
  exploreDescription:
    "Runs equities and crypto market-data requests through the backend Alpaca adapter.",
  exploreRunButtonLabel: "Run market data query",
  exploreResultTitle: "Market data result",
  exploreResultDescription:
    "Preview of the normalized Alpaca tabular frame returned by the backend adapter.",
  streamRunButtonLabel: "Test live market stream",
  streamResultTitle: "Live market stream preview",
  streamResultDescription:
    "Preview of the latest normalized Alpaca frame received from the backend WebSocket stream bridge.",
};
