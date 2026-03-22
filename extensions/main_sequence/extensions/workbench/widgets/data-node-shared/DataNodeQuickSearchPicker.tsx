import { useDeferredValue, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";

import { PickerField, type PickerOption } from "../../../../common/components/PickerField";
import {
  type DataNodeQuickSearchRecord,
  formatMainSequenceError,
  quickSearchDataNodes,
} from "../../../../common/api";
import { formatDataNodeLabel } from "./dataNodeShared";

const dataNodeOptionLimit = 50;

export function DataNodeQuickSearchPicker({
  value,
  onChange,
  editable,
  queryScope,
  selectedDataNode,
  placeholder = "Select a data node",
  searchPlaceholder = "Search data nodes",
  selectionHelpText = "Choose the table you want to visualize.",
  showStatus = true,
  detailError,
  hasNoData = false,
}: {
  value?: number;
  onChange: (nextId?: number) => void;
  editable: boolean;
  queryScope: string;
  selectedDataNode?: Pick<DataNodeQuickSearchRecord, "id" | "identifier" | "storage_hash"> | null;
  placeholder?: string;
  searchPlaceholder?: string;
  selectionHelpText?: string;
  showStatus?: boolean;
  detailError?: unknown;
  hasNoData?: boolean;
}) {
  const [searchValue, setSearchValue] = useState("");
  const deferredSearchValue = useDeferredValue(searchValue);
  const normalizedSearchValue = deferredSearchValue.trim();

  const dataNodesQuery = useQuery({
    queryKey: ["main_sequence", "widgets", queryScope, "quick_search", normalizedSearchValue],
    queryFn: () =>
      quickSearchDataNodes({
        limit: dataNodeOptionLimit,
        q: normalizedSearchValue,
      }),
    enabled: normalizedSearchValue.length >= 3,
    staleTime: 300_000,
  });

  const dataNodeOptions = useMemo(() => {
    const baseOptions: DataNodeQuickSearchRecord[] =
      normalizedSearchValue.length >= 3 ? dataNodesQuery.data ?? [] : [];

    if (
      selectedDataNode &&
      !baseOptions.some((dataNode) => dataNode.id === selectedDataNode.id)
    ) {
      return [selectedDataNode, ...baseOptions];
    }

    return baseOptions;
  }, [dataNodesQuery.data, normalizedSearchValue.length, selectedDataNode]);

  const pickerOptions = useMemo<PickerOption[]>(
    () =>
      dataNodeOptions.map((dataNode) => ({
        value: String(dataNode.id),
        label: formatDataNodeLabel(dataNode),
        description:
          dataNode.identifier?.trim() && dataNode.storage_hash !== dataNode.identifier
            ? dataNode.storage_hash
            : undefined,
        keywords: [String(dataNode.id), dataNode.identifier ?? "", dataNode.storage_hash ?? ""],
      })),
    [dataNodeOptions],
  );

  return (
    <div className="space-y-2">
      <PickerField
        value={value && value > 0 ? String(value) : ""}
        onChange={(nextValue) => {
          const nextId = Number(nextValue);
          onChange(Number.isFinite(nextId) && nextId > 0 ? nextId : undefined);
        }}
        options={pickerOptions}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        emptyMessage={
          normalizedSearchValue.length >= 3
            ? "No matching data nodes."
            : normalizedSearchValue.length > 0
              ? "Type at least 3 characters."
              : "Type to search data nodes."
        }
        searchable
        searchValue={searchValue}
        onSearchValueChange={setSearchValue}
        disabled={!editable}
        loading={normalizedSearchValue.length >= 3 && dataNodesQuery.isFetching}
      />

      {showStatus ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{selectionHelpText}</span>
            {normalizedSearchValue.length === 0 ? (
              <span>Type to search.</span>
            ) : normalizedSearchValue.length < 3 ? (
              <span>Use at least 3 characters.</span>
            ) : null}
            {dataNodesQuery.isError ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-auto px-0 py-0 text-sm text-primary hover:bg-transparent"
                onClick={() => {
                  void dataNodesQuery.refetch();
                }}
              >
                Retry
              </Button>
            ) : null}
          </div>

          {dataNodesQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(dataNodesQuery.error)}
            </div>
          ) : null}

          {detailError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(detailError)}
            </div>
          ) : null}

          {value && value > 0 && hasNoData ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              This data node has no data.
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
