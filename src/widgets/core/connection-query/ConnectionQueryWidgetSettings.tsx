import { ConnectionQueryWorkbench } from "@/connections/ConnectionQueryWorkbench";
import { useDashboardControls } from "@/dashboards/DashboardControls";
import { WidgetSchemaForm } from "@/widgets/shared/widget-schema-form";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import type { ConnectionQueryWidgetProps } from "./connectionQueryModel";

type Props = WidgetSettingsComponentProps<ConnectionQueryWidgetProps>;

export function ConnectionQueryWidgetSettings({
  widget,
  draftProps,
  draftPresentation,
  editable,
  controllerContext,
  onDraftPropsChange,
  onDraftPresentationChange,
}: Props) {
  const dashboardControls = useDashboardControls();

  return (
    <ConnectionQueryWorkbench
      value={draftProps}
      onChange={onDraftPropsChange}
      editable={editable}
      dashboardState={{
        timeRangeKey: dashboardControls.timeRangeKey,
        rangeStartMs: dashboardControls.rangeStartMs,
        rangeEndMs: dashboardControls.rangeEndMs,
        refreshIntervalMs: dashboardControls.refreshIntervalMs,
      }}
      dashboardTimeRangeLabel={dashboardControls.timeRangeLabel}
      fixedRangeFallback={{
        rangeStartMs: dashboardControls.rangeStartMs,
        rangeEndMs: dashboardControls.rangeEndMs,
      }}
      connectionPathSettings={
        <WidgetSchemaForm
          widget={widget}
          draftProps={draftProps}
          onDraftPropsChange={onDraftPropsChange}
          draftPresentation={draftPresentation}
          onDraftPresentationChange={onDraftPresentationChange}
          editable={editable}
          context={controllerContext}
        />
      }
      showConnectionPicker
      showQueryEditor={false}
      runButtonLabel="Test"
      resultDescription="Preview of the normalized widget runtime frame."
    />
  );
}
