import { useMemo } from "react";

import { getWidgetById } from "@/app/registry";
import { getConnectionTypeById } from "@/app/registry";
import { ConnectionQuerySettingsSurface } from "@/connections/ConnectionQuerySettingsSurface";
import { resolveManagedConnectionQuerySource } from "@/connections/managedConnectionQuerySource";
import { useDashboardWidgetRegistry } from "@/dashboards/DashboardWidgetRegistry";
import { resolveWidgetInstancePresentation } from "@/widgets/shared/widget-schema";
import { WidgetSchemaForm } from "@/widgets/shared/widget-schema-form";
import type { WidgetDefinition } from "@/widgets/types";

import type { ConnectionQueryWidgetProps } from "@/widgets/core/connection-query/connectionQueryModel";

import {
  resolveGraphEmbeddedConnectionQueryProps,
  type GraphWidgetProps,
} from "./graphModel";

export function GraphManagedConnectionPanel({
  draftProps,
  editable,
  instanceId,
  instanceTitle,
  onDraftPropsChange,
}: {
  draftProps: GraphWidgetProps;
  editable: boolean;
  instanceId: string;
  instanceTitle?: string;
  onDraftPropsChange: (nextProps: GraphWidgetProps) => void;
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
    () => resolveGraphEmbeddedConnectionQueryProps(draftProps),
    [draftProps],
  );
  const selectedConnectionType = embeddedConnectionQueryProps.connectionRef?.typeId
    ? getConnectionTypeById(embeddedConnectionQueryProps.connectionRef.typeId)
    : undefined;
  const useTypedQueryEditor = Boolean(selectedConnectionType?.queryEditor);
  const embeddedConnectionPresentation = useMemo(
    () =>
      connectionQueryWidgetDefinition
        ? resolveWidgetInstancePresentation(
            connectionQueryWidgetDefinition,
            managedConnectionSource?.presentation ??
              draftProps.embeddedConnectionPresentation,
          )
        : draftProps.embeddedConnectionPresentation ?? {},
    [
      connectionQueryWidgetDefinition,
      draftProps.embeddedConnectionPresentation,
      managedConnectionSource?.presentation,
    ],
  );

  if (!connectionQueryWidgetDefinition) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/35 bg-danger/8 px-4 py-3 text-sm text-danger">
        The connection-query widget definition is unavailable, so this graph-managed connection
        cannot be configured here.
      </div>
    );
  }

  return (
    <ConnectionQuerySettingsSurface
      value={embeddedConnectionQueryProps}
      onChange={(nextEmbeddedConnectionQuery) => {
        onDraftPropsChange({
          ...draftProps,
          graphSourceMode: "connection",
          embeddedConnectionQuery: nextEmbeddedConnectionQuery,
        });
      }}
      editable={editable}
      runtimeState={managedConnectionSource?.runtimeState ?? undefined}
      runtimeStatusTitle="Managed source runtime"
      runtimeStatusDescription="This graph still renders from resolved sourceData. Applying connection changes creates or updates the hidden connection-query source and keeps sourceData bound to its dataset output."
      runtimeStatusEmptyMessage={
        managedConnectionSource
          ? "The managed source exists, but it has not published a live dataset yet."
          : "Apply connection changes to create the hidden source widget, then test or run the query."
      }
      sourceTitle={
        managedConnectionSource?.title ??
        `${instanceTitle?.trim() || "Graph"} Source`
      }
      connectionPathSettings={useTypedQueryEditor ? undefined : (
        <WidgetSchemaForm
          widget={connectionQueryWidgetDefinition}
          draftProps={embeddedConnectionQueryProps}
          onDraftPropsChange={(nextEmbeddedConnectionQuery) => {
            onDraftPropsChange({
              ...draftProps,
              graphSourceMode: "connection",
              embeddedConnectionQuery: nextEmbeddedConnectionQuery,
            });
          }}
          draftPresentation={embeddedConnectionPresentation}
          onDraftPresentationChange={(nextEmbeddedConnectionPresentation) => {
            onDraftPropsChange({
              ...draftProps,
              graphSourceMode: "connection",
              embeddedConnectionPresentation: nextEmbeddedConnectionPresentation,
            });
          }}
          editable={editable}
          context={undefined}
        />
      )}
      showConnectionPicker
      showQueryEditor={useTypedQueryEditor}
      runButtonLabel="Test source"
      resultDescription="Preview of the normalized source frame this graph will receive through sourceData."
    />
  );
}
