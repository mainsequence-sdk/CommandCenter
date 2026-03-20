import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type LiveState = "connecting" | "connected" | "disconnected";

interface ShellState {
  liveState: LiveState;
  commandValue: string;
  sidebarCollapsed: boolean;
  appPanelAppId: string | null;
  kioskMode: boolean;
  workspaceCanvasMenuHidden: boolean;
  favoriteSurfaceIds: string[];
  favoriteWorkspaceIds: string[];
  setLiveState: (value: LiveState) => void;
  setCommandValue: (value: string) => void;
  setSidebarCollapsed: (value: boolean) => void;
  setAppPanelAppId: (value: string | null) => void;
  setKioskMode: (value: boolean) => void;
  setWorkspaceCanvasMenuHidden: (value: boolean) => void;
  setSurfaceFavorite: (favoriteId: string, value: boolean) => void;
  toggleSurfaceFavorite: (favoriteId: string) => void;
  setWorkspaceFavorite: (favoriteId: string, value: boolean) => void;
  toggleWorkspaceFavorite: (favoriteId: string) => void;
  openAppPanel: (appId: string) => void;
  closeAppPanel: () => void;
  toggleAppPanel: (appId: string) => void;
  expandSidebar: () => void;
  collapseSidebar: () => void;
  toggleSidebar: () => void;
  toggleKioskMode: () => void;
}

export const useShellStore = create<ShellState>()(
  persist(
    (set) => ({
      liveState: "disconnected",
      commandValue: "",
      sidebarCollapsed: true,
      appPanelAppId: null,
      kioskMode: false,
      workspaceCanvasMenuHidden: false,
      favoriteSurfaceIds: [],
      favoriteWorkspaceIds: [],
      setLiveState(value) {
        set({ liveState: value });
      },
      setCommandValue(value) {
        set({ commandValue: value });
      },
      setSidebarCollapsed(value) {
        set({ sidebarCollapsed: value });
      },
      setAppPanelAppId(value) {
        set({ appPanelAppId: value });
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
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        favoriteSurfaceIds: state.favoriteSurfaceIds,
        favoriteWorkspaceIds: state.favoriteWorkspaceIds,
      }),
    },
  ),
);
