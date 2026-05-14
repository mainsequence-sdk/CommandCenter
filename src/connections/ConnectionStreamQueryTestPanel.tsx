import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Activity, AlertTriangle, Clock3, Loader2, Play, Square, Wifi } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ConnectionQueryWebSocketLifecycleEvent } from "@/connections/api";
import {
  buildConnectionStreamPreviewState,
  type ConnectionStreamPreviewState,
} from "@/connections/connectionStreamPreview";
import { useThrottledConnectionRuntimeEntry } from "@/connections/connection-runtime-store";
import { useDashboardControls } from "@/dashboards/DashboardControls";
import { ConnectionQueryResponsePreview } from "@/connections/ConnectionQueryResponsePreview";
import { useRuntimeDataStore } from "@/widgets/shared/runtime-data-store";
import {
  isConnectionQueryModelStreamable,
  type ConnectionQueryModel,
} from "@/connections/types";
import {
  buildConnectionStreamQueryLifecycleFrame,
  buildConnectionStreamQueryRequest,
  buildConnectionStreamQueryRuntimeKey,
  buildConnectionStreamQueryValidationError,
  createConnectionStreamQueryWidgetRuntimeSession,
  normalizeConnectionStreamQueryProps,
  type ConnectionStreamLifecycleStatus,
  type ConnectionStreamQueryRuntimeSession,
  type ConnectionStreamQueryRuntimeState,
  type ConnectionStreamQueryWidgetProps,
} from "@/widgets/core/connection-stream-query/connectionStreamQueryModel";

interface StreamPreviewState {
  status: ConnectionStreamLifecycleStatus;
  frame: ConnectionStreamQueryRuntimeState | null;
  error?: string;
}

interface StreamDebugEventEntry {
  id: string;
  label: string;
  detail: string;
  occurredAtMs: number;
}

function createPreviewSubscriptionKey() {
  const uuid = globalThis.crypto?.randomUUID?.();

  return uuid
    ? `connection-stream-query-preview:${uuid}`
    : `connection-stream-query-preview:${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function formatTimestamp(value: number | string | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toLocaleString();
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return "none";
}

function formatStatusLabel(status: ConnectionStreamLifecycleStatus) {
  switch (status) {
    case "connecting":
      return "Connecting";
    case "live":
      return "Live";
    case "reconnecting":
      return "Reconnecting";
    case "error":
      return "Error";
    case "closed":
      return "Closed";
    default:
      return "Idle";
  }
}

function formatLifecycleEvent(event: ConnectionQueryWebSocketLifecycleEvent): StreamDebugEventEntry {
  const occurredAtMs = Date.now();

  switch (event.type) {
    case "ticket-request-start":
      return {
        id: `${occurredAtMs}-${event.type}`,
        label: "Ticket request",
        detail: event.url,
        occurredAtMs,
      };
    case "ticket-response":
      return {
        id: `${occurredAtMs}-${event.type}`,
        label: "Ticket received",
        detail: `${event.url} (audience ${event.audience}, expires ${event.expiresAt})`,
        occurredAtMs,
      };
    case "socket-connect-start":
      return {
        id: `${occurredAtMs}-${event.type}`,
        label: "Socket connect",
        detail: event.url,
        occurredAtMs,
      };
    case "socket-open":
      return {
        id: `${occurredAtMs}-${event.type}`,
        label: "Socket open",
        detail: event.url,
        occurredAtMs,
      };
    case "subscribe-sent":
      return {
        id: `${occurredAtMs}-${event.type}`,
        label: "Subscribe sent",
        detail: event.url,
        occurredAtMs,
      };
    case "socket-error":
      return {
        id: `${occurredAtMs}-${event.type}`,
        label: "Socket error",
        detail: event.url,
        occurredAtMs,
      };
    case "socket-close":
      return {
        id: `${occurredAtMs}-${event.type}`,
        label: "Socket close",
        detail: `${event.url} (code ${event.code}${event.reason ? `, reason ${event.reason}` : ""})`,
        occurredAtMs,
      };
  }
}

function formatDebugTimestamp(value: number) {
  return new Date(value).toLocaleTimeString();
}

function getStatusTone(status: ConnectionStreamLifecycleStatus) {
  if (status === "error") {
    return "border-danger/40 bg-danger/10 text-danger";
  }

  if (status === "live") {
    return "border-emerald-500/30 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "connecting" || status === "reconnecting") {
    return "border-warning/35 bg-warning/10 text-warning";
  }

  return "border-border/70 bg-background/35 text-muted-foreground";
}

function StatusMetric({
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
      <div className="mt-1 break-words text-xs text-foreground">{value}</div>
    </div>
  );
}

export interface ConnectionStreamQueryTestPanelProps {
  editable?: boolean;
  value: ConnectionStreamQueryWidgetProps;
  queryModel?: ConnectionQueryModel;
  onPreviewRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
  sourceWidgetId?: string;
  runButtonLabel?: string;
  resultDescription?: string;
  resultTitle?: string;
}

export function ConnectionStreamQueryTestPanel({
  editable = true,
  value,
  queryModel,
  onPreviewRuntimeStateChange,
  sourceWidgetId,
  runButtonLabel = "Test stream",
  resultDescription = "Preview of the latest normalized frame received from the WebSocket stream.",
  resultTitle = "Stream preview",
}: ConnectionStreamQueryTestPanelProps) {
  const dashboardControls = useDashboardControls();
  const runtimeDataStore = useRuntimeDataStore();
  const sessionRef = useRef<ConnectionStreamQueryRuntimeSession | null>(null);
  const normalizedProps = useMemo(
    () => normalizeConnectionStreamQueryProps(value),
    [value],
  );
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
    () => buildConnectionStreamQueryRequest(normalizedProps, dashboardState, queryModel),
    [dashboardState, normalizedProps, queryModel],
  );
  const requestSignature = useMemo(
    () => formatJson(previewRequest),
    [previewRequest],
  );
  const activeRuntimeKey = useMemo(
    () =>
      previewRequest
        ? buildConnectionStreamQueryRuntimeKey({
            request: previewRequest,
          })
        : undefined,
    [previewRequest],
  );
  const activeRuntimeEntry = useThrottledConnectionRuntimeEntry(activeRuntimeKey, 1000);
  const validationError = buildConnectionStreamQueryValidationError({
    props: normalizedProps,
    queryModel,
  });
  const [previewState, setPreviewState] = useState<StreamPreviewState>({
    status: "idle",
    frame: null,
  });
  const [previewBuffer, setPreviewBuffer] = useState<ConnectionStreamPreviewState | null>(null);
  const [debugEvents, setDebugEvents] = useState<StreamDebugEventEntry[]>([]);

  const appendDebugEvent = useCallback((event: ConnectionQueryWebSocketLifecycleEvent) => {
    if (import.meta.env.DEV) {
      console.debug("[connection-stream-test]", {
        event: event.type,
        ...(event.type === "ticket-response"
          ? {
              url: event.url,
              audience: event.audience,
              expiresAt: event.expiresAt,
            }
          : event.type === "socket-close"
            ? {
                url: event.url,
                code: event.code,
                reason: event.reason,
              }
            : {
                url: event.url,
              }),
      });
    }
    setDebugEvents((current) => [...current, formatLifecycleEvent(event)].slice(-8));
  }, []);

  const closeActiveSession = useCallback(
    (reason: string) => {
      const session = sessionRef.current;

      if (!session) {
        return;
      }

      sessionRef.current = null;
      session.close(1000, reason);
      setPreviewState((current) => {
        const frame = buildConnectionStreamQueryLifecycleFrame({
          props: normalizedProps,
          status: "closed",
          retainedState: current.frame,
          closedAtMs: Date.now(),
        });

        return {
          status: "closed",
          frame,
        };
      });
      setPreviewBuffer((current) =>
        current
          ? buildConnectionStreamPreviewState({
              retainedPreviewState: current,
              runtimeFrame: buildConnectionStreamQueryLifecycleFrame({
                props: normalizedProps,
                status: "closed",
                retainedState: current.frame,
                closedAtMs: Date.now(),
              }),
              queryModel,
            })
          : null,
      );
    },
    [normalizedProps, queryModel],
  );

  useEffect(() => {
    closeActiveSession("connection stream preview changed");
    setPreviewBuffer(null);
    onPreviewRuntimeStateChange?.(undefined);
    setPreviewState({
      status: "idle",
      frame: null,
    });
  }, [closeActiveSession, onPreviewRuntimeStateChange, requestSignature]);

  useEffect(() => {
    return () => {
      sessionRef.current?.close(1000, "connection stream preview unmounted");
      sessionRef.current = null;
    };
  }, []);

  function startPreview() {
    if (validationError || !previewRequest || !isConnectionQueryModelStreamable(queryModel)) {
      setPreviewBuffer(null);
      onPreviewRuntimeStateChange?.(undefined);
      setPreviewState({
        status: "error",
        frame: null,
        error: validationError ?? "Build a streamable connection request before testing.",
      });
      return;
    }

    closeActiveSession("connection stream preview restarted");
    setDebugEvents([]);
    setPreviewBuffer(null);
    onPreviewRuntimeStateChange?.(undefined);
    if (import.meta.env.DEV) {
      console.debug("[connection-stream-test] subscribe payload", {
        payload: {
          type: "subscribe",
          request: previewRequest,
        },
      });
    }
    setPreviewState({
      status: "connecting",
      frame: buildConnectionStreamQueryLifecycleFrame({
        props: normalizedProps,
        status: "connecting",
        lastMessageAtMs: Date.now(),
      }),
    });

    try {
      sessionRef.current = createConnectionStreamQueryWidgetRuntimeSession({
        subscriptionKey: createPreviewSubscriptionKey(),
        request: previewRequest,
        props: normalizedProps,
        queryModel,
        sourceWidgetId,
        onRuntimeStateChange: (frame) => {
          if (frame.streamStatus === "closed") {
            sessionRef.current = null;
          }

          setPreviewBuffer((current) =>
            buildConnectionStreamPreviewState({
              retainedPreviewState: current,
              runtimeFrame: frame,
              queryModel,
            }),
          );
          setPreviewState({
            status: frame.streamStatus,
            frame,
            error: frame.error,
          });
          onPreviewRuntimeStateChange?.(frame as unknown as Record<string, unknown>);
        },
        options: {
          onLifecycleEvent: appendDebugEvent,
          runtimeDataStore,
        },
      });
    } catch (error) {
      setPreviewBuffer(null);
      onPreviewRuntimeStateChange?.(undefined);
      setPreviewState({
        status: "error",
        frame: null,
        error: error instanceof Error ? error.message : "Connection stream preview failed.",
      });
    }
  }

  const statusFrame = previewState.frame;
  const previewFrame = previewBuffer?.frame ?? statusFrame;
  const canStart = editable && Boolean(previewRequest) && !validationError;
  const canCloseConnection =
    Boolean(sessionRef.current) ||
    previewState.status === "connecting" ||
    previewState.status === "live" ||
    previewState.status === "reconnecting";
  const closeButtonLabel = previewState.status === "live"
    ? "Close connection"
    : previewState.status === "connecting" || previewState.status === "reconnecting"
      ? "Cancel connect"
      : "Stop";
  const activeRuntimeFrame = activeRuntimeEntry?.runtimeState as
    | ConnectionStreamQueryRuntimeState
    | undefined;
  const showActiveRuntime =
    Boolean(activeRuntimeEntry) &&
    activeRuntimeEntry?.sessionKind === "live" &&
    (
      activeRuntimeEntry.activeOwnerCount > 0 ||
      activeRuntimeEntry.status === "connecting" ||
      activeRuntimeEntry.status === "live" ||
      activeRuntimeEntry.status === "reconnecting" ||
      activeRuntimeEntry.status === "error"
    );

  if (showActiveRuntime && activeRuntimeEntry) {
    const rowCount =
      activeRuntimeEntry.rowCount ??
      activeRuntimeFrame?.rows.length ??
      0;
    const columnCount =
      activeRuntimeEntry.columnCount ??
      activeRuntimeFrame?.columns.length ??
      0;

    return (
      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Active workspace stream</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              This connection request is already owned by the workspace runtime. Settings is reading
              the live session instead of opening a second test socket.
            </p>
          </div>
          <div className={["rounded-full border px-3 py-1 text-xs font-medium", getStatusTone(activeRuntimeEntry.status)].join(" ")}>
            {formatStatusLabel(activeRuntimeEntry.status)}
          </div>
        </div>

        <div className={["rounded-[calc(var(--radius)-6px)] border p-3", getStatusTone(activeRuntimeEntry.status)].join(" ")}>
          <div className="grid gap-2 md:grid-cols-4">
            <StatusMetric
              label="Runtime owners"
              value={activeRuntimeEntry.activeOwnerCount.toLocaleString()}
            />
            <StatusMetric
              label="Rows"
              value={rowCount.toLocaleString()}
            />
            <StatusMetric
              label="Columns"
              value={columnCount.toLocaleString()}
            />
            <StatusMetric
              label="Last message"
              value={formatTimestamp(activeRuntimeEntry.lastMessageAtMs)}
            />
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-4">
            <StatusMetric
              label="Heartbeat"
              value={formatTimestamp(activeRuntimeEntry.lastHeartbeatAtMs)}
            />
            <StatusMetric
              label="Retry attempts"
              value={String(activeRuntimeEntry.reconnectAttemptCount ?? 0)}
            />
            <StatusMetric
              label="Next retry"
              value={formatTimestamp(activeRuntimeEntry.nextRetryAtMs)}
            />
            <StatusMetric
              label="Runtime key"
              value={activeRuntimeEntry.key}
            />
          </div>
          {activeRuntimeEntry.error ? (
            <div className="mt-3 flex items-start gap-2 rounded-[calc(var(--radius)-8px)] border border-danger/35 bg-danger/8 px-3 py-2 text-xs text-danger">
              <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{activeRuntimeEntry.error}</span>
            </div>
          ) : null}
        </div>

        {activeRuntimeFrame ? (
          <ConnectionQueryResponsePreview
            frame={activeRuntimeFrame}
            description="Latest normalized frame published by the active workspace stream."
            emptyMessage="The active stream has not published rows yet."
            title="Active stream data"
          />
        ) : null}
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Test stream</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Opens the query WebSocket, sends the subscribe payload, and previews received frames.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCloseConnection ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => closeActiveSession("connection stream preview stopped")}
            >
              <Square className="h-4 w-4" />
              {closeButtonLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={startPreview}
            disabled={!canStart}
          >
            {previewState.status === "connecting" ||
            previewState.status === "reconnecting" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {runButtonLabel}
          </Button>
        </div>
      </div>

      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-3">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-foreground">Subscribe payload</span>
          <span className="text-muted-foreground">
            {previewRequest ? "Ready" : "Connection and streamable path required"}
          </span>
        </div>
        <pre className="mt-2 max-h-56 overflow-auto rounded-[calc(var(--radius)-8px)] bg-background/70 p-2 text-[11px] leading-relaxed text-muted-foreground">
          {previewRequest
            ? formatJson({
                type: "subscribe",
                request: previewRequest,
              })
            : "Select a connection and streamable query path to build the subscribe payload."}
        </pre>
      </div>

      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-3">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-foreground">Connection attempts</span>
          <span className="text-muted-foreground">
            {debugEvents.length > 0 ? `${debugEvents.length} events` : "No network events yet"}
          </span>
        </div>
        {debugEvents.length > 0 ? (
          <div className="mt-2 space-y-2">
            {debugEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/70 px-3 py-2 text-[11px] text-muted-foreground"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground">{event.label}</span>
                  <span>{formatDebugTimestamp(event.occurredAtMs)}</span>
                </div>
                <div className="mt-1 break-all">{event.detail}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 text-[11px] text-muted-foreground">
            Start the stream test to see the ticket request, socket connect attempt, socket open,
            subscribe send, and close/error events.
          </div>
        )}
      </div>

      <div className={["rounded-[calc(var(--radius)-6px)] border p-3", getStatusTone(previewState.status)].join(" ")}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            {previewState.status === "error" ? (
              <AlertTriangle className="h-4 w-4" />
            ) : previewState.status === "live" ? (
              <Wifi className="h-4 w-4" />
            ) : previewState.status === "connecting" ||
              previewState.status === "reconnecting" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Clock3 className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">
                Connection status: {formatStatusLabel(previewState.status)}
              </span>
              {statusFrame?.streamErrorCode ? (
                <code className="rounded bg-background/55 px-1.5 py-0.5 text-[11px]">
                  {statusFrame.streamErrorCode}
                </code>
              ) : null}
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <StatusMetric
                label="Last sequence"
                value={statusFrame?.sequence === undefined ? "none" : String(statusFrame.sequence)}
              />
              <StatusMetric
                label="Last emitted"
                value={formatTimestamp(statusFrame?.emittedAt)}
              />
              <StatusMetric
                label="Heartbeat"
                value={formatTimestamp(statusFrame?.lastHeartbeatAtMs)}
              />
              <StatusMetric
                label="Last message"
                value={formatTimestamp(statusFrame?.lastMessageAtMs)}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <StatusMetric
                label="Retry attempts"
                value={String(statusFrame?.reconnectAttemptCount ?? 0)}
              />
              <StatusMetric
                label="Next retry"
                value={formatTimestamp(statusFrame?.nextRetryAtMs)}
              />
              <StatusMetric
                label="Last disconnect"
                value={formatTimestamp(statusFrame?.lastDisconnectAtMs)}
              />
              <StatusMetric
                label="Disconnect reason"
                value={statusFrame?.lastDisconnectReason ?? "none"}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <StatusMetric
                label="Preview rows"
                value={previewFrame ? previewFrame.rows.length.toLocaleString() : "0"}
              />
              <StatusMetric
                label="Preview mode"
                value={previewBuffer?.accumulationMode ?? "none"}
              />
              <StatusMetric
                label="Retention limit"
                value={previewBuffer ? previewBuffer.maxRetainedRows.toLocaleString() : "none"}
              />
              <StatusMetric
                label="Last plotted"
                value={formatTimestamp(previewBuffer?.lastPlottedAtMs)}
              />
            </div>
            {previewState.error ? (
              <div className="flex items-start gap-2 rounded-[calc(var(--radius)-8px)] border border-danger/35 bg-danger/8 px-3 py-2 text-xs text-danger">
                <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{previewState.error}</span>
              </div>
            ) : null}
            {validationError ? (
              <div className="text-xs opacity-85">{validationError}</div>
            ) : null}
          </div>
        </div>
      </div>

      {previewFrame ? (
        <ConnectionQueryResponsePreview
          frame={previewFrame}
          description={resultDescription}
          emptyMessage="Open the stream to preview the latest frame."
          title={resultTitle}
        />
      ) : null}
    </section>
  );
}
