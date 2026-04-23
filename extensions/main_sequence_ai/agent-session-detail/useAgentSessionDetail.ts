import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { env } from "@/config/env";
import type { SessionInsightsSnapshot } from "../assistant-ui/session-insights";
import type { SessionToolsSnapshot } from "../assistant-ui/session-tools";
import {
  fetchAgentSessionDetail,
  isAgentSessionNotFoundError,
} from "../runtime/agent-sessions-api";
import { fetchSessionInsights } from "../runtime/session-insights-api";
import { fetchSessionTools } from "../runtime/session-tools-api";
import {
  buildAgentSessionDetailSnapshot,
  normalizeAgentSessionCoreDetail,
  resolveAgentSessionLookupId,
  type AgentSessionContextInput,
  type AgentSessionCoreDetail,
  type AgentSessionDetailSnapshot,
  type AgentSessionDetailStatus,
} from "./model";

function setKeyedBoolean(
  current: Record<string, boolean>,
  key: string,
  value: boolean,
) {
  return value ? { ...current, [key]: true } : Object.fromEntries(
    Object.entries(current).filter(([entryKey]) => entryKey !== key),
  );
}

function setKeyedNullableString(
  current: Record<string, string | null>,
  key: string,
  value: string | null,
) {
  return value ? { ...current, [key]: value } : Object.fromEntries(
    Object.entries(current).filter(([entryKey]) => entryKey !== key),
  );
}

function removeKey<T>(current: Record<string, T>, key: string) {
  return Object.fromEntries(
    Object.entries(current).filter(([entryKey]) => entryKey !== key),
  ) as Record<string, T>;
}

export interface UseAgentSessionDetailOptions {
  session: AgentSessionContextInput | null;
  enabled: boolean;
  token?: string | null;
  tokenType?: string;
}

export interface AgentSessionDetailControllerState {
  activeDetail: AgentSessionDetailSnapshot | null;
  coreBySessionId: Record<string, AgentSessionCoreDetail>;
  detailStatusBySessionId: Record<string, AgentSessionDetailStatus>;
  detailErrorBySessionId: Record<string, string | null>;
  insightsBySessionId: Record<string, SessionInsightsSnapshot>;
  insightsErrorBySessionId: Record<string, string | null>;
  isLoadingInsightsBySessionId: Record<string, boolean>;
  toolsByLookupId: Record<string, SessionToolsSnapshot>;
  toolsErrorByLookupId: Record<string, string | null>;
  isLoadingToolsByLookupId: Record<string, boolean>;
  refreshSessionDetail: () => void;
  refreshSessionInsights: () => void;
  refreshSessionTools: () => void;
}

export function useAgentSessionDetail({
  enabled,
  session,
  token,
  tokenType = "Bearer",
}: UseAgentSessionDetailOptions): AgentSessionDetailControllerState {
  const [coreBySessionId, setCoreBySessionId] = useState<Record<string, AgentSessionCoreDetail>>({});
  const [detailStatusBySessionId, setDetailStatusBySessionId] = useState<
    Record<string, AgentSessionDetailStatus>
  >({});
  const [detailErrorBySessionId, setDetailErrorBySessionId] = useState<
    Record<string, string | null>
  >({});
  const [insightsBySessionId, setInsightsBySessionId] = useState<
    Record<string, SessionInsightsSnapshot>
  >({});
  const [insightsErrorBySessionId, setInsightsErrorBySessionId] = useState<
    Record<string, string | null>
  >({});
  const [isLoadingInsightsBySessionId, setIsLoadingInsightsBySessionId] = useState<
    Record<string, boolean>
  >({});
  const [toolsByLookupId, setToolsByLookupId] = useState<Record<string, SessionToolsSnapshot>>({});
  const [toolsErrorByLookupId, setToolsErrorByLookupId] = useState<
    Record<string, string | null>
  >({});
  const [isLoadingToolsByLookupId, setIsLoadingToolsByLookupId] = useState<Record<string, boolean>>(
    {},
  );
  const [detailRefreshNonce, setDetailRefreshNonce] = useState(0);
  const [insightsRefreshNonce, setInsightsRefreshNonce] = useState(0);
  const [toolsRefreshNonce, setToolsRefreshNonce] = useState(0);
  const detailRequestRef = useRef<AbortController | null>(null);
  const insightsRequestRef = useRef<AbortController | null>(null);
  const toolsRequestRef = useRef<AbortController | null>(null);
  const sessionId = session?.id ?? null;
  const lookupSessionId = useMemo(() => resolveAgentSessionLookupId(session), [session]);
  const activeDetailStatus =
    sessionId && detailStatusBySessionId[sessionId]
      ? detailStatusBySessionId[sessionId]
      : "idle";

  const refreshSessionDetail = useCallback(() => {
    setDetailRefreshNonce((current) => current + 1);
  }, []);

  const refreshSessionInsights = useCallback(() => {
    setInsightsRefreshNonce((current) => current + 1);
  }, []);

  const refreshSessionTools = useCallback(() => {
    setToolsRefreshNonce((current) => current + 1);
  }, []);

  useEffect(() => {
    detailRequestRef.current?.abort();

    if (env.useMockData || !enabled || !sessionId) {
      return;
    }

    const controller = new AbortController();
    detailRequestRef.current = controller;
    setDetailStatusBySessionId((current) => ({
      ...current,
      [sessionId]: "loading",
    }));
    setDetailErrorBySessionId((current) => setKeyedNullableString(current, sessionId, null));

    void (async () => {
      try {
        const record = await fetchAgentSessionDetail({
          sessionId,
          signal: controller.signal,
          token,
          tokenType,
        });

        if (controller.signal.aborted) {
          return;
        }

        setCoreBySessionId((current) => ({
          ...current,
          [sessionId]: normalizeAgentSessionCoreDetail(record),
        }));
        setDetailStatusBySessionId((current) => ({
          ...current,
          [sessionId]: "ready",
        }));
        setDetailErrorBySessionId((current) => setKeyedNullableString(current, sessionId, null));
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const nextStatus = isAgentSessionNotFoundError(error) ? "not_found" : "error";
        const message =
          error instanceof Error ? error.message : "Failed to load AgentSession detail.";

        setDetailStatusBySessionId((current) => ({
          ...current,
          [sessionId]: nextStatus,
        }));
        setDetailErrorBySessionId((current) => setKeyedNullableString(current, sessionId, message));
        setCoreBySessionId((current) => removeKey(current, sessionId));
        setInsightsBySessionId((current) => removeKey(current, sessionId));
        setInsightsErrorBySessionId((current) => removeKey(current, sessionId));
        setIsLoadingInsightsBySessionId((current) => removeKey(current, sessionId));

        if (lookupSessionId) {
          setToolsByLookupId((current) => removeKey(current, lookupSessionId));
          setToolsErrorByLookupId((current) => removeKey(current, lookupSessionId));
          setIsLoadingToolsByLookupId((current) => removeKey(current, lookupSessionId));
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [detailRefreshNonce, enabled, lookupSessionId, sessionId, token, tokenType]);

  useEffect(() => {
    insightsRequestRef.current?.abort();

    if (env.useMockData || !enabled || !sessionId || activeDetailStatus !== "ready") {
      return;
    }

    const controller = new AbortController();
    insightsRequestRef.current = controller;
    setIsLoadingInsightsBySessionId((current) => setKeyedBoolean(current, sessionId, true));
    setInsightsErrorBySessionId((current) => setKeyedNullableString(current, sessionId, null));

    void (async () => {
      try {
        const snapshot = await fetchSessionInsights({
          sessionId,
          signal: controller.signal,
          token,
          tokenType,
        });

        if (controller.signal.aborted) {
          return;
        }

        setInsightsBySessionId((current) => ({
          ...current,
          [sessionId]: snapshot,
        }));
        setInsightsErrorBySessionId((current) => setKeyedNullableString(current, sessionId, null));
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setInsightsErrorBySessionId((current) =>
          setKeyedNullableString(
            current,
            sessionId,
            error instanceof Error ? error.message : "Session insights request failed.",
          ),
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingInsightsBySessionId((current) => setKeyedBoolean(current, sessionId, false));
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [
    activeDetailStatus,
    enabled,
    insightsRefreshNonce,
    sessionId,
    token,
    tokenType,
  ]);

  useEffect(() => {
    toolsRequestRef.current?.abort();

    if (
      env.useMockData ||
      !enabled ||
      !lookupSessionId ||
      !sessionId ||
      activeDetailStatus !== "ready"
    ) {
      return;
    }

    const controller = new AbortController();
    toolsRequestRef.current = controller;
    setIsLoadingToolsByLookupId((current) => setKeyedBoolean(current, lookupSessionId, true));
    setToolsErrorByLookupId((current) => setKeyedNullableString(current, lookupSessionId, null));

    void (async () => {
      try {
        const snapshot = await fetchSessionTools({
          sessionId: lookupSessionId,
          signal: controller.signal,
          token,
          tokenType,
        });

        if (controller.signal.aborted) {
          return;
        }

        setToolsByLookupId((current) => ({
          ...current,
          [lookupSessionId]: snapshot,
        }));
        setToolsErrorByLookupId((current) =>
          setKeyedNullableString(current, lookupSessionId, null),
        );
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setToolsErrorByLookupId((current) =>
          setKeyedNullableString(
            current,
            lookupSessionId,
            error instanceof Error ? error.message : "Session tools request failed.",
          ),
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingToolsByLookupId((current) => setKeyedBoolean(current, lookupSessionId, false));
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [
    activeDetailStatus,
    enabled,
    lookupSessionId,
    sessionId,
    token,
    tokenType,
    toolsRefreshNonce,
  ]);

  const activeDetail = useMemo(() => {
    if (!session || !sessionId) {
      return null;
    }

    return buildAgentSessionDetailSnapshot({
      session,
      detailStatus:
        detailStatusBySessionId[sessionId] ??
        (env.useMockData || !enabled ? "idle" : "loading"),
      detailError: detailErrorBySessionId[sessionId] ?? null,
      core: coreBySessionId[sessionId] ?? null,
      insights:
        detailStatusBySessionId[sessionId] === "not_found"
          ? null
          : insightsBySessionId[sessionId] ?? null,
      isLoadingInsights: isLoadingInsightsBySessionId[sessionId] === true,
      insightsError:
        detailStatusBySessionId[sessionId] === "not_found"
          ? null
          : insightsErrorBySessionId[sessionId] ?? null,
      toolsSnapshot:
        lookupSessionId && detailStatusBySessionId[sessionId] !== "not_found"
          ? toolsByLookupId[lookupSessionId] ?? null
          : null,
      isLoadingTools:
        lookupSessionId ? isLoadingToolsByLookupId[lookupSessionId] === true : false,
      toolsError:
        lookupSessionId && detailStatusBySessionId[sessionId] !== "not_found"
          ? toolsErrorByLookupId[lookupSessionId] ?? null
          : null,
    });
  }, [
    coreBySessionId,
    detailErrorBySessionId,
    detailStatusBySessionId,
    enabled,
    insightsBySessionId,
    insightsErrorBySessionId,
    isLoadingInsightsBySessionId,
    isLoadingToolsByLookupId,
    lookupSessionId,
    session,
    sessionId,
    toolsByLookupId,
    toolsErrorByLookupId,
  ]);

  return {
    activeDetail,
    coreBySessionId,
    detailStatusBySessionId,
    detailErrorBySessionId,
    insightsBySessionId,
    insightsErrorBySessionId,
    isLoadingInsightsBySessionId,
    toolsByLookupId,
    toolsErrorByLookupId,
    isLoadingToolsByLookupId,
    refreshSessionDetail,
    refreshSessionInsights,
    refreshSessionTools,
  };
}
