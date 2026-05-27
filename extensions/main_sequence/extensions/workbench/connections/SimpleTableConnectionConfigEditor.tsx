import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ConnectionConfigEditorProps } from "@/connections/types";

import {
  fetchMetaTableDetail,
  listMetaTables,
  type MetaTableColumnRecord,
  type MetaTableDetail,
  type MetaTableRecord,
} from "../../../common/api";
import { DataNodePreviewTable } from "../widgets/data-node-shared/DataNodePreviewTable";
import type { MainSequenceMetaTableConnectionPublicConfig } from "./simpleTableConnection";
import {
  DEFAULT_MAIN_SEQUENCE_META_TABLE_QUERY_CACHE_TTL_MS,
  DEFAULT_MAIN_SEQUENCE_META_TABLE_ROW_LIMIT,
  DEFAULT_MAIN_SEQUENCE_META_TABLE_STATEMENT_TIMEOUT_MS,
} from "./simpleTableConnection";

function normalizeUidString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getMetaTableLabel(table?: MetaTableRecord | MetaTableDetail | null) {
  const candidates = [
    table?.storage_hash,
    table?.identifier,
    table?.source_class_name,
    typeof table?.display_name === "string" ? table.display_name : undefined,
    typeof table?.name === "string" ? table.name : undefined,
  ];

  return candidates.find((value) => typeof value === "string" && value.trim())?.trim() ??
    (table?.uid ? `Meta Table ${table.uid}` : "Selected Meta Table");
}

function getMetaTableColumns(detail?: MetaTableDetail | null): MetaTableColumnRecord[] {
  if (!detail) {
    return [];
  }

  if (Array.isArray(detail.columns) && detail.columns.length > 0) {
    return detail.columns;
  }

  const metadata = detail.sourcetableconfiguration?.columns_metadata;

  if (!Array.isArray(metadata)) {
    return [];
  }

  return metadata.flatMap((column, index) => {
    if (typeof column.column_name !== "string" || !column.column_name.trim()) {
      return [];
    }

    return [
      {
        id: index,
        name: column.column_name,
        label: column.label ?? column.column_name,
        logical_name: column.label ?? column.column_name,
        data_type: column.dtype ?? "unknown",
        backend_type: column.dtype ?? "unknown",
        nullable: true,
        primary_key: false,
        unique: false,
      } satisfies MetaTableColumnRecord,
    ];
  });
}

function updateSelectedMetaTableConfig(
  config: MainSequenceMetaTableConnectionPublicConfig,
  table?: MetaTableRecord | MetaTableDetail | null,
): MainSequenceMetaTableConnectionPublicConfig {
  if (!table) {
    return {
      ...config,
      metaTableUid: undefined,
      metaTableIdentifier: undefined,
      metaTableLabel: undefined,
      metaTableStorageHash: undefined,
    };
  }

  return {
    ...config,
    metaTableUid: table.uid?.trim() || undefined,
    metaTableIdentifier: table.identifier ?? undefined,
    metaTableLabel: getMetaTableLabel(table),
    metaTableStorageHash: table.storage_hash ?? undefined,
  };
}

function buildSearchText(table: MetaTableRecord) {
  return [
    table.uid ?? "",
    table.storage_hash ?? "",
    table.identifier ?? "",
    table.source_class_name ?? "",
    table.description ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function MetaTableConnectionConfigEditor({
  value,
  onChange,
  disabled,
}: ConnectionConfigEditorProps<MainSequenceMetaTableConnectionPublicConfig>) {
  const metaTableUid = normalizeUidString(value.metaTableUid);
  const [searchValue, setSearchValue] = useState("");
  const deferredSearchValue = useDeferredValue(searchValue);
  const metaTablesQuery = useQuery({
    queryKey: ["main_sequence", "connections", "meta_table", "list"],
    queryFn: () => listMetaTables({ limit: 100 }),
    staleTime: 300_000,
  });
  const metaTableDetailQuery = useQuery({
    queryKey: ["main_sequence", "connections", "meta_table", "detail", metaTableUid],
    queryFn: () => fetchMetaTableDetail(metaTableUid!),
    enabled: Boolean(metaTableUid),
    staleTime: 300_000,
  });
  const metaTables = metaTablesQuery.data?.results ?? [];
  const selectedMetaTable = metaTableDetailQuery.data ??
    metaTables.find((table) => table.uid === metaTableUid) ??
    (metaTableUid
      ? {
          id: 0,
          uid: metaTableUid,
          identifier: value.metaTableIdentifier ?? null,
          storage_hash: value.metaTableStorageHash,
        }
      : null);
  const filteredTables = useMemo(() => {
    const normalizedSearch = deferredSearchValue.trim().toLowerCase();

    if (!normalizedSearch) {
      return metaTables;
    }

    return metaTables.filter((table) => buildSearchText(table).includes(normalizedSearch));
  }, [deferredSearchValue, metaTables]);
  const columns = useMemo(
    () => getMetaTableColumns(metaTableDetailQuery.data),
    [metaTableDetailQuery.data],
  );

  useEffect(() => {
    if (!metaTableDetailQuery.data) {
      return;
    }

    const nextConfig = updateSelectedMetaTableConfig(value, metaTableDetailQuery.data);

    if (
      nextConfig.metaTableLabel === value.metaTableLabel &&
      nextConfig.metaTableStorageHash === value.metaTableStorageHash &&
      nextConfig.metaTableIdentifier === value.metaTableIdentifier
    ) {
      return;
    }

    onChange(nextConfig);
  }, [onChange, metaTableDetailQuery.data, value]);

  return (
    <div className="space-y-5 border-t border-border/70 pt-5">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Meta Table
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Search Meta Tables
            </span>
            <Input
              value={searchValue}
              disabled={disabled}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search by storage hash, identifier, source class, or UID"
            />
          </label>

          <div className="max-h-72 overflow-auto rounded-[calc(var(--radius)-4px)] border border-border/70">
            {metaTablesQuery.isLoading ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Loading Meta Tables
              </div>
            ) : metaTablesQuery.isError ? (
              <div className="px-4 py-8 text-center text-sm text-danger">
                Unable to load Meta Tables.
              </div>
            ) : filteredTables.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No Meta Tables match the current search.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {filteredTables.map((table) => {
                  const selected = table.uid === metaTableUid;

                  return (
                    <button
                      key={table.uid}
                      type="button"
                      disabled={disabled}
                      className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/35 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => onChange(updateSelectedMetaTableConfig(value, table))}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {getMetaTableLabel(table)}
                        </span>
                        <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">
                          {table.uid?.trim() ? `uid ${table.uid.trim()}` : ""}
                          {table.identifier ? ` · ${table.identifier}` : ""}
                        </span>
                      </span>
                      {selected ? <Badge variant="neutral">Selected</Badge> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/35 p-4 text-sm">
          {selectedMetaTable ? (
            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Selected
                </div>
                <div className="mt-1 font-medium text-foreground">
                  {getMetaTableLabel(selectedMetaTable)}
                </div>
              </div>
              <div className="grid gap-3 text-xs text-muted-foreground">
                <div>
                  <div className="font-semibold uppercase tracking-[0.12em]">UID</div>
                  <div className="mt-1 break-all font-mono text-foreground">
                    {selectedMetaTable.uid}
                  </div>
                </div>
                <div>
                  <div className="font-semibold uppercase tracking-[0.12em]">Storage hash</div>
                  <div className="mt-1 break-all font-mono text-foreground">
                    {selectedMetaTable.storage_hash ?? "Pending detail"}
                  </div>
                </div>
                <div>
                  <div className="font-semibold uppercase tracking-[0.12em]">Identifier</div>
                  <div className="mt-1 break-all font-mono text-foreground">
                    {selectedMetaTable.identifier ?? "Not set"}
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => onChange(updateSelectedMetaTableConfig(value))}
              >
                Clear selection
              </Button>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Select a Meta Table to configure this data source.
            </div>
          )}
        </div>
      </div>

      {metaTableUid ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-foreground">Columns</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Detail metadata from the selected Meta Table.
              </div>
            </div>
            {metaTableDetailQuery.isFetching ? <Badge variant="neutral">Loading detail</Badge> : null}
          </div>
          <DataNodePreviewTable
            columns={["name", "label", "backend_type", "nullable", "primary_key"]}
            rows={columns.map((column) => ({
              name: column.name,
              label: column.label,
              backend_type: column.backend_type ?? column.data_type,
              nullable: column.nullable,
              primary_key: column.primary_key,
            }))}
            emptyMessage="No column metadata is available for this Meta Table."
            maxRows={100}
          />
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Default row limit</span>
          <Input
            type="number"
            min={1}
            value={value.defaultLimit ?? DEFAULT_MAIN_SEQUENCE_META_TABLE_ROW_LIMIT}
            disabled={disabled}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              onChange({
                ...value,
                defaultLimit:
                  Number.isFinite(parsed) && parsed > 0
                    ? Math.trunc(parsed)
                    : DEFAULT_MAIN_SEQUENCE_META_TABLE_ROW_LIMIT,
              });
            }}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Statement timeout (ms)
          </span>
          <Input
            type="number"
            min={1}
            value={value.statementTimeoutMs ?? DEFAULT_MAIN_SEQUENCE_META_TABLE_STATEMENT_TIMEOUT_MS}
            disabled={disabled}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              onChange({
                ...value,
                statementTimeoutMs:
                  Number.isFinite(parsed) && parsed > 0
                    ? Math.trunc(parsed)
                    : DEFAULT_MAIN_SEQUENCE_META_TABLE_STATEMENT_TIMEOUT_MS,
              });
            }}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Query result cache</span>
          <Select
            value={value.queryCachePolicy ?? "safe"}
            disabled={disabled}
            onChange={(event) => {
              onChange({
                ...value,
                queryCachePolicy: event.target.value === "disabled" ? "disabled" : "safe",
              });
            }}
          >
            <option value="safe">Safe read queries</option>
            <option value="disabled">Disabled</option>
          </Select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Query cache TTL (ms)
          </span>
          <Input
            type="number"
            min={1}
            value={value.queryCacheTtlMs ?? DEFAULT_MAIN_SEQUENCE_META_TABLE_QUERY_CACHE_TTL_MS}
            disabled={disabled || value.queryCachePolicy === "disabled"}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              onChange({
                ...value,
                queryCacheTtlMs:
                  Number.isFinite(parsed) && parsed > 0
                    ? Math.trunc(parsed)
                    : DEFAULT_MAIN_SEQUENCE_META_TABLE_QUERY_CACHE_TTL_MS,
              });
            }}
          />
        </label>
      </div>

      <label className="flex max-w-2xl items-start gap-3 rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/35 p-4">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-border bg-background accent-primary"
          checked={value.dedupeInFlight !== false}
          disabled={disabled}
          onChange={(event) => {
            onChange({
              ...value,
              dedupeInFlight: event.target.checked,
            });
          }}
        />
        <span className="space-y-1">
          <span className="block text-sm font-medium text-foreground">
            Dedupe in-flight identical queries
          </span>
          <span className="block text-xs leading-5 text-muted-foreground">
            Share one running backend Meta Table SQL request when identical cache misses arrive
            at the same time.
          </span>
        </span>
      </label>
    </div>
  );
}
