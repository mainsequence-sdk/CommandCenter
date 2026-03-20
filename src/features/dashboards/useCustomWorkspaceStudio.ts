import { useEffect, useMemo } from "react";

import { useSearchParams } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";
import { resolveDashboardLayout } from "@/dashboards/layout";
import type { DashboardDefinition } from "@/dashboards/types";
import {
  createBlankDashboard,
  type UserDashboardCollection,
} from "./custom-dashboard-storage";
import { useCustomWorkspaceStudioStore } from "./custom-workspace-studio-store";

export function useCustomWorkspaceStudio() {
  const user = useAuthStore((state) => state.session?.user);
  const permissions = user?.permissions ?? [];
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedWorkspaceId = searchParams.get("workspace");

  const savedCollection = useCustomWorkspaceStudioStore((state) => state.savedCollection);
  const draftCollection = useCustomWorkspaceStudioStore((state) => state.draftCollection);
  const initialize = useCustomWorkspaceStudioStore((state) => state.initialize);
  const updateDraftCollection = useCustomWorkspaceStudioStore((state) => state.updateDraftCollection);
  const resetDraftCollection = useCustomWorkspaceStudioStore((state) => state.resetDraftCollection);
  const saveDraftCollection = useCustomWorkspaceStudioStore((state) => state.saveDraftCollection);

  useEffect(() => {
    initialize(user?.id ?? null);
  }, [initialize, user?.id]);

  const selectedDashboard = useMemo(
    () =>
      draftCollection.dashboards.find((dashboard) => dashboard.id === requestedWorkspaceId) ??
      draftCollection.dashboards[0],
    [draftCollection, requestedWorkspaceId],
  );

  useEffect(() => {
    if (!selectedDashboard?.id || requestedWorkspaceId === selectedDashboard.id) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("workspace", selectedDashboard.id);
    setSearchParams(nextParams, { replace: true });
  }, [requestedWorkspaceId, searchParams, selectedDashboard?.id, setSearchParams]);

  const resolvedDashboard = useMemo(
    () => (selectedDashboard ? resolveDashboardLayout(selectedDashboard) : null),
    [selectedDashboard],
  );

  const dirty = useMemo(
    () => JSON.stringify(draftCollection) !== JSON.stringify(savedCollection),
    [draftCollection, savedCollection],
  );

  function setSelectedWorkspaceId(workspaceId: string) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("workspace", workspaceId);
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

  function createWorkspace(name?: string) {
    const nextDashboard = createBlankDashboard(
      name || `Workspace ${draftCollection.dashboards.length + 1}`,
    );

    updateDraftCollection((current) => ({
      ...current,
      dashboards: [nextDashboard, ...current.dashboards],
      selectedDashboardId: nextDashboard.id,
    }));

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("workspace", nextDashboard.id);
    setSearchParams(nextParams);

    return nextDashboard;
  }

  function deleteSelectedWorkspace() {
    if (!selectedDashboard) {
      return;
    }

    updateDraftCollection((current) => ({
      ...current,
      dashboards: current.dashboards.filter((dashboard) => dashboard.id !== selectedDashboard.id),
    }));
  }

  function resetWorkspaceDraft() {
    resetDraftCollection();
  }

  function saveWorkspaceDraft() {
    saveDraftCollection();
  }

  return {
    user,
    permissions,
    savedCollection,
    draftCollection,
    selectedDashboard,
    resolvedDashboard,
    dirty,
    setSelectedWorkspaceId,
    updateDraftCollection,
    updateSelectedWorkspace,
    createWorkspace,
    deleteSelectedWorkspace,
    resetWorkspaceDraft,
    saveWorkspaceDraft,
  };
}

export type CustomWorkspaceStudioState = {
  savedCollection: UserDashboardCollection;
  draftCollection: UserDashboardCollection;
};
