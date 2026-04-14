import { Bot } from "lucide-react";

import { CORE_VALUE_STRING_CONTRACT } from "@/widgets/shared/value-contracts";
import { defineWidget } from "@/widgets/types";
import { CORE_WIDGET_AGENT_CONTEXT_CONTRACT } from "@/widgets/shared/agent-context";

import { AgentTerminalWidget } from "./AgentTerminalWidget";
import { agentTerminalExecutionDefinition } from "./agentTerminalExecution";
import { AgentTerminalWidgetSettings } from "./AgentTerminalWidgetSettings";
import {
  AGENT_TERMINAL_UPSTREAM_CONTEXT_INPUT_ID,
  AGENT_TERMINAL_LATEST_ASSISTANT_MARKDOWN_OUTPUT_ID,
  resolveAgentTerminalLatestAssistantMarkdown,
  type AgentTerminalWidgetProps,
} from "./agentTerminalModel";

export const agentTerminalWidget = defineWidget<AgentTerminalWidgetProps>({
  id: "main-sequence-ai-agent-terminal",
  widgetVersion: "2.0.0",
  title: "Agent Terminal",
  description:
    "Attach a widget to one existing Main Sequence AI AgentSession and continue the conversation through a terminal-style shell.",
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
    agentSessionId: "12345",
    historyRefreshMode: "workspace",
  },
  mockProps: {},
  io: {
    inputs: [{
      id: AGENT_TERMINAL_UPSTREAM_CONTEXT_INPUT_ID,
      label: "Upstream widget context",
      accepts: [CORE_WIDGET_AGENT_CONTEXT_CONTRACT],
      cardinality: "many",
      description:
        "One or more bound widget contexts derived from buildAgentSnapshot(...). These contexts are appended to the saved refresh prompt whenever the terminal refreshes automatically.",
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
        "Connects one widget instance to an existing AgentSession, stores a saved refresh prompt, and can append several bound upstream widget contexts during automated refresh.",
      requiredSetupSteps: [
        "Set the target agent session id.",
        "Optionally configure a saved prompt that runs on refresh.",
        "Optionally bind one or more upstream widget contexts.",
      ],
    },
    runtime: {
      refreshPolicy: "allow-refresh",
      executionTriggers: ["dashboard-refresh", "manual-submit"],
      executionSummary:
        "Owns terminal-style execution against one existing AgentSession, composing saved refresh prompts with bound upstream widget context during automated refresh and publishing the latest assistant markdown output.",
    },
    io: {
      mode: "static",
      summary:
        "Accepts zero or more upstream widget contexts for automated refresh and publishes the latest assistant markdown response.",
    },
    capabilities: {
      acceptedContracts: [CORE_WIDGET_AGENT_CONTEXT_CONTRACT],
      publishedContracts: [CORE_VALUE_STRING_CONTRACT],
    },
    agentHints: {
      buildPurpose:
        "Use this widget to continue an existing Main Sequence AI agent conversation inside a workspace and let the agent reason over other bound widgets during automated refresh.",
      whenToUse: [
        "Use when a workspace needs an interactive terminal attached to one existing agent session.",
        "Use when automated refresh should combine a saved instruction with live widget context from tables, charts, or other snapshot-capable widgets.",
      ],
      whenNotToUse: [
        "Do not use when the goal is only to inspect one bound value or call one HTTP endpoint.",
      ],
      authoringSteps: [
        "Set the agent session id.",
        "Write the saved refresh prompt in settings.",
        "Optionally bind one or more upstream widget contexts from the Bindings tab.",
      ],
      blockingRequirements: ["A valid agent session id is required."],
      commonPitfalls: [
        "This widget expects an existing session rather than creating a new agent workflow from scratch.",
        "Bound widget context is only appended during automated refresh; manual terminal input stays unchanged.",
      ],
    },
  },
  component: AgentTerminalWidget,
});
