import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchAgentList,
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
});
