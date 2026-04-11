import { Bot, MessageSquare, Sparkles } from "lucide-react";

import {
  defineSurfaceAssistantContext,
  type AppDefinition,
} from "@/apps/types";

import { AgentsPage } from "./surfaces/agents/AgentsPage";
import { ChatPage } from "./surfaces/chat/ChatPage";

export const mainSequenceAiApp: AppDefinition = {
  id: "main_sequence_ai",
  title: "Main Sequence AI",
  description: "Extension-owned assistant workspace powered by assistant-ui.",
  source: "main_sequence_ai",
  icon: Sparkles,
  defaultSurfaceId: "chat",
  surfaces: [
    {
      id: "chat",
      title: "Chat",
      navLabel: "Chat",
      icon: MessageSquare,
      description: "Full-page Main Sequence AI chat surface sharing the same runtime as the overlay rail.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on the Main Sequence AI chat surface. This page shares the same runtime as the overlay assistant rail.",
        availableActions: [
          "Continue a longer assistant conversation",
          "Review the visible shell context",
          "Move between page and overlay chat modes",
        ],
      }),
      kind: "page",
      component: ChatPage,
    },
    {
      id: "agents",
      title: "Agents",
      navLabel: "Agents",
      icon: Bot,
      description: "Canvas-style agent workspace shell for upcoming Main Sequence AI workflows.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on the Agents surface inside Main Sequence AI. This page uses a workspace-canvas-style shell reserved for future agent workflows.",
        availableActions: [
          "Open the reserved agent-search shell",
          "Review the planned agent workspace layout",
        ],
      }),
      kind: "page",
      fullBleed: true,
      component: AgentsPage,
    },
  ],
};
