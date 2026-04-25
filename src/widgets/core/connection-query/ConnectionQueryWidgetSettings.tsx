import { ConnectionQueryWorkbench } from "@/connections/ConnectionQueryWorkbench";
import { useDashboardControls } from "@/dashboards/DashboardControls";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import type { ConnectionQueryWidgetProps } from "./connectionQueryModel";

type Props = WidgetSettingsComponentProps<ConnectionQueryWidgetProps>;

export function ConnectionQueryWidgetSettings({
  draftProps,
  editable,
  onDraftPropsChange,
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
      showConnectionPicker
      runButtonLabel="Test"
      resultDescription="Preview of the normalized widget runtime frame."
    />
  );
}
