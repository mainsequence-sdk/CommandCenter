import { useMemo, useState } from "react";

import { Bug, ChevronDown, Clock3, Loader2, Trash2, X } from "lucide-react";

import { getWidgetById } from "@/app/registry";
import {
  clearDashboardRequestTrace,
  useDashboardRequestTrace,
  type DashboardRequestTraceCycle,
  type DashboardRequestTraceEntry,
} from "@/dashboards/dashboard-request-trace";
import type { DashboardWidgetInstance } from "@/dashboards/types";
import { cn } from "@/lib/utils";
import type { WidgetWorkspaceRuntimeMode } from "@/widgets/types";

function formatReasonLabel(reason: DashboardRequestTraceEntry["reason"]) {
  switch (reason) {
    case "dashboard-refresh":
      return "Refresh";
    case "manual-recalculate":
      return "Recalculate";
    case "manual-submit":
      return "Manual submit";
    case "upstream-update":
      return "Upstream update";
    case "settings-test":
      return "Settings test";
    case "component-query":
      return "Component query";
    case "ui-query":
      return "UI query";
    default:
      return reason;
  }
}

function formatCycleLabel(cycle: DashboardRequestTraceCycle) {
  const timeLabel = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(cycle.startedAtMs);

  if (cycle.kind === "activity") {
    return cycle.label?.trim()
      ? `${cycle.label.trim()} at ${timeLabel}`
      : `Component activity at ${timeLabel}`;
  }

  if (cycle.id.startsWith("initial:")) {
    return `Initial refresh at ${timeLabel}`;
  }

  return `Refresh at ${timeLabel}`;
}

function formatDuration(durationMs?: number) {
  if (typeof durationMs !== "number") {
    return "Running…";
  }

  if (durationMs < 1_000) {
    return `${durationMs.toLocaleString()} ms`;
  }

  return `${(durationMs / 1_000).toFixed(durationMs >= 10_000 ? 0 : 2)} s`;
}

function formatRelativeOffset(
  cycleStartedAtMs: number | undefined,
  requestStartedAtMs: number,
) {
  if (!cycleStartedAtMs) {
    return "0 ms";
  }

  const delta = Math.max(0, requestStartedAtMs - cycleStartedAtMs);

  if (delta < 1_000) {
    return `+${delta.toLocaleString()} ms`;
  }

  return `+${(delta / 1_000).toFixed(delta >= 10_000 ? 0 : 2)} s`;
}

function resolveRequestStatusTone(entry: DashboardRequestTraceEntry) {
  if (entry.ok === false || entry.status && entry.status >= 400) {
    return "border-danger/25 bg-danger/8 text-danger";
  }

  if (entry.completedAtMs == null) {
    return "border-primary/25 bg-primary/8 text-primary";
  }

  return "border-success/25 bg-success/8 text-success";
}

function buildDuplicateSummary(entries: DashboardRequestTraceEntry[]) {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    const key = `${entry.method} ${entry.path}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((left, right) => right[1] - left[1]);
}

function resolveCycleStatusTone(status: string | undefined) {
  if (status === "error") {
    return "border-danger/25 bg-danger/8 text-danger";
  }

  if (status === "running") {
    return "border-primary/25 bg-primary/8 text-primary";
  }

  if (status === "cancelled") {
    return "border-warning/25 bg-warning/10 text-warning";
  }

  return "border-success/25 bg-success/8 text-success";
}

function formatSourceLabel(source: DashboardRequestTraceEntry["source"]) {
  switch (source) {
    case "execution":
      return "Execution";
    case "component":
      return "Component";
    case "ui":
      return "UI";
    default:
      return source;
  }
}

function formatResolutionLabel(resolution: DashboardRequestTraceEntry["resolution"]) {
  switch (resolution) {
    case "cache-hit":
      return "Cache hit";
    case "shared-promise":
      return "Shared";
    case "network":
    default:
      return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatDateTime(value: unknown) {
  const date =
    typeof value === "number"
      ? new Date(value)
      : typeof value === "string"
        ? new Date(value)
        : null;

  if (!date || !Number.isFinite(date.getTime())) {
    return typeof value === "string" && value.trim() ? value.trim() : "Not set";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatTimeRange(value: unknown) {
  if (!isRecord(value)) {
    return "No time range requested";
  }

  const from = value.from;
  const to = value.to;

  if (typeof from !== "string" || typeof to !== "string") {
    return "No time range requested";
  }

  return `${formatDateTime(from)} -> ${formatDateTime(to)}`;
}

function formatDetailValue(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "Not set";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toLocaleString() : "Not set";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatDetailsJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function resolveRuntimeViolation(
  entry: DashboardRequestTraceEntry,
  runtimeMode: WidgetWorkspaceRuntimeMode | undefined,
) {
  if (entry.source !== "component") {
    return null;
  }

  if (runtimeMode === "execution-owner") {
    return "Execution-owned widget issued a component runtime request.";
  }

  if (runtimeMode === "consumer") {
    return "Consumer widget issued a runtime component request.";
  }

  return null;
}

function DetailItem({
  label,
  value,
  wide,
}: {
  label: string;
  value: unknown;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-border/55 bg-background/55 px-3 py-2",
        wide ? "sm:col-span-2" : undefined,
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 break-words font-mono text-[11px] leading-5 text-foreground">
        {formatDetailValue(value)}
      </div>
    </div>
  );
}

function ConnectionQueryTraceDetails({
  details,
}: {
  details: Record<string, unknown>;
}) {
  const incremental = isRecord(details.incremental) ? details.incremental : undefined;

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Connection Query
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <DetailItem label="Connection" value={details.connectionUid} />
        <DetailItem label="Connection type" value={details.connectionTypeId} />
        <DetailItem label="Query model" value={details.queryModelId} />
        <DetailItem label="Query kind" value={details.queryKind} />
        <DetailItem label="Requested range" value={formatTimeRange(details.timeRange)} wide />
        <DetailItem label="Full workspace range" value={formatTimeRange(details.retainedTimeRange)} wide />
        <DetailItem label="Output contract" value={details.requestedOutputContract} />
        <DetailItem label="Max rows" value={details.maxRows} />
        {incremental ? (
          <>
            <DetailItem label="Incremental" value={incremental.active} />
            <DetailItem label="Incremental reason" value={incremental.reason} />
            <DetailItem label="Had retained base" value={incremental.hasRetainedState} />
            <DetailItem label="Requested delta range" value={incremental.requestedDeltaRange} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function RequestDetails({
  entry,
  runtimeMode,
}: {
  entry: DashboardRequestTraceEntry;
  runtimeMode: WidgetWorkspaceRuntimeMode | undefined;
}) {
  const details = entry.details;
  const isConnectionQuery = isRecord(details) && details.kind === "connection-query";

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-border/60 bg-card/45 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <DetailItem label="URL" value={entry.url} wide />
        <DetailItem label="Started" value={formatDateTime(entry.startedAtMs)} />
        <DetailItem label="Completed" value={entry.completedAtMs ? formatDateTime(entry.completedAtMs) : "Running"} />
        <DetailItem label="Runtime mode" value={runtimeMode} />
        <DetailItem label="Trace source" value={formatSourceLabel(entry.source)} />
        <DetailItem label="Reason" value={formatReasonLabel(entry.reason)} />
        <DetailItem label="Resolution" value={formatResolutionLabel(entry.resolution) ?? "Network"} />
      </div>

      {isConnectionQuery ? (
        <ConnectionQueryTraceDetails details={details} />
      ) : details ? (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Trace Details
          </div>
          <pre className="max-h-64 overflow-auto rounded-xl border border-border/60 bg-background/70 p-3 text-[11px] leading-5 text-foreground">
            {formatDetailsJson(details)}
          </pre>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-background/55 px-3 py-2 text-xs text-muted-foreground">
          No request-specific details were attached to this trace entry.
        </div>
      )}
    </div>
  );
}

export function WorkspaceRequestDebugPanel({
  open,
  onClose,
  placementClassName,
  scopeId,
  widgets,
}: {
  open: boolean;
  onClose: () => void;
  placementClassName?: string;
  scopeId: string;
  widgets: DashboardWidgetInstance[];
}) {
  const traceScope = useDashboardRequestTrace(scopeId);
  const [expandedRequestIds, setExpandedRequestIds] = useState<Set<string>>(() => new Set());
  const cycles = traceScope.cycles;
  const latestCycle =
    cycles.find((candidate) => candidate.id === traceScope.activeCycleId) ??
    cycles.find((candidate) => candidate.id === traceScope.latestCycleId) ??
    cycles[0];
  const widgetLabelByInstanceId = useMemo(
    () =>
      Object.fromEntries(
        widgets.map((widget) => [
          widget.id,
          widget.title?.trim() || widget.id,
        ] as const),
      ),
    [widgets],
  );
  const widgetRuntimeModeByInstanceId = useMemo(
    () =>
      Object.fromEntries(
        widgets.map((instance) => [
          instance.id,
          getWidgetById(instance.widgetId)?.workspaceRuntimeMode,
        ] as const),
      ),
    [widgets],
  );
  const totalRequests = useMemo(
    () => cycles.reduce((sum, cycle) => sum + cycle.requests.length, 0),
    [cycles],
  );
  function toggleRequestDetails(requestId: string) {
    setExpandedRequestIds((current) => {
      const next = new Set(current);

      if (next.has(requestId)) {
        next.delete(requestId);
      } else {
        next.add(requestId);
      }

      return next;
    });
  }

  return (
    <aside
      className={cn(
        "absolute z-40 flex w-[min(560px,calc(100vw-3rem))] flex-col overflow-hidden rounded-[24px] border border-border/80 bg-background/96 shadow-[var(--shadow-panel)] backdrop-blur-xl transition-[transform,opacity] duration-200",
        placementClassName ?? "right-4 top-4 bottom-4",
        open ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+24px)] opacity-0 pointer-events-none",
      )}
      aria-label="Debug Request"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <Bug className="h-4 w-4 text-primary" />
              <span>Debug Request</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Uses the shared workspace request trace. Refresh history stays grouped here so you can
              inspect repeated endpoints and timing without losing earlier runs.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded-full border border-border/70 bg-card/82 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              onClick={() => clearDashboardRequestTrace(scopeId)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-card/82 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              aria-label="Close Debug Request"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-border/70 bg-card/72 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Latest Activity
              </div>
              <div className="mt-1 truncate text-sm font-semibold text-foreground">
                {latestCycle ? formatCycleLabel(latestCycle) : "No activity yet"}
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card/72 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Tracked Requests
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {totalRequests.toLocaleString()}
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card/72 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                History Entries
              </div>
              <div className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{cycles.length.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {cycles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 px-4 py-5 text-sm text-muted-foreground">
                No traced workspace requests yet.
              </div>
            ) : (
              cycles.map((cycle) => {
                const duplicateSummary = buildDuplicateSummary(cycle.requests);

                return (
                  <section
                    key={cycle.id}
                    className="space-y-3 rounded-2xl border border-border/70 bg-card/72 p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            {formatCycleLabel(cycle)}
                          </span>
                          {traceScope.activeCycleId === cycle.id ? (
                            <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                              Active
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {cycle.requests.length.toLocaleString()} requests
                        </div>
                      </div>
                      <div
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                          resolveCycleStatusTone(cycle.status),
                        )}
                      >
                        {cycle.status === "running" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Clock3 className="h-3 w-3" />
                        )}
                        <span className="capitalize">
                          {cycle.status === "cancelled" ? "Aborted" : cycle.status}
                        </span>
                      </div>
                    </div>

                    {duplicateSummary.length > 0 ? (
                      <div className="space-y-2 rounded-xl border border-border/60 bg-background/50 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Duplicate Endpoints
                        </div>
                        <div className="space-y-2">
                          {duplicateSummary.map(([key, count]) => (
                            <div
                              key={key}
                              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/55 px-3 py-2 text-xs"
                            >
                              <span className="min-w-0 truncate font-mono text-foreground">{key}</span>
                              <span className="rounded-full border border-warning/25 bg-warning/10 px-2 py-0.5 font-semibold text-warning">
                                ×{count}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      {cycle.requests
                        .slice()
                        .sort((left, right) => left.startedAtMs - right.startedAtMs)
                        .map((entry) => {
                          const runtimeMode =
                            entry.instanceId
                              ? widgetRuntimeModeByInstanceId[entry.instanceId]
                              : undefined;
                          const runtimeViolation = resolveRuntimeViolation(entry, runtimeMode);
                          const expanded = expandedRequestIds.has(entry.id);

                          return (
                            <div
                              key={entry.id}
                              className="rounded-2xl border border-border/70 bg-background/52 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="rounded-full border border-border/60 bg-background/65 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground">
                                      {entry.method}
                                    </span>
                                    <span
                                      className={cn(
                                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
                                        resolveRequestStatusTone(entry),
                                      )}
                                    >
                                      {entry.completedAtMs == null
                                        ? "Running"
                                        : entry.ok === false || (entry.status ?? 0) >= 400
                                          ? "Error"
                                          : "Done"}
                                    </span>
                                  </div>
                                  <div className="mt-2 break-all font-mono text-[12px] leading-5 text-foreground">
                                    {entry.path}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-start gap-2">
                                  <button
                                    type="button"
                                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                                    aria-expanded={expanded}
                                    onClick={() => {
                                      toggleRequestDetails(entry.id);
                                    }}
                                  >
                                    <span>Details</span>
                                    <ChevronDown
                                      className={cn(
                                        "h-3.5 w-3.5 transition-transform",
                                        expanded ? "rotate-180" : undefined,
                                      )}
                                    />
                                  </button>
                                  <div className="text-right">
                                    <div className="text-sm font-semibold text-foreground">
                                      {formatDuration(entry.durationMs)}
                                    </div>
                                    <div className="mt-1 text-[11px] text-muted-foreground">
                                      {formatRelativeOffset(cycle.startedAtMs, entry.startedAtMs)}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                <span className="rounded-full border border-border/60 bg-background/50 px-2 py-0.5">
                                  {formatReasonLabel(entry.reason)}
                                </span>
                                <span className="rounded-full border border-border/60 bg-background/50 px-2 py-0.5">
                                  {formatSourceLabel(entry.source)}
                                </span>
                                {entry.status ? (
                                  <span className="rounded-full border border-border/60 bg-background/50 px-2 py-0.5">
                                    HTTP {entry.status}
                                  </span>
                                ) : null}
                                {formatResolutionLabel(entry.resolution) ? (
                                  <span className="rounded-full border border-border/60 bg-background/50 px-2 py-0.5">
                                    {formatResolutionLabel(entry.resolution)}
                                  </span>
                                ) : null}
                                {entry.instanceId ? (
                                  <span className="rounded-full border border-border/60 bg-background/50 px-2 py-0.5">
                                    {widgetLabelByInstanceId[entry.instanceId] ?? entry.instanceId}
                                  </span>
                                ) : null}
                                {runtimeViolation ? (
                                  <span className="rounded-full border border-danger/25 bg-danger/10 px-2 py-0.5 font-semibold text-danger">
                                    Runtime violation
                                  </span>
                                ) : null}
                              </div>

                              {runtimeViolation ? (
                                <div className="mt-3 rounded-xl border border-danger/20 bg-danger/8 px-3 py-2 text-xs text-danger">
                                  {runtimeViolation}
                                </div>
                              ) : null}

                              {entry.error ? (
                                <div className="mt-3 rounded-xl border border-danger/20 bg-danger/8 px-3 py-2 text-xs text-danger">
                                  {entry.error}
                                </div>
                              ) : null}

                              {expanded ? (
                                <RequestDetails entry={entry} runtimeMode={runtimeMode} />
                              ) : null}
                            </div>
                          );
                        })}
                    </div>
                  </section>
                );
              })
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
