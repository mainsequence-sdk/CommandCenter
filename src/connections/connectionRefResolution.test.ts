import { describe, expect, it } from "vitest";

import type { ConnectionInstance, ConnectionRef } from "@/connections/types";

import { resolveConnectionRefSelection } from "./connectionRefResolution";

function createInstance(input: {
  id: string | number;
  typeId: string;
  name: string;
  isDefault?: boolean;
  isSystem?: boolean;
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
    isSystem: input.isSystem,
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
  };
}

describe("resolveConnectionRefSelection", () => {
  it("repairs malformed widget refs to the only backend instance of the same type", () => {
    const requestedRef: ConnectionRef = {
      id: "binance-market-data",
      typeId: "finance.binance-market-data",
    };
    const backendInstance = createInstance({
      id: 42,
      typeId: "finance.binance-market-data",
      name: "Binance Prod",
    });

    const resolved = resolveConnectionRefSelection({
      requestedRef,
      backendInstances: [backendInstance],
    });

    expect(resolved.connectionRef).toEqual({
      id: 42,
      typeId: "finance.binance-market-data",
    });
    expect(resolved.connectionInstance?.id).toBe(42);
    expect(resolved.repaired).toBe(true);
  });

  it("prefers a provided instance when the picker is hidden and the type matches", () => {
    const requestedRef: ConnectionRef = {
      id: "prometheus-default",
      typeId: "prometheus.remote",
    };
    const preferredInstance = createInstance({
      id: 77,
      typeId: "prometheus.remote",
      name: "Prometheus Prod",
    });

    const resolved = resolveConnectionRefSelection({
      requestedRef,
      preferredInstance,
      backendInstances: [],
    });

    expect(resolved.connectionRef).toEqual({
      id: 77,
      typeId: "prometheus.remote",
    });
    expect(resolved.repaired).toBe(true);
  });

  it("does not guess when multiple backend instances exist without a default", () => {
    const requestedRef: ConnectionRef = {
      id: "broken-id",
      typeId: "finance.binance-market-data",
    };

    const resolved = resolveConnectionRefSelection({
      requestedRef,
      backendInstances: [
        createInstance({
          id: 1,
          typeId: "finance.binance-market-data",
          name: "Binance A",
        }),
        createInstance({
          id: 2,
          typeId: "finance.binance-market-data",
          name: "Binance B",
        }),
      ],
    });

    expect(resolved.connectionRef).toEqual(requestedRef);
    expect(resolved.connectionInstance).toBeUndefined();
    expect(resolved.repaired).toBe(false);
  });

  it("clears legacy synthetic placeholder refs when no backend repair is available", () => {
    const requestedRef: ConnectionRef = {
      id: "prometheus-default",
      typeId: "prometheus.remote",
    };

    const resolved = resolveConnectionRefSelection({
      requestedRef,
      backendInstances: [],
    });

    expect(resolved.connectionRef).toBeUndefined();
    expect(resolved.connectionInstance).toBeUndefined();
    expect(resolved.repaired).toBe(true);
  });
});
