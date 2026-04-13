import { DashboardControlsProvider } from "@/dashboards/DashboardControls";
import { DashboardWidgetDependenciesProvider } from "@/dashboards/DashboardWidgetDependencies";
import { DashboardWidgetExecutionProvider } from "@/dashboards/DashboardWidgetExecution";
import { DashboardWidgetRegistryProvider } from "@/dashboards/DashboardWidgetRegistry";

import {
  updateDashboardControlsState,
  updateDashboardWidgetRuntimeState,
} from "./custom-dashboard-storage";
import { CustomDashboardStudioPage } from "./CustomDashboardStudioPage";
import { CustomWorkspaceGraphPage } from "./CustomWorkspaceGraphPage";
import { CustomWorkspaceSettingsPage } from "./CustomWorkspaceSettingsPage";
import { useCustomWorkspaceStudio } from "./useCustomWorkspaceStudio";

export function WorkspaceStudioCanvasHost() {
  const {
    selectedDashboard,
    resolvedDashboard,
    selectedWorkspaceView,
    updateSelectedWorkspaceUserState,
  } = useCustomWorkspaceStudio();

  if (!selectedDashboard) {
    return null;
  }

  if (selectedWorkspaceView === "settings") {
    return <CustomWorkspaceSettingsPage />;
  }

  if (!resolvedDashboard) {
    return null;
  }

  return (
    <DashboardControlsProvider
      key={selectedDashboard.id}
      controls={selectedDashboard.controls}
      onStateChange={(state) => {
        updateSelectedWorkspaceUserState((dashboard) =>
          updateDashboardControlsState(dashboard, state),
        );
      }}
    >
      <DashboardWidgetRegistryProvider widgets={resolvedDashboard.widgets}>
        <DashboardWidgetExecutionProvider
          scopeId={selectedDashboard.id}
          widgets={resolvedDashboard.widgets}
          writeRuntimeState={(instanceId, runtimeState) => {
            updateSelectedWorkspaceUserState((dashboard) =>
              updateDashboardWidgetRuntimeState(dashboard, instanceId, runtimeState),
            );
          }}
        >
          <DashboardWidgetDependenciesProvider widgets={resolvedDashboard.widgets}>
            {selectedWorkspaceView === "graph" ? (
              <CustomWorkspaceGraphPage withRuntimeProviders={false} />
            ) : (
              <CustomDashboardStudioPage withRuntimeProviders={false} />
            )}
          </DashboardWidgetDependenciesProvider>
        </DashboardWidgetExecutionProvider>
      </DashboardWidgetRegistryProvider>
    </DashboardControlsProvider>
  );
}
