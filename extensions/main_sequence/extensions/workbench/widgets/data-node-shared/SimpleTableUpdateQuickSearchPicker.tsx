import { useDeferredValue, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";

import { PickerField, type PickerOption } from "../../../../common/components/PickerField";
import {
  fetchSimpleTableUpdateDetail,
  formatMainSequenceError,
  quickSearchSimpleTableUpdates,
  type SimpleTableUpdateQuickSearchRecord,
} from "../../../../common/api";

function formatSimpleTableUpdateLabel(
  simpleTableUpdate?:
    | Pick<SimpleTableUpdateQuickSearchRecord, "id" | "update_hash" | "remote_table">
    | null,
) {
  if (!simpleTableUpdate) {
    return "Simple table update";
  }

  const updateHash = simpleTableUpdate.update_hash?.trim();

  if (updateHash) {
    return updateHash;
  }

  const tableIdentifier = simpleTableUpdate.remote_table?.identifier?.trim();

  if (tableIdentifier) {
    return tableIdentifier;
  }

  const tableStorageHash = simpleTableUpdate.remote_table?.storage_hash?.trim();

  if (tableStorageHash) {
    return tableStorageHash;
  }

  return `Simple table update ${simpleTableUpdate.id}`;
}

const simpleTableUpdateOptionLimit = 50;

export function SimpleTableUpdateQuickSearchPicker({
  value,
  onChange,
  editable,
  queryScope,
  placeholder = "Select a simple table update",
  searchPlaceholder = "Search simple table updates",
  selectionHelpText = "Choose the simple table update you want to inspect.",
}: {
  value?: string;
  onChange: (nextId?: string) => void;
  editable: boolean;
  queryScope: string;
  placeholder?: string;
  searchPlaceholder?: string;
  selectionHelpText?: string;
}) {
  const [searchValue, setSearchValue] = useState("");
  const deferredSearchValue = useDeferredValue(searchValue);
  const normalizedSearchValue = deferredSearchValue.trim();
  const selectedSimpleTableUpdateId = value?.trim() || "";

  const selectedSimpleTableUpdateQuery = useQuery({
    queryKey: [
      "main_sequence",
      "widgets",
      queryScope,
      "simple_table_update",
      "detail",
      selectedSimpleTableUpdateId,
    ],
    queryFn: () => fetchSimpleTableUpdateDetail(selectedSimpleTableUpdateId),
    enabled: Boolean(selectedSimpleTableUpdateId),
    staleTime: 300_000,
  });

  const simpleTableUpdatesQuery = useQuery({
    queryKey: [
      "main_sequence",
      "widgets",
      queryScope,
      "simple_table_update",
      "quick_search",
      normalizedSearchValue,
    ],
    queryFn: () =>
      quickSearchSimpleTableUpdates({
        limit: simpleTableUpdateOptionLimit,
        q: normalizedSearchValue,
      }),
    enabled: normalizedSearchValue.length >= 3,
    staleTime: 300_000,
  });

  const selectedSimpleTableUpdate = useMemo<SimpleTableUpdateQuickSearchRecord | null>(() => {
    const current = selectedSimpleTableUpdateQuery.data;

    if (!current) {
      return null;
    }

    return {
      id: current.id,
      uid: current.uid ?? null,
      update_hash: current.update_hash,
      remote_table: current.remote_table
        ? {
            id: current.remote_table.id,
            uid: current.remote_table.uid ?? null,
            storage_hash:
              typeof current.remote_table.storage_hash === "string"
                ? current.remote_table.storage_hash
                : null,
            identifier:
              typeof current.remote_table.identifier === "string"
                ? current.remote_table.identifier
                : null,
          }
        : null,
    };
  }, [selectedSimpleTableUpdateQuery.data]);

  const simpleTableUpdateOptions = useMemo(() => {
    const baseOptions: SimpleTableUpdateQuickSearchRecord[] =
      normalizedSearchValue.length >= 3 ? simpleTableUpdatesQuery.data ?? [] : [];

    if (
      selectedSimpleTableUpdate &&
      !baseOptions.some((simpleTableUpdate) => simpleTableUpdate.uid === selectedSimpleTableUpdate.uid)
    ) {
      return [selectedSimpleTableUpdate, ...baseOptions];
    }

    return baseOptions;
  }, [normalizedSearchValue.length, selectedSimpleTableUpdate, simpleTableUpdatesQuery.data]);

  const pickerOptions = useMemo<PickerOption[]>(
    () =>
      simpleTableUpdateOptions.map((simpleTableUpdate) => ({
        value: simpleTableUpdate.uid?.trim() || "",
        label: formatSimpleTableUpdateLabel(simpleTableUpdate),
        description:
          simpleTableUpdate.remote_table?.identifier?.trim() ||
          simpleTableUpdate.remote_table?.storage_hash?.trim() ||
          `Simple table ${simpleTableUpdate.remote_table?.id ?? "unknown"}`,
        keywords: [
          simpleTableUpdate.uid ?? "",
          String(simpleTableUpdate.id),
          simpleTableUpdate.update_hash,
          simpleTableUpdate.remote_table?.uid ?? "",
          String(simpleTableUpdate.remote_table?.id ?? ""),
          simpleTableUpdate.remote_table?.storage_hash ?? "",
          simpleTableUpdate.remote_table?.identifier ?? "",
        ],
      })),
    [simpleTableUpdateOptions],
  );

  return (
    <div className="space-y-2">
      <PickerField
        value={value?.trim() ?? ""}
        onChange={(nextValue) => {
          onChange(nextValue.trim() || undefined);
        }}
        options={pickerOptions}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        emptyMessage={
          normalizedSearchValue.length >= 3
            ? "No matching simple table updates."
            : normalizedSearchValue.length > 0
              ? "Type at least 3 characters."
              : "Type to search simple table updates."
        }
        searchable
        searchValue={searchValue}
        onSearchValueChange={setSearchValue}
        disabled={!editable}
        loading={
          (normalizedSearchValue.length >= 3 && simpleTableUpdatesQuery.isFetching) ||
          selectedSimpleTableUpdateQuery.isFetching
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{selectionHelpText}</span>
        {normalizedSearchValue.length === 0 ? (
          <span>Type to search.</span>
        ) : normalizedSearchValue.length < 3 ? (
          <span>Use at least 3 characters.</span>
        ) : null}
        {simpleTableUpdatesQuery.isError ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-auto px-0 py-0 text-sm text-primary hover:bg-transparent"
            onClick={() => {
              void simpleTableUpdatesQuery.refetch();
            }}
          >
            Retry
          </Button>
        ) : null}
      </div>

      {simpleTableUpdatesQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(simpleTableUpdatesQuery.error)}
        </div>
      ) : null}

      {selectedSimpleTableUpdateQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(selectedSimpleTableUpdateQuery.error)}
        </div>
      ) : null}
    </div>
  );
}
