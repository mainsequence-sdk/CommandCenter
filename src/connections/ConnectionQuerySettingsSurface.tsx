import { getConnectionTypeById } from "@/app/registry";
import { useDashboardControls } from "@/dashboards/DashboardControls";

import {
  ConnectionQueryWorkbench,
  type ConnectionQueryWorkbenchProps,
} from "@/connections/ConnectionQueryWorkbench";
import { ConnectionQueryRuntimeStatusCard } from "@/connections/ConnectionQueryRuntimeStatusCard";
import type { ConnectionQueryWidgetProps } from "@/widgets/core/connection-query/connectionQueryModel";

export interface ConnectionQuerySettingsSurfaceProps
  extends Omit<
    ConnectionQueryWorkbenchProps,
    "dashboardState" | "dashboardTimeRangeLabel" | "fixedRangeFallback"
  > {
  runtimeState?: unknown;
  runtimeStatusTitle?: string;
  runtimeStatusDescription?: string;
  runtimeStatusEmptyMessage?: string;
  sourceTitle?: string;
  value: ConnectionQueryWidgetProps;
  resolvedValue?: ConnectionQueryWidgetProps;
}

export function ConnectionQuerySettingsSurface({
  runtimeState,
  runtimeStatusTitle = "Current runtime",
  runtimeStatusDescription,
  runtimeStatusEmptyMessage,
  sourceTitle,
  value,
  resolvedValue,
  ...workbenchProps
}: ConnectionQuerySettingsSurfaceProps) {
  const dashboardControls = useDashboardControls();
  const selectedConnectionType = value.connectionRef?.typeId
    ? getConnectionTypeById(value.connectionRef.typeId)
    : undefined;
  const resolvedRunButtonLabel =
    workbenchProps.runButtonLabel ??
    selectedConnectionType?.authoringContract?.exploreRunButtonLabel ??
    "Run query";

  return (
    <div className="space-y-6">
      <ConnectionQueryRuntimeStatusCard
        title={runtimeStatusTitle}
        description={runtimeStatusDescription}
        runtimeState={runtimeState}
        draftProps={value}
        sourceTitle={sourceTitle}
        emptyMessage={runtimeStatusEmptyMessage}
      />

      <ConnectionQueryWorkbench
        {...workbenchProps}
        value={value}
        resolvedValue={resolvedValue}
        runButtonLabel={resolvedRunButtonLabel}
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
      />
    </div>
  );
}
