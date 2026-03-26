import { env } from "@/config/env";
import { isWidgetPreviewMode } from "@/features/widgets/widget-explorer";
import { LiveTerminalSocket } from "@/data/live/terminal-socket";
import { MockTerminalSocket } from "@/data/mock/terminal-socket";
import type { TerminalSocket } from "@/data/terminal-socket-types";

let mockTerminalSocket: MockTerminalSocket | null = null;
let liveTerminalSocket: LiveTerminalSocket | null = null;
const disabledTerminalSocket: TerminalSocket = {
  async connect() {},
  disconnect() {},
  onStatusChange(listener) {
    listener("disconnected");
    return () => undefined;
  },
  subscribePrice() {
    return () => undefined;
  },
};

function getMockTerminalSocket() {
  if (!mockTerminalSocket) {
    mockTerminalSocket = new MockTerminalSocket();
  }

  return mockTerminalSocket;
}

function getLiveTerminalSocket() {
  if (!liveTerminalSocket) {
    liveTerminalSocket = new LiveTerminalSocket(env.wsUrl);
  }

  return liveTerminalSocket;
}

function getPrimaryTerminalSocket() {
  if (!env.includeWebsockets) {
    return disabledTerminalSocket;
  }

  return env.useMockData ? getMockTerminalSocket() : getLiveTerminalSocket();
}

export const terminalSocket: TerminalSocket = {
  connect: () => getPrimaryTerminalSocket().connect(),
  disconnect: () => getPrimaryTerminalSocket().disconnect(),
  onStatusChange: (listener) => getPrimaryTerminalSocket().onStatusChange(listener),
  subscribePrice: (symbol, listener) =>
    (!env.includeWebsockets
      ? disabledTerminalSocket
      : env.useMockData || isWidgetPreviewMode()
        ? getMockTerminalSocket()
        : getLiveTerminalSocket()
    ).subscribePrice(symbol, listener),
};

export type {
  LiveConnectionState,
  PriceTick,
  TerminalSocket,
} from "@/data/terminal-socket-types";
