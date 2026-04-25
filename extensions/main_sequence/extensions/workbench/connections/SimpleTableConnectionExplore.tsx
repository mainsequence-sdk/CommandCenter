import { useMemo, useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Code2, Database, Loader2, Play, Table2, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { queryConnection } from "@/connections/api";
import {
  ConnectionFramePreview,
  formatConnectionQueryJson,
  parseConnectionQueryParameters,
  summarizeConnectionQueryResponse,
} from "@/connections/query-explore-utils";
import type { ConnectionExploreProps } from "@/connections/types";

import { fetchSimpleTableDetail } from "../../../common/api";
import {
  DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_QUERY_CACHE_TTL_MS,
  DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_ROW_LIMIT,
  type MainSequenceSimpleTableConnectionQuery,
} from "./simpleTableConnection";

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

function normalizeSqlFragment(value: string) {
  return value.trim().replace(/;+\s*$/g, "");
}

function getSimpleTableColumnNames(detail: Awaited<ReturnType<typeof fetchSimpleTableDetail>> | undefined) {
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

export function SimpleTableConnectionExplore({
  connectionInstance,
}: ConnectionExploreProps) {
  const simpleTableId = readConfiguredSimpleTableId(connectionInstance.publicConfig);
  const simpleTableLabel = readConfigString(
    connectionInstance.publicConfig,
    "simpleTableLabel",
    simpleTableId ? `Simple Table ${simpleTableId}` : "No Simple Table configured",
  );
  const defaultMaxRows = readConfigNumber(
    connectionInstance.publicConfig,
    "defaultLimit",
    DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_ROW_LIMIT,
  );
  const queryCachePolicy = readConfigString(
    connectionInstance.publicConfig,
    "queryCachePolicy",
    "safe",
  );
  const queryCacheTtlMs = readConfigNumber(
    connectionInstance.publicConfig,
    "queryCacheTtlMs",
    DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_QUERY_CACHE_TTL_MS,
  );
  const dedupeInFlight = connectionInstance.publicConfig.dedupeInFlight !== false;
  const [sqlText, setSqlText] = useState("select *\nfrom {{simple_table}}\nlimit 100");
  const [maxRows, setMaxRows] = useState(defaultMaxRows);
  const [parametersText, setParametersText] = useState("");

  const simpleTableDetailQuery = useQuery({
    queryKey: ["main_sequence", "connections", "simple_table", "explore", simpleTableId],
    queryFn: () => fetchSimpleTableDetail(simpleTableId!),
    enabled: Boolean(simpleTableId),
    staleTime: 300_000,
  });

  const queryMutation = useMutation({
    mutationFn: async () => {
      const sql = normalizeSqlFragment(sqlText);

      if (!simpleTableId) {
        throw new Error("Select a Simple Table in the connection configuration before querying.");
      }

      if (!sql) {
        throw new Error("SQL is required.");
      }

      const query: MainSequenceSimpleTableConnectionQuery = {
        kind: "simple-table-sql",
        sql,
        maxRows,
        parameters: parseConnectionQueryParameters(parametersText),
      };

      return queryConnection<MainSequenceSimpleTableConnectionQuery>({
        connectionUid: connectionInstance.uid,
        query,
        maxRows,
        cacheMode: queryCachePolicy === "disabled" ? "bypass" : "default",
        cacheTtlMs: queryCachePolicy === "disabled" ? undefined : queryCacheTtlMs,
      });
    },
  });

  const summaryBadges = useMemo(
    () => queryMutation.data ? summarizeConnectionQueryResponse(queryMutation.data) : [],
    [queryMutation.data],
  );
  const firstFrame = queryMutation.data?.frames[0];
  const columns = getSimpleTableColumnNames(simpleTableDetailQuery.data);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle>Simple Table SQL Explore</CardTitle>
          </div>
          <CardDescription>
            Run read-only SQL through the configured Main Sequence Simple Table backend adapter.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
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
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Max rows</span>
              <Input
                type="number"
                min={1}
                value={maxRows}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  setMaxRows(Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1);
                }}
              />
            </label>
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

          <label className="block space-y-1.5">
            <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Code2 className="h-3.5 w-3.5" />
              SQL
            </span>
            <Textarea
              value={sqlText}
              onChange={(event) => setSqlText(event.target.value)}
              rows={8}
              spellCheck={false}
              className="font-mono text-xs"
              placeholder="select * from {{simple_table}} limit 100"
            />
            <span className="block text-xs text-muted-foreground">
              Use <code className="rounded bg-muted px-1 py-0.5">{"{{simple_table}}"}</code> for
              the backend-scoped table reference. The adapter must reject unsafe SQL.
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Parameters
            </span>
            <Textarea
              value={parametersText}
              onChange={(event) => setParametersText(event.target.value)}
              rows={4}
              spellCheck={false}
              className="font-mono text-xs"
              placeholder={"symbol=AAPL\nlimit=100\nactive=true"}
            />
            <span className="block text-xs text-muted-foreground">
              Optional key=value lines passed to the backend adapter as query parameters.
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={!simpleTableId || queryMutation.isPending}
              onClick={() => queryMutation.mutate()}
            >
              {queryMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run query
            </Button>
            {!simpleTableId ? (
              <span className="text-sm text-muted-foreground">
                Configure a Simple Table before running SQL.
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {queryMutation.isError ? (
        <Card className="border-danger/40 bg-danger/10">
          <CardHeader>
            <div className="flex items-center gap-2 text-danger">
              <TriangleAlert className="h-5 w-5" />
              <CardTitle>Query failed</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-danger">
            {queryMutation.error instanceof Error
              ? queryMutation.error.message
              : "The Simple Table SQL query failed."}
          </CardContent>
        </Card>
      ) : null}

      {queryMutation.data ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Table2 className="h-5 w-5 text-primary" />
                  <CardTitle>Query result</CardTitle>
                </div>
                <CardDescription>Preview of the normalized connection response.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {summaryBadges.map((entry) => (
                  <Badge key={entry} variant="neutral">
                    {entry}
                  </Badge>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ConnectionFramePreview frame={firstFrame} />
            {queryMutation.data.warnings?.length ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
                {queryMutation.data.warnings.join(" ")}
              </div>
            ) : null}
            <details className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
                Raw response
              </summary>
              <pre className="max-h-[420px] overflow-auto border-t border-border/70 p-4 text-xs">
                {formatConnectionQueryJson(queryMutation.data)}
              </pre>
            </details>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
