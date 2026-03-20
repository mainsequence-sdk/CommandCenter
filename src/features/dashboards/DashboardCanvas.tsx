import { useMemo, type CSSProperties } from "react";
import type { ComponentType } from "react";

import { useAuthStore } from "@/auth/auth-store";
import { hasAllPermissions } from "@/auth/permissions";
import {
  DashboardControlsProvider,
  DashboardDataControls,
} from "@/dashboards/DashboardControls";
import { resolveDashboardLayout } from "@/dashboards/layout";
import type {
  DashboardDefinition,
  ResolvedDashboardWidgetLayout,
} from "@/dashboards/types";
import { getWidgetById } from "@/app/registry";
import {
  LockedWidgetFrame,
  MissingWidgetFrame,
  WidgetFrame,
} from "@/widgets/shared/widget-frame";

function layoutToStyle(layout: ResolvedDashboardWidgetLayout): CSSProperties {
  return {
    gridColumn: `${layout.x + 1} / span ${layout.w}`,
    gridRow: `${layout.y + 1} / span ${layout.h}`,
  };
}

export function DashboardCanvas({ dashboard }: { dashboard: DashboardDefinition }) {
  const permissions = useAuthStore((state) => state.session?.user.permissions ?? []);
  const resolvedDashboard = useMemo(
    () => resolveDashboardLayout(dashboard),
    [dashboard],
  );

  return (
    <DashboardControlsProvider key={dashboard.id} controls={dashboard.controls}>
      <div className="space-y-3">
        <DashboardDataControls controls={dashboard.controls} />
        <div
          className="grid"
          style={{
            gap: `${resolvedDashboard.grid.gap}px`,
            gridAutoRows: `${resolvedDashboard.grid.rowHeight}px`,
            gridTemplateColumns: `repeat(${resolvedDashboard.grid.columns}, minmax(0, 1fr))`,
          }}
        >
          {resolvedDashboard.widgets.map((instance) => {
            const widget = getWidgetById(instance.widgetId);
            const style = layoutToStyle(instance.layout);

            if (!widget) {
              return (
                <MissingWidgetFrame
                  key={instance.id}
                  widgetId={instance.widgetId}
                  style={style}
                />
              );
            }

            const required = [
              ...(widget.requiredPermissions ?? []),
              ...(instance.requiredPermissions ?? []),
            ];

            if (!hasAllPermissions(permissions, required)) {
              return (
                <LockedWidgetFrame
                  key={instance.id}
                  style={style}
                  title={instance.title ?? widget.title}
                  description={`Missing permissions: ${required.join(", ")}`}
                />
              );
            }

            const Component = widget.component as ComponentType<{
              widget: typeof widget;
              instanceTitle?: string;
              props: Record<string, unknown>;
            }>;

            return (
              <WidgetFrame key={instance.id} widget={widget} instance={instance} style={style}>
                <Component
                  widget={widget}
                  instanceTitle={instance.title}
                  props={instance.props ?? {}}
                />
              </WidgetFrame>
            );
          })}
        </div>
      </div>
    </DashboardControlsProvider>
  );
}
