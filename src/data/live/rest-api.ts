import { useAuthStore } from "@/auth/auth-store";
import { env } from "@/config/env";
import type {
  ActivityItem,
  KpiCard,
  NewsItem,
  OrderBook,
  PositionRow,
  PricePoint,
} from "@/data/types";

function buildUrl(path: string, search?: Record<string, string | number | undefined>) {
  const baseUrl = env.apiBaseUrl.endsWith("/") ? env.apiBaseUrl : `${env.apiBaseUrl}/`;
  const url = new URL(path.replace(/^\/+/, ""), baseUrl);

  Object.entries(search ?? {}).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

async function fetchJson<T>(path: string, search?: Record<string, string | number | undefined>) {
  const requestUrl = buildUrl(path, search);

  async function sendRequest() {
    const session = useAuthStore.getState().session;
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (session?.token) {
      headers.Authorization = `${session.tokenType ?? "Bearer"} ${session.token}`;
    }

    return fetch(requestUrl, { headers });
  }

  let response = await sendRequest();

  if (response.status === 401) {
    const refreshed = await useAuthStore.getState().refreshSession();

    if (refreshed) {
      response = await sendRequest();
    }
  }

  if (!response.ok) {
    throw new Error(`Live data request failed with ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export function fetchKpiCards(symbol = "AAPL") {
  return fetchJson<KpiCard[]>("market/kpis", { symbol });
}

export function fetchPositions() {
  return fetchJson<PositionRow[]>("portfolio/positions");
}

export function fetchNews(limit = 6) {
  return fetchJson<NewsItem[]>("news", { limit });
}

export function fetchActivity(limit = 7) {
  return fetchJson<ActivityItem[]>("activity", { limit });
}

export function fetchPriceHistory(symbol: string) {
  return fetchJson<PricePoint[]>("market/history", { symbol });
}

export function fetchOrderBook(symbol: string) {
  return fetchJson<OrderBook>("market/order-book", { symbol });
}
