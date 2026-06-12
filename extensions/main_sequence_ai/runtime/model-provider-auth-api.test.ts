import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchMainSequenceAiAssistantResponse: vi.fn(),
}));

vi.mock("./assistant-endpoint", () => ({
  fetchMainSequenceAiAssistantResponse: mocks.fetchMainSequenceAiAssistantResponse,
}));

import { fetchModelProviderAuthStates } from "./model-provider-auth-api";

describe("model provider auth api", () => {
  beforeEach(() => {
    mocks.fetchMainSequenceAiAssistantResponse.mockReset();
    mocks.fetchMainSequenceAiAssistantResponse.mockResolvedValue({
      response: new Response(JSON.stringify({ providers: [] }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    });
  });

  it("scopes provider status reads by created_by_user_uid, not legacy user id", async () => {
    await fetchModelProviderAuthStates({
      createdByUserUid: "user-uid-123",
      token: "session-token",
    });

    const request = mocks.fetchMainSequenceAiAssistantResponse.mock.calls[0]?.[0];

    expect(request.requestPath).toBe(
      "/api/model-providers?created_by_user_uid=user-uid-123",
    );
    expect(request.requestPath).not.toContain("created_by_user=");
  });
});
