import { create } from "zustand";

import {
  cloneDashboardCollection,
  ensureUserDashboardCollectionSelection,
  loadUserDashboardCollection,
  saveUserDashboardCollection,
  type UserDashboardCollection,
} from "./custom-dashboard-storage";

interface CustomWorkspaceStudioState {
  initializedUserId: string | null;
  savedCollection: UserDashboardCollection;
  draftCollection: UserDashboardCollection;
  initialize: (userId: string | null) => void;
  updateDraftCollection: (
    updater: (collection: UserDashboardCollection) => UserDashboardCollection,
  ) => void;
  resetDraftCollection: () => void;
  saveDraftCollection: () => void;
}

function createEmptyCollection(): UserDashboardCollection {
  return {
    version: 1,
    dashboards: [],
    selectedDashboardId: null,
    savedAt: null,
  };
}

export const useCustomWorkspaceStudioStore = create<CustomWorkspaceStudioState>((set, get) => ({
  initializedUserId: null,
  savedCollection: createEmptyCollection(),
  draftCollection: createEmptyCollection(),
  initialize(userId) {
    if (!userId) {
      set({
        initializedUserId: null,
        savedCollection: createEmptyCollection(),
        draftCollection: createEmptyCollection(),
      });
      return;
    }

    if (get().initializedUserId === userId) {
      return;
    }

    const loaded = loadUserDashboardCollection(userId);
    set({
      initializedUserId: userId,
      savedCollection: loaded,
      draftCollection: cloneDashboardCollection(loaded),
    });
  },
  updateDraftCollection(updater) {
    set((current) => ({
      draftCollection: ensureUserDashboardCollectionSelection(
        updater(cloneDashboardCollection(current.draftCollection)),
      ),
    }));
  },
  resetDraftCollection() {
    set((current) => ({
      draftCollection: cloneDashboardCollection(current.savedCollection),
    }));
  },
  saveDraftCollection() {
    const current = get();

    if (!current.initializedUserId) {
      return;
    }

    const normalized = saveUserDashboardCollection(
      current.initializedUserId,
      current.draftCollection,
    );

    set({
      savedCollection: normalized,
      draftCollection: cloneDashboardCollection(normalized),
    });
  },
}));
