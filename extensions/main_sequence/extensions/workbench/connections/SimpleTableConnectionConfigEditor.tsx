import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ConnectionConfigEditorProps } from "@/connections/types";

import {
  fetchSimpleTableDetail,
  listSimpleTables,
  type SimpleTableColumnRecord,
  type SimpleTableDetail,
  type SimpleTableRecord,
} from "../../../common/api";
import { DataNodePreviewTable } from "../widgets/data-node-shared/DataNodePreviewTable";
import type { MainSequenceSimpleTableConnectionPublicConfig } from "./simpleTableConnection";
import {
  DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_QUERY_CACHE_TTL_MS,
  DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_ROW_LIMIT,
  DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_STATEMENT_TIMEOUT_MS,
} from "./simpleTableConnection";

function normalizePositiveInteger(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function getSimpleTableLabel(table?: SimpleTableRecord | SimpleTableDetail | null) {
  const candidates = [
    table?.storage_hash,
    table?.identifier,
    table?.source_class_name,
    typeof table?.display_name === "string" ? table.display_name : undefined,
    typeof table?.name === "string" ? table.name : undefined,
  ];

  return candidates.find((value) => typeof value === "string" && value.trim())?.trim() ??
    (table?.id ? `Simple Table ${table.id}` : "Selected Simple Table");
}

function getSimpleTableColumns(detail?: SimpleTableDetail | null): SimpleTableColumnRecord[] {
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
        attr_name: column.label ?? column.column_name,
        column_name: column.column_name,
        db_type: column.dtype ?? "unknown",
        is_pk: false,
        nullable: true,
        is_unique: false,
      } satisfies SimpleTableColumnRecord,
    ];
  });
}

function updateSelectedSimpleTableConfig(
  config: MainSequenceSimpleTableConnectionPublicConfig,
  table?: SimpleTableRecord | SimpleTableDetail | null,
): MainSequenceSimpleTableConnectionPublicConfig {
  if (!table) {
    return {
      ...config,
      simpleTableId: undefined,
      simpleTableIdentifier: undefined,
      simpleTableLabel: undefined,
      simpleTableStorageHash: undefined,
    };
  }

  return {
    ...config,
    simpleTableId: table.id,
    simpleTableIdentifier: table.identifier ?? undefined,
    simpleTableLabel: getSimpleTableLabel(table),
    simpleTableStorageHash: table.storage_hash ?? undefined,
  };
}

function buildSearchText(table: SimpleTableRecord) {
  return [
    String(table.id),
    table.storage_hash ?? "",
    table.identifier ?? "",
    table.source_class_name ?? "",
    table.description ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function SimpleTableConnectionConfigEditor({
  value,
  onChange,
  disabled,
}: ConnectionConfigEditorProps<MainSequenceSimpleTableConnectionPublicConfig>) {
  const simpleTableId = normalizePositiveInteger(value.simpleTableId);
  const [searchValue, setSearchValue] = useState("");
  const deferredSearchValue = useDeferredValue(searchValue);
  const simpleTablesQuery = useQuery({
    queryKey: ["main_sequence", "connections", "simple_table", "list"],
    queryFn: () => listSimpleTables({ limit: 100, offset: 0 }),
    staleTime: 300_000,
  });
  const simpleTableDetailQuery = useQuery({
    queryKey: ["main_sequence", "connections", "simple_table", "detail", simpleTableId],
    queryFn: () => fetchSimpleTableDetail(simpleTableId!),
    enabled: Boolean(simpleTableId),
    staleTime: 300_000,
  });
  const simpleTables = simpleTablesQuery.data?.results ?? [];
  const selectedSimpleTable = simpleTableDetailQuery.data ??
    simpleTables.find((table) => table.id === simpleTableId) ??
    (simpleTableId
      ? {
          id: simpleTableId,
          identifier: value.simpleTableIdentifier ?? null,
          storage_hash: value.simpleTableStorageHash,
        }
      : null);
  const filteredTables = useMemo(() => {
    const normalizedSearch = deferredSearchValue.trim().toLowerCase();

    if (!normalizedSearch) {
      return simpleTables;
    }

    return simpleTables.filter((table) => buildSearchText(table).includes(normalizedSearch));
  }, [deferredSearchValue, simpleTables]);
  const columns = useMemo(
    () => getSimpleTableColumns(simpleTableDetailQuery.data),
    [simpleTableDetailQuery.data],
  );

  useEffect(() => {
    if (!simpleTableDetailQuery.data) {
      return;
    }

    const nextConfig = updateSelectedSimpleTableConfig(value, simpleTableDetailQuery.data);

    if (
      nextConfig.simpleTableLabel === value.simpleTableLabel &&
      nextConfig.simpleTableStorageHash === value.simpleTableStorageHash &&
      nextConfig.simpleTableIdentifier === value.simpleTableIdentifier
    ) {
      return;
    }

    onChange(nextConfig);
  }, [onChange, simpleTableDetailQuery.data, value]);

  return (
    <div className="space-y-5 border-t border-border/70 pt-5">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Simple Table
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Search Simple Tables
            </span>
            <Input
              value={searchValue}
              disabled={disabled}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search by storage hash, identifier, source class, or id"
            />
          </label>

          <div className="max-h-72 overflow-auto rounded-[calc(var(--radius)-4px)] border border-border/70">
            {simpleTablesQuery.isLoading ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Loading Simple Tables
              </div>
            ) : simpleTablesQuery.isError ? (
              <div className="px-4 py-8 text-center text-sm text-danger">
                Unable to load Simple Tables.
              </div>
            ) : filteredTables.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No Simple Tables match the current search.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {filteredTables.map((table) => {
                  const selected = table.id === simpleTableId;

                  return (
                    <button
                      key={table.id}
                      type="button"
                      disabled={disabled}
                      className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/35 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => onChange(updateSelectedSimpleTableConfig(value, table))}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {getSimpleTableLabel(table)}
                        </span>
                        <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">
                          id {table.id}
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
          {selectedSimpleTable ? (
            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Selected
                </div>
                <div className="mt-1 font-medium text-foreground">
                  {getSimpleTableLabel(selectedSimpleTable)}
                </div>
              </div>
              <div className="grid gap-3 text-xs text-muted-foreground">
                <div>
                  <div className="font-semibold uppercase tracking-[0.12em]">ID</div>
                  <div className="mt-1 font-mono text-foreground">{selectedSimpleTable.id}</div>
                </div>
                <div>
                  <div className="font-semibold uppercase tracking-[0.12em]">Storage hash</div>
                  <div className="mt-1 break-all font-mono text-foreground">
                    {selectedSimpleTable.storage_hash ?? "Pending detail"}
                  </div>
                </div>
                <div>
                  <div className="font-semibold uppercase tracking-[0.12em]">Identifier</div>
                  <div className="mt-1 break-all font-mono text-foreground">
                    {selectedSimpleTable.identifier ?? "Not set"}
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => onChange(updateSelectedSimpleTableConfig(value))}
              >
                Clear selection
              </Button>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Select a Simple Table to configure this data source.
            </div>
          )}
        </div>
      </div>

      {simpleTableId ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-foreground">Columns</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Detail metadata from the selected Simple Table.
              </div>
            </div>
            {simpleTableDetailQuery.isFetching ? <Badge variant="neutral">Loading detail</Badge> : null}
          </div>
          <DataNodePreviewTable
            columns={["column_name", "attr_name", "db_type", "nullable", "is_pk"]}
            rows={columns.map((column) => ({
              column_name: column.column_name,
              attr_name: column.attr_name,
              db_type: column.db_type,
              nullable: column.nullable,
              is_pk: column.is_pk,
            }))}
            emptyMessage="No column metadata is available for this Simple Table."
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
            value={value.defaultLimit ?? DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_ROW_LIMIT}
            disabled={disabled}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              onChange({
                ...value,
                defaultLimit:
                  Number.isFinite(parsed) && parsed > 0
                    ? Math.trunc(parsed)
                    : DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_ROW_LIMIT,
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
            value={value.statementTimeoutMs ?? DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_STATEMENT_TIMEOUT_MS}
            disabled={disabled}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              onChange({
                ...value,
                statementTimeoutMs:
                  Number.isFinite(parsed) && parsed > 0
                    ? Math.trunc(parsed)
                    : DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_STATEMENT_TIMEOUT_MS,
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
            value={value.queryCacheTtlMs ?? DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_QUERY_CACHE_TTL_MS}
            disabled={disabled || value.queryCachePolicy === "disabled"}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              onChange({
                ...value,
                queryCacheTtlMs:
                  Number.isFinite(parsed) && parsed > 0
                    ? Math.trunc(parsed)
                    : DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_QUERY_CACHE_TTL_MS,
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
            Share one running backend Simple Table SQL request when identical cache misses arrive
            at the same time.
          </span>
        </span>
      </label>
    </div>
  );
}
