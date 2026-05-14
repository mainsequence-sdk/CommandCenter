import { useEffect, useMemo, useState } from "react";

import { getConnectionTypeById } from "@/app/registry";
import { Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QueryStringListField } from "@/connections/components/ConnectionQueryEditorFields";
import {
  resolveConnectionStreamAuthoringCopy,
  resolveConnectionStreamAuthoringQueryModels,
} from "@/connections/connectionAuthoringContract";
import {
  useThrottledConnectionRuntimeEntry,
  type ConnectionRuntimeEntrySnapshot,
} from "@/connections/connection-runtime-store";
import { resolveConnectionRefSelection } from "@/connections/connectionRefResolution";
import { ConnectionQuerySettingsSurface } from "@/connections/ConnectionQuerySettingsSurface";
import { ConnectionStreamQueryTestPanel } from "@/connections/ConnectionStreamQueryTestPanel";
import { isConnectionQueryModelStreamable } from "@/connections/types";
import { useConnectionInstances } from "@/connections/hooks";
import { useDashboardControls } from "@/dashboards/DashboardControls";
import { useDashboardWidgetRegistry } from "@/dashboards/DashboardWidgetRegistry";
import { WidgetSettingFieldLabel } from "@/widgets/shared/widget-setting-help";
import { WidgetSchemaForm } from "@/widgets/shared/widget-schema-form";
import type { ConnectionQueryWidgetProps } from "@/widgets/core/connection-query/connectionQueryModel";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import {
  buildConnectionStreamQueryRequest,
  buildConnectionStreamQueryRuntimeKey,
  normalizeConnectionStreamQueryProps,
  normalizeConnectionStreamQueryRuntimeState,
  type ConnectionStreamQueryWidgetProps,
} from "./connectionStreamQueryModel";

type Props = WidgetSettingsComponentProps<ConnectionStreamQueryWidgetProps> & {
  onPreviewRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
  previewRuntimeState?: Record<string, unknown>;
};

function formatStreamStatusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatStreamTimestamp(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value).toLocaleTimeString()
    : "none";
}

function getStreamStatusTone(status: string) {
  if (status === "error") {
    return "border-danger/35 bg-danger/8 text-danger";
  }

  if (status === "live") {
    return "border-emerald-500/30 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "connecting" || status === "reconnecting") {
    return "border-warning/35 bg-warning/10 text-warning";
  }

  return "border-border/70 bg-background/35 text-muted-foreground";
}

function RuntimeSummaryMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/35 px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate text-xs text-foreground">{value}</div>
    </div>
  );
}

function ActiveStreamRuntimeSummary({
  entry,
}: {
  entry: ConnectionRuntimeEntrySnapshot | undefined;
}) {
  if (!entry) {
    return (
      <section className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-4">
        <div className="text-sm font-medium text-topbar-foreground">Workspace stream</div>
        <p className="mt-1 text-sm text-muted-foreground">
          No active workspace stream matches this draft request.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-topbar-foreground">Workspace stream</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Reading the active runtime entry without opening a settings-owned socket.
          </p>
        </div>
        <div className={["rounded-full border px-3 py-1 text-xs font-medium", getStreamStatusTone(entry.status)].join(" ")}>
          {formatStreamStatusLabel(entry.status)}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        <RuntimeSummaryMetric
          label="Owners"
          value={entry.activeOwnerCount.toLocaleString()}
        />
        <RuntimeSummaryMetric
          label="Rows"
          value={(entry.rowCount ?? 0).toLocaleString()}
        />
        <RuntimeSummaryMetric
          label="Columns"
          value={(entry.columnCount ?? 0).toLocaleString()}
        />
        <RuntimeSummaryMetric
          label="Last message"
          value={formatStreamTimestamp(entry.lastMessageAtMs)}
        />
      </div>
      {entry.error ? (
        <div className="flex items-start gap-2 rounded-[calc(var(--radius)-8px)] border border-danger/35 bg-danger/8 px-3 py-2 text-xs text-danger">
          <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{entry.error}</span>
        </div>
      ) : null}
    </section>
  );
}

function RetentionMaxRowsInput({
  disabled,
  value,
  onChange,
}: {
  disabled: boolean;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <label className="block space-y-2">
      <WidgetSettingFieldLabel
        help="Maximum retained row count after stream updates are merged into the source dataset. Leave blank to keep every row received during this browser session."
        textClassName="text-xs font-medium text-muted-foreground"
      >
        Retention rows
      </WidgetSettingFieldLabel>
      <input
        type="number"
        min={1}
        value={value ?? ""}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange(Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined);
        }}
        disabled={disabled}
        className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

export function ConnectionStreamQueryWidgetSettings({
  widget,
  instanceId,
  instanceTitle,
  draftProps,
  draftPresentation,
  editable,
  controllerContext,
  onPreviewRuntimeStateChange,
  onDraftPropsChange,
  onDraftPresentationChange,
  previewRuntimeState,
}: Props) {
  const dashboardControls = useDashboardControls();
  const widgetRegistry = useDashboardWidgetRegistry();
  const connectionInstancesQuery = useConnectionInstances();
  const currentWidget = widgetRegistry.find((entry) => entry.id === instanceId) ?? null;
  const normalizedDraftProps = useMemo(
    () => normalizeConnectionStreamQueryProps(draftProps),
    [draftProps],
  );
  const selectedConnectionType = normalizedDraftProps.connectionRef?.typeId
    ? getConnectionTypeById(normalizedDraftProps.connectionRef.typeId)
    : undefined;
  const selectedConnectionInstance = useMemo(
    () =>
      resolveConnectionRefSelection({
        requestedRef: normalizedDraftProps.connectionRef,
        backendInstances: connectionInstancesQuery.data ?? [],
      }).connectionInstance,
    [connectionInstancesQuery.data, normalizedDraftProps.connectionRef],
  );
  const streamQueryModels = useMemo(
    () =>
      resolveConnectionStreamAuthoringQueryModels({
        connectionInstance: selectedConnectionInstance,
        connectionType: selectedConnectionType,
      }),
    [selectedConnectionInstance, selectedConnectionType],
  );
  const selectedQueryModel = normalizedDraftProps.queryModelId
    ? streamQueryModels.find((model) => model.id === normalizedDraftProps.queryModelId)
    : undefined;
  const streamModes = isConnectionQueryModelStreamable(selectedQueryModel)
    ? selectedQueryModel.stream.modes
    : [];
  const supportsRetainedAccumulation = streamModes.length > 0;
  const useTypedQueryEditor = Boolean(selectedConnectionType?.queryEditor);
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
  const activeRuntimeKey = useMemo(() => {
    const request = buildConnectionStreamQueryRequest(
      normalizedDraftProps,
      dashboardState,
      selectedQueryModel,
    );

    return request
      ? buildConnectionStreamQueryRuntimeKey({
          request,
        })
      : undefined;
  }, [dashboardState, normalizedDraftProps, selectedQueryModel]);
  const activeRuntimeEntry = useThrottledConnectionRuntimeEntry(activeRuntimeKey, 1000);
  const effectiveRuntimeState = currentWidget?.runtimeState ?? previewRuntimeState;
  const runtimeFrame = normalizeConnectionStreamQueryRuntimeState(effectiveRuntimeState);
  const streamCopy = resolveConnectionStreamAuthoringCopy(selectedConnectionType);
  const testPanelHydrationKey = [
    instanceId,
    normalizedDraftProps.connectionRef?.id ?? "",
    normalizedDraftProps.connectionRef?.typeId ?? "",
    normalizedDraftProps.queryModelId ?? "",
  ].join(":");
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [hydratedTestPanelKey, setHydratedTestPanelKey] = useState<string | null>(null);
  const testPanelReady = hydratedTestPanelKey === testPanelHydrationKey;
  const fieldSuggestions = [
    ...(runtimeFrame?.fields?.map((field) => field.key) ?? []),
    ...(runtimeFrame?.columns ?? []),
  ].filter((value, index, values) => value.trim() && values.indexOf(value) === index)
    .map((value) => ({
      value,
      label: value,
      description: "Published by the current stream runtime.",
    }));

  function updateStreamProps(nextPatch: Partial<ConnectionStreamQueryWidgetProps>) {
    onDraftPropsChange(
      normalizeConnectionStreamQueryProps({
        ...normalizedDraftProps,
        ...nextPatch,
      }),
    );
  }

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let animationFrameId: number | undefined;
    let cancelled = false;

    setHydratedTestPanelKey(null);

    const markReady = () => {
      if (!cancelled) {
        setHydratedTestPanelKey(testPanelHydrationKey);
      }
    };

    if (
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
    ) {
      animationFrameId = window.requestAnimationFrame(() => {
        timeoutId = window.setTimeout(markReady, 0);
      });
    } else {
      timeoutId = setTimeout(markReady, 0);
    }

    return () => {
      cancelled = true;

      if (
        animationFrameId !== undefined &&
        typeof window !== "undefined" &&
        typeof window.cancelAnimationFrame === "function"
      ) {
        window.cancelAnimationFrame(animationFrameId);
      }

      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [testPanelHydrationKey]);

  useEffect(() => {
    setDiagnosticsOpen(false);
  }, [testPanelHydrationKey]);

  return (
    <div className="space-y-6">
      <ConnectionQuerySettingsSurface
        authoringMode="stream"
        value={normalizedDraftProps as ConnectionQueryWidgetProps}
        onChange={(nextValue) => {
          updateStreamProps(nextValue as ConnectionStreamQueryWidgetProps);
        }}
        editable={editable}
        runtimeState={effectiveRuntimeState}
        runtimeStatusTitle="Current stream runtime"
        runtimeStatusDescription="This is the last live runtime state published by this stream source while you edit the draft query."
        runtimeStatusEmptyMessage="This stream source has not published a live dataset yet."
        sourceTitle={instanceTitle}
        connectionPathSettings={useTypedQueryEditor ? undefined : (
          <WidgetSchemaForm
            widget={widget}
            instanceId={instanceId}
            draftProps={normalizedDraftProps}
            onDraftPropsChange={(nextValue) => {
              updateStreamProps(nextValue as ConnectionStreamQueryWidgetProps);
            }}
            draftPresentation={draftPresentation}
            onDraftPresentationChange={onDraftPresentationChange}
            editable={editable}
            context={controllerContext}
          />
        )}
        queryModelFilter={isConnectionQueryModelStreamable}
        showConnectionPicker
        showIncrementalRefreshControls={false}
        showTestAction={false}
        showQueryEditor={useTypedQueryEditor}
      />

      {supportsRetainedAccumulation ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Retained rows</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Configure how retained rows are merged when this stream path publishes live updates.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <RetentionMaxRowsInput
              value={normalizedDraftProps.retentionMaxRows}
              disabled={!editable}
              onChange={(retentionMaxRows) => {
                updateStreamProps({ retentionMaxRows });
              }}
            />
            <div className="md:col-span-2">
              <QueryStringListField
                label="Merge key columns"
                value={normalizedDraftProps.mergeKeyFields}
                onChange={(mergeKeyFields) => {
                  updateStreamProps({ mergeKeyFields });
                }}
                disabled={!editable}
                placeholder="symbol, timestamp"
                suggestions={fieldSuggestions}
                help="Column combination used to replace retained rows when live updates arrive. Leave blank to use the connection path defaults when available, or append each incoming row when no default identity is published."
              />
            </div>
          </div>
        </section>
      ) : null}

      <ActiveStreamRuntimeSummary entry={activeRuntimeEntry} />

      {diagnosticsOpen ? (
        testPanelReady ? (
          <ConnectionStreamQueryTestPanel
            editable={editable}
            value={normalizedDraftProps}
            queryModel={selectedQueryModel}
            onPreviewRuntimeStateChange={onPreviewRuntimeStateChange}
            sourceWidgetId={instanceId}
            runButtonLabel={streamCopy.runButtonLabel}
            resultDescription={streamCopy.resultDescription}
            resultTitle={streamCopy.resultTitle}
          />
        ) : (
          <section className="space-y-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-topbar-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Loading stream diagnostics
            </div>
            <p className="text-sm text-muted-foreground">
              Preparing optional test controls after the editor opens.
            </p>
          </section>
        )
      ) : (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-4">
          <div>
            <div className="text-sm font-medium text-topbar-foreground">Stream diagnostics</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Optional live request diagnostics stay closed until needed.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDiagnosticsOpen(true);
            }}
          >
            Open diagnostics
          </Button>
        </section>
      )}
    </div>
  );
}
