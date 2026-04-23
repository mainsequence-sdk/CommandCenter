import { Bot } from "lucide-react";

import { CORE_VALUE_STRING_CONTRACT } from "@/widgets/shared/value-contracts";
import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";
import { CORE_WIDGET_AGENT_CONTEXT_CONTRACT } from "@/widgets/shared/agent-context";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { AgentTerminalWidget } from "./AgentTerminalWidget";
import { agentTerminalExecutionDefinition } from "./agentTerminalExecution";
import { AgentTerminalWidgetSettings } from "./AgentTerminalWidgetSettings";
import { MAIN_SEQUENCE_AI_WORKSPACE_REFERENCE_CONTRACT } from "../workspace/workspaceReference";
import {
  AGENT_TERMINAL_UPSTREAM_CONTEXT_INPUT_ID,
  AGENT_TERMINAL_LATEST_ASSISTANT_MARKDOWN_OUTPUT_ID,
  resolveAgentTerminalLatestAssistantMarkdown,
  type AgentTerminalWidgetProps,
} from "./agentTerminalModel";

export const agentTerminalWidget = defineWidget<AgentTerminalWidgetProps>({
  id: "main-sequence-ai-agent-terminal",
  widgetVersion: "3.1.0",
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
  },
  mockProps: {},
  io: {
    inputs: [{
      id: AGENT_TERMINAL_UPSTREAM_CONTEXT_INPUT_ID,
      label: "Upstream agent input",
      accepts: [
        CORE_WIDGET_AGENT_CONTEXT_CONTRACT,
        MAIN_SEQUENCE_AI_WORKSPACE_REFERENCE_CONTRACT,
      ],
      cardinality: "many",
      description:
        "One or more bound widget contexts or workspace references. These values are appended to the saved refresh prompt whenever the terminal refreshes automatically.",
    }],
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
  settingsComponent: AgentTerminalWidgetSettings,
  showRawPropsEditor: false,
  workspaceIcon: Bot,
  execution: agentTerminalExecutionDefinition,
  workspaceRuntimeMode: "execution-owner",
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Selects one supported agent, creates and stores a managed AgentSession for that widget, can optionally block manual typing, optionally loads initial history, stores a saved refresh prompt, and can append several bound upstream widget contexts or workspace references during automated refresh.",
      requiredSetupSteps: [
        "Select one supported agent. The widget creates a fresh session automatically.",
        "Optionally block manual typing when the terminal should only run refresh-driven prompts.",
        "Optionally enable initial history loading; it is disabled by default.",
        "Optionally configure a saved prompt that runs on refresh.",
        "Optionally bind one or more upstream widget contexts or workspace references.",
      ],
    },
    runtime: {
      refreshPolicy: "allow-refresh",
      executionTriggers: ["dashboard-refresh", "manual-submit"],
      executionSummary:
        "Owns terminal-style execution against one widget-managed AgentSession, validating the session against the normal backend before any assistant-runtime call, optionally blocking manual terminal typing while still allowing refresh-driven requests, avoiding assistant runtime requests on mount unless initial history loading is explicitly enabled, composing saved refresh prompts with bound upstream widget context or workspace references during automated refresh, and publishing the latest assistant markdown output.",
    },
    io: {
      mode: "static",
      summary:
        "Accepts zero or more upstream widget contexts or workspace references for automated refresh and publishes the latest assistant markdown response.",
    },
    capabilities: {
      acceptedContracts: [
        CORE_WIDGET_AGENT_CONTEXT_CONTRACT,
        MAIN_SEQUENCE_AI_WORKSPACE_REFERENCE_CONTRACT,
      ],
      publishedContracts: [CORE_VALUE_STRING_CONTRACT],
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  component: AgentTerminalWidget,
});
