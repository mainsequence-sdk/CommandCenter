import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { buildDefaultQueryForModel } from "@/connections/connectionQueryDraftDefaults";
import type {
  ConnectionAuthoringContract,
  ConnectionAuthoringSummaryProps,
  ConnectionQueryDraftDefaults,
  ConnectionQueryDraftDefaultsResolverInput,
} from "@/connections/types";

import { fetchSimpleTableDetail } from "../../../common/api";

const SIMPLE_TABLE_DEFAULT_MAX_ROWS = 1_000;
const SIMPLE_TABLE_DEFAULT_QUERY_CACHE_TTL_MS = 5 * 60 * 1000;

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
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function readConfiguredSimpleTableId(config: Record<string, unknown>) {
  const parsed = Number(config.simpleTableId);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
}

function getSimpleTableColumnNames(
  detail: Awaited<ReturnType<typeof fetchSimpleTableDetail>> | undefined,
) {
  if (!detail) {
    return [];
  }

  if (Array.isArray(detail.columns) && detail.columns.length > 0) {
    return detail.columns.map((column) => column.column_name).filter(Boolean);
  }

  const metadata = detail.sourcetableconfiguration?.columns_metadata;

  if (!Array.isArray(metadata)) {
    return [];
  }

  return metadata.flatMap((column) =>
    typeof column.column_name === "string" && column.column_name.trim()
      ? [column.column_name]
      : [],
  );
}

export function resolveSimpleTableDraftDefaults(
  input: ConnectionQueryDraftDefaultsResolverInput,
): ConnectionQueryDraftDefaults {
  const selectedQueryModel =
    input.selectedQueryModel ??
    input.queryModels.find((model) => model.id === "simple-table-sql") ??
    input.queryModels[0];

  if (!selectedQueryModel) {
    return {};
  }

  const defaultMaxRows = readConfigNumber(
    input.connectionInstance.publicConfig,
    "defaultLimit",
    SIMPLE_TABLE_DEFAULT_MAX_ROWS,
  );

  return {
    queryModelId: selectedQueryModel.id,
    query: {
      ...buildDefaultQueryForModel(selectedQueryModel),
      sql: "select *\nfrom {{simple_table}}\nlimit 100",
    },
    maxRows: defaultMaxRows,
  };
}

export function SimpleTableConnectionAuthoringSummary({
  connectionInstance,
}: ConnectionAuthoringSummaryProps) {
  const publicConfig = connectionInstance.publicConfig;
  const simpleTableId = readConfiguredSimpleTableId(publicConfig);
  const simpleTableLabel = readConfigString(
    publicConfig,
    "simpleTableLabel",
    simpleTableId ? `Simple Table ${simpleTableId}` : "No Simple Table configured",
  );
  const defaultMaxRows = readConfigNumber(
    publicConfig,
    "defaultLimit",
    SIMPLE_TABLE_DEFAULT_MAX_ROWS,
  );
  const queryCachePolicy = readConfigString(publicConfig, "queryCachePolicy", "safe");
  const queryCacheTtlMs = readConfigNumber(
    publicConfig,
    "queryCacheTtlMs",
    SIMPLE_TABLE_DEFAULT_QUERY_CACHE_TTL_MS,
  );
  const dedupeInFlight = publicConfig.dedupeInFlight !== false;
  const simpleTableDetailQuery = useQuery({
    queryKey: ["main_sequence", "connections", "simple_table", "authoring-summary", simpleTableId],
    queryFn: () => fetchSimpleTableDetail(simpleTableId!),
    enabled: Boolean(simpleTableId),
    staleTime: 300_000,
  });
  const columns = getSimpleTableColumnNames(simpleTableDetailQuery.data);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px_180px]">
        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 py-2">
          <div className="text-xs font-medium text-muted-foreground">Simple Table</div>
          <div className="mt-1 truncate text-sm font-semibold text-foreground">
            {simpleTableLabel}
          </div>
          <div className="truncate font-mono text-[11px] text-muted-foreground">
            {simpleTableId ? `id ${simpleTableId}` : "not configured"}
          </div>
        </div>
        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 py-2">
          <div className="text-xs font-medium text-muted-foreground">Query policy</div>
          <div className="mt-1 truncate text-sm font-semibold text-foreground">
            {queryCachePolicy === "disabled"
              ? "Cache disabled"
              : `${queryCacheTtlMs.toLocaleString()} ms cache`}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {dedupeInFlight ? "in-flight dedupe enabled" : "in-flight dedupe disabled"}
          </div>
        </div>
        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 py-2">
          <div className="text-xs font-medium text-muted-foreground">Default rows</div>
          <div className="mt-1 truncate text-sm font-semibold text-foreground">
            {defaultMaxRows.toLocaleString()}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            The request maxRows can override this draft value.
          </div>
        </div>
      </div>

      {simpleTableDetailQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          Unable to load Simple Table detail metadata.
        </div>
      ) : null}

      {columns.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {columns.slice(0, 16).map((columnName) => (
            <Badge key={columnName} variant="neutral" className="normal-case">
              {columnName}
            </Badge>
          ))}
          {columns.length > 16 ? (
            <Badge variant="neutral">+{columns.length - 16} columns</Badge>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export const simpleTableConnectionAuthoringContract: ConnectionAuthoringContract = {
  resolveDraftDefaults: resolveSimpleTableDraftDefaults,
  SummaryComponent: SimpleTableConnectionAuthoringSummary,
  exploreTitle: "Simple Table SQL Explore",
  exploreDescription:
    "Runs the same generated connection query request as the workspace Connection Query widget.",
  exploreRunButtonLabel: "Run query",
  exploreResultDescription: "Preview of the normalized connection runtime frame.",
};
