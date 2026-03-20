import { env } from "@/config/env";
import { LiveTerminalSocket } from "@/data/live/terminal-socket";
import { MockTerminalSocket } from "@/data/mock/terminal-socket";

export const terminalSocket = env.useMockData
  ? new MockTerminalSocket()
  : new LiveTerminalSocket(env.wsUrl);

export type {
  LiveConnectionState,
  PriceTick,
  TerminalSocket,
} from "@/data/terminal-socket-types";
