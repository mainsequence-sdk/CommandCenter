import { create } from "zustand";

export const CHAT_PAGE_PATH = "/app/main_sequence_ai/chat";
export const CHAT_RAIL_WIDTH = 540;
export const CHAT_DOCKED_MIN_WIDTH = 1400;

export type ChatRailMode = "overlay" | "docked";

export function resolvePreferredChatRailMode(viewportWidth = window.innerWidth): ChatRailMode {
  return viewportWidth >= CHAT_DOCKED_MIN_WIDTH ? "docked" : "overlay";
}

interface ChatUiState {
  railMode: ChatRailMode;
  railOpen: boolean;
  pageOriginPath: string;
  closeRail: () => void;
  openRail: (mode: ChatRailMode) => void;
  setPageOriginPath: (value: string) => void;
  setRailMode: (value: ChatRailMode) => void;
  setRailOpen: (value: boolean) => void;
  toggleRail: (mode?: ChatRailMode) => void;
}

export const useChatUiStore = create<ChatUiState>((set) => ({
  railMode: "docked",
  railOpen: false,
  pageOriginPath: "/app",
  closeRail() {
    set({ railOpen: false });
  },
  openRail(mode) {
    set({ railMode: mode, railOpen: true });
  },
  setPageOriginPath(value) {
    set({ pageOriginPath: value });
  },
  setRailMode(value) {
    set({ railMode: value });
  },
  setRailOpen(value) {
    set({ railOpen: value });
  },
  toggleRail(mode) {
    set((state) => ({
      railMode: mode ?? state.railMode,
      railOpen: mode ? true : !state.railOpen,
    }));
  },
}));
