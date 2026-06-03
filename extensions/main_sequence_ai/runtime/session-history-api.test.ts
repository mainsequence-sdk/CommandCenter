import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchSessionHistory } from "./session-history-api";

describe("session history api", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("rejects invalid session lookups before hitting the backend", async () => {
    await expect(fetchSessionHistory({ sessionId: "undefined" })).rejects.toThrow(
      "valid session uid",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects numeric session lookups before hitting the backend", async () => {
    await expect(fetchSessionHistory({ sessionId: 87 })).rejects.toThrow("valid session uid");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
