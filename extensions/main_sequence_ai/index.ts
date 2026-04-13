import type { AppExtension } from "@/app/registry/types";
import { env } from "@/config/env";

import { mainSequenceAiApp } from "./app";
import { agentTerminalWidget } from "./widgets/agent-terminal/definition";
import { upstreamInspectorWidget } from "./widgets/upstream-inspector/definition";

const mainSequenceAiExtension: AppExtension = {
  id: "main_sequence_ai",
  title: "Main Sequence AI",
  description: "Main Sequence AI application surfaces and assistant-ui shell integration.",
  apps: env.includeAui ? [mainSequenceAiApp] : [],
  widgets: env.includeAui ? [agentTerminalWidget, upstreamInspectorWidget] : [],
};

export default mainSequenceAiExtension;

export { ChatMount, ChatProvider } from "./assistant-ui";
export { useOptionalChatFeature } from "./assistant-ui/ChatProvider";
export { CHAT_PAGE_PATH } from "./assistant-ui/chat-ui-store";
