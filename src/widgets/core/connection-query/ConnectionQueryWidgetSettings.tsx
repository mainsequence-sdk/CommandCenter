import { useEffect, useMemo, useState, type ComponentType } from "react";

import { getConnectionTypeById } from "@/app/registry";
import { ConnectionPicker } from "@/connections/components/ConnectionPicker";
import { getSystemConnectionInstances } from "@/connections/api";
import { useConnectionInstances } from "@/connections/hooks";
import { useDashboardControls } from "@/dashboards/DashboardControls";
import type { ConnectionQueryEditorProps } from "@/connections/types";
import type { WidgetSettingsComponentProps } from "@/widgets/types";
import {
  AlertTriangle,
  Ban,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Loader2,
  Play,
} from "lucide-react";

import {
  buildConnectionQueryRequest,
  executeConnectionQueryWidgetRequest,
  normalizeConnectionQueryProps,
  type ConnectionQueryRuntimeState,
  type ConnectionQueryTimeRangeMode,
  type ConnectionQueryWidgetProps,
} from "./connectionQueryModel";

type Props = WidgetSettingsComponentProps<ConnectionQueryWidgetProps>;

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
  value,
  onChange,
}: {
  disabled: boolean;
  label: string;
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
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
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
  const value =
    typeof valueMs === "number" && Number.isFinite(valueMs)
      ? new Date(valueMs).toISOString().slice(0, 16)
      : "";

  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="datetime-local"
        value={value}
        onChange={(event) => {
          const parsed = Date.parse(event.target.value);
          onChange(Number.isNaN(parsed) ? undefined : parsed);
        }}
        disabled={disabled}
        className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

const runtimeDateModeOptions = [
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
  {
    value: "none",
    label: "No dates",
    description: "Run without a time range.",
    Icon: Ban,
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
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Date runtime">
        {runtimeDateModeOptions.map((option) => {
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

type QueryPreviewState =
  | { status: "idle" }
  | { status: "loading"; request: ReturnType<typeof buildConnectionQueryRequest> }
  | {
      status: "success";
      request: ReturnType<typeof buildConnectionQueryRequest>;
      frame: ConnectionQueryRuntimeState;
    }
  | { status: "error"; request: ReturnType<typeof buildConnectionQueryRequest>; error: string };

function formatTimestamp(valueMs: number | undefined) {
  if (typeof valueMs !== "number" || !Number.isFinite(valueMs)) {
    return "Not set";
  }

  return new Date(valueMs).toLocaleString();
}

function buildRuntimeRangeSummary(input: {
  mode: ConnectionQueryTimeRangeMode | undefined;
  dashboardLabel: string;
  dashboardStartMs: number;
  dashboardEndMs: number;
  fixedStartMs?: number;
  fixedEndMs?: number;
}) {
  if (input.mode === "none") {
    return "No dates will be sent with the query.";
  }

  if (input.mode === "fixed") {
    return `${formatTimestamp(input.fixedStartMs)} -> ${formatTimestamp(input.fixedEndMs)}`;
  }

  return `${input.dashboardLabel}: ${formatTimestamp(input.dashboardStartMs)} -> ${formatTimestamp(input.dashboardEndMs)}`;
}

function getFrameStats(frame: ConnectionQueryRuntimeState) {
  if ("rows" in frame) {
    return {
      itemLabel: "Rows",
      itemCount: frame.rows.length,
      fieldLabel: "Columns",
      fieldCount: frame.columns.length,
      fields: frame.columns,
    };
  }

  return {
    itemLabel: "Points",
    itemCount: Math.max(0, ...frame.fields.map((field) => field.values.length)),
    fieldLabel: "Fields",
    fieldCount: frame.fields.length,
    fields: frame.fields.map((field) => field.name),
  };
}

function getConnectionPathLabel(input: {
  typeId?: string;
  uid?: string;
  queryModelId?: string;
}) {
  return [input.typeId, input.uid, input.queryModelId].filter(Boolean).join(" / ");
}

export function ConnectionQueryWidgetSettings({
  draftProps,
  editable,
  onDraftPropsChange,
}: Props) {
  const dashboardControls = useDashboardControls();
  const connectionInstancesQuery = useConnectionInstances();
  const [previewState, setPreviewState] = useState<QueryPreviewState>({ status: "idle" });
  const normalizedProps = normalizeConnectionQueryProps(draftProps);
  const connectionType = normalizedProps.connectionRef?.typeId
    ? getConnectionTypeById(normalizedProps.connectionRef.typeId)
    : undefined;
  const queryModels = useMemo(() => connectionType?.queryModels ?? [], [connectionType]);
  const selectedQueryModel = normalizedProps.queryModelId
    ? queryModels.find((model) => model.id === normalizedProps.queryModelId)
    : undefined;
  const queryPathUsesTimeRange = Boolean(selectedQueryModel?.timeRangeAware);
  const effectiveProps: ConnectionQueryWidgetProps = {
    ...normalizedProps,
    timeRangeMode: queryPathUsesTimeRange ? normalizedProps.timeRangeMode : "none",
  };
  const QueryEditor = connectionType?.queryEditor as
    | ComponentType<ConnectionQueryEditorProps<Record<string, unknown>>>
    | undefined;
  const systemConnectionInstances = useMemo(() => getSystemConnectionInstances(), []);
  const selectedConnectionInstance = useMemo(() => {
    const selectedUid = normalizedProps.connectionRef?.uid;

    if (!selectedUid) {
      return undefined;
    }

    return (
      (connectionInstancesQuery.data ?? []).find((instance) => instance.uid === selectedUid) ??
      systemConnectionInstances.find((instance) => instance.uid === selectedUid)
    );
  }, [connectionInstancesQuery.data, normalizedProps.connectionRef?.uid, systemConnectionInstances]);
  const dashboardState = useMemo(
    () => ({
      timeRangeKey: dashboardControls.timeRangeKey,
      rangeStartMs: dashboardControls.rangeStartMs,
      rangeEndMs: dashboardControls.rangeEndMs,
      refreshIntervalMs: dashboardControls.refreshIntervalMs,
    }),
    [
      dashboardControls.rangeEndMs,
      dashboardControls.rangeStartMs,
      dashboardControls.refreshIntervalMs,
      dashboardControls.timeRangeKey,
    ],
  );
  const previewRequest = useMemo(
    () => buildConnectionQueryRequest(effectiveProps, dashboardState, selectedQueryModel),
    [dashboardState, effectiveProps, selectedQueryModel],
  );
  const runtimeRangeSummary = buildRuntimeRangeSummary({
    mode: effectiveProps.timeRangeMode,
    dashboardLabel: dashboardControls.timeRangeLabel,
    dashboardStartMs: dashboardControls.rangeStartMs,
    dashboardEndMs: dashboardControls.rangeEndMs,
    fixedStartMs: normalizedProps.fixedStartMs,
    fixedEndMs: normalizedProps.fixedEndMs,
  });
  const connectionPath = getConnectionPathLabel({
    typeId: normalizedProps.connectionRef?.typeId,
    uid: normalizedProps.connectionRef?.uid,
    queryModelId: selectedQueryModel?.id,
  });
  const previewFrameStats = previewState.status === "success" ? getFrameStats(previewState.frame) : null;
  const canRunPreview = Boolean(previewRequest && previewState.status !== "loading");

  async function runPreview() {
    const request = buildConnectionQueryRequest(effectiveProps, dashboardState, selectedQueryModel);

    if (!request) {
      setPreviewState({
        status: "error",
        request,
        error: "Select a connection and connection path before testing the query.",
      });
      return;
    }

    setPreviewState({ status: "loading", request });

    try {
      const frame = await executeConnectionQueryWidgetRequest(
        effectiveProps,
        dashboardState,
        selectedQueryModel,
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
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Connection</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Select the backend-owned data source that will execute this query.
          </p>
        </div>
        <ConnectionPicker
          value={normalizedProps.connectionRef}
          onChange={(nextRef) => {
            const nextType = nextRef?.typeId ? getConnectionTypeById(nextRef.typeId) : undefined;
            const selectedModelStillValid = Boolean(
              normalizedProps.queryModelId &&
                nextType?.queryModels?.some((model) => model.id === normalizedProps.queryModelId),
            );
            const nextQueryModel = selectedModelStillValid
              ? nextType?.queryModels?.find((model) => model.id === normalizedProps.queryModelId)
              : undefined;

            onDraftPropsChange({
              ...draftProps,
              connectionRef: nextRef,
              queryModelId: selectedModelStillValid ? normalizedProps.queryModelId : undefined,
              query: selectedModelStillValid ? normalizedProps.query : {},
              timeRangeMode: nextQueryModel?.timeRangeAware
                ? normalizedProps.timeRangeMode
                : "none",
            });
          }}
          accepts={{ capabilities: ["query"] }}
          disabled={!editable}
          placeholder="Select a connection"
        />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Connection path</h3>
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
                : nextQueryModelId
                  ? { kind: nextQueryModelId }
                  : {};

            onDraftPropsChange({
              ...draftProps,
              queryModelId: nextQueryModelId,
              query: nextQuery,
              timeRangeMode: nextQueryModel?.timeRangeAware
                ? normalizedProps.timeRangeMode === "none"
                  ? "dashboard"
                  : normalizedProps.timeRangeMode
                : "none",
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
            <option value="">No query models</option>
          )}
        </select>
        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">Resolved path</div>
          <code className="mt-1 block break-all text-[11px] text-muted-foreground">
            {connectionPath || "Select a connection and path"}
          </code>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Query</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure the payload passed to the selected connection query model.
          </p>
        </div>
        {QueryEditor && selectedQueryModel ? (
          <QueryEditor
            value={normalizedProps.query ?? {}}
            onChange={(nextQuery) => {
              onDraftPropsChange({
                ...draftProps,
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
              onDraftPropsChange({
                ...draftProps,
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
            Select a connection path before editing query payload. The widget will store that path
            in <code>query.kind</code>.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Runtime</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure row limits, variables, selected response frame, and date runtime when the
            connection path supports it.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {queryPathUsesTimeRange ? (
            <RuntimeDateModeControl
              value={effectiveProps.timeRangeMode ?? "dashboard"}
              disabled={!editable}
              onChange={(timeRangeMode) => {
                onDraftPropsChange({
                  ...draftProps,
                  timeRangeMode,
                });
              }}
            />
          ) : (
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-sm text-muted-foreground md:col-span-2">
              This connection path does not consume workspace or custom dates.
            </div>
          )}
          <NumberInput
            label="Max rows"
            value={normalizedProps.maxRows}
            min={1}
            disabled={!editable}
            onChange={(maxRows) => {
              onDraftPropsChange({ ...draftProps, maxRows });
            }}
          />
          {queryPathUsesTimeRange && effectiveProps.timeRangeMode === "fixed" ? (
            <>
              <DateTimeInput
                label="From"
                valueMs={normalizedProps.fixedStartMs}
                disabled={!editable}
                onChange={(fixedStartMs) => {
                  onDraftPropsChange({ ...draftProps, fixedStartMs });
                }}
              />
              <DateTimeInput
                label="To"
                valueMs={normalizedProps.fixedEndMs}
                disabled={!editable}
                onChange={(fixedEndMs) => {
                  onDraftPropsChange({ ...draftProps, fixedEndMs });
                }}
              />
            </>
          ) : null}
          <NumberInput
            label="Selected frame"
            value={normalizedProps.selectedFrame ?? 0}
            min={0}
            disabled={!editable}
            onChange={(selectedFrame) => {
              onDraftPropsChange({ ...draftProps, selectedFrame });
            }}
          />
        </div>
        {queryPathUsesTimeRange ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Runtime range:</span>{" "}
            {runtimeRangeSummary}
          </div>
        ) : null}
        <JsonObjectEditor
          label="Variables JSON"
          value={normalizedProps.variables}
          onChange={(variables) => {
            onDraftPropsChange({
              ...draftProps,
              variables: variables as Record<string, string | number | boolean>,
            });
          }}
          disabled={!editable}
        />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Test query</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Runs the current draft against the same connection request used by runtime execution.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void runPreview();
            }}
            disabled={!canRunPreview}
            className="inline-flex h-9 items-center gap-2 rounded-[calc(var(--radius)-5px)] border border-border/70 bg-background/55 px-3 text-sm font-medium text-foreground outline-none transition-colors hover:border-primary/45 hover:bg-muted/35 focus:border-primary/70 focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {previewState.status === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Test
          </button>
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
              : "Select a connection and connection path to build the request."}
          </pre>
        </div>

        {previewState.status === "success" && previewFrameStats ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-success/35 bg-success/8 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-success">
              <CheckCircle2 className="h-4 w-4" />
              Query returned a frame
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/35 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {previewFrameStats.itemLabel}
                </div>
                <div className="mt-1 text-lg font-semibold text-foreground">
                  {previewFrameStats.itemCount.toLocaleString()}
                </div>
              </div>
              <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/35 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {previewFrameStats.fieldLabel}
                </div>
                <div className="mt-1 text-lg font-semibold text-foreground">
                  {previewFrameStats.fieldCount.toLocaleString()}
                </div>
              </div>
            </div>
            {previewFrameStats.fields.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {previewFrameStats.fields.slice(0, 12).map((field) => (
                  <span
                    key={field}
                    className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/45 px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    {field}
                  </span>
                ))}
                {previewFrameStats.fields.length > 12 ? (
                  <span className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/45 px-2 py-1 text-[11px] text-muted-foreground">
                    +{(previewFrameStats.fields.length - 12).toLocaleString()} more
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
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
