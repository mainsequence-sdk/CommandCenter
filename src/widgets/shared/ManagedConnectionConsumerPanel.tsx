import { useMemo } from "react";

import { getConnectionTypeById, getWidgetById } from "@/app/registry";
import { ConnectionQuerySettingsSurface } from "@/connections/ConnectionQuerySettingsSurface";
import { resolveManagedConnectionQuerySource } from "@/connections/managedConnectionQuerySource";
import { useDashboardWidgetRegistry } from "@/dashboards/DashboardWidgetRegistry";
import { resolveWidgetInstancePresentation } from "@/widgets/shared/widget-schema";
import { WidgetSchemaForm } from "@/widgets/shared/widget-schema-form";
import type {
  AnyManagedConnectionConsumerAdapter,
} from "@/widgets/shared/managed-connection-consumer";
import type { ConnectionQueryWidgetProps } from "@/widgets/core/connection-query/connectionQueryModel";
import type { WidgetDefinition } from "@/widgets/types";

export function ManagedConnectionConsumerPanel({
  adapter,
  draftProps,
  editable,
  instanceId,
  instanceTitle,
  widgetTitle,
  onDraftPropsChange,
}: {
  adapter: AnyManagedConnectionConsumerAdapter;
  draftProps: Record<string, unknown>;
  editable: boolean;
  instanceId: string;
  instanceTitle?: string;
  widgetTitle: string;
  onDraftPropsChange: (nextProps: Record<string, unknown>) => void;
}) {
  const widgetRegistry = useDashboardWidgetRegistry();
  const connectionQueryWidgetDefinition = useMemo(
    () => getWidgetById("connection-query") as WidgetDefinition<ConnectionQueryWidgetProps> | undefined,
    [],
  );
  const managedConnectionSource = useMemo(
    () => resolveManagedConnectionQuerySource(widgetRegistry, instanceId),
    [instanceId, widgetRegistry],
  );
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
  const useTypedQueryEditor = Boolean(selectedConnectionType?.queryEditor);
  const resolvedConnectionPresentation = useMemo(
    () =>
      connectionQueryWidgetDefinition
        ? resolveWidgetInstancePresentation(
            connectionQueryWidgetDefinition,
            managedConnectionSource?.presentation ?? embeddedConnectionPresentation,
          )
        : embeddedConnectionPresentation ?? {},
    [
      connectionQueryWidgetDefinition,
      embeddedConnectionPresentation,
      managedConnectionSource?.presentation,
    ],
  );
  const normalizedWidgetTitle = widgetTitle.trim() || "Widget";
  const consumerLabel = normalizedWidgetTitle.toLowerCase();

  if (!connectionQueryWidgetDefinition) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/35 bg-danger/8 px-4 py-3 text-sm text-danger">
        The connection-query widget definition is unavailable, so this managed connection cannot be
        configured here.
      </div>
    );
  }

  return (
    <ConnectionQuerySettingsSurface
      value={embeddedConnectionQueryProps}
      onChange={(nextEmbeddedConnectionQuery) => {
        const nextProps = adapter.setEmbeddedConnectionQuery(
          adapter.setSourceMode(draftProps, adapter.connectionMode),
          nextEmbeddedConnectionQuery,
        );
        onDraftPropsChange(nextProps);
      }}
      editable={editable}
      publishPreviewRuntimeStateToInstanceId={managedConnectionSource?.id}
      runtimeState={managedConnectionSource?.runtimeState ?? undefined}
      runtimeStatusTitle="Managed source runtime"
      runtimeStatusDescription={`This ${consumerLabel} still renders from resolved ${adapter.sourceInputId}. Applying connection changes creates or updates the hidden connection-query source and keeps ${adapter.sourceInputId} bound to its dataset output.`}
      runtimeStatusEmptyMessage={
        managedConnectionSource
          ? "The managed source exists, but it has not published a live dataset yet."
          : "Apply connection changes to create the hidden source widget, then test or run the query."
      }
      sourceTitle={
        managedConnectionSource?.title ??
        adapter.buildManagedSourceTitle({
          ownerTitle: instanceTitle,
          widgetTitle: normalizedWidgetTitle,
        })
      }
      connectionPathSettings={useTypedQueryEditor ? undefined : (
        <WidgetSchemaForm
          widget={connectionQueryWidgetDefinition}
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
      resultDescription={`Preview of the normalized source frame this ${consumerLabel} will receive through ${adapter.sourceInputId}.`}
    />
  );
}
