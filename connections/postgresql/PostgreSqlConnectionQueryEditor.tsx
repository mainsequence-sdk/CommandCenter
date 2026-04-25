import type { ConnectionQueryEditorProps } from "@/connections/types";
import {
  ConnectionQueryEditorSection,
  QuerySqlField,
} from "@/connections/components/ConnectionQueryEditorFields";

import type { PostgreSqlConnectionQuery, PostgreSqlPublicConfig } from "./index";

function readPublicConfig(value: unknown): PostgreSqlPublicConfig {
  return value && typeof value === "object" ? (value as PostgreSqlPublicConfig) : {};
}

export function PostgreSqlConnectionQueryEditor({
  connectionInstance,
  disabled = false,
  onChange,
  value,
}: ConnectionQueryEditorProps<PostgreSqlConnectionQuery>) {
  const publicConfig = readPublicConfig(connectionInstance?.publicConfig);

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

      <ConnectionQueryEditorSection title="SQL">
        <QuerySqlField
          label="SQL"
          value={value.sql ?? ""}
          onChange={(sql) => {
            onChange({
              kind: "sql",
              sql: sql ?? "",
            });
          }}
          disabled={disabled}
          placeholder={"select *\nfrom public.orders\nlimit 100"}
          help="SQL sent to the PostgreSQL backend adapter."
        />
      </ConnectionQueryEditorSection>
    </div>
  );
}
