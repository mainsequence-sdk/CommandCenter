import { env } from "@/config/env";
import * as liveApi from "@/data/live/rest-api";
import { isWidgetPreviewMode } from "@/features/widgets/widget-explorer";
import * as mockApi from "../../extensions/demo/data/mock-api";

type DataApi = typeof mockApi;

function getDataApi(): DataApi {
  return env.useMockData || isWidgetPreviewMode() ? mockApi : liveApi;
}

export const fetchKpiCards: DataApi["fetchKpiCards"] = (...args) => getDataApi().fetchKpiCards(...args);
export const fetchPositions: DataApi["fetchPositions"] = (...args) => getDataApi().fetchPositions(...args);
export const fetchNews: DataApi["fetchNews"] = (...args) => getDataApi().fetchNews(...args);
export const fetchActivity: DataApi["fetchActivity"] = (...args) => getDataApi().fetchActivity(...args);
export const fetchPriceHistory: DataApi["fetchPriceHistory"] = (...args) =>
  getDataApi().fetchPriceHistory(...args);
export const fetchOrderBook: DataApi["fetchOrderBook"] = (...args) =>
  getDataApi().fetchOrderBook(...args);

export type {
  ActivityItem,
  KpiCard,
  NewsItem,
  OrderBook,
  OrderLevel,
  PositionRow,
  PricePoint,
} from "@/data/types";
