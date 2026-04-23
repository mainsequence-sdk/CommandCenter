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
import { useToast } from "@/components/ui/toaster";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";
import { useAgentSessionDetail } from "../agent-session-detail/useAgentSessionDetail";
import {
  buildActiveSessionSummary,
  resolveAgentSessionDisplayId,
  resolveAgentSessionLabel,
  resolveAgentSessionLookupId,
  resolveAgentSessionRequestName,
  type ActiveSessionSummary,
  type AgentSessionDetailSnapshot,
} from "../agent-session-detail/model";
import type { AgentSearchResult } from "../agent-search";
import { buildAgentSessionRequestBodyFragment } from "../runtime/agent-session-request";
import type {
  AvailableChatModelOption,
  AvailableChatProviderOption,
  AvailableChatReasoningEffortOption,
} from "../runtime/available-models-api";
import { fetchAvailableRunConfigOptions } from "../runtime/available-models-api";
import {
  clearMainSequenceAiResolvedRuntimeAccess,
  fetchMainSequenceAiCommandCenterRuntimeHandle,
  fetchMainSequenceAiAssistantResponse,
  isMainSequenceAiAssistantProxyMode,
} from "../runtime/assistant-endpoint";
import { fetchOrCreateCommandCenterBaseSession } from "../runtime/command-center-base-session-api";
import { cancelChatSession } from "../runtime/session-cancel-api";
import {
  attachAgentToSession,
  buildAgentSessionTitle,
  createAgentSessionFromStreamHandoff,
  createDefaultAgentSessionAgent,
  createEmptyAgentSession,
  DEFAULT_AGENT_LABEL,
  DEFAULT_AGENT_NAME,
  promoteAgentSessionFromStream,
  readAgentSessions,
  summarizeAgentSession,
  switchAgentSessionFromStream,
  toAgentSessionRecordFromBaseHandle,
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
  fetchAgentSessionDetail,
  fetchLatestAgentSessions,
  patchAgentSessionModelConfig,
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
import {
  useLatestMessageDataStreamRuntime,
  type LatestMessageDataStreamProtocol,
} from "./useLatestMessageDataStreamRuntime";

export interface PendingSessionHandoff {
  agentId: string | null;
  sessionId: string;
}

interface ChatFeatureContextValue {
  activeAgentLabel: string;
  activeAgentName: string;
  activeAgentRequestName: string;
  activeSessionDetail: AgentSessionDetailSnapshot | null;
  activeSessionSummary: ActiveSessionSummary | null;
  activeSessionDisplayId: string | null;
  activeSessionPreview: string | null;
  activeSessionUpdatedAt: string | null;
  activateSessionHandoff: () => void;
  availableModels: AvailableChatModelOption[];
  availableModelsError: string | null;
  availableProviders: AvailableChatProviderOption[];
  availableReasoningEfforts: AvailableChatReasoningEffortOption[];
  agentId: string | null;
  agentSessions: AgentSessionSummary[];
  baseSessionError: string | null;
  cancelActiveSession: () => Promise<void>;
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
  isLoadingBaseSession: boolean;
  isCancellingSession: boolean;
  isLoadingLatestSessions: boolean;
  latestSessionsError: string | null;
  minimizeToRail: () => void;
  pendingSessionHandoff: PendingSessionHandoff | null;
  railMode: ChatRailMode;
  refreshSessionDetail: () => void;
  refreshSessionInsights: () => void;
  runStatus: ChatRunStatus;
  runStatusDetail: string | null;
  selectAgentSession: (sessionId: string) => void;
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

function normalizeCatalogKey(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

function findProviderValueBySessionProvider(
  providers: readonly AvailableChatProviderOption[],
  provider: string | null | undefined,
) {
  const normalizedProvider = normalizeCatalogKey(provider);

  if (!normalizedProvider) {
    return null;
  }

  const match = providers.find((entry) => normalizeCatalogKey(entry.value) === normalizedProvider);
  return match?.value ?? null;
}

function findModelIdBySessionModel(
  models: readonly AvailableChatModelOption[],
  {
    model,
    provider,
  }: {
    model: string | null | undefined;
    provider?: string | null;
  },
) {
  const normalizedModel = normalizeCatalogKey(model);

  if (!normalizedModel) {
    return null;
  }

  const normalizedProvider = normalizeCatalogKey(provider);
  const scopedModels = normalizedProvider
    ? models.filter((entry) => normalizeCatalogKey(entry.provider) === normalizedProvider)
    : models;
  const match =
    scopedModels.find((entry) => normalizeCatalogKey(entry.value) === normalizedModel) ??
    scopedModels.find((entry) => normalizeCatalogKey(entry.label) === normalizedModel);

  return match?.id ?? null;
}

function normalizeSessionModelValue(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveSessionModelPreference(session: AgentSessionRecord | null) {
  return {
    provider: normalizeSessionModelValue(session?.agent?.llmProvider),
    model: normalizeSessionModelValue(session?.agent?.llmModel),
  };
}

function hasSessionModelPreference(session: AgentSessionRecord | null) {
  const preference = resolveSessionModelPreference(session);
  return Boolean(preference.provider || preference.model);
}

function buildModelCatalogSignature({
  models,
  providers,
}: {
  models: readonly AvailableChatModelOption[];
  providers: readonly AvailableChatProviderOption[];
}) {
  return [
    providers.map((provider) => provider.value).join("|"),
    models.map((model) => model.id).join("|"),
  ].join("::");
}

function resolveChatRequestModel({
  availableModels,
  availableProviders,
  fallbackModelId,
  session,
}: {
  availableModels: readonly AvailableChatModelOption[];
  availableProviders: readonly AvailableChatProviderOption[];
  fallbackModelId: string | null;
  session: AgentSessionRecord | null;
}) {
  const sessionModel = resolveSessionModelPreference(session);
  const matchedProviderValue = findProviderValueBySessionProvider(
    availableProviders,
    sessionModel.provider,
  );
  const matchedModelId = findModelIdBySessionModel(availableModels, {
    model: sessionModel.model,
    provider: matchedProviderValue ?? sessionModel.provider,
  });

  return (
    availableModels.find((entry) => entry.id === matchedModelId) ??
    availableModels.find((entry) => entry.id === fallbackModelId) ??
    availableModels[0] ??
    null
  );
}

function applyModelConfigToSession(
  session: AgentSessionRecord,
  {
    model,
    provider,
  }: {
    model: string;
    provider: string;
  },
) {
  if (!session.agent) {
    return session;
  }

  return {
    ...session,
    agent: {
      ...session.agent,
      llmProvider: provider,
      llmModel: model,
    },
  } satisfies AgentSessionRecord;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
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
  const [messages, setMessages] = useState<readonly ThreadMessageLike[]>([]);
  const [agentSessions, setAgentSessions] = useState<AgentSessionRecord[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
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
  const [isLoadingBaseSession, setIsLoadingBaseSession] = useState(false);
  const [isCancellingSession, setIsCancellingSession] = useState(false);
  const [baseSessionError, setBaseSessionError] = useState<string | null>(null);
  const [latestSessionsError, setLatestSessionsError] = useState<string | null>(null);
  const [latestSessionsAgentFilterId, setLatestSessionsAgentFilterId] = useState<number | null>(null);
  const [latestSessionsRefreshNonce, setLatestSessionsRefreshNonce] = useState(0);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [pendingSessionHandoff, setPendingSessionHandoff] =
    useState<PendingSessionHandoff | null>(null);
  const [sessionSelectionMode, setSessionSelectionMode] = useState<"auto" | "explicit">("auto");
  const shouldSignalNewChatRef = useRef(true);
  const pendingNewChatRequestRef = useRef(false);
  const expectedNewSessionRef = useRef(false);
  const runtimeRef = useRef<AssistantRuntime | null>(null);
  const selectedSessionRef = useRef<AgentSessionRecord | null>(null);
  const activeSessionRef = useRef<AgentSessionRecord | null>(null);
  const sessionSelectionModeRef = useRef<"auto" | "explicit">("auto");
  const selectedModelValueRef = useRef<string | null>(null);
  const selectedReasoningEffortValueRef = useRef<string | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const loadedSessionIdRef = useRef<string | null>(null);
  const activeChatStreamSessionIdRef = useRef<string | null>(null);
  const activeChatStreamLookupSessionIdRef = useRef<string | null>(null);
  const sessionPickerSyncRef = useRef<string | null>(null);
  const unavailableSessionModelNoticeRef = useRef<string | null>(null);
  const baseSessionRequestRef = useRef<AbortController | null>(null);
  const sessionHistoryRequestRef = useRef<AbortController | null>(null);
  const availableModelsRequestRef = useRef<AbortController | null>(null);
  const sessionModelPatchRequestRef = useRef<AbortController | null>(null);
  const shouldHydrateChatRuntime =
    location.pathname === CHAT_PAGE_PATH || isRailOpen;
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
  const markActiveChatStream = useCallback(
    ({
      lookupSessionId,
      sessionId,
    }: {
      lookupSessionId: string | null;
      sessionId: string | null;
    }) => {
      activeChatStreamSessionIdRef.current = sessionId;
      activeChatStreamLookupSessionIdRef.current = lookupSessionId;
    },
    [],
  );
  const clearActiveChatStream = useCallback(() => {
    activeChatStreamSessionIdRef.current = null;
    activeChatStreamLookupSessionIdRef.current = null;
  }, []);
  const isSessionHistoryBlockedByActiveStream = useCallback(
    ({
      lookupSessionId,
      sessionId,
    }: {
      lookupSessionId: string | null;
      sessionId: string | null;
    }) => {
      const activeStreamSessionId = activeChatStreamSessionIdRef.current;
      const activeStreamLookupSessionId = activeChatStreamLookupSessionIdRef.current;

      return (
        Boolean(sessionId && activeStreamSessionId && sessionId === activeStreamSessionId) ||
        Boolean(
          lookupSessionId &&
            activeStreamLookupSessionId &&
            lookupSessionId === activeStreamLookupSessionId,
        )
      );
    },
    [],
  );
  const setAgentSessionWorkingState = useCallback(
    ({
      runtimeState,
      sessionId,
      working,
    }: {
      runtimeState?: string | null;
      sessionId: string | null;
      working: boolean;
    }) => {
      if (!sessionId) {
        return;
      }

      const applyWorkingState = (session: AgentSessionRecord) => ({
        ...session,
        runtimeState:
          runtimeState !== undefined
            ? runtimeState
            : session.runtimeState,
        working,
        updatedAt: new Date().toISOString(),
      });

      if (activeSessionRef.current?.id === sessionId) {
        activeSessionRef.current = applyWorkingState(activeSessionRef.current);
      }

      if (selectedSessionRef.current?.id === sessionId) {
        selectedSessionRef.current = applyWorkingState(selectedSessionRef.current);
      }

      setAgentSessions((currentSessions) =>
        currentSessions.map((session) =>
          session.id === sessionId ? applyWorkingState(session) : session,
        ),
      );
    },
    [],
  );
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

      return resolveAgentSessionLookupId(selectedSession) ? selectedSession : null;
    },
    [selectedSession],
  );
  const activeAgentName = useMemo(
    () => selectedSession?.agent?.requestName || selectedSession?.agent?.name || DEFAULT_AGENT_NAME,
    [selectedSession],
  );
  const activeAgentRequestName = useMemo(
    () => resolveAgentSessionRequestName(selectedSession),
    [selectedSession],
  );
  const activeAgentLabel = useMemo(
    () => resolveAgentSessionLabel(selectedSession),
    [selectedSession],
  );
  const {
    activeDetail: activeSessionDetail,
    refreshSessionDetail,
    refreshSessionInsights,
  } = useAgentSessionDetail({
    session: activeSession,
    enabled: shouldHydrateChatRuntime,
    token: sessionToken,
    tokenType: sessionTokenType,
  });
  const activeSessionDisplayId = useMemo(
    () => resolveAgentSessionDisplayId(activeSession),
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
  const activeSessionSummary = useMemo<ActiveSessionSummary | null>(() => {
    if (!activeSession) {
      return null;
    }

    return buildActiveSessionSummary({
      session: activeSession,
      detail: activeSessionDetail,
      fallbackAgentId: agentId,
    });
  }, [
    activeSession,
    activeSessionDetail,
    agentId,
  ]);

  const clearThread = useCallback(() => {
    setRunStatus("idle");
    setRunStatusDetail(null);
    setThinkingSummary(null);
    setHasVisibleAssistantOutput(false);
    setSessionNotice(null);
  }, []);

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
    const restoredSessions = sortAgentSessions(readAgentSessions(sessionUserId));
    setAgentSessions(restoredSessions);
    setCurrentSessionId(restoredSessions[0]?.id ?? null);
    setSessionSelectionMode("auto");
    loadedSessionIdRef.current = null;
  }, [sessionUserId]);

  useEffect(() => {
    baseSessionRequestRef.current?.abort();

    if (env.useMockData) {
      clearMainSequenceAiResolvedRuntimeAccess();
      setIsLoadingBaseSession(false);
      setBaseSessionError(null);
      return;
    }

    if (!shouldHydrateChatRuntime || !sessionUserId || !sessionToken) {
      if (!sessionToken) {
        clearMainSequenceAiResolvedRuntimeAccess();
      }
      setIsLoadingBaseSession(false);
      return;
    }

    const controller = new AbortController();
    baseSessionRequestRef.current = controller;
    setIsLoadingBaseSession(true);
    setBaseSessionError(null);

    void (async () => {
      try {
        const handle = isMainSequenceAiAssistantProxyMode()
          ? await fetchOrCreateCommandCenterBaseSession({
              signal: controller.signal,
              token: sessionToken,
              tokenType: sessionTokenType,
            })
          : (
              await fetchMainSequenceAiCommandCenterRuntimeHandle({
                signal: controller.signal,
                sessionToken,
                sessionTokenType,
              })
            ).handle;
        const baseSessionDetail = await fetchAgentSessionDetail({
          sessionId: handle.sessionId,
          signal: controller.signal,
          token: sessionToken,
          tokenType: sessionTokenType,
        });

        if (controller.signal.aborted) {
          return;
        }

        setAgentSessions((currentSessions) => {
          const existing =
            currentSessions.find((session) => session.id === handle.sessionId) ??
            currentSessions.find((session) => session.origin === "astro_command_center_base") ??
            undefined;
          const baseSessionFromHandle = toAgentSessionRecordFromBaseHandle(handle, existing);
          const baseSession = toAgentSessionRecordFromApi(
            baseSessionDetail,
            baseSessionFromHandle,
          );

          return sortAgentSessions([
            baseSession,
            ...currentSessions.filter(
              (session) =>
                session.id !== baseSession.id && session.origin !== "astro_command_center_base",
            ),
          ]);
        });

        if (sessionSelectionModeRef.current !== "explicit") {
          loadedSessionIdRef.current = null;
          setCurrentSessionId(handle.sessionId);
        }

        setBaseSessionError(null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        clearMainSequenceAiResolvedRuntimeAccess();

        setBaseSessionError(
          error instanceof Error
            ? error.message
            : "Unable to resolve the Command Center base session.",
        );

        if (sessionSelectionModeRef.current !== "explicit") {
          loadedSessionIdRef.current = null;
          currentSessionIdRef.current = null;
          setCurrentSessionId(null);
          runtimeRef.current?.thread.reset([]);
          setAgentId(null);
          clearThread();
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingBaseSession(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [
    clearThread,
    shouldHydrateChatRuntime,
    sessionToken,
    sessionTokenType,
    sessionUserId,
  ]);

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

    if (!shouldHydrateChatRuntime) {
      setAvailableModelsError(null);
      setIsLoadingAvailableModels(false);
      return;
    }

    if (!sessionToken) {
      setAvailableModels([]);
      setAvailableProviders([]);
      setAvailableReasoningEfforts([]);
      setAvailableModelsError(null);
      setIsLoadingAvailableModels(false);
      return;
    }

    const controller = new AbortController();
    availableModelsRequestRef.current = controller;
    setIsLoadingAvailableModels(true);
    setAvailableModelsError(null);

    void (async () => {
      try {
        const options = await fetchAvailableRunConfigOptions({
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
  }, [
    sessionToken,
    sessionTokenType,
    shouldHydrateChatRuntime,
  ]);

  useEffect(() => {
    if (!shouldHydrateChatRuntime || !sessionToken) {
      setIsLoadingLatestSessions(false);
      setLatestSessionsError(null);
      return;
    }

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
          const baseSession =
            currentSessions.find((session) => session.origin === "astro_command_center_base") ?? null;
          const currentSession = currentSessions.find(
            (session) => session.id === currentSessionIdRef.current,
          );
          const keepLocalDraft =
            currentSession &&
            (!currentSession.runtimeSessionId || currentSession.isPlaceholder) &&
            currentSession.origin !== "astro_command_center_base";

          const nextSessions = sortAgentSessions(
            [
              ...(baseSession &&
              !remoteSessions.some((session) => session.id === baseSession.id)
                ? [baseSession]
                : []),
              ...(keepLocalDraft
                ? [
                    currentSession,
                    ...remoteSessions.filter((session) => session.id !== currentSession.id),
                  ]
                : remoteSessions),
            ],
          );

          if (!currentSession && sessionSelectionModeRef.current !== "explicit") {
            setCurrentSessionId(nextSessions[0]?.id ?? null);
          } else if (
            currentSession &&
            !nextSessions.some((session) => session.id === currentSession.id)
          ) {
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
  }, [
    latestSessionsAgentFilterId,
    latestSessionsRefreshNonce,
    sessionToken,
    sessionTokenType,
    sessionUserId,
    shouldHydrateChatRuntime,
  ]);

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
    sessionSelectionModeRef.current = sessionSelectionMode;
  }, [sessionSelectionMode]);

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

  const persistSelectedSessionModelConfig = useCallback(
    ({ model, provider }: { model: string | null; provider: string | null }) => {
      const normalizedProvider = provider?.trim();
      const normalizedModel = model?.trim();
      const activeSession = activeSessionRef.current;
      const sessionId = resolveAgentSessionLookupId(activeSession);

      if (!activeSession || !sessionId || !normalizedProvider || !normalizedModel) {
        return;
      }

      const normalizedConfig = {
        provider: normalizedProvider,
        model: normalizedModel,
      };
      const nextActiveSession = activeSession.agent
        ? applyModelConfigToSession(activeSession, normalizedConfig)
        : activeSession;

      // Keep imperative request refs ahead of React state so a fast send after a picker change
      // uses the picker-selected model, not the previous session model.
      activeSessionRef.current = nextActiveSession;
      if (selectedSessionRef.current?.id === nextActiveSession.id) {
        selectedSessionRef.current = nextActiveSession;
      }

      setAgentSessions((currentSessions) =>
        currentSessions.map((session) => {
          if (session.id !== activeSession.id || !session.agent) {
            return session;
          }

          return applyModelConfigToSession(session, normalizedConfig);
        }),
      );

      sessionModelPatchRequestRef.current?.abort();
      const controller = new AbortController();
      sessionModelPatchRequestRef.current = controller;

      void (async () => {
        try {
          await patchAgentSessionModelConfig({
            llmModel: normalizedModel,
            llmProvider: normalizedProvider,
            sessionId,
            signal: controller.signal,
            token: sessionToken,
            tokenType: sessionTokenType,
          });

          if (!controller.signal.aborted && currentSessionIdRef.current === activeSession.id) {
            refreshSessionDetail();
            refreshSessionInsights();
          }
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }

          setSessionNotice(
            error instanceof Error
              ? `Failed to update session model: ${error.message}`
              : "Failed to update session model.",
          );
        } finally {
          if (sessionModelPatchRequestRef.current === controller) {
            sessionModelPatchRequestRef.current = null;
          }
        }
      })();
    },
    [refreshSessionDetail, refreshSessionInsights, sessionToken, sessionTokenType],
  );

  const handleSelectedProviderChange = useCallback(
    (provider: string | null) => {
      setSelectedProviderValue(provider);

      if (!provider) {
        setSelectedModelValue(null);
        selectedModelValueRef.current = null;
        return;
      }

      const currentModel =
        availableModels.find((model) => model.id === selectedModelValue) ?? null;
      const nextModel =
        currentModel?.provider === provider
          ? currentModel
          : availableModels.find((model) => model.provider === provider) ?? null;

      if (nextModel) {
        setSelectedModelValue(nextModel.id);
        selectedModelValueRef.current = nextModel.id;
      }

      persistSelectedSessionModelConfig({
        provider,
        model: nextModel?.value ?? currentModel?.value ?? null,
      });
    },
    [availableModels, persistSelectedSessionModelConfig, selectedModelValue],
  );

  const handleSelectedModelChange = useCallback(
    (modelId: string | null) => {
      setSelectedModelValue(modelId);
      selectedModelValueRef.current = modelId;

      const selectedModel = availableModels.find((model) => model.id === modelId) ?? null;

      if (selectedModel?.provider && selectedModel.provider !== selectedProviderValue) {
        setSelectedProviderValue(selectedModel.provider);
      }

      persistSelectedSessionModelConfig({
        provider: selectedModel?.provider ?? selectedProviderValue,
        model: selectedModel?.value ?? null,
      });
    },
    [availableModels, persistSelectedSessionModelConfig, selectedProviderValue],
  );

  useEffect(() => {
    writeAgentSessions(sessionUserId, agentSessions);
  }, [agentSessions, sessionUserId]);

  useEffect(() => {
    if (currentSessionId && hasSessionModelPreference(selectedSession)) {
      return;
    }

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
  }, [availableProviders, currentSessionId, selectedProviderValue, selectedSession]);

  useEffect(() => {
    if (!currentSessionId) {
      return;
    }

    if (availableProviders.length === 0 || availableModels.length === 0) {
      return;
    }

    const { model: sessionModel, provider: sessionProvider } =
      resolveSessionModelPreference(selectedSession);
    const catalogSignature = buildModelCatalogSignature({
      models: availableModels,
      providers: availableProviders,
    });
    const syncSignature = [
      currentSessionId,
      normalizeCatalogKey(sessionProvider) ?? "",
      normalizeCatalogKey(sessionModel) ?? "",
      catalogSignature,
    ].join("::");

    if (sessionPickerSyncRef.current === syncSignature) {
      return;
    }

    const matchedProviderValue = findProviderValueBySessionProvider(
      availableProviders,
      sessionProvider,
    );
    const matchedModelId = findModelIdBySessionModel(availableModels, {
      model: sessionModel,
      provider: matchedProviderValue ?? sessionProvider,
    });
    const matchedModel = availableModels.find((model) => model.id === matchedModelId) ?? null;
    const sessionRequestedModel = Boolean(
      normalizeCatalogKey(sessionProvider) || normalizeCatalogKey(sessionModel),
    );

    if (env.debugChat) {
      console.info("[main_sequence_ai] session model sync", {
        currentSessionId,
        matchedModel,
        matchedModelId,
        matchedProviderValue,
        sessionModel,
        sessionProvider,
      });
    }

    if (matchedModel) {
      setSelectedProviderValue(matchedProviderValue ?? matchedModel.provider ?? null);
      setSelectedModelValue(matchedModel.id);
      selectedModelValueRef.current = matchedModel.id;
      unavailableSessionModelNoticeRef.current = null;
      sessionPickerSyncRef.current = syncSignature;
      return;
    }

    if (sessionRequestedModel) {
      const fallbackProvider = matchedProviderValue ?? availableProviders[0]?.value ?? null;
      const fallbackModels = fallbackProvider
        ? availableModels.filter((model) => model.provider === fallbackProvider)
        : availableModels;
      const fallbackModelId = fallbackModels[0]?.id ?? availableModels[0]?.id ?? null;

      setSelectedProviderValue(fallbackProvider);
      setSelectedModelValue(fallbackModelId);
      selectedModelValueRef.current = fallbackModelId;

      if (unavailableSessionModelNoticeRef.current !== syncSignature) {
        unavailableSessionModelNoticeRef.current = syncSignature;
        toast({
          title: "Session model is not available",
          description: [
            sessionProvider ? `Provider: ${sessionProvider}` : null,
            sessionModel ? `Model: ${sessionModel}` : null,
            "Using the first available model from the picker instead.",
          ]
            .filter(Boolean)
            .join(" · "),
          variant: "info",
        });
      }
    }

    sessionPickerSyncRef.current = syncSignature;
  }, [
    availableModels,
    availableProviders,
    currentSessionId,
    selectedSession?.agent?.llmModel,
    selectedSession?.agent?.llmProvider,
    toast,
  ]);

  useEffect(() => {
    if (currentSessionId && hasSessionModelPreference(selectedSession)) {
      return;
    }

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
      filteredModels.some((model) => model.id === selectedModelValue)
    ) {
      return;
    }

    setSelectedModelValue(filteredModels[0]?.id ?? null);
  }, [availableModels, currentSessionId, selectedModelValue, selectedProviderValue, selectedSession]);

  useEffect(() => {
    const selectedModel =
      availableModels.find((model) => model.id === selectedModelValue) ?? null;
    const nextReasoningEfforts =
      selectedModel?.reasoningEfforts.length
        ? selectedModel.reasoningEfforts
        : [];

    setAvailableReasoningEfforts(nextReasoningEfforts);
  }, [availableModels, selectedModelValue]);

  useEffect(() => {
    const selectedModel =
      availableModels.find((model) => model.id === selectedModelValue) ?? null;
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

  const stageCrossAgentSessionHandoff = useCallback(
    (streamSession: StreamCreatedAgentSession, agentId: string | null) => {
      const nextSessionId = streamSession.agentSessionId;

      setAgentSessions((currentSessions) => {
        const existingSession = currentSessions.find((session) => session.id === nextSessionId);
        const handoffSession = createAgentSessionFromStreamHandoff(
          streamSession,
          existingSession,
        );

        return sortAgentSessions([
          handoffSession,
          ...currentSessions.filter((session) => session.id !== nextSessionId),
        ]);
      });
      setPendingSessionHandoff({
        agentId,
        sessionId: nextSessionId,
      });
      setLatestSessionsAgentFilterId(null);
      setLatestSessionsRefreshNonce((current) => current + 1);
      setSessionNotice(
        `A new agent session was created by agent ${agentId ?? "unknown"}: ${nextSessionId}.`,
      );
    },
    [],
  );

  const activateSessionHandoff = useCallback(() => {
    const handoff = pendingSessionHandoff;

    if (!handoff) {
      return;
    }

    persistSessionMessages();
    setSessionSelectionMode("explicit");
    setCurrentSessionId(handoff.sessionId);
    setPendingSessionHandoff(null);
    setSessionNotice(null);
  }, [pendingSessionHandoff, persistSessionMessages]);

  const selectAgentSession = useCallback(
    (sessionId: string) => {
      if (currentSessionIdRef.current === sessionId) {
        return;
      }

      persistSessionMessages();
      setSessionSelectionMode("explicit");
      setPendingSessionHandoff(null);
      setSessionNotice(null);
      setCurrentSessionId(sessionId);
    },
    [persistSessionMessages],
  );

  const createAgentSession = useCallback(() => {
    persistSessionMessages();
    setSessionSelectionMode("explicit");

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

      const backendSessionId = resolveAgentSessionLookupId(session);

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
          loadedSessionIdRef.current = null;
        }

        setAgentSessions((currentSessions) => {
          const remainingSessions = sortAgentSessions(
            currentSessions.filter((candidate) => candidate.id !== sessionId),
          );

          if (remainingSessions.length === 0) {
            setSessionSelectionMode("auto");
            setCurrentSessionId(null);
            return [];
          }

          if (currentSessionIdRef.current === sessionId) {
            setSessionSelectionMode("auto");
            setCurrentSessionId(remainingSessions[0]?.id ?? null);
          }

          return remainingSessions;
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
      setSessionSelectionMode("explicit");
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

      const lookupSessionId = resolveAgentSessionLookupId(session);
      const fallbackMessages = session.messages;

      if (isSessionHistoryBlockedByActiveStream({ lookupSessionId, sessionId })) {
        if (env.debugChat) {
          console.info("[main_sequence_ai] skipped history hydration during active stream", {
            activeStreamLookupSessionId: activeChatStreamLookupSessionIdRef.current,
            activeStreamSessionId: activeChatStreamSessionIdRef.current,
            lookupSessionId,
            sessionId,
          });
        }
        return;
      }

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
            sessionId: lookupSessionId,
            signal: controller.signal,
            token: sessionToken,
            tokenType: sessionTokenType,
          });

          if (controller.signal.aborted || currentSessionIdRef.current !== sessionId) {
            return;
          }

          if (isSessionHistoryBlockedByActiveStream({ lookupSessionId, sessionId })) {
            if (env.debugChat) {
              console.info("[main_sequence_ai] ignored history snapshot during active stream", {
                activeStreamLookupSessionId: activeChatStreamLookupSessionIdRef.current,
                activeStreamSessionId: activeChatStreamSessionIdRef.current,
                lookupSessionId,
                sessionId,
              });
            }
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

          const latestSession =
            activeSessionRef.current?.id === sessionId ? activeSessionRef.current : session;

          if (snapshot.session.status === "running" && latestSession.working) {
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

          const errorMessage =
            error instanceof Error ? error.message : "Session history request failed.";
          const isEmptyBaseSession =
            session.origin === "astro_command_center_base" && fallbackMessages.length === 0;
          const looksLikeMissingHistory =
            /not found|no local session|session_not_found|session history failed with status 404/i.test(
              errorMessage,
            );

          if (isEmptyBaseSession && looksLikeMissingHistory) {
            runtimeRef.current?.thread.reset([]);
            setAgentId(
              session.agent?.id !== null && session.agent?.id !== undefined
                ? String(session.agent.id)
                : null,
            );
            setIsRunning(false);
            setRunStatus("idle");
            setRunStatusDetail(null);
            setThinkingSummary(null);
            setHasVisibleAssistantOutput(false);
            setSessionNotice(null);
            return;
          }

          setIsRunning(false);
          setRunStatus("error");
          setRunStatusDetail(errorMessage);
          setSessionNotice(
            "Failed to rehydrate the selected session. Showing the locally cached transcript.",
          );
        }
      })();
    },
    [
      agentSessions,
      clearThread,
      isSessionHistoryBlockedByActiveStream,
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
    api: "/api/chat",
    fetch: async (_input, init) => {
      const activeSession = activeSessionRef.current;
      const currentSessionId = resolveAgentSessionLookupId(activeSession);
      const { response } = await fetchMainSequenceAiAssistantResponse({
        currentSessionId,
        requestPath: "/api/chat",
        runtimeTarget: "agent-runtime",
        ...init,
        sessionToken,
        sessionTokenType,
      });
      return response;
    },
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
      const selectedSessionId = resolveAgentSessionLookupId(activeSession);
      const isNewChatRequest = !activeSession || !selectedSessionId;
      const selectedModel = resolveChatRequestModel({
        availableModels,
        availableProviders,
        fallbackModelId: selectedModelValueRef.current,
        session: activeSession,
      });
      const selectedReasoningEffort =
        selectedReasoningEffortValueRef.current ?? availableReasoningEfforts[0]?.value ?? null;

      pendingNewChatRequestRef.current = isNewChatRequest;
      expectedNewSessionRef.current = isNewChatRequest;
      markActiveChatStream({
        lookupSessionId: !isNewChatRequest ? selectedSessionId : null,
        sessionId: activeSession?.id ?? currentSessionIdRef.current,
      });
      setAgentSessionWorkingState({
        sessionId: activeSession?.id ?? currentSessionIdRef.current,
        working: true,
      });
      sessionHistoryRequestRef.current?.abort();

      return {
        ...buildAgentSessionRequestBodyFragment({
          agentName: resolveAgentSessionRequestName(selectedSession),
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
          markActiveChatStream({
            lookupSessionId: streamSession.agentSessionId,
            sessionId: streamSession.agentSessionId,
          });
          setAgentSessionWorkingState({
            sessionId: streamSession.agentSessionId,
            working: true,
          });
          shouldSignalNewChatRef.current = false;
          pendingNewChatRequestRef.current = false;
          setSessionNotice(null);
        } else {
          stageCrossAgentSessionHandoff(streamSession, chunkAgentId);
        }

        return;
      }

      const switchedSession = extractSessionSwitchChunk(data);

      if (switchedSession) {
        switchCurrentSessionFromStream(switchedSession);
        markActiveChatStream({
          lookupSessionId: switchedSession.runtimeSessionId ?? switchedSession.agentSessionId,
          sessionId: switchedSession.agentSessionId,
        });
        setAgentSessionWorkingState({
          sessionId: switchedSession.agentSessionId,
          working: true,
        });
        shouldSignalNewChatRef.current = false;
        pendingNewChatRequestRef.current = false;
        setSessionNotice(null);

        if (switchedSession.agentId !== null) {
          setAgentId(String(switchedSession.agentId));
        }

        return;
      }

      if (type === "error") {
        const streamError =
          typeof data.error === "string" && data.error.trim()
            ? data.error.trim()
            : typeof data.message === "string" && data.message.trim()
              ? data.message.trim()
              : typeof data.error_detail === "string" && data.error_detail.trim()
                ? data.error_detail.trim()
                : "The assistant runtime reported an error.";

        setRunStatus("error");
        setRunStatusDetail(streamError);

        const nextAgentId = extractAgentId(data);

        if (nextAgentId) {
          setAgentId(nextAgentId);
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
        clearActiveChatStream();
        setAgentSessionWorkingState({
          sessionId: currentSessionIdRef.current,
          working: false,
        });
        persistSessionMessages();
        return;
      }

      setRunStatus("complete");
      setRunStatusDetail("Run completed.");
      setThinkingSummary(null);
      clearActiveChatStream();
      setAgentSessionWorkingState({
        sessionId: currentSessionIdRef.current,
        working: false,
      });
      pendingNewChatRequestRef.current = false;
      persistSessionMessages();
    },
    onError: (error) => {
      setRunStatus("error");
      setRunStatusDetail(error.message);
      setThinkingSummary(null);
      clearActiveChatStream();
      setAgentSessionWorkingState({
        sessionId: currentSessionIdRef.current,
        working: false,
      });
      pendingNewChatRequestRef.current = false;
      expectedNewSessionRef.current = false;
      persistSessionMessages();
    },
    onCancel: () => {
      setRunStatus("idle");
      setRunStatusDetail("Run cancelled.");
      setThinkingSummary(null);
      clearActiveChatStream();
      setAgentSessionWorkingState({
        sessionId: currentSessionIdRef.current,
        working: false,
      });
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
      clearActiveChatStream();
    };
  }, [clearActiveChatStream]);

  useEffect(() => {
    if (!shouldHydrateChatRuntime) {
      sessionHistoryRequestRef.current?.abort();
      return;
    }

    loadCurrentSession(currentSessionId);
  }, [currentSessionId, loadCurrentSession, shouldHydrateChatRuntime]);

  useEffect(() => {
    if (!env.useMockData || !currentSessionId) {
      return;
    }

    persistSessionMessages(messages);
  }, [currentSessionId, messages, persistSessionMessages]);

  const cancelActiveSession = useCallback(async () => {
    const activeSession = activeSessionRef.current;
    const runtimeSessionId =
      activeSession?.runtimeSessionId?.trim() || resolveAgentSessionLookupId(activeSession);
    const threadId = activeSession?.threadId?.trim() || runtimeSessionId;

    if (!activeSession || !runtimeSessionId || !threadId) {
      toast({
        title: "Unable to stop session",
        description: "No active runtime session is available to cancel.",
        variant: "error",
      });
      return;
    }

    setIsCancellingSession(true);
    setRunStatus("queued");
    setRunStatusDetail("Cancelling session...");

    try {
      const cancelPromise = cancelChatSession({
        body: {
          runtimeSessionId,
          threadId,
          userId: sessionUserId,
          reason: "user_requested",
          message: "User pressed stop.",
        },
        token: sessionToken,
        tokenType: sessionTokenType,
      });

      try {
        runtimeRef.current?.thread.cancelRun();
      } catch {
        // If assistant-ui has no active local run, the backend cancellation is still valid.
      }

      await cancelPromise;
      setAgentSessionWorkingState({
        sessionId: activeSession.id,
        working: false,
      });
      clearActiveChatStream();
      pendingNewChatRequestRef.current = false;
      expectedNewSessionRef.current = false;
      setRunStatus("idle");
      setRunStatusDetail("Run cancellation requested.");
      setThinkingSummary(null);
      setSessionNotice(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Session cancellation request failed.";
      setRunStatus("error");
      setRunStatusDetail(message);
      setSessionNotice(message);
    } finally {
      setIsCancellingSession(false);
    }
  }, [
    clearActiveChatStream,
    sessionToken,
    sessionTokenType,
    sessionUserId,
    setAgentSessionWorkingState,
    toast,
  ]);

  const clearRuntimeThread = useCallback(() => {
    runtime.thread.reset();
    clearActiveChatStream();
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
            runtimeState: null,
            working: false,
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
  }, [clearActiveChatStream, clearThread, runtime]);

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
      activeSessionDetail,
      activeSessionSummary,
      activeSessionDisplayId,
      activeSessionPreview,
      activeSessionUpdatedAt,
      activateSessionHandoff,
      availableModels,
      availableModelsError,
      availableProviders,
      availableReasoningEfforts,
      agentId,
      agentSessions: sortedAgentSessions,
      baseSessionError,
      cancelActiveSession,
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
      isLoadingBaseSession,
      isCancellingSession,
      isLoadingLatestSessions,
      latestSessionsError,
      minimizeToRail,
      pendingSessionHandoff,
      railMode,
      refreshSessionDetail,
      refreshSessionInsights,
      runStatus,
      runStatusDetail,
      selectAgentSession,
      sessionNotice,
      selectedModelValue,
      selectedProviderValue,
      selectedReasoningEffortValue,
      setSelectedModelValue: handleSelectedModelChange,
      setSelectedProviderValue: handleSelectedProviderChange,
      setSelectedReasoningEffortValue,
      startAgentSession,
      thinkingSummary,
      toggleChat,
    }),
    [
      activeAgentLabel,
      activeAgentName,
      activeAgentRequestName,
      activeSessionDetail,
      activeSessionSummary,
      activeSessionDisplayId,
      activeSessionPreview,
      activeSessionUpdatedAt,
      activateSessionHandoff,
      availableModels,
      availableModelsError,
      availableProviders,
      availableReasoningEfforts,
      agentId,
      baseSessionError,
      cancelActiveSession,
      currentSessionId,
      chatContext,
      clearRuntimeThread,
      closeRail,
      createAgentSession,
      deleteAgentSession,
      expandToPage,
      hasVisibleAssistantOutput,
      handleSelectedModelChange,
      handleSelectedProviderChange,
      isRailOpen,
      isLoadingAvailableModels,
      isLoadingBaseSession,
      isCancellingSession,
      isLoadingLatestSessions,
      latestSessionsError,
      minimizeToRail,
      pendingSessionHandoff,
      railMode,
      refreshSessionDetail,
      refreshSessionInsights,
      runStatus,
      runStatusDetail,
      selectAgentSession,
      sessionNotice,
      selectedModelValue,
      selectedProviderValue,
      selectedReasoningEffortValue,
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
