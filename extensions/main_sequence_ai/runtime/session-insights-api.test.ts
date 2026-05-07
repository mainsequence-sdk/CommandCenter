import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEmptySessionInsightsSnapshot,
  normalizeSessionInsightsSnapshot,
} from "../assistant-ui/session-insights";
import { fetchSessionInsights } from "./session-insights-api";

describe("session insights contract", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("normalizes the empty persisted-insights payload shape", () => {
    const snapshot = normalizeSessionInsightsSnapshot({
      has_insights: false,
      agent_session_id: "73",
      checkpoint_version: 4,
      bundle_hash: "bundle-123",
      computed_at: null,
      flushed_at: null,
      reason: null,
      insights: {},
      updated_at: null,
    });

    expect(snapshot.hasInsights).toBe(false);
    expect(snapshot.agentSessionId).toBe("73");
    expect(snapshot.checkpointVersion).toBe(4);
    expect(snapshot.bundleHash).toBe("bundle-123");
    expect(snapshot.computedAt).toBeNull();
    expect(snapshot.flushedAt).toBeNull();
    expect(snapshot.reason).toBeNull();
    expect(snapshot.updatedAt).toBeNull();
    expect(snapshot.info).toEqual({});
    expect(snapshot.context).toBeNull();
    expect(snapshot.model).toBeNull();
    expect(snapshot.usage).toBeNull();
    expect(snapshot.lastTurn).toBeNull();
    expect(snapshot.session.agentSessionId).toBe("73");
  });

  it("maps a legacy 404 insights lookup to the empty snapshot contract", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    await expect(fetchSessionInsights({ sessionId: 73 })).resolves.toEqual(
      createEmptySessionInsightsSnapshot({
        sessionId: 73,
      }),
    );
  });
});
