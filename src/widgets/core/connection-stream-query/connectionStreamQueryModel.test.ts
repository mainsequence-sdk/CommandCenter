import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConnectionQueryModel, ConnectionStreamServerMessage } from "@/connections/types";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";
import { readWidgetRuntimeUpdateContext } from "@/widgets/shared/runtime-update";
import {
  createRuntimeDataStore,
  getRuntimeDataRef,
  materializeRuntimeTabularFrame,
  storeTabularFrameRuntimeState,
} from "@/widgets/shared/runtime-data-store";

import {
  buildConnectionStreamQueryRuntimeKey,
  createConnectionStreamQueryWidgetRuntimeSession,
  normalizeConnectionStreamQueryProps,
  reduceConnectionStreamQueryMessage,
  type ConnectionStreamQueryRuntimeState,
  type ConnectionStreamQueryWidgetProps,
} from "./connectionStreamQueryModel";

const props: ConnectionStreamQueryWidgetProps = {
  connectionRef: {
    id: 42,
    typeId: "finance.binance-market-data",
  },
  queryModelId: "ticker",
  query: {
    kind: "ticker",
    symbols: ["BTCUSDT"],
  },
  mergeKeyFields: ["symbol"],
};

const queryModel: ConnectionQueryModel = {
  id: "ticker",
  label: "Ticker",
  outputContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
  stream: {
    transport: "websocket",
    modes: ["snapshot", "delta"],
    defaultMode: "delta",
    defaultMergeKeyFields: ["symbol"],
  },
};

const queryModelWithoutMergeDefaults: ConnectionQueryModel = {
  ...queryModel,
  stream: {
    transport: "websocket",
    modes: ["snapshot", "delta"],
    defaultMode: "delta",
  },
};

function streamMessage(
  type: "snapshot" | "delta",
  rows: Array<{ symbol: string; price?: number; quantity?: number }>,
): ConnectionStreamServerMessage {
  return {
    type,
    connectionId: 42,
    queryKind: "ticker",
    sequence: type === "snapshot" ? 1 : 2,
    emittedAt: type === "snapshot"
      ? "2026-04-28T00:00:00.000Z"
      : "2026-04-28T00:00:01.000Z",
    response: {
      frames: [
        {
          contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          fields: [
            {
              name: "symbol",
              type: "string",
              values: rows.map((row) => row.symbol),
            },
            rows.some((row) => row.quantity !== undefined)
              ? {
                  name: "quantity",
                  type: "number",
                  values: rows.map((row) => row.quantity ?? null),
                }
              : {
                  name: "price",
                  type: "number",
                  values: rows.map((row) => row.price ?? null),
                },
          ],
        },
      ],
    },
  };
}

class MockConnectionWebSocket {
  readonly url: string;
  readonly protocols?: string | string[];
  readyState = 0;
  sent: string[] = [];
  closeCalls: Array<{ code?: number; reason?: string }> = [];
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols;
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number, reason?: string) {
    this.readyState = 3;
    this.closeCalls.push({ code, reason });
  }

  open() {
    this.readyState = 1;
    this.onopen?.({} as Event);
  }

  error() {
    this.onerror?.({} as Event);
  }

  closeFromServer(code = 1006, reason = "") {
    this.readyState = 3;
    this.onclose?.({ code, reason } as CloseEvent);
  }

  message(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

function createMockSocketFactory(instances: MockConnectionWebSocket[] = []) {
  return (url: string, protocols?: string | string[]) => {
    const socket = new MockConnectionWebSocket(url, protocols);
    instances.push(socket);
    return socket as unknown as WebSocket;
  };
}

function createMockTicketProvider() {
  return async () => ({
    ticket: "mock-ws-ticket",
    ticketType: "websocket_ticket",
    audience: "command_center_ws",
    expiresAt: "2026-04-29T12:00:00.000Z",
  });
}

function createDeferredTicketProvider() {
  let resolveTicket: ((value: {
    ticket: string;
    ticketType: string;
    audience: string;
    expiresAt: string;
  }) => void) | null = null;
  const promise = new Promise<{
    ticket: string;
    ticketType: string;
    audience: string;
    expiresAt: string;
  }>((resolve) => {
    resolveTicket = resolve;
  });

  return {
    ticketProvider: async () => promise,
    resolve() {
      resolveTicket?.({
        ticket: "mock-ws-ticket",
        ticketType: "websocket_ticket",
        audience: "command_center_ws",
        expiresAt: "2026-04-29T12:00:00.000Z",
      });
    },
  };
}

async function flushAsyncSubscriptionStart() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
});

describe("connection stream query runtime model", () => {
  it("builds runtime keys from the effective stream request instead of widget instance identity", () => {
    const request = {
      connectionId: 42,
      query: {
        kind: "ticker",
        symbols: ["BTCUSDT"],
      },
      requestedOutputContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    };

    expect(
      buildConnectionStreamQueryRuntimeKey({
        request,
      }),
    ).toBe(
      buildConnectionStreamQueryRuntimeKey({
        request: { ...request },
      }),
    );
  });

  it("omits private connection ids from public runtime keys", () => {
    const left = buildConnectionStreamQueryRuntimeKey({
      executionSurface: "public-workspace",
      publicExecutionKey: "wss://public.example.test/stream",
      request: {
        connectionId: 42,
        query: {
          kind: "ticker",
          symbols: ["BTCUSDT"],
        },
        requestedOutputContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      },
    });
    const right = buildConnectionStreamQueryRuntimeKey({
      executionSurface: "public-workspace",
      publicExecutionKey: "wss://public.example.test/stream",
      request: {
        connectionId: 99,
        query: {
          kind: "ticker",
          symbols: ["BTCUSDT"],
        },
        requestedOutputContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      },
    });

    expect(left).toBe(right);
  });

  it("drops credentials and route fragments from normalized stream props", () => {
    expect(
      normalizeConnectionStreamQueryProps({
        ...props,
        endpointUrl: "wss://provider.example.test/ws",
        providerRoute: "/raw/provider/path",
        token: "secret-token",
      }),
    ).toEqual({
      connectionRef: props.connectionRef,
      queryModelId: props.queryModelId,
      query: props.query,
      queryEditorState: undefined,
      timeRangeMode: "dashboard",
      fixedStartMs: undefined,
      fixedEndMs: undefined,
      variables: undefined,
      maxRows: undefined,
      mergeKeyFields: ["symbol"],
      retentionMaxRows: undefined,
    });
  });

  it("replaces retained runtime state on snapshot messages", () => {
    const previous = reduceConnectionStreamQueryMessage({
      message: streamMessage("snapshot", [{ symbol: "BTCUSDT", price: 70000 }]),
      props: {
        ...props,
        mergeKeyFields: undefined,
      },
      queryModel: queryModelWithoutMergeDefaults,
      sourceWidgetId: "stream-1",
      nowMs: 1000,
    });
    const next = reduceConnectionStreamQueryMessage({
      message: streamMessage("snapshot", [{ symbol: "ETHUSDT", price: 3500 }]),
      props: {
        ...props,
        mergeKeyFields: undefined,
      },
      queryModel: queryModelWithoutMergeDefaults,
      retainedState: previous,
      sourceWidgetId: "stream-1",
      nowMs: 2000,
    });

    expect(next.status).toBe("ready");
    expect(next.streamStatus).toBe("live");
    expect(next.rows).toEqual([{ symbol: "ETHUSDT", price: 3500 }]);
    expect(readWidgetRuntimeUpdateContext(next)).toMatchObject({
      mode: "snapshot",
      publicationRole: "seed",
    });
  });

  it("merges delta messages into the retained frame and exposes runtime update metadata", () => {
    const retained = reduceConnectionStreamQueryMessage({
      message: streamMessage("snapshot", [
        { symbol: "BTCUSDT", price: 70000 },
        { symbol: "ETHUSDT", price: 3500 },
      ]),
      props,
      queryModel,
      sourceWidgetId: "stream-1",
      nowMs: 1000,
    });
    const merged = reduceConnectionStreamQueryMessage({
      message: streamMessage("delta", [
        { symbol: "BTCUSDT", price: 70100 },
        { symbol: "SOLUSDT", price: 150 },
      ]),
      props,
      queryModel,
      retainedState: retained,
      sourceWidgetId: "stream-1",
      nowMs: 2000,
    });
    const update = readWidgetRuntimeUpdateContext(merged);

    expect(merged.rows).toEqual([
      { symbol: "BTCUSDT", price: 70100 },
      { symbol: "ETHUSDT", price: 3500 },
      { symbol: "SOLUSDT", price: 150 },
    ]);
    expect(update?.mode).toBe("delta");
    expect(update?.publicationRole).toBe("update");
    expect(update?.sourceRunId).toBe(retained.sourceRunId);
    expect(update?.operations).toMatchObject({
      appended: 1,
      replaced: 1,
      returned: 2,
      retained: 3,
    });
    expect((update?.deltaOutput as ConnectionStreamQueryRuntimeState | undefined)?.rows).toEqual([
      { symbol: "BTCUSDT", price: 70100 },
      { symbol: "SOLUSDT", price: 150 },
    ]);
  });

  it("re-publishes later snapshot messages as retained seed resets when merge keys accumulate rows", () => {
    const retained = reduceConnectionStreamQueryMessage({
      message: streamMessage("snapshot", [{ symbol: "BTCUSDT", price: 70000 }]),
      props: {
        ...props,
        mergeKeyFields: undefined,
      },
      queryModel,
      sourceWidgetId: "stream-1",
      nowMs: 1000,
    });
    const next = reduceConnectionStreamQueryMessage({
      message: streamMessage("snapshot", [{ symbol: "ETHUSDT", price: 3500 }]),
      props: {
        ...props,
        mergeKeyFields: undefined,
      },
      queryModel,
      retainedState: retained,
      sourceWidgetId: "stream-1",
      nowMs: 2000,
    });
    const update = readWidgetRuntimeUpdateContext(next);

    expect(next.rows).toEqual([
      { symbol: "BTCUSDT", price: 70000 },
      { symbol: "ETHUSDT", price: 3500 },
    ]);
    expect(update?.mode).toBe("snapshot");
    expect(update?.publicationRole).toBe("seed");
    expect(update?.diagnostics).toMatchObject({
      sourceMessageType: "snapshot",
      mergeKeyFields: ["symbol"],
    });
    expect(update?.deltaOutput).toBeUndefined();
  });

  it("does not reuse retained rows when the stream sourceRunId changes", () => {
    const retained = reduceConnectionStreamQueryMessage({
      message: streamMessage("snapshot", [{ symbol: "BTCUSDT", price: 70000 }]),
      props,
      queryModel,
      sourceWidgetId: "stream-1",
      sourceRunId: "stream-1:btc",
      nowMs: 1000,
    });
    const ack = reduceConnectionStreamQueryMessage({
      message: {
        type: "ack",
        connectionId: 42,
        queryKind: "ticker",
        sequence: 2,
        acceptedAt: "2026-04-28T00:00:02.000Z",
      },
      props,
      queryModel,
      retainedState: retained,
      sourceWidgetId: "stream-1",
      sourceRunId: "stream-1:eth",
      nowMs: 2000,
    });
    const heartbeat = reduceConnectionStreamQueryMessage({
      message: {
        type: "heartbeat",
        sequence: 3,
        emittedAt: "2026-04-28T00:00:03.000Z",
      },
      props,
      queryModel,
      retainedState: retained,
      sourceWidgetId: "stream-1",
      sourceRunId: "stream-1:eth",
      nowMs: 2500,
    });
    const nextDelta = reduceConnectionStreamQueryMessage({
      message: streamMessage("delta", [{ symbol: "ETHUSDT", price: 3500 }]),
      props,
      queryModel,
      retainedState: retained,
      sourceWidgetId: "stream-1",
      sourceRunId: "stream-1:eth",
      nowMs: 3000,
    });

    expect(ack.streamStatus).toBe("live");
    expect(ack.status).toBe("loading");
    expect(ack.rows).toEqual([]);
    expect(ack.sourceRunId).toBe("stream-1:eth");
    expect(heartbeat.status).toBe("loading");
    expect(heartbeat.rows).toEqual([]);
    expect(heartbeat.sourceRunId).toBe("stream-1:eth");
    expect(nextDelta.rows).toEqual([{ symbol: "ETHUSDT", price: 3500 }]);
    expect(readWidgetRuntimeUpdateContext(nextDelta)).toMatchObject({
      publicationRole: "seed",
      sourceRunId: "stream-1:eth",
    });
  });

  it("rejects delta frames with a different schema", () => {
    const retained = reduceConnectionStreamQueryMessage({
      message: streamMessage("snapshot", [{ symbol: "BTCUSDT", price: 70000 }]),
      props,
      queryModel,
      nowMs: 1000,
    });

    expect(() =>
      reduceConnectionStreamQueryMessage({
        message: streamMessage("delta", [{ symbol: "BTCUSDT", quantity: 2 }]),
        props,
        queryModel,
        retainedState: retained,
        nowMs: 2000,
      }),
    ).toThrow("Stream delta schema");
  });

  it("closes the WebSocket session and suppresses messages after cleanup", async () => {
    const sockets: MockConnectionWebSocket[] = [];
    const states: ConnectionStreamQueryRuntimeState[] = [];
    const session = createConnectionStreamQueryWidgetRuntimeSession({
      subscriptionKey: "stream-1",
      request: {
        connectionId: 42,
        query: {
          kind: "ticker",
          symbols: ["BTCUSDT"],
        },
        requestedOutputContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      },
      props,
      queryModel,
      sourceWidgetId: "stream-1",
      onRuntimeStateChange: (state) => states.push(state),
      options: {
        apiBaseUrl: "https://api.example.test",
        webSocketFactory: createMockSocketFactory(sockets),
        ticketProvider: createMockTicketProvider(),
      },
    });

    await flushAsyncSubscriptionStart();

    const socket = sockets[0]!;

    session.close();
    session.close();
    socket.message(
      JSON.stringify({
        type: "heartbeat",
        sequence: 5,
        emittedAt: "2026-04-28T00:00:05.000Z",
      }),
    );

    expect(socket.closeCalls).toEqual([
      { code: 1000, reason: "connection stream query widget unmounted" },
    ]);
    expect(states).toHaveLength(1);
    expect(states[0]?.streamStatus).toBe("connecting");
  });

  it("closes a late socket when auth resolves after the session is already closed", async () => {
    const sockets: MockConnectionWebSocket[] = [];
    const deferredTicket = createDeferredTicketProvider();
    const session = createConnectionStreamQueryWidgetRuntimeSession({
      subscriptionKey: "stream-2",
      request: {
        connectionId: 42,
        query: {
          kind: "ticker",
          symbols: ["BTCUSDT"],
        },
        requestedOutputContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      },
      props,
      queryModel,
      sourceWidgetId: "stream-2",
      onRuntimeStateChange: () => {},
      options: {
        apiBaseUrl: "https://api.example.test",
        webSocketFactory: createMockSocketFactory(sockets),
        ticketProvider: deferredTicket.ticketProvider,
      },
    });

    session.close();
    deferredTicket.resolve();
    await flushAsyncSubscriptionStart();

    expect(sockets).toHaveLength(1);
    expect(sockets[0]?.closeCalls).toEqual([
      { code: 1000, reason: "connection stream query widget unmounted" },
    ]);
  });

  it("does not select old runtime data refs when a new subscription starts for another run", async () => {
    const runtimeDataStore = createRuntimeDataStore("workspace-1");
    const previousRunFrame = reduceConnectionStreamQueryMessage({
      message: streamMessage("snapshot", [{ symbol: "BTCUSDT", price: 70000 }]),
      props,
      queryModel,
      sourceWidgetId: "stream-old",
      sourceRunId: "stream-old:btc",
      nowMs: 1000,
    });
    const previousRunState = storeTabularFrameRuntimeState({
      frame: previousRunFrame,
      ownerId: "stream-old",
      outputId: "dataset",
      store: runtimeDataStore,
      refKey: "stream-old:dataset",
      includeRowsInShell: false,
    }) as ConnectionStreamQueryRuntimeState;
    const sockets: MockConnectionWebSocket[] = [];
    const states: ConnectionStreamQueryRuntimeState[] = [];

    expect(materializeRuntimeTabularFrame(previousRunState, runtimeDataStore)?.rows).toEqual([
      { symbol: "BTCUSDT", price: 70000 },
    ]);

    const session = createConnectionStreamQueryWidgetRuntimeSession({
      subscriptionKey: "stream-new",
      request: {
        connectionId: 42,
        query: {
          kind: "ticker",
          symbols: ["ETHUSDT"],
        },
        requestedOutputContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      },
      props: {
        ...props,
        query: {
          kind: "ticker",
          symbols: ["ETHUSDT"],
        },
      },
      queryModel,
      initialRuntimeState: previousRunState,
      sourceWidgetId: "stream-new",
      onRuntimeStateChange: (state) => states.push(state),
      options: {
        apiBaseUrl: "https://api.example.test",
        webSocketFactory: createMockSocketFactory(sockets),
        runtimeDataStore,
        ticketProvider: createMockTicketProvider(),
      },
    });

    await flushAsyncSubscriptionStart();
    const socket = sockets[0]!;

    expect(states[0]?.streamStatus).toBe("connecting");
    expect(states[0]?.rows).toEqual([]);
    expect(materializeRuntimeTabularFrame(states[0], runtimeDataStore)?.rows).toEqual([]);
    expect(states[0]?.sourceRunId).toMatch(/^stream-new:/);

    socket.open();
    socket.message(JSON.stringify(streamMessage("snapshot", [
      { symbol: "ETHUSDT", price: 3500 },
    ])));

    expect(states.at(-1)?.rows).toEqual([]);
    expect(materializeRuntimeTabularFrame(states.at(-1), runtimeDataStore)?.rows).toEqual([
      { symbol: "ETHUSDT", price: 3500 },
    ]);
    expect(materializeRuntimeTabularFrame(previousRunState, runtimeDataStore)?.rows).toEqual([
      { symbol: "BTCUSDT", price: 70000 },
    ]);

    session.close();
  });

  it("reconnects after a recoverable socket close and refreshes ticket auth", async () => {
    vi.useFakeTimers();
    const sockets: MockConnectionWebSocket[] = [];
    const states: ConnectionStreamQueryRuntimeState[] = [];
    let ticketRequests = 0;
    const session = createConnectionStreamQueryWidgetRuntimeSession({
      subscriptionKey: "stream-reconnect",
      request: {
        connectionId: 42,
        query: {
          kind: "ticker",
          symbols: ["BTCUSDT"],
        },
        requestedOutputContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      },
      props,
      queryModel,
      sourceWidgetId: "stream-reconnect",
      onRuntimeStateChange: (state) => states.push(state),
      options: {
        apiBaseUrl: "https://api.example.test",
        webSocketFactory: createMockSocketFactory(sockets),
        random: () => 0.5,
        ticketProvider: async () => {
          ticketRequests += 1;
          return {
            ticket: `mock-ws-ticket-${ticketRequests}`,
            ticketType: "websocket_ticket",
            audience: "command_center_ws",
            expiresAt: "2026-04-29T12:00:00.000Z",
          };
        },
      },
    });

    await flushAsyncSubscriptionStart();
    const firstSocket = sockets[0]!;
    firstSocket.open();
    firstSocket.message(
      JSON.stringify({
        type: "ack",
        connectionId: 42,
        queryKind: "ticker",
        sequence: 1,
        acceptedAt: "2026-04-28T00:00:00.000Z",
      }),
    );

    firstSocket.closeFromServer(1012, "upstream closed");
    await vi.advanceTimersByTimeAsync(1_000);
    await flushAsyncSubscriptionStart();

    expect(ticketRequests).toBe(2);
    expect(sockets).toHaveLength(2);
    expect(states.at(-1)?.streamStatus).toBe("reconnecting");
    expect(states.at(-1)?.reconnectAttemptCount).toBe(1);
    expect(states.at(-1)?.lastDisconnectReason).toContain("upstream closed");

    session.close();
  });

  it("keeps retained rows visible while reconnecting after heartbeat timeout", async () => {
    vi.useFakeTimers();
    const sockets: MockConnectionWebSocket[] = [];
    const states: ConnectionStreamQueryRuntimeState[] = [];
    const session = createConnectionStreamQueryWidgetRuntimeSession({
      subscriptionKey: "stream-heartbeat-timeout",
      request: {
        connectionId: 42,
        query: {
          kind: "ticker",
          symbols: ["BTCUSDT"],
        },
        requestedOutputContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      },
      props,
      queryModel: {
        ...queryModel,
        stream: {
          ...queryModel.stream!,
          heartbeatMs: 1_000,
        },
      },
      sourceWidgetId: "stream-heartbeat-timeout",
      onRuntimeStateChange: (state) => states.push(state),
      options: {
        apiBaseUrl: "https://api.example.test",
        webSocketFactory: createMockSocketFactory(sockets),
        random: () => 0.5,
        ticketProvider: createMockTicketProvider(),
      },
    });

    await flushAsyncSubscriptionStart();
    const socket = sockets[0]!;
    socket.open();
    socket.message(JSON.stringify({
      type: "ack",
      connectionId: 42,
      queryKind: "ticker",
      sequence: 1,
      acceptedAt: "2026-04-28T00:00:00.000Z",
    }));
    socket.message(JSON.stringify({
      type: "snapshot",
      connectionId: 42,
      queryKind: "ticker",
      sequence: 2,
      emittedAt: "2026-04-28T00:00:01.000Z",
      response: {
        frames: [
          {
            contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
            fields: [
              { name: "symbol", type: "string", values: ["BTCUSDT"] },
              { name: "price", type: "number", values: [70_000] },
            ],
          },
        ],
      },
    }));

    await vi.advanceTimersByTimeAsync(5_000);

    const reconnectingState = states.at(-1)!;
    expect(reconnectingState.streamStatus).toBe("reconnecting");
    expect(reconnectingState.rows).toEqual([{ symbol: "BTCUSDT", price: 70_000 }]);
    expect(reconnectingState.lastDisconnectReason).toBe("Connection stream heartbeat timed out.");

    session.close();
  });

  it("keeps retained ref-backed rows visible while reconnecting before the next socket opens", async () => {
    vi.useFakeTimers();
    const runtimeDataStore = createRuntimeDataStore("workspace-1");
    const sockets: MockConnectionWebSocket[] = [];
    const states: ConnectionStreamQueryRuntimeState[] = [];
    const session = createConnectionStreamQueryWidgetRuntimeSession({
      subscriptionKey: "stream-runtime-ref-reconnect",
      request: {
        connectionId: 42,
        query: {
          kind: "ticker",
          symbols: ["BTCUSDT"],
        },
        requestedOutputContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      },
      props,
      queryModel,
      sourceWidgetId: "stream-runtime-ref-reconnect",
      onRuntimeStateChange: (state) => states.push(state),
      options: {
        apiBaseUrl: "https://api.example.test",
        webSocketFactory: createMockSocketFactory(sockets),
        random: () => 0.5,
        runtimeDataStore,
        ticketProvider: createMockTicketProvider(),
      },
    });

    await flushAsyncSubscriptionStart();
    const firstSocket = sockets[0]!;
    firstSocket.open();
    firstSocket.message(JSON.stringify({
      type: "ack",
      connectionId: 42,
      queryKind: "ticker",
      sequence: 1,
      acceptedAt: "2026-04-28T00:00:00.000Z",
    }));
    firstSocket.message(JSON.stringify({
      type: "snapshot",
      connectionId: 42,
      queryKind: "ticker",
      sequence: 2,
      emittedAt: "2026-04-28T00:00:01.000Z",
      response: {
        frames: [
          {
            contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
            fields: [
              { name: "symbol", type: "string", values: ["BTCUSDT"] },
              { name: "price", type: "number", values: [70_000] },
            ],
          },
        ],
      },
    }));

    firstSocket.closeFromServer(1012, "upstream closed");

    const reconnectingState = states.at(-1)!;
    expect(reconnectingState.streamStatus).toBe("reconnecting");
    expect(reconnectingState.status).toBe("ready");
    expect(reconnectingState.rows).toEqual([]);
    expect(getRuntimeDataRef(reconnectingState)).toBeTruthy();
    expect(materializeRuntimeTabularFrame(reconnectingState, runtimeDataStore)?.rows).toEqual([
      { symbol: "BTCUSDT", price: 70_000 },
    ]);

    await vi.advanceTimersByTimeAsync(1_000);
    await flushAsyncSubscriptionStart();

    const reconnectAttemptState = states.at(-1)!;
    expect(reconnectAttemptState.streamStatus).toBe("reconnecting");
    expect(reconnectAttemptState.status).toBe("ready");
    expect(materializeRuntimeTabularFrame(reconnectAttemptState, runtimeDataStore)?.rows).toEqual([
      { symbol: "BTCUSDT", price: 70_000 },
    ]);

    session.close();
  });

  it("does not reconnect after intentional session close", async () => {
    vi.useFakeTimers();
    const sockets: MockConnectionWebSocket[] = [];
    const session = createConnectionStreamQueryWidgetRuntimeSession({
      subscriptionKey: "stream-intentional-close",
      request: {
        connectionId: 42,
        query: {
          kind: "ticker",
          symbols: ["BTCUSDT"],
        },
        requestedOutputContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      },
      props,
      queryModel,
      sourceWidgetId: "stream-intentional-close",
      onRuntimeStateChange: () => {},
      options: {
        apiBaseUrl: "https://api.example.test",
        webSocketFactory: createMockSocketFactory(sockets),
        random: () => 0.5,
        ticketProvider: createMockTicketProvider(),
      },
    });

    await flushAsyncSubscriptionStart();
    expect(sockets).toHaveLength(1);

    session.close();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(sockets).toHaveLength(1);
  });
});
