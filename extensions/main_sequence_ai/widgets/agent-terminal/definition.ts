import { Bot } from "lucide-react";

import { CORE_VALUE_STRING_CONTRACT } from "@/widgets/shared/value-contracts";
import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";
import { CORE_WIDGET_AGENT_CONTEXT_CONTRACT } from "@/widgets/shared/agent-context";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { AgentTerminalWidget } from "./AgentTerminalWidget";
import { agentTerminalExecutionDefinition } from "./agentTerminalExecution";
import {
  agentTerminalSettingsSchema,
  agentTerminalWidgetController,
} from "./AgentTerminalWidgetSchema";
import { AgentTerminalWidgetSettings } from "./AgentTerminalWidgetSettings";
import { MAIN_SEQUENCE_AI_WORKSPACE_REFERENCE_CONTRACT } from "../workspace/workspaceReference";
import {
  AGENT_TERMINAL_PROMPT_INPUT_ID,
  AGENT_TERMINAL_UPSTREAM_CONTEXT_INPUT_ID,
  AGENT_TERMINAL_LATEST_ASSISTANT_MARKDOWN_OUTPUT_ID,
  resolveAgentTerminalLatestAssistantMarkdown,
  type AgentTerminalWidgetProps,
} from "./agentTerminalModel";

export const agentTerminalWidget = defineWidget<AgentTerminalWidgetProps>({
  id: "main-sequence-ai-agent-terminal",
  widgetVersion: "3.7.0",
  title: "Agent Terminal",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Main Sequence AI",
  kind: "custom",
  source: "main_sequence_ai",
  defaultSize: { w: 14, h: 16 },
  responsive: {
    minWidthPx: 420,
  },
  requiredPermissions: ["workspaces:view"],
  tags: ["agents", "terminal", "chat", "sessions"],
  exampleProps: {
    agentId: "42",
    agentName: "astro-orchestrator",
    agentSessionId: "12345",
    blockUserInput: false,
    loadInitialHistory: false,
    historyRefreshMode: "workspace",
    promptOnRefresh: "## Refresh instruction\n\nSummarize what changed since the last refresh.",
  },
  mockProps: {
    promptOnRefresh: "## Refresh instruction\n\nSummarize what changed since the last refresh.",
  },
  io: {
    inputs: [
      {
        id: AGENT_TERMINAL_PROMPT_INPUT_ID,
        label: "Prompt markdown",
        accepts: [CORE_VALUE_STRING_CONTRACT],
        cardinality: "one",
        description:
          "Optional bound markdown/string prompt used for automated refresh. When present, it overrides the saved refresh prompt from widget settings.",
      },
      {
        id: AGENT_TERMINAL_UPSTREAM_CONTEXT_INPUT_ID,
        label: "Upstream agent input",
        accepts: [
          CORE_WIDGET_AGENT_CONTEXT_CONTRACT,
          MAIN_SEQUENCE_AI_WORKSPACE_REFERENCE_CONTRACT,
        ],
        cardinality: "many",
        description:
          "One or more bound widget contexts or workspace references. These values are appended to the automated refresh prompt whenever the terminal refreshes automatically.",
      },
    ],
    outputs: [{
      id: AGENT_TERMINAL_LATEST_ASSISTANT_MARKDOWN_OUTPUT_ID,
      label: "Latest assistant markdown",
      contract: CORE_VALUE_STRING_CONTRACT,
      description:
        "Latest assistant response from this AgentSession terminal, exposed as markdown text for downstream widgets.",
      valueDescriptor: {
        kind: "primitive",
        contract: CORE_VALUE_STRING_CONTRACT,
        primitive: "string",
        description:
          "Latest assistant response rendered by this terminal widget.",
      },
      resolveValue: ({ runtimeState }) => resolveAgentTerminalLatestAssistantMarkdown(runtimeState),
    }],
  },
  schema: agentTerminalSettingsSchema,
  settingsSchemaPlacement: "custom",
  controller: agentTerminalWidgetController,
  settingsComponent: AgentTerminalWidgetSettings,
  showRawPropsEditor: false,
  workspaceIcon: Bot,
  execution: agentTerminalExecutionDefinition,
  workspaceRuntimeMode: "execution-owner",
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Selects one supported agent, creates and stores a managed AgentSession for that widget, can optionally block manual typing, optionally renders initial history after readiness, stores a saved refresh prompt, exposes that prompt as a companion canvas card, can accept one bound prompt markdown string, and can append several bound upstream widget contexts or workspace references during automated refresh.",
      requiredSetupSteps: [
        "Select one supported agent. The widget creates a fresh session automatically.",
        "Optionally block manual typing when the terminal should only run refresh-driven prompts.",
        "Optionally render initial history after the required session readiness load; transcript rendering is disabled by default.",
        "Optionally configure a saved prompt that runs on refresh, expose or hide its companion card on canvas, or bind one prompt markdown/string source.",
        "Optionally bind one or more upstream widget contexts or workspace references.",
      ],
    },
    runtime: {
      refreshPolicy: "allow-refresh",
      executionTriggers: ["dashboard-refresh", "manual-submit"],
      executionSummary:
        "Owns terminal-style execution against one widget-managed AgentSession, requiring detail and history readiness before any assistant-runtime call, optionally blocking manual terminal typing while still allowing refresh-driven requests, using one bound prompt markdown input or the saved refresh prompt during automated refresh, appending bound upstream widget context or workspace references as evidence, and publishing the latest assistant markdown output.",
    },
    io: {
      mode: "static",
      summary:
        "Accepts one optional prompt markdown string plus zero or more upstream widget contexts or workspace references for automated refresh, and publishes the latest assistant markdown response.",
    },
    capabilities: {
      acceptedContracts: [
        CORE_VALUE_STRING_CONTRACT,
        CORE_WIDGET_AGENT_CONTEXT_CONTRACT,
        MAIN_SEQUENCE_AI_WORKSPACE_REFERENCE_CONTRACT,
      ],
      publishedContracts: [CORE_VALUE_STRING_CONTRACT],
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  component: AgentTerminalWidget,
});
