import { Bot, FilePenLine, FileText, LayoutTemplate, MessageSquare, Sparkles } from "lucide-react";

import {
  defineSurfaceAssistantContext,
  type AppDefinition,
} from "@/apps/types";

import { AgentsPage } from "./surfaces/agents/AgentsPage";
import { AgentSettingsSection } from "./features/settings/AgentSettingsSection";
import { ModelProviderSettingsSection } from "./features/settings/ModelProviderSettingsSection";
import { ChatPage } from "./surfaces/chat/ChatPage";
import { AgentsMonitorPage } from "./surfaces/monitor/AgentsMonitorPage";
import { ProjectAgentDeploymentLogsPage } from "./surfaces/project-agent-deployment-logs/ProjectAgentDeploymentLogsPage";
import { AgentSessionDetailPage } from "./surfaces/session/AgentSessionDetailPage";
import { CapabilitiesPage } from "./surfaces/capabilities/CapabilitiesPage";

export const mainSequenceAiApp: AppDefinition = {
  id: "main_sequence_ai",
  title: "Main Sequence AI",
  description: "Extension-owned assistant workspace powered by assistant-ui.",
  source: "main_sequence_ai",
  icon: Sparkles,
  navigationOrder: 400,
  defaultSurfaceId: "chat",
  shellMenuContributions: [
    {
      id: "agents-settings",
      audience: "user",
      label: "Agents Settings",
      description: "Configure Main Sequence AI agent behavior and defaults.",
      icon: Bot,
      order: 55,
      group: {
        id: "main-sequence-ai",
        label: "Main Sequence AI",
        order: 50,
      },
      component: AgentSettingsSection,
    },
    {
      id: "model-providers",
      audience: "user",
      label: "Model Providers",
      description: "Sign in or sign off provider-backed AI models.",
      icon: Sparkles,
      order: 60,
      group: {
        id: "main-sequence-ai",
        label: "Main Sequence AI",
        order: 50,
      },
      component: ModelProviderSettingsSection,
    },
  ],
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
      description: "Registry-style agent list with direct chat-session launch actions.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on the Agents surface inside Main Sequence AI. This page lists backend agents and starts fresh chat sessions from a standard registry view.",
        availableActions: [
          "Browse agents",
          "Search agents",
          "Open an agent detail",
          "Start a fresh chat session for one agent",
          "Open the shared Main Sequence AI chat surface",
        ],
      }),
      kind: "page",
      component: AgentsPage,
    },
    {
      id: "capabilities",
      title: "Capabilities",
      navLabel: "Capabilities",
      icon: FilePenLine,
      description: "Resource-scoped registry for reusable prompt and skill capabilities.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on the Capabilities surface inside Main Sequence AI. This page lists reusable prompt and skill resources and opens the shared capability editor.",
        availableActions: [
          "Browse reusable capabilities",
          "Create a new prompt capability",
          "Create a new skill capability",
          "Open one capability detail editor",
        ],
      }),
      kind: "page",
      component: CapabilitiesPage,
    },
    {
      id: "project-agent-deployment-logs",
      title: "Deployment Logs",
      navLabel: "Deployment Logs",
      icon: FileText,
      description: "Standalone deployment-run log view for automatic project-agent releases.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on the Deployment Logs surface inside Main Sequence AI. This page lists automatic project-agent deployment runs scoped to the authenticated user.",
        availableActions: [
          "Review automatic deployment run status",
          "Inspect current deployment steps and errors",
          "Return to the related Workbench project when a project UID is present",
        ],
      }),
      kind: "page",
      component: ProjectAgentDeploymentLogsPage,
    },
    {
      id: "monitor",
      title: "Agents Monitor",
      navLabel: "Agents Monitor",
      icon: LayoutTemplate,
      description:
        "Workspace-studio-backed monitor canvas limited to Agent Terminal, WorkspaceReference, and Upstream Inspector.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on the Agents Monitor surface inside Main Sequence AI. This page reuses the workspace studio canvas for agent-monitor workspaces.",
        availableActions: [
          "Open an existing agent monitor workspace",
          "Create a new session-bound monitor workspace",
          "Insert Agent Terminal widgets backed by a fresh managed session",
        ],
      }),
      kind: "page",
      fullBleed: true,
      component: AgentsMonitorPage,
    },
    {
      id: "session",
      title: "Agent Session",
      description: "Standalone AgentSession detail shell for one backend session id.",
      icon: Bot,
      hidden: true,
      ...defineSurfaceAssistantContext({
        summary:
          "User is on the standalone AgentSession detail surface inside Main Sequence AI. This page inspects one backend session independently from chat.",
        availableActions: [
          "Inspect core AgentSession detail",
          "Inspect session insights",
          "Update the session provider and model",
        ],
      }),
      kind: "page",
      component: AgentSessionDetailPage,
    },
  ],
};
