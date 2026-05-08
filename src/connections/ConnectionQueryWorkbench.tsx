import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";

import { CalendarDays, CalendarRange, AlertTriangle, Loader2, Play } from "lucide-react";

import { getConnectionTypeById } from "@/app/registry";
import { Button } from "@/components/ui/button";
import { useDashboardWidgetExecution } from "@/dashboards/DashboardWidgetExecution";
import {
  buildDefaultQueryForModel,
  resolveConnectionQueryDraftDefaults,
  resolveConnectionQueryDraftModel,
} from "@/connections/connectionQueryDraftDefaults";
import {
  resolveConnectionAuthoringSummaryComponent,
  resolveConnectionAuthoringQueryModelsForMode,
} from "@/connections/connectionAuthoringContract";
import { resolveConnectionRefSelection } from "@/connections/connectionRefResolution";
import { ConnectionPicker } from "@/connections/components/ConnectionPicker";
import {
  QueryStringListField,
  QueryTextField,
} from "@/connections/components/ConnectionQueryEditorFields";
import { ConnectionQueryResponsePreview } from "@/connections/ConnectionQueryResponsePreview";
import { useConnectionInstances } from "@/connections/hooks";
import type {
  AnyConnectionTypeDefinition,
  ConnectionAuthoringMode,
  ConnectionCapability,
  ConnectionInstance,
  ConnectionRef,
  ConnectionQueryEditorProps,
  ConnectionQueryModel,
} from "@/connections/types";
import {
  formatConnectionQueryModelTransportLabel,
  isConnectionQueryModelStreamable,
  resolveConnectionQueryModelDescription,
} from "@/connections/types";
import {
  buildConnectionQueryRequest,
  buildConnectionQueryErrorFrame,
  executeConnectionQueryWidgetRequest,
  normalizeConnectionQueryProps,
  normalizeConnectionQueryRuntimeState,
  resolveConnectionQueryIncrementalSettings,
  type ConnectionQueryRuntimeState,
  type ConnectionQueryTimeRangeMode,
  type ConnectionQueryWidgetProps,
} from "@/widgets/core/connection-query/connectionQueryModel";
import type { ConnectionQueryIncrementalDedupePolicy } from "@/widgets/core/connection-query/incrementalConnectionRefresh";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";
import { LEGACY_TIME_SERIES_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";
import { WidgetSettingFieldLabel } from "@/widgets/shared/widget-setting-help";
import type { WidgetExecutionDashboardState } from "@/widgets/types";

type QueryPreviewState =
  | { status: "idle" }
  | { status: "loading"; request: ReturnType<typeof buildConnectionQueryRequest> }
  | {
      status: "success";
      request: ReturnType<typeof buildConnectionQueryRequest>;
      frame: ConnectionQueryRuntimeState;
    }
  | { status: "error"; request: ReturnType<typeof buildConnectionQueryRequest>; error: string };

export interface ConnectionQueryWorkbenchProps {
  value: ConnectionQueryWidgetProps;
  onChange: (value: ConnectionQueryWidgetProps) => void;
  onTransportVariantChange?: (
    value: ConnectionQueryWidgetProps,
    nextMode: ConnectionAuthoringMode,
  ) => void;
  editable?: boolean;
  connectionInstance?: ConnectionInstance;
  connectionType?: AnyConnectionTypeDefinition;
  dashboardState?: WidgetExecutionDashboardState;
  dashboardTimeRangeLabel?: string;
  fixedRangeFallback?: { rangeStartMs: number; rangeEndMs: number };
  showConnectionPicker?: boolean;
  showQueryEditor?: boolean;
  showIncrementalRefreshControls?: boolean;
  showTestAction?: boolean;
  connectionPathSettings?: ReactNode;
  queryModelFilter?: (model: ConnectionQueryModel) => boolean;
  authoringMode?: ConnectionAuthoringMode;
  allowTransportVariantSelection?: boolean;
  autoSelectFirstQueryModel?: boolean;
  titlePrefix?: string;
  runButtonLabel?: string;
  resultDescription?: string;
  resultTitle?: string;
  publishPreviewRuntimeStateToInstanceId?: string;
  onPreviewRuntimeStateChange?: (runtimeState: Record<string, unknown> | undefined) => void;
}

interface ConnectionPathOption {
  key: string;
  queryModel: ConnectionQueryModel;
  mode: ConnectionAuthoringMode;
  transportLabel: "HTTP" | "WS";
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function parseJsonObject(value: string) {
  const parsed = value.trim() ? JSON.parse(value) : {};

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON value must be an object.");
  }

  return parsed as Record<string, unknown>;
}

function JsonObjectEditor({
  disabled,
  label,
  help,
  value,
  onChange,
}: {
  disabled: boolean;
  label: string;
  help?: ReactNode;
  value: Record<string, unknown> | undefined;
  onChange: (value: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState(formatJson(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(formatJson(value));
    setError(null);
  }, [value]);

  function commit(nextDraft = draft) {
    try {
      const parsed = parseJsonObject(nextDraft);
      setError(null);
      onChange(parsed);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Invalid JSON object.");
    }
  }

  return (
    <label className="block space-y-2">
      <WidgetSettingFieldLabel help={help} textClassName="text-xs font-medium text-muted-foreground">
        {label}
      </WidgetSettingFieldLabel>
      <textarea
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={() => {
          commit();
        }}
        disabled={disabled}
        spellCheck={false}
        className="min-h-[160px] w-full resize-y rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 py-2 font-mono text-xs text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
      />
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </label>
  );
}

function NumberInput({
  disabled,
  help,
  label,
  value,
  onChange,
  min,
}: {
  disabled: boolean;
  help?: ReactNode;
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
}) {
  return (
    <label className="block space-y-2">
      <WidgetSettingFieldLabel help={help} textClassName="text-xs font-medium text-muted-foreground">
        {label}
      </WidgetSettingFieldLabel>
      <input
        type="number"
        min={min}
        value={value ?? ""}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          onChange(Number.isFinite(nextValue) ? nextValue : undefined);
        }}
        disabled={disabled}
        className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

function normalizeSuggestionValues(values: Array<string | undefined>) {
  return Array.from(new Set(values.flatMap((value) => {
    const normalized = typeof value === "string" ? value.trim() : "";
    return normalized ? [normalized] : [];
  })));
}

function IncrementalRefreshModeControl({
  disabled,
  value,
  onChange,
}: {
  disabled: boolean;
  value: "full" | "incremental";
  onChange: (value: "full" | "incremental") => void;
}) {
  return (
    <div className="space-y-2 md:col-span-2">
      <WidgetSettingFieldLabel
        help="Full refresh replaces the published table on every workspace refresh. Incremental refresh keeps a retained table in memory and merges only the newest tail rows into it."
        textClassName="text-xs font-medium text-muted-foreground"
      >
        Refresh mode
      </WidgetSettingFieldLabel>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Refresh mode">
        {[
          { value: "full", label: "Full", description: "Replace the dataset on each refresh." },
          { value: "incremental", label: "Incremental", description: "Merge the new tail into memory." },
        ].map((option) => {
          const active = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => {
                onChange(option.value as "full" | "incremental");
              }}
              className={[
                "min-h-[64px] rounded-[calc(var(--radius)-5px)] border px-3 py-2.5 text-left outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-55",
                active
                  ? "border-primary/65 bg-primary/12 text-foreground shadow-sm"
                  : "border-border/70 bg-background/35 text-muted-foreground hover:border-primary/35 hover:bg-muted/25",
              ].join(" ")}
            >
              <span className="block text-sm font-medium text-foreground">{option.label}</span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DedupePolicySelect({
  disabled,
  value,
  onChange,
}: {
  disabled: boolean;
  value: ConnectionQueryIncrementalDedupePolicy;
  onChange: (value: ConnectionQueryIncrementalDedupePolicy) => void;
}) {
  return (
    <label className="block space-y-2">
      <WidgetSettingFieldLabel
        help="Controls what happens when a returned row has the same merge-key column values as a retained row."
        textClassName="text-xs font-medium text-muted-foreground"
      >
        Dedupe policy
      </WidgetSettingFieldLabel>
      <select
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;
          onChange(
            nextValue === "first" || nextValue === "error" ? nextValue : "latest",
          );
        }}
        disabled={disabled}
        className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="latest">Latest replaces retained row</option>
        <option value="first">First retained row wins</option>
        <option value="error">Error on duplicate key</option>
      </select>
    </label>
  );
}

function isValidTimestampMs(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatDateTimeInputValue(valueMs: number | undefined) {
  if (!isValidTimestampMs(valueMs)) {
    return "";
  }

  const date = new Date(valueMs);
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseDateTimeInputValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return undefined;
  }

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue] = match;
  const parsed = new Date(
    Number(yearValue),
    Number(monthValue) - 1,
    Number(dayValue),
    Number(hourValue),
    Number(minuteValue),
    0,
    0,
  ).getTime();

  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveDefaultFixedRange(input?: { rangeStartMs: number; rangeEndMs: number }) {
  if (
    input &&
    isValidTimestampMs(input.rangeStartMs) &&
    isValidTimestampMs(input.rangeEndMs) &&
    input.rangeStartMs < input.rangeEndMs
  ) {
    return {
      fixedStartMs: input.rangeStartMs,
      fixedEndMs: input.rangeEndMs,
    };
  }

  const endMs = Date.now();
  const startMs = endMs - 365 * 24 * 60 * 60 * 1000;

  return {
    fixedStartMs: startMs,
    fixedEndMs: endMs,
  };
}

function resolveEffectiveFixedRange(
  props: ConnectionQueryWidgetProps,
  fallback?: { rangeStartMs: number; rangeEndMs: number },
) {
  if (
    isValidTimestampMs(props.fixedStartMs) &&
    isValidTimestampMs(props.fixedEndMs) &&
    props.fixedStartMs < props.fixedEndMs
  ) {
    return {
      fixedStartMs: props.fixedStartMs,
      fixedEndMs: props.fixedEndMs,
    };
  }

  return resolveDefaultFixedRange(fallback);
}

function DateTimeInput({
  disabled,
  label,
  valueMs,
  onChange,
}: {
  disabled: boolean;
  label: string;
  valueMs: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const externalValue = formatDateTimeInputValue(valueMs);
  const [draft, setDraft] = useState(externalValue);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(externalValue);
    }
  }, [externalValue, focused]);

  function commit(nextDraft: string) {
    const parsed = parseDateTimeInputValue(nextDraft);

    if (parsed !== undefined) {
      onChange(parsed);
      setDraft(formatDateTimeInputValue(parsed));
      return;
    }

    setDraft(externalValue);
  }

  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="datetime-local"
        value={draft}
        step={60}
        onChange={(event) => {
          const nextDraft = event.target.value;
          const parsed = parseDateTimeInputValue(nextDraft);

          setDraft(nextDraft);

          if (parsed !== undefined) {
            onChange(parsed);
          }
        }}
        onFocus={() => {
          setFocused(true);
        }}
        onBlur={(event) => {
          commit(event.currentTarget.value);
          setFocused(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit(event.currentTarget.value);
            event.currentTarget.blur();
          }
        }}
        disabled={disabled}
        className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

const workspaceRuntimeDateModeOptions = [
  {
    value: "dashboard",
    label: "Workspace",
    description: "Use the active workspace date range.",
    Icon: CalendarDays,
  },
  {
    value: "fixed",
    label: "Custom",
    description: "Store fixed dates on this query.",
    Icon: CalendarRange,
  },
] satisfies Array<{
  value: ConnectionQueryTimeRangeMode;
  label: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
}>;

function RuntimeDateModeControl({
  disabled,
  value,
  onChange,
}: {
  disabled: boolean;
  value: ConnectionQueryTimeRangeMode;
  onChange: (value: ConnectionQueryTimeRangeMode) => void;
}) {
  return (
    <div className="space-y-2 md:col-span-2">
      <WidgetSettingFieldLabel
        help="Controls which date range is sent to time-range-aware connection queries. Workspace follows the active workspace range; Custom stores fixed dates on this query instance."
        textClassName="text-xs font-medium text-muted-foreground"
      >
        Date runtime
      </WidgetSettingFieldLabel>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Date runtime">
        {workspaceRuntimeDateModeOptions.map((option) => {
          const active = option.value === value;
          const Icon = option.Icon;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => {
                onChange(option.value);
              }}
              className={[
                "flex min-h-[72px] items-start gap-2 rounded-[calc(var(--radius)-5px)] border px-3 py-2.5 text-left outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-55",
                active
                  ? "border-primary/65 bg-primary/12 text-foreground shadow-sm"
                  : "border-border/70 bg-background/35 text-muted-foreground hover:border-primary/35 hover:bg-muted/25",
              ].join(" ")}
            >
              <Icon
                className={[
                  "mt-0.5 h-4 w-4 shrink-0",
                  active ? "text-primary" : "text-muted-foreground",
                ].join(" ")}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{option.label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatTimestamp(valueMs: number | undefined) {
  if (typeof valueMs !== "number" || !Number.isFinite(valueMs)) {
    return "Not set";
  }

  return new Date(valueMs).toLocaleString();
}

function buildRuntimeRangeSummary(input: {
  mode: ConnectionQueryTimeRangeMode | undefined;
  dashboardLabel: string;
  dashboardStartMs?: number;
  dashboardEndMs?: number;
  fixedStartMs?: number;
  fixedEndMs?: number;
}) {
  if (input.mode === "none") {
    return "This connection path does not consume a date range.";
  }

  if (input.mode === "fixed") {
    return `${formatTimestamp(input.fixedStartMs)} -> ${formatTimestamp(input.fixedEndMs)}`;
  }

  return `${input.dashboardLabel}: ${formatTimestamp(input.dashboardStartMs)} -> ${formatTimestamp(input.dashboardEndMs)}`;
}

function getConnectionPathLabel(input: {
  typeId?: string;
  id?: ConnectionRef["id"];
  queryModelId?: string;
}) {
  return [input.typeId, input.id, input.queryModelId]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map(String)
    .join(" / ");
}

function sameQueryModelAvailable(
  queryModelId: string | undefined,
  queryModels: ConnectionQueryModel[],
) {
  return Boolean(
    queryModelId &&
      queryModels.some((model) => model.id === queryModelId),
  );
}

function isRuntimeFrameQueryModel(model: { outputContracts?: readonly string[] }) {
  return Boolean(
    model.outputContracts?.some(
      (contract) =>
        contract === CORE_TABULAR_FRAME_SOURCE_CONTRACT ||
        contract === LEGACY_TIME_SERIES_FRAME_SOURCE_CONTRACT,
    ),
  );
}

function sameConnectionId(
  left: ConnectionRef["id"] | undefined,
  right: ConnectionRef["id"] | undefined,
) {
  return left !== undefined && right !== undefined && String(left) === String(right);
}

export function ConnectionQueryWorkbench({
  authoringMode = "query",
  autoSelectFirstQueryModel = false,
  connectionInstance,
  connectionType: providedConnectionType,
  dashboardState,
  dashboardTimeRangeLabel = "Workspace date range",
  editable = true,
  fixedRangeFallback,
  onChange,
  connectionPathSettings,
  resultDescription = "Preview of the normalized widget runtime frame.",
  resultTitle = "Query result",
  runButtonLabel = "Test",
  showConnectionPicker = true,
  showIncrementalRefreshControls = true,
  showQueryEditor = true,
  showTestAction = true,
  titlePrefix = "",
  publishPreviewRuntimeStateToInstanceId,
  onPreviewRuntimeStateChange,
  queryModelFilter,
  value,
}: ConnectionQueryWorkbenchProps) {
  const widgetExecution = useDashboardWidgetExecution();
  const connectionInstancesQuery = useConnectionInstances();
  const [previewState, setPreviewState] = useState<QueryPreviewState>({ status: "idle" });
  const normalizedValueProps = normalizeConnectionQueryProps(value);
  const fallbackConnectionRef = connectionInstance
    ? { id: connectionInstance.id, typeId: connectionInstance.typeId }
    : undefined;
  const requestedConnectionRef =
    !showConnectionPicker && fallbackConnectionRef
      ? fallbackConnectionRef
      : normalizedValueProps.connectionRef ?? fallbackConnectionRef;
  const resolvedConnectionSelection = useMemo(() => {
    return resolveConnectionRefSelection({
      requestedRef: requestedConnectionRef,
      preferredInstance: connectionInstance,
      backendInstances: connectionInstancesQuery.data ?? [],
    });
  }, [
    connectionInstance,
    connectionInstancesQuery.data,
    requestedConnectionRef,
  ]);
  const normalizedProps: ConnectionQueryWidgetProps = {
    ...normalizedValueProps,
    connectionRef: resolvedConnectionSelection.connectionRef,
  };
  const connectionType = providedConnectionType ??
    (normalizedProps.connectionRef?.typeId
      ? getConnectionTypeById(normalizedProps.connectionRef.typeId)
      : undefined);
  const selectedConnectionInstance = resolvedConnectionSelection.connectionInstance;
  const isStreamAuthoring = authoringMode === "stream";
  const queryModels = useMemo(
    () =>
      resolveConnectionAuthoringQueryModelsForMode({
        authoringMode,
        connectionInstance: selectedConnectionInstance,
        connectionType,
      })
        .filter(isRuntimeFrameQueryModel)
        .filter((model) => queryModelFilter?.(model) ?? true),
    [authoringMode, connectionType, queryModelFilter, selectedConnectionInstance],
  );
  const autoSelectQueryModel = autoSelectFirstQueryModel || queryModels.length === 1;
  const selectedQueryModel = normalizedProps.queryModelId
    ? queryModels.find((model) => model.id === normalizedProps.queryModelId)
    : undefined;
  const resolvedQueryModel =
    selectedQueryModel ??
    (autoSelectQueryModel
      ? resolveConnectionQueryDraftModel({
          connectionInstance: selectedConnectionInstance,
          connectionType,
          queryModels,
          fallbackQueryModel: queryModels[0],
        })
      : undefined);
  const queryPathUsesTimeRange = Boolean(resolvedQueryModel?.timeRangeAware);
  const queryPathSupportsVariables = Boolean(resolvedQueryModel?.supportsVariables);
  const queryPathSupportsMaxRows = resolvedQueryModel?.supportsMaxRows !== false;
  const showRuntimeSection =
    queryPathUsesTimeRange || queryPathSupportsVariables || queryPathSupportsMaxRows;
  const workspaceDateRuntimeAvailable = Boolean(dashboardState);
  const effectiveTimeRangeMode =
    queryPathUsesTimeRange
      ? workspaceDateRuntimeAvailable
        ? normalizedProps.timeRangeMode === "fixed"
          ? "fixed"
          : "dashboard"
        : "fixed"
      : "none";
  const effectiveFixedRange = useMemo(
    () => resolveEffectiveFixedRange(normalizedProps, fixedRangeFallback ?? dashboardState),
    [
      dashboardState,
      fixedRangeFallback,
      normalizedProps.fixedEndMs,
      normalizedProps.fixedStartMs,
    ],
  );
  const effectiveProps: ConnectionQueryWidgetProps = {
    ...normalizedProps,
    timeRangeMode: effectiveTimeRangeMode,
    ...(effectiveTimeRangeMode === "fixed" ? effectiveFixedRange : {}),
  };
  const effectiveDashboardState = useMemo<WidgetExecutionDashboardState>(
    () =>
      dashboardState ?? {
        timeRangeKey: "connection-explore-fixed",
        rangeStartMs: effectiveFixedRange.fixedStartMs,
        rangeEndMs: effectiveFixedRange.fixedEndMs,
        refreshIntervalMs: null,
      },
    [dashboardState, effectiveFixedRange.fixedEndMs, effectiveFixedRange.fixedStartMs],
  );
  const QueryEditor = connectionType?.queryEditor as
    | ComponentType<ConnectionQueryEditorProps<Record<string, unknown>>>
    | undefined;
  const SummaryComponent = resolveConnectionAuthoringSummaryComponent(connectionType);
  const previewRequest = useMemo(
    () => buildConnectionQueryRequest(effectiveProps, effectiveDashboardState, resolvedQueryModel),
    [effectiveDashboardState, effectiveProps, resolvedQueryModel],
  );
  const runtimeRangeSummary = buildRuntimeRangeSummary({
    mode: effectiveProps.timeRangeMode,
    dashboardLabel: dashboardTimeRangeLabel,
    dashboardStartMs: dashboardState?.rangeStartMs,
    dashboardEndMs: dashboardState?.rangeEndMs,
    fixedStartMs: effectiveProps.fixedStartMs,
    fixedEndMs: effectiveProps.fixedEndMs,
  });
  const connectionPath = getConnectionPathLabel({
    typeId: normalizedProps.connectionRef?.typeId,
    id: normalizedProps.connectionRef?.id,
    queryModelId: resolvedQueryModel?.id,
  });
  const resolvedQueryTransportLabel =
    resolvedQueryModel
      ? (isStreamAuthoring ? "WS" : "HTTP")
      : formatConnectionQueryModelTransportLabel(resolvedQueryModel);
  const resolvedQueryDescription = resolveConnectionQueryModelDescription(
    resolvedQueryModel,
    authoringMode,
  );
  const canRunPreview = Boolean(previewRequest && previewState.status !== "loading");
  const publishedPreviewInstanceId =
    typeof publishPreviewRuntimeStateToInstanceId === "string" &&
    publishPreviewRuntimeStateToInstanceId.trim()
      ? publishPreviewRuntimeStateToInstanceId.trim()
      : undefined;
  const incrementalSettings = resolveConnectionQueryIncrementalSettings(normalizedProps);
  const transportCapabilityFilter: ConnectionCapability[] = isStreamAuthoring
    ? ["stream"]
    : ["query"];
  const incrementalControlsAvailable =
    showIncrementalRefreshControls && queryPathUsesTimeRange && workspaceDateRuntimeAvailable;
  const incrementalControlsEnabled =
    incrementalControlsAvailable && effectiveProps.timeRangeMode === "dashboard";
  const fieldSuggestions = useMemo(() => {
    const frame =
      previewState.status === "success"
        ? normalizeConnectionQueryRuntimeState(previewState.frame)
        : undefined;
    const tabularFrame =
      frame && "columns" in frame && Array.isArray(frame.columns) ? frame : undefined;
    const fieldNames = normalizeSuggestionValues([
      ...(tabularFrame?.fields?.flatMap((field) => ("key" in field ? [field.key] : [])) ?? []),
      ...(tabularFrame?.columns ?? []),
    ]);

    return fieldNames.map((fieldName) => ({
      value: fieldName,
      label: fieldName,
      description: "Returned by the latest test query.",
    }));
  }, [previewState]);

  useEffect(() => {
    if (!resolvedConnectionSelection.repaired) {
      return;
    }

    const nextConnectionRef = resolvedConnectionSelection.connectionRef;

    if (
      (!normalizedValueProps.connectionRef && !nextConnectionRef) ||
      (
        nextConnectionRef &&
        sameConnectionId(
          normalizedValueProps.connectionRef?.id,
          nextConnectionRef.id,
        ) &&
        normalizedValueProps.connectionRef?.typeId === nextConnectionRef.typeId
      )
    ) {
      return;
    }

    onChange({
      ...value,
      connectionRef: nextConnectionRef,
    });
  }, [
    normalizedValueProps.connectionRef?.id,
    normalizedValueProps.connectionRef?.typeId,
    onChange,
    resolvedConnectionSelection.connectionRef,
    resolvedConnectionSelection.repaired,
    value,
  ]);

  useEffect(() => {
    if (!autoSelectQueryModel || selectedQueryModel || !queryModels[0]) {
      return;
    }

    const nextQueryModel = resolveConnectionQueryDraftModel({
      connectionInstance: selectedConnectionInstance,
      connectionType,
      queryModels,
      fallbackQueryModel: queryModels[0],
    });

    if (!nextQueryModel) {
      return;
    }
    const nextDefaults = resolveConnectionQueryDraftDefaults({
      authoringMode,
      connectionInstance: selectedConnectionInstance,
      connectionType,
      queryModels,
      selectedQueryModel: nextQueryModel,
    });

    onChange({
      ...value,
      queryModelId: nextQueryModel.id,
      query: nextDefaults.query ?? buildDefaultQueryForModel(nextQueryModel),
      timeRangeMode: nextQueryModel.timeRangeAware
        ? workspaceDateRuntimeAvailable
          ? "dashboard"
          : "fixed"
        : "none",
      fixedStartMs: nextDefaults.fixedStartMs ?? effectiveFixedRange.fixedStartMs,
      fixedEndMs: nextDefaults.fixedEndMs ?? effectiveFixedRange.fixedEndMs,
      maxRows: nextDefaults.maxRows ?? value.maxRows,
      ...(nextQueryModel.timeRangeAware && !workspaceDateRuntimeAvailable
        ? {
            fixedStartMs: nextDefaults.fixedStartMs ?? effectiveFixedRange.fixedStartMs,
            fixedEndMs: nextDefaults.fixedEndMs ?? effectiveFixedRange.fixedEndMs,
          }
        : {}),
    });
  }, [
    authoringMode,
    connectionType,
    autoSelectQueryModel,
    effectiveFixedRange,
    onChange,
    queryModels,
    selectedConnectionInstance,
    selectedQueryModel,
    value,
    workspaceDateRuntimeAvailable,
  ]);

  function updateValue(nextValue: ConnectionQueryWidgetProps) {
    setPreviewState({ status: "idle" });
    onPreviewRuntimeStateChange?.(undefined);
    onChange(nextValue);
  }

  async function runPreview() {
    const request = buildConnectionQueryRequest(
      effectiveProps,
      effectiveDashboardState,
      resolvedQueryModel,
    );

    if (!request) {
      setPreviewState({
        status: "error",
        request,
        error: "Select a connection and query before testing.",
      });
      onPreviewRuntimeStateChange?.(undefined);
      return;
    }

    setPreviewState({ status: "loading", request });

    try {
      const frame = await executeConnectionQueryWidgetRequest(
        effectiveProps,
        effectiveDashboardState,
        resolvedQueryModel,
        {
          scopeId: publishedPreviewInstanceId ?? "connection-query-workbench-preview",
          forceFullRefresh: true,
        },
      );
      setPreviewState({ status: "success", request, frame });
      onPreviewRuntimeStateChange?.(frame as unknown as Record<string, unknown>);
      if (publishedPreviewInstanceId) {
        widgetExecution?.publishRuntimeState(
          publishedPreviewInstanceId,
          frame as unknown as Record<string, unknown>,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Connection query failed.";
      const errorFrame = buildConnectionQueryErrorFrame(
        errorMessage,
        effectiveProps,
      ) as unknown as Record<string, unknown>;
      setPreviewState({
        status: "error",
        request,
        error: errorMessage,
      });
      onPreviewRuntimeStateChange?.(errorFrame);
      if (publishedPreviewInstanceId) {
        widgetExecution?.publishRuntimeState(
          publishedPreviewInstanceId,
          errorFrame,
        );
      }
    }
  }

  return (
    <div className="space-y-6">
      {showConnectionPicker ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {titlePrefix}Connection
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {isStreamAuthoring
                ? "Select the backend-owned connection instance that will own this WebSocket subscription."
                : "Select the backend-owned data source that will execute this query."}
            </p>
          </div>
          <ConnectionPicker
            value={resolvedConnectionSelection.connectionRef}
            onChange={(nextRef) => {
              const nextType = nextRef?.typeId ? getConnectionTypeById(nextRef.typeId) : undefined;
              const nextConnectionInstance = nextRef
                ? (connectionInstancesQuery.data ?? []).find((instance) =>
                    sameConnectionId(instance.id, nextRef.id),
                  ) ??
                  connectionInstance
                : undefined;
              const resolvedNextConnectionInstance =
                nextConnectionInstance && nextConnectionInstance.typeId === nextRef?.typeId
                  ? nextConnectionInstance
                  : undefined;
              const nextRuntimeQueryModels = resolveConnectionAuthoringQueryModelsForMode({
                authoringMode,
                connectionInstance: resolvedNextConnectionInstance,
                connectionType: nextType,
              }).filter(isRuntimeFrameQueryModel);
              const filteredNextRuntimeQueryModels = nextRuntimeQueryModels.filter(
                (model) => queryModelFilter?.(model) ?? true,
              );
              const selectedModelStillValid = sameQueryModelAvailable(
                normalizedProps.queryModelId,
                filteredNextRuntimeQueryModels,
              );
              const fallbackQueryModel = selectedModelStillValid
                ? filteredNextRuntimeQueryModels.find(
                    (model) => model.id === normalizedProps.queryModelId,
                  )
                : filteredNextRuntimeQueryModels.length === 1 || autoSelectFirstQueryModel
                  ? filteredNextRuntimeQueryModels[0]
                  : undefined;
              const nextQueryModel = resolveConnectionQueryDraftModel({
                connectionInstance: resolvedNextConnectionInstance,
                connectionType: nextType,
                queryModels: filteredNextRuntimeQueryModels,
                fallbackQueryModel,
              });
              const nextDefaults = resolveConnectionQueryDraftDefaults({
                authoringMode,
                connectionInstance: resolvedNextConnectionInstance,
                connectionType: nextType,
                queryModels: filteredNextRuntimeQueryModels,
                selectedQueryModel: nextQueryModel,
              });
              const connectionChanged = !sameConnectionId(
                normalizedProps.connectionRef?.id,
                nextRef?.id,
              );

              updateValue({
                ...value,
                connectionRef: nextRef,
                queryModelId: nextQueryModel?.id,
                query: nextQueryModel
                  ? selectedModelStillValid && !connectionChanged
                    ? normalizedProps.query
                    : nextDefaults.query ?? buildDefaultQueryForModel(nextQueryModel)
                  : {},
                timeRangeMode: nextQueryModel?.timeRangeAware
                  ? workspaceDateRuntimeAvailable
                    ? "dashboard"
                    : "fixed"
                  : "none",
                fixedStartMs: nextDefaults.fixedStartMs ?? effectiveFixedRange.fixedStartMs,
                fixedEndMs: nextDefaults.fixedEndMs ?? effectiveFixedRange.fixedEndMs,
                maxRows: nextDefaults.maxRows ?? value.maxRows,
                ...(nextQueryModel?.timeRangeAware && !workspaceDateRuntimeAvailable
                  ? {
                      fixedStartMs:
                        nextDefaults.fixedStartMs ?? effectiveFixedRange.fixedStartMs,
                      fixedEndMs: nextDefaults.fixedEndMs ?? effectiveFixedRange.fixedEndMs,
                    }
                  : {}),
              });
            }}
            accepts={{ capabilities: transportCapabilityFilter }}
            disabled={!editable}
            placeholder={isStreamAuthoring ? "Select a stream-capable connection" : "Select a connection"}
          />
        </section>
      ) : null}

      {queryModels.length > 1 ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {titlePrefix}{isStreamAuthoring ? "Subscription path" : "Connection path"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {isStreamAuthoring ? (
                <>
                  Choose the exact WebSocket subscription sent as <code>query.kind</code> for this
                  connection.
                </>
              ) : (
                <>
                  Choose the exact operation sent as <code>query.kind</code> for this connection.
                </>
              )}
            </p>
            {isStreamAuthoring ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Only paths that advertise <code>stream.transport = websocket</code> appear here.
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                All paths in this surface execute over <code>HTTP</code>. Stream-capable paths stay
                available separately through the WebSocket stream source.
              </p>
            )}
          </div>
          <select
            value={selectedQueryModel?.id ?? ""}
            onChange={(event) => {
              const nextQueryModelId = event.target.value || undefined;
              const nextQueryModel = nextQueryModelId
                ? queryModels.find((model) => model.id === nextQueryModelId)
                : undefined;
              const nextDefaults = resolveConnectionQueryDraftDefaults({
                authoringMode,
                connectionInstance: selectedConnectionInstance,
                connectionType,
                queryModels,
                selectedQueryModel: nextQueryModel,
              });
              const nextQuery =
                nextQueryModelId && nextQueryModelId === normalizedProps.queryModelId
                  ? { ...(normalizedProps.query ?? {}), kind: nextQueryModelId }
                  : nextQueryModel
                    ? nextDefaults.query ?? buildDefaultQueryForModel(nextQueryModel)
                    : {};

              updateValue({
                ...value,
                queryModelId: nextQueryModelId,
                query: nextQuery,
                timeRangeMode: nextQueryModel?.timeRangeAware
                  ? workspaceDateRuntimeAvailable
                    ? "dashboard"
                    : "fixed"
                  : "none",
                fixedStartMs: nextDefaults.fixedStartMs ?? value.fixedStartMs,
                fixedEndMs: nextDefaults.fixedEndMs ?? value.fixedEndMs,
                maxRows: nextDefaults.maxRows ?? value.maxRows,
                ...(nextQueryModel?.timeRangeAware && !workspaceDateRuntimeAvailable
                  ? {
                      fixedStartMs:
                        nextDefaults.fixedStartMs ?? effectiveFixedRange.fixedStartMs,
                      fixedEndMs: nextDefaults.fixedEndMs ?? effectiveFixedRange.fixedEndMs,
                    }
                  : {}),
              });
            }}
            disabled={!editable || queryModels.length === 0}
            className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {queryModels.length > 0 ? (
              <>
                <option value="">
                  {isStreamAuthoring ? "Select a stream subscription path" : "Select a connection path"}
                </option>
                {queryModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label} ({model.id}) [{isStreamAuthoring ? "WS" : "HTTP"}]
                  </option>
                ))}
              </>
            ) : (
              <option value="">
                {isStreamAuthoring ? "No streamable frame query models" : "No frame query models"}
              </option>
            )}
          </select>
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">Resolved path</div>
            <code className="mt-1 block break-all text-[11px] text-muted-foreground">
              {connectionPath || "Select a connection and path"}
            </code>
            <div className="mt-2">
              <span className="font-medium text-foreground">Transport</span>:{" "}
              {resolvedQueryModel ? resolvedQueryTransportLabel : "Select a path"}
            </div>
            {resolvedQueryDescription ? (
              <div className="mt-2 leading-relaxed">
                <span className="font-medium text-foreground">
                  {isStreamAuthoring ? "Subscription behavior" : "Behavior"}
                </span>
                : {resolvedQueryDescription}
              </div>
            ) : null}
            {isStreamAuthoring && isConnectionQueryModelStreamable(resolvedQueryModel) ? (
              <div className="mt-2 leading-relaxed">
                <span className="font-medium text-foreground">Delivery</span>:{" "}
                {resolvedQueryModel.stream.modes.join(" + ")}
                {resolvedQueryModel.stream.heartbeatMs
                  ? `, heartbeat ${resolvedQueryModel.stream.heartbeatMs} ms`
                  : ""}
                {resolvedQueryModel.stream.supportsResume ? ", resumable" : ""}
              </div>
            ) : null}
            {!isStreamAuthoring && isConnectionQueryModelStreamable(resolvedQueryModel) ? (
              <div className="mt-2 leading-relaxed">
                <span className="font-medium text-foreground">Also available</span>: WS stream path
                on the Connection Stream Query surface
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {connectionPathSettings}

      {SummaryComponent && selectedConnectionInstance && connectionType ? (
        <SummaryComponent
          connectionInstance={selectedConnectionInstance}
          connectionType={connectionType}
        />
      ) : null}

      {showQueryEditor ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {titlePrefix}{isStreamAuthoring ? "Subscription payload" : "Query"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {isStreamAuthoring
                ? "Configure the payload passed to the selected WebSocket subscription model."
                : "Configure the payload passed to the selected connection query model."}
            </p>
          </div>
          {QueryEditor && resolvedQueryModel ? (
            <QueryEditor
              value={normalizedProps.query ?? {}}
              onChange={(nextQuery) => {
                updateValue({
                  ...value,
                  query: {
                    ...nextQuery,
                    kind: resolvedQueryModel.id,
                  },
                });
              }}
              editorState={normalizedProps.queryEditorState}
              onEditorStateChange={(nextEditorState) => {
                updateValue({
                  ...value,
                  queryEditorState: nextEditorState,
                });
              }}
              disabled={!editable}
              connectionInstance={selectedConnectionInstance}
              connectionType={connectionType}
              queryModel={resolvedQueryModel}
              authoringMode={authoringMode}
            />
          ) : resolvedQueryModel ? (
            <JsonObjectEditor
              label="Query JSON"
              value={normalizedProps.query}
              onChange={(nextQuery) => {
                updateValue({
                  ...value,
                  query: {
                    ...nextQuery,
                    kind: resolvedQueryModel.id,
                  },
                });
              }}
              disabled={!editable}
            />
          ) : (
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-4 text-sm text-muted-foreground">
              {isStreamAuthoring ? (
                <>
                  Select a subscription path before editing its payload. The workbench stores the
                  selected path in <code>query.kind</code>.
                </>
              ) : (
                <>
                  Select a query before editing its payload. The workbench stores the selected
                  query in <code>query.kind</code>.
                </>
              )}
            </div>
          )}
        </section>
      ) : null}

      {showRuntimeSection ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {titlePrefix}{isStreamAuthoring ? "Subscription runtime" : "Runtime"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {isStreamAuthoring
                ? "Configure opening-snapshot row limits, optional variables, and snapshot date runtime when the selected subscription supports them."
                : "Configure row limits, optional variables, and date runtime when the selected query supports it."}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {queryPathUsesTimeRange && workspaceDateRuntimeAvailable ? (
              <RuntimeDateModeControl
                value={effectiveProps.timeRangeMode ?? "dashboard"}
                disabled={!editable}
                onChange={(timeRangeMode) => {
                  updateValue({
                    ...value,
                    timeRangeMode,
                    ...(timeRangeMode === "fixed" ? effectiveFixedRange : {}),
                  });
                }}
              />
            ) : queryPathUsesTimeRange ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-sm text-muted-foreground md:col-span-2">
                {isStreamAuthoring
                  ? "This subscription runs outside a workspace, so it uses custom fixed dates for the opening snapshot."
                  : "This query runs outside a workspace, so it uses custom fixed dates."}
              </div>
            ) : null}
            {queryPathSupportsMaxRows ? (
              <NumberInput
                label={isStreamAuthoring ? "Initial snapshot rows" : "Max rows"}
                help={
                  isStreamAuthoring
                    ? "Maximum rows requested for the opening snapshot before live updates continue. Leave blank when the connection default should apply."
                    : "Maximum rows requested from the connection for each run. Leave blank when the connection default should apply."
                }
                value={normalizedProps.maxRows}
                min={1}
                disabled={!editable}
                onChange={(maxRows) => {
                  updateValue({ ...value, maxRows });
                }}
              />
            ) : null}
            {queryPathUsesTimeRange && effectiveProps.timeRangeMode === "fixed" ? (
              <>
                <DateTimeInput
                  label="From"
                  valueMs={effectiveProps.fixedStartMs}
                  disabled={!editable}
                  onChange={(fixedStartMs) => {
                    updateValue({ ...value, fixedStartMs });
                  }}
                />
                <DateTimeInput
                  label="To"
                  valueMs={effectiveProps.fixedEndMs}
                  disabled={!editable}
                  onChange={(fixedEndMs) => {
                    updateValue({ ...value, fixedEndMs });
                  }}
                />
              </>
            ) : null}
            {incrementalControlsAvailable ? (
              <>
                <IncrementalRefreshModeControl
                  value={incrementalSettings.mode}
                  disabled={!editable}
                  onChange={(incrementalRefreshMode) => {
                    updateValue({
                      ...value,
                      incrementalRefreshMode,
                    });
                  }}
                />
                {incrementalSettings.mode === "incremental" ? (
                  <>
                    {!incrementalControlsEnabled ? (
                      <div className="rounded-[calc(var(--radius)-6px)] border border-warning/35 bg-warning/8 px-3 py-2 text-xs text-warning md:col-span-2">
                        Incremental refresh only runs with the workspace date range.
                      </div>
                    ) : null}
                    <QueryTextField
                      label="Time field"
                      value={incrementalSettings.timeField}
                      onChange={(incrementalTimeField) => {
                        updateValue({
                          ...value,
                          incrementalTimeField,
                        });
                      }}
                      disabled={!editable}
                      placeholder="timestamp"
                      help="Column used to compute the next tail request and prune retained rows."
                    />
                    <QueryStringListField
                      label="Merge key columns"
                      value={incrementalSettings.mergeKeyFields}
                      onChange={(incrementalMergeKeyFields) => {
                        updateValue({
                          ...value,
                          incrementalMergeKeyFields,
                        });
                      }}
                      disabled={!editable}
                      placeholder="timestamp, symbol"
                      suggestions={fieldSuggestions}
                      help="User-selected column combination used to dedupe and replace retained rows."
                    />
                    <NumberInput
                      label="Overlap ms"
                      help="How far before the last retained timestamp the next incremental request should start. A value like 60000 re-requests the previous minute so late-arriving or corrected rows can replace retained rows through the merge key."
                      value={incrementalSettings.overlapMs}
                      min={0}
                      disabled={!editable}
                      onChange={(incrementalOverlapMs) => {
                        updateValue({
                          ...value,
                          incrementalOverlapMs,
                        });
                      }}
                    />
                    <NumberInput
                      label="Retention ms"
                      help="How much recent history to keep in the retained in-memory table. Leave blank to keep the whole active runtime range; set a value like 900000 to keep only the last 15 minutes."
                      value={incrementalSettings.retentionMs}
                      min={1}
                      disabled={!editable}
                      onChange={(incrementalRetentionMs) => {
                        updateValue({
                          ...value,
                          incrementalRetentionMs,
                        });
                      }}
                    />
                    <DedupePolicySelect
                      value={incrementalSettings.dedupePolicy}
                      disabled={!editable}
                      onChange={(incrementalDedupePolicy) => {
                        updateValue({
                          ...value,
                          incrementalDedupePolicy,
                        });
                      }}
                    />
                  </>
                ) : null}
              </>
            ) : null}
          </div>
          {queryPathUsesTimeRange ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
              <WidgetSettingFieldLabel
                help="The effective date range that will be sent to this query at runtime. In incremental mode this is the retained range; follow-up requests may ask only for the tail range based on overlap and watermark."
                textClassName="font-medium text-foreground"
              >
                {isStreamAuthoring ? "Snapshot range:" : "Runtime range:"}
              </WidgetSettingFieldLabel>{" "}
              {runtimeRangeSummary}
            </div>
          ) : null}
          {queryPathSupportsVariables ? (
            <JsonObjectEditor
              label={isStreamAuthoring ? "Subscription variables JSON" : "Variables JSON"}
              help={
                isStreamAuthoring
                  ? "Optional standard request-envelope variables for backend template expansion on the stream subscription. Use connector-specific fields above for subscription kwargs."
                  : "Optional standard request-envelope variables for backend template expansion. Use connector-specific fields above for query kwargs."
              }
              value={normalizedProps.variables}
              onChange={(variables) => {
                updateValue({
                  ...value,
                  variables: variables as Record<string, string | number | boolean>,
                });
              }}
              disabled={!editable}
            />
          ) : null}
        </section>
      ) : null}

      {showTestAction ? (
      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Test query</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Runs the current draft against the same connection request used by runtime execution.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void runPreview();
            }}
            disabled={!canRunPreview}
          >
            {previewState.status === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {runButtonLabel}
          </Button>
        </div>

        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-3">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-medium text-foreground">Request preview</span>
            <span className="text-muted-foreground">
              {previewRequest ? "Ready" : "Connection and path required"}
            </span>
          </div>
          <pre className="mt-2 max-h-56 overflow-auto rounded-[calc(var(--radius)-8px)] bg-background/70 p-2 text-[11px] leading-relaxed text-muted-foreground">
            {previewRequest
              ? JSON.stringify(previewRequest, null, 2)
              : "Select a connection and query to build the request."}
          </pre>
        </div>

        {previewState.status === "success" ? (
          <ConnectionQueryResponsePreview
            frame={previewState.frame}
            description={resultDescription}
            title={resultTitle}
          />
        ) : null}

        {previewState.status === "error" ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/35 bg-danger/8 p-3 text-sm text-danger">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              Query failed
            </div>
            <div className="mt-2 text-xs">{previewState.error}</div>
          </div>
        ) : null}
      </section>
      ) : null}
    </div>
  );
}
