import type { PriceTimestamp } from "@/data/live/types";

export interface KpiCard {
  label: string;
  value: number;
  changePct: number;
  hint: string;
  format: "currency" | "number" | "percent";
}

export interface PositionRow {
  symbol: string;
  side: "Long" | "Short";
  quantity: number;
  avgPrice: number;
  lastPrice: number;
  pnl: number;
  exposure: number;
  account: string;
  strategy: string;
}

export interface NewsItem {
  id: string;
  source: string;
  title: string;
  time: string;
  sentiment: "positive" | "neutral" | "negative";
  tags: string[];
}

export interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
  level: "success" | "warning" | "info";
}

export interface PricePoint {
  time: PriceTimestamp;
  value: number;
}

export interface OrderLevel {
  price: number;
  size: number;
  total: number;
}

export interface OrderBook {
  bids: OrderLevel[];
  asks: OrderLevel[];
}
