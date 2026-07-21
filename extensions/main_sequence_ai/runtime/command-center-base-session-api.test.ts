import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchAgentSessionRuntimeAccess } from "./command-center-base-session-api";

describe("command center runtime access contract", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("normalizes image_drift from the AgentSession runtime-access payload", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          coding_agent_service_id: "91",
          coding_agent_id: "executor-agent",
          mode: "token",
          rpc_url: "https://executor.coding-agent.main-sequence.app/",
          token: "signed-token",
          is_ready: true,
          service_runtime_uid: "runtime-uid-123",
          image_drift: {
            agent_kind: "project_executor",
            available: true,
            has_drift: true,
            checks: [
              {
                key: "executor_bundle_image",
                label: "Executor bundle image",
                status: "drift",
                has_drift: true,
                matches: false,
                reason: "catalog_pointer_moved",
              },
            ],
            detail: null,
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

    const runtimeAccess = await fetchAgentSessionRuntimeAccess({
      sessionId: "session-uid-91",
    });

    expect(runtimeAccess.sessionId).toBe("session-uid-91");
    expect(runtimeAccess.isReady).toBe(true);
    expect(runtimeAccess.serviceRuntimeId).toBe("runtime-uid-123");
    expect(runtimeAccess.imageDrift).toEqual({
      agent_kind: "project_executor",
      autoheal_available: null,
      autoheal_message: null,
      available: true,
      has_drift: true,
      checks: [
        {
          key: "executor_bundle_image",
          label: "Executor bundle image",
          status: "drift",
          has_drift: true,
          matches: false,
          reason: "catalog_pointer_moved",
          message: null,
          autoheal_supported: null,
          autoheal_mode: null,
          autoheal_message: null,
          expected_image_uri: null,
          actual_image_uri: null,
        },
      ],
      detail: null,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/orm/api/agents/v1/sessions/session-uid-91/resolve_runtime_access/"),
      expect.objectContaining({
        body: "{}",
        method: "POST",
      }),
    );
  });

  it("rejects invalid runtime-access lookups before calling fetch", async () => {
    await expect(fetchAgentSessionRuntimeAccess({ sessionId: "undefined" })).rejects.toThrow(
      "valid session uid",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects numeric runtime-access lookups before calling fetch", async () => {
    await expect(fetchAgentSessionRuntimeAccess({ sessionId: 91 })).rejects.toThrow(
      "valid session uid",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

});
