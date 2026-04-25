import type { ConnectionQueryEditorProps } from "@/connections/types";
import {
  ConnectionQueryEditorSection,
  QueryJsonRecordField,
  QueryNumberField,
  QuerySqlField,
  QueryStringListField,
  QueryTextField,
} from "@/connections/components/ConnectionQueryEditorFields";

import type { PostgreSqlConnectionQuery, PostgreSqlPublicConfig } from "./index";

function readPublicConfig(value: unknown): PostgreSqlPublicConfig {
  return value && typeof value === "object" ? (value as PostgreSqlPublicConfig) : {};
}

function readQueryKind(
  queryModelId: string | undefined,
  value: PostgreSqlConnectionQuery,
): PostgreSqlConnectionQuery["kind"] {
  if (
    queryModelId === "sql-table" ||
    queryModelId === "sql-timeseries" ||
    queryModelId === "schema-tables" ||
    queryModelId === "schema-columns"
  ) {
    return queryModelId;
  }

  return value.kind ?? "sql-table";
}

function readParameters(value: PostgreSqlConnectionQuery) {
  return "parameters" in value ? value.parameters : undefined;
}

export function PostgreSqlConnectionQueryEditor({
  connectionInstance,
  disabled = false,
  onChange,
  queryModel,
  value,
}: ConnectionQueryEditorProps<PostgreSqlConnectionQuery>) {
  const publicConfig = readPublicConfig(connectionInstance?.publicConfig);
  const queryKind = readQueryKind(queryModel?.id, value);

  return (
    <div className="space-y-5">
      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">Configured source</div>
        <div className="mt-1 break-words">
          {[publicConfig.database, publicConfig.host].filter(Boolean).join(" · ") ||
            connectionInstance?.name ||
            "PostgreSQL connection"}
        </div>
      </div>

      {queryKind === "sql-table" ? (
        <ConnectionQueryEditorSection
          title="SQL table query"
          description="Returns a tabular frame from read-only SQL."
        >
          <QuerySqlField
            label="SQL"
            value={"sql" in value ? value.sql : ""}
            onChange={(sql) => {
              onChange({
                kind: "sql-table",
                sql: sql ?? "",
                maxRows: "maxRows" in value ? value.maxRows : undefined,
                parameters: readParameters(value),
              });
            }}
            disabled={disabled}
            placeholder={"select *\nfrom public.orders\nlimit 100"}
            help="Read-only SQL sent to the PostgreSQL backend adapter."
          />
          <QueryNumberField
            label="SQL max rows"
            value={"maxRows" in value ? value.maxRows : undefined}
            min={1}
            onChange={(maxRows) => {
              onChange({
                kind: "sql-table",
                sql: "sql" in value ? value.sql : "",
                maxRows,
                parameters: readParameters(value),
              });
            }}
            disabled={disabled}
            placeholder={publicConfig.rowLimit ? String(publicConfig.rowLimit) : "1000"}
            help="Optional SQL-specific row cap."
          />
          <QueryJsonRecordField
            label="Parameters"
            value={readParameters(value)}
            onChange={(parameters) => {
              onChange({
                kind: "sql-table",
                sql: "sql" in value ? value.sql : "",
                maxRows: "maxRows" in value ? value.maxRows : undefined,
                parameters: parameters as Record<string, string | number | boolean | null> | undefined,
              });
            }}
            disabled={disabled}
            placeholder={"{\n  \"customer_id\": 123\n}"}
            help="Optional named SQL parameters."
          />
        </ConnectionQueryEditorSection>
      ) : null}

      {queryKind === "sql-timeseries" ? (
        <ConnectionQueryEditorSection
          title="SQL time-series query"
          description="Returns a time-series frame when the backend can map time and value columns."
        >
          <QuerySqlField
            label="SQL"
            value={"sql" in value ? value.sql : ""}
            onChange={(sql) => {
              onChange({
                kind: "sql-timeseries",
                sql: sql ?? "",
                maxRows: "maxRows" in value ? value.maxRows : undefined,
                parameters: readParameters(value),
                timeField: "timeField" in value ? value.timeField : undefined,
                valueFields: "valueFields" in value ? value.valueFields : undefined,
                seriesFields: "seriesFields" in value ? value.seriesFields : undefined,
                unit: "unit" in value ? value.unit : undefined,
              });
            }}
            disabled={disabled}
            placeholder={"select\n  $__timeGroupAlias(created_at, '1 hour'),\n  count(*) as value\nfrom public.orders\nwhere $__timeFilter(created_at)\ngroup by 1\norder by 1"}
            help="Read-only SQL with time macros or explicit time/value fields."
          />
          <QueryTextField
            label="Time field"
            value={"timeField" in value ? value.timeField : undefined}
            onChange={(timeField) => {
              onChange({
                ...(value as Extract<PostgreSqlConnectionQuery, { kind: "sql-timeseries" }>),
                kind: "sql-timeseries",
                timeField,
              });
            }}
            disabled={disabled}
            placeholder="time"
            help="Name of the returned timestamp column."
          />
          <QueryStringListField
            label="Value fields"
            value={
              "valueFields" in value && value.valueFields
                ? value.valueFields
                : "valueField" in value && value.valueField
                  ? [value.valueField]
                  : undefined
            }
            onChange={(valueFields) => {
              onChange({
                ...(value as Extract<PostgreSqlConnectionQuery, { kind: "sql-timeseries" }>),
                kind: "sql-timeseries",
                valueField: undefined,
                valueFields,
              });
            }}
            disabled={disabled}
            placeholder="value"
            help="Numeric column names to publish as series values."
          />
          <QueryStringListField
            label="Series fields"
            value={
              "seriesFields" in value && value.seriesFields
                ? value.seriesFields
                : "seriesField" in value && value.seriesField
                  ? [value.seriesField]
                  : undefined
            }
            onChange={(seriesFields) => {
              onChange({
                ...(value as Extract<PostgreSqlConnectionQuery, { kind: "sql-timeseries" }>),
                kind: "sql-timeseries",
                seriesField: undefined,
                seriesFields,
              });
            }}
            disabled={disabled}
            placeholder="region"
            help="Optional fields used as series labels."
          />
          <QueryTextField
            label="Unit"
            value={"unit" in value ? value.unit : undefined}
            onChange={(unit) => {
              onChange({
                ...(value as Extract<PostgreSqlConnectionQuery, { kind: "sql-timeseries" }>),
                kind: "sql-timeseries",
                unit,
              });
            }}
            disabled={disabled}
            placeholder="count"
            help="Optional display unit passed through frame metadata."
          />
          <QueryNumberField
            label="SQL max rows"
            value={"maxRows" in value ? value.maxRows : undefined}
            min={1}
            onChange={(maxRows) => {
              onChange({
                ...(value as Extract<PostgreSqlConnectionQuery, { kind: "sql-timeseries" }>),
                kind: "sql-timeseries",
                maxRows,
              });
            }}
            disabled={disabled}
            placeholder={publicConfig.rowLimit ? String(publicConfig.rowLimit) : "1000"}
            help="Optional SQL-specific row cap."
          />
          <QueryJsonRecordField
            label="Parameters"
            value={readParameters(value)}
            onChange={(parameters) => {
              onChange({
                ...(value as Extract<PostgreSqlConnectionQuery, { kind: "sql-timeseries" }>),
                kind: "sql-timeseries",
                parameters: parameters as Record<string, string | number | boolean | null> | undefined,
              });
            }}
            disabled={disabled}
            placeholder={"{\n  \"region\": \"us-east-1\"\n}"}
            help="Optional named SQL parameters."
          />
        </ConnectionQueryEditorSection>
      ) : null}

      {queryKind === "schema-tables" ? (
        <ConnectionQueryEditorSection title="Schema tables">
          <QueryTextField
            label="Schema"
            value={"schema" in value ? value.schema : undefined}
            onChange={(schema) => {
              onChange({
                kind: "schema-tables",
                schema,
              });
            }}
            disabled={disabled}
            placeholder={publicConfig.defaultSchema ?? "public"}
            help="Optional schema name. The backend uses the configured default when omitted."
          />
        </ConnectionQueryEditorSection>
      ) : null}

      {queryKind === "schema-columns" ? (
        <ConnectionQueryEditorSection title="Schema columns">
          <QueryTextField
            label="Schema"
            value={"schema" in value ? value.schema : undefined}
            onChange={(schema) => {
              onChange({
                kind: "schema-columns",
                schema,
                table: "table" in value ? value.table : "",
              });
            }}
            disabled={disabled}
            placeholder={publicConfig.defaultSchema ?? "public"}
            help="Optional schema name. The backend uses the configured default when omitted."
          />
          <QueryTextField
            label="Table"
            value={"table" in value ? value.table : ""}
            onChange={(table) => {
              onChange({
                kind: "schema-columns",
                schema: "schema" in value ? value.schema : undefined,
                table: table ?? "",
              });
            }}
            disabled={disabled}
            placeholder="orders"
            help="Table whose column metadata should be loaded."
          />
        </ConnectionQueryEditorSection>
      ) : null}
    </div>
  );
}
