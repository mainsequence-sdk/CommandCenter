import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchAgentSessionDetail,
  getAgentSessionRecordSessionId,
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

  it("rejects invalid detail lookups before calling fetch", async () => {
    await expect(fetchAgentSessionDetail({ sessionId: "undefined" })).rejects.toThrow(
      "valid session uid",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates sessions with created_by_user_uid and reads the returned session uid", async () => {
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
      createdByUserUid: "user-uid-123",
      threadId: "thread-uid-123",
    });

    expect(result.sessionId).toBe("session-uid-123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      created_by_user_uid: "user-uid-123",
      thread_id: "thread-uid-123",
    });
  });
});
