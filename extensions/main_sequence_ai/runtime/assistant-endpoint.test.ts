import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchAstroCommandCenterAgentServiceByUser: vi.fn(),
  fetchAgentSessionRuntimeAccess: vi.fn(),
  getOrCreateAgentSessionRequest: vi.fn(),
}));

vi.mock("../../main_sequence/common/api", () => ({
  fetchAstroCommandCenterAgentServiceByUser:
    mocks.fetchAstroCommandCenterAgentServiceByUser,
}));

vi.mock("./command-center-base-session-api", () => ({
  ASTRO_COMMAND_CENTER_HANDLE_UNIQUE_ID: "astro-orchestrator-command-center",
  ASTRO_COMMAND_CENTER_SESSION_NAME: "Astro Command Center Session",
  fetchAgentSessionRuntimeAccess: mocks.fetchAgentSessionRuntimeAccess,
}));

vi.mock("./agent-sessions-api", () => ({
  getOrCreateAgentSessionRequest: mocks.getOrCreateAgentSessionRequest,
  normalizeAgentSessionLookupId: (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed && trimmed !== "undefined" && trimmed !== "null" ? trimmed : null;
  },
}));

import {
  clearMainSequenceAiResolvedRuntimeAccess,
  fetchMainSequenceAiAssistantResponse,
  resolveMainSequenceAiAssistantAccess,
} from "./assistant-endpoint";

describe("assistant endpoint resolver", () => {
  beforeEach(() => {
    clearMainSequenceAiResolvedRuntimeAccess();
    mocks.fetchAstroCommandCenterAgentServiceByUser.mockReset();
    mocks.getOrCreateAgentSessionRequest.mockReset();
    mocks.fetchAgentSessionRuntimeAccess.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("resolves Command Center base through Astro handle runtime access and uses the configured transport endpoint", async () => {
    mocks.fetchAstroCommandCenterAgentServiceByUser.mockResolvedValue({
      uid: "service-uid-91",
      agent_uid: "agent-uid-91",
      agent_type: "astro-orchestrator",
      scope: {
        kind: "user",
        user_uid: "user-uid-91",
      },
    });
    mocks.getOrCreateAgentSessionRequest.mockResolvedValue({
      sessionId: "session-uid-91",
      record: {
        uid: "session-uid-91",
      },
    });
    mocks.fetchAgentSessionRuntimeAccess.mockResolvedValue({
      sessionId: "session-uid-91",
      codingAgentId: "agent-uid-91",
      codingAgentServiceId: "service-uid-91",
      mode: "token",
      rpcUrl: "https://astro-runtime.example.test",
      token: "runtime-token",
      isReady: true,
      serviceRuntimeId: "runtime-uid-91",
      imageDrift: null,
      reconciliation: null,
    });

    const access = await resolveMainSequenceAiAssistantAccess({
      assistantEndpoint: "/__assistant__",
      runtimeTarget: "command-center-base",
      sessionToken: "session-token",
      sessionTokenType: "Bearer",
      sessionUserUid: "user-uid-91",
    });

    expect(mocks.fetchAstroCommandCenterAgentServiceByUser).toHaveBeenCalledWith(
      "user-uid-91",
      expect.objectContaining({}),
    );
    expect(mocks.getOrCreateAgentSessionRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        agentUid: "agent-uid-91",
        handleUniqueId: "astro-orchestrator-command-center",
        name: "Astro Command Center Session",
      }),
    );
    expect(mocks.fetchAgentSessionRuntimeAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-uid-91",
      }),
    );
    expect(access.assistantEndpoint).toBe("/__assistant__");
    expect(access.token).toBe("runtime-token");
    expect(access.mode).toBe("dynamic");
  });

  it("refreshes runtime credentials on auth failure without recreating Astro identity or session", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    mocks.fetchAstroCommandCenterAgentServiceByUser.mockResolvedValue({
      uid: "service-uid-91",
      agent_uid: "agent-uid-91",
      agent_type: "astro-orchestrator",
      scope: {
        kind: "user",
        user_uid: "user-uid-91",
      },
    });
    mocks.getOrCreateAgentSessionRequest.mockResolvedValue({
      sessionId: "session-uid-91",
      record: {
        uid: "session-uid-91",
      },
    });
    mocks.fetchAgentSessionRuntimeAccess
      .mockResolvedValueOnce({
        sessionId: "session-uid-91",
        codingAgentId: "agent-uid-91",
        codingAgentServiceId: "service-uid-91",
        mode: "token",
        rpcUrl: "https://astro-runtime.example.test",
        token: "expired-runtime-token",
        isReady: true,
        serviceRuntimeId: "runtime-uid-91",
        imageDrift: null,
        reconciliation: null,
      })
      .mockResolvedValueOnce({
        sessionId: "session-uid-91",
        codingAgentId: "agent-uid-91",
        codingAgentServiceId: "service-uid-91",
        mode: "token",
        rpcUrl: "https://astro-runtime.example.test",
        token: "fresh-runtime-token",
        isReady: true,
        serviceRuntimeId: "runtime-uid-91",
        imageDrift: null,
        reconciliation: null,
      });

    const result = await fetchMainSequenceAiAssistantResponse({
      assistantEndpoint: "https://debug-runtime.example.test",
      requestPath: "/health",
      runtimeTarget: "command-center-base",
      sessionToken: "session-token",
      sessionTokenType: "Bearer",
      sessionUserUid: "user-uid-91",
    });

    expect(result.response.status).toBe(200);
    expect(mocks.fetchAstroCommandCenterAgentServiceByUser).toHaveBeenCalledTimes(1);
    expect(mocks.getOrCreateAgentSessionRequest).toHaveBeenCalledTimes(1);
    expect(mocks.fetchAgentSessionRuntimeAccess).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://debug-runtime.example.test/health",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Headers).get("Authorization")).toBe(
      "Bearer expired-runtime-token",
    );
    expect((fetchMock.mock.calls[1]?.[1]?.headers as Headers).get("Authorization")).toBe(
      "Bearer fresh-runtime-token",
    );
  });

  it("uses dynamic session runtime access before proxy configured access when a session id exists", async () => {
    vi.stubEnv("VITE_ASSISTANT_UI_PROXY_TARGET", "http://assistant-proxy.example.test");
    mocks.fetchAgentSessionRuntimeAccess.mockResolvedValue({
      sessionId: "session-uid-91",
      codingAgentId: "agent-uid-91",
      codingAgentServiceId: "service-uid-91",
      mode: "token",
      rpcUrl: "https://astro-runtime.example.test",
      token: "runtime-token",
      isReady: true,
      serviceRuntimeId: "runtime-uid-91",
      imageDrift: null,
      reconciliation: null,
    });

    const access = await resolveMainSequenceAiAssistantAccess({
      assistantEndpoint: "/__assistant__",
      currentSessionId: "session-uid-91",
      runtimeTarget: "agent-runtime",
      sessionToken: "session-token",
      sessionTokenType: "Bearer",
      sessionUserUid: "user-uid-91",
    });

    expect(mocks.fetchAgentSessionRuntimeAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-uid-91",
      }),
    );
    expect(access.mode).toBe("dynamic");
    expect(access.assistantEndpoint).toBe("https://astro-runtime.example.test");
    expect(access.token).toBe("runtime-token");
  });

  it("rejects agent-runtime calls without a concrete session id", async () => {
    vi.stubEnv("VITE_ASSISTANT_UI_PROXY_TARGET", "http://assistant-proxy.example.test");

    await expect(
      resolveMainSequenceAiAssistantAccess({
        assistantEndpoint: "/__assistant__",
        runtimeTarget: "agent-runtime",
        sessionToken: "session-token",
        sessionTokenType: "Bearer",
        sessionUserUid: "user-uid-91",
      }),
    ).rejects.toThrow("requires a concrete session id or command-center-base target");

    expect(mocks.fetchAgentSessionRuntimeAccess).not.toHaveBeenCalled();
  });
});
