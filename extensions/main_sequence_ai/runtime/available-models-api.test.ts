import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchMainSequenceAiAssistantResponse: vi.fn(),
}));

vi.mock("./assistant-endpoint", () => ({
  fetchMainSequenceAiAssistantResponse: mocks.fetchMainSequenceAiAssistantResponse,
}));

import {
  clearAvailableRunConfigOptionsCache,
  fetchAvailableRunConfigOptions,
} from "./available-models-api";

describe("available models api", () => {
  const userUid = "00000000-0000-4000-8000-000000000123";

  beforeEach(() => {
    clearAvailableRunConfigOptionsCache();
    mocks.fetchMainSequenceAiAssistantResponse.mockReset();
    mocks.fetchMainSequenceAiAssistantResponse.mockResolvedValue({
      resolvedAccess: {
        imageDrift: null,
      },
      response: new Response(JSON.stringify({ models: [] }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    });
  });

  it("scopes available-model reads by created_by_user_uid, not legacy user id", async () => {
    await fetchAvailableRunConfigOptions({
      cacheKey: "available-models-test",
      createdByUserUid: userUid,
      runtimeTarget: "command-center-base",
      token: "session-token",
    });

    const request = mocks.fetchMainSequenceAiAssistantResponse.mock.calls[0]?.[0];

    expect(request.requestPath).toBe(
      `/api/chat/get_available_models?created_by_user_uid=${userUid}`,
    );
    expect(request.requestPath).not.toContain("created_by_user=");
    expect(request.headers).toBeUndefined();
  });

  it("rejects legacy numeric user ids before fetching available models", async () => {
    await expect(
      fetchAvailableRunConfigOptions({
        cacheKey: "available-models-test",
        createdByUserUid: "4",
        runtimeTarget: "command-center-base",
        token: "session-token",
      }),
    ).rejects.toThrow("legacy numeric user id");

    expect(mocks.fetchMainSequenceAiAssistantResponse).not.toHaveBeenCalled();
  });
});
