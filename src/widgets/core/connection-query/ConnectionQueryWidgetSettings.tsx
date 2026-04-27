import { getConnectionTypeById } from "@/app/registry";
import { ConnectionQuerySettingsSurface } from "@/connections/ConnectionQuerySettingsSurface";
import { useDashboardWidgetRegistry } from "@/dashboards/DashboardWidgetRegistry";
import { WidgetSchemaForm } from "@/widgets/shared/widget-schema-form";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import type { ConnectionQueryWidgetProps } from "./connectionQueryModel";

type Props = WidgetSettingsComponentProps<ConnectionQueryWidgetProps>;

export function ConnectionQueryWidgetSettings({
  widget,
  instanceId,
  instanceTitle,
  draftProps,
  draftPresentation,
  editable,
  controllerContext,
  onDraftPropsChange,
  onDraftPresentationChange,
}: Props) {
  const widgetRegistry = useDashboardWidgetRegistry();
  const currentWidget = widgetRegistry.find((entry) => entry.id === instanceId) ?? null;
  const selectedConnectionType = draftProps.connectionRef?.typeId
    ? getConnectionTypeById(draftProps.connectionRef.typeId)
    : undefined;
  const useTypedQueryEditor = Boolean(selectedConnectionType?.queryEditor);

  return (
    <ConnectionQuerySettingsSurface
      value={draftProps}
      onChange={onDraftPropsChange}
      editable={editable}
      publishPreviewRuntimeStateToInstanceId={instanceId}
      runtimeState={currentWidget?.runtimeState}
      runtimeStatusTitle="Current source runtime"
      runtimeStatusDescription="This is the last live runtime state published by this source widget while you edit the draft query."
      runtimeStatusEmptyMessage="This source has not published a live dataset yet."
      sourceTitle={instanceTitle}
      connectionPathSettings={useTypedQueryEditor ? undefined : (
        <WidgetSchemaForm
          widget={widget}
          draftProps={draftProps}
          onDraftPropsChange={onDraftPropsChange}
          draftPresentation={draftPresentation}
          onDraftPresentationChange={onDraftPresentationChange}
          editable={editable}
          context={controllerContext}
        />
      )}
      showConnectionPicker
      showQueryEditor={useTypedQueryEditor}
      resultDescription="Preview of the normalized widget runtime frame."
    />
  );
}
