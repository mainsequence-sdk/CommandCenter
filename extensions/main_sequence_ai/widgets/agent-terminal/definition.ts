import { Bot } from "lucide-react";

import { CORE_VALUE_STRING_CONTRACT } from "@/widgets/shared/value-contracts";
import { defineWidget } from "@/widgets/types";

import { AgentTerminalWidget } from "./AgentTerminalWidget";
import { agentTerminalExecutionDefinition } from "./agentTerminalExecution";
import { AgentTerminalWidgetSettings } from "./AgentTerminalWidgetSettings";
import {
  AGENT_TERMINAL_REFRESH_PROMPT_INPUT_ID,
  type AgentTerminalWidgetProps,
} from "./agentTerminalModel";

export const agentTerminalWidget = defineWidget<AgentTerminalWidgetProps>({
  id: "main-sequence-ai-agent-terminal",
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
  },
  settingsComponent: AgentTerminalWidgetSettings,
  showRawPropsEditor: false,
  workspaceIcon: Bot,
  execution: agentTerminalExecutionDefinition,
  component: AgentTerminalWidget,
});
