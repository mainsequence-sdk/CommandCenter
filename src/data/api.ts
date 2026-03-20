import { env } from "@/config/env";
import * as liveApi from "@/data/live/rest-api";
import * as mockApi from "@/data/demo-api";

type DataApi = typeof mockApi;

const dataApi: DataApi = env.useMockData ? mockApi : liveApi;

export const fetchKpiCards: DataApi["fetchKpiCards"] = (...args) => dataApi.fetchKpiCards(...args);
export const fetchPositions: DataApi["fetchPositions"] = (...args) => dataApi.fetchPositions(...args);
export const fetchNews: DataApi["fetchNews"] = (...args) => dataApi.fetchNews(...args);
export const fetchActivity: DataApi["fetchActivity"] = (...args) => dataApi.fetchActivity(...args);
export const fetchPriceHistory: DataApi["fetchPriceHistory"] = (...args) =>
  dataApi.fetchPriceHistory(...args);
export const fetchOrderBook: DataApi["fetchOrderBook"] = (...args) =>
  dataApi.fetchOrderBook(...args);

export type {
  ActivityItem,
  KpiCard,
  NewsItem,
  OrderBook,
  OrderLevel,
  PositionRow,
  PricePoint,
} from "@/data/types";
