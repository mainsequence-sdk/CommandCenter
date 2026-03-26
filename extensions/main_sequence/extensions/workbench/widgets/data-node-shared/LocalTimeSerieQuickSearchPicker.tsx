import { useDeferredValue, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";

import { PickerField, type PickerOption } from "../../../../common/components/PickerField";
import {
  fetchLocalTimeSerieDetail,
  formatMainSequenceError,
  quickSearchLocalTimeSeries,
  type LocalTimeSerieQuickSearchRecord,
} from "../../../../common/api";
import { formatDataNodeLabel, formatLocalTimeSerieLabel } from "./dataNodeShared";

const localTimeSerieOptionLimit = 50;

export function LocalTimeSerieQuickSearchPicker({
  value,
  onChange,
  editable,
  queryScope,
  placeholder = "Select a local update",
  searchPlaceholder = "Search local updates",
  selectionHelpText = "Choose the local update you want to inspect.",
}: {
  value?: number;
  onChange: (nextId?: number) => void;
  editable: boolean;
  queryScope: string;
  placeholder?: string;
  searchPlaceholder?: string;
  selectionHelpText?: string;
}) {
  const [searchValue, setSearchValue] = useState("");
  const deferredSearchValue = useDeferredValue(searchValue);
  const normalizedSearchValue = deferredSearchValue.trim();
  const selectedLocalTimeSerieId = Number(value ?? 0);

  const selectedLocalTimeSerieQuery = useQuery({
    queryKey: [
      "main_sequence",
      "widgets",
      queryScope,
      "local_time_serie",
      "detail",
      selectedLocalTimeSerieId,
    ],
    queryFn: () => fetchLocalTimeSerieDetail(selectedLocalTimeSerieId),
    enabled: Number.isFinite(selectedLocalTimeSerieId) && selectedLocalTimeSerieId > 0,
    staleTime: 300_000,
  });

  const localTimeSeriesQuery = useQuery({
    queryKey: [
      "main_sequence",
      "widgets",
      queryScope,
      "local_time_serie",
      "quick_search",
      normalizedSearchValue,
    ],
    queryFn: () =>
      quickSearchLocalTimeSeries({
        limit: localTimeSerieOptionLimit,
        q: normalizedSearchValue,
      }),
    enabled: normalizedSearchValue.length >= 3,
    staleTime: 300_000,
  });

  const selectedLocalTimeSerie = useMemo<LocalTimeSerieQuickSearchRecord | null>(() => {
    const current = selectedLocalTimeSerieQuery.data;

    if (!current) {
      return null;
    }

    return {
      id: current.id,
      update_hash: current.update_hash,
      project_id:
        "project_id" in current && typeof current.project_id === "number" && Number.isFinite(current.project_id)
          ? current.project_id
          : null,
      data_node_storage: current.data_node_storage
        ? {
            id: current.data_node_storage.id,
            storage_hash: current.data_node_storage.storage_hash,
            identifier: current.data_node_storage.identifier,
          }
        : null,
    };
  }, [selectedLocalTimeSerieQuery.data]);

  const localTimeSerieOptions = useMemo(() => {
    const baseOptions: LocalTimeSerieQuickSearchRecord[] =
      normalizedSearchValue.length >= 3 ? localTimeSeriesQuery.data ?? [] : [];

    if (
      selectedLocalTimeSerie &&
      !baseOptions.some((localTimeSerie) => localTimeSerie.id === selectedLocalTimeSerie.id)
    ) {
      return [selectedLocalTimeSerie, ...baseOptions];
    }

    return baseOptions;
  }, [localTimeSeriesQuery.data, normalizedSearchValue.length, selectedLocalTimeSerie]);

  const pickerOptions = useMemo<PickerOption[]>(
    () =>
      localTimeSerieOptions.map((localTimeSerie) => ({
        value: String(localTimeSerie.id),
        label: formatLocalTimeSerieLabel(localTimeSerie),
        description: formatDataNodeLabel(localTimeSerie.data_node_storage),
        keywords: [
          String(localTimeSerie.id),
          localTimeSerie.update_hash,
          String(localTimeSerie.project_id ?? ""),
          localTimeSerie.data_node_storage?.storage_hash ?? "",
          localTimeSerie.data_node_storage?.identifier ?? "",
        ],
      })),
    [localTimeSerieOptions],
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
            ? "No matching local updates."
            : normalizedSearchValue.length > 0
              ? "Type at least 3 characters."
              : "Type to search local updates."
        }
        searchable
        searchValue={searchValue}
        onSearchValueChange={setSearchValue}
        disabled={!editable}
        loading={
          (normalizedSearchValue.length >= 3 && localTimeSeriesQuery.isFetching) ||
          selectedLocalTimeSerieQuery.isFetching
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{selectionHelpText}</span>
        {normalizedSearchValue.length === 0 ? (
          <span>Type to search.</span>
        ) : normalizedSearchValue.length < 3 ? (
          <span>Use at least 3 characters.</span>
        ) : null}
        {localTimeSeriesQuery.isError ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-auto px-0 py-0 text-sm text-primary hover:bg-transparent"
            onClick={() => {
              void localTimeSeriesQuery.refetch();
            }}
          >
            Retry
          </Button>
        ) : null}
      </div>

      {localTimeSeriesQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(localTimeSeriesQuery.error)}
        </div>
      ) : null}

      {selectedLocalTimeSerieQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(selectedLocalTimeSerieQuery.error)}
        </div>
      ) : null}
    </div>
  );
}
