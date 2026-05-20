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
import { resolveReferenceBackedWidgetState } from "@/dashboards/widget-instance-references";
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
        validationError,
      }),
    [instanceId, normalizedProps, publicExecutionKey, request, runtimeQueryModel, validationError],
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
      if (runtimeKey && connectionRuntimeStore) {
        connectionRuntimeStore.publishStreamState({
          key: runtimeKey,
          ownerId: instanceId,
          runtimeState: state,
        });
      }

      publishRuntimeState?.(state);
    };

    if (validationError) {
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
        storeHandle = connectionRuntimeStore.acquireStreamSession({
          key: runtimeKey,
          ownerId: instanceId ?? runtimeKey,
          onRuntimeStateChange: (nextRuntimeState) => {
            runtimeRef.current = normalizeConnectionStreamQueryRuntimeState(nextRuntimeState);
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
