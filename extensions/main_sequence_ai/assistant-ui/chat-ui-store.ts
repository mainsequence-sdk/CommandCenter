import { create } from "zustand";

export const CHAT_PAGE_PATH = "/app/main_sequence_ai/chat";

interface ChatUiState {
  overlayOpen: boolean;
  pageOriginPath: string;
  closeOverlay: () => void;
  openOverlay: () => void;
  setOverlayOpen: (value: boolean) => void;
  setPageOriginPath: (value: string) => void;
  toggleOverlay: () => void;
}

export const useChatUiStore = create<ChatUiState>((set) => ({
  overlayOpen: false,
  pageOriginPath: "/app",
  closeOverlay() {
    set({ overlayOpen: false });
  },
  openOverlay() {
    set({ overlayOpen: true });
  },
  setOverlayOpen(value) {
    set({ overlayOpen: value });
  },
  setPageOriginPath(value) {
    set({ pageOriginPath: value });
  },
  toggleOverlay() {
    set((state) => ({ overlayOpen: !state.overlayOpen }));
  },
}));
