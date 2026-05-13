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
import type { AgentImageDriftRecord, AgentSearchResult } from "../agent-search";
import {
  buildActiveSessionSummary,
  resolveAgentSessionDisplayId,
  resolveAgentSessionLabel,
  resolveAgentSessionLookupId,
  resolveAgentSessionRequestAgentType,
  type ActiveSessionSummary,
  type AgentSessionDetailSnapshot,
} from "../agent-session-detail/model";
import { buildAgentSessionRequestBodyFragment } from "../runtime/agent-session-request";
import {
  fetchAgentSessionRuntimeAccess,
  fetchCommandCenterBaseSessionHandle,
} from "../runtime/command-center-base-session-api";
import type {
  AvailableChatModelOption,
  AvailableChatProviderOption,
  AvailableChatReasoningEffortOption,
  AvailableChatRunConfigOptions,
} from "../runtime/available-models-api";
import {
  buildAvailableRunConfigCacheKey,
  fetchAvailableRunConfigOptions,
  peekAvailableRunConfigOptionsCacheSnapshot,
} from "../runtime/available-models-api";
import {
  clearMainSequenceAiResolvedRuntimeAccess,
  fetchMainSequenceAiAssistantResponse,
  resolveMainSequenceAiAssistantEndpointForAgentType,
} from "../runtime/assistant-endpoint";
import {
  createErrorAgentSessionReadiness,
  createIdleAgentSessionReadiness,
  createLoadingAgentSessionReadiness,
  createReadyAgentSessionReadiness,
  type AgentSessionInteractionReadiness,
} from "../runtime/agent-session-readiness";
import {
  MainSequenceAiError,
  withMainSequenceAiErrorSource,
} from "../runtime/error-source";
import { cancelChatSession } from "../runtime/session-cancel-api";
import {
  applyModelConfigToSerializedSession,
  attachSerializedSessionToSession,
  attachAgentToSession,
  buildAgentSessionTitle,
  createDefaultAgentSessionAgent,
  createEmptyAgentSession,
  DEFAULT_AGENT_LABEL,
  promoteAgentSessionFromStream,
  readAgentSessions,
  summarizeAgentSession,
  toAgentSessionRecordFromApi,
  toAgentSessionRecordFromBaseHandle,
  updateAgentSessionSnapshot,
  writeAgentSessions,
  type AgentSessionRecord,
  type AgentSessionSummary,
  type StreamCreatedAgentSession,
} from "./agent-sessions";
import {
  deleteAgentSessionRequest,
  fetchLatestAgentSessions,
  patchAgentSessionModelConfig,
  startNewAgentSessionRequest,
  type AgentSessionApiRecord,
  type AgentSessionSerializedRecord,
} from "./agent-sessions-api";
import {
  type ChatRunStatus,
  mockChatBackendAdapter,
  type ChatBackendHistoryMessage,
} from "./chat-backend-adapter";
import { useChatViewContext, type ChatViewContext } from "./chat-context";
import {
  CHAT_PAGE_PATH,
  getChatPagePath,
  resolvePreferredChatRailMode,
  useChatUiStore,
  type ChatRailMode,
} from "./chat-ui-store";
import { fetchSessionHistory } from "./session-history-api";
import {
  useLatestMessageDataStreamRuntime,
  type LatestMessageDataStreamProtocol,
} from "./useLatestMessageDataStreamRuntime";

interface ChatFeatureContextValue {
  activeAgentLabel: string;
  activeAgentType: string;
  activeRequestAgentType: string;
  activeSessionDetail: AgentSessionDetailSnapshot | null;
  activeSessionSummary: ActiveSessionSummary | null;
  activeSessionReadiness: AgentSessionInteractionReadiness;
  activeSessionDisplayId: string | null;
  activeSessionPreview: string | null;
  activeSessionUpdatedAt: string | null;
  availableModels: AvailableChatModelOption[];
  availableModelsError: string | null;
  availableProviders: AvailableChatProviderOption[];
  availableReasoningEfforts: AvailableChatReasoningEffortOption[];
  agentId: string | null;
  agentSessions: AgentSessionSummary[];
  cancelActiveSession: () => Promise<void>;
  clearThread: () => void;
  closeRail: () => void;
  context: ChatViewContext;
  createAgentSession: () => void;
  currentSessionId: string | null;
  deleteAgentSession: (sessionId: string) => Promise<void>;
  expandToPage: () => void;
  hasVisibleAssistantOutput: boolean;
  hasActiveChatStream: boolean;
  isRailOpen: boolean;
  isLoadingAvailableModels: boolean;
  isActiveSessionReady: boolean;
  isActiveSessionLoading: boolean;
  isCreatingAgentSession: boolean;
  isCancellingSession: boolean;
  isLoadingLatestSessions: boolean;
  latestSessionsError: string | null;
  minimizeToRail: () => void;
  railExperience: "command-center" | "project-agent";
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
  openLatestOrStartAgentSessionById: (input: {
    agentId: string | number;
    label?: string | null;
  }) => Promise<void>;
  startAgentSessionById: (input: {
    agentId: string | number;
    label?: string | null;
  }) => Promise<void>;
  thinkingSummary: string | null;
  toggleChat: () => void;
}

interface SessionRuntimeAccessUiMeta {
  imageDrift: AgentImageDriftRecord | null;
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

function createMessageId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createStartedAgentSessionRecord({
  fallbackSession,
  record,
  sessionId,
}: {
  fallbackSession: AgentSessionRecord;
  record: AgentSessionApiRecord | null;
  sessionId: string;
}) {
  if (record) {
    return toAgentSessionRecordFromApi(record, fallbackSession);
  }

  return {
    ...fallbackSession,
    id: sessionId,
    runtimeSessionId: sessionId,
    isPlaceholder: false,
    updatedAt: new Date().toISOString(),
    messages: [],
  } satisfies AgentSessionRecord;
}

function buildSyntheticModelCatalogFromSessionModel({
  model,
  provider,
}: {
  model: string | null | undefined;
  provider: string | null | undefined;
}): AvailableChatRunConfigOptions | null {
  const normalizedProvider = provider?.trim() || null;
  const normalizedModel = model?.trim() || null;

  if (!normalizedModel) {
    return null;
  }

  const providerLabel = normalizedProvider
    ? normalizedProvider
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : "Session";
  const synthesizedModel = {
    auth: null,
    id: [normalizedProvider ?? "", "session-default", normalizedModel].join("::"),
    label: normalizedModel,
    defaultReasoningEffort: null,
    value: normalizedModel,
    provider: normalizedProvider,
    reasoningEfforts: [],
    source: "session-default",
  } satisfies AvailableChatModelOption;

  return {
    providers: normalizedProvider
      ? [
          {
            label: providerLabel,
            value: normalizedProvider,
          },
        ]
      : [],
    models: [synthesizedModel],
    reasoningEfforts: [],
  } satisfies AvailableChatRunConfigOptions;
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

function isAbortLikeError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.trim().toLowerCase();
  return message.includes("abort");
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

function buildChatAvailableModelsCacheKey({
  agentType,
  userId,
}: {
  agentType: string | null | undefined;
  userId?: string | null;
}) {
  return buildAvailableRunConfigCacheKey({
    agentType,
    userId,
  });
}

function applyModelConfigToSession(
  session: AgentSessionRecord,
  {
    model,
    provider,
    thinking = "",
  }: {
    model: string;
    provider: string;
    thinking?: string | null;
  },
) {
  if (!session.agent) {
    return session;
  }

  return {
    ...session,
    serializedSession: applyModelConfigToSerializedSession(session.serializedSession, {
      provider,
      model,
      thinking,
    }),
    agent: {
      ...session.agent,
      llmProvider: provider,
      llmModel: model,
    },
  } satisfies AgentSessionRecord;
}

function createFallbackAgentSessionAgentFromId({
  agentId,
  label,
}: {
  agentId: string | number;
  label?: string | null;
}) {
  const normalizedAgentId = String(agentId).trim();
  const nextAgent = createDefaultAgentSessionAgent();

  return {
    ...nextAgent,
    name: label?.trim() || nextAgent.name,
    displayLabel: label?.trim() || "",
    requestAgentType: "",
    agentUniqueId: normalizedAgentId,
  };
}

function isCommandCenterBaseSession(session: AgentSessionRecord | null | undefined) {
  return session?.origin === "astro_command_center_base";
}

function findCommandCenterBaseSessionId(sessions: readonly AgentSessionRecord[]) {
  return sessions.find((session) => isCommandCenterBaseSession(session))?.id ?? null;
}

interface EmbeddedChatRailState {
  closeRail: () => void;
  isRailOpen: boolean;
  openRail: (mode: ChatRailMode) => void;
  pageOriginPath?: string;
  railMode: ChatRailMode;
  setPageOriginPath?: (value: string) => void;
}

interface ChatProviderProps {
  children: ReactNode;
  embeddedLaunchTarget?: {
    agentId: string | number;
    label?: string | null;
    launchKey: number;
  } | null;
  embeddedRailState?: EmbeddedChatRailState | null;
  variant?: "embedded-project-agent" | "global";
}

export function ChatProvider({
  children,
  embeddedLaunchTarget = null,
  embeddedRailState = null,
  variant = "global",
}: ChatProviderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const chatContext = useChatViewContext();
  const isEmbeddedProjectAgent = variant === "embedded-project-agent";
  const requestedChatSessionId = useMemo(() => {
    if (isEmbeddedProjectAgent || location.pathname !== CHAT_PAGE_PATH) {
      return null;
    }

    const value = new URLSearchParams(location.search).get("session");
    const trimmed = value?.trim();

    return trimmed ? trimmed : null;
  }, [isEmbeddedProjectAgent, location.pathname, location.search]);
  const shouldAvoidImplicitSessionSelection =
    isEmbeddedProjectAgent ||
    (location.pathname === CHAT_PAGE_PATH && !requestedChatSessionId);
  const sessionUserId = useAuthStore((state) => state.session?.user.id ?? null);
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const globalRailOpen = useChatUiStore((state) => state.railOpen);
  const globalRailMode = useChatUiStore((state) => state.railMode);
  const globalOpenRail = useChatUiStore((state) => state.openRail);
  const globalCloseRail = useChatUiStore((state) => state.closeRail);
  const globalPageOriginPath = useChatUiStore((state) => state.pageOriginPath);
  const globalSetPageOriginPath = useChatUiStore((state) => state.setPageOriginPath);
  const isRailOpen = isEmbeddedProjectAgent
    ? (embeddedRailState?.isRailOpen ?? false)
    : globalRailOpen;
  const railMode = isEmbeddedProjectAgent
    ? (embeddedRailState?.railMode ?? resolvePreferredChatRailMode())
    : globalRailMode;
  const openRail = isEmbeddedProjectAgent
    ? (embeddedRailState?.openRail ?? (() => undefined))
    : globalOpenRail;
  const closeRail = isEmbeddedProjectAgent
    ? (embeddedRailState?.closeRail ?? (() => undefined))
    : globalCloseRail;
  const pageOriginPath = isEmbeddedProjectAgent
    ? (embeddedRailState?.pageOriginPath ?? "/app")
    : globalPageOriginPath;
  const setPageOriginPath = isEmbeddedProjectAgent
    ? (embeddedRailState?.setPageOriginPath ?? (() => undefined))
    : globalSetPageOriginPath;
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
  const [directLaunchSessionId, setDirectLaunchSessionId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [hasVisibleAssistantOutput, setHasVisibleAssistantOutput] = useState(false);
  const [hasActiveChatStream, setHasActiveChatStream] = useState(false);
  const [isLoadingAvailableModels, setIsLoadingAvailableModels] = useState(false);
  const [isLoadingLatestSessions, setIsLoadingLatestSessions] = useState(false);
  const [isCancellingSession, setIsCancellingSession] = useState(false);
  const [latestSessionsError, setLatestSessionsError] = useState<string | null>(null);
  const [hasAttemptedLatestSessionsBootstrap, setHasAttemptedLatestSessionsBootstrap] =
    useState(false);
  const [latestSessionsAgentFilterId, setLatestSessionsAgentFilterId] = useState<number | null>(null);
  const [latestSessionsRefreshNonce, setLatestSessionsRefreshNonce] = useState(0);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [isCreatingAgentSession, setIsCreatingAgentSession] = useState(false);
  const [sessionHistoryReadyBySessionId, setSessionHistoryReadyBySessionId] = useState<
    Record<string, boolean>
  >({});
  const [sessionHistoryErrorBySessionId, setSessionHistoryErrorBySessionId] = useState<
    Record<string, string | null>
  >({});
  const [isLoadingSessionHistoryBySessionId, setIsLoadingSessionHistoryBySessionId] = useState<
    Record<string, boolean>
  >({});
  const [sessionRuntimeAccessMetaBySessionId, setSessionRuntimeAccessMetaBySessionId] = useState<
    Record<string, SessionRuntimeAccessUiMeta>
  >({});
  const [sessionSelectionMode, setSessionSelectionMode] = useState<"auto" | "explicit">("auto");
  const shouldSignalNewChatRef = useRef(true);
  const pendingNewChatRequestRef = useRef(false);
  const expectedNewSessionRef = useRef(false);
  const runtimeRef = useRef<AssistantRuntime | null>(null);
  const selectedSessionRef = useRef<AgentSessionRecord | null>(null);
  const activeSessionRef = useRef<AgentSessionRecord | null>(null);
  const activeSessionDetailRef = useRef<AgentSessionDetailSnapshot | null>(null);
  const activeSessionReadinessRef = useRef<AgentSessionInteractionReadiness>(
    createIdleAgentSessionReadiness(null),
  );
  const agentSessionsRef = useRef<AgentSessionRecord[]>([]);
  const sessionSelectionModeRef = useRef<"auto" | "explicit">("auto");
  const selectedModelValueRef = useRef<string | null>(null);
  const selectedReasoningEffortValueRef = useRef<string | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const loadedSessionIdRef = useRef<string | null>(null);
  const activeChatStreamSessionIdRef = useRef<string | null>(null);
  const activeChatStreamLookupSessionIdRef = useRef<string | null>(null);
  const sessionPickerSyncRef = useRef<string | null>(null);
  const unavailableSessionModelNoticeRef = useRef<string | null>(null);
  const sessionHistoryRequestRef = useRef<AbortController | null>(null);
  const availableModelsRequestRef = useRef<AbortController | null>(null);
  const sessionRuntimeAccessMetaRequestRef = useRef<AbortController | null>(null);
  const appliedAvailableModelsCacheKeyRef = useRef<string | null>(null);
  const hasAppliedAvailableModelsRef = useRef(false);
  const commandCenterBootstrapRequestRef = useRef<AbortController | null>(null);
  const commandCenterBootstrapAttemptKeyRef = useRef<string | null>(null);
  const sessionModelPatchRequestRef = useRef<AbortController | null>(null);
  const directLaunchSessionIdRef = useRef<string | null>(null);
  const commandCenterSessionIdRef = useRef<string | null>(null);
  const embeddedLaunchKeyRef = useRef<number | null>(null);
  const shouldHydrateChatRuntime =
    location.pathname === CHAT_PAGE_PATH || isRailOpen;
  const isProjectAgentRail = Boolean(directLaunchSessionId);
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
      setHasActiveChatStream(true);
    },
    [],
  );
  const clearActiveChatStream = useCallback(() => {
    activeChatStreamSessionIdRef.current = null;
    activeChatStreamLookupSessionIdRef.current = null;
    setHasActiveChatStream(false);
  }, []);
  const clearProjectAgentRailSelection = useCallback(() => {
    directLaunchSessionIdRef.current = null;
    setDirectLaunchSessionId(null);
  }, []);
  const preserveCommandCenterSelection = useCallback(() => {
    if (directLaunchSessionIdRef.current === currentSessionIdRef.current) {
      return;
    }

    commandCenterSessionIdRef.current =
      findCommandCenterBaseSessionId(agentSessionsRef.current) ?? commandCenterSessionIdRef.current;
  }, []);
  const restoreCommandCenterSelection = useCallback(() => {
    clearProjectAgentRailSelection();

    const nextSessionId =
      findCommandCenterBaseSessionId(agentSessionsRef.current) ?? commandCenterSessionIdRef.current;

    commandCenterSessionIdRef.current = nextSessionId;
    if (currentSessionIdRef.current !== nextSessionId) {
      setSessionSelectionMode("auto");
      setCurrentSessionId(nextSessionId);
    }
  }, [clearProjectAgentRailSelection]);
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
  const updateSessionRuntimeAccessMeta = useCallback(
    ({
      imageDrift,
      sessionId,
    }: {
      imageDrift: AgentImageDriftRecord | null;
      sessionId: string | null;
    }) => {
      const normalizedSessionId = sessionId?.trim() || null;

      if (!normalizedSessionId) {
        return;
      }

      setSessionRuntimeAccessMetaBySessionId((current) => {
        const existing = current[normalizedSessionId];

        if (existing?.imageDrift === imageDrift) {
          return current;
        }

        return {
          ...current,
          [normalizedSessionId]: {
            imageDrift,
          },
        };
      });
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
  const commandCenterBaseSessionId = useMemo(
    () => findCommandCenterBaseSessionId(agentSessions),
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
  const activeAgentType = useMemo(
    () => selectedSession?.agent?.requestAgentType || "",
    [selectedSession],
  );
  const activeRequestAgentType = useMemo(
    () => resolveAgentSessionRequestAgentType(selectedSession),
    [selectedSession],
  );
  const activeAgentLabel = useMemo(
    () => resolveAgentSessionLabel(selectedSession),
    [selectedSession],
  );
  const availableModelsSessionId = activeSession?.id ?? null;
  const shouldDeferSessionBoundModelLoading =
    shouldAvoidImplicitSessionSelection && !availableModelsSessionId;
  const availableModelsAgentType = useMemo(
    () => resolveAgentSessionRequestAgentType(activeSession ?? selectedSession),
    [
      activeSession?.agent?.requestAgentType,
      activeSession?.id,
      selectedSession?.agent?.requestAgentType,
      selectedSession?.id,
    ],
  );
  const availableModelsAssistantEndpoint = useMemo(
    () =>
      resolveMainSequenceAiAssistantEndpointForAgentType(
        availableModelsAgentType,
      ),
    [availableModelsAgentType],
  );
  const hasAvailableModelsSessionId = Boolean(availableModelsSessionId);
  const availableModelsCacheKey = useMemo(
    () =>
      buildChatAvailableModelsCacheKey({
        agentType: availableModelsAgentType,
        userId: sessionUserId,
      }),
    [
      availableModelsAgentType,
      sessionUserId,
    ],
  );
  const syntheticAvailableModelsFallback = useMemo(
    () =>
      buildSyntheticModelCatalogFromSessionModel({
        model: selectedSession?.agent?.llmModel ?? null,
        provider: selectedSession?.agent?.llmProvider ?? null,
      }),
    [selectedSession?.agent?.llmModel, selectedSession?.agent?.llmProvider],
  );
  const shouldSuppressDirectLaunchRuntimePrefetch =
    shouldHydrateChatRuntime &&
    sessionSelectionMode === "explicit" &&
    isProjectAgentRail;
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
      imageDrift: sessionRuntimeAccessMetaBySessionId[activeSession.id]?.imageDrift ?? null,
    });
  }, [
    activeSession,
    activeSessionDetail,
    agentId,
    sessionRuntimeAccessMetaBySessionId,
  ]);
  const activeSessionReadiness = useMemo<AgentSessionInteractionReadiness>(() => {
    if (env.useMockData) {
      return currentSessionId
        ? createReadyAgentSessionReadiness(currentSessionId)
        : createIdleAgentSessionReadiness(null);
    }

    if (!shouldHydrateChatRuntime) {
      return createIdleAgentSessionReadiness(activeSession?.id ?? currentSessionId);
    }

    if (!currentSessionId) {
      if (shouldAvoidImplicitSessionSelection && !isCreatingAgentSession) {
        return createIdleAgentSessionReadiness(null);
      }

      if (
        !hasAttemptedLatestSessionsBootstrap ||
        isCreatingAgentSession ||
        isLoadingLatestSessions
      ) {
        return createLoadingAgentSessionReadiness({
          sessionId: null,
        });
      }

      if (latestSessionsError) {
        return createErrorAgentSessionReadiness({
          error: latestSessionsError,
          sessionId: null,
        });
      }

      return createErrorAgentSessionReadiness({
        error: "A backend AgentSession is required before chat can accept input.",
        sessionId: null,
      });
    }

    if (!activeSession) {
      return createLoadingAgentSessionReadiness({
        sessionId: currentSessionId,
      });
    }

    const sessionId = activeSession.id;
    const detailReady = activeSessionDetail?.status === "ready";
    const detailLoading =
      activeSessionDetail === null ||
      activeSessionDetail.status === "idle" ||
      activeSessionDetail.status === "loading";
    const hasInsightsSnapshot = Boolean(activeSessionDetail?.insights);
    const insightsReady =
      detailReady &&
      hasInsightsSnapshot &&
      !activeSessionDetail?.insightsError;
    const insightsLoading =
      detailReady &&
      !hasInsightsSnapshot &&
      (activeSessionDetail?.isLoadingInsights || !activeSessionDetail?.insightsError);
    const historyReady = sessionHistoryReadyBySessionId[sessionId] === true;
    const historyLoading = isLoadingSessionHistoryBySessionId[sessionId] === true;
    const historyError = sessionHistoryErrorBySessionId[sessionId] ?? null;

    if (activeSessionDetail?.status === "not_found") {
      return createErrorAgentSessionReadiness({
        error: activeSessionDetail.detailError ?? "AgentSession not found.",
        sessionId,
        status: "not_found",
      });
    }

    if (activeSessionDetail?.status === "error") {
      return createErrorAgentSessionReadiness({
        error: activeSessionDetail.detailError ?? "Failed to load AgentSession detail.",
        sessionId,
      });
    }

    if (activeSessionDetail?.insightsError) {
      return createErrorAgentSessionReadiness({
        detailReady,
        error: activeSessionDetail.insightsError,
        sessionId,
      });
    }

    if (historyError) {
      return createErrorAgentSessionReadiness({
        detailReady,
        error: historyError,
        historyReady,
        insightsReady,
        sessionId,
      });
    }

    if (detailReady && insightsReady && historyReady) {
      return createReadyAgentSessionReadiness(sessionId);
    }

    if (detailLoading || insightsLoading || historyLoading || !historyReady) {
      return createLoadingAgentSessionReadiness({
        detailReady,
        historyReady,
        insightsReady,
        sessionId,
      });
    }

    return createLoadingAgentSessionReadiness({
      detailReady,
      historyReady,
      insightsReady,
      sessionId,
    });
  }, [
    activeSession,
    activeSessionDetail,
    currentSessionId,
    hasAttemptedLatestSessionsBootstrap,
    isCreatingAgentSession,
    isLoadingLatestSessions,
    isLoadingSessionHistoryBySessionId,
    latestSessionsError,
    sessionHistoryErrorBySessionId,
    sessionHistoryReadyBySessionId,
    shouldHydrateChatRuntime,
  ]);
  const isActiveSessionReady = activeSessionReadiness.status === "ready";
  const isActiveSessionLoading = activeSessionReadiness.status === "loading";

  const clearThread = useCallback(() => {
    setRunStatus("idle");
    setRunStatusDetail(null);
    setThinkingSummary(null);
    setHasVisibleAssistantOutput(false);
    setSessionNotice(null);
  }, []);

  useEffect(() => {
    if (!isEmbeddedProjectAgent && location.pathname === CHAT_PAGE_PATH) {
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
    setCurrentSessionId(
      requestedChatSessionId ??
        (shouldAvoidImplicitSessionSelection ? null : restoredSessions[0]?.id ?? null),
    );
    setSessionSelectionMode(requestedChatSessionId ? "explicit" : "auto");
    setHasAttemptedLatestSessionsBootstrap(false);
    setSessionRuntimeAccessMetaBySessionId({});
    loadedSessionIdRef.current = null;
    commandCenterBootstrapRequestRef.current?.abort();
    commandCenterBootstrapAttemptKeyRef.current = null;
  }, [requestedChatSessionId, sessionUserId, shouldAvoidImplicitSessionSelection]);

  useEffect(() => {
    if (env.useMockData) {
      clearMainSequenceAiResolvedRuntimeAccess();
      return;
    }

    if (!sessionToken) {
      clearMainSequenceAiResolvedRuntimeAccess();
    }
  }, [sessionToken]);

  useEffect(() => {
    const markAvailableModelsStateCleared = () => {
      appliedAvailableModelsCacheKeyRef.current = null;
      hasAppliedAvailableModelsRef.current = false;
    };
    const clearAvailableModelsState = () => {
      markAvailableModelsStateCleared();
      setAvailableModels([]);
      setAvailableProviders([]);
      setAvailableReasoningEfforts([]);
      setAvailableModelsError(null);
      setIsLoadingAvailableModels(false);
    };
    const applyAvailableModelsState = (
      options: AvailableChatRunConfigOptions,
      cacheKey: string | null,
    ) => {
      appliedAvailableModelsCacheKeyRef.current = cacheKey;
      hasAppliedAvailableModelsRef.current = options.models.length > 0;
      setAvailableProviders(options.providers);
      setAvailableModels(options.models);
      setAvailableModelsError(null);
      setIsLoadingAvailableModels(false);
    };

    availableModelsRequestRef.current?.abort();

    if (env.useMockData) {
      clearAvailableModelsState();
      return;
    }

    if (!shouldHydrateChatRuntime) {
      clearAvailableModelsState();
      return;
    }

    if (shouldDeferSessionBoundModelLoading) {
      clearAvailableModelsState();
      return;
    }

    if (shouldSuppressDirectLaunchRuntimePrefetch) {
      const syntheticOptions = syntheticAvailableModelsFallback ?? {
        providers: [],
        models: [],
        reasoningEfforts: [],
      };

      appliedAvailableModelsCacheKeyRef.current = availableModelsCacheKey;
      hasAppliedAvailableModelsRef.current = syntheticOptions.models.length > 0;
      setAvailableProviders(syntheticOptions.providers);
      setAvailableModels(syntheticOptions.models);
      setAvailableReasoningEfforts(syntheticOptions.reasoningEfforts);
      setAvailableModelsError(null);
      setIsLoadingAvailableModels(false);
      return;
    }

    if (!sessionToken) {
      clearAvailableModelsState();
      return;
    }

    const cachedOptions = peekAvailableRunConfigOptionsCacheSnapshot(availableModelsCacheKey);

    if (cachedOptions?.fresh) {
      applyAvailableModelsState(cachedOptions.value, availableModelsCacheKey);
      return;
    }

    const hasCurrentCatalog =
      appliedAvailableModelsCacheKeyRef.current === availableModelsCacheKey &&
      hasAppliedAvailableModelsRef.current;
    const shouldKeepCurrentCatalog = Boolean(cachedOptions?.value || hasCurrentCatalog);

    if (cachedOptions?.value) {
      applyAvailableModelsState(cachedOptions.value, availableModelsCacheKey);
    }

    const controller = new AbortController();
    availableModelsRequestRef.current = controller;
    setAvailableModelsError(null);

    if (!shouldKeepCurrentCatalog) {
      markAvailableModelsStateCleared();
      setAvailableProviders([]);
      setAvailableModels([]);
      setAvailableReasoningEfforts([]);
      setIsLoadingAvailableModels(true);
    } else {
      setIsLoadingAvailableModels(false);
    }

    void (async () => {
      try {
        const options = await fetchAvailableRunConfigOptions({
          assistantEndpoint: availableModelsAssistantEndpoint,
          cacheKey: availableModelsCacheKey,
          onResolvedAccess: (resolvedAccess) => {
            updateSessionRuntimeAccessMeta({
              imageDrift: resolvedAccess.imageDrift,
              sessionId: availableModelsSessionId,
            });
          },
          sessionId: availableModelsSessionId,
          signal: controller.signal,
          token: sessionToken,
          tokenType: sessionTokenType,
        });

        if (controller.signal.aborted) {
          return;
        }

        applyAvailableModelsState(options, availableModelsCacheKey);
      } catch (error) {
        if (controller.signal.aborted || isAbortLikeError(error)) {
          return;
        }

        if (!shouldKeepCurrentCatalog) {
          markAvailableModelsStateCleared();
          setAvailableProviders([]);
          setAvailableModels([]);
          setAvailableReasoningEfforts([]);
          setAvailableModelsError(
            error instanceof Error ? error.message : "Available models request failed.",
          );
        }
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
    availableModelsAssistantEndpoint,
    availableModelsCacheKey,
    hasAvailableModelsSessionId,
    availableModelsSessionId,
    sessionToken,
    sessionTokenType,
    shouldDeferSessionBoundModelLoading,
    shouldSuppressDirectLaunchRuntimePrefetch,
    shouldHydrateChatRuntime,
    syntheticAvailableModelsFallback,
    updateSessionRuntimeAccessMeta,
  ]);

  useEffect(() => {
    sessionRuntimeAccessMetaRequestRef.current?.abort();

    if (
      env.useMockData ||
      !shouldHydrateChatRuntime ||
      !sessionToken ||
      !activeSession?.id
    ) {
      return;
    }

    if (sessionRuntimeAccessMetaBySessionId[activeSession.id]) {
      return;
    }

    const controller = new AbortController();
    sessionRuntimeAccessMetaRequestRef.current = controller;

    void (async () => {
      try {
        const handle = await fetchAgentSessionRuntimeAccess({
          sessionId: activeSession.id,
          signal: controller.signal,
          token: sessionToken,
          tokenType: sessionTokenType,
        });

        if (controller.signal.aborted) {
          return;
        }

        updateSessionRuntimeAccessMeta({
          imageDrift: handle.runtimeAccess?.imageDrift ?? null,
          sessionId: activeSession.id,
        });
      } catch {
        if (controller.signal.aborted) {
          return;
        }
      } finally {
        if (sessionRuntimeAccessMetaRequestRef.current === controller) {
          sessionRuntimeAccessMetaRequestRef.current = null;
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [
    activeSession?.id,
    sessionRuntimeAccessMetaBySessionId,
    sessionToken,
    sessionTokenType,
    shouldHydrateChatRuntime,
    updateSessionRuntimeAccessMeta,
  ]);

  useEffect(() => {
    if (
      !shouldHydrateChatRuntime ||
      !sessionToken ||
      shouldSuppressDirectLaunchRuntimePrefetch
    ) {
      setHasAttemptedLatestSessionsBootstrap(false);
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
          const currentSession = currentSessions.find(
            (session) => session.id === currentSessionIdRef.current,
          );
          const keepLocalDraft =
            currentSession &&
            (!currentSession.runtimeSessionId || currentSession.isPlaceholder);

          const nextSessions = sortAgentSessions(
            [
              ...(keepLocalDraft
                ? [
                    currentSession,
                    ...remoteSessions.filter((session) => session.id !== currentSession.id),
                  ]
                : remoteSessions),
            ],
          );
          const requestedSession = requestedChatSessionId
            ? nextSessions.find((session) => session.id === requestedChatSessionId) ?? null
            : null;

          if (requestedSession) {
            setSessionSelectionMode("explicit");
            setCurrentSessionId(requestedSession.id);
          } else if (requestedChatSessionId && !currentSession) {
            setCurrentSessionId(nextSessions[0]?.id ?? null);
          } else if (
            !currentSession &&
            sessionSelectionModeRef.current !== "explicit" &&
            !shouldAvoidImplicitSessionSelection
          ) {
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
          setHasAttemptedLatestSessionsBootstrap(true);
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
    shouldSuppressDirectLaunchRuntimePrefetch,
    shouldAvoidImplicitSessionSelection,
    requestedChatSessionId,
  ]);

  useEffect(() => {
    if (!shouldHydrateChatRuntime || isEmbeddedProjectAgent) {
      return;
    }

    if (
      env.useMockData ||
      !sessionToken ||
      latestSessionsAgentFilterId !== null ||
      shouldSuppressDirectLaunchRuntimePrefetch ||
      !hasAttemptedLatestSessionsBootstrap ||
      isLoadingLatestSessions ||
      latestSessionsError ||
      isCreatingAgentSession
    ) {
      return;
    }

    if (agentSessions.length !== 0) {
      return;
    }

    const bootstrapAttemptKey = `${sessionUserId ?? "anonymous"}:command-center-zero-sessions`;

    if (commandCenterBootstrapAttemptKeyRef.current === bootstrapAttemptKey) {
      return;
    }

    commandCenterBootstrapAttemptKeyRef.current = bootstrapAttemptKey;
    commandCenterBootstrapRequestRef.current?.abort();

    const controller = new AbortController();
    commandCenterBootstrapRequestRef.current = controller;
    setIsCreatingAgentSession(true);
    setLatestSessionsError(null);
    setSessionNotice(null);

    void (async () => {
      try {
        const handle = await fetchCommandCenterBaseSessionHandle({
          signal: controller.signal,
          token: sessionToken,
          tokenType: sessionTokenType,
        });

        if (controller.signal.aborted) {
          return;
        }

        if (agentSessionsRef.current.length !== 0) {
          return;
        }

        const nextSession = toAgentSessionRecordFromBaseHandle(handle);
        const nextSessions = sortAgentSessions([nextSession]);

        agentSessionsRef.current = nextSessions;
        setAgentSessions(nextSessions);
        setSessionSelectionMode("auto");
        setCurrentSessionId(nextSession.id);
        setSessionNotice(null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const detail =
          error instanceof Error
            ? error.message
            : "Command Center could not start the orchestrator session.";

        setLatestSessionsError(`Command Center could not start the orchestrator session. ${detail}`);
      } finally {
        if (!controller.signal.aborted) {
          setIsCreatingAgentSession(false);
        }

        if (commandCenterBootstrapRequestRef.current === controller) {
          commandCenterBootstrapRequestRef.current = null;
        }
      }
    })();
  }, [
    agentSessions,
    hasAttemptedLatestSessionsBootstrap,
    isCreatingAgentSession,
    isEmbeddedProjectAgent,
    isLoadingLatestSessions,
    latestSessionsAgentFilterId,
    latestSessionsError,
    sessionToken,
    sessionTokenType,
    sessionUserId,
    shouldHydrateChatRuntime,
    shouldSuppressDirectLaunchRuntimePrefetch,
  ]);

  useEffect(() => {
    if (
      isEmbeddedProjectAgent ||
      location.pathname === CHAT_PAGE_PATH ||
      !isRailOpen ||
      isProjectAgentRail ||
      agentSessions.length === 0
    ) {
      return;
    }

    if (commandCenterBaseSessionId) {
      commandCenterSessionIdRef.current = commandCenterBaseSessionId;

      if (currentSessionId !== commandCenterBaseSessionId) {
        setSessionSelectionMode("auto");
        setSessionNotice(null);
        setCurrentSessionId(commandCenterBaseSessionId);
      }
      return;
    }

    if (
      env.useMockData ||
      !sessionToken ||
      isCreatingAgentSession ||
      commandCenterBootstrapRequestRef.current
    ) {
      return;
    }

    const controller = new AbortController();
    commandCenterBootstrapRequestRef.current = controller;
    setIsCreatingAgentSession(true);
    setLatestSessionsError(null);
    setSessionNotice(null);

    void (async () => {
      try {
        const handle = await fetchCommandCenterBaseSessionHandle({
          signal: controller.signal,
          token: sessionToken,
          tokenType: sessionTokenType,
        });

        if (controller.signal.aborted) {
          return;
        }

        const currentSessions = agentSessionsRef.current;
        const nextSession = toAgentSessionRecordFromBaseHandle(
          handle,
          currentSessions.find((session) => session.id === handle.sessionId),
        );
        const nextSessions = sortAgentSessions([
          nextSession,
          ...currentSessions.filter((session) => session.id !== nextSession.id),
        ]);

        agentSessionsRef.current = nextSessions;
        commandCenterSessionIdRef.current = nextSession.id;
        setAgentSessions(nextSessions);
        setSessionSelectionMode("auto");
        setCurrentSessionId(nextSession.id);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const detail =
          error instanceof Error
            ? error.message
            : "Command Center could not load the orchestrator session.";

        setLatestSessionsError(`Command Center could not load the orchestrator session. ${detail}`);
      } finally {
        if (!controller.signal.aborted) {
          setIsCreatingAgentSession(false);
        }

        if (commandCenterBootstrapRequestRef.current === controller) {
          commandCenterBootstrapRequestRef.current = null;
        }
      }
    })();

    return () => {
      controller.abort();

      if (commandCenterBootstrapRequestRef.current === controller) {
        commandCenterBootstrapRequestRef.current = null;
      }
    };
  }, [
    agentSessions.length,
    commandCenterBaseSessionId,
    currentSessionId,
    isCreatingAgentSession,
    isEmbeddedProjectAgent,
    isProjectAgentRail,
    isRailOpen,
    location.pathname,
    sessionToken,
    sessionTokenType,
  ]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    agentSessionsRef.current = agentSessions;
  }, [agentSessions]);

  useEffect(
    () => () => {
      commandCenterBootstrapRequestRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    directLaunchSessionIdRef.current = directLaunchSessionId;

    if (
      directLaunchSessionId &&
      (!currentSessionId || currentSessionId !== directLaunchSessionId)
    ) {
      directLaunchSessionIdRef.current = null;
      setDirectLaunchSessionId(null);
    }
  }, [currentSessionId, directLaunchSessionId]);

  useEffect(() => {
    if (directLaunchSessionId) {
      return;
    }

    commandCenterSessionIdRef.current = commandCenterBaseSessionId;
  }, [commandCenterBaseSessionId, directLaunchSessionId]);

  useEffect(() => {
    selectedSessionRef.current = selectedSession;
  }, [selectedSession]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    activeSessionDetailRef.current = activeSessionDetail;
  }, [activeSessionDetail]);

  useEffect(() => {
    activeSessionReadinessRef.current = activeSessionReadiness;
  }, [activeSessionReadiness]);

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

  useEffect(() => {
    const sessionId = activeSessionDetail?.sessionId ?? null;
    const serializedRecord = activeSessionDetail?.serializedRecord ?? null;

    if (!sessionId || !serializedRecord) {
      return;
    }

    setAgentSessions((currentSessions) =>
      currentSessions.map((session) =>
        session.id === sessionId
          ? attachSerializedSessionToSession(session, serializedRecord)
          : session,
      ),
    );

    if (activeSessionRef.current?.id === sessionId) {
      activeSessionRef.current = attachSerializedSessionToSession(
        activeSessionRef.current,
        serializedRecord,
      );
    }

    if (selectedSessionRef.current?.id === sessionId) {
      selectedSessionRef.current = attachSerializedSessionToSession(
        selectedSessionRef.current,
        serializedRecord,
      );
    }
  }, [activeSessionDetail?.serializedRecord, activeSessionDetail?.sessionId]);

  const persistSelectedSessionModelConfig = useCallback(
    ({
      model,
      persistToBackend = true,
      provider,
      thinking = "",
    }: {
      model: string | null;
      persistToBackend?: boolean;
      provider: string | null;
      thinking?: string | null;
    }) => {
      const normalizedProvider = provider?.trim();
      const normalizedModel = model?.trim();
      const normalizedThinking = typeof thinking === "string" ? thinking : "";
      const activeSession = activeSessionRef.current;
      const sessionId = resolveAgentSessionLookupId(activeSession);

      if (!activeSession || !sessionId || !normalizedProvider || !normalizedModel) {
        return;
      }

      const normalizedConfig = {
        provider: normalizedProvider,
        model: normalizedModel,
        thinking: normalizedThinking,
      };
      const previousActiveSession = activeSession;
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

      if (!persistToBackend) {
        return;
      }

      sessionModelPatchRequestRef.current?.abort();
      const controller = new AbortController();
      sessionModelPatchRequestRef.current = controller;

      void (async () => {
        try {
          await patchAgentSessionModelConfig({
            llmModel: normalizedModel,
            llmProvider: normalizedProvider,
            llmThinking: normalizedThinking,
            sessionId,
            signal: controller.signal,
            token: sessionToken,
            tokenType: sessionTokenType,
          });
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }

          if (activeSessionRef.current?.id === previousActiveSession.id) {
            activeSessionRef.current = previousActiveSession;
          }

          if (selectedSessionRef.current?.id === previousActiveSession.id) {
            selectedSessionRef.current = previousActiveSession;
          }

          setAgentSessions((currentSessions) =>
            currentSessions.map((session) =>
              session.id === previousActiveSession.id ? previousActiveSession : session,
            ),
          );

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
    [sessionToken, sessionTokenType],
  );

  const handleSelectedProviderChange = useCallback(
    (provider: string | null) => {
      if (activeSessionReadinessRef.current.status !== "ready") {
        return;
      }

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
        thinking: selectedReasoningEffortValueRef.current ?? "",
        persistToBackend: false,
      });
    },
    [availableModels, persistSelectedSessionModelConfig, selectedModelValue],
  );

  const handleSelectedModelChange = useCallback(
    (modelId: string | null) => {
      if (activeSessionReadinessRef.current.status !== "ready") {
        return;
      }

      setSelectedModelValue(modelId);
      selectedModelValueRef.current = modelId;

      const selectedModel = availableModels.find((model) => model.id === modelId) ?? null;

      if (selectedModel?.provider && selectedModel.provider !== selectedProviderValue) {
        setSelectedProviderValue(selectedModel.provider);
      }

      persistSelectedSessionModelConfig({
        provider: selectedModel?.provider ?? selectedProviderValue,
        model: selectedModel?.value ?? null,
        thinking: selectedReasoningEffortValueRef.current ?? "",
      });
    },
    [availableModels, persistSelectedSessionModelConfig, selectedProviderValue],
  );
  const handleSelectedReasoningEffortChange = useCallback((value: string | null) => {
    if (activeSessionReadinessRef.current.status !== "ready") {
      return;
    }

    setSelectedReasoningEffortValue(value);
    const selectedModel =
      availableModels.find((model) => model.id === selectedModelValueRef.current) ?? null;

    persistSelectedSessionModelConfig({
      provider: selectedModel?.provider ?? selectedProviderValue,
      model: selectedModel?.value ?? null,
      thinking: value ?? "",
    });
  }, [availableModels, persistSelectedSessionModelConfig, selectedProviderValue]);

  useEffect(() => {
    writeAgentSessions(sessionUserId, agentSessions);
  }, [agentSessions, sessionUserId]);

  useEffect(() => {
    if (availableModels.length === 0) {
      if (selectedProviderValue !== null) {
        setSelectedProviderValue(null);
      }
      return;
    }

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
  }, [
    availableModels.length,
    availableProviders,
    currentSessionId,
    selectedProviderValue,
    selectedSession,
  ]);

  useEffect(() => {
    if (!currentSessionId) {
      return;
    }

    if (availableModels.length === 0) {
      if (selectedProviderValue !== null) {
        setSelectedProviderValue(null);
      }
      if (selectedModelValue !== null) {
        setSelectedModelValue(null);
        selectedModelValueRef.current = null;
      }
      unavailableSessionModelNoticeRef.current = null;
      sessionPickerSyncRef.current = null;
      return;
    }

    if (availableProviders.length === 0) {
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
    selectedModelValue,
    selectedProviderValue,
    selectedSession?.agent?.llmModel,
    selectedSession?.agent?.llmProvider,
    toast,
  ]);

  useEffect(() => {
    if (availableModels.length === 0) {
      if (selectedModelValue !== null) {
        setSelectedModelValue(null);
        selectedModelValueRef.current = null;
      }
      return;
    }

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

  const selectAgentSession = useCallback(
    (sessionId: string) => {
      if (currentSessionIdRef.current === sessionId) {
        return;
      }

      persistSessionMessages();
      clearProjectAgentRailSelection();
      setSessionSelectionMode("explicit");
      setSessionNotice(null);
      setCurrentSessionId(sessionId);
    },
    [clearProjectAgentRailSelection, persistSessionMessages],
  );

  useEffect(() => {
    if (location.pathname !== CHAT_PAGE_PATH || !requestedChatSessionId) {
      return;
    }

    if (!agentSessions.some((session) => session.id === requestedChatSessionId)) {
      return;
    }

    if (currentSessionIdRef.current === requestedChatSessionId) {
      if (sessionSelectionModeRef.current !== "explicit") {
        setSessionSelectionMode("explicit");
      }
      return;
    }

    persistSessionMessages();
    setSessionSelectionMode("explicit");
    setSessionNotice(null);
    setCurrentSessionId(requestedChatSessionId);
  }, [
    agentSessions,
    location.pathname,
    persistSessionMessages,
    requestedChatSessionId,
  ]);

  const createAgentSession = useCallback(async () => {
    if (isCreatingAgentSession) {
      return;
    }

    persistSessionMessages();
    clearProjectAgentRailSelection();
    setSessionSelectionMode("explicit");

    if (env.useMockData) {
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
      return;
    }

    const current = agentSessions.find((session) => session.id === currentSessionIdRef.current);
    const launchAgent = current?.agent ?? createDefaultAgentSessionAgent();
    const launchAgentId = launchAgent.id;

    if (launchAgentId === null || launchAgentId === undefined) {
      toast({
        title: "Agent session not created",
        description: "The current agent does not include a backend agent id.",
        variant: "error",
      });
      return;
    }

    setIsCreatingAgentSession(true);
    setSessionNotice(null);

    try {
      const { record, sessionId } = await startNewAgentSessionRequest({
        agentId: launchAgentId,
        createdByUser: sessionUserId ?? "",
        token: sessionToken,
        tokenType: sessionTokenType,
      });
      const fallbackSession = createEmptyAgentSession(launchAgent);
      const nextSession = createStartedAgentSessionRecord({
        fallbackSession,
        record,
        sessionId,
      });

      setAgentSessions((currentSessions) =>
        sortAgentSessions([
          nextSession,
          ...currentSessions.filter((session) => session.id !== nextSession.id),
        ]),
      );
      setCurrentSessionId(nextSession.id);
    } catch (error) {
      toast({
        title: "Agent session not created",
        description:
          error instanceof Error ? error.message : "Unable to create a new agent session.",
        variant: "error",
      });
    } finally {
      setIsCreatingAgentSession(false);
    }
  }, [
    agentSessions,
    clearProjectAgentRailSelection,
    isCreatingAgentSession,
    persistSessionMessages,
    sessionToken,
    sessionTokenType,
    sessionUserId,
    toast,
  ]);

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
    async (agent: AgentSearchResult) => {
      if (isCreatingAgentSession) {
        return;
      }

      persistSessionMessages();
      clearProjectAgentRailSelection();
      setSessionSelectionMode("explicit");
      setLatestSessionsAgentFilterId(agent.id);

      if (env.useMockData) {
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
        return;
      }

      setIsCreatingAgentSession(true);
      setSessionNotice(null);

      try {
        const { record, sessionId } = await startNewAgentSessionRequest({
          agentId: agent.id,
          createdByUser: sessionUserId ?? "",
          token: sessionToken,
          tokenType: sessionTokenType,
        });
        const fallbackSession = attachAgentToSession(createEmptyAgentSession(), agent);
        const nextSession = createStartedAgentSessionRecord({
          fallbackSession,
          record,
          sessionId,
        });

        setAgentSessions((currentSessions) =>
          sortAgentSessions([
            nextSession,
            ...currentSessions.filter((session) => session.id !== nextSession.id),
          ]),
        );
        setCurrentSessionId(nextSession.id);
      } catch (error) {
        toast({
          title: "Agent session not created",
          description:
            error instanceof Error ? error.message : "Unable to create a new agent session.",
          variant: "error",
        });
      } finally {
        setIsCreatingAgentSession(false);
      }
    },
    [
      clearProjectAgentRailSelection,
      isCreatingAgentSession,
      persistSessionMessages,
      sessionToken,
      sessionTokenType,
      sessionUserId,
      toast,
    ],
  );

  const startAgentSessionById = useCallback(
    async ({
      agentId,
      label,
    }: {
      agentId: string | number;
      label?: string | null;
    }) => {
      if (isCreatingAgentSession) {
        return;
      }

      const normalizedAgentId = `${agentId}`.trim();

      if (!normalizedAgentId) {
        toast({
          title: "Agent session not created",
          description: "The selected project agent does not expose a valid backend agent id.",
          variant: "error",
        });
        return;
      }

      persistSessionMessages();
      setSessionSelectionMode("explicit");
      setLatestSessionsAgentFilterId(null);
      setSessionNotice(null);
      setIsCreatingAgentSession(true);
      preserveCommandCenterSelection();

      try {
        const { record, sessionId } = await startNewAgentSessionRequest({
          agentId: normalizedAgentId,
          createdByUser: sessionUserId ?? "",
          token: sessionToken,
          tokenType: sessionTokenType,
        });
        const fallbackSession = createEmptyAgentSession(
          createFallbackAgentSessionAgentFromId({
            agentId: normalizedAgentId,
            label,
          }),
        );
        const nextSession = createStartedAgentSessionRecord({
          fallbackSession,
          record,
          sessionId,
        });

        setAgentSessions((currentSessions) =>
          sortAgentSessions([
            nextSession,
            ...currentSessions.filter((session) => session.id !== nextSession.id),
          ]),
        );
        directLaunchSessionIdRef.current = nextSession.id;
        setDirectLaunchSessionId(nextSession.id);
        setCurrentSessionId(nextSession.id);
        scheduleOpenPreferredRail();
      } catch (error) {
        toast({
          title: "Agent session not created",
          description:
            error instanceof Error ? error.message : "Unable to create a new agent session.",
          variant: "error",
        });
      } finally {
        setIsCreatingAgentSession(false);
      }
    },
    [
      isCreatingAgentSession,
      persistSessionMessages,
      preserveCommandCenterSelection,
      scheduleOpenPreferredRail,
      sessionToken,
      sessionTokenType,
      sessionUserId,
      toast,
    ],
  );

  const openLatestOrStartAgentSessionById = useCallback(
    async ({
      agentId,
      label,
    }: {
      agentId: string | number;
      label?: string | null;
    }) => {
      if (isCreatingAgentSession) {
        return;
      }

      const normalizedAgentId = `${agentId}`.trim();

      if (!normalizedAgentId) {
        toast({
          title: "Agent session not opened",
          description: "The selected project agent does not expose a valid backend agent id.",
          variant: "error",
        });
        return;
      }

      persistSessionMessages();
      setSessionSelectionMode("explicit");
      setLatestSessionsAgentFilterId(null);
      setSessionNotice(null);
      setIsCreatingAgentSession(true);
      preserveCommandCenterSelection();

      try {
        const latestAgentSessions = await fetchLatestAgentSessions({
          agentId: normalizedAgentId,
          createdByUser: sessionUserId ?? "",
          token: sessionToken,
          tokenType: sessionTokenType,
        });
        const latestSessionRecord = latestAgentSessions[0] ?? null;

        if (latestSessionRecord) {
          const fallbackSession = createEmptyAgentSession(
            createFallbackAgentSessionAgentFromId({
              agentId: normalizedAgentId,
              label,
            }),
          );
          const existingSession =
            agentSessions.find(
              (session) =>
                session.id === String(latestSessionRecord.agent_session || latestSessionRecord.id),
            ) ?? fallbackSession;
          const nextSession = attachSerializedSessionToSession(
            existingSession,
            latestSessionRecord as AgentSessionSerializedRecord,
          );

          setAgentSessions((currentSessions) =>
            sortAgentSessions([
              nextSession,
              ...currentSessions.filter((session) => session.id !== nextSession.id),
            ]),
          );
          directLaunchSessionIdRef.current = nextSession.id;
          setDirectLaunchSessionId(nextSession.id);
          setCurrentSessionId(nextSession.id);
          scheduleOpenPreferredRail();
          return;
        }

        const { record, sessionId } = await startNewAgentSessionRequest({
          agentId: normalizedAgentId,
          createdByUser: sessionUserId ?? "",
          token: sessionToken,
          tokenType: sessionTokenType,
        });
        const fallbackSession = createEmptyAgentSession(
          createFallbackAgentSessionAgentFromId({
            agentId: normalizedAgentId,
            label,
          }),
        );
        const nextSession = createStartedAgentSessionRecord({
          fallbackSession,
          record,
          sessionId,
        });

        setAgentSessions((currentSessions) =>
          sortAgentSessions([
            nextSession,
            ...currentSessions.filter((session) => session.id !== nextSession.id),
          ]),
        );
        directLaunchSessionIdRef.current = nextSession.id;
        setDirectLaunchSessionId(nextSession.id);
        setCurrentSessionId(nextSession.id);
        scheduleOpenPreferredRail();
      } catch (error) {
        toast({
          title: "Agent session not opened",
          description:
            error instanceof Error ? error.message : "Unable to open the project agent session.",
          variant: "error",
        });
      } finally {
        setIsCreatingAgentSession(false);
      }
    },
    [
      agentSessions,
      isCreatingAgentSession,
      persistSessionMessages,
      preserveCommandCenterSelection,
      scheduleOpenPreferredRail,
      sessionToken,
      sessionTokenType,
      sessionUserId,
      toast,
    ],
  );

  useEffect(() => {
    if (!isEmbeddedProjectAgent || !isRailOpen || !embeddedLaunchTarget?.agentId) {
      return;
    }

    if (embeddedLaunchKeyRef.current === embeddedLaunchTarget.launchKey) {
      return;
    }

    embeddedLaunchKeyRef.current = embeddedLaunchTarget.launchKey;

    void openLatestOrStartAgentSessionById({
      agentId: embeddedLaunchTarget.agentId,
      label: embeddedLaunchTarget.label,
    });
  }, [
    embeddedLaunchTarget?.agentId,
    embeddedLaunchTarget?.label,
    embeddedLaunchTarget?.launchKey,
    isEmbeddedProjectAgent,
    isRailOpen,
    openLatestOrStartAgentSessionById,
  ]);

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

      setSessionHistoryReadyBySessionId((current) => ({
        ...current,
        [sessionId]: false,
      }));
      setSessionHistoryErrorBySessionId((current) => ({
        ...current,
        [sessionId]: null,
      }));
      setIsLoadingSessionHistoryBySessionId((current) => ({
        ...current,
        [sessionId]: Boolean(lookupSessionId),
      }));

      runtimeRef.current?.thread.reset([]);
      shouldSignalNewChatRef.current = !lookupSessionId;
      pendingNewChatRequestRef.current = false;
      expectedNewSessionRef.current = false;
      setAgentId(null);
      clearThread();
      loadedSessionIdRef.current = sessionId;

      if (env.useMockData) {
        setMessages(session.messages);
        setIsRunning(false);
        setSessionHistoryReadyBySessionId((current) => ({
          ...current,
          [sessionId]: true,
        }));
        setIsLoadingSessionHistoryBySessionId((current) => ({
          ...current,
          [sessionId]: false,
        }));
        return;
      }

      if (!lookupSessionId) {
        setIsRunning(false);
        setIsLoadingSessionHistoryBySessionId((current) => ({
          ...current,
          [sessionId]: false,
        }));
        return;
      }

      const controller = new AbortController();
      sessionHistoryRequestRef.current = controller;

      void (async () => {
        try {
          const snapshot = await fetchSessionHistory({
            sessionId,
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

          if (snapshot.messages.length === 0 && snapshot.session.status !== "running") {
            setIsRunning(false);
            setRunStatus("idle");
            setRunStatusDetail(null);
          } else if (snapshot.session.status === "running" && latestSession.working) {
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
                    displayLabel: nextAgent.displayLabel,
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
          setSessionHistoryReadyBySessionId((current) => ({
            ...current,
            [sessionId]: true,
          }));
          setSessionHistoryErrorBySessionId((current) => ({
            ...current,
            [sessionId]: null,
          }));
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }

          const errorMessage =
            error instanceof Error ? error.message : "Session history request failed.";

          setIsRunning(false);
          setRunStatus("error");
          setRunStatusDetail(errorMessage);
          setSessionNotice(
            "Failed to rehydrate the selected AgentSession. Interaction is disabled until session history loads.",
          );
          setSessionHistoryReadyBySessionId((current) => ({
            ...current,
            [sessionId]: false,
          }));
          setSessionHistoryErrorBySessionId((current) => ({
            ...current,
            [sessionId]: errorMessage,
          }));
        } finally {
          if (!controller.signal.aborted) {
            setIsLoadingSessionHistoryBySessionId((current) => ({
              ...current,
              [sessionId]: false,
            }));
          }
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
      const agentType = resolveAgentSessionRequestAgentType(activeSession);
      const { resolvedAccess, response, url } = await fetchMainSequenceAiAssistantResponse({
        assistantEndpoint: resolveMainSequenceAiAssistantEndpointForAgentType(
          agentType,
        ),
        currentSessionId,
        requestPath: "/api/chat",
        runtimeTarget: "agent-runtime",
        ...init,
        sessionToken,
        sessionTokenType,
      });
      if (env.debugChat) {
        console.info("[main_sequence_ai] /api/chat resolved endpoint", {
          assistantEndpoint: resolvedAccess.assistantEndpoint,
          mode: resolvedAccess.mode,
          agentType,
          runtimeTarget: "agent-runtime",
          sessionId: currentSessionId,
          url,
        });
      }
      updateSessionRuntimeAccessMeta({
        imageDrift: resolvedAccess.imageDrift,
        sessionId: currentSessionId,
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
      const activeSessionDetail = activeSessionDetailRef.current;
      const activeSessionReadiness = activeSessionReadinessRef.current;

      if (activeSessionReadiness.status !== "ready") {
        throw new MainSequenceAiError(
          activeSessionReadiness.error ??
            "AgentSession is still loading. Wait for session detail, insights, and history before sending.",
          {
            source: "frontend_runtime_guard",
          },
        );
      }

      const selectedSessionId = resolveAgentSessionLookupId(activeSession);
      const isNewChatRequest = !activeSession || !selectedSessionId;
      const serializedSession =
        activeSession?.serializedSession ?? activeSessionDetail?.serializedRecord ?? null;
      const selectedReasoningEffort =
        selectedReasoningEffortValueRef.current ?? availableReasoningEfforts[0]?.value ?? null;

      if (!isNewChatRequest && !serializedSession) {
        throw new MainSequenceAiError(
          "AgentSession detail payload is unavailable. Wait for the session serializer to finish loading before sending.",
          {
            source: "frontend_runtime_guard",
          },
        );
      }

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
          agentType: resolveAgentSessionRequestAgentType(selectedSession),
          context: chatContext,
          newChat: isNewChatRequest,
          runConfig: selectedReasoningEffort
            ? {
                reasoning_effort: selectedReasoningEffort,
              }
            : undefined,
          session: !isNewChatRequest ? serializedSession : null,
          sessionId: !isNewChatRequest ? selectedSessionId : null,
          threadId:
            !isNewChatRequest ? activeSession?.threadId ?? currentSessionIdRef.current : null,
          userId: sessionUserId,
          workflowKey: activeRequestAgentType,
        }),
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
        }

        return;
      }

      if (type === "error") {
        const streamError =
          withMainSequenceAiErrorSource({
            message:
              typeof data.error === "string" && data.error.trim()
                ? data.error.trim()
                : typeof data.message === "string" && data.message.trim()
                  ? data.message.trim()
                  : typeof data.error_detail === "string" && data.error_detail.trim()
                    ? data.error_detail.trim()
                    : "The assistant runtime reported an error.",
            source:
              typeof data.error_source === "string" && data.error_source.trim()
                ? data.error_source.trim()
                : typeof data.source === "string" && data.source.trim()
                  ? data.source.trim()
                  : "assistant_runtime_stream",
          });

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
        assistantEndpoint: resolveMainSequenceAiAssistantEndpointForAgentType(
          resolveAgentSessionRequestAgentType(activeSession),
        ),
        body: {
          runtimeSessionId,
          threadId,
          userId: sessionUserId,
          reason: "user_requested",
          message: "User pressed stop.",
        },
        runtimeTarget: "agent-runtime",
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
    navigate(getChatPagePath(currentSessionIdRef.current));
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

  const closeChatRail = useCallback(() => {
    if (location.pathname !== CHAT_PAGE_PATH && directLaunchSessionIdRef.current) {
      restoreCommandCenterSelection();
    }

    closeRail();
  }, [closeRail, location.pathname, restoreCommandCenterSelection]);

  const toggleChat = useCallback(() => {
    if (location.pathname === CHAT_PAGE_PATH) {
      if (directLaunchSessionIdRef.current) {
        restoreCommandCenterSelection();
      }

      navigate(pageOriginPath || "/app");
      scheduleOpenPreferredRail();
      return;
    }

    if (isRailOpen) {
      closeChatRail();
      return;
    }

    restoreCommandCenterSelection();
    openPreferredRail();
  }, [
    closeChatRail,
    restoreCommandCenterSelection,
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
      activeAgentType,
      activeRequestAgentType,
      activeSessionDetail,
      activeSessionSummary,
      activeSessionReadiness,
      activeSessionDisplayId,
      activeSessionPreview,
      activeSessionUpdatedAt,
      availableModels,
      availableModelsError,
      availableProviders,
      availableReasoningEfforts,
      agentId,
      agentSessions: sortedAgentSessions,
      cancelActiveSession,
      clearThread: clearRuntimeThread,
      closeRail: closeChatRail,
      context: chatContext,
      createAgentSession,
      currentSessionId,
      deleteAgentSession,
      expandToPage,
      hasActiveChatStream,
      hasVisibleAssistantOutput,
      isRailOpen,
      isLoadingAvailableModels,
      isActiveSessionReady,
      isActiveSessionLoading,
      isCreatingAgentSession,
      isCancellingSession,
      isLoadingLatestSessions,
      latestSessionsError,
      minimizeToRail,
      railExperience: isProjectAgentRail ? "project-agent" : "command-center",
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
      openLatestOrStartAgentSessionById,
      setSelectedProviderValue: handleSelectedProviderChange,
      setSelectedReasoningEffortValue: handleSelectedReasoningEffortChange,
      startAgentSession,
      startAgentSessionById,
      thinkingSummary,
      toggleChat,
    }),
    [
      activeAgentLabel,
      activeAgentType,
      activeRequestAgentType,
      activeSessionDetail,
      activeSessionSummary,
      activeSessionReadiness,
      activeSessionDisplayId,
      activeSessionPreview,
      activeSessionUpdatedAt,
      availableModels,
      availableModelsError,
      availableProviders,
      availableReasoningEfforts,
      agentId,
      cancelActiveSession,
      currentSessionId,
      chatContext,
      clearRuntimeThread,
      closeChatRail,
      createAgentSession,
      deleteAgentSession,
      expandToPage,
      hasActiveChatStream,
      hasVisibleAssistantOutput,
      handleSelectedModelChange,
      handleSelectedProviderChange,
      handleSelectedReasoningEffortChange,
      isRailOpen,
      isLoadingAvailableModels,
      isActiveSessionReady,
      isActiveSessionLoading,
      isCreatingAgentSession,
      isCancellingSession,
      isLoadingLatestSessions,
      isProjectAgentRail,
      latestSessionsError,
      minimizeToRail,
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
      sortedAgentSessions,
      openLatestOrStartAgentSessionById,
      startAgentSession,
      startAgentSessionById,
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
