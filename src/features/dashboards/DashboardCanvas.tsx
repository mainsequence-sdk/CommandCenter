import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ComponentType } from "react";

import { useAuthStore } from "@/auth/auth-store";
import { hasAllPermissions } from "@/auth/permissions";
import {
  DashboardControlsProvider,
  DashboardDataControls,
  DashboardRefreshProgressLine,
} from "@/dashboards/DashboardControls";
import { resolveDashboardLayout } from "@/dashboards/layout";
import type {
  DashboardDefinition,
  ResolvedDashboardWidgetInstance,
  ResolvedDashboardWidgetLayout,
} from "@/dashboards/types";
import { getWidgetById } from "@/app/registry";
import {
  LockedWidgetFrame,
  MissingWidgetFrame,
  WidgetFrame,
} from "@/widgets/shared/widget-frame";
import { WidgetSettingsDialog } from "@/widgets/shared/widget-settings";

function layoutToStyle(layout: ResolvedDashboardWidgetLayout): CSSProperties {
  return {
    gridColumn: `${layout.x + 1} / span ${layout.w}`,
    gridRow: `${layout.y + 1} / span ${layout.h}`,
  };
}

interface WidgetInstanceOverride {
  props?: Record<string, unknown>;
  title?: string | null;
}

function applyWidgetOverride(
  instance: ResolvedDashboardWidgetInstance,
  override?: WidgetInstanceOverride,
) {
  if (!override) {
    return instance;
  }

  return {
    ...instance,
    title:
      "title" in override
        ? (override.title ?? undefined)
        : instance.title,
    props:
      "props" in override
        ? override.props
        : instance.props,
  };
}

export function DashboardCanvas({ dashboard }: { dashboard: DashboardDefinition }) {
  const permissions = useAuthStore((state) => state.session?.user.permissions ?? []);
  const [widgetOverrides, setWidgetOverrides] = useState<Record<string, WidgetInstanceOverride>>(
    {},
  );
  const [settingsInstanceId, setSettingsInstanceId] = useState<string | null>(null);
  const resolvedDashboard = useMemo(
    () => resolveDashboardLayout(dashboard),
    [dashboard],
  );
  const renderedWidgets = useMemo(
    () =>
      resolvedDashboard.widgets.map((instance) =>
        applyWidgetOverride(instance, widgetOverrides[instance.id]),
      ),
    [resolvedDashboard.widgets, widgetOverrides],
  );
  const settingsInstance = useMemo(
    () => renderedWidgets.find((instance) => instance.id === settingsInstanceId) ?? null,
    [renderedWidgets, settingsInstanceId],
  );
  const settingsWidget = settingsInstance ? getWidgetById(settingsInstance.widgetId) : null;

  useEffect(() => {
    setWidgetOverrides({});
    setSettingsInstanceId(null);
  }, [dashboard.id]);

  useEffect(() => {
    if (
      settingsInstanceId &&
      !renderedWidgets.some((instance) => instance.id === settingsInstanceId)
    ) {
      setSettingsInstanceId(null);
    }
  }, [renderedWidgets, settingsInstanceId]);

  return (
    <DashboardControlsProvider key={dashboard.id} controls={dashboard.controls}>
      <div className="relative">
        <DashboardRefreshProgressLine />
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
            {renderedWidgets.map((instance) => {
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
                <WidgetFrame
                  key={instance.id}
                  widget={widget}
                  instance={instance}
                  style={style}
                  onOpenSettings={() => {
                    setSettingsInstanceId(instance.id);
                  }}
                >
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
        {settingsInstance && settingsWidget ? (
          <WidgetSettingsDialog
            open
            widget={settingsWidget}
            instance={settingsInstance}
            persistenceNote="Changes apply only to the current page session."
            onClose={() => {
              setSettingsInstanceId(null);
            }}
            onSave={({ title, props }) => {
              setWidgetOverrides((current) => ({
                ...current,
                [settingsInstance.id]: {
                  title: title ?? null,
                  props,
                },
              }));
            }}
          />
        ) : null}
      </div>
    </DashboardControlsProvider>
  );
}
