import { useEffect, useMemo, useRef } from "react";

import { AlertTriangle, DatabaseZap, Loader2, Wifi, WifiOff } from "lucide-react";

import { getConnectionTypeById } from "@/app/registry";
import {
  useConnectionRuntimeStore,
  useThrottledConnectionRuntimeEntry,
  type ConnectionRuntimeSessionHandle,
} from "@/connections/connection-runtime-store";
import type { ConnectionQueryModel } from "@/connections/types";
import { useDashboardControls } from "@/dashboards/DashboardControls";
import { useDashboardWidgetExecution } from "@/dashboards/DashboardWidgetExecution";
import { listUnresolvedReferenceBackedPropInputs } from "@/dashboards/widget-dependencies";
import { resolveReferenceBackedWidgetState } from "@/dashboards/widget-instance-references";
import { isWidgetReferenceExpressionValue } from "@/dashboards/widget-reference-language";
import {
  getRuntimeDataRef,
  useRuntimeDataStore,
} from "@/widgets/shared/runtime-data-store";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  buildConnectionStreamQueryRequest,
  buildConnectionStreamQueryRuntimeKey,
  buildConnectionStreamQueryValidationError,
  buildConnectionStreamQueryLifecycleFrame,
  createConnectionStreamQueryWidgetRuntimeSession,
  normalizeConnectionStreamQueryProps,
  normalizeConnectionStreamQueryRuntimeState,
  type ConnectionStreamQueryRuntimeState,
  type ConnectionStreamQueryWidgetProps,
} from "./connectionStreamQueryModel";

type Props = WidgetComponentProps<ConnectionStreamQueryWidgetProps>;

// Temporary stream diagnostics are disabled by default to avoid console spam.
const STREAM_QUERY_DEBUG_LOGS_ENABLED = false;

function stableJsonStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJsonStringify(entry)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJsonStringify((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function buildConnectionStreamQueryExecutionKey(input: {
  instanceId?: string;
  props: ConnectionStreamQueryWidgetProps;
  queryModel?: {
    id: string;
    stream?: unknown;
  };
  request: unknown;
  publicExecutionKey?: string;
  validationError?: string | null;
}) {
  const executionProps =
    input.publicExecutionKey && input.props.connectionRef
      ? {
          ...input.props,
          connectionRef: {
            typeId: input.props.connectionRef.typeId,
          },
        }
      : input.props;

  return stableJsonStringify({
    instanceId: input.instanceId?.trim() || undefined,
    publicExecutionKey: input.publicExecutionKey?.trim() || undefined,
    props: executionProps,
    queryModel: input.queryModel
      ? {
          id: input.queryModel.id,
          stream: input.queryModel.stream,
        }
      : null,
    request:
      input.publicExecutionKey && input.request && typeof input.request === "object"
        ? (({ connectionId: _connectionId, ...publicRequest }) => publicRequest)(
            input.request as {
              connectionId?: string | number;
            } & Record<string, unknown>,
          )
        : input.request,
    validationError: input.validationError ?? null,
  });
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isStreamingActive(status: string) {
  return status === "connecting" || status === "live" || status === "reconnecting";
}

function containsReferenceExpressionValue(value: unknown): boolean {
  if (isWidgetReferenceExpressionValue(value)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((entry) => containsReferenceExpressionValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((entry) => containsReferenceExpressionValue(entry));
  }

  return false;
}

export function hasPendingConnectionStreamReferenceValues(input: {
  props: ConnectionStreamQueryWidgetProps;
  resolvedInputs?: Props["resolvedInputs"];
}) {
  const subscriptionProps = {
    connectionRef: input.props.connectionRef,
    queryModelId: input.props.queryModelId,
    query: input.props.query,
    timeRangeMode: input.props.timeRangeMode,
    fixedStartMs: input.props.fixedStartMs,
    fixedEndMs: input.props.fixedEndMs,
    variables: input.props.variables,
    maxRows: input.props.maxRows,
    mergeKeyFields: input.props.mergeKeyFields,
    retentionMaxRows: input.props.retentionMaxRows,
  } satisfies Partial<ConnectionStreamQueryWidgetProps>;

  return (
    listUnresolvedReferenceBackedPropInputs(input.resolvedInputs).length > 0 ||
    containsReferenceExpressionValue(subscriptionProps)
  );
}

function summarizeStreamResolvedInputs(resolvedInputs: Props["resolvedInputs"]) {
  return Object.fromEntries(
    Object.entries(resolvedInputs ?? {}).map(([inputId, resolved]) => {
      const entries = Array.isArray(resolved) ? resolved : resolved ? [resolved] : [];

      return [
        inputId,
        entries.map((entry) => ({
          status: entry.status,
          sourceWidgetId: entry.sourceWidgetId,
          sourceOutputId: entry.sourceOutputId,
          value: entry.value,
        })),
      ];
    }),
  );
}

function summarizeStreamKey(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return value.length > 180 ? `${value.slice(0, 90)}...${value.slice(-70)}` : value;
}

export function ConnectionStreamQueryWidget({
  instanceId,
  instanceTitle,
  props,
  resolvedInputs,
  runtimeState,
  onRuntimeStateChange,
}: Props) {
  const dashboardControls = useDashboardControls();
  const widgetExecution = useDashboardWidgetExecution();
  const connectionRuntimeStore = useConnectionRuntimeStore();
  const runtimeDataStore = useRuntimeDataStore();
  const effectiveState = useMemo(
    () =>
      resolveReferenceBackedWidgetState({
        instanceTitle,
        props,
        resolvedInputs,
      }),
    [instanceTitle, props, resolvedInputs],
  );
  const normalizedProps = useMemo(
    () => normalizeConnectionStreamQueryProps(effectiveState.props as ConnectionStreamQueryWidgetProps),
    [effectiveState.props],
  );
  const unresolvedReferenceMessage = useMemo(() => {
    if (hasPendingConnectionStreamReferenceValues({ props: normalizedProps, resolvedInputs })) {
      return "Waiting for referenced value.";
    }

    return null;
  }, [normalizedProps, resolvedInputs]);
  const connectionType = normalizedProps.connectionRef?.typeId
    ? getConnectionTypeById(normalizedProps.connectionRef.typeId)
    : undefined;
  const queryModel = normalizedProps.queryModelId
    ? connectionType?.queryModels?.find((model) => model.id === normalizedProps.queryModelId)
    : undefined;
  const runtimeQueryModel = useMemo<ConnectionQueryModel | undefined>(
    () =>
      widgetExecution?.executionSurface === "public-workspace"
        ? (queryModel ??
            (normalizedProps.queryModelId
              ? ({
                  id: normalizedProps.queryModelId,
                  stream: {
                    transport: "websocket",
                  },
                  timeRangeAware: true,
                  supportsVariables: true,
                } as ConnectionQueryModel)
              : undefined))
        : queryModel,
    [normalizedProps.queryModelId, queryModel, widgetExecution?.executionSurface],
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
  const request = useMemo(
    () =>
      buildConnectionStreamQueryRequest(
        normalizedProps,
        dashboardState,
        runtimeQueryModel,
        widgetExecution?.executionSurface,
      ),
    [dashboardState, normalizedProps, runtimeQueryModel, widgetExecution?.executionSurface],
  );
  const validationError = useMemo(
    () =>
      buildConnectionStreamQueryValidationError({
        props: normalizedProps,
        queryModel: runtimeQueryModel,
        executionSurface: widgetExecution?.executionSurface,
      }),
    [normalizedProps, runtimeQueryModel, widgetExecution?.executionSurface],
  );
  const effectiveValidationError = unresolvedReferenceMessage ?? validationError;
  const publicExecution = instanceId
    ? widgetExecution?.getWidgetInstance(instanceId)?.publicExecution
    : undefined;
  const publicExecutionKey =
    widgetExecution?.executionSurface === "public-workspace"
      ? publicExecution?.streamUrl?.trim() || undefined
      : undefined;
  const executionKey = useMemo(
    () =>
      buildConnectionStreamQueryExecutionKey({
        instanceId,
        props: normalizedProps,
        queryModel: runtimeQueryModel,
        request,
        publicExecutionKey,
        validationError: effectiveValidationError,
      }),
    [
      effectiveValidationError,
      instanceId,
      normalizedProps,
      publicExecutionKey,
      request,
      runtimeQueryModel,
    ],
  );
  const runtimeKey = useMemo(
    () =>
      request
        ? buildConnectionStreamQueryRuntimeKey({
            executionSurface: widgetExecution?.executionSurface,
            publicExecutionKey,
            request,
          })
        : undefined,
    [publicExecutionKey, request, widgetExecution?.executionSurface],
  );
  const runtimeEntry = useThrottledConnectionRuntimeEntry(runtimeKey, 250);
  const runtimeEntryState = runtimeEntry?.runtimeState;
  const normalizedRuntimeState = useMemo(
    () => normalizeConnectionStreamQueryRuntimeState(runtimeEntryState ?? runtimeState),
    [runtimeEntryState, runtimeState],
  );
  const runtimeRef = useRef<ConnectionStreamQueryRuntimeState | null>(normalizedRuntimeState);
  const onRuntimeStateChangeRef = useRef(onRuntimeStateChange);
  const publicExecutionSignature = useMemo(
    () => stableJsonStringify(publicExecution ?? null),
    [publicExecution],
  );
  const streamSessionConfigKey = useMemo(
    () =>
      stableJsonStringify({
        executionKey,
        executionSurface: widgetExecution?.executionSurface,
        publicExecutionSignature,
        runtimeKey,
      }),
    [executionKey, publicExecutionSignature, runtimeKey, widgetExecution?.executionSurface],
  );

  useEffect(() => {
    if (!import.meta.env.DEV || !STREAM_QUERY_DEBUG_LOGS_ENABLED) {
      return;
    }

    console.log("[stream-widget-resolution]", {
      instanceId,
      propsQuery: props.query,
      resolvedInputIds: Object.keys(resolvedInputs ?? {}).sort(),
      resolvedInputsSummary: summarizeStreamResolvedInputs(resolvedInputs),
      effectiveQuery: (effectiveState.props as ConnectionStreamQueryWidgetProps).query,
      normalizedQuery: normalizedProps.query,
      unresolvedReferenceMessage,
      validationError,
      queryModelId: normalizedProps.queryModelId,
      hasRuntimeQueryModel: Boolean(runtimeQueryModel),
      queryModelStream: runtimeQueryModel?.stream,
    });
  }, [
    effectiveState.props,
    instanceId,
    normalizedProps,
    props.query,
    resolvedInputs,
    runtimeQueryModel,
    unresolvedReferenceMessage,
    validationError,
  ]);

  useEffect(() => {
    if (!import.meta.env.DEV || !STREAM_QUERY_DEBUG_LOGS_ENABLED) {
      return;
    }

    console.log("[stream-request-key]", {
      instanceId,
      request,
      runtimeKey: summarizeStreamKey(runtimeKey),
      executionKey: summarizeStreamKey(executionKey),
      streamSessionConfigKey: summarizeStreamKey(streamSessionConfigKey),
      publicExecutionKey,
      executionSurface: widgetExecution?.executionSurface,
    });
  }, [
    executionKey,
    instanceId,
    publicExecutionKey,
    request,
    runtimeKey,
    streamSessionConfigKey,
    widgetExecution?.executionSurface,
  ]);

  useEffect(() => {
    runtimeRef.current = normalizedRuntimeState;
  }, [normalizedRuntimeState]);

  useEffect(() => {
    onRuntimeStateChangeRef.current = onRuntimeStateChange;
  }, [onRuntimeStateChange]);

  useEffect(() => {
    const publishRuntimeState = onRuntimeStateChangeRef.current;
    const hasExecutableConfig =
      widgetExecution?.executionSurface === "public-workspace"
        ? Boolean(normalizedProps.queryModelId)
        : Boolean(normalizedProps.connectionRef?.id && normalizedProps.queryModelId);

    if (!publishRuntimeState && !connectionRuntimeStore) {
      return undefined;
    }

    const publishState = (state: Record<string, unknown>) => {
      if (import.meta.env.DEV && STREAM_QUERY_DEBUG_LOGS_ENABLED) {
        console.log("[stream-runtime-publish]", {
          instanceId,
          runtimeKey: summarizeStreamKey(runtimeKey),
          status: state.status,
          streamStatus: state.streamStatus,
          rowCount: Array.isArray(state.rows) ? state.rows.length : undefined,
          columnCount: Array.isArray(state.columns) ? state.columns.length : undefined,
          hasRuntimeDataRef: Boolean(state.runtimeDataRef),
          sourceRunId: state.sourceRunId,
        });
      }

      if (runtimeKey && connectionRuntimeStore) {
        connectionRuntimeStore.publishStreamState({
          key: runtimeKey,
          ownerId: instanceId,
          runtimeState: state,
        });
      }

      publishRuntimeState?.(state);
    };

    const logEffectDecision = (
      branch:
        | "waiting"
        | "validation-error"
        | "idle-no-request"
        | "acquire-store"
        | "direct-session",
    ) => {
      if (!import.meta.env.DEV || !STREAM_QUERY_DEBUG_LOGS_ENABLED) {
        return;
      }

      console.log("[stream-effect-decision]", {
        instanceId,
        hasPublishRuntimeState: Boolean(publishRuntimeState),
        hasConnectionRuntimeStore: Boolean(connectionRuntimeStore),
        hasExecutableConfig,
        unresolvedReferenceMessage,
        validationError,
        hasRequest: Boolean(request),
        hasRuntimeQueryModel: Boolean(runtimeQueryModel),
        runtimeKey: summarizeStreamKey(runtimeKey),
        branch,
      });
    };

    if (unresolvedReferenceMessage) {
      logEffectDecision("waiting");
      publishState(
        buildConnectionStreamQueryLifecycleFrame({
          props: normalizedProps,
          status: "idle",
          error: unresolvedReferenceMessage,
          errorCode: "waiting-for-reference",
        }) as unknown as Record<string, unknown>,
      );
      return undefined;
    }

    if (validationError) {
      logEffectDecision("validation-error");
      publishState(
        buildConnectionStreamQueryLifecycleFrame({
          props: normalizedProps,
          status: hasExecutableConfig ? "error" : "idle",
          error: hasExecutableConfig ? validationError : undefined,
        }) as unknown as Record<string, unknown>,
      );
      return undefined;
    }

    if (!request || !runtimeQueryModel) {
      logEffectDecision("idle-no-request");
      publishState(
        buildConnectionStreamQueryLifecycleFrame({
          props: normalizedProps,
          status: "idle",
        }) as unknown as Record<string, unknown>,
      );
      return undefined;
    }

    let session: ReturnType<typeof createConnectionStreamQueryWidgetRuntimeSession> | undefined;
    let storeHandle: ConnectionRuntimeSessionHandle | undefined;

    try {
      if (runtimeKey && connectionRuntimeStore) {
        logEffectDecision("acquire-store");
        storeHandle = connectionRuntimeStore.acquireStreamSession({
          key: runtimeKey,
          ownerId: instanceId ?? runtimeKey,
            onRuntimeStateChange: (nextRuntimeState) => {
              runtimeRef.current = normalizeConnectionStreamQueryRuntimeState(nextRuntimeState);
              if (import.meta.env.DEV && STREAM_QUERY_DEBUG_LOGS_ENABLED) {
                console.log("[stream-runtime-publish]", {
                  instanceId,
                  runtimeKey: summarizeStreamKey(runtimeKey),
                  status: nextRuntimeState.status,
                  streamStatus: nextRuntimeState.streamStatus,
                  rowCount: Array.isArray(nextRuntimeState.rows)
                    ? nextRuntimeState.rows.length
                    : undefined,
                  columnCount: Array.isArray(nextRuntimeState.columns)
                    ? nextRuntimeState.columns.length
                    : undefined,
                  hasRuntimeDataRef: Boolean(nextRuntimeState.runtimeDataRef),
                  sourceRunId: nextRuntimeState.sourceRunId,
                });
              }
              onRuntimeStateChangeRef.current?.(nextRuntimeState);
            },
          start: () =>
            createConnectionStreamQueryWidgetRuntimeSession({
              subscriptionKey: runtimeKey,
              request,
              props: normalizedProps,
              queryModel: runtimeQueryModel,
              executionSurface: widgetExecution?.executionSurface,
              publicExecution,
              initialRuntimeState: runtimeRef.current,
              sourceWidgetId: instanceId,
              onRuntimeStateChange: (nextRuntimeState) => {
                runtimeRef.current = nextRuntimeState;
                connectionRuntimeStore.publishStreamState({
                  key: runtimeKey,
                  ownerId: instanceId,
                  runtimeState: nextRuntimeState as unknown as Record<string, unknown>,
                });
              },
              options: {
                runtimeDataStore,
              },
            }),
        });
      } else {
        logEffectDecision("direct-session");
        session = createConnectionStreamQueryWidgetRuntimeSession({
          subscriptionKey: runtimeKey ?? executionKey,
          request,
          props: normalizedProps,
          queryModel: runtimeQueryModel,
          executionSurface: widgetExecution?.executionSurface,
          publicExecution,
          initialRuntimeState: runtimeRef.current,
          sourceWidgetId: instanceId,
          onRuntimeStateChange: (nextRuntimeState) => {
            runtimeRef.current = nextRuntimeState;
            onRuntimeStateChangeRef.current?.(nextRuntimeState as unknown as Record<string, unknown>);
          },
          options: {
            runtimeDataStore,
          },
        });
      }
    } catch (error) {
      publishState(
        buildConnectionStreamQueryLifecycleFrame({
          props: normalizedProps,
          status: "error",
          error: error instanceof Error ? error.message : "Connection stream could not start.",
        }) as unknown as Record<string, unknown>,
      );
      return undefined;
    }

    return () => {
      storeHandle?.release();
      session?.close();
    };
  }, [
    connectionRuntimeStore,
    instanceId,
    runtimeDataStore,
    streamSessionConfigKey,
    unresolvedReferenceMessage,
    validationError,
    widgetExecution?.executionSurface,
  ]);

  const streamStatus = normalizedRuntimeState?.streamStatus ?? "idle";
  const frameStatus = normalizedRuntimeState?.status ?? "idle";
  const runtimeDataRef = getRuntimeDataRef(runtimeEntryState ?? runtimeState);
  const rowCount = runtimeDataRef?.rowCount ?? normalizedRuntimeState?.rows.length ?? 0;
  const columnCount = normalizedRuntimeState?.columns.length ?? 0;
  const hasExecutableConfig =
    widgetExecution?.executionSurface === "public-workspace"
      ? Boolean(normalizedProps.queryModelId)
      : Boolean(normalizedProps.connectionRef?.id && normalizedProps.queryModelId);
  const errorMessage =
    normalizedRuntimeState?.error ??
    (validationError && hasExecutableConfig
      ? validationError
      : undefined);
  const reconnectAttemptCount = normalizedRuntimeState?.reconnectAttemptCount ?? 0;
  const nextRetryAtMs = normalizedRuntimeState?.nextRetryAtMs;
  const lastDisconnectReason = normalizedRuntimeState?.lastDisconnectReason;
  const degradedMessage =
    streamStatus === "reconnecting"
      ? [
          lastDisconnectReason ?? "Connection stream disconnected.",
          reconnectAttemptCount > 0 ? `Retry ${reconnectAttemptCount} scheduled.` : null,
          typeof nextRetryAtMs === "number"
            ? `Next retry ${new Date(nextRetryAtMs).toLocaleTimeString()}.`
            : null,
        ]
          .filter(Boolean)
          .join(" ")
      : streamStatus === "closed" && lastDisconnectReason
        ? lastDisconnectReason
        : undefined;
  const StreamIcon =
    frameStatus === "error"
      ? AlertTriangle
      : streamStatus === "closed"
        ? WifiOff
        : isStreamingActive(streamStatus)
          ? Wifi
          : DatabaseZap;

  return (
    <div className="flex h-full min-h-[160px] flex-col justify-between gap-4 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/50 text-muted-foreground">
          {streamStatus === "connecting" || streamStatus === "reconnecting" ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <StreamIcon
              className={[
                "h-5 w-5",
                frameStatus === "error"
                  ? "text-danger"
                  : streamStatus === "live"
                    ? "text-success"
                    : "text-muted-foreground",
              ].join(" ")}
            />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">
            {queryModel?.label ?? normalizedProps.queryModelId ?? "Select stream path"}
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {connectionType?.title ?? normalizedProps.connectionRef?.typeId ?? "No connection selected"}
          </div>
        </div>
      </div>

      {frameStatus === "error" && errorMessage ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/30 bg-danger/8 px-3 py-2 text-xs text-danger">
          {errorMessage}
        </div>
      ) : degradedMessage ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {degradedMessage}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Stream</div>
            <div className="mt-1 truncate text-sm font-semibold text-foreground">
              {formatStatus(streamStatus)}
            </div>
          </div>
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Rows</div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {rowCount.toLocaleString()}
            </div>
          </div>
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Cols</div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {columnCount.toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
