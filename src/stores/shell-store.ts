import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";

const backendPreferencesEnabled =
  !env.useMockData && Boolean(commandCenterConfig.preferences.url.trim());

const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

function normalizeFavoriteIds(values: string[] | undefined) {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

interface ShellState {
  commandValue: string;
  sidebarCollapsed: boolean;
  appPanelAppId: string | null;
  userSettingsOpen: boolean;
  userSettingsSectionId: string | null;
  kioskMode: boolean;
  workspaceCanvasMenuHidden: boolean;
  favoriteSurfaceIds: string[];
  favoriteWorkspaceIds: string[];
  setCommandValue: (value: string) => void;
  setSidebarCollapsed: (value: boolean) => void;
  setAppPanelAppId: (value: string | null) => void;
  setUserSettingsOpen: (value: boolean) => void;
  setUserSettingsSectionId: (value: string | null) => void;
  setKioskMode: (value: boolean) => void;
  setWorkspaceCanvasMenuHidden: (value: boolean) => void;
  setSurfaceFavorite: (favoriteId: string, value: boolean) => void;
  toggleSurfaceFavorite: (favoriteId: string) => void;
  setWorkspaceFavorite: (favoriteId: string, value: boolean) => void;
  toggleWorkspaceFavorite: (favoriteId: string) => void;
  hydratePersistedPreferences: (preferences: {
    favoriteSurfaceIds?: string[];
    favoriteWorkspaceIds?: string[];
  }) => void;
  openAppPanel: (appId: string) => void;
  closeAppPanel: () => void;
  toggleAppPanel: (appId: string) => void;
  openUserSettings: (sectionId?: string | null) => void;
  closeUserSettings: () => void;
  expandSidebar: () => void;
  collapseSidebar: () => void;
  toggleSidebar: () => void;
  toggleKioskMode: () => void;
}

export const useShellStore = create<ShellState>()(
  persist(
    (set) => ({
      commandValue: "",
      sidebarCollapsed: true,
      appPanelAppId: null,
      userSettingsOpen: false,
      userSettingsSectionId: null,
      kioskMode: false,
      workspaceCanvasMenuHidden: false,
      favoriteSurfaceIds: [],
      favoriteWorkspaceIds: [],
      setCommandValue(value) {
        set({ commandValue: value });
      },
      setSidebarCollapsed(value) {
        set({ sidebarCollapsed: value });
      },
      setAppPanelAppId(value) {
        set({ appPanelAppId: value });
      },
      setUserSettingsOpen(value) {
        set({ userSettingsOpen: value });
      },
      setUserSettingsSectionId(value) {
        set({ userSettingsSectionId: value });
      },
      setKioskMode(value) {
        set({ kioskMode: value });
      },
      setWorkspaceCanvasMenuHidden(value) {
        set({ workspaceCanvasMenuHidden: value });
      },
      setSurfaceFavorite(favoriteId, value) {
        set((state) => {
          const alreadyFavorite = state.favoriteSurfaceIds.includes(favoriteId);

          if (value && !alreadyFavorite) {
            return { favoriteSurfaceIds: [...state.favoriteSurfaceIds, favoriteId] };
          }

          if (!value && alreadyFavorite) {
            return {
              favoriteSurfaceIds: state.favoriteSurfaceIds.filter((entry) => entry !== favoriteId),
            };
          }

          return state;
        });
      },
      toggleSurfaceFavorite(favoriteId) {
        set((state) => ({
          favoriteSurfaceIds: state.favoriteSurfaceIds.includes(favoriteId)
            ? state.favoriteSurfaceIds.filter((entry) => entry !== favoriteId)
            : [...state.favoriteSurfaceIds, favoriteId],
        }));
      },
      setWorkspaceFavorite(favoriteId, value) {
        set((state) => {
          const alreadyFavorite = state.favoriteWorkspaceIds.includes(favoriteId);

          if (value && !alreadyFavorite) {
            return { favoriteWorkspaceIds: [...state.favoriteWorkspaceIds, favoriteId] };
          }

          if (!value && alreadyFavorite) {
            return {
              favoriteWorkspaceIds: state.favoriteWorkspaceIds.filter((entry) => entry !== favoriteId),
            };
          }

          return state;
        });
      },
      toggleWorkspaceFavorite(favoriteId) {
        set((state) => ({
          favoriteWorkspaceIds: state.favoriteWorkspaceIds.includes(favoriteId)
            ? state.favoriteWorkspaceIds.filter((entry) => entry !== favoriteId)
            : [...state.favoriteWorkspaceIds, favoriteId],
        }));
      },
      hydratePersistedPreferences(preferences) {
        set({
          favoriteSurfaceIds: normalizeFavoriteIds(preferences.favoriteSurfaceIds),
          favoriteWorkspaceIds: normalizeFavoriteIds(preferences.favoriteWorkspaceIds),
        });
      },
      openAppPanel(appId) {
        set({ appPanelAppId: appId });
      },
      closeAppPanel() {
        set({ appPanelAppId: null });
      },
      toggleAppPanel(appId) {
        set((state) => ({
          appPanelAppId: state.appPanelAppId === appId ? null : appId,
        }));
      },
      openUserSettings(sectionId = null) {
        set({
          userSettingsOpen: true,
          userSettingsSectionId: sectionId,
        });
      },
      closeUserSettings() {
        set({
          userSettingsOpen: false,
          userSettingsSectionId: null,
        });
      },
      expandSidebar() {
        set({ sidebarCollapsed: false });
      },
      collapseSidebar() {
        set({ sidebarCollapsed: true });
      },
      toggleSidebar() {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },
      toggleKioskMode() {
        set((state) => ({ kioskMode: !state.kioskMode }));
      },
    }),
    {
      name: "command-center.shell",
      storage: createJSONStorage(() =>
        backendPreferencesEnabled ? noopStorage : localStorage,
      ),
      partialize: (state) => ({
        favoriteSurfaceIds: state.favoriteSurfaceIds,
        favoriteWorkspaceIds: state.favoriteWorkspaceIds,
      }),
    },
  ),
);
