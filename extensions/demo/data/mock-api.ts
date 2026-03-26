import type { PriceTimestamp } from "@/data/live/types";
import type {
  ActivityItem,
  KpiCard,
  NewsItem,
  OrderBook,
  OrderLevel,
  PositionRow,
  PricePoint,
} from "@/data/types";

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

function getBasePrice(symbol: string) {
  return basePrices[symbol] ?? 120;
}

function walk(value: number, drift = 0.0015) {
  const random = (Math.random() - 0.5) * 2;
  return Math.max(4, value * (1 + random * drift));
}

export async function fetchKpiCards(symbol = "AAPL"): Promise<KpiCard[]> {
  await sleep(220);

  const anchor = getBasePrice(symbol);

  return [
    {
      label: "Gross Exposure",
      value: anchor * 28_000,
      changePct: 2.4,
      hint: "Across active books",
      format: "currency",
    },
    {
      label: "Net PnL",
      value: anchor * 910,
      changePct: 1.1,
      hint: "Session to date",
      format: "currency",
    },
    {
      label: "Fill Rate",
      value: 98.2,
      changePct: 0.4,
      hint: "Across routed orders",
      format: "percent",
    },
    {
      label: "Alerts",
      value: 7,
      changePct: -12.5,
      hint: "Actionable checks",
      format: "number",
    },
  ];
}

export async function fetchPositions(): Promise<PositionRow[]> {
  await sleep(280);

  return [
    {
      symbol: "AAPL",
      side: "Long",
      quantity: 12_500,
      avgPrice: 205.43,
      lastPrice: 212.41,
      pnl: 87_250,
      exposure: 2_655_125,
      account: "MAIN",
      strategy: "Core Growth",
    },
    {
      symbol: "NVDA",
      side: "Long",
      quantity: 2_300,
      avgPrice: 910.0,
      lastPrice: 942.1,
      pnl: 73_830,
      exposure: 2_166_830,
      account: "MAIN",
      strategy: "AI Momentum",
    },
    {
      symbol: "TSLA",
      side: "Short",
      quantity: 4_000,
      avgPrice: 190.2,
      lastPrice: 184.2,
      pnl: 24_000,
      exposure: 736_800,
      account: "HEDGE",
      strategy: "Vol Hedge",
    },
    {
      symbol: "MSFT",
      side: "Long",
      quantity: 5_100,
      avgPrice: 421.2,
      lastPrice: 417.9,
      pnl: -16_830,
      exposure: 2_131_290,
      account: "MAIN",
      strategy: "Mega Cap Basket",
    },
    {
      symbol: "AMD",
      side: "Long",
      quantity: 8_000,
      avgPrice: 168.5,
      lastPrice: 173.8,
      pnl: 42_400,
      exposure: 1_390_400,
      account: "MOM",
      strategy: "Semis Swing",
    },
    {
      symbol: "NFLX",
      side: "Short",
      quantity: 1_600,
      avgPrice: 628.0,
      lastPrice: 634.2,
      pnl: -9_920,
      exposure: 1_014_720,
      account: "HEDGE",
      strategy: "Pairs Overlay",
    },
  ];
}

export async function fetchNews(limit = 6): Promise<NewsItem[]> {
  await sleep(180);

  const items: NewsItem[] = [
    {
      id: "news-1",
      source: "Desk Wire",
      title: "Nasdaq breadth improves as mega-cap tech leads opening rotation.",
      time: "2m ago",
      sentiment: "positive",
      tags: ["equities", "breadth"],
    },
    {
      id: "news-2",
      source: "Rates Monitor",
      title: "Treasury curve bull-steepens after softer auction tails than expected.",
      time: "9m ago",
      sentiment: "positive",
      tags: ["rates", "macro"],
    },
    {
      id: "news-3",
      source: "Energy Flash",
      title: "WTI trims gains as intraday inventories chatter cools earlier squeeze.",
      time: "18m ago",
      sentiment: "neutral",
      tags: ["commodities"],
    },
    {
      id: "news-4",
      source: "Semis Brief",
      title: "Sell-side checks suggest steady AI server demand into next quarter.",
      time: "29m ago",
      sentiment: "positive",
      tags: ["semis", "ai"],
    },
    {
      id: "news-5",
      source: "Vol Surfaces",
      title: "Index skew richens modestly into tomorrow's event window.",
      time: "42m ago",
      sentiment: "neutral",
      tags: ["options", "vol"],
    },
    {
      id: "news-6",
      source: "FX Tape",
      title: "Dollar pares gains after muted import-price reaction.",
      time: "55m ago",
      sentiment: "negative",
      tags: ["fx", "macro"],
    },
  ];

  return items.slice(0, limit);
}

export async function fetchActivity(limit = 7): Promise<ActivityItem[]> {
  await sleep(160);

  const items: ActivityItem[] = [
    {
      id: "activity-1",
      actor: "Risk bot",
      action: "raised",
      target: "intraday VaR alert",
      time: "just now",
      level: "warning",
    },
    {
      id: "activity-2",
      actor: "Desk lead",
      action: "approved",
      target: "TSLA hedge rebalance",
      time: "6m ago",
      level: "success",
    },
    {
      id: "activity-3",
      actor: "OMS",
      action: "posted",
      target: "118 fills to blotter",
      time: "11m ago",
      level: "info",
    },
    {
      id: "activity-4",
      actor: "Latency monitor",
      action: "recovered",
      target: "east market-data edge",
      time: "18m ago",
      level: "success",
    },
    {
      id: "activity-5",
      actor: "Ops",
      action: "rotated",
      target: "news-provider token",
      time: "24m ago",
      level: "info",
    },
    {
      id: "activity-6",
      actor: "Compliance",
      action: "flagged",
      target: "after-hours notional threshold",
      time: "31m ago",
      level: "warning",
    },
    {
      id: "activity-7",
      actor: "Algo runner",
      action: "completed",
      target: "opening basket",
      time: "38m ago",
      level: "success",
    },
  ];

  return items.slice(0, limit);
}

export async function fetchPriceHistory(symbol: string): Promise<PricePoint[]> {
  await sleep(240);

  let price = getBasePrice(symbol);
  const start = Math.floor(Date.now() / 1000) - 60 * 45;

  return Array.from({ length: 45 }).map((_, index) => {
    price = walk(price, 0.0028);
    return {
      time: start + index * 60,
      value: Number(price.toFixed(2)),
    };
  });
}

export async function fetchOrderBook(symbol: string): Promise<OrderBook> {
  await sleep(210);

  const mid = getBasePrice(symbol);
  let bidTotal = 0;
  let askTotal = 0;

  const bids = Array.from({ length: 8 }).map((_, index) => {
    const size = 300 + Math.round(Math.random() * 1800);
    bidTotal += size;

    return {
      price: Number((mid - 0.1 * (index + 1)).toFixed(2)),
      size,
      total: bidTotal,
    };
  });

  const asks = Array.from({ length: 8 }).map((_, index) => {
    const size = 250 + Math.round(Math.random() * 1700);
    askTotal += size;

    return {
      price: Number((mid + 0.1 * (index + 1)).toFixed(2)),
      size,
      total: askTotal,
    };
  });

  return { bids, asks };
}
