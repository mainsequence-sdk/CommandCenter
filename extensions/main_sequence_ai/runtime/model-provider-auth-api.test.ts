import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchModelProviderAuthStates } from "./model-provider-auth-api";

describe("model provider auth api", () => {
  const userUid = "00000000-0000-4000-8000-000000000123";
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ providers: {} }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("scopes provider status reads by created_by_user_uid, not legacy user id", async () => {
    await fetchModelProviderAuthStates({
      createdByUserUid: userUid,
      token: "session-token",
    });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(requestInit?.headers);

    expect(requestUrl).toContain("/orm/api/agents/v1/model_provider_credentials/status/");
    expect(requestUrl).toContain(`created_by_user_uid=${userUid}`);
    expect(requestUrl).not.toContain("created_by_user=");
    expect(headers.get("Authorization")).toBe("Bearer session-token");
    expect(headers.get("X-User-UID")).toBe(userUid);
    expect(headers.has("X-User-ID")).toBe(false);
  });

  it("rejects legacy numeric user ids before making provider status requests", async () => {
    await expect(
      fetchModelProviderAuthStates({
        createdByUserUid: "4",
        token: "session-token",
      }),
    ).rejects.toThrow("legacy numeric user id");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
