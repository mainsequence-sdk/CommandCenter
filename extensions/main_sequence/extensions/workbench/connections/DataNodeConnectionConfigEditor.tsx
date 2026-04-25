import { useMemo } from "react";

import { Input } from "@/components/ui/input";
import type { ConnectionConfigEditorProps } from "@/connections/types";

import { DataNodeQuickSearchPicker } from "../widgets/data-node-shared/DataNodeQuickSearchPicker";
import { formatDataNodeLabel } from "../widgets/data-node-shared/dataNodeShared";
import {
  DEFAULT_MAIN_SEQUENCE_DATA_NODE_QUERY_CACHE_TTL_MS,
  DEFAULT_MAIN_SEQUENCE_DATA_NODE_ROW_LIMIT,
  type MainSequenceDataNodeConnectionPublicConfig,
  type MainSequenceDataNodeQueryCachePolicy,
} from "./dataNodeConnection";

function normalizePositiveInteger(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
}

function normalizeCachePolicy(value: unknown): MainSequenceDataNodeQueryCachePolicy {
  return value === "disabled" ? "disabled" : "read";
}

export function DataNodeConnectionConfigEditor({
  value,
  onChange,
  disabled = false,
}: ConnectionConfigEditorProps<MainSequenceDataNodeConnectionPublicConfig>) {
  const selectedDataNode = useMemo(
    () =>
      value.dataNodeId
        ? {
            id: value.dataNodeId,
            identifier: value.dataNodeLabel ?? null,
            storage_hash: value.dataNodeStorageHash ?? "",
          }
        : null,
    [value.dataNodeId, value.dataNodeLabel, value.dataNodeStorageHash],
  );

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="text-sm font-medium text-foreground">Data Node</div>
        <DataNodeQuickSearchPicker
          value={value.dataNodeId}
          onChange={(nextId) => {
            onChange({
              ...value,
              dataNodeId: nextId,
              dataNodeLabel: nextId ? value.dataNodeLabel : undefined,
              dataNodeStorageHash: nextId ? value.dataNodeStorageHash : undefined,
            });
          }}
          onSelectedDataNodeChange={(dataNode) => {
            onChange({
              ...value,
              dataNodeId: dataNode?.id,
              dataNodeLabel: dataNode ? formatDataNodeLabel(dataNode) : undefined,
              dataNodeStorageHash: dataNode?.storage_hash,
            });
          }}
          editable={!disabled}
          queryScope="data_node_connection_config"
          selectedDataNode={selectedDataNode}
          selectionHelpText="Choose the Data Node this connection instance should query."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Default row limit</span>
          <Input
            type="number"
            min={1}
            value={value.defaultLimit ?? DEFAULT_MAIN_SEQUENCE_DATA_NODE_ROW_LIMIT}
            onChange={(event) => {
              onChange({
                ...value,
                defaultLimit: normalizePositiveInteger(event.target.value),
              });
            }}
            disabled={disabled}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Cache TTL ms</span>
          <Input
            type="number"
            min={1}
            value={value.queryCacheTtlMs ?? DEFAULT_MAIN_SEQUENCE_DATA_NODE_QUERY_CACHE_TTL_MS}
            onChange={(event) => {
              onChange({
                ...value,
                queryCacheTtlMs: normalizePositiveInteger(event.target.value),
              });
            }}
            disabled={disabled}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Cache policy</span>
          <select
            className="h-10 w-full rounded-[calc(var(--radius)-6px)] border border-border bg-background px-3 text-sm text-foreground"
            value={normalizeCachePolicy(value.queryCachePolicy)}
            onChange={(event) => {
              onChange({
                ...value,
                queryCachePolicy: normalizeCachePolicy(event.target.value),
              });
            }}
            disabled={disabled}
          >
            <option value="read">Read queries</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
        <label className="flex items-center gap-2 pt-6 text-sm text-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border bg-transparent accent-primary"
            checked={value.dedupeInFlight !== false}
            onChange={(event) => {
              onChange({
                ...value,
                dedupeInFlight: event.target.checked,
              });
            }}
            disabled={disabled}
          />
          Dedupe in-flight identical queries
        </label>
      </div>
    </div>
  );
}
