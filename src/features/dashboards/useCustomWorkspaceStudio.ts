import { useEffect, useMemo } from "react";

import { useSearchParams } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";
import { useToast } from "@/components/ui/toaster";
import { resolveDashboardLayout } from "@/dashboards/layout";
import type { DashboardDefinition } from "@/dashboards/types";
import {
  createBlankDashboard,
  type UserDashboardCollection,
} from "./custom-dashboard-storage";
import { useCustomWorkspaceStudioStore } from "./custom-workspace-studio-store";
import { getWorkspacePersistenceMode } from "./workspace-persistence";

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
  const error = useCustomWorkspaceStudioStore((state) => state.error);
  const initialize = useCustomWorkspaceStudioStore((state) => state.initialize);
  const updateDraftCollection = useCustomWorkspaceStudioStore((state) => state.updateDraftCollection);
  const createPersistedWorkspace = useCustomWorkspaceStudioStore((state) => state.createWorkspace);
  const deletePersistedWorkspace = useCustomWorkspaceStudioStore((state) => state.deleteWorkspace);
  const resetDraftCollection = useCustomWorkspaceStudioStore((state) => state.resetDraftCollection);
  const saveDraftCollection = useCustomWorkspaceStudioStore((state) => state.saveDraftCollection);

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

  const resolvedDashboard = useMemo(
    () => (selectedDashboard ? resolveDashboardLayout(selectedDashboard) : null),
    [selectedDashboard],
  );

  const dirty = useMemo(
    () => JSON.stringify(draftCollection) !== JSON.stringify(savedCollection),
    [draftCollection, savedCollection],
  );
  const workspaceSelectionPending = useMemo(
    () =>
      Boolean(
        user?.id &&
        requestedWorkspaceId &&
        (initializedUserId !== user.id || hydratingUserId === user.id || isHydrating),
      ),
    [hydratingUserId, initializedUserId, isHydrating, requestedWorkspaceId, user?.id],
  );
  const requestedWorkspaceMissing = useMemo(
    () =>
      Boolean(
        requestedWorkspaceId &&
        !workspaceSelectionPending &&
        !selectedDashboard,
      ),
    [requestedWorkspaceId, selectedDashboard, workspaceSelectionPending],
  );
  const workspaceListCollection = useMemo(
    () => (persistenceMode === "backend" ? savedCollection : draftCollection),
    [draftCollection, persistenceMode, savedCollection],
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

  function updateSelectedWorkspace(
    updater: (dashboard: DashboardDefinition) => DashboardDefinition,
  ) {
    updateDraftCollection((current) => ({
      ...current,
      dashboards: current.dashboards.map((dashboard) =>
        dashboard.id === selectedDashboard?.id ? updater(dashboard) : dashboard,
      ),
    }));
  }

  async function createWorkspace(name?: string) {
    const nextDashboard = createBlankDashboard(
      name || `Workspace ${draftCollection.dashboards.length + 1}`,
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
    const savedCollection = await saveDraftCollection();

    if (!savedCollection) {
      return null;
    }

    const savedWorkspace = selectedDashboard
      ? (savedCollection.dashboards.find((dashboard) => dashboard.id === selectedDashboard.id) ?? null)
      : null;
    const savedWorkspaceTitle = savedWorkspace?.title ?? selectedDashboard?.title ?? "Workspace";

    toast({
      title: "Workspace saved",
      description: `${savedWorkspaceTitle} was saved successfully.`,
      variant: "success",
    });

    return savedCollection;
  }

  return {
    user,
    permissions,
    savedCollection,
    draftCollection,
    workspaceListCollection,
    isHydrating,
    isSaving,
    error,
    persistenceMode,
    selectedDashboard,
    resolvedDashboard,
    dirty,
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
    updateDraftCollection,
    updateSelectedWorkspace,
    createWorkspace,
    createWorkspaceFromDefinition,
    deleteSelectedWorkspace,
    resetWorkspaceDraft,
    saveWorkspaceDraft,
  };
}

export type CustomWorkspaceStudioState = {
  savedCollection: UserDashboardCollection;
  draftCollection: UserDashboardCollection;
  workspaceListCollection: UserDashboardCollection;
  isHydrating: boolean;
  isSaving: boolean;
  error: string | null;
  persistenceMode: "backend" | "local";
  workspaceSelectionPending: boolean;
  requestedWorkspaceMissing: boolean;
};
