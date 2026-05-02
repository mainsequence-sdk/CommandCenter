import { DashboardControlsProvider } from "@/dashboards/DashboardControls";
import { DashboardWidgetDependenciesProvider } from "@/dashboards/DashboardWidgetDependencies";
import { DashboardWidgetExecutionProvider } from "@/dashboards/DashboardWidgetExecution";
import { DashboardWidgetRegistryProvider } from "@/dashboards/DashboardWidgetRegistry";
import { useNavigate } from "react-router-dom";

import {
  updateDashboardControlsState,
  updateDashboardWidgetRuntimeState,
} from "./custom-dashboard-storage";
import { CustomDashboardStudioPage } from "./CustomDashboardStudioPage";
import { CustomWorkspaceGraphPage } from "./CustomWorkspaceGraphPage";
import { CustomWorkspaceSettingsPage } from "./CustomWorkspaceSettingsPage";
import { WorkspaceSnapshotCapture } from "./snapshot/WorkspaceSnapshotCapture";
import { useCustomWorkspaceStudio } from "./useCustomWorkspaceStudio";
import { WorkspaceRenderErrorBoundary, WorkspaceRenderErrorState } from "./WorkspaceRenderErrorBoundary";
import { useWorkspaceStudioSurfaceConfig } from "./workspace-studio-surface-config";

export function WorkspaceStudioCanvasHost({
  publicPreview = false,
}: {
  publicPreview?: boolean;
} = {}) {
  const navigate = useNavigate();
  const { workspaceListPath } = useWorkspaceStudioSurfaceConfig();
  const {
    permissions,
    selectedDashboard,
    selectedDashboardSource,
    resolvedDashboard,
    resolvedDashboardError,
    snapshotMode,
    snapshotProfile,
    selectedWorkspaceView,
    openWorkspaceSettings,
    updateSelectedWorkspaceUserState,
    commitSelectedWorkspaceControlsState,
  } = useCustomWorkspaceStudio();
  const effectiveWorkspaceView = publicPreview ? "dashboard" : selectedWorkspaceView;

  if (!selectedDashboard) {
    return null;
  }

  if (effectiveWorkspaceView === "settings") {
    return <CustomWorkspaceSettingsPage />;
  }

  if (resolvedDashboardError) {
    return (
      <WorkspaceRenderErrorState
        error={resolvedDashboardError}
        onBackToWorkspaces={() => {
          navigate(workspaceListPath);
        }}
        onOpenSettings={() => {
          openWorkspaceSettings();
        }}
        workspaceId={selectedDashboard.id}
        workspaceTitle={selectedDashboard.title}
      />
    );
  }

  if (!resolvedDashboard) {
    return null;
  }

  return (
    <WorkspaceRenderErrorBoundary
      resetKey={`${selectedDashboard.id}:${effectiveWorkspaceView}:${publicPreview ? "public-preview" : "default"}`}
      onBackToWorkspaces={() => {
        navigate(workspaceListPath);
      }}
      onOpenSettings={() => {
        openWorkspaceSettings();
      }}
      workspaceId={selectedDashboard.id}
      workspaceTitle={selectedDashboard.title}
    >
      <DashboardControlsProvider
        key={selectedDashboard.id}
        controls={selectedDashboard.controls}
        refreshProgressUpdateIntervalMs={effectiveWorkspaceView === "graph" ? 1000 : 120}
        onStateChange={(state) => {
          updateSelectedWorkspaceUserState((dashboard) =>
            updateDashboardControlsState(dashboard, state),
          );
        }}
        onStateCommit={commitSelectedWorkspaceControlsState}
      >
        <DashboardWidgetRegistryProvider widgets={resolvedDashboard.widgets}>
          <DashboardWidgetExecutionProvider
            activeSurface={effectiveWorkspaceView === "graph" ? "graph" : "dashboard"}
            scopeId={selectedDashboard.id}
            widgets={resolvedDashboard.widgets}
            writeRuntimeState={(instanceId, runtimeState) => {
              updateSelectedWorkspaceUserState((dashboard) =>
                updateDashboardWidgetRuntimeState(dashboard, instanceId, runtimeState),
                { bumpRevision: false },
              );
            }}
          >
            <DashboardWidgetDependenciesProvider widgets={resolvedDashboard.widgets}>
              {snapshotMode ? (
                <WorkspaceSnapshotCapture
                  dashboard={selectedDashboard}
                  resolvedDashboard={resolvedDashboard}
                  permissions={permissions}
                  profile={snapshotProfile}
                />
              ) : null}
              {effectiveWorkspaceView === "graph" ? (
                <CustomWorkspaceGraphPage withRuntimeProviders={false} />
              ) : (
                <CustomDashboardStudioPage
                  withRuntimeProviders={false}
                  publicPreview={publicPreview}
                />
              )}
            </DashboardWidgetDependenciesProvider>
          </DashboardWidgetExecutionProvider>
        </DashboardWidgetRegistryProvider>
      </DashboardControlsProvider>
    </WorkspaceRenderErrorBoundary>
  );
}
