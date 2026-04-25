import type { ConnectionQueryEditorProps } from "@/connections/types";
import {
  ConnectionQueryEditorSection,
  QueryJsonRecordField,
  QueryNumberField,
  QuerySqlField,
} from "@/connections/components/ConnectionQueryEditorFields";

import {
  DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_ROW_LIMIT,
  type MainSequenceSimpleTableConnectionPublicConfig,
  type MainSequenceSimpleTableConnectionQuery,
} from "./simpleTableConnection";

function normalizePositiveInteger(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
}

function readPublicConfig(value: unknown): MainSequenceSimpleTableConnectionPublicConfig {
  return value && typeof value === "object"
    ? (value as MainSequenceSimpleTableConnectionPublicConfig)
    : {};
}

export function SimpleTableConnectionQueryEditor({
  connectionInstance,
  disabled = false,
  onChange,
  value,
}: ConnectionQueryEditorProps<MainSequenceSimpleTableConnectionQuery>) {
  const publicConfig = readPublicConfig(connectionInstance?.publicConfig);
  const simpleTableId = normalizePositiveInteger(publicConfig.simpleTableId);
  const defaultLimit =
    normalizePositiveInteger(publicConfig.defaultLimit) ?? DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_ROW_LIMIT;
  const query: MainSequenceSimpleTableConnectionQuery = {
    kind: "simple-table-sql",
    sql: value.sql ?? "",
    maxRows: value.maxRows,
    parameters: value.parameters,
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">Configured source</div>
        <div className="mt-1 break-words">
          {simpleTableId
            ? `${publicConfig.simpleTableLabel ?? "Simple Table"} · ${simpleTableId}`
            : "No Simple Table id is stored on this connection instance."}
        </div>
      </div>

      <ConnectionQueryEditorSection
        title="Simple Table SQL"
        description="The backend expands {{simple_table}} to the configured table and validates read-only SQL."
      >
        <QuerySqlField
          label="SQL"
          value={query.sql}
          onChange={(sql) => {
            onChange({
              ...query,
              sql: sql ?? "",
            });
          }}
          disabled={disabled}
          placeholder={"select *\nfrom {{simple_table}}\nlimit 100"}
          help="Read-only SQL sent to the Simple Table adapter."
        />
        <QueryNumberField
          label="SQL max rows"
          value={query.maxRows}
          min={1}
          onChange={(maxRows) => {
            onChange({
              ...query,
              maxRows,
            });
          }}
          disabled={disabled}
          placeholder={String(defaultLimit)}
          help="Optional SQL-specific row cap. If omitted, the request maxRows and connection default apply."
        />
        <QueryJsonRecordField
          label="Parameters"
          value={query.parameters}
          onChange={(parameters) => {
            onChange({
              ...query,
              parameters: parameters as MainSequenceSimpleTableConnectionQuery["parameters"],
            });
          }}
          disabled={disabled}
          placeholder={"{\n  \"status\": \"active\"\n}"}
          help="Optional named parameter object passed to the backend SQL adapter."
        />
      </ConnectionQueryEditorSection>
    </div>
  );
}
