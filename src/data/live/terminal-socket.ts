import type {
  LiveConnectionState,
  PriceListener,
  StatusListener,
  TerminalSocket,
} from "@/data/terminal-socket-types";

function toPriceTick(message: unknown) {
  if (!message || typeof message !== "object") {
    return null;
  }

  const record = message as Record<string, unknown>;
  const payload =
    record.payload && typeof record.payload === "object"
      ? (record.payload as Record<string, unknown>)
      : record;
  const symbol = typeof payload.symbol === "string" ? payload.symbol : null;
  const price = typeof payload.price === "number" ? payload.price : null;
  const time = typeof payload.time === "number" ? payload.time : Math.floor(Date.now() / 1000);

  if (!symbol || price === null) {
    return null;
  }

  return { symbol, price, time };
}

export class LiveTerminalSocket implements TerminalSocket {
  private state: LiveConnectionState = "disconnected";
  private statusListeners = new Set<StatusListener>();
  private priceListeners = new Map<string, Set<PriceListener>>();
  private socket: WebSocket | null = null;
  private connectPromise: Promise<void> | null = null;

  constructor(private readonly wsUrl: string) {}

  async connect() {
    if (this.state === "connected" || this.state === "connecting") {
      await this.connectPromise;
      return;
    }

    this.updateState("connecting");

    this.connectPromise = new Promise<void>((resolve) => {
      try {
        const socket = new WebSocket(this.wsUrl);
        let settled = false;

        socket.addEventListener("open", () => {
          this.socket = socket;
          this.updateState("connected");
          this.syncSubscriptions();

          if (!settled) {
            settled = true;
            resolve();
          }
        });

        socket.addEventListener("message", (event) => {
          try {
            const parsed = JSON.parse(String(event.data));
            const tick = toPriceTick(parsed);

            if (!tick) {
              return;
            }

            this.priceListeners.get(tick.symbol)?.forEach((listener) => {
              listener(tick);
            });
          } catch {
            // Ignore malformed messages from the stream boundary.
          }
        });

        socket.addEventListener("error", () => {
          this.updateState("disconnected");

          if (!settled) {
            settled = true;
            resolve();
          }
        });

        socket.addEventListener("close", () => {
          this.socket = null;
          this.connectPromise = null;
          this.updateState("disconnected");

          if (!settled) {
            settled = true;
            resolve();
          }
        });
      } catch {
        this.updateState("disconnected");
        this.connectPromise = null;
        resolve();
      }
    });

    await this.connectPromise;
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
    this.connectPromise = null;
    this.updateState("disconnected");
  }

  onStatusChange(listener: StatusListener) {
    this.statusListeners.add(listener);
    listener(this.state);

    return () => {
      this.statusListeners.delete(listener);
    };
  }

  subscribePrice(symbol: string, listener: PriceListener) {
    if (!this.priceListeners.has(symbol)) {
      this.priceListeners.set(symbol, new Set());
    }

    this.priceListeners.get(symbol)?.add(listener);

    void this.connect().then(() => {
      this.send({
        type: "subscribe",
        channel: "price",
        symbol,
      });
    });

    return () => {
      const listeners = this.priceListeners.get(symbol);
      listeners?.delete(listener);

      if (listeners && listeners.size === 0) {
        this.priceListeners.delete(symbol);
        this.send({
          type: "unsubscribe",
          channel: "price",
          symbol,
        });
      }
    };
  }

  private syncSubscriptions() {
    this.priceListeners.forEach((listeners, symbol) => {
      if (listeners.size === 0) {
        return;
      }

      this.send({
        type: "subscribe",
        channel: "price",
        symbol,
      });
    });
  }

  private send(payload: Record<string, unknown>) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(payload));
  }

  private updateState(state: LiveConnectionState) {
    this.state = state;
    this.statusListeners.forEach((listener) => listener(state));
  }
}
