import { Bot } from "lucide-react";

import { CORE_VALUE_STRING_CONTRACT } from "@/widgets/shared/value-contracts";
import { defineWidget } from "@/widgets/types";

import { AgentTerminalWidget } from "./AgentTerminalWidget";
import { agentTerminalExecutionDefinition } from "./agentTerminalExecution";
import { AgentTerminalWidgetSettings } from "./AgentTerminalWidgetSettings";
import {
  AGENT_TERMINAL_REFRESH_PROMPT_INPUT_ID,
  AGENT_TERMINAL_LATEST_ASSISTANT_MARKDOWN_OUTPUT_ID,
  resolveAgentTerminalLatestAssistantMarkdown,
  type AgentTerminalWidgetProps,
} from "./agentTerminalModel";

export const agentTerminalWidget = defineWidget<AgentTerminalWidgetProps>({
  id: "main-sequence-ai-agent-terminal",
  widgetVersion: "1.0.0",
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
      id: AGENT_TERMINAL_REFRESH_PROMPT_INPUT_ID,
      label: "Prompt on refresh",
      accepts: [CORE_VALUE_STRING_CONTRACT],
      description:
        "Markdown prompt to send into the bound AgentSession whenever this widget refreshes.",
      effects: [{
        kind: "drives-value",
        sourcePath: AGENT_TERMINAL_REFRESH_PROMPT_INPUT_ID,
        target: { kind: "prop", path: "promptOnRefresh" },
        description: "Bound text overrides the saved refresh prompt.",
      }],
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
        "Connects one widget instance to an existing AgentSession and optional refresh prompt behavior.",
      requiredSetupSteps: [
        "Set the target agent session id.",
        "Optionally configure a prompt that runs on refresh.",
      ],
    },
    runtime: {
      refreshPolicy: "allow-refresh",
      executionTriggers: ["dashboard-refresh", "manual-submit"],
      executionSummary:
        "Owns terminal-style execution against one existing AgentSession and publishes the latest assistant markdown output.",
    },
    io: {
      mode: "static",
      summary:
        "Accepts an optional refresh prompt input and publishes the latest assistant markdown response.",
    },
    capabilities: {
      acceptedContracts: [CORE_VALUE_STRING_CONTRACT],
      publishedContracts: [CORE_VALUE_STRING_CONTRACT],
    },
    agentHints: {
      buildPurpose:
        "Use this widget to continue an existing Main Sequence AI agent conversation inside a workspace.",
      whenToUse: [
        "Use when a workspace needs an interactive terminal attached to one existing agent session.",
      ],
      whenNotToUse: [
        "Do not use when the goal is only to inspect one bound value or call one HTTP endpoint.",
      ],
      authoringSteps: [
        "Set the agent session id.",
        "Optionally bind or save a refresh prompt.",
      ],
      blockingRequirements: ["A valid agent session id is required."],
      commonPitfalls: [
        "This widget expects an existing session rather than creating a new agent workflow from scratch.",
      ],
    },
  },
  component: AgentTerminalWidget,
});
