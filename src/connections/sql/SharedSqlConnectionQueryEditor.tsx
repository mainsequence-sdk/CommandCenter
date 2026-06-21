import type { ConnectionQueryEditorProps } from "@/connections/types";
import {
  ConnectionQueryEditorSection,
  QuerySqlField,
  QueryTextField,
} from "@/connections/components/ConnectionQueryEditorFields";

import type {
  SharedSqlConnectionQuery,
  SharedSqlPublicConfig,
  SharedSqlQueryKind,
} from "./sharedSqlConnection";

const SQL_QUERY_KINDS = new Set([
  "sql",
  "sql-table",
  "sql-time-series",
  "sql-timeseries",
]);
const SCHEMA_QUERY_KINDS = new Set(["schema-tables", "schema-columns"]);

function readPublicConfig(value: unknown): SharedSqlPublicConfig {
  return value && typeof value === "object" ? (value as SharedSqlPublicConfig) : {};
}

function readQueryStringField(
  value: SharedSqlConnectionQuery,
  key: "schema" | "sql" | "table",
) {
  const candidate = value as Record<string, unknown>;
  return typeof candidate[key] === "string" ? candidate[key] : undefined;
}

function resolveQueryKind(
  value: SharedSqlConnectionQuery,
  queryModelId: string | undefined,
): SharedSqlQueryKind {
  if (queryModelId && (SQL_QUERY_KINDS.has(queryModelId) || SCHEMA_QUERY_KINDS.has(queryModelId))) {
    return queryModelId as SharedSqlQueryKind;
  }

  if (SQL_QUERY_KINDS.has(value.kind) || SCHEMA_QUERY_KINDS.has(value.kind)) {
    return value.kind;
  }

  return "sql-table";
}

function createSchemaQuery(
  kind: "schema-tables" | "schema-columns",
  schema: string | undefined,
  table?: string,
): SharedSqlConnectionQuery {
  if (kind === "schema-columns") {
    return {
      kind,
      ...(schema ? { schema } : {}),
      table: table ?? "",
    };
  }

  return {
    kind,
    ...(schema ? { schema } : {}),
  };
}

function readDefaultSql(queryModel: ConnectionQueryEditorProps["queryModel"]) {
  const sql = queryModel?.defaultQuery?.sql;
  return typeof sql === "string" ? sql : undefined;
}

function isTimeSeriesKind(queryKind: SharedSqlQueryKind) {
  return queryKind === "sql-time-series" || queryKind === "sql-timeseries";
}

export function SharedSqlConnectionQueryEditor({
  connectionInstance,
  connectionType,
  disabled = false,
  onChange,
  queryModel,
  value,
}: ConnectionQueryEditorProps<SharedSqlConnectionQuery>) {
  const publicConfig = readPublicConfig(connectionInstance?.publicConfig);
  const queryKind = resolveQueryKind(value, queryModel?.id);
  const connectionLabel = connectionType?.title ?? "SQL";
  const configuredSourceLabel =
    [publicConfig.database, publicConfig.host].filter(Boolean).join(" · ") ||
    connectionInstance?.name ||
    `${connectionLabel} connection`;

  if (queryKind === "schema-tables" || queryKind === "schema-columns") {
    const schema = readQueryStringField(value, "schema");
    const table = readQueryStringField(value, "table");

    return (
      <div className="space-y-5">
        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">Configured source</div>
          <div className="mt-1 break-words">{configuredSourceLabel}</div>
        </div>

        <ConnectionQueryEditorSection
          title={queryKind === "schema-columns" ? "Schema columns" : "Schema tables"}
          description={`Reads safe ${connectionLabel} catalog metadata through the backend adapter.`}
        >
          <QueryTextField
            label="Schema"
            value={schema}
            onChange={(nextSchema) => {
              onChange(createSchemaQuery(queryKind, nextSchema, table));
            }}
            disabled={disabled}
            placeholder={publicConfig.defaultSchema ?? "public"}
            help="Optional schema name. Leave empty to use the connection defaultSchema."
          />
          {queryKind === "schema-columns" ? (
            <QueryTextField
              label="Table"
              value={table}
              onChange={(nextTable) => {
                onChange(createSchemaQuery(queryKind, schema, nextTable));
              }}
              disabled={disabled}
              placeholder="orders"
              help="Table name whose columns should be read from information_schema."
            />
          ) : null}
        </ConnectionQueryEditorSection>
      </div>
    );
  }

  const defaultSql = readDefaultSql(queryModel);
  const timeSeries = isTimeSeriesKind(queryKind);

  return (
    <div className="space-y-5">
      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">Configured source</div>
        <div className="mt-1 break-words">{configuredSourceLabel}</div>
      </div>

      <ConnectionQueryEditorSection
        title={timeSeries ? "Time-series SQL" : "SQL"}
        description={
          timeSeries
            ? "Uses the top-level connection time range and returns a normalized tabular frame."
            : `Executes ${connectionLabel} SQL and returns a normalized tabular frame.`
        }
      >
        <QuerySqlField
          label="SQL"
          value={readQueryStringField(value, "sql") ?? ""}
          onChange={(sql) => {
            onChange({
              ...(value as Record<string, unknown>),
              kind: queryKind,
              sql: sql ?? "",
            } as SharedSqlConnectionQuery);
          }}
          disabled={disabled}
          placeholder={
            timeSeries
              ? "select time, value\nfrom metrics\nwhere $__timeFilter(time)\norder by time"
              : defaultSql
          }
          help={
            queryKind === "sql-table"
              ? `SQL sent to the ${connectionLabel} backend adapter as query.kind='${queryKind}'. The default seed lists visible tables through information_schema.`
              : `SQL sent to the ${connectionLabel} backend adapter as query.kind='${queryKind}'.`
          }
        />
      </ConnectionQueryEditorSection>
    </div>
  );
}
