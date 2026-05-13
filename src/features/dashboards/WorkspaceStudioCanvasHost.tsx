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
import { SlideStudioSlideshowRuntime } from "./SlideStudioSlideshowPage";
import { clonePublicWorkspaceRenderPermissions } from "./public-workspace-permissions";
import { WorkspaceSnapshotCapture } from "./snapshot/WorkspaceSnapshotCapture";
import { useCustomWorkspaceStudio } from "./useCustomWorkspaceStudio";
import { normalizeDashboardDefinitionType } from "./workspace-definition-type";
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
  const runtimeWorkspaceView =
    effectiveWorkspaceView === "widget-settings" ? "dashboard" : effectiveWorkspaceView;
  const renderPermissions = publicPreview
    ? clonePublicWorkspaceRenderPermissions()
    : permissions;

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

  const selectedDashboardType = normalizeDashboardDefinitionType(
    selectedDashboard.type,
    selectedDashboard.labels,
  );

  if (publicPreview && selectedDashboardType !== "workspace" && selectedDashboardType !== "slide-studio") {
    return (
      <WorkspaceRenderErrorState
        error={new Error(`Public preview is not supported for workspace type "${selectedDashboardType}".`)}
        onBackToWorkspaces={() => {
          navigate(workspaceListPath);
        }}
        workspaceId={selectedDashboard.id}
        workspaceTitle={selectedDashboard.title}
      />
    );
  }

  if (publicPreview && selectedDashboardType === "slide-studio") {
    return (
      <WorkspaceRenderErrorBoundary
        resetKey={`${selectedDashboard.id}:public-preview:slideshow`}
        onBackToWorkspaces={() => {
          navigate(workspaceListPath);
        }}
        onOpenSettings={() => {
          openWorkspaceSettings();
        }}
        workspaceId={selectedDashboard.id}
        workspaceTitle={selectedDashboard.title}
      >
        <SlideStudioSlideshowRuntime
          dashboard={selectedDashboard}
          resolvedDashboard={resolvedDashboard}
          permissions={renderPermissions}
          manageKioskMode={false}
          onControlsStateChange={(state) => {
            updateSelectedWorkspaceUserState((dashboard) =>
              updateDashboardControlsState(dashboard, state),
            );
          }}
          onControlsStateCommit={commitSelectedWorkspaceControlsState}
        />
      </WorkspaceRenderErrorBoundary>
    );
  }

  return (
    <WorkspaceRenderErrorBoundary
      resetKey={`${selectedDashboard.id}:${runtimeWorkspaceView}:${publicPreview ? "public-preview" : "default"}`}
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
        refreshProgressUpdateIntervalMs={runtimeWorkspaceView === "graph" ? 1000 : 120}
        onStateChange={(state) => {
          updateSelectedWorkspaceUserState((dashboard) =>
            updateDashboardControlsState(dashboard, state),
          );
        }}
        onStateCommit={commitSelectedWorkspaceControlsState}
      >
        <DashboardWidgetRegistryProvider widgets={resolvedDashboard.widgets}>
          <DashboardWidgetExecutionProvider
            activeSurface={runtimeWorkspaceView === "graph" ? "graph" : "dashboard"}
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
                  permissions={renderPermissions}
                  profile={snapshotProfile}
                />
              ) : null}
              {effectiveWorkspaceView === "graph" ? (
                <CustomWorkspaceGraphPage withRuntimeProviders={false} />
              ) : (
                <CustomDashboardStudioPage
                  withRuntimeProviders={false}
                  publicPreview={publicPreview}
                  renderPermissions={renderPermissions}
                />
              )}
            </DashboardWidgetDependenciesProvider>
          </DashboardWidgetExecutionProvider>
        </DashboardWidgetRegistryProvider>
      </DashboardControlsProvider>
    </WorkspaceRenderErrorBoundary>
  );
}
