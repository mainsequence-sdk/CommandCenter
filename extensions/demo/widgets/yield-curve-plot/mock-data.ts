import type { UTCTimestamp } from "lightweight-charts";

export type YieldCurveMarket = "ust" | "bund" | "sofr";
export type YieldCurveScenario = "desk" | "bull-steepener" | "bear-flattener" | "inverted";
export type YieldCurveComparisonMode = "session" | "historical";

export interface YieldCurveWidgetSnapshotPoint {
  label: string;
  years: number;
  time: UTCTimestamp;
  value: number;
}

export interface YieldCurveWidgetSnapshot {
  id: string;
  label: string;
  emphasis: "primary" | "secondary" | "tertiary";
  points: YieldCurveWidgetSnapshotPoint[];
}

export interface YieldCurveWidgetDeck {
  market: YieldCurveMarket;
  marketLabel: string;
  marketBadge: string;
  scenario: YieldCurveScenario;
  scenarioLabel: string;
  comparisonMode: YieldCurveComparisonMode;
  comparisonLabel: string;
  snapshots: YieldCurveWidgetSnapshot[];
  points: YieldCurveWidgetSnapshotPoint[];
}

interface TenorDefinition {
  label: string;
  years: number;
  time: UTCTimestamp;
}

interface MarketCurveDefinition {
  label: string;
  badge: string;
  current: number[];
  previousClose: number[];
  previousWeek: number[];
  previousMonth: number[];
  previousQuarter: number[];
}

const DAY_SECONDS = 24 * 60 * 60;
const BASE_TIME = 1_735_689_600 as UTCTimestamp;

const TENORS: TenorDefinition[] = [
  { label: "1M", years: 1 / 12, time: BASE_TIME },
  { label: "3M", years: 0.25, time: (BASE_TIME + DAY_SECONDS * 30) as UTCTimestamp },
  { label: "6M", years: 0.5, time: (BASE_TIME + DAY_SECONDS * 60) as UTCTimestamp },
  { label: "1Y", years: 1, time: (BASE_TIME + DAY_SECONDS * 120) as UTCTimestamp },
  { label: "2Y", years: 2, time: (BASE_TIME + DAY_SECONDS * 180) as UTCTimestamp },
  { label: "3Y", years: 3, time: (BASE_TIME + DAY_SECONDS * 240) as UTCTimestamp },
  { label: "5Y", years: 5, time: (BASE_TIME + DAY_SECONDS * 300) as UTCTimestamp },
  { label: "7Y", years: 7, time: (BASE_TIME + DAY_SECONDS * 360) as UTCTimestamp },
  { label: "10Y", years: 10, time: (BASE_TIME + DAY_SECONDS * 420) as UTCTimestamp },
  { label: "20Y", years: 20, time: (BASE_TIME + DAY_SECONDS * 480) as UTCTimestamp },
  { label: "30Y", years: 30, time: (BASE_TIME + DAY_SECONDS * 540) as UTCTimestamp },
];

const MARKET_CURVES: Record<YieldCurveMarket, MarketCurveDefinition> = {
  ust: {
    label: "US Treasury",
    badge: "Rates / Govies",
    current: [4.96, 4.91, 4.82, 4.61, 4.27, 4.16, 4.08, 4.12, 4.19, 4.42, 4.31],
    previousClose: [5.04, 4.98, 4.88, 4.65, 4.32, 4.22, 4.13, 4.17, 4.24, 4.46, 4.35],
    previousWeek: [4.83, 4.78, 4.69, 4.5, 4.18, 4.08, 4.02, 4.07, 4.15, 4.37, 4.26],
    previousMonth: [4.69, 4.64, 4.56, 4.38, 4.09, 3.99, 3.95, 4.01, 4.08, 4.29, 4.2],
    previousQuarter: [4.52, 4.48, 4.41, 4.25, 3.99, 3.91, 3.88, 3.96, 4.03, 4.21, 4.14],
  },
  bund: {
    label: "German Bund",
    badge: "Rates / Europe",
    current: [3.18, 3.06, 2.99, 2.82, 2.56, 2.47, 2.39, 2.41, 2.48, 2.69, 2.72],
    previousClose: [3.26, 3.14, 3.05, 2.86, 2.61, 2.51, 2.43, 2.45, 2.53, 2.73, 2.75],
    previousWeek: [3.08, 2.98, 2.9, 2.75, 2.51, 2.42, 2.35, 2.37, 2.45, 2.65, 2.69],
    previousMonth: [2.92, 2.83, 2.77, 2.65, 2.43, 2.36, 2.31, 2.34, 2.42, 2.61, 2.66],
    previousQuarter: [2.78, 2.71, 2.66, 2.55, 2.36, 2.3, 2.27, 2.31, 2.39, 2.56, 2.62],
  },
  sofr: {
    label: "SOFR Swap",
    badge: "Rates / Swaps",
    current: [5.39, 5.32, 5.21, 5.05, 4.72, 4.59, 4.46, 4.41, 4.35, 4.44, 4.42],
    previousClose: [5.48, 5.4, 5.28, 5.1, 4.77, 4.63, 4.49, 4.45, 4.39, 4.47, 4.45],
    previousWeek: [5.26, 5.18, 5.08, 4.93, 4.64, 4.53, 4.42, 4.38, 4.33, 4.41, 4.39],
    previousMonth: [5.08, 5.01, 4.92, 4.8, 4.54, 4.45, 4.36, 4.33, 4.29, 4.37, 4.35],
    previousQuarter: [4.92, 4.86, 4.79, 4.68, 4.44, 4.36, 4.29, 4.27, 4.24, 4.31, 4.3],
  },
};

export const yieldCurveMarketOptions: Array<{ value: YieldCurveMarket; label: string }> = [
  { value: "ust", label: "US Treasury" },
  { value: "bund", label: "German Bund" },
  { value: "sofr", label: "SOFR Swap" },
];

export const yieldCurveScenarioOptions: Array<{ value: YieldCurveScenario; label: string }> = [
  { value: "desk", label: "Desk curve" },
  { value: "bull-steepener", label: "Bull steepener" },
  { value: "bear-flattener", label: "Bear flattener" },
  { value: "inverted", label: "Inverted" },
];

export const yieldCurveComparisonOptions: Array<{
  value: YieldCurveComparisonMode;
  label: string;
}> = [
  { value: "session", label: "Latest pair" },
  { value: "historical", label: "Historical gradient" },
];

function roundRate(value: number) {
  return Math.round(value * 1000) / 1000;
}

function normalizeCurveWithScenario(curve: number[], scenario: YieldCurveScenario) {
  if (scenario === "desk") {
    return curve.map(roundRate);
  }

  return curve.map((value, index) => {
    const tenor = TENORS[index];
    const normalizedYears = Math.min(tenor.years / 10, 2.4);
    let adjustment = 0;

    if (scenario === "bull-steepener") {
      adjustment = -0.34 + normalizedYears * 0.22;
    } else if (scenario === "bear-flattener") {
      adjustment = 0.31 - normalizedYears * 0.14;
    } else if (scenario === "inverted") {
      adjustment = 0.24 - normalizedYears * 0.28;
    }

    const ripple = Math.sin((index + 1) * 0.7) * 0.015;
    return roundRate(value + adjustment + ripple);
  });
}

function buildSnapshot(
  id: string,
  label: string,
  emphasis: YieldCurveWidgetSnapshot["emphasis"],
  curve: number[],
): YieldCurveWidgetSnapshot {
  return {
    id,
    label,
    emphasis,
    points: TENORS.map((tenor, index) => ({
      label: tenor.label,
      years: tenor.years,
      time: tenor.time,
      value: curve[index] ?? curve[curve.length - 1] ?? 0,
    })),
  };
}

export function normalizeYieldCurveMarket(value: unknown): YieldCurveMarket {
  return value === "bund" || value === "sofr" ? value : "ust";
}

export function normalizeYieldCurveScenario(value: unknown): YieldCurveScenario {
  return value === "bull-steepener" || value === "bear-flattener" || value === "inverted"
    ? value
    : "desk";
}

export function normalizeYieldCurveComparisonMode(value: unknown): YieldCurveComparisonMode {
  return value === "historical" ? "historical" : "session";
}

export function getYieldCurveScenarioLabel(scenario: YieldCurveScenario) {
  return yieldCurveScenarioOptions.find((entry) => entry.value === scenario)?.label ?? "Desk curve";
}

export function getYieldCurveComparisonLabel(comparisonMode: YieldCurveComparisonMode) {
  return (
    yieldCurveComparisonOptions.find((entry) => entry.value === comparisonMode)?.label ??
    "Latest pair"
  );
}

export function buildMockYieldCurveDeck(args: {
  market?: unknown;
  scenario?: unknown;
  comparisonMode?: unknown;
}): YieldCurveWidgetDeck {
  const market = normalizeYieldCurveMarket(args.market);
  const scenario = normalizeYieldCurveScenario(args.scenario);
  const comparisonMode = normalizeYieldCurveComparisonMode(args.comparisonMode);
  const marketDefinition = MARKET_CURVES[market];
  const currentCurve = normalizeCurveWithScenario(marketDefinition.current, scenario);
  const previousCloseCurve = normalizeCurveWithScenario(marketDefinition.previousClose, scenario);
  const previousWeekCurve = normalizeCurveWithScenario(marketDefinition.previousWeek, scenario);
  const previousMonthCurve = normalizeCurveWithScenario(marketDefinition.previousMonth, scenario);
  const previousQuarterCurve = normalizeCurveWithScenario(
    marketDefinition.previousQuarter,
    scenario,
  );

  const snapshots =
    comparisonMode === "historical"
      ? [
          buildSnapshot("current", "Current", "primary", currentCurve),
          buildSnapshot("close", "1D ago", "secondary", previousCloseCurve),
          buildSnapshot("week", "1W ago", "tertiary", previousWeekCurve),
          buildSnapshot("month", "1M ago", "tertiary", previousMonthCurve),
          buildSnapshot("quarter", "3M ago", "tertiary", previousQuarterCurve),
        ]
      : [
          buildSnapshot("current", "Current", "primary", currentCurve),
          buildSnapshot("close", "1D ago", "secondary", previousCloseCurve),
        ];

  return {
    market,
    marketLabel: marketDefinition.label,
    marketBadge: marketDefinition.badge,
    scenario,
    scenarioLabel: getYieldCurveScenarioLabel(scenario),
    comparisonMode,
    comparisonLabel: getYieldCurveComparisonLabel(comparisonMode),
    snapshots,
    points: snapshots[0]?.points ?? [],
  };
}
