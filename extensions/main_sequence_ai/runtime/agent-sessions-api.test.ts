import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchAgentSessionDetail,
  fetchLatestAgentSessions,
  getAgentSessionRecordHandleUniqueId,
  getAgentSessionRecordSessionId,
  getOrCreateAgentSessionRequest,
  normalizeAgentSessionLookupId,
  startNewAgentSessionRequest,
  type AgentSessionApiRecord,
} from "./agent-sessions-api";

function createAgentSessionRecord(
  overrides: Partial<AgentSessionApiRecord> = {},
): AgentSessionApiRecord {
  return {
    id: 91,
    agent_type: "astro-orchestrator",
    agent_name: "Astro Orchestrator",
    status: "completed",
    started_at: "2026-06-03T15:00:00Z",
    ended_at: null,
    llm_provider: "openai",
    llm_model: "gpt-5",
    engine_name: "python",
    ...overrides,
  };
}

describe("agent session api", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("prefers canonical uid fields over legacy numeric ids", () => {
    const record = createAgentSessionRecord({
      id: 91,
      uid: "session-uid-123",
      agent_session: 91,
      agent_session_uid: "legacy-ignored",
    });

    expect(getAgentSessionRecordSessionId(record)).toBe("session-uid-123");
  });

  it("treats nullish string ids as invalid lookup ids", () => {
    expect(normalizeAgentSessionLookupId("undefined")).toBeNull();
    expect(normalizeAgentSessionLookupId(" null ")).toBeNull();
    expect(normalizeAgentSessionLookupId("52")).toBeNull();
    expect(normalizeAgentSessionLookupId(52)).toBeNull();
    expect(normalizeAgentSessionLookupId("session-uid-123")).toBe("session-uid-123");
  });

  it("does not fall back to legacy numeric record ids", () => {
    const record = createAgentSessionRecord({
      id: 91,
      agent_session: 91,
      uid: null,
      agent_session_uid: null,
    });

    expect(getAgentSessionRecordSessionId(record)).toBe("");
  });

  it("reads the canonical singular bound_handle contract", () => {
    const record = createAgentSessionRecord({
      uid: "session-uid-123",
      bound_handle: {
        uid: "handle-uid-123",
        handle_unique_id: "portfolio-review-q2-2026",
        owner_user_uid: "user-uid-123",
        is_locked: false,
      },
      bound_handles: [
        {
          id: 91,
          handle_unique_id: "legacy-handle-should-not-win",
          owner_user: 4,
          is_locked: true,
        },
      ],
    });

    expect(getAgentSessionRecordHandleUniqueId(record)).toBe("portfolio-review-q2-2026");
  });

  it("rejects invalid detail lookups before calling fetch", async () => {
    await expect(fetchAgentSessionDetail({ sessionId: "undefined" })).rejects.toThrow(
      "valid session uid",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates sessions with a thread id and reads the returned session uid", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          uid: "session-uid-123",
          agent_type: "astro-orchestrator",
          agent_name: "Astro Orchestrator",
          status: "running",
          started_at: "2026-06-03T15:00:00Z",
          ended_at: null,
          llm_provider: "openai",
          llm_model: "gpt-5",
          engine_name: "python",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const result = await startNewAgentSessionRequest({
      agentId: 12,
      threadId: "thread-uid-123",
    });

    expect(result.sessionId).toBe("session-uid-123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      thread_id: "thread-uid-123",
    });
  });

  it("filters latest sessions by public agent uid when the lookup is not numeric", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    await fetchLatestAgentSessions({
      agentId: "agent-uid-123",
      createdByUserUid: "user-uid-123",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    const requestUrl = new URL(String(url));

    expect(requestUrl.searchParams.get("agent_uid")).toBe("agent-uid-123");
    expect(requestUrl.searchParams.has("agent_id")).toBe(false);
  });

  it("creates or reuses sessions with a handle using the canonical session endpoint", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          uid: "session-uid-123",
          agent_type: "astro-orchestrator",
          agent_name: "Astro Orchestrator",
          status: "running",
          started_at: "2026-06-03T15:00:00Z",
          ended_at: null,
          llm_provider: "openai",
          llm_model: "gpt-5",
          engine_name: "python",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const result = await getOrCreateAgentSessionRequest({
      agentUid: "agent-uid-123",
      handleUniqueId: "project:alpha:primary-agent",
      name: "Primary agent session",
      llmProvider: "openai",
      llmModel: "gpt-5",
      llmThinking: "",
    });

    expect(result.sessionId).toBe("session-uid-123");
    expect(result.record?.uid).toBe("session-uid-123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, requestInit] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(
      "/orm/api/agents/v1/agents/agent-uid-123/sessions/get_or_create_session/",
    );
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      handle_unique_id: "project:alpha:primary-agent",
      name: "Primary agent session",
      llm_provider: "openai",
      llm_model: "gpt-5",
      llm_thinking: "",
    });
  });

  it("resolves a canonical session by session uid", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          uid: "session-uid-123",
          agent_type: "astro-orchestrator",
          agent_name: "Astro Orchestrator",
          status: "running",
          started_at: "2026-06-03T15:00:00Z",
          ended_at: null,
          llm_provider: "openai",
          llm_model: "gpt-5",
          engine_name: "python",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const result = await getOrCreateAgentSessionRequest({
      agentUid: "agent-uid-123",
      sessionUid: "session-uid-123",
    });

    expect(result.sessionId).toBe("session-uid-123");
    const [, requestInit] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      session_uid: "session-uid-123",
    });
  });

  it("creates or reuses sessions with only a handle lookup key", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          uid: "session-uid-123",
          agent_type: "astro-orchestrator",
          agent_name: "Astro Orchestrator",
          status: "running",
          started_at: "2026-06-03T15:00:00Z",
          ended_at: null,
          llm_provider: "openai",
          llm_model: "gpt-5",
          engine_name: "python",
        }),
        {
          status: 201,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    await getOrCreateAgentSessionRequest({
      agentUid: "agent-uid-123",
      handleUniqueId: "project:alpha:primary-agent",
    });

    const [, requestInit] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      handle_unique_id: "project:alpha:primary-agent",
    });
  });

  it("rejects session get-or-create requests with multiple lookup keys", async () => {
    await expect(
      getOrCreateAgentSessionRequest({
        agentUid: "agent-uid-123",
        sessionUid: "session-uid-123",
        handleUniqueId: "project:alpha:primary-agent",
      }),
    ).rejects.toThrow("exactly one of session_uid or handle_unique_id");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects session get-or-create requests without a lookup key", async () => {
    await expect(
      getOrCreateAgentSessionRequest({
        agentUid: "agent-uid-123",
      }),
    ).rejects.toThrow("exactly one of session_uid or handle_unique_id");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects wrapped session get-or-create responses", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          session: {
            uid: "session-uid-123",
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    await expect(
      getOrCreateAgentSessionRequest({
        agentUid: "agent-uid-123",
        handleUniqueId: "project:alpha:primary-agent",
      }),
    ).rejects.toThrow("no AgentSession uid was returned");
  });
});
