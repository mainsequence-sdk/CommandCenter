import { create } from "zustand";

import { resolvePreferredChatRailMode, type ChatRailMode } from "./chat-ui-store";

export interface ProjectAgentRailLaunchTarget {
  agentId: string;
  label: string | null;
  launchKey: number;
}

interface ProjectAgentRailState {
  launchTarget: ProjectAgentRailLaunchTarget | null;
  railMode: ChatRailMode;
  railOpen: boolean;
  closeRail: () => void;
  openRail: (input: { agentId: string | number; label?: string | null }) => void;
  setRailMode: (value: ChatRailMode) => void;
}

export const useProjectAgentRailStore = create<ProjectAgentRailState>((set) => ({
  launchTarget: null,
  railMode: "docked",
  railOpen: false,
  closeRail() {
    set({ railOpen: false });
  },
  openRail({ agentId, label }) {
    const normalizedAgentId = String(agentId).trim();

    if (!normalizedAgentId) {
      return;
    }

    set((state) => ({
      launchTarget: {
        agentId: normalizedAgentId,
        label: label?.trim() || null,
        launchKey: (state.launchTarget?.launchKey ?? 0) + 1,
      },
      railMode: resolvePreferredChatRailMode(),
      railOpen: true,
    }));
  },
  setRailMode(value) {
    set({ railMode: value });
  },
}));
