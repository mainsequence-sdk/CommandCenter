import { describe, expect, it } from "vitest";

import type { ConnectionQueryModel, ConnectionStreamServerMessage } from "@/connections/types";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";
import { readWidgetRuntimeUpdateContext } from "@/widgets/shared/runtime-update";

import {
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
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("connection stream query runtime model", () => {
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
    expect(readWidgetRuntimeUpdateContext(next)?.mode).toBe("snapshot");
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

  it("accumulates snapshot messages into retained rows when the stream model publishes default merge keys", () => {
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
    expect(update?.mode).toBe("delta");
    expect(update?.diagnostics).toMatchObject({
      sourceMessageType: "snapshot",
      mergeKeyFields: ["symbol"],
    });
    expect((update?.deltaOutput as ConnectionStreamQueryRuntimeState | undefined)?.rows).toEqual([
      { symbol: "ETHUSDT", price: 3500 },
    ]);
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
});
