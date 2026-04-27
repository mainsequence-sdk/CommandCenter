import { Badge } from "@/components/ui/badge";
import { buildRelativeFixedRange } from "@/connections/connectionAuthoringContract";
import { buildDefaultQueryForModel } from "@/connections/connectionQueryDraftDefaults";
import type {
  ConnectionAuthoringContract,
  ConnectionAuthoringSummaryProps,
  ConnectionQueryDraftDefaults,
  ConnectionQueryDraftDefaultsResolverInput,
} from "@/connections/types";

const FRED_DEFAULT_RANGE_MS = 5 * 365 * 24 * 60 * 60 * 1000;
const FRED_DEFAULT_MAX_ROWS = 1_000;

function readConfigValue(value: unknown, fallback: string | number) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return fallback;
}

export function resolveFredDraftDefaults(
  input: ConnectionQueryDraftDefaultsResolverInput,
): ConnectionQueryDraftDefaults {
  const selectedQueryModel =
    input.selectedQueryModel ??
    input.queryModels.find((model) => model.id === "fred-series-observations") ??
    input.queryModels[0];

  if (!selectedQueryModel) {
    return {};
  }

  const defaultRange = buildRelativeFixedRange(FRED_DEFAULT_RANGE_MS);

  return {
    queryModelId: selectedQueryModel.id,
    query: buildDefaultQueryForModel(selectedQueryModel),
    fixedStartMs: defaultRange.fixedStartMs,
    fixedEndMs: defaultRange.fixedEndMs,
    maxRows: FRED_DEFAULT_MAX_ROWS,
  };
}

export function FredConnectionAuthoringSummary({
  connectionInstance,
}: ConnectionAuthoringSummaryProps) {
  const publicConfig = connectionInstance.publicConfig;

  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="neutral">{String(readConfigValue(publicConfig.defaultSeriesId, "GDP"))}</Badge>
      <Badge variant="neutral">{String(readConfigValue(publicConfig.defaultUnits, "lin"))}</Badge>
      <Badge variant="neutral">
        {String(readConfigValue(publicConfig.defaultFrequency, "native frequency"))}
      </Badge>
      <Badge variant="neutral">
        limit {String(readConfigValue(publicConfig.defaultLimit, FRED_DEFAULT_MAX_ROWS))}
      </Badge>
      <Badge variant="neutral">
        cache {String(readConfigValue(publicConfig.queryCachePolicy, "read"))}
      </Badge>
      {publicConfig.dedupeInFlight !== false ? <Badge variant="neutral">dedupe</Badge> : null}
    </div>
  );
}

export const fredConnectionAuthoringContract: ConnectionAuthoringContract = {
  resolveDraftDefaults: resolveFredDraftDefaults,
  SummaryComponent: FredConnectionAuthoringSummary,
  exploreTitle: "FRED Economic Data Explore",
  exploreDescription:
    "Runs macroeconomic and regional time-series requests through the backend FRED adapter.",
  exploreRunButtonLabel: "Run FRED query",
  exploreResultTitle: "Economic data result",
  exploreResultDescription:
    "Preview of the normalized FRED tabular frame returned by the backend adapter.",
};
