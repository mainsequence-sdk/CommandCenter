import { describe, expect, it } from "vitest";

import { createConnectionRuntimeStore } from "./connection-runtime-store";

describe("ConnectionRuntimeStore", () => {
  it("shares one live stream session for the same runtime key", () => {
    const store = createConnectionRuntimeStore("workspace-1");
    const closeCalls: Array<{ code?: number; reason?: string }> = [];
    let starts = 0;

    const first = store.acquireStreamSession({
      key: "stream:a",
      ownerId: "widget-a",
      start: () => {
        starts += 1;
        return {
          close: (code, reason) => {
            closeCalls.push({ code, reason });
          },
        };
      },
    });
    const second = store.acquireStreamSession({
      key: "stream:a",
      ownerId: "widget-b",
      start: () => {
        starts += 1;
        return {
          close: (code, reason) => {
            closeCalls.push({ code, reason });
          },
        };
      },
    });

    expect(starts).toBe(1);
    expect(store.getEntrySnapshot("stream:a")?.ownerIds).toEqual(["widget-a", "widget-b"]);
    expect(store.getEntrySnapshot("stream:a")?.activeOwnerCount).toBe(2);

    first.release();
    expect(closeCalls).toEqual([]);
    expect(store.getEntrySnapshot("stream:a")?.ownerIds).toEqual(["widget-b"]);

    second.release();
    expect(closeCalls).toEqual([
      { code: 1000, reason: "connection runtime store owner released" },
    ]);
    expect(store.getEntrySnapshot("stream:a")?.activeOwnerCount).toBe(0);
    expect(store.getEntrySnapshot("stream:a")?.sessionKind).toBe("retained");
  });

  it("publishes stream status and runtime summaries to observers", () => {
    const store = createConnectionRuntimeStore("workspace-1");
    const events: string[] = [];
    const unsubscribe = store.subscribe(() => {
      events.push(store.getEntrySnapshot("stream:b")?.status ?? "missing");
    });

    store.publishStreamState({
      key: "stream:b",
      ownerId: "widget-b",
      runtimeState: {
        streamStatus: "live",
        columns: ["symbol", "price"],
        rows: [{ symbol: "BTCUSDT", price: 70000 }],
        lastMessageAtMs: 1234,
      },
    });

    unsubscribe();

    expect(events).toEqual(["live"]);
    expect(store.getEntrySnapshot("stream:b")).toMatchObject({
      activeOwnerCount: 0,
      columnCount: 2,
      lastMessageAtMs: 1234,
      rowCount: 1,
      status: "live",
    });
  });

  it("notifies acquired owners without making passive publishes owners", () => {
    const store = createConnectionRuntimeStore("workspace-1");
    const ownerStates: Array<Record<string, unknown>> = [];
    const handle = store.acquireStreamSession({
      key: "stream:c",
      ownerId: "widget-c",
      onRuntimeStateChange: (state) => {
        ownerStates.push(state);
      },
      start: () => ({
        close: () => {},
      }),
    });

    store.publishStreamState({
      key: "stream:c",
      runtimeState: {
        streamStatus: "live",
        rows: [{ symbol: "BTCUSDT" }],
        columns: ["symbol"],
      },
    });

    expect(ownerStates).toHaveLength(1);
    expect(ownerStates[0]?.streamStatus).toBe("live");
    expect(store.getEntrySnapshot("stream:c")?.activeOwnerCount).toBe(1);

    handle.release();
    store.publishStreamState({
      key: "stream:c",
      runtimeState: {
        streamStatus: "live",
        rows: [{ symbol: "ETHUSDT" }],
        columns: ["symbol"],
      },
    });

    expect(ownerStates).toHaveLength(1);
    expect(store.getEntrySnapshot("stream:c")?.activeOwnerCount).toBe(0);
  });

  it("does not restart the live session when published state notifies owners", () => {
    const store = createConnectionRuntimeStore("workspace-1");
    const closeCalls: string[] = [];
    const ownerStates: Array<Record<string, unknown>> = [];
    let starts = 0;

    store.acquireStreamSession({
      key: "stream:d",
      ownerId: "widget-d",
      onRuntimeStateChange: (state) => {
        ownerStates.push(state);
      },
      start: () => {
        starts += 1;
        return {
          close: (_code, reason) => {
            closeCalls.push(reason ?? "");
          },
        };
      },
    });

    store.publishStreamState({
      key: "stream:d",
      runtimeState: {
        streamStatus: "connecting",
        rows: [],
        columns: [],
      },
    });
    store.publishStreamState({
      key: "stream:d",
      runtimeState: {
        streamStatus: "live",
        rows: [{ symbol: "BTCUSDT" }],
        columns: ["symbol"],
      },
    });

    expect(starts).toBe(1);
    expect(closeCalls).toEqual([]);
    expect(ownerStates).toHaveLength(2);
    expect(store.getEntrySnapshot("stream:d")?.activeOwnerCount).toBe(1);
  });
});
