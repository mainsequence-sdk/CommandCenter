import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ConnectionInstance,
  ConnectionQueryModel,
  ConnectionRef,
  ConnectionStreamQueryRequest,
  ConnectionStreamServerMessage,
} from "@/connections/types";

import {
  buildConnectionQueryWebSocketUrl,
  buildConnectionStreamSubscribeMessage,
  buildWebSocketEndpointUrl,
  createAuthenticatedConnectionQueryWebSocketSubscription,
  createConnectionQueryWebSocketSubscription,
  normalizeConnectionRef,
  openConnectionQueryWebSocket,
  parseConnectionStreamServerMessage,
  resolveConnectionRefFromInstances,
} from "./api";

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

describe("normalizeConnectionRef", () => {
  it("accepts legacy uid-based saved refs", () => {
    expect(
      normalizeConnectionRef({
        uid: "42",
        typeId: "finance.binance-market-data",
      }),
    ).toEqual({
      id: 42,
      typeId: "finance.binance-market-data",
    });
  });
});

const streamRequest: ConnectionStreamQueryRequest<Record<string, unknown>> = {
  connectionId: 42,
  query: {
    kind: "binance-ticker",
    symbols: ["BTCUSDT"],
  },
  requestedOutputContract: "core.tabular_frame@v1",
  maxRows: 100,
};
const serializedStreamRequest = {
  connectionUid: 42,
  query: streamRequest.query,
  requestedOutputContract: streamRequest.requestedOutputContract,
  maxRows: streamRequest.maxRows,
};

const streamableQueryModel: ConnectionQueryModel = {
  id: "binance-ticker",
  label: "Ticker",
  outputContracts: ["core.tabular_frame@v1"],
  stream: {
    transport: "websocket",
    modes: ["snapshot", "delta"],
    defaultMode: "snapshot",
  },
};

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
    this.onopen?.({ type: "open" } as Event);
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

describe("connection query WebSocket URLs", () => {
  it("builds the configured stream-query route from a connection id", () => {
    expect(
      buildConnectionQueryWebSocketUrl(42, {
        apiBaseUrl: "https://api.example.test",
      }),
    ).toBe("wss://api.example.test/api/v1/command_center/connections/42/stream-query/");
  });

  it("adds the websocket ticket query parameter when provided", () => {
    expect(
      buildConnectionQueryWebSocketUrl(42, {
        apiBaseUrl: "https://api.example.test",
        webSocketTicket: "opaque ticket",
      }),
    ).toBe(
      "wss://api.example.test/api/v1/command_center/connections/42/stream-query/?ws_ticket=opaque+ticket",
    );
  });

  it("converts http API origins to ws", () => {
    expect(
      buildWebSocketEndpointUrl("/api/v1/command_center/connections/42/stream-query/", {
        apiBaseUrl: "http://api.example.test",
      }),
    ).toBe("ws://api.example.test/api/v1/command_center/connections/42/stream-query/");
  });

  it("converts https API origins to wss", () => {
    expect(
      buildWebSocketEndpointUrl("/api/v1/command_center/connections/42/stream-query/", {
        apiBaseUrl: "https://api.example.test",
      }),
    ).toBe("wss://api.example.test/api/v1/command_center/connections/42/stream-query/");
  });

  it("preserves explicit websocket endpoints", () => {
    expect(
      buildWebSocketEndpointUrl("wss://stream.example.test/connections/42/stream-query/", {
        apiBaseUrl: "https://api.example.test",
      }),
    ).toBe("wss://stream.example.test/connections/42/stream-query/");
  });
});

describe("connection query WebSocket contracts", () => {
  it("builds a subscribe payload around the query-shaped request", () => {
    expect(buildConnectionStreamSubscribeMessage(streamRequest)).toEqual({
      type: "subscribe",
      request: serializedStreamRequest,
    });
  });

  it("parses data messages that carry a connection query response", () => {
    const message = parseConnectionStreamServerMessage(
      JSON.stringify({
        type: "snapshot",
        connectionId: 42,
        queryKind: "binance-ticker",
        sequence: 7,
        emittedAt: "2026-04-28T00:00:00.000Z",
        response: {
          frames: [],
          traceId: "trace-1",
        },
      }),
    );

    expect(message).toMatchObject({
      type: "snapshot",
      connectionId: 42,
      queryKind: "binance-ticker",
      sequence: 7,
    });
  });

  it("parses heartbeat messages", () => {
    expect(
      parseConnectionStreamServerMessage(
        JSON.stringify({
          type: "heartbeat",
          sequence: 8,
          emittedAt: "2026-04-28T00:00:01.000Z",
        }),
      ),
    ).toMatchObject({
      type: "heartbeat",
      sequence: 8,
    });
  });

  it("rejects unknown server message types", () => {
    expect(() =>
      parseConnectionStreamServerMessage(
        JSON.stringify({
          type: "provider-native",
          sequence: 1,
        }),
      ),
    ).toThrow("Unsupported connection stream message type");
  });
});

describe("connection query WebSocket runtime", () => {
  it("sends the subscribe payload when the socket opens and parses messages", () => {
    const instances: MockConnectionWebSocket[] = [];
    const messages: ConnectionStreamServerMessage[] = [];
    const subscription = createConnectionQueryWebSocketSubscription(
      streamRequest,
      {
        onMessage: (message) => messages.push(message),
      },
      {
        apiBaseUrl: "https://api.example.test",
        queryModel: streamableQueryModel,
        webSocketFactory: createMockSocketFactory(instances),
      },
    );
    const socket = subscription.socket as unknown as MockConnectionWebSocket;

    expect(socket.url).toBe(
      "wss://api.example.test/api/v1/command_center/connections/42/stream-query/",
    );

    socket.open();

    expect(JSON.parse(socket.sent[0])).toEqual({
      type: "subscribe",
      request: serializedStreamRequest,
    });

    socket.message(
      JSON.stringify({
        type: "heartbeat",
        sequence: 1,
        emittedAt: "2026-04-28T00:00:00.000Z",
      }),
    );

    expect(messages).toEqual([
      {
        type: "heartbeat",
        sequence: 1,
        emittedAt: "2026-04-28T00:00:00.000Z",
      },
    ]);
  });

  it("routes parse failures to the parse error handler", () => {
    const parseErrors: Error[] = [];
    const subscription = createConnectionQueryWebSocketSubscription(
      streamRequest,
      {
        onMessage: vi.fn(),
        onParseError: (error) => parseErrors.push(error),
      },
      {
        apiBaseUrl: "https://api.example.test",
        queryModel: streamableQueryModel,
        webSocketFactory: createMockSocketFactory(),
      },
    );
    const socket = subscription.socket as unknown as MockConnectionWebSocket;

    socket.message("not json");

    expect(parseErrors).toHaveLength(1);
  });

  it("closes once and disables callbacks after cleanup", () => {
    const messages: ConnectionStreamServerMessage[] = [];
    const subscription = createConnectionQueryWebSocketSubscription(
      streamRequest,
      {
        onMessage: (message) => messages.push(message),
      },
      {
        apiBaseUrl: "https://api.example.test",
        queryModel: streamableQueryModel,
        webSocketFactory: createMockSocketFactory(),
      },
    );
    const socket = subscription.socket as unknown as MockConnectionWebSocket;

    subscription.close();
    subscription.close();
    socket.message(
      JSON.stringify({
        type: "heartbeat",
        sequence: 1,
        emittedAt: "2026-04-28T00:00:00.000Z",
      }),
    );

    expect(socket.closeCalls).toEqual([{ code: 1000, reason: "closed" }]);
    expect(messages).toEqual([]);
  });

  it("rejects streaming when the selected query model is not streamable", () => {
    const queryModel: ConnectionQueryModel = {
      id: "binance-ticker",
      label: "Ticker",
      outputContracts: ["core.tabular_frame@v1"],
    };

    expect(() =>
      openConnectionQueryWebSocket(streamRequest, {
        apiBaseUrl: "https://api.example.test",
        queryModel,
        webSocketFactory: createMockSocketFactory(),
      }),
    ).toThrow("does not support WebSocket streaming");
  });

  it("mints a websocket ticket before opening the stream-query socket", async () => {
    const instances: MockConnectionWebSocket[] = [];
    const lifecycleEvents: string[] = [];
    const subscription = await createAuthenticatedConnectionQueryWebSocketSubscription(
      streamRequest,
      {
        onMessage: vi.fn(),
      },
      {
        apiBaseUrl: "https://api.example.test",
        queryModel: streamableQueryModel,
        webSocketFactory: createMockSocketFactory(instances),
        ticketProvider: createMockTicketProvider(),
        onLifecycleEvent: (event) => lifecycleEvents.push(event.type),
      },
    );
    const socket = subscription.socket as unknown as MockConnectionWebSocket;

    expect(socket.url).toBe(
      "wss://api.example.test/api/v1/command_center/connections/42/stream-query/?ws_ticket=mock-ws-ticket",
    );
    expect(lifecycleEvents).toEqual([
      "ticket-request-start",
      "ticket-response",
      "socket-connect-start",
    ]);
  });
});
