import { useEffect, useMemo } from "react";

import { useSearchParams } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";
import { useToast } from "@/components/ui/toaster";
import { resolveDashboardLayout } from "@/dashboards/layout";
import type { DashboardDefinition } from "@/dashboards/types";
import {
  createBlankDashboard,
  sanitizeDashboardDefinition,
  type UserDashboardCollection,
} from "./custom-dashboard-storage";
import { useCustomWorkspaceStudioStore } from "./custom-workspace-studio-store";
import { getWorkspacePersistenceMode } from "./workspace-persistence";
import {
  summarizeDashboardForWorkspaceList,
  type WorkspaceListItemSummary,
} from "./workspace-list-summary";

export function useCustomWorkspaceStudio() {
  const user = useAuthStore((state) => state.session?.user);
  const { toast } = useToast();
  const permissions = user?.permissions ?? [];
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedWorkspaceId = searchParams.get("workspace");
  const requestedViewParam = searchParams.get("view");
  const requestedWidgetId = searchParams.get("widget");
  const persistenceMode = getWorkspacePersistenceMode();
  const selectedWorkspaceView =
    requestedViewParam === "settings" ||
    requestedViewParam === "widget-settings" ||
    requestedViewParam === "graph"
      ? requestedViewParam
      : "dashboard";

  const savedCollection = useCustomWorkspaceStudioStore((state) => state.savedCollection);
  const draftCollection = useCustomWorkspaceStudioStore((state) => state.draftCollection);
  const initializedUserId = useCustomWorkspaceStudioStore((state) => state.initializedUserId);
  const hydratingUserId = useCustomWorkspaceStudioStore((state) => state.hydratingUserId);
  const isHydrating = useCustomWorkspaceStudioStore((state) => state.isHydrating);
  const isSaving = useCustomWorkspaceStudioStore((state) => state.isSaving);
  const loadingWorkspaceId = useCustomWorkspaceStudioStore((state) => state.loadingWorkspaceId);
  const workspaceLoadErrorById = useCustomWorkspaceStudioStore(
    (state) => state.workspaceLoadErrorById,
  );
  const persistedWorkspaceListItems = useCustomWorkspaceStudioStore((state) => state.workspaceListItems);
  const error = useCustomWorkspaceStudioStore((state) => state.error);
  const workspaceEditorModeById = useCustomWorkspaceStudioStore(
    (state) => state.workspaceEditorModeById,
  );
  const initialize = useCustomWorkspaceStudioStore((state) => state.initialize);
  const updateDraftCollection = useCustomWorkspaceStudioStore((state) => state.updateDraftCollection);
  const createPersistedWorkspace = useCustomWorkspaceStudioStore((state) => state.createWorkspace);
  const deletePersistedWorkspace = useCustomWorkspaceStudioStore((state) => state.deleteWorkspace);
  const resetDraftCollection = useCustomWorkspaceStudioStore((state) => state.resetDraftCollection);
  const saveWorkspace = useCustomWorkspaceStudioStore((state) => state.saveWorkspace);
  const loadWorkspaceDetail = useCustomWorkspaceStudioStore((state) => state.loadWorkspaceDetail);
  const setWorkspaceEditing = useCustomWorkspaceStudioStore((state) => state.setWorkspaceEditing);

  useEffect(() => {
    void initialize(user?.id ?? null);
  }, [initialize, user?.id]);

  const selectedDashboard = useMemo(
    () =>
      requestedWorkspaceId
        ? (draftCollection.dashboards.find((dashboard) => dashboard.id === requestedWorkspaceId) ?? null)
        : null,
    [draftCollection, requestedWorkspaceId],
  );
  const workspaceListItems = useMemo(
    () =>
      persistenceMode === "backend"
        ? persistedWorkspaceListItems
        : draftCollection.dashboards.map((dashboard) => summarizeDashboardForWorkspaceList(dashboard)),
    [draftCollection.dashboards, persistedWorkspaceListItems, persistenceMode],
  );
  const requestedWorkspaceListed = useMemo(
    () =>
      requestedWorkspaceId
        ? workspaceListItems.some((workspace) => workspace.id === requestedWorkspaceId)
        : false,
    [requestedWorkspaceId, workspaceListItems],
  );

  useEffect(() => {
    if (selectedWorkspaceView === "widget-settings" ? Boolean(requestedWidgetId) : !requestedWidgetId) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);

    if (selectedWorkspaceView === "widget-settings") {
      nextParams.delete("view");
    }

    nextParams.delete("widget");
    setSearchParams(nextParams, { replace: true });
  }, [requestedWidgetId, searchParams, selectedWorkspaceView, setSearchParams]);

  useEffect(() => {
    if (
      persistenceMode !== "backend" ||
      !requestedWorkspaceId ||
      selectedDashboard ||
      !requestedWorkspaceListed ||
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
    requestedWorkspaceListed,
    selectedDashboard,
    workspaceLoadErrorById,
  ]);

  const resolvedDashboard = useMemo(
    () => (selectedDashboard ? resolveDashboardLayout(selectedDashboard) : null),
    [selectedDashboard],
  );

  const dirty = useMemo(
    () => JSON.stringify(draftCollection) !== JSON.stringify(savedCollection),
    [draftCollection, savedCollection],
  );
  const savedSelectedDashboard = useMemo(
    () =>
      requestedWorkspaceId
        ? (savedCollection.dashboards.find((dashboard) => dashboard.id === requestedWorkspaceId) ?? null)
        : null,
    [requestedWorkspaceId, savedCollection],
  );
  const selectedWorkspaceDirty = useMemo(
    () => JSON.stringify(selectedDashboard) !== JSON.stringify(savedSelectedDashboard),
    [savedSelectedDashboard, selectedDashboard],
  );
  const selectedWorkspaceEditing = useMemo(
    () =>
      requestedWorkspaceId
        ? (workspaceEditorModeById[requestedWorkspaceId] ?? false)
        : false,
    [requestedWorkspaceId, workspaceEditorModeById],
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
        (persistenceMode === "backend" ? !requestedWorkspaceListed : true),
      ),
    [
      persistenceMode,
      requestedWorkspaceId,
      requestedWorkspaceListed,
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
    }

    setSearchParams(nextParams);
  }

  function openDashboardView() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("view");
    nextParams.delete("widget");
    setSearchParams(nextParams);
  }

  function openWorkspaceSettings() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("view", "settings");
    nextParams.delete("widget");
    setSearchParams(nextParams);
  }

  function openWorkspaceGraph() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("view", "graph");
    nextParams.delete("widget");
    setSearchParams(nextParams);
  }

  function openWidgetSettings(widgetId: string) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("view", "widget-settings");
    nextParams.set("widget", widgetId);
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
    updateDraftCollection((current) => ({
      ...current,
      dashboards: current.dashboards.map((dashboard) =>
        dashboard.id === selectedDashboard?.id
          ? sanitizeDashboardDefinition(updater(dashboard))
          : dashboard,
      ),
    }));
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
    resetDraftCollection();
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
    savedCollection,
    draftCollection,
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
    selectedWorkspaceView,
    setSelectedWorkspaceId,
    openDashboardView,
    openWorkspaceGraph,
    openWorkspaceSettings,
    openWidgetSettings,
    setSelectedWorkspaceEditing,
    updateDraftCollection,
    updateSelectedWorkspace,
    createWorkspace,
    createWorkspaceFromDefinition,
    deleteSelectedWorkspace,
    loadWorkspaceDetail,
    resetWorkspaceDraft,
    saveWorkspaceDraft,
  };
}

export type CustomWorkspaceStudioState = {
  savedCollection: UserDashboardCollection;
  draftCollection: UserDashboardCollection;
  workspaceListItems: WorkspaceListItemSummary[];
  isHydrating: boolean;
  isSaving: boolean;
  error: string | null;
  persistenceMode: "backend" | "local";
  workspaceSelectionPending: boolean;
  requestedWorkspaceMissing: boolean;
};
