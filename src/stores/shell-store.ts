import { create } from "zustand";

export type LiveState = "connecting" | "connected" | "disconnected";

interface ShellState {
  liveState: LiveState;
  commandValue: string;
  sidebarCollapsed: boolean;
  appPanelAppId: string | null;
  kioskMode: boolean;
  setLiveState: (value: LiveState) => void;
  setCommandValue: (value: string) => void;
  setSidebarCollapsed: (value: boolean) => void;
  setAppPanelAppId: (value: string | null) => void;
  setKioskMode: (value: boolean) => void;
  openAppPanel: (appId: string) => void;
  closeAppPanel: () => void;
  toggleAppPanel: (appId: string) => void;
  expandSidebar: () => void;
  collapseSidebar: () => void;
  toggleSidebar: () => void;
  toggleKioskMode: () => void;
}

export const useShellStore = create<ShellState>((set) => ({
  liveState: "disconnected",
  commandValue: "",
  sidebarCollapsed: true,
  appPanelAppId: null,
  kioskMode: false,
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
}));
