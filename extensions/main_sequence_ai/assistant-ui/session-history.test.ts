import { describe, expect, it } from "vitest";

import { normalizeSessionHistorySnapshot } from "./session-history";

describe("session history provenance", () => {
  it("preserves backend agent-origin provenance on user messages", () => {
    const snapshot = normalizeSessionHistorySnapshot({
      version: 1,
      session: {
        sessionId: "87",
        threadId: "87",
        agentName: "mainsequence-project-executor",
        agentId: 25,
        agentSessionId: 87,
        status: "running",
        startedAt: "2026-05-10T12:00:00.000Z",
        updatedAt: "2026-05-10T12:00:02.000Z",
        error: null,
      },
      messages: [
        {
          id: "u_1",
          role: "user",
          createdAt: "2026-05-10T12:00:00.000Z",
          content: [
            {
              type: "text",
              text: "Inspect the prepared project and summarize the next implementation step.",
            },
          ],
          provenance: {
            origin: "agent",
            channel: "a2a",
            callerAgentName: "astro-orchestrator",
            handleUniqueId: "6f41da6f-bfd8-4598-a8a2-822bfabfba51",
            callerAgentSessionId: 52,
            targetAgentId: 25,
          },
        },
      ],
      inProgressMessage: null,
    });

    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.messages[0]).toMatchObject({
      role: "user",
      content: [
        {
          type: "data-main_sequence_ai_provenance",
          data: {
            origin: "agent",
            channel: "a2a",
            callerAgentName: "astro-orchestrator",
            handleUniqueId: "6f41da6f-bfd8-4598-a8a2-822bfabfba51",
            callerAgentSessionId: "52",
            targetAgentId: "25",
          },
        },
        {
          type: "text",
          text: "Inspect the prepared project and summarize the next implementation step.",
        },
      ],
      metadata: {
        custom: {
          mainSequenceAi: {
            provenance: {
              origin: "agent",
              channel: "a2a",
              callerAgentName: "astro-orchestrator",
              handleUniqueId: "6f41da6f-bfd8-4598-a8a2-822bfabfba51",
              callerAgentSessionId: "52",
              targetAgentId: "25",
            },
          },
        },
      },
    });
  });
});
