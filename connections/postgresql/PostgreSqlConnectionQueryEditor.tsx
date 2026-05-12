import type { ConnectionQueryEditorProps } from "@/connections/types";
import {
  ConnectionQueryEditorSection,
  QuerySqlField,
  QueryTextField,
} from "@/connections/components/ConnectionQueryEditorFields";

import {
  POSTGRESQL_DEFAULT_SQL_TABLE_QUERY,
  type PostgreSqlConnectionQuery,
  type PostgreSqlPublicConfig,
} from "./index";

const SQL_QUERY_KINDS = new Set([
  "sql",
  "sql-table",
  "sql-time-series",
  "sql-timeseries",
]);
const SCHEMA_QUERY_KINDS = new Set(["schema-tables", "schema-columns"]);

function readPublicConfig(value: unknown): PostgreSqlPublicConfig {
  return value && typeof value === "object" ? (value as PostgreSqlPublicConfig) : {};
}

function readQueryStringField(
  value: PostgreSqlConnectionQuery,
  key: "schema" | "sql" | "table",
) {
  const candidate = value as Record<string, unknown>;
  return typeof candidate[key] === "string" ? candidate[key] : undefined;
}

function resolveQueryKind(
  value: PostgreSqlConnectionQuery,
  queryModelId: string | undefined,
): PostgreSqlConnectionQuery["kind"] {
  if (queryModelId && (SQL_QUERY_KINDS.has(queryModelId) || SCHEMA_QUERY_KINDS.has(queryModelId))) {
    return queryModelId as PostgreSqlConnectionQuery["kind"];
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
): PostgreSqlConnectionQuery {
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

export function PostgreSqlConnectionQueryEditor({
  connectionInstance,
  connectionType,
  disabled = false,
  onChange,
  queryModel,
  value,
}: ConnectionQueryEditorProps<PostgreSqlConnectionQuery>) {
  const publicConfig = readPublicConfig(connectionInstance?.publicConfig);
  const queryKind = resolveQueryKind(value, queryModel?.id);
  const connectionLabel = connectionType?.title ?? "PostgreSQL";
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
          description="Reads safe PostgreSQL-compatible catalog metadata through the backend adapter."
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

  return (
    <div className="space-y-5">
      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">Configured source</div>
        <div className="mt-1 break-words">{configuredSourceLabel}</div>
      </div>

      <ConnectionQueryEditorSection
        title={queryKind === "sql-time-series" || queryKind === "sql-timeseries" ? "Time-series SQL" : "SQL"}
        description={
          queryKind === "sql-time-series" || queryKind === "sql-timeseries"
            ? "Uses the top-level connection time range and returns a normalized tabular frame."
            : "Executes PostgreSQL-compatible SQL and returns a normalized tabular frame."
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
            } as PostgreSqlConnectionQuery);
          }}
          disabled={disabled}
          placeholder={
            queryKind === "sql-time-series" || queryKind === "sql-timeseries"
              ? "select time, value\nfrom public.metrics\nwhere $__timeFilter(time)\norder by time"
              : POSTGRESQL_DEFAULT_SQL_TABLE_QUERY
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
