import type {
  LiveConnectionState,
  PriceListener,
  StatusListener,
  TerminalSocket,
} from "@/data/terminal-socket-types";

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

const basePrices: Record<string, number> = {
  AAPL: 212.4,
  TSLA: 184.2,
  NVDA: 942.1,
  ETHUSD: 3648.4,
  "ES1!": 5196.2,
};

function walk(value: number) {
  const random = (Math.random() - 0.5) * 2;
  return Math.max(4, value * (1 + random * 0.0016));
}

export class MockTerminalSocket implements TerminalSocket {
  private state: LiveConnectionState = "disconnected";
  private statusListeners = new Set<StatusListener>();
  private priceListeners = new Map<string, Set<PriceListener>>();
  private timers = new Map<string, number>();
  private lastPrices = new Map<string, number>();

  async connect() {
    if (this.state === "connected" || this.state === "connecting") {
      return;
    }

    this.updateState("connecting");
    await sleep(300);
    this.updateState("connected");
  }

  disconnect() {
    this.timers.forEach((timer) => window.clearInterval(timer));
    this.timers.clear();
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
      this.ensureStream(symbol);
    });

    return () => {
      const listeners = this.priceListeners.get(symbol);
      listeners?.delete(listener);

      if (listeners && listeners.size === 0) {
        this.priceListeners.delete(symbol);

        const timer = this.timers.get(symbol);
        if (timer) {
          window.clearInterval(timer);
          this.timers.delete(symbol);
        }
      }
    };
  }

  private ensureStream(symbol: string) {
    if (this.timers.has(symbol)) {
      return;
    }

    const start = this.lastPrices.get(symbol) ?? basePrices[symbol] ?? 100;
    this.lastPrices.set(symbol, start);

    const timer = window.setInterval(() => {
      if (this.state !== "connected") {
        return;
      }

      const next = Number(walk(this.lastPrices.get(symbol) ?? start).toFixed(2));
      this.lastPrices.set(symbol, next);

      this.priceListeners.get(symbol)?.forEach((priceListener) => {
        priceListener({
          symbol,
          price: next,
          time: Math.floor(Date.now() / 1000),
        });
      });
    }, 1000);

    this.timers.set(symbol, timer);
  }

  private updateState(state: LiveConnectionState) {
    this.state = state;
    this.statusListeners.forEach((listener) => listener(state));
  }
}
