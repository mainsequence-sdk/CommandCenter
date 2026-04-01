import type { ComponentType } from "react";

import { ArrowLeft, Save } from "lucide-react";

import { getWidgetById } from "@/app/registry";
import { hasAllPermissions } from "@/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardControlsProvider } from "@/dashboards/DashboardControls";
import { DashboardWidgetRegistryProvider } from "@/dashboards/DashboardWidgetRegistry";
import {
  removeDashboardWidget,
  updateDashboardControlsState,
  updateDashboardWidgetRuntimeState,
  updateDashboardWidgetSettings,
} from "./custom-dashboard-storage";
import { useCustomWorkspaceStudio } from "./useCustomWorkspaceStudio";
import { WidgetSettingsPanel } from "@/widgets/shared/widget-settings";
import type { WidgetInstancePresentation } from "@/widgets/types";

export function CustomWidgetSettingsPage() {
  const {
    user,
    permissions,
    dirty,
    isSaving,
    persistenceMode,
    requestedWidgetId,
    selectedDashboard,
    resolvedDashboard,
    saveWorkspaceDraft,
    openDashboardView,
    updateSelectedWorkspace,
  } = useCustomWorkspaceStudio();

  if (!user) {
    return (
      <div className="rounded-[var(--radius)] border border-border/80 bg-card/80 p-8 text-sm text-muted-foreground">
        Resolve a user session before opening widget settings.
      </div>
    );
  }

  if (!selectedDashboard || !resolvedDashboard || !requestedWidgetId) {
    return null;
  }

  const instance = selectedDashboard.widgets.find((widget) => widget.id === requestedWidgetId) ?? null;
  const widget = instance ? getWidgetById(instance.widgetId) : null;
  const backendMode = persistenceMode === "backend";

  if (!instance || !widget) {
    return (
      <div className="min-h-full overflow-auto px-4 py-4 md:px-6 md:py-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" onClick={openDashboardView}>
              <ArrowLeft className="h-4 w-4" />
              Return to dashboard
            </Button>
          </div>
          <div className="rounded-[calc(var(--radius)+4px)] border border-danger/30 bg-danger/8 px-5 py-5 text-sm text-danger shadow-[var(--shadow-panel)]">
            The requested widget instance is no longer available in this workspace.
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardControlsProvider
      key={selectedDashboard.id}
      controls={selectedDashboard.controls}
      onStateChange={(state) => {
        updateSelectedWorkspace((dashboard) => updateDashboardControlsState(dashboard, state));
      }}
    >
      <DashboardWidgetRegistryProvider widgets={resolvedDashboard.widgets}>
        <div className="relative h-full overflow-hidden">
          <div className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-hidden opacity-0">
            {resolvedDashboard.widgets.map((mountedInstance) => {
              const mountedWidget = getWidgetById(mountedInstance.widgetId);

              if (!mountedWidget) {
                return null;
              }

              const required = [
                ...(mountedWidget.requiredPermissions ?? []),
                ...(mountedInstance.requiredPermissions ?? []),
              ];

              if (!hasAllPermissions(permissions, required)) {
                return null;
              }

              const Component = mountedWidget.component as ComponentType<{
                widget: typeof mountedWidget;
                instanceTitle?: string;
                props: Record<string, unknown>;
                presentation?: WidgetInstancePresentation;
                runtimeState?: Record<string, unknown>;
                onRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
              }>;

              return (
                <div key={mountedInstance.id} className="h-px w-px overflow-hidden">
                  <Component
                    widget={mountedWidget}
                    instanceTitle={mountedInstance.title}
                    props={mountedInstance.props ?? {}}
                    presentation={mountedInstance.presentation}
                    runtimeState={mountedInstance.runtimeState}
                    onRuntimeStateChange={(state) => {
                      updateSelectedWorkspace((dashboard) =>
                        updateDashboardWidgetRuntimeState(dashboard, mountedInstance.id, state),
                      );
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="h-full overflow-y-auto px-4 py-4 pb-10 md:px-6 md:py-6">
            <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <Button variant="outline" onClick={openDashboardView}>
                  <ArrowLeft className="h-4 w-4" />
                  Return to dashboard
                </Button>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral" className="border border-border/70 bg-card/55">
                      {selectedDashboard.title}
                    </Badge>
                    <Badge variant="neutral">{widget.kind}</Badge>
                    <Badge variant="neutral">{widget.source}</Badge>
                  </div>
                  <div className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                      {instance.title ?? widget.title}
                    </h1>
                    <p className="max-w-3xl text-sm text-muted-foreground">
                      Adjust this widget instance in a full-width settings view instead of the old
                      modal.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {dirty ? (
                  <Badge variant="warning">Unsaved workspace draft</Badge>
                ) : (
                  <Badge variant="success">Workspace saved</Badge>
                )}
                <Button onClick={() => void saveWorkspaceDraft()} disabled={isSaving || !dirty}>
                  <Save className="h-4 w-4" />
                  Save workspace
                </Button>
              </div>
            </div>

            <WidgetSettingsPanel
              widget={widget}
              instance={instance}
              panelTitle={`${instance.title ?? widget.title} Settings`}
              panelDescription="Adjust the display title, shared presentation, schema fields, and advanced widget props for this dashboard instance."
              persistenceNote={
                backendMode
                  ? "Edits update the current workspace draft immediately. They are not saved until you click Save workspace."
                  : "Edits update the current local workspace draft immediately. They are not saved until you click Save workspace."
              }
              secondaryActionLabel="Return to dashboard"
              onClose={openDashboardView}
              onRemove={() => {
                updateSelectedWorkspace((dashboard) => removeDashboardWidget(dashboard, instance.id));
                openDashboardView();
              }}
              onSave={({ title, props, presentation }) => {
                updateSelectedWorkspace((dashboard) =>
                  updateDashboardWidgetSettings(dashboard, instance.id, {
                    title,
                    props,
                    presentation,
                  }),
                );
              }}
            />
          </div>
          </div>
        </div>
      </DashboardWidgetRegistryProvider>
    </DashboardControlsProvider>
  );
}
