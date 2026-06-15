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
          knative_service_runtime: 123,
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

    const handle = await fetchAgentSessionRuntimeAccess({
      sessionId: "session-uid-91",
    });

    expect(handle.sessionId).toBe("session-uid-91");
    expect(handle.runtimeAccess?.isReady).toBe(true);
    expect(handle.runtimeAccess?.knativeServiceRuntimeId).toBe("123");
    expect(handle.runtimeAccess?.imageDrift).toEqual({
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

  it("prefers the singular bound_handle payload when runtime access includes a session handle", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          uid: "session-uid-91",
          bound_handle: {
            uid: "handle-uid-91",
            handle_unique_id: "portfolio-review-q2-2026",
            owner_user_uid: "user-uid-91",
            is_locked: false,
          },
          runtime_state: "working",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const handle = await fetchAgentSessionRuntimeAccess({
      sessionId: "session-uid-91",
    });

    expect(handle.handleUniqueId).toBe("portfolio-review-q2-2026");
  });
});
