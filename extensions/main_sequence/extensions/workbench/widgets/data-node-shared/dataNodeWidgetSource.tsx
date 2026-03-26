import { useMemo, useState } from "react";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { X } from "lucide-react";

import { getWidgetById } from "@/app/registry";
import { useDashboardWidgetRegistry, type DashboardWidgetRegistryEntry } from "@/dashboards/DashboardWidgetRegistry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  WidgetFieldCanvasRendererProps,
  WidgetFieldDefinition,
  WidgetFieldSection,
  WidgetFieldSettingsRendererProps,
  WidgetSettingsSchema,
} from "@/widgets/types";

import { PickerField, type PickerOption } from "../../../../common/components/PickerField";
import { fetchDataNodeDetail, type DataNodeDetail } from "../../../../common/api";
import { DataNodeDateTimeField } from "./DataNodeDateTimeField";
import { DataNodeQuickSearchPicker } from "./DataNodeQuickSearchPicker";
import {
  buildDataNodeFieldOptions,
  formatDataNodeLabel,
  type DataNodeDateRangeMode,
  type DataNodeFieldOption,
} from "./dataNodeShared";

export const mainSequenceDataNodeWidgetId = "main-sequence-data-node";
export type DataNodeWidgetSourceMode = "direct" | "filter_widget";

export interface DataNodeWidgetSourceProps extends Record<string, unknown> {
  dataNodeId?: number;
  dateRangeMode?: DataNodeDateRangeMode;
  fixedEndMs?: number;
  fixedStartMs?: number;
  uniqueIdentifierList?: string[];
}

export interface DataNodeWidgetSourceReferenceProps extends Record<string, unknown> {
  sourceMode?: DataNodeWidgetSourceMode;
  sourceWidgetId?: string;
}

export interface ResolvedDataNodeWidgetSourceConfig {
  availableFields: DataNodeFieldOption[];
  dataNodeId?: number;
  dataNodeLabel: string;
  dateRangeMode: DataNodeDateRangeMode;
  fixedEndMs?: number;
  fixedStartMs?: number;
  sourceMode?: DataNodeWidgetSourceMode;
  sourceWidgetId?: string;
  supportsUniqueIdentifierList: boolean;
  uniqueIdentifierList?: string[];
}

export type DataNodeWidgetLastObservation = Record<string, unknown> | null;

export interface DataNodeWidgetSourceControllerContext<
  TResolvedConfig extends ResolvedDataNodeWidgetSourceConfig = ResolvedDataNodeWidgetSourceConfig,
> {
  currentWidgetInstanceId?: string;
  filterWidgetOptions: PickerOption[];
  fieldPickerOptions: PickerOption[];
  hasLoadedDataNodeDetail: boolean;
  hasNoData: boolean;
  hasResolvedFilterWidgetSource: boolean;
  isFilterWidgetSource: boolean;
  referencedFilterWidget: DashboardWidgetRegistryEntry | null;
  resolvedConfig: TResolvedConfig;
  resolvedSourceProps: DataNodeWidgetSourceProps;
  selectedDataNodeDetailQuery: UseQueryResult<DataNodeDetail>;
  selectedDataNodeId: number;
  sourceMode: DataNodeWidgetSourceMode;
  sourceWidgetId?: string;
  supportsUniqueIdentifierList: boolean;
}

interface CreateDataNodeWidgetSourceSchemaOptions<
  TProps extends DataNodeWidgetSourceProps,
  TContext extends DataNodeWidgetSourceControllerContext,
> {
  additionalFields?: WidgetFieldDefinition<TProps, TContext>[];
  additionalSections?: WidgetFieldSection[];
  dataNodeCanvasQueryScope?: string;
  dataSourceSectionDescription?: string;
  dateRangeSectionDescription?: string;
  enableFilterWidgetSource?: boolean;
  filterWidgetOnly?: boolean;
  mapDataNodeChange?: (nextDataNodeId: number | undefined, currentProps: TProps) => TProps;
  selectionHelpText?: string;
}

const dateRangeModeOptions: PickerOption[] = [
  {
    value: "dashboard",
    label: "Dashboard date",
    description: "Keep this widget in sync with the current dashboard date.",
  },
  {
    value: "fixed",
    label: "Fixed date",
    description: "Give this widget its own saved start and end date.",
  },
];

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

function normalizePositiveInteger(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function normalizeTimestampMs(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function normalizeUniqueIdentifierList(value: unknown) {
  if (typeof value === "string") {
    return uniqueStrings(value.split(/[\n,]+/).map((item) => item.trim()));
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalizedValues = uniqueStrings(
    value.map((item) => (typeof item === "string" ? item.trim() : "")),
  );

  return normalizedValues.length > 0 ? normalizedValues : undefined;
}

function normalizeSourceMode(value: unknown): DataNodeWidgetSourceMode {
  return value === "filter_widget" ? "filter_widget" : "direct";
}

function normalizeSourceWidgetId(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  return value.trim();
}

function parseDataNodeTimeValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Math.abs(value) >= 1_000_000_000_000) {
      return Math.trunc(value);
    }

    if (Math.abs(value) >= 1_000_000_000) {
      return Math.trunc(value * 1000);
    }

    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const numericValue = Number(trimmed);

    if (Number.isFinite(numericValue)) {
      return parseDataNodeTimeValue(numericValue);
    }

    let normalized = trimmed;

    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(normalized)) {
      normalized = normalized.replace(/\s+/, "T");
    }

    normalized = normalized.replace(/(\.\d{3})\d+/, "$1");
    normalized = normalized.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
    normalized = normalized.replace(/\s+UTC$/i, "Z");

    const parsed = Date.parse(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

export function resolveDataNodeWidgetPreviewAnchorMs(
  detail?: DataNodeDetail | null,
  lastObservation?: DataNodeWidgetLastObservation,
) {
  const timeIndexName = detail?.sourcetableconfiguration?.time_index_name ?? undefined;

  if (timeIndexName && lastObservation) {
    const timeIndexValue = parseDataNodeTimeValue(lastObservation[timeIndexName]);

    if (timeIndexValue !== null) {
      return timeIndexValue;
    }
  }

  return parseDataNodeTimeValue(
    detail?.sourcetableconfiguration?.last_time_index_value ?? null,
  );
}

export function resolveDataNodeWidgetPrefilledFixedRange(
  config: Pick<ResolvedDataNodeWidgetSourceConfig, "dateRangeMode" | "fixedEndMs" | "fixedStartMs">,
  input: {
    previewAnchorMs?: number | null;
    dashboardStartMs?: number | null;
    dashboardEndMs?: number | null;
    fallbackSpanMs?: number;
  },
) {
  if (config.dateRangeMode !== "fixed") {
    return null;
  }

  const nextFixedStartMs = normalizeTimestampMs(config.fixedStartMs);
  const nextFixedEndMs = normalizeTimestampMs(config.fixedEndMs);

  if (nextFixedStartMs !== undefined && nextFixedEndMs !== undefined) {
    return null;
  }

  const previewAnchorMs = normalizeTimestampMs(input.previewAnchorMs);

  if (previewAnchorMs === undefined) {
    return null;
  }

  const dashboardStartMs = normalizeTimestampMs(input.dashboardStartMs);
  const dashboardEndMs = normalizeTimestampMs(input.dashboardEndMs);
  const fallbackSpanMs = Math.max(60_000, input.fallbackSpanMs ?? 7 * 24 * 60 * 60 * 1000);
  const spanMs =
    dashboardStartMs !== undefined &&
    dashboardEndMs !== undefined &&
    dashboardStartMs < dashboardEndMs
      ? dashboardEndMs - dashboardStartMs
      : fallbackSpanMs;

  const resolvedFixedEndMs = nextFixedEndMs ?? previewAnchorMs;
  const resolvedFixedStartMs = nextFixedStartMs ?? resolvedFixedEndMs - spanMs;

  if (resolvedFixedStartMs >= resolvedFixedEndMs) {
    return null;
  }

  return {
    fixedStartMs: resolvedFixedStartMs,
    fixedEndMs: resolvedFixedEndMs,
  };
}

export function buildDataNodeRemoteRowsQueryKey(input: {
  sourceMode?: DataNodeWidgetSourceMode;
  sourceWidgetId?: string;
  dataNodeId?: number;
  columns: string[];
  uniqueIdentifierList?: string[];
  rangeStartMs?: number | null;
  rangeEndMs?: number | null;
  limit: number;
}) {
  return [
    "main_sequence",
    "widgets",
    "data_node_remote_rows",
    input.sourceMode ?? "direct",
    input.sourceWidgetId ?? "",
    input.dataNodeId ?? 0,
    input.columns.join("|"),
    (input.uniqueIdentifierList ?? []).join("|"),
    input.rangeStartMs ?? null,
    input.rangeEndMs ?? null,
    input.limit,
  ] as const;
}

function supportsUniqueIdentifierList(detail?: DataNodeDetail | null) {
  const indexNames = detail?.sourcetableconfiguration?.index_names ?? [];
  return indexNames.includes("unique_identifier");
}

function toFieldPickerOption(field: DataNodeFieldOption): PickerOption {
  const metadata = [
    field.dtype,
    field.isTime ? "Time" : null,
    field.isIndex ? "Index" : null,
    field.description ?? null,
  ].filter((value): value is string => Boolean(value && value.trim()));

  return {
    value: field.key,
    label: field.label,
    description: metadata.join(" • ") || undefined,
    keywords: [field.key, field.label, field.dtype ?? "", field.description ?? ""],
  };
}

function tokenizeUniqueIdentifierValues(values: string) {
  return values
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeUniqueIdentifierValues(existingValues: string[], nextValues: string[]) {
  const seen = new Set(existingValues);
  const mergedValues = [...existingValues];

  nextValues.forEach((value) => {
    if (!seen.has(value)) {
      seen.add(value);
      mergedValues.push(value);
    }
  });

  return mergedValues;
}

function toUniqueIdentifierList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function PickerFieldSetting({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  placeholder: string;
  searchPlaceholder?: string;
  disabled: boolean;
}) {
  return (
    <PickerField
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder ?? "Search options"}
      emptyMessage="No matching fields."
      disabled={disabled}
    />
  );
}

function defaultMapDataNodeChange<TProps extends DataNodeWidgetSourceProps>(
  nextDataNodeId: number | undefined,
  currentProps: TProps,
) {
  return {
    ...currentProps,
    dataNodeId: nextDataNodeId,
    uniqueIdentifierList: undefined,
  };
}

export function normalizeDataNodeWidgetSourceReferenceProps<
  TProps extends DataNodeWidgetSourceReferenceProps,
>(props: TProps) {
  return {
    ...props,
    sourceMode: normalizeSourceMode(props.sourceMode),
    sourceWidgetId: normalizeSourceWidgetId(props.sourceWidgetId),
  } satisfies TProps;
}

function buildFilterWidgetOptions(
  widgets: DashboardWidgetRegistryEntry[],
  currentWidgetInstanceId?: string,
): PickerOption[] {
  return widgets
    .filter(
      (widget) =>
        widget.widgetId === mainSequenceDataNodeWidgetId &&
        widget.id !== currentWidgetInstanceId,
    )
    .map((widget) => {
      const widgetDefinition = getWidgetById(widget.widgetId);
      const widgetTitle = widget.title?.trim() || widgetDefinition?.title || "Data Node";

      return {
        value: widget.id,
        label: widgetTitle,
        description: widget.id,
        keywords: [widget.id, widgetTitle, widget.widgetId],
      } satisfies PickerOption;
    });
}

export function useResolvedDataNodeWidgetSourceBinding<
  TProps extends DataNodeWidgetSourceProps & Partial<DataNodeWidgetSourceReferenceProps>,
>({
  props,
  currentWidgetInstanceId,
}: {
  props: TProps;
  currentWidgetInstanceId?: string;
}) {
  const widgetRegistry = useDashboardWidgetRegistry();
  const normalizedReference = useMemo(
    () => normalizeDataNodeWidgetSourceReferenceProps(props),
    [props],
  );
  const filterWidgetOptions = useMemo(
    () => buildFilterWidgetOptions(widgetRegistry, currentWidgetInstanceId),
    [currentWidgetInstanceId, widgetRegistry],
  );
  const referencedFilterWidget = useMemo(
    () =>
      normalizedReference.sourceMode === "filter_widget" && normalizedReference.sourceWidgetId
        ? widgetRegistry.find(
            (widget) =>
              widget.id !== currentWidgetInstanceId &&
              widget.id === normalizedReference.sourceWidgetId &&
              widget.widgetId === mainSequenceDataNodeWidgetId,
          ) ?? null
        : null,
    [currentWidgetInstanceId, normalizedReference.sourceMode, normalizedReference.sourceWidgetId, widgetRegistry],
  );
  const resolvedSourceProps = useMemo(
    () =>
      normalizedReference.sourceMode === "filter_widget"
        ? normalizeDataNodeWidgetSourceProps(
            (referencedFilterWidget?.props ?? {}) as DataNodeWidgetSourceProps,
          )
        : normalizeDataNodeWidgetSourceProps(props),
    [normalizedReference.sourceMode, props, referencedFilterWidget?.props],
  );

  return {
    filterWidgetOptions,
    hasResolvedFilterWidgetSource:
      normalizedReference.sourceMode !== "filter_widget" || referencedFilterWidget !== null,
    isFilterWidgetSource: normalizedReference.sourceMode === "filter_widget",
    referencedFilterWidget,
    resolvedSourceProps,
    sourceMode: normalizedReference.sourceMode,
    sourceWidgetId: normalizedReference.sourceWidgetId,
  };
}

export function resolveDataNodeWidgetSourceConfig(
  props: DataNodeWidgetSourceProps,
  detail?: DataNodeDetail | null,
): ResolvedDataNodeWidgetSourceConfig {
  const dataNodeId = normalizePositiveInteger(props.dataNodeId);
  const dateRangeMode: DataNodeDateRangeMode =
    props.dateRangeMode === "fixed" ? "fixed" : "dashboard";
  const fixedStartMs = normalizeTimestampMs(props.fixedStartMs);
  const fixedEndMs = normalizeTimestampMs(props.fixedEndMs);
  const availableFields = buildDataNodeFieldOptions(detail);
  const normalizedUniqueIdentifierList = normalizeUniqueIdentifierList(props.uniqueIdentifierList);
  const supportsIdentifierList =
    detail != null
      ? supportsUniqueIdentifierList(detail)
      : normalizedUniqueIdentifierList !== undefined;
  const uniqueIdentifierList =
    detail != null
      ? supportsIdentifierList
        ? normalizedUniqueIdentifierList
        : undefined
      : normalizedUniqueIdentifierList;

  return {
    availableFields,
    dataNodeId,
    dataNodeLabel: formatDataNodeLabel(
      detail ?? (dataNodeId ? { id: dataNodeId, storage_hash: "", identifier: null } : null),
    ),
    dateRangeMode,
    fixedEndMs,
    fixedStartMs,
    supportsUniqueIdentifierList: supportsIdentifierList,
    uniqueIdentifierList,
  };
}

export function normalizeDataNodeWidgetSourceProps<TProps extends DataNodeWidgetSourceProps>(
  props: TProps,
  detail?: DataNodeDetail | null,
) {
  const resolved = resolveDataNodeWidgetSourceConfig(props, detail);

  return {
    ...props,
    dataNodeId: resolved.dataNodeId,
    dateRangeMode: resolved.dateRangeMode,
    fixedStartMs: resolved.fixedStartMs,
    fixedEndMs: resolved.fixedEndMs,
    uniqueIdentifierList: resolved.uniqueIdentifierList,
  } satisfies TProps;
}

export function useDataNodeWidgetSourceControllerContext<
  TProps extends DataNodeWidgetSourceProps & Partial<DataNodeWidgetSourceReferenceProps>,
  TResolvedConfig extends ResolvedDataNodeWidgetSourceConfig,
>({
  props,
  currentWidgetInstanceId,
  queryKeyScope,
  resolveConfig,
}: {
  props: TProps;
  currentWidgetInstanceId?: string;
  queryKeyScope: string;
  resolveConfig: (props: TProps, detail?: DataNodeDetail | null) => TResolvedConfig;
}): DataNodeWidgetSourceControllerContext<TResolvedConfig> {
  const sourceBinding = useResolvedDataNodeWidgetSourceBinding({ props, currentWidgetInstanceId });
  const selectedDataNodeId = Number(sourceBinding.resolvedSourceProps.dataNodeId ?? 0);
  const selectedDataNodeDetailQuery = useQuery({
    queryKey: ["main_sequence", "widgets", queryKeyScope, "detail", selectedDataNodeId],
    queryFn: () => fetchDataNodeDetail(selectedDataNodeId),
    enabled: Number.isFinite(selectedDataNodeId) && selectedDataNodeId > 0,
    staleTime: 300_000,
  });

  const resolvedConfig = useMemo(
    () =>
      resolveConfig(
        {
          ...props,
          ...sourceBinding.resolvedSourceProps,
        },
        selectedDataNodeDetailQuery.data,
      ),
    [props, resolveConfig, selectedDataNodeDetailQuery.data, sourceBinding.resolvedSourceProps],
  );
  const fieldPickerOptions = useMemo<PickerOption[]>(
    () => resolvedConfig.availableFields.map(toFieldPickerOption),
    [resolvedConfig.availableFields],
  );
  const hasLoadedDataNodeDetail = Boolean(selectedDataNodeDetailQuery.data);
  const hasSourceTableConfiguration = Boolean(
    selectedDataNodeDetailQuery.data?.sourcetableconfiguration,
  );

  return {
    currentWidgetInstanceId,
    filterWidgetOptions: sourceBinding.filterWidgetOptions,
    fieldPickerOptions,
    hasLoadedDataNodeDetail,
    hasNoData: hasLoadedDataNodeDetail && !hasSourceTableConfiguration,
    hasResolvedFilterWidgetSource: sourceBinding.hasResolvedFilterWidgetSource,
    isFilterWidgetSource: sourceBinding.isFilterWidgetSource,
    referencedFilterWidget: sourceBinding.referencedFilterWidget,
    resolvedConfig,
    resolvedSourceProps: sourceBinding.resolvedSourceProps,
    selectedDataNodeDetailQuery,
    selectedDataNodeId,
    sourceMode: sourceBinding.sourceMode,
    sourceWidgetId: sourceBinding.sourceWidgetId,
    supportsUniqueIdentifierList: resolvedConfig.supportsUniqueIdentifierList,
  };
}

export function createDataNodeWidgetSourceSettingsSchema<
  TProps extends DataNodeWidgetSourceProps,
  TContext extends DataNodeWidgetSourceControllerContext,
>({
  additionalFields = [],
  additionalSections = [],
  dataNodeCanvasQueryScope = "data_node_widget_source_canvas",
  dataSourceSectionDescription = "Pick the data node and optional unique identifiers for this widget instance.",
  dateRangeSectionDescription = "Choose whether this widget follows the dashboard date or keeps its own range.",
  enableFilterWidgetSource = false,
  filterWidgetOnly = false,
  mapDataNodeChange = defaultMapDataNodeChange,
  selectionHelpText = "Choose the table this widget should read from.",
}: CreateDataNodeWidgetSourceSchemaOptions<TProps, TContext> = {}): WidgetSettingsSchema<
  TProps,
  TContext
> {
  function DataNodePickerField({
    draftProps,
    onDraftPropsChange,
    editable,
    context,
  }: WidgetFieldSettingsRendererProps<TProps, TContext>) {
    return (
      <DataNodeQuickSearchPicker
        value={context.selectedDataNodeId}
        onChange={(nextId) => {
          onDraftPropsChange(mapDataNodeChange(nextId, draftProps));
        }}
        editable={editable}
        queryScope="data_node_widget_source"
        selectedDataNode={context.selectedDataNodeDetailQuery.data}
        detailError={context.selectedDataNodeDetailQuery.error}
        hasNoData={context.hasNoData}
        selectionHelpText={selectionHelpText}
      />
    );
  }

  function FilterWidgetPickerField({
    draftProps,
    onDraftPropsChange,
    editable,
    context,
  }: WidgetFieldSettingsRendererProps<TProps, TContext>) {
    return (
      <PickerField
        value={context.sourceWidgetId ?? ""}
        onChange={(value) => {
          onDraftPropsChange({
            ...draftProps,
            sourceMode: "filter_widget",
            sourceWidgetId: value || undefined,
          });
        }}
        options={context.filterWidgetOptions}
        placeholder={
          context.filterWidgetOptions.length > 0
            ? "Select a Data Node"
            : "No Data Nodes are available"
        }
        searchPlaceholder="Search data nodes"
        emptyMessage="No Data Nodes are available in this dashboard."
        disabled={!editable || context.filterWidgetOptions.length === 0}
      />
    );
  }

  function SourceModeField({
    draftProps,
    onDraftPropsChange,
    editable,
  }: WidgetFieldSettingsRendererProps<TProps, TContext>) {
    return (
      <PickerFieldSetting
        value={normalizeSourceMode((draftProps as Partial<DataNodeWidgetSourceReferenceProps>).sourceMode)}
        onChange={(value) => {
          onDraftPropsChange({
            ...draftProps,
            sourceMode: value === "filter_widget" ? "filter_widget" : "direct",
          });
        }}
        options={[
          {
            value: "direct",
            label: "Direct query",
            description: "This widget owns its own data node and date-range source.",
          },
          {
            value: "filter_widget",
            label: "Data Node",
            description: "Read source settings from another Data Node in this dashboard.",
          },
        ]}
        placeholder="Select a source mode"
        disabled={!editable}
      />
    );
  }

  function DataNodePickerCanvasField({
    props,
    onPropsChange,
    editable,
    context,
  }: WidgetFieldCanvasRendererProps<TProps, TContext>) {
    return (
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Data node
        </div>
        <DataNodeQuickSearchPicker
          value={context.selectedDataNodeId}
          onChange={(nextId) => {
            onPropsChange(mapDataNodeChange(nextId, props));
          }}
          editable={editable}
          queryScope={dataNodeCanvasQueryScope}
          selectedDataNode={context.selectedDataNodeDetailQuery.data}
          showStatus={false}
        />
      </div>
    );
  }

  function UniqueIdentifierField({
    draftProps,
    onDraftPropsChange,
    editable,
  }: WidgetFieldSettingsRendererProps<TProps, TContext>) {
    const [inputValue, setInputValue] = useState("");
    const uniqueIdentifierList = toUniqueIdentifierList(draftProps.uniqueIdentifierList);

    function commitIdentifierInput(rawValue?: string) {
      const nextInputValue = rawValue ?? inputValue;
      const nextTokens = tokenizeUniqueIdentifierValues(nextInputValue);

      if (nextTokens.length === 0) {
        setInputValue("");
        return;
      }

      onDraftPropsChange({
        ...draftProps,
        uniqueIdentifierList: mergeUniqueIdentifierValues(uniqueIdentifierList, nextTokens),
      });
      setInputValue("");
    }

    function removeIdentifier(identifier: string) {
      onDraftPropsChange({
        ...draftProps,
        uniqueIdentifierList: uniqueIdentifierList.filter((value) => value !== identifier),
      });
    }

    return (
      <div className="space-y-2">
        <div className="rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/35 px-3 py-3 shadow-sm transition-colors focus-within:border-ring/70 focus-within:ring-2 focus-within:ring-ring/20">
          <div className="flex flex-wrap items-center gap-2">
            {uniqueIdentifierList.map((identifier) => (
              <Badge
                key={identifier}
                variant="neutral"
                className="border border-border/70 bg-card/80 px-2.5 py-1 text-[11px] text-foreground"
              >
                <span>{identifier}</span>
                <button
                  type="button"
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={`Remove ${identifier}`}
                  title={`Remove ${identifier}`}
                  onClick={() => {
                    removeIdentifier(identifier);
                  }}
                  disabled={!editable}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}

            <input
              value={inputValue}
              onChange={(event) => {
                setInputValue(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  commitIdentifierInput();
                  return;
                }

                if (event.key === "Backspace" && !inputValue && uniqueIdentifierList.length > 0) {
                  event.preventDefault();
                  removeIdentifier(uniqueIdentifierList[uniqueIdentifierList.length - 1]!);
                }
              }}
              onBlur={() => {
                commitIdentifierInput();
              }}
              placeholder={
                uniqueIdentifierList.length > 0
                  ? "Add another identifier"
                  : "Type an identifier and press Enter"
              }
              className="h-8 min-w-[180px] flex-1 border-0 bg-transparent px-0 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              disabled={!editable}
            />
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Use Backspace on an empty field to remove the last identifier.
        </div>
      </div>
    );
  }

  function UniqueIdentifierCanvasField({
    props,
    onPropsChange,
  }: WidgetFieldCanvasRendererProps<TProps, TContext>) {
    const [inputValue, setInputValue] = useState("");
    const uniqueIdentifierList = toUniqueIdentifierList(props.uniqueIdentifierList);

    function commitIdentifierInput(rawValue?: string) {
      const nextInputValue = rawValue ?? inputValue;
      const nextTokens = tokenizeUniqueIdentifierValues(nextInputValue);

      if (nextTokens.length === 0) {
        setInputValue("");
        return;
      }

      onPropsChange({
        ...props,
        uniqueIdentifierList: mergeUniqueIdentifierValues(uniqueIdentifierList, nextTokens),
      });
      setInputValue("");
    }

    function removeIdentifier(identifier: string) {
      onPropsChange({
        ...props,
        uniqueIdentifierList: uniqueIdentifierList.filter((value) => value !== identifier),
      });
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Unique identifiers
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            disabled={uniqueIdentifierList.length === 0}
            onClick={() => {
              onPropsChange({
                ...props,
                uniqueIdentifierList: undefined,
              });
            }}
          >
            Clear
          </Button>
        </div>

        <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/35 px-2.5 py-2">
          <div className="flex flex-wrap items-center gap-2">
            {uniqueIdentifierList.map((identifier) => (
              <Badge
                key={identifier}
                variant="neutral"
                className="border border-border/70 bg-card/80 px-2 py-1 text-[10px] text-foreground"
              >
                <span>{identifier}</span>
                <button
                  type="button"
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => {
                    removeIdentifier(identifier);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <input
              value={inputValue}
              onChange={(event) => {
                setInputValue(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  commitIdentifierInput();
                }
              }}
              onBlur={() => {
                commitIdentifierInput();
              }}
              placeholder={uniqueIdentifierList.length > 0 ? "Add identifier" : "Filter rows"}
              className="h-7 min-w-[120px] flex-1 border-0 bg-transparent px-0 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </div>
    );
  }

  const sections: WidgetFieldSection[] = [
    {
      id: "data-source",
      title: "Data source",
      description: dataSourceSectionDescription,
    },
    {
      id: "date-range",
      title: "Date range",
      description: dateRangeSectionDescription,
    },
    ...additionalSections,
  ];

  const fields: WidgetFieldDefinition<TProps, TContext>[] = [
    ...(enableFilterWidgetSource
      ? [
          {
            id: "sourceMode",
            label: "Source mode",
            description: "Choose whether this widget owns its own query source or follows another Data Node.",
            sectionId: "data-source",
            isVisible: () => !filterWidgetOnly,
            renderSettings: SourceModeField,
          } satisfies WidgetFieldDefinition<TProps, TContext>,
          {
            id: "sourceWidgetId",
            label: "Data Node",
            description: "Reference a Data Node from this dashboard.",
            sectionId: "data-source",
            isVisible: ({ context }) => filterWidgetOnly || context.sourceMode === "filter_widget",
            renderSettings: FilterWidgetPickerField,
          } satisfies WidgetFieldDefinition<TProps, TContext>,
        ]
      : []),
    {
      id: "dataNodeId",
      label: "Data node",
      description: selectionHelpText,
      sectionId: "data-source",
      pop: {
        canPop: true,
        defaultPopped: false,
        anchor: "top",
        mode: "inline",
        defaultWidth: 340,
        defaultHeight: 96,
      },
      isVisible: ({ context }) => !filterWidgetOnly && context.sourceMode !== "filter_widget",
      renderSettings: DataNodePickerField,
      renderCanvas: DataNodePickerCanvasField,
    },
    {
      id: "uniqueIdentifierList",
      label: "Unique identifiers",
      description: "Filter the widget to a saved list of identifiers.",
      sectionId: "data-source",
      pop: {
        canPop: true,
        defaultPopped: true,
        anchor: "top",
        mode: "token-list",
        defaultWidth: 360,
        defaultHeight: 116,
      },
      isVisible: ({ context }) =>
        !filterWidgetOnly &&
        context.sourceMode !== "filter_widget" &&
        context.supportsUniqueIdentifierList &&
        !context.hasNoData,
      renderSettings: UniqueIdentifierField,
      renderCanvas: UniqueIdentifierCanvasField,
    },
    {
      id: "dateRangeMode",
      label: "Mode",
      description: "Follow the dashboard range or save an independent fixed range.",
      sectionId: "date-range",
      isVisible: ({ context }) => !filterWidgetOnly && context.sourceMode !== "filter_widget",
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.dateRangeMode}
          onChange={(value) => {
            onDraftPropsChange({
              ...draftProps,
              dateRangeMode: value === "fixed" ? "fixed" : "dashboard",
            });
          }}
          options={dateRangeModeOptions}
          placeholder="Select a date mode"
          disabled={!editable}
        />
      ),
    },
    {
      id: "fixedStartMs",
      label: "From",
      description: "Saved fixed range start for this widget.",
      settingsColumnSpan: 1,
      sectionId: "date-range",
      isVisible: ({ context }) =>
        !filterWidgetOnly &&
        context.sourceMode !== "filter_widget" &&
        context.resolvedConfig.dateRangeMode === "fixed",
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <DataNodeDateTimeField
          valueMs={context.resolvedConfig.fixedStartMs}
          editable={editable}
          onChangeValue={(nextValue) => {
            onDraftPropsChange({
              ...draftProps,
              fixedStartMs: nextValue,
            });
          }}
        />
      ),
    },
    {
      id: "fixedEndMs",
      label: "To",
      description: "Saved fixed range end for this widget.",
      settingsColumnSpan: 1,
      sectionId: "date-range",
      isVisible: ({ context }) =>
        !filterWidgetOnly &&
        context.sourceMode !== "filter_widget" &&
        context.resolvedConfig.dateRangeMode === "fixed",
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <DataNodeDateTimeField
          valueMs={context.resolvedConfig.fixedEndMs}
          editable={editable}
          onChangeValue={(nextValue) => {
            onDraftPropsChange({
              ...draftProps,
              fixedEndMs: nextValue,
            });
          }}
        />
      ),
    },
    ...additionalFields,
  ];

  return {
    sections,
    fields,
  };
}
