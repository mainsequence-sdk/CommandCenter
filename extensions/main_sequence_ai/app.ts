import { Bot, LayoutTemplate, MessageSquare, Sparkles } from "lucide-react";

import {
  defineSurfaceAssistantContext,
  type AppDefinition,
} from "@/apps/types";

import { AgentsPage } from "./surfaces/agents/AgentsPage";
import { ChatPage } from "./surfaces/chat/ChatPage";
import { AgentsMonitorPage } from "./surfaces/monitor/AgentsMonitorPage";

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
      description: "AgentSession picker and launcher for session-specific monitor workspaces.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on the Agents surface inside Main Sequence AI. This page selects AgentSessions and launches agent-monitor workspaces.",
        availableActions: [
          "Search agents",
          "Resume recent sessions",
          "Open or create an Agents Monitor workspace",
        ],
      }),
      kind: "page",
      fullBleed: true,
      component: AgentsPage,
    },
    {
      id: "monitor",
      title: "Agents Monitor",
      navLabel: "Agents Monitor",
      icon: LayoutTemplate,
      description: "Workspace-studio-backed monitor canvas restricted to Agent Terminal widgets.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on the Agents Monitor surface inside Main Sequence AI. This page reuses the workspace studio canvas for agent-monitor workspaces.",
        availableActions: [
          "Open an existing agent monitor workspace",
          "Create a new session-bound monitor workspace",
          "Insert Agent Terminal widgets from existing agent sessions",
        ],
      }),
      kind: "page",
      fullBleed: true,
      component: AgentsMonitorPage,
    },
  ],
};
