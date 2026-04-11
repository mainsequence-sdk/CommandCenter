import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type AssistantRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";
import type { AgentSearchResult } from "../agent-search";
import {
  attachAgentToSession,
  buildAgentSessionTitle,
  createDefaultAgentSessionAgent,
  createEmptyAgentSession,
  DEFAULT_AGENT_LABEL,
  DEFAULT_AGENT_NAME,
  promoteAgentSessionFromStream,
  readAgentSessions,
  summarizeAgentSession,
  switchAgentSessionFromStream,
  toAgentSessionRecordFromApi,
  updateAgentSessionSnapshot,
  writeAgentSessions,
  type AgentSessionSummary,
  type StreamCreatedAgentSession,
  type StreamSwitchedAgentSession,
} from "./agent-sessions";
import { fetchLatestAgentSessions } from "./agent-sessions-api";
import {
  type ChatRunStatus,
  mockChatBackendAdapter,
  type ChatBackendHistoryMessage,
} from "./chat-backend-adapter";
import { chatActionDefinitions, type ChatActionDefinition } from "./chat-actions";
import { useChatViewContext, type ChatViewContext } from "./chat-context";
import { CHAT_PAGE_PATH, useChatUiStore } from "./chat-ui-store";
import {
  useLatestMessageDataStreamRuntime,
  type LatestMessageDataStreamProtocol,
} from "./useLatestMessageDataStreamRuntime";

interface ChatFeatureContextValue {
  activeAgentLabel: string;
  activeAgentName: string;
  activeAgentRequestName: string;
  activeSessionDisplayId: string | null;
  agentId: string | null;
  agentSessions: AgentSessionSummary[];
  actionDefinitions: ChatActionDefinition[];
  clearThread: () => void;
  closeOverlay: () => void;
  context: ChatViewContext;
  createAgentSession: () => void;
  currentSessionId: string | null;
  expandToPage: () => void;
  hasVisibleAssistantOutput: boolean;
  isOverlayOpen: boolean;
  isLoadingLatestSessions: boolean;
  latestSessionsError: string | null;
  minimizeToOverlay: () => void;
  runStatus: ChatRunStatus;
  runStatusDetail: string | null;
  selectAgentSession: (sessionId: string) => void;
  sessionNotice: string | null;
  startAgentSession: (agent: AgentSearchResult) => void;
  thinkingSummary: string | null;
  toggleChat: () => void;
}

const ChatFeatureContext = createContext<ChatFeatureContextValue | null>(null);

function extractAgentId(data: unknown) {
  if (typeof data === "string") {
    const trimmed = data.trim();
    return trimmed || null;
  }

  if (typeof data === "number" && Number.isFinite(data)) {
    return String(data);
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  const value = (data as Record<string, unknown>).agent_id;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function extractNewSessionChunk(data: Record<string, unknown>): StreamCreatedAgentSession | null {
  if (data.type !== "new_session") {
    return null;
  }

  const payload = data.new_session;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  const rawAgentSessionId = candidate.agent_session_id;

  if (
    typeof rawAgentSessionId !== "string" &&
    !(typeof rawAgentSessionId === "number" && Number.isFinite(rawAgentSessionId))
  ) {
    return null;
  }

  const rawAgentId = candidate.agent_id;
  const parsedAgentId =
    typeof rawAgentId === "number" && Number.isFinite(rawAgentId)
      ? rawAgentId
      : typeof rawAgentId === "string" && rawAgentId.trim()
        ? Number(rawAgentId)
        : null;

  return {
    agentId: parsedAgentId !== null && Number.isFinite(parsedAgentId) ? parsedAgentId : null,
    agentSessionId: String(rawAgentSessionId),
    agentUniqueId:
      typeof candidate.agent_unique_id === "string" && candidate.agent_unique_id.trim()
        ? candidate.agent_unique_id.trim()
        : null,
    sessionKey:
      typeof candidate.session_key === "string" && candidate.session_key.trim()
        ? candidate.session_key.trim()
        : null,
    threadId:
      typeof candidate.thread_id === "string" && candidate.thread_id.trim()
        ? candidate.thread_id.trim()
        : null,
  };
}

function extractSessionSwitchChunk(data: Record<string, unknown>): StreamSwitchedAgentSession | null {
  if (data.type !== "session_switch") {
    return null;
  }

  const payload = data.session_switch;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  const rawAgentSessionId = candidate.agent_session_id;
  const rawToAgentName = candidate.to_agent_name;

  if (
    (typeof rawAgentSessionId !== "string" &&
      !(typeof rawAgentSessionId === "number" && Number.isFinite(rawAgentSessionId))) ||
    typeof rawToAgentName !== "string" ||
    !rawToAgentName.trim()
  ) {
    return null;
  }

  const rawAgentId = candidate.agent_id;
  const parsedAgentId =
    typeof rawAgentId === "number" && Number.isFinite(rawAgentId)
      ? rawAgentId
      : typeof rawAgentId === "string" && rawAgentId.trim()
        ? Number(rawAgentId)
        : null;

  return {
    fromAgentName:
      typeof candidate.from_agent_name === "string" && candidate.from_agent_name.trim()
        ? candidate.from_agent_name.trim()
        : null,
    toAgentName: rawToAgentName.trim(),
    projectId:
      typeof candidate.project_id === "string" && candidate.project_id.trim()
        ? candidate.project_id.trim()
        : null,
    cwd:
      typeof candidate.cwd === "string" && candidate.cwd.trim()
        ? candidate.cwd.trim()
        : null,
    threadId:
      typeof candidate.thread_id === "string" && candidate.thread_id.trim()
        ? candidate.thread_id.trim()
        : null,
    agentId: parsedAgentId !== null && Number.isFinite(parsedAgentId) ? parsedAgentId : null,
    agentUniqueId:
      typeof candidate.agent_unique_id === "string" && candidate.agent_unique_id.trim()
        ? candidate.agent_unique_id.trim()
        : null,
    agentSessionId: String(rawAgentSessionId),
    sessionKey:
      typeof candidate.session_key === "string" && candidate.session_key.trim()
        ? candidate.session_key.trim()
        : null,
    runtimeSessionId:
      typeof candidate.runtime_session_id === "string" && candidate.runtime_session_id.trim()
        ? candidate.runtime_session_id.trim()
        : null,
    initialTask:
      typeof candidate.initial_task === "string" && candidate.initial_task.trim()
        ? candidate.initial_task.trim()
        : null,
    summary:
      typeof candidate.summary === "string" && candidate.summary.trim()
        ? candidate.summary.trim()
        : null,
  };
}

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
    throw new Error("The chat runtime currently supports plain text composer input only.");
  }

  return message.content[0].text;
}

function serializeThreadHistory(
  messages: readonly ThreadMessageLike[],
  input: string,
): ChatBackendHistoryMessage[] {
  const history: ChatBackendHistoryMessage[] = [];

  for (const message of messages) {
    const text = Array.isArray(message.content)
      ? message.content
          .flatMap((part) => (part.type === "text" && part.text ? [part.text] : []))
          .join("")
          .trim()
      : typeof message.content === "string"
        ? message.content.trim()
        : "";

    if (!text || (message.role !== "assistant" && message.role !== "user")) {
      continue;
    }

    history.push({
      id: message.id,
      role: message.role,
      text,
    });
  }

  history.push({
    role: "user",
    text: input,
  });

  return history;
}

function normalizePlatformAgentApi(endpoint: string) {
  const trimmed = endpoint.trim();

  if (!trimmed) {
    throw new Error("assistant_ui.endpoint is blank.");
  }

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }

  const protocol = window.location.protocol === "https:" ? "https://" : "http://";
  return `${protocol}${trimmed}`;
}

function sortAgentSessions<T extends { updatedAt: string }>(sessions: readonly T[]) {
  return [...sessions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function mergeAgentSessionsById<T extends { id: string }>(sessions: readonly T[]) {
  const merged = new Map<string, T>();

  for (const session of sessions) {
    if (!merged.has(session.id)) {
      merged.set(session.id, session);
    }
  }

  return [...merged.values()];
}

function resolveSessionAgentName(session: { agent: { name: string } | null } | null) {
  return session?.agent?.name || DEFAULT_AGENT_LABEL;
}

function resolveSessionAgentRequestName(session: { agent: { requestName: string } | null } | null) {
  return session?.agent?.requestName || DEFAULT_AGENT_NAME;
}

function resolveSessionAgentLabel(
  session: { agent: { agentUniqueId: string; name: string } | null } | null,
) {
  return session?.agent?.agentUniqueId || session?.agent?.name || DEFAULT_AGENT_NAME;
}

function resolveSessionDisplayId(
  session: { id: string; runtimeSessionId: string | null } | null,
) {
  if (!session) {
    return null;
  }

  if (typeof session.runtimeSessionId === "string" && session.runtimeSessionId.trim()) {
    return session.runtimeSessionId.trim();
  }

  return /^\d+$/.test(session.id) ? session.id : null;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const chatContext = useChatViewContext();
  const sessionUserId = useAuthStore((state) => state.session?.user.id ?? null);
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const isOverlayOpen = useChatUiStore((state) => state.overlayOpen);
  const openOverlay = useChatUiStore((state) => state.openOverlay);
  const closeOverlay = useChatUiStore((state) => state.closeOverlay);
  const pageOriginPath = useChatUiStore((state) => state.pageOriginPath);
  const setPageOriginPath = useChatUiStore((state) => state.setPageOriginPath);
  const initialSessionRef = useRef(
    createEmptyAgentSession(createDefaultAgentSessionAgent(), { placeholder: true }),
  );
  const [messages, setMessages] = useState<readonly ThreadMessageLike[]>([]);
  const [agentSessions, setAgentSessions] = useState(() => [initialSessionRef.current]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    () => initialSessionRef.current.id,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<ChatRunStatus>("idle");
  const [runStatusDetail, setRunStatusDetail] = useState<string | null>(null);
  const [thinkingSummary, setThinkingSummary] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [hasVisibleAssistantOutput, setHasVisibleAssistantOutput] = useState(false);
  const [isLoadingLatestSessions, setIsLoadingLatestSessions] = useState(false);
  const [latestSessionsError, setLatestSessionsError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const shouldSignalNewChatRef = useRef(true);
  const pendingNewChatRequestRef = useRef(false);
  const expectedNewSessionRef = useRef(false);
  const runtimeRef = useRef<AssistantRuntime | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const loadedSessionIdRef = useRef<string | null>(null);
  const assistantUiEndpoint = useMemo(
    () => normalizePlatformAgentApi(commandCenterConfig.assistantUi.endpoint),
    [],
  );
  const sortedAgentSessions = useMemo(
    () =>
      sortAgentSessions(agentSessions)
        .filter((session) => !session.isPlaceholder)
        .map(summarizeAgentSession),
    [agentSessions],
  );
  const currentSession = useMemo(
    () => agentSessions.find((session) => session.id === currentSessionId) ?? null,
    [agentSessions, currentSessionId],
  );
  const activeAgentName = useMemo(
    () => resolveSessionAgentName(currentSession),
    [currentSession],
  );
  const activeAgentRequestName = useMemo(
    () => resolveSessionAgentRequestName(currentSession),
    [currentSession],
  );
  const activeAgentLabel = useMemo(
    () => resolveSessionAgentLabel(currentSession),
    [currentSession],
  );
  const activeSessionDisplayId = useMemo(
    () => resolveSessionDisplayId(currentSession),
    [currentSession],
  );

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

  useEffect(() => {
    const restoredSessions = sortAgentSessions(readAgentSessions(sessionUserId));
    const nextSessions =
      restoredSessions.length > 0
        ? restoredSessions
        : [createEmptyAgentSession(createDefaultAgentSessionAgent(), { placeholder: true })];

    setAgentSessions(nextSessions);
    setCurrentSessionId(nextSessions[0]?.id ?? null);
    loadedSessionIdRef.current = null;
  }, [sessionUserId]);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        setIsLoadingLatestSessions(true);
        setLatestSessionsError(null);

        const remoteRecords = await fetchLatestAgentSessions({
          createdByUser: sessionUserId,
          signal: controller.signal,
          token: sessionToken,
          tokenType: sessionTokenType,
        });

        if (controller.signal.aborted || remoteRecords.length === 0) {
          return;
        }

        setAgentSessions((currentSessions) => {
          const currentById = new Map(currentSessions.map((session) => [session.id, session]));
          const remoteSessions = remoteRecords.map((record) =>
            toAgentSessionRecordFromApi(record, currentById.get(String(record.agent_session || record.id))),
          );
          const mergedSessions = sortAgentSessions(
            mergeAgentSessionsById([...remoteSessions, ...currentSessions]),
          );

          const currentSession = currentSessions.find(
            (session) => session.id === currentSessionIdRef.current,
          );
          const currentIsSyntheticEmpty = !currentSession || currentSession.isPlaceholder;

          if (currentIsSyntheticEmpty && mergedSessions[0]) {
            setCurrentSessionId(mergedSessions[0].id);
          }

          return mergedSessions;
        });
        setLatestSessionsError(null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setLatestSessionsError(
          error instanceof Error
            ? error.message
            : "Latest agent sessions request failed.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingLatestSessions(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [sessionToken, sessionTokenType, sessionUserId]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    writeAgentSessions(sessionUserId, agentSessions);
  }, [agentSessions, sessionUserId]);

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

  const persistSessionMessages = useCallback((nextMessages?: readonly ThreadMessageLike[]) => {
    const sessionId = currentSessionIdRef.current;

    if (!sessionId) {
      return;
    }

    const sourceMessages =
      nextMessages ??
      ((runtimeRef.current?.thread.getState().messages as readonly ThreadMessageLike[] | undefined) ??
        []);

    setAgentSessions((currentSessions) =>
      sortAgentSessions(
        currentSessions.map((session) =>
          session.id === sessionId
            ? updateAgentSessionSnapshot({
                session,
                messages: sourceMessages,
              })
            : session,
        ),
      ),
    );
  }, []);

  const promoteCurrentSessionFromStream = useCallback((streamSession: StreamCreatedAgentSession) => {
    const currentId = currentSessionIdRef.current;

    if (!currentId) {
      return;
    }

    const sourceMessages =
      ((runtimeRef.current?.thread.getState().messages as readonly ThreadMessageLike[] | undefined) ??
        []);
    const nextSessionId = streamSession.agentSessionId;

    setAgentSessions((currentSessions) => {
      const currentSession = currentSessions.find((session) => session.id === currentId);

      if (!currentSession) {
        return currentSessions;
      }

      const existingTarget =
        nextSessionId === currentId
          ? currentSession
          : currentSessions.find((session) => session.id === nextSessionId) ?? null;
      const promotedSession = promoteAgentSessionFromStream({
        session: existingTarget ?? currentSession,
        stream: streamSession,
        messages: sourceMessages.length > 0 ? sourceMessages : currentSession.messages,
      });

      return sortAgentSessions([
        promotedSession,
        ...currentSessions.filter(
          (session) => session.id !== currentId && session.id !== nextSessionId,
        ),
      ]);
    });

    if (nextSessionId !== currentId) {
      loadedSessionIdRef.current = nextSessionId;
      currentSessionIdRef.current = nextSessionId;
      setCurrentSessionId(nextSessionId);
    }
  }, []);

  const switchCurrentSessionFromStream = useCallback((streamSession: StreamSwitchedAgentSession) => {
    const currentId = currentSessionIdRef.current;

    if (!currentId) {
      return;
    }

    const sourceMessages =
      ((runtimeRef.current?.thread.getState().messages as readonly ThreadMessageLike[] | undefined) ??
        []);
    const nextSessionId = streamSession.agentSessionId;

    setAgentSessions((currentSessions) => {
      const currentSession = currentSessions.find((session) => session.id === currentId);

      if (!currentSession) {
        return currentSessions;
      }

      const existingTarget =
        nextSessionId === currentId
          ? currentSession
          : currentSessions.find((session) => session.id === nextSessionId) ?? null;
      const switchedSession = switchAgentSessionFromStream({
        session: existingTarget ?? currentSession,
        stream: streamSession,
        messages: sourceMessages.length > 0 ? sourceMessages : currentSession.messages,
      });

      return sortAgentSessions([
        switchedSession,
        ...currentSessions.filter(
          (session) => session.id !== currentId && session.id !== nextSessionId,
        ),
      ]);
    });

    loadedSessionIdRef.current = nextSessionId;
    currentSessionIdRef.current = nextSessionId;
    setCurrentSessionId(nextSessionId);
  }, []);

  const selectAgentSession = useCallback(
    (sessionId: string) => {
      if (currentSessionIdRef.current === sessionId) {
        return;
      }

      persistSessionMessages();
      setCurrentSessionId(sessionId);
    },
    [persistSessionMessages],
  );

  const createAgentSession = useCallback(() => {
    persistSessionMessages();

    setAgentSessions((currentSessions) => {
      const current = currentSessions.find((session) => session.id === currentSessionIdRef.current);
      const launchAgent = current?.agent ?? createDefaultAgentSessionAgent();

      if (
        current &&
        current.isPlaceholder &&
        current.messages.length === 0 &&
        current.agent !== null
      ) {
        const nextCurrent = {
          ...current,
          isPlaceholder: false,
          updatedAt: new Date().toISOString(),
        };
        setCurrentSessionId(nextCurrent.id);
        return sortAgentSessions(
          currentSessions.map((session) => (session.id === nextCurrent.id ? nextCurrent : session)),
        );
      }

      const nextSession = createEmptyAgentSession(launchAgent);
      setCurrentSessionId(nextSession.id);
      return sortAgentSessions([nextSession, ...currentSessions]);
    });
  }, [persistSessionMessages]);

  const startAgentSession = useCallback(
    (agent: AgentSearchResult) => {
      persistSessionMessages();

      setAgentSessions((currentSessions) => {
        const current = currentSessions.find((session) => session.id === currentSessionIdRef.current);

        if (current && current.messages.length === 0) {
          const nextCurrent = attachAgentToSession(current, agent);
          setCurrentSessionId(nextCurrent.id);
          return sortAgentSessions(
            currentSessions.map((session) => (session.id === nextCurrent.id ? nextCurrent : session)),
          );
        }

        const nextSession = attachAgentToSession(createEmptyAgentSession(), agent);
        setCurrentSessionId(nextSession.id);
        return sortAgentSessions([nextSession, ...currentSessions]);
      });
    },
    [persistSessionMessages],
  );

  const clearThread = useCallback(() => {
    setRunStatus("idle");
    setRunStatusDetail(null);
    setThinkingSummary(null);
    setHasVisibleAssistantOutput(false);
    setSessionNotice(null);
  }, []);

  const loadCurrentSession = useCallback(
    (sessionId: string | null) => {
      if (!sessionId || loadedSessionIdRef.current === sessionId) {
        return;
      }

      const session = agentSessions.find((entry) => entry.id === sessionId);
      if (!session) {
        return;
      }

      runtimeRef.current?.thread.reset(session.messages);
      shouldSignalNewChatRef.current = !session.runtimeSessionId;
      pendingNewChatRequestRef.current = false;
      expectedNewSessionRef.current = false;
      setAgentId(null);
      clearThread();
      loadedSessionIdRef.current = sessionId;

      if (env.useMockData) {
        setMessages(session.messages);
        setIsRunning(false);
      }
    },
    [agentSessions, clearThread],
  );

  const onNew = useCallback(
    async (message: AppendMessage) => {
      const input = extractTextInput(message).trim();

      if (!input) {
        return;
      }

      const history = serializeThreadHistory(messages, input);
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
      setHasVisibleAssistantOutput(false);
      setSessionNotice(null);

      try {
        for await (const event of mockChatBackendAdapter.streamResponse({
          context: chatContext,
          history,
          input,
        })) {
          if (event.type === "status") {
            setRunStatus(event.status);
            setRunStatusDetail(event.detail ?? null);
            continue;
          }

          if (event.type === "thinking") {
            setRunStatus((currentStatus) =>
              currentStatus === "queued" ? "thinking" : currentStatus,
            );
            setRunStatusDetail((currentDetail) => currentDetail ?? "Receiving reasoning updates.");
            setThinkingSummary(event.summary);
            continue;
          }

          if (event.type === "text-delta") {
            setRunStatus((currentStatus) =>
              currentStatus === "queued" || currentStatus === "thinking"
                ? "responding"
                : currentStatus,
            );
            setRunStatusDetail((currentDetail) => currentDetail ?? "Streaming assistant output.");
            setHasVisibleAssistantOutput(true);
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
    [chatContext, messages, updateAssistantText],
  );

  const mockRuntime = useExternalStoreRuntime<ThreadMessageLike>({
    convertMessage(message) {
      return message;
    },
    isRunning,
    messages,
    onNew,
    setMessages,
  });

  const liveRuntime = useLatestMessageDataStreamRuntime({
    api: assistantUiEndpoint,
    protocol: commandCenterConfig.assistantUi.protocol as LatestMessageDataStreamProtocol,
    headers: async () => {
      const headers = new Headers();

      if (sessionToken) {
        headers.set("Authorization", `${sessionTokenType} ${sessionToken}`);
      }

      return headers;
    },
    body: async () => {
      const isNewChatRequest =
        shouldSignalNewChatRef.current || !currentSession?.runtimeSessionId;

      pendingNewChatRequestRef.current = isNewChatRequest;
      expectedNewSessionRef.current = isNewChatRequest;

      return {
        ...(isNewChatRequest ? { newChat: true } : {}),
        agentName: activeAgentRequestName,
        ...(sessionUserId ? { userId: sessionUserId } : {}),
        ...(!isNewChatRequest
          ? currentSession?.threadId
            ? { threadId: currentSession.threadId }
            : currentSessionId
              ? { threadId: currentSessionId }
              : {}
          : {}),
        ...(!isNewChatRequest && currentSession?.runtimeSessionId
          ? { runtime_session_id: currentSession.runtimeSessionId }
          : {}),
        sessionMetadata: {
          source: "frontend",
          workflow_key: activeAgentRequestName,
        },
        context: chatContext,
      };
    },
    onRequestStart: async () => {
      setRunStatus("queued");
      setRunStatusDetail("Working on your request.");
      setThinkingSummary(null);
      setHasVisibleAssistantOutput(false);
      setSessionNotice(null);
    },
    onResponse: async () => {
      setRunStatus("queued");
      setRunStatusDetail("Thinking...");
      setThinkingSummary(null);
    },
    onChunk: ({ type, data }) => {
      const streamSession = extractNewSessionChunk(data);

      if (streamSession) {
        expectedNewSessionRef.current = false;
        const chunkAgentId =
          streamSession.agentId !== null ? String(streamSession.agentId) : extractAgentId(data);
        const currentChatAgentId =
          agentId ??
          (currentSession?.agent?.id !== null && currentSession?.agent?.id !== undefined
            ? String(currentSession.agent.id)
            : null);
        const belongsToCurrentAgent =
          !currentChatAgentId || !chunkAgentId || chunkAgentId === currentChatAgentId;

        if (belongsToCurrentAgent) {
          promoteCurrentSessionFromStream(streamSession);
          shouldSignalNewChatRef.current = false;
          pendingNewChatRequestRef.current = false;
          setSessionNotice(null);
        } else {
          setSessionNotice(
            `A new agent session was created by agent ${chunkAgentId}. Cross-agent session handoff is not implemented yet.`,
          );
        }

        return;
      }

      const switchedSession = extractSessionSwitchChunk(data);

      if (switchedSession) {
        switchCurrentSessionFromStream(switchedSession);
        shouldSignalNewChatRef.current = false;
        pendingNewChatRequestRef.current = false;
        setSessionNotice(null);

        if (switchedSession.agentId !== null) {
          setAgentId(String(switchedSession.agentId));
        }

        return;
      }

      if (type === "reasoning-delta") {
        setRunStatus("thinking");
        setRunStatusDetail("Thinking...");
        setHasVisibleAssistantOutput(true);

        if (typeof data.delta === "string" && data.delta.trim()) {
          setThinkingSummary(data.delta.trim());
        }

        return;
      }

      if (type === "text-delta") {
        setRunStatus("responding");
        setRunStatusDetail("Writing a response...");
        setThinkingSummary(null);
        setHasVisibleAssistantOutput(true);
      }
    },
    onData: (data) => {
      const nextAgentId = extractAgentId(data.data);

      if (nextAgentId) {
        setAgentId(nextAgentId);
      }
    },
    onFinish: () => {
      if (expectedNewSessionRef.current) {
        setRunStatus("error");
        setRunStatusDetail("The assistant did not assign a runtime session.");
        setSessionNotice(
          "This new conversation did not receive the required session assignment. Retry the message before continuing.",
        );
        shouldSignalNewChatRef.current = true;
        pendingNewChatRequestRef.current = false;
        expectedNewSessionRef.current = false;
        persistSessionMessages();
        return;
      }

      setRunStatus("complete");
      setRunStatusDetail("Run completed.");
      setThinkingSummary(null);
      pendingNewChatRequestRef.current = false;
      persistSessionMessages();
    },
    onError: (error) => {
      setRunStatus("error");
      setRunStatusDetail(error.message);
      setThinkingSummary(null);
      pendingNewChatRequestRef.current = false;
      expectedNewSessionRef.current = false;
      persistSessionMessages();
    },
    onCancel: () => {
      setRunStatus("idle");
      setRunStatusDetail("Run cancelled.");
      setThinkingSummary(null);
      pendingNewChatRequestRef.current = false;
      expectedNewSessionRef.current = false;
      persistSessionMessages();
    },
  });

  const runtime: AssistantRuntime = env.useMockData ? mockRuntime : liveRuntime;

  useEffect(() => {
    runtimeRef.current = runtime;
  }, [runtime]);

  useEffect(() => {
    loadCurrentSession(currentSessionId);
  }, [currentSessionId, loadCurrentSession]);

  useEffect(() => {
    if (!env.useMockData || !currentSessionId) {
      return;
    }

    persistSessionMessages(messages);
  }, [currentSessionId, messages, persistSessionMessages]);

  const clearRuntimeThread = useCallback(() => {
    runtime.thread.reset();
    shouldSignalNewChatRef.current = true;
    pendingNewChatRequestRef.current = false;
    expectedNewSessionRef.current = false;
    setAgentId(null);
    loadedSessionIdRef.current = currentSessionIdRef.current;

    setAgentSessions((currentSessions) =>
      sortAgentSessions(
        currentSessions.map((session) => {
          if (session.id !== currentSessionIdRef.current) {
            return session;
          }

          return {
            ...session,
            messages: [],
            preview: null,
            runtimeSessionId: null,
            sessionKey: null,
            threadId: null,
            projectId: null,
            cwd: null,
            title: buildAgentSessionTitle({
              agent: session.agent,
              messages: [],
            }),
            updatedAt: new Date().toISOString(),
          };
        }),
      ),
    );

    if (env.useMockData) {
      setMessages([]);
      setIsRunning(false);
    }

    clearThread();
  }, [clearThread, runtime]);

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
      activeAgentLabel,
      activeAgentName,
      activeAgentRequestName,
      activeSessionDisplayId,
      agentId,
      agentSessions: sortedAgentSessions,
      actionDefinitions: chatActionDefinitions,
      clearThread: clearRuntimeThread,
      closeOverlay,
      context: chatContext,
      createAgentSession,
      currentSessionId,
      expandToPage,
      hasVisibleAssistantOutput,
      isOverlayOpen,
      isLoadingLatestSessions,
      latestSessionsError,
      minimizeToOverlay,
      runStatus,
      runStatusDetail,
      selectAgentSession,
      sessionNotice,
      startAgentSession,
      thinkingSummary,
      toggleChat,
    }),
    [
      activeAgentLabel,
      activeAgentName,
      activeAgentRequestName,
      activeSessionDisplayId,
      agentId,
      currentSessionId,
      chatContext,
      clearRuntimeThread,
      closeOverlay,
      createAgentSession,
      expandToPage,
      hasVisibleAssistantOutput,
      isOverlayOpen,
      isLoadingLatestSessions,
      latestSessionsError,
      minimizeToOverlay,
      runStatus,
      runStatusDetail,
      selectAgentSession,
      sessionNotice,
      sortedAgentSessions,
      startAgentSession,
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

export function useOptionalChatFeature() {
  return useContext(ChatFeatureContext);
}
