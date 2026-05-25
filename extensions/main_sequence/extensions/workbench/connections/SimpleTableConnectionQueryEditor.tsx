import type { ConnectionQueryEditorProps } from "@/connections/types";
import {
  ConnectionQueryEditorSection,
  QueryJsonRecordField,
  QueryNumberField,
  QuerySqlField,
} from "@/connections/components/ConnectionQueryEditorFields";

import {
  DEFAULT_MAIN_SEQUENCE_META_TABLE_ROW_LIMIT,
  type MainSequenceMetaTableConnectionPublicConfig,
  type MainSequenceMetaTableConnectionQuery,
} from "./simpleTableConnection";

function normalizePositiveInteger(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
}

function normalizeUidString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readPublicConfig(value: unknown): MainSequenceMetaTableConnectionPublicConfig {
  return value && typeof value === "object"
    ? (value as MainSequenceMetaTableConnectionPublicConfig)
    : {};
}

export function MetaTableConnectionQueryEditor({
  connectionInstance,
  disabled = false,
  onChange,
  value,
}: ConnectionQueryEditorProps<MainSequenceMetaTableConnectionQuery>) {
  const publicConfig = readPublicConfig(connectionInstance?.publicConfig);
  const metaTableUid = normalizeUidString(publicConfig.metaTableUid);
  const defaultLimit =
    normalizePositiveInteger(publicConfig.defaultLimit) ?? DEFAULT_MAIN_SEQUENCE_META_TABLE_ROW_LIMIT;
  const query: MainSequenceMetaTableConnectionQuery = {
    kind: "meta-table-compiled-sql",
    sql: value.sql ?? "",
    maxRows: value.maxRows,
    parameters: value.parameters,
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">Configured source</div>
        <div className="mt-1 break-words">
          {metaTableUid
            ? `${publicConfig.metaTableLabel ?? "Meta Table"} · ${metaTableUid}`
            : "No Meta Table uid is stored on this connection instance."}
        </div>
      </div>

      <ConnectionQueryEditorSection
        title="Meta Table SQL"
        description="The backend expands {{meta_table}} to the configured table and validates read-only SQL."
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
          placeholder={"select *\nfrom {{meta_table}}\nlimit 100"}
          help="Read-only SQL sent to the Meta Table adapter."
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
              parameters: parameters as MainSequenceMetaTableConnectionQuery["parameters"],
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
