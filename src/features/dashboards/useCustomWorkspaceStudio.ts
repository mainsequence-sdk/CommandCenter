import { useEffect, useMemo } from "react";

import { useSearchParams } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";
import { useToast } from "@/components/ui/toaster";
import { resolveDashboardLayout } from "@/dashboards/layout";
import type { DashboardControlsState, DashboardDefinition } from "@/dashboards/types";
import {
  createBlankDashboard,
  expandAllDashboardRows,
  updateDashboardControlsState,
} from "./custom-dashboard-storage";
import type { WorkspaceSnapshotCaptureProfile } from "./snapshot/types";
import { useCustomWorkspaceStudioStore } from "./custom-workspace-studio-store";
import { getWorkspacePersistenceMode } from "./workspace-persistence";
import type { WorkspaceListItemSummary } from "./workspace-list-summary";
import { useWorkspaceStudioSurfaceConfig } from "./workspace-studio-surface-config";

export function resolveWorkspaceDirtyState(input: {
  workspaceId: string | null | undefined;
  dirtyWorkspaceIds: Record<string, boolean>;
  workspaceDraftRevisionById: Record<string, number>;
  workspaceUserStateRevisionById: Record<string, number>;
}) {
  const workspaceId = input.workspaceId;

  if (!workspaceId) {
    return false;
  }

  return Boolean(
    (input.dirtyWorkspaceIds[workspaceId] ?? false) ||
      (input.workspaceDraftRevisionById[workspaceId] ?? 0) > 0 ||
      (input.workspaceUserStateRevisionById[workspaceId] ?? 0) > 0,
  );
}

export function useCustomWorkspaceStudio() {
  const user = useAuthStore((state) => state.session?.user);
  const { toast } = useToast();
  const permissions = user?.permissions ?? [];
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedWorkspaceId = searchParams.get("workspace");
  const requestedViewParam = searchParams.get("view");
  const requestedWidgetId = searchParams.get("widget");
  const requestedWidgetTabParam = searchParams.get("tab");
  const snapshotMode = searchParams.get("snapshot") === "true";
  const snapshotProfile: WorkspaceSnapshotCaptureProfile = "agent";
  const requestedWidgetSettingsTab =
    requestedWidgetTabParam === "bindings"
      ? "bindings"
      : requestedWidgetTabParam === "connection"
        ? "connection"
        : "settings";
  const persistenceMode = getWorkspacePersistenceMode();
  const { workspaceTypes } = useWorkspaceStudioSurfaceConfig();
  const selectedWorkspaceView =
    snapshotMode
      ? "dashboard"
      : requestedViewParam === "settings" ||
          requestedViewParam === "widget-settings" ||
          requestedViewParam === "graph"
      ? requestedViewParam
      : "dashboard";

  const draftWorkspaceById = useCustomWorkspaceStudioStore((state) => state.draftWorkspaceById);
  const workspaceUserStateHydratedById = useCustomWorkspaceStudioStore(
    (state) => state.workspaceUserStateHydratedById,
  );
  const initializedUserId = useCustomWorkspaceStudioStore((state) => state.initializedUserId);
  const hydratingUserId = useCustomWorkspaceStudioStore((state) => state.hydratingUserId);
  const isHydrating = useCustomWorkspaceStudioStore((state) => state.isHydrating);
  const isSaving = useCustomWorkspaceStudioStore((state) => state.isSaving);
  const loadingWorkspaceId = useCustomWorkspaceStudioStore((state) => state.loadingWorkspaceId);
  const workspaceLoadErrorById = useCustomWorkspaceStudioStore(
    (state) => state.workspaceLoadErrorById,
  );
  const persistedWorkspaceListItems = useCustomWorkspaceStudioStore((state) => state.workspaceListItems);
  const dirtyWorkspaceIds = useCustomWorkspaceStudioStore((state) => state.dirtyWorkspaceIds);
  const workspaceDraftRevisionById = useCustomWorkspaceStudioStore(
    (state) => state.workspaceDraftRevisionById,
  );
  const workspaceUserStateRevisionById = useCustomWorkspaceStudioStore(
    (state) => state.workspaceUserStateRevisionById,
  );
  const error = useCustomWorkspaceStudioStore((state) => state.error);
  const missingWorkspaceIds = useCustomWorkspaceStudioStore((state) => state.missingWorkspaceIds);
  const workspaceEditorModeById = useCustomWorkspaceStudioStore(
    (state) => state.workspaceEditorModeById,
  );
  const initialize = useCustomWorkspaceStudioStore((state) => state.initialize);
  const updateWorkspaceDraft = useCustomWorkspaceStudioStore((state) => state.updateWorkspaceDraft);
  const updateWorkspaceUserState = useCustomWorkspaceStudioStore(
    (state) => state.updateWorkspaceUserState,
  );
  const updateWorkspaceListItemSummary = useCustomWorkspaceStudioStore(
    (state) => state.updateWorkspaceListItemSummary,
  );
  const setStoredSelectedWorkspaceId = useCustomWorkspaceStudioStore(
    (state) => state.setSelectedWorkspaceId,
  );
  const createPersistedWorkspace = useCustomWorkspaceStudioStore((state) => state.createWorkspace);
  const deletePersistedWorkspace = useCustomWorkspaceStudioStore((state) => state.deleteWorkspace);
  const resetWorkspaceDraftInStore = useCustomWorkspaceStudioStore(
    (state) => state.resetWorkspaceDraft,
  );
  const saveWorkspace = useCustomWorkspaceStudioStore((state) => state.saveWorkspace);
  const saveWorkspaceDraftUpdate = useCustomWorkspaceStudioStore(
    (state) => state.saveWorkspaceDraftUpdate,
  );
  const saveWorkspaceUserState = useCustomWorkspaceStudioStore((state) => state.saveWorkspaceUserState);
  const loadWorkspaceDetail = useCustomWorkspaceStudioStore((state) => state.loadWorkspaceDetail);
  const setWorkspaceEditing = useCustomWorkspaceStudioStore((state) => state.setWorkspaceEditing);

  useEffect(() => {
    void initialize(user?.id ?? null, {
      preloadList: !(
        getWorkspacePersistenceMode() === "backend" &&
        Boolean(requestedWorkspaceId)
      ),
      workspaceTypes,
    });
  }, [initialize, requestedWorkspaceId, user?.id, workspaceTypes]);

  const selectedDashboardSource = useMemo(
    () => {
      if (!requestedWorkspaceId) {
        return null;
      }

      const workspace = draftWorkspaceById[requestedWorkspaceId] ?? null;

      if (
        persistenceMode === "backend" &&
        workspace &&
        !workspaceUserStateHydratedById[requestedWorkspaceId]
      ) {
        return null;
      }

      return workspace;
    },
    [
      draftWorkspaceById,
      persistenceMode,
      requestedWorkspaceId,
      workspaceUserStateHydratedById,
    ],
  );
  const selectedDashboard = useMemo(
    () =>
      snapshotMode && selectedDashboardSource
        ? expandAllDashboardRows(selectedDashboardSource)
        : selectedDashboardSource,
    [selectedDashboardSource, snapshotMode],
  );
  const workspaceListItems = persistedWorkspaceListItems;
  useEffect(() => {
    if (
      selectedWorkspaceView === "widget-settings"
        ? Boolean(requestedWidgetId)
        : !requestedWidgetId && !requestedWidgetTabParam
    ) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);

    if (selectedWorkspaceView === "widget-settings") {
      nextParams.delete("view");
    }

    nextParams.delete("widget");
    nextParams.delete("tab");
    setSearchParams(nextParams, { replace: true });
  }, [
    requestedWidgetId,
    requestedWidgetTabParam,
    searchParams,
    selectedWorkspaceView,
    setSearchParams,
  ]);

  useEffect(() => {
    setStoredSelectedWorkspaceId(requestedWorkspaceId);
  }, [requestedWorkspaceId, setStoredSelectedWorkspaceId]);

  useEffect(() => {
    if (
      persistenceMode !== "backend" ||
      !requestedWorkspaceId ||
      (
        Boolean(draftWorkspaceById[requestedWorkspaceId]) &&
        workspaceUserStateHydratedById[requestedWorkspaceId]
      ) ||
      !initializedUserId ||
      loadingWorkspaceId === requestedWorkspaceId ||
      missingWorkspaceIds[requestedWorkspaceId] ||
      workspaceLoadErrorById[requestedWorkspaceId]
    ) {
      return;
    }

    void loadWorkspaceDetail(requestedWorkspaceId);
  }, [
    initializedUserId,
    loadWorkspaceDetail,
    loadingWorkspaceId,
    persistenceMode,
    requestedWorkspaceId,
    draftWorkspaceById,
    workspaceUserStateHydratedById,
    missingWorkspaceIds,
    workspaceLoadErrorById,
  ]);

  const resolvedDashboard = useMemo(
    () => {
      if (!selectedDashboard) {
        return {
          error: null,
          resolvedDashboard: null,
        };
      }

      try {
        return {
          error: null,
          resolvedDashboard: resolveDashboardLayout(selectedDashboard),
        };
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error
              : new Error("Unable to resolve the selected workspace layout."),
          resolvedDashboard: null,
        };
      }
    },
    [selectedDashboard],
  );

  useEffect(() => {
    if (!selectedDashboard || !resolvedDashboard.error) {
      return;
    }

    console.error("[workspaces] Unable to resolve selected workspace layout.", {
      workspaceId: selectedDashboard.id,
      workspaceTitle: selectedDashboard.title,
      error: resolvedDashboard.error,
    });
  }, [resolvedDashboard.error, selectedDashboard]);

  const selectedWorkspaceDirty = useMemo(
    () =>
      resolveWorkspaceDirtyState({
        workspaceId: requestedWorkspaceId,
        dirtyWorkspaceIds,
        workspaceDraftRevisionById,
        workspaceUserStateRevisionById,
      }),
    [
      dirtyWorkspaceIds,
      requestedWorkspaceId,
      workspaceDraftRevisionById,
      workspaceUserStateRevisionById,
    ],
  );
  const dirty = selectedWorkspaceDirty;
  const selectedWorkspaceEditing = useMemo(
    () =>
      requestedWorkspaceId
        ? (snapshotMode ? false : (workspaceEditorModeById[requestedWorkspaceId] ?? false))
        : false,
    [requestedWorkspaceId, snapshotMode, workspaceEditorModeById],
  );
  const workspaceSelectionPending = useMemo(
    () =>
      Boolean(
        user?.id &&
        requestedWorkspaceId &&
        (
          initializedUserId !== user.id ||
          hydratingUserId === user.id ||
          isHydrating ||
          loadingWorkspaceId === requestedWorkspaceId
        ),
      ),
    [hydratingUserId, initializedUserId, isHydrating, loadingWorkspaceId, requestedWorkspaceId, user?.id],
  );
  const requestedWorkspaceMissing = useMemo(
    () =>
      Boolean(
        requestedWorkspaceId &&
        !workspaceSelectionPending &&
        !selectedDashboard &&
        (persistenceMode === "backend"
          ? (missingWorkspaceIds[requestedWorkspaceId] ?? false)
          : true),
      ),
    [
      missingWorkspaceIds,
      persistenceMode,
      requestedWorkspaceId,
      selectedDashboard,
      workspaceSelectionPending,
    ],
  );
  function setSelectedWorkspaceId(workspaceId: string | null) {
    const nextParams = new URLSearchParams(searchParams);

    if (workspaceId) {
      nextParams.set("workspace", workspaceId);
    } else {
      nextParams.delete("workspace");
      nextParams.delete("view");
      nextParams.delete("widget");
      nextParams.delete("tab");
    }

    setSearchParams(nextParams);
  }

  function openDashboardView() {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.delete("view");
      nextParams.delete("widget");
      nextParams.delete("tab");
      return nextParams;
    });
  }

  function openWorkspaceSettings() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("view", "settings");
    nextParams.delete("widget");
    nextParams.delete("tab");
    setSearchParams(nextParams);
  }

  function openWorkspaceGraph() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("view", "graph");
    nextParams.delete("widget");
    nextParams.delete("tab");
    setSearchParams(nextParams);
  }

  function openWidgetSettings(
    widgetId: string,
    tab: "settings" | "bindings" | "connection" = "settings",
  ) {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.set("view", "widget-settings");
      nextParams.set("widget", widgetId);

      if (tab === "bindings" || tab === "connection") {
        nextParams.set("tab", tab);
      } else {
        nextParams.delete("tab");
      }

      return nextParams;
    });
  }

  function setSelectedWorkspaceEditing(editing: boolean) {
    if (!requestedWorkspaceId) {
      return;
    }

    setWorkspaceEditing(requestedWorkspaceId, editing);
  }

  function updateSelectedWorkspace(
    updater: (dashboard: DashboardDefinition) => DashboardDefinition,
  ) {
    if (!selectedDashboard?.id) {
      return;
    }

    updateWorkspaceDraft(selectedDashboard.id, updater);
  }

  function updateSelectedWorkspaceUserState(
    updater: (dashboard: DashboardDefinition) => DashboardDefinition,
    options?: {
      bumpRevision?: boolean;
    },
  ) {
    if (!selectedDashboard?.id) {
      return;
    }

    updateWorkspaceUserState(selectedDashboard.id, updater, options);
  }

  function updateSelectedWorkspaceListItemSummary(
    updater: (item: WorkspaceListItemSummary) => WorkspaceListItemSummary,
  ) {
    if (!selectedDashboard?.id) {
      return;
    }

    updateWorkspaceListItemSummary(selectedDashboard.id, updater);
  }

  function commitSelectedWorkspaceControlsState(state: DashboardControlsState) {
    if (!selectedDashboard?.id) {
      return;
    }

    const workspaceId = selectedDashboard.id;

    updateWorkspaceUserState(workspaceId, (dashboard) =>
      updateDashboardControlsState(dashboard, state),
    );
    void saveWorkspaceUserState(workspaceId);
  }

  async function createWorkspace(name?: string) {
    const nextDashboard = createBlankDashboard(
      name || `Workspace ${workspaceListItems.length + 1}`,
    );
    return createWorkspaceFromDefinition(nextDashboard);
  }

  async function createWorkspaceFromDefinition(workspace: DashboardDefinition) {
    const createdDashboard = await createPersistedWorkspace(workspace);

    if (!createdDashboard) {
      return null;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("workspace", createdDashboard.id);
    nextParams.delete("view");
    nextParams.delete("widget");
    nextParams.delete("tab");
    setSearchParams(nextParams);

    return createdDashboard;
  }

  async function deleteSelectedWorkspace() {
    if (!selectedDashboard) {
      return false;
    }

    return deletePersistedWorkspace(selectedDashboard.id);
  }

  function resetWorkspaceDraft() {
    if (!selectedDashboard) {
      return;
    }

    resetWorkspaceDraftInStore(selectedDashboard.id);
  }

  async function saveWorkspaceDraft() {
    if (!selectedDashboard) {
      toast({
        title: "Save failed",
        description: "No workspace is currently selected.",
        variant: "error",
      });

      return null;
    }

    const savedWorkspace = await saveWorkspace(selectedDashboard.id);

    if (!savedWorkspace) {
      const latestError =
        useCustomWorkspaceStudioStore.getState().error ?? "Unable to save workspace.";

      toast({
        title: "Save failed",
        description: latestError,
        variant: "error",
      });

      return null;
    }

    const savedWorkspaceTitle = savedWorkspace?.title ?? selectedDashboard?.title ?? "Workspace";

    toast({
      title: "Workspace saved",
      description: `${savedWorkspaceTitle} was saved successfully.`,
      variant: "success",
    });

    return savedWorkspace;
  }

  async function saveSelectedWorkspaceDraftUpdate(
    updater: (dashboard: DashboardDefinition) => DashboardDefinition,
  ) {
    if (!selectedDashboard) {
      toast({
        title: "Save failed",
        description: "No workspace is currently selected.",
        variant: "error",
      });

      return null;
    }

    return saveWorkspaceDraftUpdate(selectedDashboard.id, updater);
  }

  return {
    user,
    permissions,
    workspaceListItems,
    isHydrating,
    isSaving,
    error,
    persistenceMode,
    selectedDashboardSource,
    selectedDashboard,
    resolvedDashboard: resolvedDashboard.resolvedDashboard,
    resolvedDashboardError: resolvedDashboard.error,
    dirty,
    selectedWorkspaceDirty,
    selectedWorkspaceEditing,
    workspaceSelectionPending,
    requestedWorkspaceMissing,
    requestedWorkspaceId,
    requestedWidgetId,
    requestedWidgetSettingsTab,
    selectedWorkspaceView,
    snapshotMode,
    snapshotProfile,
    setSelectedWorkspaceId,
    openDashboardView,
    openWorkspaceGraph,
    openWorkspaceSettings,
    openWidgetSettings,
    setSelectedWorkspaceEditing,
    updateSelectedWorkspace,
    updateSelectedWorkspaceUserState,
    updateSelectedWorkspaceListItemSummary,
    commitSelectedWorkspaceControlsState,
    createWorkspace,
    createWorkspaceFromDefinition,
    deleteSelectedWorkspace,
    loadWorkspaceDetail,
    resetWorkspaceDraft,
    saveWorkspaceDraft,
    saveSelectedWorkspaceDraftUpdate,
  };
}

export type CustomWorkspaceStudioState = {
  workspaceListItems: WorkspaceListItemSummary[];
  isHydrating: boolean;
  isSaving: boolean;
  error: string | null;
  persistenceMode: "backend" | "local";
  resolvedDashboardError: Error | null;
  workspaceSelectionPending: boolean;
  requestedWorkspaceMissing: boolean;
};
