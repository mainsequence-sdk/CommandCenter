import { useEffect, useMemo } from "react";

import { useSearchParams } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";
import { useToast } from "@/components/ui/toaster";
import { resolveDashboardLayout } from "@/dashboards/layout";
import type { DashboardDefinition } from "@/dashboards/types";
import { createBlankDashboard } from "./custom-dashboard-storage";
import type { WorkspaceSnapshotCaptureProfile } from "./snapshot/types";
import { useCustomWorkspaceStudioStore } from "./custom-workspace-studio-store";
import { getWorkspacePersistenceMode } from "./workspace-persistence";
import type { WorkspaceListItemSummary } from "./workspace-list-summary";

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
  const snapshotProfile: WorkspaceSnapshotCaptureProfile =
    searchParams.get("snapshotProfile") === "evidence"
      ? "evidence"
      : "full-data";
  const requestedWidgetSettingsTab =
    requestedWidgetTabParam === "bindings" ? "bindings" : "settings";
  const persistenceMode = getWorkspacePersistenceMode();
  const selectedWorkspaceView =
    snapshotMode
      ? "dashboard"
      : requestedViewParam === "settings" ||
          requestedViewParam === "widget-settings" ||
          requestedViewParam === "graph"
      ? requestedViewParam
      : "dashboard";

  const draftWorkspaceById = useCustomWorkspaceStudioStore((state) => state.draftWorkspaceById);
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
  const setStoredSelectedWorkspaceId = useCustomWorkspaceStudioStore(
    (state) => state.setSelectedWorkspaceId,
  );
  const createPersistedWorkspace = useCustomWorkspaceStudioStore((state) => state.createWorkspace);
  const deletePersistedWorkspace = useCustomWorkspaceStudioStore((state) => state.deleteWorkspace);
  const resetWorkspaceDraftInStore = useCustomWorkspaceStudioStore(
    (state) => state.resetWorkspaceDraft,
  );
  const saveWorkspace = useCustomWorkspaceStudioStore((state) => state.saveWorkspace);
  const loadWorkspaceDetail = useCustomWorkspaceStudioStore((state) => state.loadWorkspaceDetail);
  const setWorkspaceEditing = useCustomWorkspaceStudioStore((state) => state.setWorkspaceEditing);

  useEffect(() => {
    void initialize(user?.id ?? null, {
      preloadList: !(
        getWorkspacePersistenceMode() === "backend" &&
        Boolean(requestedWorkspaceId)
      ),
    });
  }, [initialize, requestedWorkspaceId, user?.id]);

  const selectedDashboard = useMemo(
    () => (requestedWorkspaceId ? (draftWorkspaceById[requestedWorkspaceId] ?? null) : null),
    [draftWorkspaceById, requestedWorkspaceId],
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
      selectedDashboard ||
      !initializedUserId ||
      loadingWorkspaceId === requestedWorkspaceId ||
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
    selectedDashboard,
    workspaceLoadErrorById,
  ]);

  const resolvedDashboard = useMemo(
    () => (selectedDashboard ? resolveDashboardLayout(selectedDashboard) : null),
    [selectedDashboard],
  );

  const dirty = useMemo(
    () => {
      const workspaceIds = new Set([
        ...Object.keys(dirtyWorkspaceIds),
        ...Object.keys(workspaceDraftRevisionById),
        ...Object.keys(workspaceUserStateRevisionById),
      ]);

      return Array.from(workspaceIds).some((workspaceId) => {
        const hasDraftChanges =
          (dirtyWorkspaceIds[workspaceId] ?? false) || (workspaceDraftRevisionById[workspaceId] ?? 0) > 0;
        const hasUserStateChanges = (workspaceUserStateRevisionById[workspaceId] ?? 0) > 0;

        return hasDraftChanges || hasUserStateChanges;
      });
    },
    [dirtyWorkspaceIds, workspaceDraftRevisionById, workspaceUserStateRevisionById],
  );
  const selectedWorkspaceDirty = useMemo(
    () =>
      requestedWorkspaceId
        ? Boolean(
            (dirtyWorkspaceIds[requestedWorkspaceId] ?? false) ||
              (workspaceDraftRevisionById[requestedWorkspaceId] ?? 0) > 0 ||
              (workspaceUserStateRevisionById[requestedWorkspaceId] ?? 0) > 0,
          )
        : false,
    [dirtyWorkspaceIds, requestedWorkspaceId, workspaceDraftRevisionById, workspaceUserStateRevisionById],
  );
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
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("view");
    nextParams.delete("widget");
    nextParams.delete("tab");
    setSearchParams(nextParams);
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
    tab: "settings" | "bindings" = "settings",
  ) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("view", "widget-settings");
    nextParams.set("widget", widgetId);

    if (tab === "bindings") {
      nextParams.set("tab", "bindings");
    } else {
      nextParams.delete("tab");
    }

    setSearchParams(nextParams);
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
  ) {
    if (!selectedDashboard?.id) {
      return;
    }

    updateWorkspaceUserState(selectedDashboard.id, updater);
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

  return {
    user,
    permissions,
    workspaceListItems,
    isHydrating,
    isSaving,
    error,
    persistenceMode,
    selectedDashboard,
    resolvedDashboard,
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
    createWorkspace,
    createWorkspaceFromDefinition,
    deleteSelectedWorkspace,
    loadWorkspaceDetail,
    resetWorkspaceDraft,
    saveWorkspaceDraft,
  };
}

export type CustomWorkspaceStudioState = {
  workspaceListItems: WorkspaceListItemSummary[];
  isHydrating: boolean;
  isSaving: boolean;
  error: string | null;
  persistenceMode: "backend" | "local";
  workspaceSelectionPending: boolean;
  requestedWorkspaceMissing: boolean;
};
