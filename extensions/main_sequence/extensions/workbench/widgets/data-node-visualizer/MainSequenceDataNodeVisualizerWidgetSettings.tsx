import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Loader2, RefreshCw, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardControls } from "@/dashboards/DashboardControls";
import { useTheme } from "@/themes/ThemeProvider";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import { MainSequenceSelectionCheckbox } from "../../../../common/components/MainSequenceSelectionCheckbox";
import { PickerField, type PickerOption } from "../../../../common/components/PickerField";
import {
  fetchDataNodeDataBetweenDatesFromRemote,
  fetchDataNodeDetail,
  fetchDataNodeLastObservation,
  formatMainSequenceError,
  quickSearchDataNodes,
} from "../../../../common/api";
import { DataNodeVisualizerTable } from "./DataNodeVisualizerTable";
import {
  buildDataNodeVisualizerSeries,
  buildDataNodeVisualizerTableColumns,
  formatDataNodeLabel,
  normalizeDataNodeVisualizerProps,
  resolveDataNodeVisualizerDateRange,
  resolveDataNodeVisualizerConfig,
  resolveDataNodeVisualizerNormalizationTimeMs,
  resolveDataNodeVisualizerPreviewAnchorMs,
  type DataNodeVisualizerDateRangeMode,
  type DataNodeVisualizerFieldOption,
  type DataNodeVisualizerViewMode,
  type MainSequenceDataNodeVisualizerWidgetProps,
} from "./dataNodeVisualizerModel";
import { TradingViewSeriesChart } from "./TradingViewSeriesChart";

const defaultPreviewWindowMs = 24 * 60 * 60 * 1000;
const dataNodeOptionLimit = 50;
const previewRowLimit = 2_500;
const previewRangePresets = [
  { label: "24H", durationMs: 24 * 60 * 60 * 1000 },
  { label: "7D", durationMs: 7 * 24 * 60 * 60 * 1000 },
  { label: "30D", durationMs: 30 * 24 * 60 * 60 * 1000 },
  { label: "90D", durationMs: 90 * 24 * 60 * 60 * 1000 },
];
const providerOptions: PickerOption[] = [
  {
    value: "tradingview",
    label: "TradingView Lightweight Charts",
    description: "Theme-aligned interactive chart renderer.",
  },
];
const chartTypeOptions: PickerOption[] = [
  { value: "line", label: "Line", description: "Standard time-series line chart." },
  { value: "area", label: "Area", description: "Filled area chart." },
  { value: "bar", label: "Bar", description: "Bar-style time series." },
];
const displayModeOptions: PickerOption[] = [
  { value: "chart", label: "Chart", description: "Open with the visualization first." },
  { value: "table", label: "Table", description: "Open with the raw rows first." },
];
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
const axisModeOptions: PickerOption[] = [
  { value: "shared", label: "Shared axis", description: "Keep all series in one pane." },
  {
    value: "separate",
    label: "Separate axes",
    description: "Render each series in its own aligned pane.",
  },
];
const hexColorPattern = /^#(?:[0-9a-fA-F]{6})$/;

function formatDateTimeLocalValue(timestampMs: number) {
  const date = new Date(timestampMs);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function parseDateTimeLocalValue(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPreviewTimestamp(timestampMs: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestampMs);
}

function formatRangeSummary(startMs: number, endMs: number) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `${formatter.format(startMs)} - ${formatter.format(endMs)}`;
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

function areUniqueIdentifierListsEqual(leftValues: string[], rightValues: string[]) {
  if (leftValues.length !== rightValues.length) {
    return false;
  }

  return leftValues.every((value, index) => value === rightValues[index]);
}

function toColorInputValue(value: string | undefined, fallback: string) {
  if (value && hexColorPattern.test(value.trim())) {
    return value.trim().toLowerCase();
  }

  return fallback;
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/30 p-4">
      {title || description ? (
        <div className="space-y-1">
          {title ? <div className="text-sm font-medium text-topbar-foreground">{title}</div> : null}
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function toFieldPickerOption(field: DataNodeVisualizerFieldOption): PickerOption {
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

export function MainSequenceDataNodeVisualizerWidgetSettings({
  draftProps,
  editable,
  onDraftPropsChange,
}: WidgetSettingsComponentProps<MainSequenceDataNodeVisualizerWidgetProps>) {
  const { resolvedTokens } = useTheme();
  const {
    rangeStartMs: dashboardRangeStartMs,
    rangeEndMs: dashboardRangeEndMs,
    timeRangeLabel,
  } = useDashboardControls();
  const selectedDataNodeId = Number(draftProps.dataNodeId ?? 0);
  const [dataNodeSearchValue, setDataNodeSearchValue] = useState("");
  const [normalizeAtValue, setNormalizeAtValue] = useState("");
  const [previewModeOverride, setPreviewModeOverride] = useState<DataNodeVisualizerViewMode | null>(
    null,
  );
  const [fixedStartValue, setFixedStartValue] = useState("");
  const [fixedEndValue, setFixedEndValue] = useState("");
  const [uniqueIdentifierInputValue, setUniqueIdentifierInputValue] = useState("");
  const [pendingUniqueIdentifierList, setPendingUniqueIdentifierList] = useState<string[]>([]);
  const deferredDataNodeSearchValue = useDeferredValue(dataNodeSearchValue);
  const normalizedDataNodeSearchValue = deferredDataNodeSearchValue.trim();

  const dataNodesQuery = useQuery({
    queryKey: [
      "main_sequence",
      "widgets",
      "data_node_visualizer",
      "quick_search",
      normalizedDataNodeSearchValue,
    ],
    queryFn: () =>
      quickSearchDataNodes({
        limit: dataNodeOptionLimit,
        q: normalizedDataNodeSearchValue,
      }),
    enabled: normalizedDataNodeSearchValue.length >= 3,
    staleTime: 300_000,
  });
  const selectedDataNodeDetailQuery = useQuery({
    queryKey: ["main_sequence", "widgets", "data_node_visualizer", "detail", selectedDataNodeId],
    queryFn: () => fetchDataNodeDetail(selectedDataNodeId),
    enabled: Number.isFinite(selectedDataNodeId) && selectedDataNodeId > 0,
    staleTime: 300_000,
  });
  const lastObservationQuery = useQuery({
    queryKey: [
      "main_sequence",
      "widgets",
      "data_node_visualizer",
      "last_observation",
      selectedDataNodeId,
    ],
    queryFn: () => fetchDataNodeLastObservation(selectedDataNodeId),
    enabled: Number.isFinite(selectedDataNodeId) && selectedDataNodeId > 0,
    staleTime: 300_000,
  });

  const dataNodeOptions = useMemo(() => {
    const baseOptions = normalizedDataNodeSearchValue.length >= 3 ? dataNodesQuery.data ?? [] : [];
    const selectedDetail = selectedDataNodeDetailQuery.data;

    if (
      selectedDetail &&
      !baseOptions.some((dataNode) => dataNode.id === selectedDetail.id)
    ) {
      return [selectedDetail, ...baseOptions];
    }

    return baseOptions;
  }, [dataNodesQuery.data, selectedDataNodeDetailQuery.data]);
  const dataNodePickerOptions = useMemo<PickerOption[]>(
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

  const resolvedConfig = useMemo(
    () => resolveDataNodeVisualizerConfig(draftProps, selectedDataNodeDetailQuery.data),
    [draftProps, selectedDataNodeDetailQuery.data],
  );
  const fieldPickerOptions = useMemo<PickerOption[]>(
    () => resolvedConfig.availableFields.map(toFieldPickerOption),
    [resolvedConfig.availableFields],
  );
  const hasLoadedDataNodeDetail = Boolean(selectedDataNodeDetailQuery.data);
  const hasSourceTableConfiguration = Boolean(selectedDataNodeDetailQuery.data?.sourcetableconfiguration);
  const hasNoData = hasLoadedDataNodeDetail && !hasSourceTableConfiguration;
  const supportsUniqueIdentifierList = resolvedConfig.supportsUniqueIdentifierList;
  const xAxisOptions = useMemo<PickerOption[]>(
    () => [
      {
        value: "",
        label: "Auto",
        description: "Use the default time field.",
      },
      ...fieldPickerOptions,
    ],
    [fieldPickerOptions],
  );
  const yAxisOptions = useMemo<PickerOption[]>(
    () => [
      {
        value: "",
        label: "Auto",
        description: "Use the default value field.",
      },
      ...fieldPickerOptions,
    ],
    [fieldPickerOptions],
  );
  const groupOptions = useMemo<PickerOption[]>(
    () => [
      {
        value: "",
        label: "No grouping",
        description: "Keep all rows in the same series.",
      },
      ...fieldPickerOptions,
    ],
    [fieldPickerOptions],
  );
  const previewRequestedColumns = useMemo(
    () => resolvedConfig.availableFields.map((field) => field.key),
    [resolvedConfig.availableFields],
  );
  const previewAnchorMs = useMemo(
    () =>
      resolveDataNodeVisualizerPreviewAnchorMs(
        selectedDataNodeDetailQuery.data,
        lastObservationQuery.data,
      ),
    [lastObservationQuery.data, selectedDataNodeDetailQuery.data],
  );
  const resolvedRange = useMemo(
    () =>
      resolveDataNodeVisualizerDateRange(
        resolvedConfig,
        dashboardRangeStartMs,
        dashboardRangeEndMs,
      ),
    [dashboardRangeEndMs, dashboardRangeStartMs, resolvedConfig],
  );
  const rangeSummary = useMemo(() => {
    if (resolvedConfig.dateRangeMode === "dashboard") {
      return timeRangeLabel;
    }

    if (resolvedRange.rangeStartMs !== null && resolvedRange.rangeEndMs !== null) {
      return formatRangeSummary(resolvedRange.rangeStartMs, resolvedRange.rangeEndMs);
    }

    return "Choose a fixed date.";
  }, [resolvedConfig.dateRangeMode, resolvedRange.rangeEndMs, resolvedRange.rangeStartMs, timeRangeLabel]);
  const previewSpanMs = useMemo(() => {
    if (
      resolvedRange.rangeStartMs !== null &&
      resolvedRange.rangeEndMs !== null &&
      resolvedRange.rangeStartMs < resolvedRange.rangeEndMs
    ) {
      return resolvedRange.rangeEndMs - resolvedRange.rangeStartMs;
    }

    if (
      Number.isFinite(dashboardRangeStartMs) &&
      Number.isFinite(dashboardRangeEndMs) &&
      dashboardRangeStartMs < dashboardRangeEndMs
    ) {
      return dashboardRangeEndMs - dashboardRangeStartMs;
    }

    return defaultPreviewWindowMs;
  }, [
    dashboardRangeEndMs,
    dashboardRangeStartMs,
    resolvedRange.rangeEndMs,
    resolvedRange.rangeStartMs,
  ]);
  const previewRange = useMemo(() => {
    if (previewAnchorMs !== null) {
      return {
        rangeStartMs: previewAnchorMs - previewSpanMs,
        rangeEndMs: previewAnchorMs,
        hasValidRange: previewSpanMs > 0,
      };
    }

    return {
      rangeStartMs: resolvedRange.rangeStartMs,
      rangeEndMs: resolvedRange.rangeEndMs,
      hasValidRange: resolvedRange.hasValidRange,
    };
  }, [previewAnchorMs, previewSpanMs, resolvedRange]);
  const previewRangeSummary = useMemo(() => {
    if (previewRange.rangeStartMs !== null && previewRange.rangeEndMs !== null) {
      return formatRangeSummary(previewRange.rangeStartMs, previewRange.rangeEndMs);
    }

    return rangeSummary;
  }, [previewRange.rangeEndMs, previewRange.rangeStartMs, rangeSummary]);
  const activePreviewMode = previewModeOverride ?? resolvedConfig.displayMode;
  const appliedUniqueIdentifierList = resolvedConfig.uniqueIdentifierList ?? [];
  const hasPendingUniqueIdentifierChanges = !areUniqueIdentifierListsEqual(
    pendingUniqueIdentifierList,
    appliedUniqueIdentifierList,
  );

  const previewQuery = useQuery({
    queryKey: [
      "main_sequence",
      "widgets",
      "data_node_visualizer",
      "preview",
      resolvedConfig.dataNodeId,
      previewRequestedColumns.join("|"),
      (resolvedConfig.uniqueIdentifierList ?? []).join("|"),
      previewRange.rangeStartMs,
      previewRange.rangeEndMs,
      resolvedConfig.limit,
    ],
    queryFn: () =>
      fetchDataNodeDataBetweenDatesFromRemote(resolvedConfig.dataNodeId!, {
        start_date: Math.floor(previewRange.rangeStartMs! / 1000),
        end_date: Math.floor(previewRange.rangeEndMs! / 1000),
        columns: previewRequestedColumns,
        unique_identifier_list: resolvedConfig.uniqueIdentifierList,
        great_or_equal: true,
        less_or_equal: true,
        limit: Math.min(resolvedConfig.limit, previewRowLimit),
        offset: 0,
      }),
    enabled:
      Boolean(resolvedConfig.dataNodeId) &&
      previewRequestedColumns.length > 0 &&
      previewRange.hasValidRange,
    staleTime: 60_000,
  });

  const previewSeriesResult = useMemo(
    () => buildDataNodeVisualizerSeries(previewQuery.data ?? [], resolvedConfig),
    [previewQuery.data, resolvedConfig],
  );
  const previewTableColumns = useMemo(
    () => buildDataNodeVisualizerTableColumns(previewQuery.data ?? [], resolvedConfig),
    [previewQuery.data, resolvedConfig],
  );
  const previewNormalizationTimeMs = useMemo(
    () =>
      resolveDataNodeVisualizerNormalizationTimeMs(
        resolvedConfig,
        previewRange.rangeStartMs,
      ),
    [previewRange.rangeStartMs, resolvedConfig],
  );
  const previewChartEmptyMessage =
    (previewQuery.data?.length ?? 0) > 0
      ? "Rows were loaded, but the selected X field is not time-like or the Y field is not numeric."
      : "No chartable rows are available for the selected range.";
  const seriesPalette = useMemo(
    () => [
      resolvedTokens.primary,
      resolvedTokens.accent,
      resolvedTokens.success,
      resolvedTokens.warning,
      resolvedTokens.danger,
      resolvedTokens.foreground,
    ],
    [
      resolvedTokens.accent,
      resolvedTokens.danger,
      resolvedTokens.foreground,
      resolvedTokens.primary,
      resolvedTokens.success,
      resolvedTokens.warning,
    ],
  );
  const seriesStyleRows = useMemo(() => {
    const orderedRows = new Map<string, { id: string; label: string; pointCount: number }>();

    previewSeriesResult.series.forEach((series) => {
      orderedRows.set(series.id, {
        id: series.id,
        label: series.label,
        pointCount: series.pointCount,
      });
    });

    if (!resolvedConfig.groupField && resolvedConfig.yField && !orderedRows.has(resolvedConfig.yField)) {
      orderedRows.set(resolvedConfig.yField, {
        id: resolvedConfig.yField,
        label: resolvedConfig.yField,
        pointCount: 0,
      });
    }

    Object.keys(resolvedConfig.seriesOverrides ?? {}).forEach((seriesId) => {
      if (!orderedRows.has(seriesId)) {
        orderedRows.set(seriesId, {
          id: seriesId,
          label: seriesId,
          pointCount: 0,
        });
      }
    });

    return [...orderedRows.values()].map((row, index) => ({
      ...row,
      color: toColorInputValue(
        resolvedConfig.seriesOverrides?.[row.id]?.color,
        toColorInputValue(seriesPalette[index % seriesPalette.length], "#2563eb"),
      ),
    }));
  }, [
    previewSeriesResult.series,
    resolvedConfig.groupField,
    resolvedConfig.seriesOverrides,
    resolvedConfig.yField,
    seriesPalette,
  ]);

  useEffect(() => {
    if (!selectedDataNodeDetailQuery.data) {
      return;
    }

    const normalized = normalizeDataNodeVisualizerProps(
      draftProps,
      selectedDataNodeDetailQuery.data,
    );

    if (JSON.stringify(normalized) !== JSON.stringify(draftProps)) {
      onDraftPropsChange(normalized);
    }
  }, [draftProps, onDraftPropsChange, selectedDataNodeDetailQuery.data]);

  useEffect(() => {
    setFixedStartValue(
      resolvedConfig.fixedStartMs ? formatDateTimeLocalValue(resolvedConfig.fixedStartMs) : "",
    );
    setFixedEndValue(
      resolvedConfig.fixedEndMs ? formatDateTimeLocalValue(resolvedConfig.fixedEndMs) : "",
    );
  }, [resolvedConfig.fixedEndMs, resolvedConfig.fixedStartMs]);

  useEffect(() => {
    if (resolvedConfig.dateRangeMode !== "fixed" || !resolvedConfig.dataNodeId) {
      return;
    }

    if (
      typeof resolvedConfig.fixedStartMs === "number" &&
      typeof resolvedConfig.fixedEndMs === "number" &&
      resolvedConfig.fixedStartMs < resolvedConfig.fixedEndMs
    ) {
      return;
    }

    const nextEndMs = previewAnchorMs ?? dashboardRangeEndMs ?? Date.now();
    const nextStartMs =
      previewAnchorMs !== null
        ? previewAnchorMs - defaultPreviewWindowMs
        : (dashboardRangeStartMs ?? nextEndMs - defaultPreviewWindowMs);

    if (!Number.isFinite(nextStartMs) || !Number.isFinite(nextEndMs) || nextStartMs >= nextEndMs) {
      return;
    }

    onDraftPropsChange({
      ...draftProps,
      fixedStartMs: Math.trunc(nextStartMs),
      fixedEndMs: Math.trunc(nextEndMs),
    });
  }, [
    dashboardRangeEndMs,
    dashboardRangeStartMs,
    draftProps,
    onDraftPropsChange,
    previewAnchorMs,
    resolvedConfig.dataNodeId,
    resolvedConfig.dateRangeMode,
    resolvedConfig.fixedEndMs,
    resolvedConfig.fixedStartMs,
  ]);

  useEffect(() => {
    setPreviewModeOverride(null);
  }, [resolvedConfig.displayMode]);

  useEffect(() => {
    setPendingUniqueIdentifierList(resolvedConfig.uniqueIdentifierList ?? []);
    setUniqueIdentifierInputValue("");
  }, [
    resolvedConfig.dataNodeId,
    resolvedConfig.supportsUniqueIdentifierList,
  ]);

  useEffect(() => {
    setNormalizeAtValue(
      resolvedConfig.normalizeAtMs ? formatDateTimeLocalValue(resolvedConfig.normalizeAtMs) : "",
    );
  }, [resolvedConfig.normalizeAtMs]);

  function applyFixedRangePreset(durationMs: number) {
    const nextEndMs = previewAnchorMs ?? resolvedRange.rangeEndMs ?? dashboardRangeEndMs ?? Date.now();
    const nextStartMs = nextEndMs - durationMs;

    setFixedStartValue(formatDateTimeLocalValue(nextStartMs));
    setFixedEndValue(formatDateTimeLocalValue(nextEndMs));
    onDraftPropsChange({
      ...draftProps,
      dateRangeMode: "fixed",
      fixedStartMs: nextStartMs,
      fixedEndMs: nextEndMs,
    });
  }

  function updateDateRangeMode(value: string) {
    const nextMode: DataNodeVisualizerDateRangeMode = value === "fixed" ? "fixed" : "dashboard";

    onDraftPropsChange({
      ...draftProps,
      dateRangeMode: nextMode,
    });
  }

  function updateFixedDateValue(kind: "start" | "end", value: string) {
    if (kind === "start") {
      setFixedStartValue(value);
    } else {
      setFixedEndValue(value);
    }

    if (!value.trim()) {
      onDraftPropsChange({
        ...draftProps,
        [kind === "start" ? "fixedStartMs" : "fixedEndMs"]: undefined,
      });
      return;
    }

    const parsed = parseDateTimeLocalValue(value);

    if (parsed === null) {
      return;
    }

    onDraftPropsChange({
      ...draftProps,
      [kind === "start" ? "fixedStartMs" : "fixedEndMs"]: parsed,
    });
  }

  function updateSeriesColor(seriesId: string, color: string) {
    const nextOverrides = {
      ...(resolvedConfig.seriesOverrides ?? {}),
      [seriesId]: {
        ...(resolvedConfig.seriesOverrides?.[seriesId] ?? {}),
        color,
      },
    };

    onDraftPropsChange({
      ...draftProps,
      seriesOverrides: nextOverrides,
    });
  }

  function clearSeriesColor(seriesId: string) {
    const nextOverrides = { ...(resolvedConfig.seriesOverrides ?? {}) };
    delete nextOverrides[seriesId];

    onDraftPropsChange({
      ...draftProps,
      seriesOverrides: Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined,
    });
  }

  function commitUniqueIdentifierInput(rawValue?: string) {
    const nextInputValue = rawValue ?? uniqueIdentifierInputValue;
    const nextTokens = tokenizeUniqueIdentifierValues(nextInputValue);

    if (nextTokens.length === 0) {
      return;
    }

    setPendingUniqueIdentifierList((currentValues) =>
      mergeUniqueIdentifierValues(currentValues, nextTokens),
    );
    setUniqueIdentifierInputValue("");
  }

  function removePendingUniqueIdentifier(valueToRemove: string) {
    setPendingUniqueIdentifierList((currentValues) =>
      currentValues.filter((value) => value !== valueToRemove),
    );
  }

  function applyUniqueIdentifierList() {
    if (!resolvedConfig.supportsUniqueIdentifierList) {
      return;
    }

    const nextUniqueIdentifierList =
      pendingUniqueIdentifierList.length > 0 ? pendingUniqueIdentifierList : undefined;

    if (hasPendingUniqueIdentifierChanges) {
      onDraftPropsChange({
        ...draftProps,
        uniqueIdentifierList: nextUniqueIdentifierList,
      });
      return;
    }

    void previewQuery.refetch();
  }

  return (
    <div className="space-y-4">
      <SettingsSection>
        <div className="grid gap-4">
          <label className="space-y-2">
            <span className="text-sm font-medium text-topbar-foreground">Data node</span>
            <PickerField
              value={selectedDataNodeId > 0 ? String(selectedDataNodeId) : ""}
              onChange={(value) => {
                const nextId = Number(value);

                onDraftPropsChange({
                  ...draftProps,
                  dataNodeId: Number.isFinite(nextId) && nextId > 0 ? nextId : undefined,
                  xField: undefined,
                  yField: undefined,
                  groupField: undefined,
                  seriesOverrides: undefined,
                  uniqueIdentifierList: undefined,
                });
                setPendingUniqueIdentifierList([]);
                setUniqueIdentifierInputValue("");
              }}
              options={dataNodePickerOptions}
              placeholder="Select a data node"
              searchPlaceholder="Search data nodes"
              emptyMessage={
                normalizedDataNodeSearchValue.length >= 3
                  ? "No matching data nodes."
                  : normalizedDataNodeSearchValue.length > 0
                    ? "Type at least 3 characters."
                    : "Type to search data nodes."
              }
              searchable
              searchValue={dataNodeSearchValue}
              onSearchValueChange={setDataNodeSearchValue}
              disabled={!editable}
              loading={normalizedDataNodeSearchValue.length >= 3 && dataNodesQuery.isFetching}
            />
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Choose the table you want to visualize.</span>
              {normalizedDataNodeSearchValue.length === 0 ? (
                <span>Type to search.</span>
              ) : normalizedDataNodeSearchValue.length < 3 ? (
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
          </label>

          {dataNodesQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(dataNodesQuery.error)}
            </div>
          ) : null}

          {selectedDataNodeDetailQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(selectedDataNodeDetailQuery.error)}
            </div>
          ) : null}

          {selectedDataNodeId > 0 &&
          hasNoData ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              This data node has no data.
            </div>
          ) : null}

          {selectedDataNodeId > 0 && supportsUniqueIdentifierList && !hasNoData ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-topbar-foreground">Unique identifiers</div>
                  <p className="text-sm text-muted-foreground">
                    Press Enter to add identifiers, then refresh the preview to query them.
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant={hasPendingUniqueIdentifierChanges ? "default" : "outline"}
                  onClick={applyUniqueIdentifierList}
                  disabled={!editable && hasPendingUniqueIdentifierChanges}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${previewQuery.isFetching && !hasPendingUniqueIdentifierChanges ? "animate-spin" : ""}`}
                  />
                  Refresh preview
                </Button>
              </div>

              <div className="rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/35 px-3 py-3 shadow-sm transition-colors focus-within:border-ring/70 focus-within:ring-2 focus-within:ring-ring/20">
                <div className="flex flex-wrap items-center gap-2">
                  {pendingUniqueIdentifierList.map((identifier) => (
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
                          removePendingUniqueIdentifier(identifier);
                        }}
                        disabled={!editable}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}

                  <input
                    value={uniqueIdentifierInputValue}
                    onChange={(event) => {
                      setUniqueIdentifierInputValue(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault();
                        commitUniqueIdentifierInput();
                        return;
                      }

                      if (event.key === "Backspace" && !uniqueIdentifierInputValue && pendingUniqueIdentifierList.length > 0) {
                        event.preventDefault();
                        removePendingUniqueIdentifier(
                          pendingUniqueIdentifierList[pendingUniqueIdentifierList.length - 1]!,
                        );
                      }
                    }}
                    onBlur={() => {
                      commitUniqueIdentifierInput();
                    }}
                    placeholder={
                      pendingUniqueIdentifierList.length > 0
                        ? "Add another identifier"
                        : "Type an identifier and press Enter"
                    }
                    className="h-8 min-w-[180px] flex-1 border-0 bg-transparent px-0 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    disabled={!editable}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Use Backspace on an empty field to remove the last identifier.</span>
                {hasPendingUniqueIdentifierChanges ? (
                  <span>Refresh preview to apply the current identifier list.</span>
                ) : (
                  <span>
                    {pendingUniqueIdentifierList.length > 0
                      ? `${pendingUniqueIdentifierList.length} identifier${pendingUniqueIdentifierList.length === 1 ? "" : "s"} applied.`
                      : "No identifier filter applied."}
                  </span>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Date range"
        description="Choose whether this widget follows the dashboard date or keeps its own saved range."
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            <label className="space-y-2">
              <span className="text-sm font-medium text-topbar-foreground">Mode</span>
              <PickerField
                value={resolvedConfig.dateRangeMode}
                onChange={updateDateRangeMode}
                options={dateRangeModeOptions}
                placeholder="Select a date mode"
                searchable={false}
                disabled={!editable}
              />
            </label>

            {resolvedConfig.dateRangeMode === "fixed" ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {previewRangePresets.map((preset) => (
                    <Button
                      key={preset.label}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyFixedRangePreset(preset.durationMs)}
                      disabled={!editable}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-topbar-foreground">From</span>
                    <Input
                      type="datetime-local"
                      value={fixedStartValue}
                      onChange={(event) => updateFixedDateValue("start", event.target.value)}
                      disabled={!editable}
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-topbar-foreground">To</span>
                    <Input
                      type="datetime-local"
                      value={fixedEndValue}
                      onChange={(event) => updateFixedDateValue("end", event.target.value)}
                      disabled={!editable}
                    />
                  </label>
                </div>

                {(fixedStartValue || fixedEndValue) && !resolvedRange.hasValidRange ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                    Pick a valid date range where the end is after the start.
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/40 px-3 py-3 text-sm text-muted-foreground">
                This widget will use the current dashboard date.
              </div>
            )}
          </div>

          <div className="min-w-[220px] rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/40 px-3 py-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              Latest observation
            </div>

            {lastObservationQuery.isLoading && previewAnchorMs === null ? (
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Finding the latest row…
              </div>
            ) : previewAnchorMs !== null ? (
              <div className="mt-2 space-y-1">
                <div className="text-sm font-medium text-foreground">
                  {formatPreviewTimestamp(previewAnchorMs)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedDataNodeDetailQuery.data?.sourcetableconfiguration?.time_index_name ??
                    "time index"}
                </div>
              </div>
            ) : selectedDataNodeId > 0 ? (
              <div className="mt-2 text-sm text-muted-foreground">
                Choose a fixed date manually.
              </div>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">
                Select a data node to anchor the fixed date presets.
              </div>
            )}

            <div className="mt-4 space-y-1">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Active range
              </div>
              <div className="text-sm text-foreground">{rangeSummary}</div>
            </div>
          </div>
        </div>

        {lastObservationQuery.isError && previewAnchorMs === null ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatMainSequenceError(lastObservationQuery.error)}
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection
        title="Visualization"
        description="Choose how the widget should render the selected data."
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.7fr)]">
          <div className="space-y-4 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/36 p-4">
            <div className="space-y-1">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Widget
              </div>
              <p className="text-sm text-muted-foreground">
                Widget-level presentation defaults for how this visualization opens.
              </p>
            </div>

            <label className="space-y-2">
              <span className="text-sm font-medium text-topbar-foreground">Default view</span>
              <PickerField
                value={resolvedConfig.displayMode}
                onChange={(value) => {
                  onDraftPropsChange({
                    ...draftProps,
                    displayMode: value === "table" ? "table" : "chart",
                  });
                }}
                options={displayModeOptions}
                placeholder="Select a default view"
                searchable={false}
                disabled={!editable}
              />
              <p className="text-sm text-muted-foreground">
                Choose whether the widget opens on the chart or the raw rows.
              </p>
            </label>
          </div>

          <div className="space-y-4 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/36 p-4">
            <div className="space-y-1">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                TradingView Provider
              </div>
              <p className="text-sm text-muted-foreground">
                Keep the renderer and TradingView chart behavior grouped together.
              </p>
            </div>

            <label className="space-y-2">
              <span className="text-sm font-medium text-topbar-foreground">Provider</span>
              <PickerField
                value={resolvedConfig.provider}
                onChange={(value) => {
                  onDraftPropsChange({
                    ...draftProps,
                    provider: value === "tradingview" ? "tradingview" : "tradingview",
                  });
                }}
                options={providerOptions}
                placeholder="Select a provider"
                searchable={false}
                disabled={!editable}
              />
              <p className="text-sm text-muted-foreground">
                Select the chart renderer.
              </p>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-topbar-foreground">Chart type</span>
                <PickerField
                  value={resolvedConfig.chartType}
                  onChange={(value) => {
                    onDraftPropsChange({
                      ...draftProps,
                      chartType: value === "area" || value === "bar" ? value : "line",
                    });
                  }}
                  options={chartTypeOptions}
                  placeholder="Select a chart type"
                  searchable={false}
                  disabled={!editable}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-topbar-foreground">Series axes</span>
                <PickerField
                  value={resolvedConfig.seriesAxisMode}
                  onChange={(value) => {
                    onDraftPropsChange({
                      ...draftProps,
                      seriesAxisMode: value === "separate" ? "separate" : "shared",
                    });
                  }}
                  options={axisModeOptions}
                  placeholder="Select an axis layout"
                  searchable={false}
                  disabled={!editable}
                />
                <p className="text-sm text-muted-foreground">
                  Use separate panes when series need independent scales.
                </p>
              </label>

              <div className="space-y-2">
                <span className="text-sm font-medium text-topbar-foreground">Normalization</span>
                <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/40 px-3 py-3">
                  <label className="flex cursor-pointer items-start gap-3">
                    <MainSequenceSelectionCheckbox
                      ariaLabel="Normalize all chart series"
                      checked={resolvedConfig.normalizeSeries}
                      className="mt-0.5"
                      onChange={() => {
                        onDraftPropsChange({
                          ...draftProps,
                          normalizeSeries: !resolvedConfig.normalizeSeries,
                        });
                      }}
                    />
                    <span className="space-y-1">
                      <span className="block text-sm font-medium text-foreground">
                        Normalize all series
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        Rebase each series to 100 at the selected date.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-medium text-topbar-foreground">Normalize at</span>
                <Input
                  type="datetime-local"
                  value={normalizeAtValue}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setNormalizeAtValue(nextValue);

                    if (!nextValue.trim()) {
                      onDraftPropsChange({
                        ...draftProps,
                        normalizeAtMs: undefined,
                      });
                      return;
                    }

                    const parsed = parseDateTimeLocalValue(nextValue);

                    if (parsed !== null) {
                      onDraftPropsChange({
                        ...draftProps,
                        normalizeAtMs: parsed,
                      });
                    }
                  }}
                  disabled={!editable || !resolvedConfig.normalizeSeries}
                />
                <p className="text-sm text-muted-foreground">
                  Leave blank to use the first date in the selected range.
                </p>
              </label>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Field mapping"
        description="Map the table fields to chart axes and grouping."
      >
        {selectedDataNodeId > 0 && hasNoData ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/20 px-4 py-5 text-sm text-muted-foreground">
            This data node has no data, so there are no fields to map.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-medium text-topbar-foreground">X axis</span>
            <PickerField
              value={resolvedConfig.xField ?? ""}
              onChange={(value) => {
                onDraftPropsChange({
                  ...draftProps,
                  xField: value || undefined,
                });
              }}
              options={xAxisOptions}
              placeholder="Auto"
              searchPlaceholder="Search X-axis fields"
              emptyMessage="No matching fields."
              disabled={!editable || resolvedConfig.availableFields.length === 0}
            />
            <p className="text-sm text-muted-foreground">
              Usually the time field.
            </p>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-topbar-foreground">Group by</span>
            <PickerField
              value={resolvedConfig.groupField ?? ""}
              onChange={(value) => {
                onDraftPropsChange({
                  ...draftProps,
                  groupField: value || undefined,
                });
              }}
              options={groupOptions}
              placeholder="No grouping"
              searchPlaceholder="Search grouping fields"
              emptyMessage="No matching fields."
              disabled={!editable || resolvedConfig.availableFields.length === 0}
            />
            <p className="text-sm text-muted-foreground">
              Split the chart into separate series.
            </p>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-topbar-foreground">Y axis</span>
            <PickerField
              value={resolvedConfig.yField ?? ""}
              onChange={(value) => {
                onDraftPropsChange({
                  ...draftProps,
                  yField: value || undefined,
                });
              }}
              options={yAxisOptions}
              placeholder="Auto"
              searchPlaceholder="Search Y-axis fields"
              emptyMessage="No matching fields."
              disabled={!editable || resolvedConfig.availableFields.length === 0}
            />
            <p className="text-sm text-muted-foreground">
              Choose the value you want to plot.
            </p>
          </label>
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title="Preview"
        description="Check the current mapping against a preview window anchored on the latest available row."
      >
        {resolvedConfig.dataNodeId ? (
          <div className="space-y-4">
            {hasNoData ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/20 px-4 py-5 text-sm text-muted-foreground">
                This data node has no data, so no preview is available.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={activePreviewMode === "chart" ? "default" : "outline"}
                      onClick={() => setPreviewModeOverride("chart")}
                    >
                      Chart
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={activePreviewMode === "table" ? "default" : "outline"}
                      onClick={() => setPreviewModeOverride("table")}
                    >
                      Table
                    </Button>
                  </div>

                  <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/40 px-3 py-2 text-sm text-muted-foreground">
                    {previewRangeSummary}
                  </div>
                </div>

                {activePreviewMode === "chart" && (!resolvedConfig.xField || !resolvedConfig.yField) ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                    Choose both axes to load the preview.
                  </div>
                ) : null}

                {previewQuery.isLoading ? (
                  <div className="grid gap-3">
                    <Skeleton className="h-6 w-48 rounded-[calc(var(--radius)-8px)]" />
                    <Skeleton className="h-[280px] rounded-[calc(var(--radius)-6px)]" />
                  </div>
                ) : null}

                {previewQuery.isError ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {formatMainSequenceError(previewQuery.error)}
                  </div>
                ) : null}

                {!previewQuery.isLoading &&
                !previewQuery.isError &&
                previewRange.hasValidRange &&
                resolvedConfig.xField &&
                resolvedConfig.yField ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{(previewQuery.data?.length ?? 0).toLocaleString()} preview rows</span>
                      {previewSeriesResult.droppedGroups > 0 ? (
                        <span>
                          showing top {previewSeriesResult.series.length.toLocaleString()} groups, hiding{" "}
                          {previewSeriesResult.droppedGroups.toLocaleString()}
                        </span>
                      ) : null}
                      {previewQuery.data && previewQuery.data.length >= previewRowLimit ? (
                        <span>preview limited to {previewRowLimit.toLocaleString()} rows</span>
                      ) : null}
                    </div>

                    {activePreviewMode === "table" ? (
                      <DataNodeVisualizerTable
                        className="min-h-[280px]"
                        columns={previewTableColumns}
                        emptyMessage="No rows are available for the preview window."
                        maxRows={40}
                        rows={previewQuery.data ?? []}
                      />
                    ) : (
                      <TradingViewSeriesChart
                        chartType={resolvedConfig.chartType}
                        className="min-h-[280px]"
                        emptyMessage={previewChartEmptyMessage}
                        normalizationTimeMs={previewNormalizationTimeMs}
                        series={previewSeriesResult.series}
                        seriesAxisMode={resolvedConfig.seriesAxisMode}
                      />
                    )}

                    {activePreviewMode === "chart" &&
                    (previewQuery.data?.length ?? 0) > 0 &&
                    previewSeriesResult.series.length === 0 ? (
                      <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                        The selected X field does not look time-like, or the Y field does not contain
                        numeric values for the selected range.
                      </div>
                    ) : null}
                  </>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/20 px-4 py-5 text-sm text-muted-foreground">
            Select a data node to enable the preview controls.
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title="Series styling"
        description="Lock specific series colors after the preview resolves the active series list."
      >
        {!resolvedConfig.dataNodeId || hasNoData ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/20 px-4 py-5 text-sm text-muted-foreground">
            Select a chartable data node to configure per-series colors.
          </div>
        ) : previewQuery.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-24 rounded-[calc(var(--radius)-6px)]" />
            <Skeleton className="h-24 rounded-[calc(var(--radius)-6px)]" />
          </div>
        ) : seriesStyleRows.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {seriesStyleRows.map((series) => (
              <div
                key={series.id}
                className="space-y-3 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/40 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{series.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {series.pointCount > 0
                        ? `${series.pointCount.toLocaleString()} preview points`
                        : "Uses the active series id when data becomes available."}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={!editable || !resolvedConfig.seriesOverrides?.[series.id]?.color}
                    onClick={() => clearSeriesColor(series.id)}
                  >
                    Reset
                  </Button>
                </div>

                <label className="flex items-center gap-3">
                  <input
                    type="color"
                    value={series.color}
                    onChange={(event) => updateSeriesColor(series.id, event.target.value)}
                    disabled={!editable}
                    className="h-10 w-12 cursor-pointer rounded-md border border-border bg-transparent p-1"
                  />
                  <Input value={series.color} readOnly />
                </label>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/20 px-4 py-5 text-sm text-muted-foreground">
            Load a valid date range to discover the series that can be styled.
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
