import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";

import { CalendarDays, CalendarRange, AlertTriangle, Loader2, Play } from "lucide-react";

import { getConnectionTypeById } from "@/app/registry";
import { Button } from "@/components/ui/button";
import { ConnectionPicker } from "@/connections/components/ConnectionPicker";
import {
  QueryStringListField,
  QueryTextField,
} from "@/connections/components/ConnectionQueryEditorFields";
import { ConnectionQueryResponsePreview } from "@/connections/ConnectionQueryResponsePreview";
import { getSystemConnectionInstances } from "@/connections/api";
import { useConnectionInstances } from "@/connections/hooks";
import type {
  AnyConnectionTypeDefinition,
  ConnectionInstance,
  ConnectionQueryEditorProps,
} from "@/connections/types";
import {
  buildConnectionQueryRequest,
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
  editable?: boolean;
  connectionInstance?: ConnectionInstance;
  connectionType?: AnyConnectionTypeDefinition;
  dashboardState?: WidgetExecutionDashboardState;
  dashboardTimeRangeLabel?: string;
  fixedRangeFallback?: { rangeStartMs: number; rangeEndMs: number };
  showConnectionPicker?: boolean;
  showQueryEditor?: boolean;
  connectionPathSettings?: ReactNode;
  autoSelectFirstQueryModel?: boolean;
  titlePrefix?: string;
  runButtonLabel?: string;
  resultDescription?: string;
  resultTitle?: string;
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
  label,
  value,
  onChange,
  min,
}: {
  disabled: boolean;
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
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
      <span className="text-xs font-medium text-muted-foreground">Refresh mode</span>
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
      <span className="text-xs font-medium text-muted-foreground">Date runtime</span>
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
  uid?: string;
  queryModelId?: string;
}) {
  return [input.typeId, input.uid, input.queryModelId].filter(Boolean).join(" / ");
}

function sameQueryModelAvailable(
  queryModelId: string | undefined,
  connectionType: AnyConnectionTypeDefinition | undefined,
) {
  return Boolean(
    queryModelId &&
      connectionType?.queryModels?.some(
        (model) => model.id === queryModelId && isRuntimeFrameQueryModel(model),
      ),
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

function buildDefaultQueryForModel(model: { id: string; defaultQuery?: Record<string, unknown> }) {
  return {
    ...(model.defaultQuery ?? {}),
    kind: model.id,
  };
}

export function ConnectionQueryWorkbench({
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
  showQueryEditor = true,
  titlePrefix = "",
  value,
}: ConnectionQueryWorkbenchProps) {
  const connectionInstancesQuery = useConnectionInstances();
  const [previewState, setPreviewState] = useState<QueryPreviewState>({ status: "idle" });
  const normalizedProps = normalizeConnectionQueryProps(value);
  const connectionType = providedConnectionType ??
    (normalizedProps.connectionRef?.typeId
      ? getConnectionTypeById(normalizedProps.connectionRef.typeId)
      : undefined);
  const queryModels = useMemo(
    () => (connectionType?.queryModels ?? []).filter(isRuntimeFrameQueryModel),
    [connectionType],
  );
  const autoSelectQueryModel = autoSelectFirstQueryModel || queryModels.length === 1;
  const selectedQueryModel = normalizedProps.queryModelId
    ? queryModels.find((model) => model.id === normalizedProps.queryModelId)
    : undefined;
  const systemConnectionInstances = useMemo(() => getSystemConnectionInstances(), []);
  const selectedConnectionInstance = useMemo(() => {
    const selectedUid = normalizedProps.connectionRef?.uid;

    if (!selectedUid) {
      return connectionInstance;
    }

    return (
      connectionInstance ??
      (connectionInstancesQuery.data ?? []).find((instance) => instance.uid === selectedUid) ??
      systemConnectionInstances.find((instance) => instance.uid === selectedUid)
    );
  }, [
    connectionInstance,
    connectionInstancesQuery.data,
    normalizedProps.connectionRef?.uid,
    systemConnectionInstances,
  ]);
  const queryPathUsesTimeRange = Boolean(selectedQueryModel?.timeRangeAware);
  const queryPathSupportsVariables = Boolean(selectedQueryModel?.supportsVariables);
  const queryPathSupportsMaxRows = selectedQueryModel?.supportsMaxRows !== false;
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
  const previewRequest = useMemo(
    () => buildConnectionQueryRequest(effectiveProps, effectiveDashboardState, selectedQueryModel),
    [effectiveDashboardState, effectiveProps, selectedQueryModel],
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
    uid: normalizedProps.connectionRef?.uid,
    queryModelId: selectedQueryModel?.id,
  });
  const canRunPreview = Boolean(previewRequest && previewState.status !== "loading");
  const incrementalSettings = resolveConnectionQueryIncrementalSettings(normalizedProps);
  const incrementalControlsAvailable =
    queryPathUsesTimeRange && workspaceDateRuntimeAvailable;
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
    if (!autoSelectQueryModel || selectedQueryModel || !queryModels[0]) {
      return;
    }

    const nextQueryModel = queryModels[0];

    onChange({
      ...value,
      queryModelId: nextQueryModel.id,
      query: buildDefaultQueryForModel(nextQueryModel),
      timeRangeMode: nextQueryModel.timeRangeAware
        ? workspaceDateRuntimeAvailable
          ? "dashboard"
          : "fixed"
        : "none",
      ...(nextQueryModel.timeRangeAware && !workspaceDateRuntimeAvailable
        ? effectiveFixedRange
        : {}),
    });
  }, [
    autoSelectQueryModel,
    effectiveFixedRange,
    onChange,
    queryModels,
    selectedQueryModel,
    value,
    workspaceDateRuntimeAvailable,
  ]);

  function updateValue(nextValue: ConnectionQueryWidgetProps) {
    setPreviewState({ status: "idle" });
    onChange(nextValue);
  }

  async function runPreview() {
    const request = buildConnectionQueryRequest(
      effectiveProps,
      effectiveDashboardState,
      selectedQueryModel,
    );

    if (!request) {
      setPreviewState({
        status: "error",
        request,
        error: "Select a connection and query before testing.",
      });
      return;
    }

    setPreviewState({ status: "loading", request });

    try {
      const frame = await executeConnectionQueryWidgetRequest(
        effectiveProps,
        effectiveDashboardState,
        selectedQueryModel,
        {
          scopeId: "connection-query-workbench-preview",
          forceFullRefresh: true,
        },
      );
      setPreviewState({ status: "success", request, frame });
    } catch (error) {
      setPreviewState({
        status: "error",
        request,
        error: error instanceof Error ? error.message : "Connection query failed.",
      });
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
              Select the backend-owned data source that will execute this query.
            </p>
          </div>
          <ConnectionPicker
            value={normalizedProps.connectionRef}
            onChange={(nextRef) => {
              const nextType = nextRef?.typeId ? getConnectionTypeById(nextRef.typeId) : undefined;
              const nextRuntimeQueryModels =
                nextType?.queryModels?.filter(isRuntimeFrameQueryModel) ?? [];
              const selectedModelStillValid = sameQueryModelAvailable(
                normalizedProps.queryModelId,
                nextType,
              );
              const nextQueryModel = selectedModelStillValid
                ? nextType?.queryModels?.find((model) => model.id === normalizedProps.queryModelId)
                : nextRuntimeQueryModels.length === 1 || autoSelectFirstQueryModel
                  ? nextRuntimeQueryModels[0]
                  : undefined;

              updateValue({
                ...value,
                connectionRef: nextRef,
                queryModelId: nextQueryModel?.id,
                query: nextQueryModel
                  ? selectedModelStillValid
                    ? normalizedProps.query
                    : buildDefaultQueryForModel(nextQueryModel)
                  : {},
                timeRangeMode: nextQueryModel?.timeRangeAware
                  ? workspaceDateRuntimeAvailable
                    ? "dashboard"
                    : "fixed"
                  : "none",
                ...(nextQueryModel?.timeRangeAware && !workspaceDateRuntimeAvailable
                  ? effectiveFixedRange
                  : {}),
              });
            }}
            accepts={{ capabilities: ["query"] }}
            disabled={!editable}
            placeholder="Select a connection"
          />
        </section>
      ) : null}

      {queryModels.length > 1 ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {titlePrefix}Connection path
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose the exact operation sent as <code>query.kind</code> for this connection.
            </p>
          </div>
          <select
            value={selectedQueryModel?.id ?? ""}
            onChange={(event) => {
              const nextQueryModelId = event.target.value || undefined;
              const nextQueryModel = nextQueryModelId
                ? queryModels.find((model) => model.id === nextQueryModelId)
                : undefined;
              const nextQuery =
                nextQueryModelId && nextQueryModelId === normalizedProps.queryModelId
                  ? { ...(normalizedProps.query ?? {}), kind: nextQueryModelId }
                  : nextQueryModel
                    ? buildDefaultQueryForModel(nextQueryModel)
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
                ...(nextQueryModel?.timeRangeAware && !workspaceDateRuntimeAvailable
                  ? effectiveFixedRange
                  : {}),
              });
            }}
            disabled={!editable || queryModels.length === 0}
            className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {queryModels.length > 0 ? (
              <>
                <option value="">Select a connection path</option>
                {queryModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label} ({model.id})
                  </option>
                ))}
              </>
            ) : (
              <option value="">No frame query models</option>
            )}
          </select>
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">Resolved path</div>
            <code className="mt-1 block break-all text-[11px] text-muted-foreground">
              {connectionPath || "Select a connection and path"}
            </code>
          </div>
        </section>
      ) : null}

      {connectionPathSettings}

      {showQueryEditor ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{titlePrefix}Query</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Configure the payload passed to the selected connection query model.
            </p>
          </div>
          {QueryEditor && selectedQueryModel ? (
            <QueryEditor
              value={normalizedProps.query ?? {}}
              onChange={(nextQuery) => {
                updateValue({
                  ...value,
                  query: {
                    ...nextQuery,
                    kind: selectedQueryModel.id,
                  },
                });
              }}
              disabled={!editable}
              connectionInstance={selectedConnectionInstance}
              connectionType={connectionType}
              queryModel={selectedQueryModel}
            />
          ) : selectedQueryModel ? (
            <JsonObjectEditor
              label="Query JSON"
              value={normalizedProps.query}
              onChange={(nextQuery) => {
                updateValue({
                  ...value,
                  query: {
                    ...nextQuery,
                    kind: selectedQueryModel.id,
                  },
                });
              }}
              disabled={!editable}
            />
          ) : (
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-4 text-sm text-muted-foreground">
              Select a query before editing its payload. The workbench stores the selected query in{" "}
              <code>query.kind</code>.
            </div>
          )}
        </section>
      ) : null}

      {showRuntimeSection ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{titlePrefix}Runtime</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Configure row limits, optional variables, and date runtime when the selected query
              supports it.
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
                This query runs outside a workspace, so it uses custom fixed dates.
              </div>
            ) : null}
            {queryPathSupportsMaxRows ? (
              <NumberInput
                label="Max rows"
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
              <span className="font-medium text-foreground">Runtime range:</span>{" "}
              {runtimeRangeSummary}
            </div>
          ) : null}
          {queryPathSupportsVariables ? (
            <JsonObjectEditor
              label="Variables JSON"
              help="Optional standard request-envelope variables for backend template expansion. Use connector-specific fields above for query kwargs."
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
    </div>
  );
}
