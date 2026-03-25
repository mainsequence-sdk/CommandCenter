import { env } from "@/config/env";
import { isWidgetPreviewMode } from "@/features/widgets/widget-explorer";
import { LiveTerminalSocket } from "@/data/live/terminal-socket";
import { MockTerminalSocket } from "@/data/mock/terminal-socket";
import type { TerminalSocket } from "@/data/terminal-socket-types";

const mockTerminalSocket = new MockTerminalSocket();
const liveTerminalSocket = new LiveTerminalSocket(env.wsUrl);
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

function getPrimaryTerminalSocket() {
  if (!env.includeWebsockets) {
    return disabledTerminalSocket;
  }

  return env.useMockData ? mockTerminalSocket : liveTerminalSocket;
}

export const terminalSocket: TerminalSocket = {
  connect: () => getPrimaryTerminalSocket().connect(),
  disconnect: () => getPrimaryTerminalSocket().disconnect(),
  onStatusChange: (listener) => getPrimaryTerminalSocket().onStatusChange(listener),
  subscribePrice: (symbol, listener) =>
    (!env.includeWebsockets
      ? disabledTerminalSocket
      : env.useMockData || isWidgetPreviewMode()
        ? mockTerminalSocket
        : liveTerminalSocket
    ).subscribePrice(symbol, listener),
};

export type {
  LiveConnectionState,
  PriceTick,
  TerminalSocket,
} from "@/data/terminal-socket-types";
