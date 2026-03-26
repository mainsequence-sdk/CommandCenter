import { useEffect, useMemo, useRef, type ReactNode } from "react";

import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardControls } from "@/dashboards/DashboardControls";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import {
  type DataNodeLastObservation,
  type DataNodeRemoteDataRow,
  fetchDataNodeDataBetweenDatesFromRemote,
  fetchDataNodeLastObservation,
  formatMainSequenceError,
} from "../../../../common/api";
import { PickerField, type PickerOption } from "../../../../common/components/PickerField";
import { DataNodePreviewTable } from "../data-node-shared/DataNodePreviewTable";
import { buildDataNodeFieldOptionsFromRows } from "../data-node-shared/dataNodeShared";
import {
  buildDataNodeRemoteRowsQueryKey,
  resolveDataNodeWidgetPrefilledFixedRange,
  resolveDataNodeWidgetPreviewAnchorMs,
} from "../data-node-shared/dataNodeWidgetSource";
import type { DataNodeFilterControllerContext } from "./controller";
import {
  buildDataNodeTransformedDataset,
  type DataNodeGroupAggregateMode,
  type DataNodeTransformMode,
  normalizeDataNodeFilterRuntimeState,
  resolveDataNodeFilterDateRange,
  type MainSequenceDataNodeFilterWidgetProps,
} from "./dataNodeFilterModel";

const transformModeOptions: PickerOption[] = [
  {
    value: "none",
    label: "None",
    description: "Publish the incoming dataset without reshaping it.",
  },
  {
    value: "aggregate",
    label: "Aggregate",
    description: "Group rows by key fields and aggregate the remaining values.",
  },
  {
    value: "pivot",
    label: "Pivot",
    description: "Turn values from one field into columns using key fields as row dimensions.",
  },
];

const aggregateModeOptions: PickerOption[] = [
  {
    value: "last",
    label: "Last value",
    description: "Keep the last value seen inside each output cell.",
  },
  {
    value: "first",
    label: "First value",
    description: "Keep the first value seen inside each output cell.",
  },
  {
    value: "mean",
    label: "Mean",
    description: "Average numeric values inside each output cell.",
  },
  {
    value: "sum",
    label: "Sum",
    description: "Sum numeric values inside each output cell.",
  },
  {
    value: "min",
    label: "Min",
    description: "Keep the minimum numeric value inside each output cell.",
  },
  {
    value: "max",
    label: "Max",
    description: "Keep the maximum numeric value inside each output cell.",
  },
];

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-4">
      <div className="space-y-1">
        <div className="text-sm font-medium text-topbar-foreground">{title}</div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function uniqueStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();

  return values.filter((value): value is string => {
    if (!value?.trim()) {
      return false;
    }

    if (seen.has(value)) {
      return false;
    }

    seen.add(value);
    return true;
  });
}

function formatRangeSummary(startMs: number, endMs: number) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `${formatter.format(startMs)} - ${formatter.format(endMs)}`;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueStrings(
    value.map((entry) => (typeof entry === "string" ? entry.trim() : "")),
  );
}

function renderFieldChips({
  values,
  onRemove,
  editable,
}: {
  values: string[];
  onRemove: (value: string) => void;
  editable: boolean;
}) {
  if (values.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span
          key={value}
          className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/70 px-2.5 py-1 text-xs text-foreground"
        >
          <span>{value}</span>
          <button
            type="button"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => onRemove(value)}
            disabled={!editable}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

export function MainSequenceDataNodeFilterWidgetSettings({
  draftProps,
  editable,
  onDraftPropsChange,
  controllerContext,
}: WidgetSettingsComponentProps<MainSequenceDataNodeFilterWidgetProps>) {
  const {
    rangeStartMs: dashboardRangeStartMs,
    rangeEndMs: dashboardRangeEndMs,
  } = useDashboardControls();
  const context = controllerContext as DataNodeFilterControllerContext | undefined;
  const resolvedConfig = context?.resolvedConfig;
  const latestDraftPropsRef = useRef(draftProps);
  useEffect(() => {
    latestDraftPropsRef.current = draftProps;
  }, [draftProps]);
  const selectedDataNodeId = context?.selectedDataNodeId ?? Number(draftProps.dataNodeId ?? 0);
  const selectedDetail = context?.selectedDataNodeDetailQuery.data;
  const hasNoData = context?.hasNoData ?? false;
  const linkedNodeRuntime = useMemo(
    () => normalizeDataNodeFilterRuntimeState(context?.referencedFilterWidget?.runtimeState),
    [context?.referencedFilterWidget?.runtimeState],
  );
  const lastObservationQuery = useQuery<DataNodeLastObservation>({
    queryKey: [
      "main_sequence",
      "widgets",
      "data_node_filter",
      "last_observation",
      selectedDataNodeId,
    ],
    queryFn: () => fetchDataNodeLastObservation(selectedDataNodeId),
    enabled: Number.isFinite(selectedDataNodeId) && selectedDataNodeId > 0,
    staleTime: 300_000,
  });
  const previewAnchorMs = useMemo(
    () => resolveDataNodeWidgetPreviewAnchorMs(selectedDetail, lastObservationQuery.data),
    [lastObservationQuery.data, selectedDetail],
  );
  useEffect(() => {
    if (!editable || !resolvedConfig) {
      return;
    }

    const prefilledRange = resolveDataNodeWidgetPrefilledFixedRange(resolvedConfig, {
      previewAnchorMs,
      dashboardStartMs: dashboardRangeStartMs,
      dashboardEndMs: dashboardRangeEndMs,
    });

    if (!prefilledRange) {
      return;
    }

    const latestDraftProps = latestDraftPropsRef.current;

    if (
      latestDraftProps.fixedStartMs === prefilledRange.fixedStartMs &&
      latestDraftProps.fixedEndMs === prefilledRange.fixedEndMs
    ) {
      return;
    }

    onDraftPropsChange({
      ...latestDraftProps,
      fixedStartMs: prefilledRange.fixedStartMs,
      fixedEndMs: prefilledRange.fixedEndMs,
    });
  }, [
    dashboardRangeEndMs,
    dashboardRangeStartMs,
    editable,
    onDraftPropsChange,
    previewAnchorMs,
    resolvedConfig,
  ]);
  const previewRange = useMemo(
    () =>
      resolvedConfig
        ? resolveDataNodeFilterDateRange(
            resolvedConfig,
            dashboardRangeStartMs,
            dashboardRangeEndMs,
          )
        : { hasValidRange: false, rangeStartMs: null, rangeEndMs: null },
    [dashboardRangeEndMs, dashboardRangeStartMs, resolvedConfig],
  );
  const previewQuery = useQuery<DataNodeRemoteDataRow[]>({
    queryKey: buildDataNodeRemoteRowsQueryKey({
      dataNodeId: resolvedConfig?.dataNodeId,
      columns: resolvedConfig?.availableFields.map((field) => field.key) ?? [],
      uniqueIdentifierList: resolvedConfig?.uniqueIdentifierList,
      rangeStartMs: previewRange.rangeStartMs,
      rangeEndMs: previewRange.rangeEndMs,
      limit: resolvedConfig?.limit ?? 2_500,
    }),
    queryFn: () =>
      fetchDataNodeDataBetweenDatesFromRemote(resolvedConfig!.dataNodeId!, {
        start_date: Math.floor(previewRange.rangeStartMs! / 1000),
        end_date: Math.floor(previewRange.rangeEndMs! / 1000),
        columns: resolvedConfig!.availableFields.map((field) => field.key),
        unique_identifier_list: resolvedConfig!.uniqueIdentifierList,
        great_or_equal: true,
        less_or_equal: true,
        limit: resolvedConfig!.limit,
        offset: 0,
      }),
    enabled:
      Boolean(resolvedConfig?.dataNodeId) &&
      previewRange.hasValidRange &&
      !hasNoData &&
      !context?.isFilterWidgetSource,
  });
  const previewSourceRows = context?.isFilterWidgetSource
    ? (linkedNodeRuntime?.rows ?? [])
    : (previewQuery.data ?? []);
  const sourceFieldOptions = useMemo<PickerOption[]>(
    () => {
      const runtimeOptions = buildDataNodeFieldOptionsFromRows({
        columns: resolvedConfig?.availableFields.map((field) => field.key) ?? [],
        rows: previewSourceRows,
      }).map<PickerOption>((field) => ({
        value: field.key,
        label: field.label,
        description: field.dtype ?? undefined,
        keywords: [field.key, field.label, field.dtype ?? ""],
      }));

      return uniqueStrings(runtimeOptions.map((option) => option.value)).map((value) => {
        return runtimeOptions.find((option) => option.value === value)!;
      });
    },
    [previewSourceRows, resolvedConfig],
  );
  const baseTransformedPreview = useMemo(
    () =>
      resolvedConfig
        ? buildDataNodeTransformedDataset(
            previewSourceRows,
            {
              ...resolvedConfig,
              projectFields: undefined,
            },
            uniqueStrings([
              ...resolvedConfig.availableFields.map((field) => field.key),
              ...previewSourceRows.flatMap((row) => Object.keys(row)),
            ]),
          )
        : { columns: [], rows: [] },
    [previewSourceRows, resolvedConfig],
  );
  const transformedPreview = useMemo(
    () =>
      resolvedConfig
        ? buildDataNodeTransformedDataset(
            previewSourceRows,
            resolvedConfig,
            uniqueStrings([
              ...resolvedConfig.availableFields.map((field) => field.key),
              ...previewSourceRows.flatMap((row) => Object.keys(row)),
            ]),
          )
        : { columns: [], rows: [] },
    [previewSourceRows, resolvedConfig],
  );
  const previewColumns = useMemo(
    () => transformedPreview.columns,
    [transformedPreview.columns],
  );
  const selectedProjectFields = normalizeStringArray(draftProps.projectFields);
  const selectedKeyFields = normalizeStringArray(draftProps.keyFields);
  const previewRangeSummary =
    previewRange.rangeStartMs && previewRange.rangeEndMs
      ? formatRangeSummary(previewRange.rangeStartMs, previewRange.rangeEndMs)
      : "Select a valid date range to preview";

  if (!resolvedConfig) {
    return null;
  }

  const availableProjectOptions = baseTransformedPreview.columns
    .filter((column) => !selectedProjectFields.includes(column))
    .map<PickerOption>((column) => ({
      value: column,
      label: column,
    }));
  const availableKeyFieldOptions = sourceFieldOptions.filter(
    (option) =>
      !selectedKeyFields.includes(option.value) &&
      option.value !== resolvedConfig.pivotField &&
      option.value !== resolvedConfig.pivotValueField,
  );

  return (
    <div className="space-y-4">
      <SettingsSection
        title="Dataset"
        description="This widget owns the canonical row dataset that linked graphs and tables consume."
      >
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Remote row limit
          </label>
          <Input
            type="number"
            min={100}
            max={20000}
            value={resolvedConfig.limit}
            disabled={!editable}
            onChange={(event) => {
              onDraftPropsChange({
                ...draftProps,
                limit: Number(event.target.value),
              });
            }}
          />
          <p className="text-sm text-muted-foreground">
            Linked widgets only receive rows from this dataset, so this limit defines the maximum shared working set.
          </p>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Advanced transform"
        description="Choose whether this Data Node publishes raw rows, an aggregated dataset, or a pivoted dataset."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Transform mode
            </label>
            <PickerField
              value={resolvedConfig.transformMode}
              onChange={(value) => {
                const nextMode = (value as DataNodeTransformMode) || "none";

                onDraftPropsChange({
                  ...draftProps,
                  transformMode: nextMode,
                  keyFields: nextMode === "none" ? undefined : draftProps.keyFields,
                  pivotField: nextMode === "pivot" ? draftProps.pivotField : undefined,
                  pivotValueField:
                    nextMode === "pivot" ? draftProps.pivotValueField : undefined,
                });
              }}
              options={transformModeOptions}
              placeholder="Select a transform mode"
              disabled={!editable}
            />
            <p className="text-sm text-muted-foreground">
              `Aggregate` groups rows by key fields. `Pivot` uses the same key fields as row dimensions and expands one field into columns.
            </p>
          </div>

          {resolvedConfig.transformMode !== "none" ? (
            <div className="space-y-2 md:col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {resolvedConfig.transformMode === "pivot" ? "Row key fields" : "Key fields"}
              </label>
              {renderFieldChips({
                values: selectedKeyFields,
                editable,
                onRemove: (value) => {
                  const nextFields = selectedKeyFields.filter((entry) => entry !== value);
                  onDraftPropsChange({
                    ...draftProps,
                    keyFields: nextFields.length > 0 ? nextFields : undefined,
                  });
                },
              })}
              {selectedKeyFields.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {resolvedConfig.transformMode === "pivot"
                    ? "No row key fields. The pivot will collapse into a single row."
                    : "No key fields selected yet."}
                </div>
              ) : null}
              <PickerField
                value=""
                onChange={(value) => {
                  if (!value) {
                    return;
                  }

                  onDraftPropsChange({
                    ...draftProps,
                    keyFields: [...selectedKeyFields, value],
                  });
                }}
                options={availableKeyFieldOptions}
                placeholder={
                  availableKeyFieldOptions.length > 0
                    ? "Add a key field"
                    : "No more key fields available"
                }
                searchPlaceholder="Search key fields"
                emptyMessage="No additional key fields are available."
                disabled={!editable || availableKeyFieldOptions.length === 0}
              />
              {selectedKeyFields.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!editable}
                  onClick={() => {
                    onDraftPropsChange({
                      ...draftProps,
                      keyFields: undefined,
                    });
                  }}
                >
                  Clear key fields
                </Button>
              ) : null}
            </div>
          ) : null}

          {resolvedConfig.transformMode !== "none" ? (
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Aggregate mode
              </label>
              <PickerField
                value={resolvedConfig.aggregateMode}
                onChange={(value) => {
                  onDraftPropsChange({
                    ...draftProps,
                    aggregateMode: (value as DataNodeGroupAggregateMode) || "last",
                  });
                }}
                options={aggregateModeOptions}
                placeholder="Select an aggregate mode"
                disabled={!editable}
              />
              <p className="text-sm text-muted-foreground">
                Controls how numeric values are combined inside aggregate groups or pivot cells.
              </p>
            </div>
          ) : null}

          {resolvedConfig.transformMode === "pivot" ? (
            <>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Pivot field
                </label>
                <PickerField
                  value={resolvedConfig.pivotField ?? ""}
                  onChange={(value) => {
                    onDraftPropsChange({
                      ...draftProps,
                      pivotField: value || undefined,
                    });
                  }}
                  options={sourceFieldOptions}
                  placeholder="No pivot"
                  searchPlaceholder="Search fields"
                  emptyMessage="No fields are available for pivoting."
                  disabled={!editable || sourceFieldOptions.length === 0}
                />
                <p className="text-sm text-muted-foreground">
                  Turn values from one categorical field into columns.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Pivot value field
                </label>
                <PickerField
                  value={resolvedConfig.pivotValueField ?? ""}
                  onChange={(value) => {
                    onDraftPropsChange({
                      ...draftProps,
                      pivotValueField: value || undefined,
                    });
                  }}
                  options={sourceFieldOptions.filter(
                    (option) => option.value !== resolvedConfig.pivotField,
                  )}
                  placeholder="Select value field"
                  searchPlaceholder="Search value fields"
                  emptyMessage="No fields are available for pivot values."
                  disabled={!editable || sourceFieldOptions.length === 0}
                />
                <p className="text-sm text-muted-foreground">
                  Values from this field fill the pivoted columns using the active aggregate mode.
                </p>
              </div>
            </>
          ) : null}

          <div className="space-y-2 md:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Project columns
            </label>
            {renderFieldChips({
              values: selectedProjectFields,
              editable,
              onRemove: (value) => {
                const nextFields = selectedProjectFields.filter((entry) => entry !== value);
                onDraftPropsChange({
                  ...draftProps,
                  projectFields: nextFields.length > 0 ? nextFields : undefined,
                });
              },
            })}
            {selectedProjectFields.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No projection. The published dataset keeps every output column.
              </div>
            ) : null}
            <PickerField
              value=""
              onChange={(value) => {
                if (!value) {
                  return;
                }

                onDraftPropsChange({
                  ...draftProps,
                  projectFields: [...selectedProjectFields, value],
                });
              }}
              options={availableProjectOptions}
              placeholder={
                availableProjectOptions.length > 0
                  ? "Add an output column"
                  : "No more output columns available"
              }
              searchPlaceholder="Search output columns"
              emptyMessage="No additional output columns are available."
              disabled={!editable || availableProjectOptions.length === 0}
            />
            {selectedProjectFields.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!editable}
                onClick={() => {
                  onDraftPropsChange({
                    ...draftProps,
                    projectFields: undefined,
                  });
                }}
              >
                Clear projection
              </Button>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Projection applies after the selected transform mode and defines the final published columns.
            </p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Preview"
        description="Inspect the selected source as a table before saving. This widget keeps the preview table in settings only."
      >
        {resolvedConfig.dataNodeId ? (
          <div className="space-y-4">
            {context?.isFilterWidgetSource && !context.hasResolvedFilterWidgetSource ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/20 px-4 py-5 text-sm text-muted-foreground">
                Select an upstream Data Node widget to enable the transformed preview.
              </div>
            ) : null}
            {hasNoData ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/20 px-4 py-5 text-sm text-muted-foreground">
                This data node has no data, so no preview is available.
              </div>
            ) : !context?.isFilterWidgetSource || context.hasResolvedFilterWidgetSource ? (
              <>
                <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/40 px-3 py-2 text-sm text-muted-foreground">
                  {previewRangeSummary}
                </div>

                {previewAnchorMs !== null ? (
                  <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/40 px-3 py-3">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Latest observation
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(previewAnchorMs)}
                    </div>
                  </div>
                ) : null}

                {(context?.isFilterWidgetSource
                  ? linkedNodeRuntime?.status === "loading" || linkedNodeRuntime == null
                  : previewQuery.isLoading) ? (
                  <div className="grid gap-3">
                    <Skeleton className="h-6 w-48 rounded-[calc(var(--radius)-8px)]" />
                    <Skeleton className="h-[280px] rounded-[calc(var(--radius)-6px)]" />
                  </div>
                ) : null}

                {(context?.isFilterWidgetSource
                  ? linkedNodeRuntime?.status === "error"
                  : previewQuery.isError) ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {context?.isFilterWidgetSource
                      ? linkedNodeRuntime?.error ?? "The upstream Data Node failed to load rows."
                      : formatMainSequenceError(previewQuery.error)}
                  </div>
                ) : null}

                {!(
                  context?.isFilterWidgetSource
                    ? linkedNodeRuntime?.status === "loading" || linkedNodeRuntime == null
                    : previewQuery.isLoading
                ) &&
                !(
                  context?.isFilterWidgetSource
                    ? linkedNodeRuntime?.status === "error"
                    : previewQuery.isError
                ) &&
                previewRange.hasValidRange ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{transformedPreview.rows.length.toLocaleString()} preview rows</span>
                      {resolvedConfig.transformMode === "aggregate" &&
                      resolvedConfig.keyFields &&
                      resolvedConfig.keyFields.length > 0 ? (
                        <span>
                          aggregated by {resolvedConfig.keyFields.join(", ")} using{" "}
                          {resolvedConfig.aggregateMode}
                        </span>
                      ) : null}
                      {resolvedConfig.transformMode === "pivot" &&
                      resolvedConfig.pivotField &&
                      resolvedConfig.pivotValueField ? (
                        <span>
                          pivoted {resolvedConfig.pivotField} into columns from{" "}
                          {resolvedConfig.pivotValueField}
                        </span>
                      ) : null}
                      {resolvedConfig.projectFields && resolvedConfig.projectFields.length > 0 ? (
                        <span>
                          projecting {resolvedConfig.projectFields.length.toLocaleString()} columns
                        </span>
                      ) : null}
                    </div>
                    <DataNodePreviewTable
                      className="min-h-[280px]"
                      columns={previewColumns}
                      emptyMessage="No rows are available for the preview window."
                      maxRows={20}
                      rows={transformedPreview.rows}
                    />
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        ) : (
          <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/20 px-4 py-5 text-sm text-muted-foreground">
            Select a data node to enable the preview controls.
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
