import { Badge } from "@/components/ui/badge";
import { buildRelativeFixedRange } from "@/connections/connectionAuthoringContract";
import { buildDefaultQueryForModel } from "@/connections/connectionQueryDraftDefaults";
import type {
  ConnectionAuthoringContract,
  ConnectionAuthoringQueryModelsResolverInput,
  ConnectionAuthoringSummaryProps,
  ConnectionQueryDraftDefaults,
  ConnectionQueryDraftDefaultsResolverInput,
} from "@/connections/types";

import {
  filterMassiveQueryModelsForConfig,
  formatMassiveAssetClassLabel,
  getEnabledMassiveAssetClasses,
} from "./massiveShared";

const MASSIVE_DEFAULT_RANGE_MS = 30 * 24 * 60 * 60 * 1000;
const MASSIVE_DEFAULT_MAX_ROWS = 1_000;

export function resolveMassiveQueryModels(input: ConnectionAuthoringQueryModelsResolverInput) {
  return filterMassiveQueryModelsForConfig(
    input.queryModels,
    input.connectionInstance.publicConfig,
  );
}

export function resolveMassiveDraftDefaults(
  input: ConnectionQueryDraftDefaultsResolverInput,
): ConnectionQueryDraftDefaults {
  const selectedQueryModel =
    input.selectedQueryModel ??
    input.queryModels.find((model) => model.id === "massive-stocks-custom-bars") ??
    input.queryModels[0];

  if (!selectedQueryModel) {
    return {};
  }

  const defaultRange = buildRelativeFixedRange(MASSIVE_DEFAULT_RANGE_MS);

  return {
    queryModelId: selectedQueryModel.id,
    query: buildDefaultQueryForModel(selectedQueryModel),
    fixedStartMs: defaultRange.fixedStartMs,
    fixedEndMs: defaultRange.fixedEndMs,
    maxRows: MASSIVE_DEFAULT_MAX_ROWS,
  };
}

export function MassiveConnectionAuthoringSummary({
  connectionInstance,
}: ConnectionAuthoringSummaryProps) {
  const publicConfig = connectionInstance.publicConfig;
  const enabledAssetClasses = getEnabledMassiveAssetClasses(publicConfig);

  return (
    <div className="flex flex-wrap gap-2">
      {enabledAssetClasses.slice(0, 6).map((assetClass) => (
        <Badge key={assetClass} variant="neutral">
          {formatMassiveAssetClassLabel(assetClass)}
        </Badge>
      ))}
      {enabledAssetClasses.length > 6 ? (
        <Badge variant="neutral">+{enabledAssetClasses.length - 6}</Badge>
      ) : null}
      {publicConfig.enableBetaEndpoints === true ? <Badge variant="secondary">beta</Badge> : null}
      {publicConfig.enableDeprecatedEndpoints === true ? (
        <Badge variant="secondary">deprecated</Badge>
      ) : null}
      <Badge variant="neutral">cache {String(publicConfig.queryCachePolicy ?? "read")}</Badge>
    </div>
  );
}

export const massiveConnectionAuthoringContract: ConnectionAuthoringContract = {
  resolveQueryModels: resolveMassiveQueryModels,
  resolveDraftDefaults: resolveMassiveDraftDefaults,
  SummaryComponent: MassiveConnectionAuthoringSummary,
  exploreTitle: "Massive Market Data Explore",
  exploreDescription: "Runs catalog-backed Massive REST requests through the backend adapter.",
  exploreRunButtonLabel: "Run market data query",
  exploreResultTitle: "Market data result",
  exploreResultDescription:
    "Preview of the normalized Massive tabular frame returned by the backend adapter.",
};
