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
import { buildAgentSessionRequestBodyFragment } from "../runtime/agent-session-request";
import type {
  AvailableChatModelOption,
  AvailableChatProviderOption,
  AvailableChatReasoningEffortOption,
} from "../runtime/available-models-api";
import { fetchAvailableRunConfigOptions } from "../runtime/available-models-api";
import {
  resolveMainSequenceAiAssistantChatEndpoint,
  resolveMainSequenceAiAssistantEndpoint,
} from "../runtime/assistant-endpoint";
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
  type AgentSessionRecord,
  type AgentSessionSummary,
  type StreamCreatedAgentSession,
  type StreamSwitchedAgentSession,
} from "./agent-sessions";
import {
  deleteAgentSessionRequest,
  fetchLatestAgentSessions,
} from "./agent-sessions-api";
import {
  type ChatRunStatus,
  mockChatBackendAdapter,
  type ChatBackendHistoryMessage,
} from "./chat-backend-adapter";
import { useChatViewContext, type ChatViewContext } from "./chat-context";
import {
  CHAT_PAGE_PATH,
  resolvePreferredChatRailMode,
  useChatUiStore,
  type ChatRailMode,
} from "./chat-ui-store";
import { fetchSessionHistory } from "./session-history-api";
import { fetchSessionInsights } from "./session-insights-api";
import type { SessionInsightsSnapshot } from "./session-insights";
import { fetchSessionTools } from "./session-tools-api";
import type { SessionToolDefinition, SessionToolsSnapshot } from "./session-tools";
import {
  useLatestMessageDataStreamRuntime,
  type LatestMessageDataStreamProtocol,
} from "./useLatestMessageDataStreamRuntime";

export interface ActiveSessionSummary {
  requestName: string;
  displayName: string | null;
  agentUniqueId: string | null;
  sessionDisplayId: string | null;
  sessionId: string | null;
  agentId: string | null;
  updatedAt: string | null;
  preview: string | null;
  projectId: string | null;
  cwd: string | null;
  threadId: string | null;
  runtimeSessionId: string | null;
  sessionKey: string | null;
  sessionInsights: SessionInsightsSnapshot | null;
  isLoadingInsights: boolean;
  insightsError: string | null;
  availableTools: SessionToolDefinition[];
  isLoadingTools: boolean;
  toolsError: string | null;
}

interface ChatFeatureContextValue {
  activeAgentLabel: string;
  activeAgentName: string;
  activeAgentRequestName: string;
  activeSessionSummary: ActiveSessionSummary | null;
  activeSessionDisplayId: string | null;
  activeSessionPreview: string | null;
  activeSessionUpdatedAt: string | null;
  availableModels: AvailableChatModelOption[];
  availableModelsError: string | null;
  availableProviders: AvailableChatProviderOption[];
  availableReasoningEfforts: AvailableChatReasoningEffortOption[];
  agentId: string | null;
  agentSessions: AgentSessionSummary[];
  clearThread: () => void;
  closeRail: () => void;
  context: ChatViewContext;
  createAgentSession: () => void;
  currentSessionId: string | null;
  deleteAgentSession: (sessionId: string) => Promise<void>;
  expandToPage: () => void;
  hasVisibleAssistantOutput: boolean;
  isRailOpen: boolean;
  isLoadingAvailableModels: boolean;
  isLoadingLatestSessions: boolean;
  isLoadingSessionInsights: boolean;
  isLoadingSessionTools: boolean;
  latestSessionsError: string | null;
  minimizeToRail: () => void;
  railMode: ChatRailMode;
  runStatus: ChatRunStatus;
  runStatusDetail: string | null;
  selectAgentSession: (sessionId: string) => void;
  sessionTools: SessionToolsSnapshot | null;
  sessionToolsBySessionId: Record<string, SessionToolsSnapshot>;
  sessionToolsError: string | null;
  sessionInsightsBySessionId: Record<string, SessionInsightsSnapshot>;
  sessionInsightsError: string | null;
  sessionNotice: string | null;
  selectedModelValue: string | null;
  selectedProviderValue: string | null;
  selectedReasoningEffortValue: string | null;
  setSelectedModelValue: (value: string | null) => void;
  setSelectedProviderValue: (value: string | null) => void;
  setSelectedReasoningEffortValue: (value: string | null) => void;
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

function sortAgentSessions<T extends { updatedAt: string }>(sessions: readonly T[]) {
  return [...sessions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function resolveSessionAgentName(
  session: { agent: { requestName: string; name: string } | null } | null,
) {
  return session?.agent?.requestName || session?.agent?.name || DEFAULT_AGENT_NAME;
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

function resolveSessionApiLookupId(
  session: { id: string; runtimeSessionId: string | null } | null,
) {
  if (!session) {
    return null;
  }

  if (/^\d+$/.test(session.id)) {
    return session.id;
  }

  if (typeof session.runtimeSessionId === "string" && session.runtimeSessionId.trim()) {
    return session.runtimeSessionId.trim();
  }

  return null;
}

function findLatestDockAssistantSession(sessions: readonly AgentSessionRecord[]) {
  return sortAgentSessions(sessions).find((session) => {
    if (session.isPlaceholder || !resolveSessionApiLookupId(session)) {
      return false;
    }

    return resolveSessionAgentRequestName(session) === DEFAULT_AGENT_NAME;
  });
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const chatContext = useChatViewContext();
  const sessionUserId = useAuthStore((state) => state.session?.user.id ?? null);
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const isRailOpen = useChatUiStore((state) => state.railOpen);
  const railMode = useChatUiStore((state) => state.railMode);
  const openRail = useChatUiStore((state) => state.openRail);
  const closeRail = useChatUiStore((state) => state.closeRail);
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
  const [availableModels, setAvailableModels] = useState<AvailableChatModelOption[]>([]);
  const [availableModelsError, setAvailableModelsError] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState<AvailableChatProviderOption[]>([]);
  const [availableReasoningEfforts, setAvailableReasoningEfforts] = useState<
    AvailableChatReasoningEffortOption[]
  >([]);
  const [selectedProviderValue, setSelectedProviderValue] = useState<string | null>(null);
  const [selectedModelValue, setSelectedModelValue] = useState<string | null>(null);
  const [selectedReasoningEffortValue, setSelectedReasoningEffortValue] = useState<string | null>(
    null,
  );
  const [agentId, setAgentId] = useState<string | null>(null);
  const [hasVisibleAssistantOutput, setHasVisibleAssistantOutput] = useState(false);
  const [isLoadingAvailableModels, setIsLoadingAvailableModels] = useState(false);
  const [isLoadingLatestSessions, setIsLoadingLatestSessions] = useState(false);
  const [latestSessionsError, setLatestSessionsError] = useState<string | null>(null);
  const [latestSessionsAgentFilterId, setLatestSessionsAgentFilterId] = useState<number | null>(null);
  const [sessionToolsBySessionId, setSessionToolsBySessionId] = useState<
    Record<string, SessionToolsSnapshot>
  >({});
  const [sessionInsightsBySessionId, setSessionInsightsBySessionId] = useState<
    Record<string, SessionInsightsSnapshot>
  >({});
  const [isLoadingSessionInsights, setIsLoadingSessionInsights] = useState(false);
  const [sessionInsightsError, setSessionInsightsError] = useState<string | null>(null);
  const [isLoadingSessionTools, setIsLoadingSessionTools] = useState(false);
  const [sessionToolsError, setSessionToolsError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const shouldSignalNewChatRef = useRef(true);
  const pendingNewChatRequestRef = useRef(false);
  const expectedNewSessionRef = useRef(false);
  const runtimeRef = useRef<AssistantRuntime | null>(null);
  const selectedSessionRef = useRef<AgentSessionRecord | null>(null);
  const activeSessionRef = useRef<AgentSessionRecord | null>(null);
  const selectedModelValueRef = useRef<string | null>(null);
  const selectedReasoningEffortValueRef = useRef<string | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const loadedSessionIdRef = useRef<string | null>(null);
  const sessionHistoryRequestRef = useRef<AbortController | null>(null);
  const sessionInsightsRequestRef = useRef<AbortController | null>(null);
  const sessionToolsRequestRef = useRef<AbortController | null>(null);
  const availableModelsRequestRef = useRef<AbortController | null>(null);
  const assistantUiEndpoint = useMemo(
    () => resolveMainSequenceAiAssistantEndpoint(),
    [],
  );
  const assistantUiChatEndpoint = useMemo(
    () => resolveMainSequenceAiAssistantChatEndpoint(),
    [],
  );
  const openPreferredRail = useCallback(() => {
    openRail(resolvePreferredChatRailMode());
  }, [openRail]);
  const scheduleOpenPreferredRail = useCallback(() => {
    if (typeof window === "undefined") {
      openPreferredRail();
      return;
    }

    window.requestAnimationFrame(() => {
      openPreferredRail();
    });
  }, [openPreferredRail]);
  const sortedAgentSessions = useMemo(
    () =>
      sortAgentSessions(agentSessions)
        .filter((session) => !session.isPlaceholder)
        .map(summarizeAgentSession),
    [agentSessions],
  );
  const selectedSession = useMemo(
    () => agentSessions.find((session) => session.id === currentSessionId) ?? null,
    [agentSessions, currentSessionId],
  );
  const activeSession = useMemo(
    () => {
      if (!selectedSession) {
        return null;
      }

      return resolveSessionApiLookupId(selectedSession) ? selectedSession : null;
    },
    [selectedSession],
  );
  const activeAgentName = useMemo(
    () => resolveSessionAgentName(selectedSession),
    [selectedSession],
  );
  const activeAgentRequestName = useMemo(
    () => resolveSessionAgentRequestName(selectedSession),
    [selectedSession],
  );
  const activeAgentLabel = useMemo(
    () => resolveSessionAgentLabel(selectedSession),
    [selectedSession],
  );
  const activeSessionDisplayId = useMemo(
    () => resolveSessionDisplayId(activeSession),
    [activeSession],
  );
  const activeSessionPreview = useMemo(
    () => activeSession?.preview ?? null,
    [activeSession],
  );
  const activeSessionUpdatedAt = useMemo(
    () => activeSession?.updatedAt ?? null,
    [activeSession],
  );
  const currentSessionTools = useMemo(() => {
    const sessionLookupId = resolveSessionApiLookupId(activeSession);

    if (!sessionLookupId) {
      return null;
    }

    return sessionToolsBySessionId[sessionLookupId] ?? null;
  }, [activeSession, sessionToolsBySessionId]);
  const currentSessionInsights = useMemo(() => {
    const sessionLookupId =
      activeSession?.runtimeSessionId?.trim() || resolveSessionApiLookupId(activeSession);

    if (!sessionLookupId) {
      return null;
    }

    return sessionInsightsBySessionId[sessionLookupId] ?? null;
  }, [activeSession, sessionInsightsBySessionId]);
  const activeSessionSummary = useMemo<ActiveSessionSummary | null>(() => {
    if (!activeSession) {
      return null;
    }

    const derivedAgentId =
      agentId ??
      (activeSession.agent?.id !== null && activeSession.agent?.id !== undefined
        ? String(activeSession.agent.id)
        : currentSessionTools?.session.agentId !== null &&
            currentSessionTools?.session.agentId !== undefined
          ? String(currentSessionTools.session.agentId)
          : null);

    return {
      requestName: activeSession.agent?.requestName || DEFAULT_AGENT_NAME,
      displayName: activeSession.agent?.name || null,
      agentUniqueId: activeSession.agent?.agentUniqueId || null,
      sessionDisplayId: resolveSessionDisplayId(activeSession),
      sessionId: activeSession.id,
      agentId: derivedAgentId,
      updatedAt: activeSession.updatedAt ?? null,
      preview: activeSession.preview ?? null,
      projectId: activeSession.projectId ?? currentSessionTools?.session.projectId ?? null,
      cwd: activeSession.cwd ?? null,
      threadId: activeSession.threadId ?? null,
      runtimeSessionId: activeSession.runtimeSessionId ?? null,
      sessionKey: activeSession.sessionKey ?? null,
      sessionInsights: currentSessionInsights,
      isLoadingInsights: isLoadingSessionInsights,
      insightsError: sessionInsightsError,
      availableTools: currentSessionTools?.availableTools ?? [],
      isLoadingTools: isLoadingSessionTools,
      toolsError: sessionToolsError,
    };
  }, [
    activeSession,
    agentId,
    currentSessionInsights,
    currentSessionTools,
    isLoadingSessionInsights,
    isLoadingSessionTools,
    sessionInsightsError,
    sessionToolsError,
  ]);

  useEffect(() => {
    if (location.pathname === CHAT_PAGE_PATH) {
      closeRail();
      return;
    }

    setPageOriginPath(`${location.pathname}${location.search}${location.hash}`);
  }, [
    closeRail,
    location.hash,
    location.pathname,
    location.search,
    setPageOriginPath,
  ]);

  useEffect(() => {
    if (!isRailOpen || railMode !== "docked" || location.pathname === CHAT_PAGE_PATH) {
      return;
    }

    const current = selectedSession;
    const hasRealBackendSession = Boolean(resolveSessionApiLookupId(current));
    const isDefaultDraft =
      !current ||
      (!hasRealBackendSession &&
        resolveSessionAgentRequestName(current) === DEFAULT_AGENT_NAME &&
        current.messages.length === 0);

    if (!isDefaultDraft) {
      return;
    }

    const latestAssistantSession = findLatestDockAssistantSession(agentSessions);

    if (!latestAssistantSession || latestAssistantSession.id === currentSessionId) {
      return;
    }

    setCurrentSessionId(latestAssistantSession.id);
  }, [
    agentSessions,
    currentSessionId,
    isRailOpen,
    location.pathname,
    railMode,
    selectedSession,
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
    if (env.useMockData) {
      setAvailableModels([]);
      setAvailableProviders([]);
      setAvailableReasoningEfforts([]);
      setAvailableModelsError(null);
      setIsLoadingAvailableModels(false);
      return;
    }

    availableModelsRequestRef.current?.abort();

    const controller = new AbortController();
    availableModelsRequestRef.current = controller;
    setIsLoadingAvailableModels(true);
    setAvailableModelsError(null);

    void (async () => {
      try {
        const options = await fetchAvailableRunConfigOptions({
          assistantEndpoint: assistantUiEndpoint,
          signal: controller.signal,
          token: sessionToken,
          tokenType: sessionTokenType,
        });

        if (controller.signal.aborted) {
          return;
        }

        setAvailableProviders(options.providers);
        setAvailableModels(options.models);
        setAvailableModelsError(null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setAvailableProviders([]);
        setAvailableModels([]);
        setAvailableReasoningEfforts([]);
        setAvailableModelsError(
          error instanceof Error ? error.message : "Available models request failed.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingAvailableModels(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [assistantUiEndpoint, sessionToken, sessionTokenType]);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        setIsLoadingLatestSessions(true);
        setLatestSessionsError(null);

        const remoteRecords = await fetchLatestAgentSessions({
          agentId: latestSessionsAgentFilterId,
          createdByUser: sessionUserId,
          signal: controller.signal,
          token: sessionToken,
          tokenType: sessionTokenType,
        });

        if (controller.signal.aborted) {
          return;
        }

        setAgentSessions((currentSessions) => {
          const currentById = new Map(currentSessions.map((session) => [session.id, session]));
          const remoteSessions = remoteRecords.map((record) =>
            toAgentSessionRecordFromApi(record, currentById.get(String(record.agent_session || record.id))),
          );
          const currentSession = currentSessions.find(
            (session) => session.id === currentSessionIdRef.current,
          );
          const keepLocalDraft =
            currentSession &&
            (!currentSession.runtimeSessionId || currentSession.isPlaceholder);

          const nextSessions = sortAgentSessions(
            keepLocalDraft
              ? [
                  currentSession,
                  ...remoteSessions.filter((session) => session.id !== currentSession.id),
                ]
              : remoteSessions,
          );

          if (!currentSession || currentSession.isPlaceholder) {
            setCurrentSessionId(nextSessions[0]?.id ?? null);
          } else if (!nextSessions.some((session) => session.id === currentSession.id)) {
            setCurrentSessionId(nextSessions[0]?.id ?? null);
          }

          return nextSessions;
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
  }, [latestSessionsAgentFilterId, sessionToken, sessionTokenType, sessionUserId]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    selectedSessionRef.current = selectedSession;
  }, [selectedSession]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    selectedModelValueRef.current = selectedModelValue;
  }, [selectedModelValue]);

  useEffect(() => {
    selectedReasoningEffortValueRef.current = selectedReasoningEffortValue;
  }, [selectedReasoningEffortValue]);

  useEffect(() => {
    if (!env.debugChat) {
      return;
    }

    console.log("[main_sequence_ai] active session", activeSession);
  }, [activeSession]);

  useEffect(() => {
    writeAgentSessions(sessionUserId, agentSessions);
  }, [agentSessions, sessionUserId]);

  useEffect(() => {
    if (availableProviders.length === 0) {
      if (selectedProviderValue !== null) {
        setSelectedProviderValue(null);
      }
      return;
    }

    if (
      selectedProviderValue &&
      availableProviders.some((provider) => provider.value === selectedProviderValue)
    ) {
      return;
    }

    setSelectedProviderValue(availableProviders[0]?.value ?? null);
  }, [availableProviders, selectedProviderValue]);

  useEffect(() => {
    const filteredModels =
      selectedProviderValue
        ? availableModels.filter((model) => model.provider === selectedProviderValue)
        : availableModels;

    if (filteredModels.length === 0) {
      if (selectedModelValue !== null) {
        setSelectedModelValue(null);
      }
      return;
    }

    if (
      selectedModelValue &&
      filteredModels.some((model) => model.value === selectedModelValue)
    ) {
      return;
    }

    setSelectedModelValue(filteredModels[0]?.value ?? null);
  }, [availableModels, selectedModelValue, selectedProviderValue]);

  useEffect(() => {
    const selectedModel =
      availableModels.find((model) => model.value === selectedModelValue) ?? null;
    const nextReasoningEfforts =
      selectedModel?.reasoningEfforts.length
        ? selectedModel.reasoningEfforts
        : [];

    setAvailableReasoningEfforts(nextReasoningEfforts);
  }, [availableModels, selectedModelValue]);

  useEffect(() => {
    const selectedModel =
      availableModels.find((model) => model.value === selectedModelValue) ?? null;
    const nextReasoningEfforts =
      selectedModel?.reasoningEfforts.length
        ? selectedModel.reasoningEfforts
        : [];
    const defaultReasoningEffort =
      selectedModel?.defaultReasoningEffort ??
      nextReasoningEfforts[0]?.value ??
      null;

    if (nextReasoningEfforts.length === 0) {
      if (selectedReasoningEffortValue !== null) {
        setSelectedReasoningEffortValue(null);
      }
      return;
    }

    if (
      selectedReasoningEffortValue &&
      nextReasoningEfforts.some((effort) => effort.value === selectedReasoningEffortValue)
    ) {
      return;
    }

    setSelectedReasoningEffortValue(defaultReasoningEffort);
  }, [availableModels, selectedModelValue, selectedReasoningEffortValue]);

  useEffect(() => {
    sessionInsightsRequestRef.current?.abort();

    if (env.useMockData) {
      setIsLoadingSessionInsights(false);
      setSessionInsightsError(null);
      return;
    }

    const runtimeSessionId =
      activeSession?.runtimeSessionId?.trim() || resolveSessionApiLookupId(activeSession);

    if (!runtimeSessionId) {
      setIsLoadingSessionInsights(false);
      setSessionInsightsError(null);
      return;
    }

    const controller = new AbortController();
    sessionInsightsRequestRef.current = controller;
    setIsLoadingSessionInsights(true);
    setSessionInsightsError(null);

    void (async () => {
      try {
        const snapshot = await fetchSessionInsights({
          assistantEndpoint: assistantUiEndpoint,
          sessionId: runtimeSessionId,
          signal: controller.signal,
          token: sessionToken,
          tokenType: sessionTokenType,
        });

        if (controller.signal.aborted) {
          return;
        }

        setSessionInsightsBySessionId((current) => ({
          ...current,
          [runtimeSessionId]: snapshot,
        }));
        setSessionInsightsError(null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setSessionInsightsError(
          error instanceof Error ? error.message : "Session insights request failed.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingSessionInsights(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [
    assistantUiEndpoint,
    activeSession?.id,
    activeSession?.runtimeSessionId,
    sessionToken,
    sessionTokenType,
  ]);

  useEffect(() => {
    sessionToolsRequestRef.current?.abort();

    if (env.useMockData) {
      setIsLoadingSessionTools(false);
      setSessionToolsError(null);
      return;
    }

    const runtimeSessionId =
      resolveSessionApiLookupId(activeSession);

    if (!runtimeSessionId) {
      setIsLoadingSessionTools(false);
      setSessionToolsError(null);
      return;
    }

    const controller = new AbortController();
    sessionToolsRequestRef.current = controller;
    setIsLoadingSessionTools(true);
    setSessionToolsError(null);

    void (async () => {
      try {
        const snapshot = await fetchSessionTools({
          assistantEndpoint: assistantUiEndpoint,
          sessionId: runtimeSessionId,
          signal: controller.signal,
          token: sessionToken,
          tokenType: sessionTokenType,
        });

        if (controller.signal.aborted) {
          return;
        }

        setSessionToolsBySessionId((current) => ({
          ...current,
          [runtimeSessionId]: snapshot,
        }));
        setSessionToolsError(null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setSessionToolsError(
          error instanceof Error ? error.message : "Session tools request failed.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingSessionTools(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [
    assistantUiEndpoint,
    activeSession?.id,
    activeSession?.runtimeSessionId,
    sessionToken,
    sessionTokenType,
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

  const deleteAgentSession = useCallback(
    async (sessionId: string) => {
      const session = agentSessions.find((entry) => entry.id === sessionId);
      if (!session) {
        return;
      }

      const backendSessionId = resolveSessionApiLookupId(session);

      try {
        if (backendSessionId) {
          await deleteAgentSessionRequest({
            sessionId: backendSessionId,
            token: sessionToken,
            tokenType: sessionTokenType,
          });
        }

        setLatestSessionsError(null);

        if (currentSessionIdRef.current === sessionId) {
          sessionHistoryRequestRef.current?.abort();
          sessionToolsRequestRef.current?.abort();
          loadedSessionIdRef.current = null;
        }

        setAgentSessions((currentSessions) => {
          const remainingSessions = sortAgentSessions(
            currentSessions.filter((candidate) => candidate.id !== sessionId),
          );

          if (remainingSessions.length === 0) {
            const fallbackSession = createEmptyAgentSession(
              session.agent ?? createDefaultAgentSessionAgent(),
              { placeholder: true },
            );
            setCurrentSessionId(fallbackSession.id);
            return [fallbackSession];
          }

          if (currentSessionIdRef.current === sessionId) {
            setCurrentSessionId(remainingSessions[0]?.id ?? null);
          }

          return remainingSessions;
        });

        setSessionToolsBySessionId((current) => {
          const next = { ...current };

          if (backendSessionId) {
            delete next[backendSessionId];
          }

          return next;
        });
      } catch (error) {
        setLatestSessionsError(
          error instanceof Error ? error.message : "Delete session failed.",
        );
      }
    },
    [agentSessions, sessionToken, sessionTokenType],
  );

  const startAgentSession = useCallback(
    (agent: AgentSearchResult) => {
      persistSessionMessages();
      setLatestSessionsAgentFilterId(agent.id);

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

      sessionHistoryRequestRef.current?.abort();

      const session = agentSessions.find((entry) => entry.id === sessionId);
      if (!session) {
        return;
      }

      const lookupSessionId = resolveSessionApiLookupId(session);
      const fallbackMessages = session.messages;
      runtimeRef.current?.thread.reset(fallbackMessages);
      shouldSignalNewChatRef.current = !lookupSessionId;
      pendingNewChatRequestRef.current = false;
      expectedNewSessionRef.current = false;
      setAgentId(null);
      clearThread();
      loadedSessionIdRef.current = sessionId;

      if (env.useMockData) {
        setMessages(fallbackMessages);
        setIsRunning(false);
        return;
      }

      if (!lookupSessionId) {
        setIsRunning(false);
        return;
      }

      const controller = new AbortController();
      sessionHistoryRequestRef.current = controller;

      void (async () => {
        try {
          const snapshot = await fetchSessionHistory({
            assistantEndpoint: assistantUiEndpoint,
            sessionId: lookupSessionId,
            signal: controller.signal,
            token: sessionToken,
            tokenType: sessionTokenType,
          });

          if (controller.signal.aborted || currentSessionIdRef.current !== sessionId) {
            return;
          }

          runtimeRef.current?.thread.reset(snapshot.messages);
          setAgentId(
            snapshot.session.agentId !== null && snapshot.session.agentId !== undefined
              ? String(snapshot.session.agentId)
              : null,
          );
          setSessionNotice(null);
          setHasVisibleAssistantOutput(
            snapshot.messages.some((message) => message.role === "assistant"),
          );
          setThinkingSummary(null);

          if (snapshot.session.status === "running") {
            setIsRunning(true);
            setRunStatus("responding");
            setRunStatusDetail("Restored live session.");
          } else if (snapshot.session.status === "error") {
            setIsRunning(false);
            setRunStatus("error");
            setRunStatusDetail(snapshot.session.error || "The previous run failed.");
          } else {
            setIsRunning(false);
            setRunStatus("complete");
            setRunStatusDetail("Run completed.");
          }

          setAgentSessions((currentSessions) =>
            sortAgentSessions(
              currentSessions.map((candidate) => {
                if (candidate.id !== sessionId) {
                  return candidate;
                }

                const nextAgent =
                  candidate.agent ?? createDefaultAgentSessionAgent();
                const updatedSessionBase = {
                  ...candidate,
                  runtimeSessionId:
                    snapshot.session.sessionId || candidate.runtimeSessionId,
                  threadId: snapshot.session.threadId || candidate.threadId,
                  updatedAt: snapshot.session.updatedAt || candidate.updatedAt,
                  isPlaceholder: false,
                  agent: {
                    ...nextAgent,
                    id: snapshot.session.agentId ?? nextAgent.id,
                    requestName:
                      snapshot.session.agentName || nextAgent.requestName,
                    name:
                      nextAgent.name || snapshot.session.agentName || DEFAULT_AGENT_LABEL,
                  },
                };

                return updateAgentSessionSnapshot({
                  session: updatedSessionBase,
                  messages: snapshot.messages,
                  updatedAt: snapshot.session.updatedAt || updatedSessionBase.updatedAt,
                });
              }),
            ),
          );
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }

          setIsRunning(false);
          setRunStatus("error");
          setRunStatusDetail(
            error instanceof Error ? error.message : "Session history request failed.",
          );
          setSessionNotice(
            "Failed to rehydrate the selected session. Showing the locally cached transcript.",
          );
        }
      })();
    },
    [
      agentSessions,
      assistantUiEndpoint,
      clearThread,
      sessionToken,
      sessionTokenType,
    ],
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
    api: assistantUiChatEndpoint,
    protocol: commandCenterConfig.assistantUi.protocol as LatestMessageDataStreamProtocol,
    headers: async () => {
      const headers = new Headers();

      if (sessionToken) {
        headers.set("Authorization", `${sessionTokenType} ${sessionToken}`);
      }

      return headers;
    },
    body: async () => {
      const selectedSession = selectedSessionRef.current;
      const activeSession = activeSessionRef.current;
      const selectedSessionId = resolveSessionApiLookupId(activeSession);
      const isNewChatRequest = !activeSession || !selectedSessionId;
      const selectedModel =
        availableModels.find((entry) => entry.value === selectedModelValueRef.current) ??
        availableModels[0] ??
        null;
      const selectedReasoningEffort =
        selectedReasoningEffortValueRef.current ?? availableReasoningEfforts[0]?.value ?? null;

      pendingNewChatRequestRef.current = isNewChatRequest;
      expectedNewSessionRef.current = isNewChatRequest;

      return {
        ...buildAgentSessionRequestBodyFragment({
          agentName: resolveSessionAgentRequestName(selectedSession),
          context: chatContext,
          model: selectedModel
            ? {
                source: selectedModel.source,
                model: selectedModel.value,
                provider: selectedModel.provider,
                ...(selectedReasoningEffort
                  ? {
                      runConfig: {
                        reasoning_effort: selectedReasoningEffort,
                      },
                    }
                  : {}),
              }
            : undefined,
          newChat: isNewChatRequest,
          sessionId: !isNewChatRequest ? selectedSessionId : null,
          threadId:
            !isNewChatRequest ? activeSession?.threadId ?? currentSessionIdRef.current : null,
          userId: sessionUserId,
          workflowKey: activeAgentRequestName,
        }),
        runConfig: undefined,
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
        const activeSession = activeSessionRef.current;
        const currentChatAgentId =
          agentId ??
          (activeSession?.agent?.id !== null && activeSession?.agent?.id !== undefined
            ? String(activeSession.agent.id)
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
    return () => {
      sessionHistoryRequestRef.current?.abort();
    };
  }, []);

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

    closeRail();
    navigate(CHAT_PAGE_PATH);
  }, [
    closeRail,
    location.hash,
    location.pathname,
    location.search,
    navigate,
    setPageOriginPath,
  ]);

  const minimizeToRail = useCallback(() => {
    if (location.pathname === CHAT_PAGE_PATH) {
      navigate(pageOriginPath || "/app");
      scheduleOpenPreferredRail();
      return;
    }

    openPreferredRail();
  }, [location.pathname, navigate, openPreferredRail, pageOriginPath, scheduleOpenPreferredRail]);

  const toggleChat = useCallback(() => {
    if (location.pathname === CHAT_PAGE_PATH) {
      navigate(pageOriginPath || "/app");
      scheduleOpenPreferredRail();
      return;
    }

    if (isRailOpen) {
      closeRail();
      return;
    }

    openPreferredRail();
  }, [
    closeRail,
    isRailOpen,
    location.pathname,
    navigate,
    openPreferredRail,
    pageOriginPath,
    scheduleOpenPreferredRail,
  ]);

  const value = useMemo<ChatFeatureContextValue>(
    () => ({
      activeAgentLabel,
      activeAgentName,
      activeAgentRequestName,
      activeSessionSummary,
      activeSessionDisplayId,
      activeSessionPreview,
      activeSessionUpdatedAt,
      availableModels,
      availableModelsError,
      availableProviders,
      availableReasoningEfforts,
      agentId,
      agentSessions: sortedAgentSessions,
      clearThread: clearRuntimeThread,
      closeRail,
      context: chatContext,
      createAgentSession,
      currentSessionId,
      deleteAgentSession,
      expandToPage,
      hasVisibleAssistantOutput,
      isRailOpen,
      isLoadingAvailableModels,
      isLoadingLatestSessions,
      isLoadingSessionInsights,
      isLoadingSessionTools,
      latestSessionsError,
      minimizeToRail,
      railMode,
      runStatus,
      runStatusDetail,
      selectAgentSession,
      sessionTools: currentSessionTools,
      sessionToolsBySessionId,
      sessionToolsError,
      sessionInsightsBySessionId,
      sessionInsightsError,
      sessionNotice,
      selectedModelValue,
      selectedProviderValue,
      selectedReasoningEffortValue,
      setSelectedModelValue,
      setSelectedProviderValue,
      setSelectedReasoningEffortValue,
      startAgentSession,
      thinkingSummary,
      toggleChat,
    }),
    [
      activeAgentLabel,
      activeAgentName,
      activeAgentRequestName,
      activeSessionSummary,
      activeSessionDisplayId,
      activeSessionPreview,
      activeSessionUpdatedAt,
      availableModels,
      availableModelsError,
      availableProviders,
      availableReasoningEfforts,
      agentId,
      currentSessionId,
      chatContext,
      clearRuntimeThread,
      closeRail,
      createAgentSession,
      deleteAgentSession,
      expandToPage,
      hasVisibleAssistantOutput,
      isRailOpen,
      isLoadingAvailableModels,
      isLoadingLatestSessions,
      isLoadingSessionInsights,
      isLoadingSessionTools,
      latestSessionsError,
      minimizeToRail,
      railMode,
      runStatus,
      runStatusDetail,
      currentSessionTools,
      selectAgentSession,
      sessionToolsBySessionId,
      sessionToolsError,
      sessionInsightsBySessionId,
      sessionInsightsError,
      sessionNotice,
      selectedModelValue,
      selectedProviderValue,
      selectedReasoningEffortValue,
      setSelectedModelValue,
      setSelectedProviderValue,
      setSelectedReasoningEffortValue,
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
