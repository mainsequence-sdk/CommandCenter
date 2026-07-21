import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchMainSequenceAiAssistantResponse: vi.fn(),
}));

vi.mock("./assistant-endpoint", () => ({
  fetchMainSequenceAiAssistantResponse: mocks.fetchMainSequenceAiAssistantResponse,
}));

import {
  clearAvailableRunConfigOptionsCache,
  fetchAvailableRunConfigOptions,
  normalizeAvailableRunConfigOptions,
} from "./available-models-api";

describe("available models api", () => {
  const userUid = "00000000-0000-4000-8000-000000000123";

  beforeEach(() => {
    vi.useRealTimers();
    clearAvailableRunConfigOptionsCache();
    mocks.fetchMainSequenceAiAssistantResponse.mockReset();
    mocks.fetchMainSequenceAiAssistantResponse.mockImplementation(() =>
      Promise.resolve({
        resolvedAccess: {
          imageDrift: null,
        },
        response: new Response(
          JSON.stringify({
            models: [
              {
                source: "openai",
                provider: "openai",
                model: "gpt-5",
                label: "GPT-5",
              },
            ],
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        ),
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("defaults no-session available-model reads to command-center-base runtime access", async () => {
    await fetchAvailableRunConfigOptions({
      cacheKey: "available-models-default-runtime-test",
      createdByUserUid: userUid,
      token: "session-token",
    });

    const request = mocks.fetchMainSequenceAiAssistantResponse.mock.calls[0]?.[0];

    expect(request.currentSessionId).toBeUndefined();
    expect(request.runtimeTarget).toBe("command-center-base");
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

  it("caches empty available-model results briefly to avoid request loops", async () => {
    vi.useFakeTimers();
    mocks.fetchMainSequenceAiAssistantResponse.mockImplementation(() =>
      Promise.resolve({
        resolvedAccess: {
          imageDrift: null,
        },
        response: new Response(JSON.stringify({ models: [] }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      }),
    );

    await fetchAvailableRunConfigOptions({
      cacheKey: "empty-models-test",
      createdByUserUid: userUid,
      runtimeTarget: "command-center-base",
      token: "session-token",
    });
    await fetchAvailableRunConfigOptions({
      cacheKey: "empty-models-test",
      createdByUserUid: userUid,
      runtimeTarget: "command-center-base",
      token: "session-token",
    });

    expect(mocks.fetchMainSequenceAiAssistantResponse).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_001);

    await fetchAvailableRunConfigOptions({
      cacheKey: "empty-models-test",
      createdByUserUid: userUid,
      runtimeTarget: "command-center-base",
      token: "session-token",
    });

    expect(mocks.fetchMainSequenceAiAssistantResponse).toHaveBeenCalledTimes(2);
  });

  it("normalizes provider-keyed runtime model payloads", () => {
    const options = normalizeAvailableRunConfigOptions({
      providers: {
        openai: {
          models: [
            {
              model: "gpt-5.3-codex-spark",
              label: "GPT-5.3 Codex Spark",
            },
          ],
        },
      },
    });

    expect(options.providers).toEqual([
      {
        label: "openai",
        value: "openai",
      },
    ]);
    expect(options.models).toMatchObject([
      {
        label: "GPT-5.3 Codex Spark",
        provider: "openai",
        source: "openai",
        value: "gpt-5.3-codex-spark",
      },
    ]);
  });

  it("uses provider as source when runtime model rows omit source", () => {
    const options = normalizeAvailableRunConfigOptions({
      models: [
        {
          provider: "anthropic",
          model_name: "claude-sonnet-4",
          display_name: "Claude Sonnet 4",
        },
      ],
    });

    expect(options.models).toMatchObject([
      {
        label: "Claude Sonnet 4",
        provider: "anthropic",
        source: "anthropic",
        value: "claude-sonnet-4",
      },
    ]);
  });
});
