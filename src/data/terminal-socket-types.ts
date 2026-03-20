import type { PriceTimestamp } from "@/data/live/types";

export type LiveConnectionState = "connecting" | "connected" | "disconnected";

export interface PriceTick {
  symbol: string;
  price: number;
  time: PriceTimestamp;
}

export type PriceListener = (tick: PriceTick) => void;
export type StatusListener = (state: LiveConnectionState) => void;

export interface TerminalSocket {
  connect: () => Promise<void>;
  disconnect: () => void;
  onStatusChange: (listener: StatusListener) => () => void;
  subscribePrice: (symbol: string, listener: PriceListener) => () => void;
}
