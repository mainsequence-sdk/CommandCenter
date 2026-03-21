import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  type ChatRunStatus,
  mockChatBackendAdapter,
} from "@/features/chat/chat-backend-adapter";
import { chatActionDefinitions, type ChatActionDefinition } from "@/features/chat/chat-actions";
import { useChatViewContext, type ChatViewContext } from "@/features/chat/chat-context";
import { CHAT_PAGE_PATH, useChatUiStore } from "@/features/chat/chat-ui-store";

interface ChatFeatureContextValue {
  actionDefinitions: ChatActionDefinition[];
  clearThread: () => void;
  closeOverlay: () => void;
  context: ChatViewContext;
  expandToPage: () => void;
  isOverlayOpen: boolean;
  minimizeToOverlay: () => void;
  runStatus: ChatRunStatus;
  runStatusDetail: string | null;
  thinkingSummary: string | null;
  toggleChat: () => void;
}

const ChatFeatureContext = createContext<ChatFeatureContextValue | null>(null);

function createMessageId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createTextMessage(
  role: "assistant" | "user",
  text: string,
  id = createMessageId(),
): ThreadMessageLike {
  return {
    id,
    role,
    content: [{ type: "text", text }],
  };
}

function extractTextInput(message: AppendMessage) {
  if (message.content.length !== 1 || message.content[0]?.type !== "text") {
    throw new Error("The scaffold currently supports plain text composer input only.");
  }

  return message.content[0].text;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const chatContext = useChatViewContext();
  const isOverlayOpen = useChatUiStore((state) => state.overlayOpen);
  const openOverlay = useChatUiStore((state) => state.openOverlay);
  const closeOverlay = useChatUiStore((state) => state.closeOverlay);
  const pageOriginPath = useChatUiStore((state) => state.pageOriginPath);
  const setPageOriginPath = useChatUiStore((state) => state.setPageOriginPath);
  const [messages, setMessages] = useState<readonly ThreadMessageLike[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<ChatRunStatus>("idle");
  const [runStatusDetail, setRunStatusDetail] = useState<string | null>(null);
  const [thinkingSummary, setThinkingSummary] = useState<string | null>(null);

  useEffect(() => {
    if (location.pathname === CHAT_PAGE_PATH) {
      closeOverlay();
      return;
    }

    setPageOriginPath(`${location.pathname}${location.search}${location.hash}`);
  }, [
    closeOverlay,
    location.hash,
    location.pathname,
    location.search,
    setPageOriginPath,
  ]);

  const updateAssistantText = useCallback((assistantId: string, chunk: string) => {
    setMessages((currentMessages) =>
      currentMessages.map((message) => {
        if (message.id !== assistantId) {
          return message;
        }

        if (!Array.isArray(message.content)) {
          return message;
        }

        const [firstPart, ...rest] = message.content;

        if (!firstPart || firstPart.type !== "text") {
          return message;
        }

        return {
          ...message,
          content: [{ ...firstPart, text: `${firstPart.text}${chunk}` }, ...rest],
        };
      }),
    );
  }, []);

  const clearThread = useCallback(() => {
    setMessages([]);
    setIsRunning(false);
    setRunStatus("idle");
    setRunStatusDetail(null);
    setThinkingSummary(null);
  }, []);

  const onNew = useCallback(
    async (message: AppendMessage) => {
      const input = extractTextInput(message).trim();

      if (!input) {
        return;
      }

      const assistantId = createMessageId();

      setMessages((currentMessages) => [
        ...currentMessages,
        createTextMessage("user", input),
        createTextMessage("assistant", "", assistantId),
      ]);
      setIsRunning(true);
      setRunStatus("queued");
      setRunStatusDetail("Waiting for backend events.");
      setThinkingSummary(null);

      try {
        for await (const event of mockChatBackendAdapter.streamResponse({
          context: chatContext,
          input,
        })) {
          if (event.type === "status") {
            setRunStatus(event.status);
            setRunStatusDetail(event.detail ?? null);
            continue;
          }

          if (event.type === "thinking") {
            setThinkingSummary(event.summary);
            continue;
          }

          if (event.type === "text-delta") {
            updateAssistantText(assistantId, event.text);
            continue;
          }

          if (event.type === "done") {
            setRunStatus("complete");
          }
        }
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "The chat backend adapter failed unexpectedly.";

        setRunStatus("error");
        setRunStatusDetail(detail);
        updateAssistantText(assistantId, `\n\n[adapter error] ${detail}`);
      } finally {
        setIsRunning(false);
      }
    },
    [chatContext, updateAssistantText],
  );

  const runtime = useExternalStoreRuntime<ThreadMessageLike>({
    convertMessage(message) {
      return message;
    },
    isRunning,
    messages,
    onNew,
    setMessages,
  });

  const expandToPage = useCallback(() => {
    if (location.pathname !== CHAT_PAGE_PATH) {
      setPageOriginPath(`${location.pathname}${location.search}${location.hash}`);
    }

    closeOverlay();
    navigate(CHAT_PAGE_PATH);
  }, [
    closeOverlay,
    location.hash,
    location.pathname,
    location.search,
    navigate,
    setPageOriginPath,
  ]);

  const minimizeToOverlay = useCallback(() => {
    openOverlay();

    if (location.pathname === CHAT_PAGE_PATH) {
      navigate(pageOriginPath || "/app");
    }
  }, [location.pathname, navigate, openOverlay, pageOriginPath]);

  const toggleChat = useCallback(() => {
    if (location.pathname === CHAT_PAGE_PATH) {
      closeOverlay();
      navigate(pageOriginPath || "/app");
      return;
    }

    if (isOverlayOpen) {
      closeOverlay();
      return;
    }

    openOverlay();
  }, [closeOverlay, isOverlayOpen, location.pathname, navigate, openOverlay, pageOriginPath]);

  const value = useMemo<ChatFeatureContextValue>(
    () => ({
      actionDefinitions: chatActionDefinitions,
      clearThread,
      closeOverlay,
      context: chatContext,
      expandToPage,
      isOverlayOpen,
      minimizeToOverlay,
      runStatus,
      runStatusDetail,
      thinkingSummary,
      toggleChat,
    }),
    [
      chatContext,
      clearThread,
      closeOverlay,
      expandToPage,
      isOverlayOpen,
      minimizeToOverlay,
      runStatus,
      runStatusDetail,
      thinkingSummary,
      toggleChat,
    ],
  );

  return (
    <ChatFeatureContext.Provider value={value}>
      <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
    </ChatFeatureContext.Provider>
  );
}

export function useChatFeature() {
  const context = useContext(ChatFeatureContext);

  if (!context) {
    throw new Error("useChatFeature must be used inside ChatProvider.");
  }

  return context;
}
