import { useMemo } from "react";

import { getConnectionTypeById, getWidgetById } from "@/app/registry";
import { resolveConnectionStreamAuthoringQueryModels } from "@/connections/connectionAuthoringContract";
import { ConnectionQuerySettingsSurface } from "@/connections/ConnectionQuerySettingsSurface";
import { resolveManagedConnectionQuerySource } from "@/connections/managedConnectionQuerySource";
import { isConnectionQueryModelStreamable } from "@/connections/types";
import { useDashboardWidgetRegistry } from "@/dashboards/DashboardWidgetRegistry";
import { resolveWidgetInstancePresentation } from "@/widgets/shared/widget-schema";
import { WidgetSchemaForm } from "@/widgets/shared/widget-schema-form";
import type {
  AnyManagedConnectionConsumerAdapter,
  ManagedConnectionConsumerSourceMode,
  ManagedConnectionEmbeddedSourceProps,
} from "@/widgets/shared/managed-connection-consumer";
import {
  isManagedConnectionConsumerStreamMode,
  resolveManagedConnectionConsumerInputId,
  resolveManagedConnectionConsumerOutputId,
  resolveManagedConnectionConsumerSourceWidgetId,
} from "@/widgets/shared/managed-connection-consumer";
import type { ConnectionQueryWidgetProps } from "@/widgets/core/connection-query/connectionQueryModel";
import { ConnectionStreamQueryWidgetSettings } from "@/widgets/core/connection-stream-query/ConnectionStreamQueryWidgetSettings";
import type { ConnectionStreamQueryWidgetProps } from "@/widgets/core/connection-stream-query/connectionStreamQueryModel";
import type { WidgetDefinition } from "@/widgets/types";

export function ManagedConnectionConsumerPanel({
  adapter,
  draftProps,
  editable,
  instanceId,
  instanceTitle,
  onPreviewRuntimeStateChange,
  widgetTitle,
  onDraftPropsChange,
  previewRuntimeState,
}: {
  adapter: AnyManagedConnectionConsumerAdapter;
  draftProps: Record<string, unknown>;
  editable: boolean;
  instanceId: string;
  instanceTitle?: string;
  onPreviewRuntimeStateChange?: (runtimeState: Record<string, unknown> | undefined) => void;
  widgetTitle: string;
  onDraftPropsChange: (nextProps: Record<string, unknown>) => void;
  previewRuntimeState?: Record<string, unknown>;
}) {
  const widgetRegistry = useDashboardWidgetRegistry();
  const sourceMode = adapter.getSourceMode(draftProps);
  const sourceInputId = resolveManagedConnectionConsumerInputId(adapter, draftProps);
  const sourceOutputId = resolveManagedConnectionConsumerOutputId(adapter, draftProps);
  const sourceWidgetId = resolveManagedConnectionConsumerSourceWidgetId(adapter, draftProps);
  const isStreamConnectionMode = isManagedConnectionConsumerStreamMode(adapter, sourceMode);
  const connectionSourceWidgetDefinition = useMemo(
    () => getWidgetById(sourceWidgetId) as WidgetDefinition<ManagedConnectionEmbeddedSourceProps> | undefined,
    [sourceWidgetId],
  );
  const connectionQueryWidgetDefinition = connectionSourceWidgetDefinition as
    | WidgetDefinition<ConnectionQueryWidgetProps>
    | undefined;
  const connectionStreamWidgetDefinition = connectionSourceWidgetDefinition as
    | WidgetDefinition<ConnectionStreamQueryWidgetProps>
    | undefined;
  const managedConnectionSource = useMemo(
    () => resolveManagedConnectionQuerySource(widgetRegistry, instanceId),
    [instanceId, widgetRegistry],
  );
  const matchingManagedConnectionSource =
    managedConnectionSource?.widgetId === sourceWidgetId ? managedConnectionSource : null;
  const embeddedConnectionQueryProps = useMemo(
    () => adapter.getEmbeddedConnectionQuery(draftProps),
    [adapter, draftProps],
  );
  const embeddedConnectionPresentation = useMemo(
    () => adapter.getEmbeddedConnectionPresentation(draftProps),
    [adapter, draftProps],
  );
  const selectedConnectionType = embeddedConnectionQueryProps.connectionRef?.typeId
    ? getConnectionTypeById(embeddedConnectionQueryProps.connectionRef.typeId)
    : undefined;
  const streamQueryModels = useMemo(
    () =>
      resolveConnectionStreamAuthoringQueryModels({
        connectionType: selectedConnectionType,
      }),
    [selectedConnectionType],
  );
  const selectedQueryModel = embeddedConnectionQueryProps.queryModelId
    ? streamQueryModels.find((model) => model.id === embeddedConnectionQueryProps.queryModelId)
    : undefined;
  const canSwitchToStreamConnection =
    Boolean(adapter.streamConnectionMode) &&
    (!embeddedConnectionQueryProps.queryModelId ||
      isConnectionQueryModelStreamable(selectedQueryModel));
  const useTypedQueryEditor = Boolean(selectedConnectionType?.queryEditor);
  const resolvedConnectionPresentation = useMemo(
    () =>
      connectionSourceWidgetDefinition
        ? resolveWidgetInstancePresentation(
            connectionSourceWidgetDefinition,
            matchingManagedConnectionSource?.presentation ?? embeddedConnectionPresentation,
          )
        : embeddedConnectionPresentation ?? {},
    [
      connectionSourceWidgetDefinition,
      embeddedConnectionPresentation,
      matchingManagedConnectionSource?.presentation,
    ],
  );
  const normalizedWidgetTitle = widgetTitle.trim() || "Widget";
  const consumerLabel = normalizedWidgetTitle.toLowerCase();

  function changeConnectionMode(mode: ManagedConnectionConsumerSourceMode) {
    if (
      mode === adapter.streamConnectionMode &&
      !canSwitchToStreamConnection
    ) {
      return;
    }

    const propsWithMode = adapter.setSourceMode(draftProps, mode);
    const nextProps = adapter.setEmbeddedConnectionQuery(
      propsWithMode,
      adapter.getEmbeddedConnectionQuery(propsWithMode),
    );

    onDraftPropsChange(nextProps);
  }

  const modeControl = adapter.streamConnectionMode ? (
    <section className="space-y-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-4">
      <div>
        <div className="text-sm font-medium text-topbar-foreground">Connection source type</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose whether this managed source runs one-shot query requests or owns a WebSocket
          stream source.
        </p>
      </div>
      <select
        value={isStreamConnectionMode ? adapter.streamConnectionMode : adapter.connectionMode}
        disabled={!editable}
        onChange={(event) => {
          changeConnectionMode(event.target.value);
        }}
        className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value={adapter.connectionMode}>Connection Query (HTTP)</option>
        <option
          value={adapter.streamConnectionMode}
          disabled={!isStreamConnectionMode && !canSwitchToStreamConnection}
        >
          Connection Stream Query (WS)
        </option>
      </select>
      {!isStreamConnectionMode && !canSwitchToStreamConnection ? (
        <p className="text-xs text-muted-foreground">
          Select a streamable connection path before switching this managed source to WebSocket
          mode.
        </p>
      ) : null}
    </section>
  ) : null;

  if (!connectionSourceWidgetDefinition) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/35 bg-danger/8 px-4 py-3 text-sm text-danger">
        The {sourceWidgetId} widget definition is unavailable, so this managed connection cannot be
        configured here.
      </div>
    );
  }

  if (isStreamConnectionMode && connectionStreamWidgetDefinition) {
    return (
      <div className="space-y-6">
        {modeControl}
        <ConnectionStreamQueryWidgetSettings
          widget={connectionStreamWidgetDefinition}
          instanceId={matchingManagedConnectionSource?.id ?? `${instanceId}:connection-stream-draft`}
          instanceTitle={
            matchingManagedConnectionSource?.title ??
            adapter.buildManagedSourceTitle({
              ownerTitle: instanceTitle,
              widgetTitle: normalizedWidgetTitle,
            })
          }
          draftProps={embeddedConnectionQueryProps as ConnectionStreamQueryWidgetProps}
          draftPresentation={resolvedConnectionPresentation}
          editable={editable}
          controllerContext={undefined}
          onInstanceTitleChange={() => {}}
          onDraftPropsChange={(nextEmbeddedConnectionQuery) => {
            const nextProps = adapter.setEmbeddedConnectionQuery(
              adapter.setSourceMode(draftProps, adapter.streamConnectionMode ?? adapter.connectionMode),
              nextEmbeddedConnectionQuery,
            );
            onDraftPropsChange(nextProps);
          }}
          onDraftPresentationChange={(nextEmbeddedConnectionPresentation) => {
            const nextProps = adapter.setEmbeddedConnectionPresentation(
              adapter.setSourceMode(draftProps, adapter.streamConnectionMode ?? adapter.connectionMode),
              nextEmbeddedConnectionPresentation,
            );
            onDraftPropsChange(nextProps);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {modeControl}
      <ConnectionQuerySettingsSurface
        value={embeddedConnectionQueryProps as ConnectionQueryWidgetProps}
        onChange={(nextEmbeddedConnectionQuery) => {
          const nextProps = adapter.setEmbeddedConnectionQuery(
            adapter.setSourceMode(draftProps, adapter.connectionMode),
            nextEmbeddedConnectionQuery,
          );
          onDraftPropsChange(nextProps);
        }}
        editable={editable}
        publishPreviewRuntimeStateToInstanceId={matchingManagedConnectionSource?.id}
        runtimeState={
          matchingManagedConnectionSource?.runtimeState ??
          previewRuntimeState ??
          undefined
        }
        runtimeStatusTitle="Managed source runtime"
        runtimeStatusDescription={`This ${consumerLabel} still renders from resolved ${sourceInputId}. Applying connection changes creates or updates the hidden connection source and keeps ${sourceInputId} bound to its ${sourceOutputId} output.`}
        runtimeStatusEmptyMessage={
          matchingManagedConnectionSource
            ? "The managed source exists, but it has not published a live dataset yet."
            : "Apply connection changes to create the hidden source widget, then test or run the query."
        }
        onPreviewRuntimeStateChange={onPreviewRuntimeStateChange}
        sourceTitle={
          matchingManagedConnectionSource?.title ??
          adapter.buildManagedSourceTitle({
            ownerTitle: instanceTitle,
            widgetTitle: normalizedWidgetTitle,
          })
        }
        connectionPathSettings={useTypedQueryEditor ? undefined : (
          <WidgetSchemaForm
            widget={connectionQueryWidgetDefinition!}
            draftProps={embeddedConnectionQueryProps}
            onDraftPropsChange={(nextEmbeddedConnectionQuery) => {
              const nextProps = adapter.setEmbeddedConnectionQuery(
                adapter.setSourceMode(draftProps, adapter.connectionMode),
                nextEmbeddedConnectionQuery as Record<string, unknown>,
              );
              onDraftPropsChange(nextProps);
            }}
            draftPresentation={resolvedConnectionPresentation}
            onDraftPresentationChange={(nextEmbeddedConnectionPresentation) => {
              const nextProps = adapter.setEmbeddedConnectionPresentation(
                adapter.setSourceMode(draftProps, adapter.connectionMode),
                nextEmbeddedConnectionPresentation,
              );
              onDraftPropsChange(nextProps);
            }}
            editable={editable}
            context={undefined}
          />
        )}
        showConnectionPicker
        showQueryEditor={useTypedQueryEditor}
        resultDescription={`Preview of the normalized source frame this ${consumerLabel} will receive through ${sourceInputId}.`}
      />
    </div>
  );
}
