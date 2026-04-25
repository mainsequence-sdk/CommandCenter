import { useMemo, useState } from "react";

import { useMutation } from "@tanstack/react-query";
import { Code2, Database, Loader2, Play, Table2, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { queryConnection } from "@/connections/api";
import {
  ConnectionFramePreview,
  formatConnectionQueryJson,
  parseConnectionQueryParameters,
  summarizeConnectionQueryResponse,
} from "@/connections/query-explore-utils";
import type { ConnectionExploreProps } from "@/connections/types";

import type { PostgreSqlConnectionQuery } from "./index";

type PostgreSqlEditorMode = "builder" | "sql";
type PostgreSqlQueryShape = "table" | "timeseries";
type PostgreSqlOrderDirection = "asc" | "desc";

const defaultTimeseriesLookback = "6h";
const defaultInterval = "5m";

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

function parseDurationMs(value: string, label: string) {
  const normalized = value.trim();
  const match = normalized.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/i);

  if (!match) {
    throw new Error(`${label} must be a duration like 500ms, 15s, 5m, 1h, or 1d.`);
  }

  const amount = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return Math.max(1, Math.round(amount * multipliers[unit]!));
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function quoteIdentifier(identifier: string) {
  const trimmed = identifier.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.includes("(") || trimmed.includes(")") || trimmed.includes(" ")) {
    return trimmed;
  }

  return trimmed
    .split(".")
    .map((part) => `"${part.replaceAll('"', '""')}"`)
    .join(".");
}

function qualifyTable(schema: string, table: string) {
  const tableName = table.trim();

  if (!tableName) {
    throw new Error("Table is required.");
  }

  if (tableName.includes(".")) {
    return quoteIdentifier(tableName);
  }

  const schemaName = schema.trim();
  return schemaName
    ? `${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`
    : quoteIdentifier(tableName);
}

function normalizeSqlFragment(value: string) {
  return value.trim().replace(/;+\s*$/g, "");
}

function normalizeColumns(value: string) {
  const columns = splitCsv(value);

  if (columns.length === 0 || columns.includes("*")) {
    return "*";
  }

  return columns.map((column) => quoteIdentifier(column)).join(", ");
}

function expressionWithAlias(expression: string, alias: string) {
  const normalized = normalizeSqlFragment(expression);

  if (!normalized) {
    return "";
  }

  return /\s+as\s+/i.test(normalized) ? normalized : `${normalized} as ${quoteIdentifier(alias)}`;
}

function buildTableSql({
  schema,
  table,
  columns,
  whereClause,
  orderBy,
  orderDirection,
  maxRows,
}: {
  schema: string;
  table: string;
  columns: string;
  whereClause: string;
  orderBy: string;
  orderDirection: PostgreSqlOrderDirection;
  maxRows: number;
}) {
  const lines = [
    `select ${normalizeColumns(columns)}`,
    `from ${qualifyTable(schema, table)}`,
  ];
  const where = normalizeSqlFragment(whereClause);
  const order = normalizeSqlFragment(orderBy);

  if (where) {
    lines.push(`where ${where}`);
  }

  if (order) {
    lines.push(`order by ${quoteIdentifier(order)} ${orderDirection}`);
  }

  lines.push(`limit ${maxRows}`);
  return lines.join("\n");
}

function buildTimeseriesSql({
  schema,
  table,
  timeColumn,
  interval,
  valueExpression,
  seriesColumns,
  whereClause,
  maxRows,
}: {
  schema: string;
  table: string;
  timeColumn: string;
  interval: string;
  valueExpression: string;
  seriesColumns: string;
  whereClause: string;
  maxRows: number;
}) {
  const timeIdentifier = quoteIdentifier(timeColumn);
  const valueSelect = expressionWithAlias(valueExpression, "value");
  const series = splitCsv(seriesColumns);
  const selectFields = [
    `$__timeGroupAlias(${timeIdentifier}, '${interval.trim()}')`,
    ...series.map((column) => quoteIdentifier(column)),
    valueSelect,
  ].filter(Boolean);
  const where = normalizeSqlFragment(whereClause);
  const whereParts = [`$__timeFilter(${timeIdentifier})`, where].filter(Boolean);
  const groupBy = ["1", ...series.map((_column, index) => String(index + 2))];

  if (!timeIdentifier) {
    throw new Error("Time column is required for time-series queries.");
  }

  if (!valueSelect) {
    throw new Error("Value expression is required for time-series queries.");
  }

  return [
    `select ${selectFields.join(", ")}`,
    `from ${qualifyTable(schema, table)}`,
    `where ${whereParts.join(" and ")}`,
    `group by ${groupBy.join(", ")}`,
    "order by 1",
    `limit ${maxRows}`,
  ].join("\n");
}

function buildTimeRange(lookback: string) {
  const to = new Date();
  const from = new Date(to.getTime() - parseDurationMs(lookback, "Lookback"));

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export function PostgreSqlConnectionExplore({
  connectionInstance,
}: ConnectionExploreProps) {
  const defaultSchema = readConfigString(connectionInstance.publicConfig, "defaultSchema", "public");
  const defaultMaxRows = readConfigNumber(connectionInstance.publicConfig, "rowLimit", 1000);
  const statementTimeoutMs = readConfigNumber(
    connectionInstance.publicConfig,
    "statementTimeoutMs",
    30000,
  );
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
  const dedupeInFlight =
    connectionInstance.publicConfig.dedupeInFlight !== false;
  const [editorMode, setEditorMode] = useState<PostgreSqlEditorMode>("builder");
  const [queryShape, setQueryShape] = useState<PostgreSqlQueryShape>("table");
  const [schema, setSchema] = useState(defaultSchema);
  const [table, setTable] = useState("");
  const [columns, setColumns] = useState("*");
  const [whereClause, setWhereClause] = useState("");
  const [orderBy, setOrderBy] = useState("");
  const [orderDirection, setOrderDirection] = useState<PostgreSqlOrderDirection>("asc");
  const [timeColumn, setTimeColumn] = useState("created_at");
  const [seriesColumns, setSeriesColumns] = useState("");
  const [valueExpression, setValueExpression] = useState("count(*)");
  const [interval, setInterval] = useState(defaultInterval);
  const [lookback, setLookback] = useState(defaultTimeseriesLookback);
  const [maxRows, setMaxRows] = useState(defaultMaxRows);
  const [parametersText, setParametersText] = useState("");
  const [sqlText, setSqlText] = useState("");

  const generatedSql = useMemo(() => {
    try {
      if (queryShape === "timeseries") {
        return buildTimeseriesSql({
          schema,
          table,
          timeColumn,
          interval,
          valueExpression,
          seriesColumns,
          whereClause,
          maxRows,
        });
      }

      return buildTableSql({
        schema,
        table,
        columns,
        whereClause,
        orderBy,
        orderDirection,
        maxRows,
      });
    } catch (error) {
      return error instanceof Error ? error.message : "Unable to build SQL.";
    }
  }, [
    columns,
    interval,
    maxRows,
    orderBy,
    orderDirection,
    queryShape,
    schema,
    seriesColumns,
    table,
    timeColumn,
    valueExpression,
    whereClause,
  ]);

  const activeSql = editorMode === "builder" ? generatedSql : sqlText;
  const queryMutation = useMutation({
    mutationFn: async () => {
      const parameters = parseConnectionQueryParameters(parametersText);
      const sql = normalizeSqlFragment(activeSql);

      if (!sql) {
        throw new Error("SQL is required.");
      }

      if (editorMode === "builder" && !table.trim()) {
        throw new Error("Table is required.");
      }

      const query: PostgreSqlConnectionQuery = {
        kind: queryShape === "timeseries" ? "sql-timeseries" : "sql-table",
        sql,
        maxRows,
        parameters,
        ...(queryShape === "timeseries" && editorMode === "builder"
          ? {
              timeField: "time",
              valueField: "value",
              seriesFields: splitCsv(seriesColumns),
            }
          : {}),
      };

      return queryConnection<PostgreSqlConnectionQuery>({
        connectionUid: connectionInstance.uid,
        query,
        timeRange: queryShape === "timeseries" ? buildTimeRange(lookback) : undefined,
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle>PostgreSQL Explore</CardTitle>
          </div>
          <CardDescription>
            Build and run PostgreSQL queries through the selected backend-managed data source.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_170px_170px_150px]">
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 py-2">
              <div className="text-xs font-medium text-muted-foreground">Data source</div>
              <div className="mt-1 truncate text-sm font-semibold text-foreground">
                {connectionInstance.name}
              </div>
              <div className="truncate font-mono text-[11px] text-muted-foreground">
                {connectionInstance.uid}
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
              <span className="text-xs font-medium text-muted-foreground">Editor</span>
              <Select
                value={editorMode}
                onChange={(event) => setEditorMode(event.target.value as PostgreSqlEditorMode)}
              >
                <option value="builder">Builder</option>
                <option value="sql">SQL</option>
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Result shape</span>
              <Select
                value={queryShape}
                onChange={(event) => setQueryShape(event.target.value as PostgreSqlQueryShape)}
              >
                <option value="table">Table</option>
                <option value="timeseries">Time series</option>
              </Select>
            </label>
            <div className="flex items-end">
              <Button
                type="button"
                className="w-full"
                disabled={queryMutation.isPending || !activeSql.trim()}
                onClick={() => queryMutation.mutate()}
              >
                {queryMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Run query
              </Button>
            </div>
          </div>

          {editorMode === "builder" ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Card className="bg-background/25">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Table2 className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">Query builder</CardTitle>
                  </div>
                  <CardDescription>
                    Enter table, projection, filters, and time-series options. The SQL preview is
                    generated from these fields.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Schema</span>
                      <Input value={schema} onChange={(event) => setSchema(event.target.value)} />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Table</span>
                      <Input
                        value={table}
                        onChange={(event) => setTable(event.target.value)}
                        placeholder="orders"
                      />
                    </label>
                  </div>

                  {queryShape === "table" ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-1.5 md:col-span-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Columns
                        </span>
                        <Input
                          value={columns}
                          onChange={(event) => setColumns(event.target.value)}
                          placeholder="*, id, created_at, amount"
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          Order by
                        </span>
                        <Input
                          value={orderBy}
                          onChange={(event) => setOrderBy(event.target.value)}
                          placeholder="created_at"
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          Direction
                        </span>
                        <Select
                          value={orderDirection}
                          onChange={(event) =>
                            setOrderDirection(event.target.value as PostgreSqlOrderDirection)
                          }
                        >
                          <option value="asc">Ascending</option>
                          <option value="desc">Descending</option>
                        </Select>
                      </label>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          Time column
                        </span>
                        <Input
                          value={timeColumn}
                          onChange={(event) => setTimeColumn(event.target.value)}
                          placeholder="created_at"
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          Group interval
                        </span>
                        <Input
                          value={interval}
                          onChange={(event) => setInterval(event.target.value)}
                          placeholder="5m"
                        />
                      </label>
                      <label className="space-y-1.5 md:col-span-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Value expression
                        </span>
                        <Input
                          value={valueExpression}
                          onChange={(event) => setValueExpression(event.target.value)}
                          placeholder="count(*)"
                        />
                      </label>
                      <label className="space-y-1.5 md:col-span-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Series columns
                        </span>
                        <Input
                          value={seriesColumns}
                          onChange={(event) => setSeriesColumns(event.target.value)}
                          placeholder="status, region"
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          Lookback
                        </span>
                        <Input
                          value={lookback}
                          onChange={(event) => setLookback(event.target.value)}
                          placeholder="6h"
                        />
                      </label>
                    </div>
                  )}

                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Filter SQL
                    </span>
                    <Textarea
                      className="min-h-20 font-mono text-xs"
                      value={whereClause}
                      onChange={(event) => setWhereClause(event.target.value)}
                      placeholder="account_id = :account_id"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Max rows</span>
                      <Input
                        type="number"
                        min={1}
                        max={100000}
                        value={maxRows}
                        onChange={(event) =>
                          setMaxRows(Math.max(1, Number(event.target.value) || 1))
                        }
                      />
                    </label>
                    <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
                      Statement timeout: {statementTimeoutMs.toLocaleString()} ms.
                      <br />
                      Metadata cache: {metadataCacheTtlMs.toLocaleString()} ms.
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background/25">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">Generated SQL</CardTitle>
                  </div>
                  <CardDescription>
                    This is the SQL payload sent to the PostgreSQL adapter.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="min-h-56 overflow-auto rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/50 p-4 font-mono text-xs leading-6 text-foreground">
                    <code>{generatedSql}</code>
                  </pre>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="bg-background/25">
              <CardHeader>
                <CardTitle className="text-base">SQL editor</CardTitle>
                <CardDescription>
                  Enter SQL directly. The adapter still owns authorization, macros, row limits,
                  timeout, execution, and frame conversion.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  className="min-h-72 font-mono text-xs"
                  value={sqlText}
                  onChange={(event) => setSqlText(event.target.value)}
                  placeholder="select * from public.orders limit 100"
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Max rows</span>
                    <Input
                      type="number"
                      min={1}
                      max={100000}
                      value={maxRows}
                      onChange={(event) =>
                        setMaxRows(Math.max(1, Number(event.target.value) || 1))
                      }
                    />
                  </label>
                  {queryShape === "timeseries" ? (
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Lookback</span>
                      <Input
                        value={lookback}
                        onChange={(event) => setLookback(event.target.value)}
                        placeholder="6h"
                      />
                    </label>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          )}

          <label className="block space-y-2 text-sm">
            <span className="font-medium text-foreground">Parameters</span>
            <Textarea
              className="min-h-20 font-mono text-xs"
              value={parametersText}
              onChange={(event) => setParametersText(event.target.value)}
              placeholder={"account_id=acct_123\nmin_amount=100"}
            />
            <span className="block text-xs leading-5 text-muted-foreground">
              Optional key=value lines. Use placeholders such as `:account_id` in SQL.
            </span>
          </label>
        </CardContent>
      </Card>

      {queryMutation.error ? (
        <Card>
          <CardContent className="flex items-start gap-3 py-5 text-sm text-danger">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {queryMutation.error instanceof Error
                ? queryMutation.error.message
                : "PostgreSQL query failed."}
            </span>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Query Result</CardTitle>
          <CardDescription>
            Normalized frame response returned by the PostgreSQL adapter.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {summaryBadges.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {summaryBadges.map((badge) => (
                <Badge key={badge} variant="neutral">
                  {badge}
                </Badge>
              ))}
            </div>
          ) : null}
          {queryMutation.data ? (
            <>
              <ConnectionFramePreview frame={firstFrame} />
              <pre className="max-h-80 overflow-auto rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/50 p-4 font-mono text-xs leading-6 text-foreground">
                <code>{formatConnectionQueryJson(queryMutation.data)}</code>
              </pre>
            </>
          ) : (
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 p-4 text-sm text-muted-foreground">
              Run a query to see the response.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
