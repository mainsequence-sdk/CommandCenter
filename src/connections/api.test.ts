import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConnectionInstance, ConnectionRef } from "@/connections/types";

import { resolveConnectionRefFromInstances } from "./api";

function createInstance(input: {
  id: string | number;
  typeId: string;
  name: string;
  isDefault?: boolean;
}): ConnectionInstance {
  return {
    id: input.id,
    typeId: input.typeId,
    typeVersion: 1,
    name: input.name,
    publicConfig: {},
    secureFields: {},
    status: "ok",
    isDefault: input.isDefault,
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
  };
}

describe("resolveConnectionRefFromInstances", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("reloads backend instances when repairing a runtime ref", async () => {
    const requestedRef: ConnectionRef = {
      id: "binance-market-data",
      typeId: "finance.binance-market-data",
    };

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          createInstance({
            id: 42,
            typeId: "finance.binance-market-data",
            name: "Binance Prod",
          }),
        ]),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const resolved = await resolveConnectionRefFromInstances(requestedRef, {
      allowFetch: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(resolved.connectionRef).toEqual({
      id: 42,
      typeId: "finance.binance-market-data",
    });
    expect(resolved.repaired).toBe(true);
  });

  it("requests the backend catalog on each execution-time resolution", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    await resolveConnectionRefFromInstances(undefined, { allowFetch: true });
    await resolveConnectionRefFromInstances(undefined, { allowFetch: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces backend catalog failures instead of silently falling back", async () => {
    fetchMock.mockRejectedValue(new Error("catalog down"));

    await expect(
      resolveConnectionRefFromInstances(
        {
          id: 42,
          typeId: "prometheus.remote",
        },
        { allowFetch: true },
      ),
    ).rejects.toThrow("catalog down");
  });
});
