import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bulkDeleteAgents,
  fetchAgentList,
  fetchAgentRuntimeRef,
  getAgentSearchResultLookupKey,
  getAgentSearchResultRowKey,
} from "./agent-search";

describe("agent search api", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("normalizes nested agent.name and uses public uid for lookup keys", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              agent: {
                uid: "agent-uid-123",
                name: "Research Planner",
              },
              agent_type: "research",
              agent_unique_id: "research-planner",
              description: "Plans research work.",
              llm_provider: "openai",
              llm_model: "gpt-5",
              engine_name: "python",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const result = await fetchAgentList({});
    const agent = result.results[0];

    if (!agent) {
      throw new Error("Expected one normalized agent result.");
    }

    expect(agent.name).toBe("Research Planner");
    expect(agent.displayLabel).toBe("Research Planner");
    expect(agent.id).toBe(0);
    expect(getAgentSearchResultLookupKey(agent)).toBe("agent-uid-123");
    expect(getAgentSearchResultRowKey(agent, 0)).toBe("agent-uid-123");
  });

  it("reads agent runtime refs by public agent uid and runtime_uid", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          runtime_uid: "runtime-uid-123",
          runtime_kind: "knative_service_runtime",
          service_name: "agent-service",
          namespace: "agents",
          cluster_uid: "cluster-uid-123",
          latest_ready_revision_name: "agent-service-00001",
          exists: true,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const result = await fetchAgentRuntimeRef({ agentUid: "agent-uid-123" });

    expect(result.runtime_uid).toBe("runtime-uid-123");
    expect(result.exists).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/orm/api/agents/v1/agents/agent-uid-123/runtime-ref/");
    expect(String(url)).not.toContain("get_runtime_id");
  });

  it("bulk deletes agents by public agent uid", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          requested_agent_uids: ["agent-uid-123"],
          deleted_agent_uids: ["agent-uid-123"],
          missing_agent_uids: [],
          deleted_count: 1,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const result = await bulkDeleteAgents({
      agentUids: ["agent-uid-123"],
      token: "token-123",
      tokenType: "Bearer",
    });

    expect(result.deleted_count).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/orm/api/agents/v1/agents/bulk-delete/");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ agent_uids: ["agent-uid-123"] }));
    expect((init?.headers as Headers).get("Authorization")).toBe("Bearer token-123");
  });
});
