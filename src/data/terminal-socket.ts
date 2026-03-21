import { env } from "@/config/env";
import { isWidgetPreviewMode } from "@/features/widgets/widget-explorer";
import { LiveTerminalSocket } from "@/data/live/terminal-socket";
import { MockTerminalSocket } from "@/data/mock/terminal-socket";
import type { TerminalSocket } from "@/data/terminal-socket-types";

const mockTerminalSocket = new MockTerminalSocket();
const liveTerminalSocket = new LiveTerminalSocket(env.wsUrl);

function getPrimaryTerminalSocket() {
  return env.useMockData ? mockTerminalSocket : liveTerminalSocket;
}

export const terminalSocket: TerminalSocket = {
  connect: () => getPrimaryTerminalSocket().connect(),
  disconnect: () => getPrimaryTerminalSocket().disconnect(),
  onStatusChange: (listener) => getPrimaryTerminalSocket().onStatusChange(listener),
  subscribePrice: (symbol, listener) =>
    (env.useMockData || isWidgetPreviewMode() ? mockTerminalSocket : liveTerminalSocket).subscribePrice(
      symbol,
      listener,
    ),
};

export type {
  LiveConnectionState,
  PriceTick,
  TerminalSocket,
} from "@/data/terminal-socket-types";
