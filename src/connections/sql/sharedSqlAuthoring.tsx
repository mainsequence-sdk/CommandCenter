import type {
  ConnectionAuthoringContract,
  ConnectionAuthoringSummaryProps,
} from "@/connections/types";

export const SHARED_SQL_DEFAULT_AUTHORING_MAX_ROWS = 100;

function readConfigString(
  config: Record<string, unknown>,
  key: string,
  fallback: string,
) {
  const value = config[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readConfigNumber(
  config: Record<string, unknown>,
  key: string,
  fallback: number,
) {
  const value = config[key];
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function SharedSqlConnectionAuthoringSummary({
  connectionInstance,
}: ConnectionAuthoringSummaryProps) {
  const queryCachePolicy = readConfigString(
    connectionInstance.publicConfig,
    "queryCachePolicy",
    "safe",
  );
  const queryCacheTtlMs = readConfigNumber(
    connectionInstance.publicConfig,
    "queryCacheTtlMs",
    300000,
  );
  const metadataCacheTtlMs = readConfigNumber(
    connectionInstance.publicConfig,
    "metadataCacheTtlMs",
    300000,
  );
  const statementTimeoutMs = readConfigNumber(
    connectionInstance.publicConfig,
    "statementTimeoutMs",
    30000,
  );
  const dedupeInFlight = connectionInstance.publicConfig.dedupeInFlight !== false;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px_180px]">
      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 py-2">
        <div className="text-xs font-medium text-muted-foreground">Data source policy</div>
        <div className="mt-1 truncate text-sm font-semibold text-foreground">
          {queryCachePolicy === "disabled"
            ? "Cache disabled"
            : `${queryCacheTtlMs.toLocaleString()} ms cache`}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {dedupeInFlight ? "in-flight dedupe enabled" : "in-flight dedupe disabled"}
        </div>
      </div>
      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 py-2 text-xs leading-5 text-muted-foreground xl:col-span-2">
        Statement timeout: {statementTimeoutMs.toLocaleString()} ms.
        <br />
        Metadata cache: {metadataCacheTtlMs.toLocaleString()} ms.
      </div>
    </div>
  );
}

export function createSharedSqlConnectionAuthoringContract({
  providerName,
}: {
  providerName: string;
}): ConnectionAuthoringContract {
  return {
    SummaryComponent: SharedSqlConnectionAuthoringSummary,
    exploreTitle: `${providerName} Explore`,
    exploreDescription:
      "Runs the same generated connection query request as the workspace Connection Query widget.",
    exploreRunButtonLabel: "Run query",
    exploreResultDescription: "Preview of the normalized connection runtime frame.",
    resolveDraftDefaults: ({ queryModels, selectedQueryModel }) => {
      const queryModel =
        selectedQueryModel ??
        queryModels.find((model) => model.id === "sql-table") ??
        queryModels[0];

      return queryModel
        ? {
            queryModelId: queryModel.id,
            maxRows: queryModel.supportsMaxRows === false
              ? undefined
              : SHARED_SQL_DEFAULT_AUTHORING_MAX_ROWS,
          }
        : {};
    },
  };
}
