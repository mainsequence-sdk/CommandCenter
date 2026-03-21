export type DataNodeTableVisualizerDatasetId = "positions" | "risk-monitor" | "execution-quality";
export type DataNodeTableVisualizerColumnFormat =
  | "auto"
  | "text"
  | "number"
  | "currency"
  | "percent"
  | "bps";
export type DataNodeTableVisualizerDensity = "compact" | "comfortable";
export type DataNodeTableVisualizerBarMode = "none" | "fill";
export type DataNodeTableVisualizerAlign = "auto" | "left" | "center" | "right";
export type DataNodeTableVisualizerPinned = "none" | "left" | "right";
export type DataNodeTableVisualizerOperator = "gt" | "gte" | "lt" | "lte" | "eq";
export type DataNodeTableVisualizerTone = "neutral" | "primary" | "success" | "warning" | "danger";

export type DataNodeTableVisualizerCellValue = number | string | boolean | null;
export type DataNodeTableVisualizerRow = Record<string, DataNodeTableVisualizerCellValue>;
export type DataNodeTableVisualizerFrameRow = DataNodeTableVisualizerCellValue[];

export interface DataNodeTableVisualizerColumnSchema {
  key: string;
  label: string;
  description?: string;
  format: Exclude<DataNodeTableVisualizerColumnFormat, "auto">;
  minWidth?: number;
  flex?: number;
  pinned?: Exclude<DataNodeTableVisualizerPinned, "none">;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  categorical?: boolean;
  heatmapEligible?: boolean;
  compact?: boolean;
}

export interface DataNodeTableVisualizerDataset {
  id: DataNodeTableVisualizerDatasetId;
  label: string;
  description: string;
  rows: DataNodeTableVisualizerRow[];
  columns: DataNodeTableVisualizerColumnSchema[];
}

export interface DataNodeTableVisualizerColumnOverride {
  visible?: boolean;
  label?: string;
  format?: DataNodeTableVisualizerColumnFormat;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  heatmap?: boolean;
  compact?: boolean;
  barMode?: DataNodeTableVisualizerBarMode;
  align?: DataNodeTableVisualizerAlign;
  pinned?: DataNodeTableVisualizerPinned;
}

export interface DataNodeTableVisualizerValueLabel {
  columnKey: string;
  value: string;
  label?: string;
  tone?: DataNodeTableVisualizerTone;
  textColor?: string;
  backgroundColor?: string;
}

export interface DataNodeTableVisualizerConditionalRule {
  id: string;
  columnKey: string;
  operator: DataNodeTableVisualizerOperator;
  value: number;
  tone?: DataNodeTableVisualizerTone;
  textColor?: string;
  backgroundColor?: string;
}

export interface DataNodeTableVisualizerProps extends Record<string, unknown> {
  datasetId?: DataNodeTableVisualizerDatasetId;
  columns?: string[];
  rows?: DataNodeTableVisualizerFrameRow[];
  schema?: DataNodeTableVisualizerColumnSchema[];
  density?: DataNodeTableVisualizerDensity;
  showToolbar?: boolean;
  showSearch?: boolean;
  zebraRows?: boolean;
  pagination?: boolean;
  pageSize?: number;
  columnOverrides?: Record<string, DataNodeTableVisualizerColumnOverride>;
  valueLabels?: DataNodeTableVisualizerValueLabel[];
  conditionalRules?: DataNodeTableVisualizerConditionalRule[];
}

export interface ResolvedDataNodeTableVisualizerColumnConfig extends DataNodeTableVisualizerColumnSchema {
  visible: boolean;
  align: Exclude<DataNodeTableVisualizerAlign, "auto">;
  heatmap: boolean;
  barMode: DataNodeTableVisualizerBarMode;
  compact: boolean;
  pinned?: Exclude<DataNodeTableVisualizerPinned, "none">;
}

export interface ResolvedDataNodeTableVisualizerProps {
  datasetId: DataNodeTableVisualizerDatasetId;
  columns: string[];
  rows: DataNodeTableVisualizerFrameRow[];
  schema: DataNodeTableVisualizerColumnSchema[];
  density: DataNodeTableVisualizerDensity;
  showToolbar: boolean;
  showSearch: boolean;
  zebraRows: boolean;
  pagination: boolean;
  pageSize: number;
  columnOverrides: Record<string, DataNodeTableVisualizerColumnOverride>;
  valueLabels: DataNodeTableVisualizerValueLabel[];
  conditionalRules: DataNodeTableVisualizerConditionalRule[];
}

export interface DataNodeTableVisualizerSchemaValidationIssue {
  code: "empty_schema" | "missing_columns" | "non_numeric_columns";
  columnKeys?: string[];
}

export interface DataNodeTableVisualizerSchemaValidationResult {
  isValid: boolean;
  issues: DataNodeTableVisualizerSchemaValidationIssue[];
}

const defaultPageSize = 10;
const hexColorPattern = /^#(?:[0-9a-fA-F]{6})$/;

const positionsDataset: DataNodeTableVisualizerDataset = {
  id: "positions",
  label: "Strategy Book",
  description: "Multi-account positions with PnL, exposure, conviction, and side/status fields.",
  columns: [
    { key: "symbol", label: "Symbol", format: "text", minWidth: 110, pinned: "left", categorical: true },
    { key: "status", label: "Status", format: "text", minWidth: 120, categorical: true },
    { key: "side", label: "Side", format: "text", minWidth: 100, categorical: true },
    { key: "quantity", label: "Qty", format: "number", minWidth: 110 },
    { key: "avgPrice", label: "Avg", format: "currency", minWidth: 120, decimals: 2 },
    { key: "lastPrice", label: "Last", format: "currency", minWidth: 120, decimals: 2 },
    { key: "dayChangePct", label: "Day %", format: "percent", minWidth: 110, decimals: 2, heatmapEligible: true },
    { key: "pnl", label: "PnL", format: "currency", minWidth: 140, heatmapEligible: true },
    { key: "exposure", label: "Exposure", format: "currency", minWidth: 150, compact: true, heatmapEligible: true },
    { key: "conviction", label: "Conviction", format: "number", minWidth: 120, decimals: 1, heatmapEligible: true },
    { key: "account", label: "Account", format: "text", minWidth: 120, categorical: true },
    { key: "strategy", label: "Strategy", format: "text", minWidth: 160, flex: 1.2, categorical: true },
  ],
  rows: [
    { symbol: "NVDA", status: "Active", side: "Long", quantity: 1800, avgPrice: 812.42, lastPrice: 846.13, dayChangePct: 2.88, pnl: 60678, exposure: 1523034, conviction: 9.4, account: "L/S Core", strategy: "AI Momentum" },
    { symbol: "TSLA", status: "Trim", side: "Short", quantity: 950, avgPrice: 201.12, lastPrice: 188.74, dayChangePct: -1.42, pnl: 11761, exposure: -179303, conviction: 6.2, account: "Event", strategy: "Flow Fade" },
    { symbol: "META", status: "Active", side: "Long", quantity: 720, avgPrice: 476.55, lastPrice: 489.18, dayChangePct: 1.16, pnl: 9094, exposure: 352210, conviction: 7.9, account: "Growth", strategy: "Platform Quality" },
    { symbol: "AAPL", status: "Watch", side: "Long", quantity: 2400, avgPrice: 186.31, lastPrice: 183.44, dayChangePct: -0.64, pnl: -6888, exposure: 440256, conviction: 5.3, account: "Core", strategy: "Mega Cap Carry" },
    { symbol: "MSFT", status: "Active", side: "Long", quantity: 960, avgPrice: 411.92, lastPrice: 420.74, dayChangePct: 0.92, pnl: 8467, exposure: 403910, conviction: 8.1, account: "Core", strategy: "Cloud Compounders" },
    { symbol: "AMD", status: "Watch", side: "Long", quantity: 1400, avgPrice: 182.64, lastPrice: 176.08, dayChangePct: -2.24, pnl: -9184, exposure: 246512, conviction: 4.8, account: "Semis", strategy: "Relative Value" },
    { symbol: "NFLX", status: "Active", side: "Short", quantity: 420, avgPrice: 625.14, lastPrice: 611.55, dayChangePct: -0.73, pnl: 5708, exposure: -256851, conviction: 6.8, account: "Event", strategy: "Earnings Mean Reversion" },
    { symbol: "PLTR", status: "Active", side: "Long", quantity: 5200, avgPrice: 24.12, lastPrice: 27.81, dayChangePct: 3.74, pnl: 19188, exposure: 144612, conviction: 8.7, account: "Tactical", strategy: "Retail Strength" },
    { symbol: "SHOP", status: "Reduce", side: "Long", quantity: 680, avgPrice: 79.44, lastPrice: 75.62, dayChangePct: -1.31, pnl: -2598, exposure: 51422, conviction: 3.6, account: "Growth", strategy: "Margin Recovery" },
    { symbol: "UBER", status: "Active", side: "Long", quantity: 2100, avgPrice: 73.18, lastPrice: 76.94, dayChangePct: 1.04, pnl: 7896, exposure: 161574, conviction: 7.1, account: "Core", strategy: "Mobility Compounders" },
  ],
};

const riskMonitorDataset: DataNodeTableVisualizerDataset = {
  id: "risk-monitor",
  label: "Risk Monitor",
  description: "Desk-level risk dashboard with drawdown, VaR, utilization, regime fields, and stress metrics.",
  columns: [
    { key: "book", label: "Book", format: "text", minWidth: 140, pinned: "left", categorical: true },
    { key: "owner", label: "Owner", format: "text", minWidth: 130, categorical: true },
    { key: "regime", label: "Regime", format: "text", minWidth: 120, categorical: true },
    { key: "gross", label: "Gross", format: "currency", minWidth: 150, compact: true, heatmapEligible: true },
    { key: "net", label: "Net", format: "currency", minWidth: 150, compact: true, heatmapEligible: true },
    { key: "var95", label: "VaR 95", format: "currency", minWidth: 140, compact: true, heatmapEligible: true },
    { key: "stressLoss", label: "Stress", format: "currency", minWidth: 140, compact: true, heatmapEligible: true },
    { key: "beta", label: "Beta", format: "number", minWidth: 100, decimals: 2, heatmapEligible: true },
    { key: "sharpe", label: "Sharpe", format: "number", minWidth: 110, decimals: 2, heatmapEligible: true },
    { key: "drawdownPct", label: "Drawdown", format: "percent", minWidth: 120, decimals: 2, heatmapEligible: true },
    { key: "utilizationPct", label: "Utilization", format: "percent", minWidth: 120, decimals: 1, heatmapEligible: true },
  ],
  rows: [
    { book: "Macro Core", owner: "Nina", regime: "Stable", gross: 124000000, net: 38000000, var95: 4320000, stressLoss: 11800000, beta: 0.86, sharpe: 1.74, drawdownPct: -2.1, utilizationPct: 61.4 },
    { book: "Event Driven", owner: "Jon", regime: "Watch", gross: 68200000, net: 14400000, var95: 3180000, stressLoss: 9900000, beta: 0.51, sharpe: 1.22, drawdownPct: -4.8, utilizationPct: 73.8 },
    { book: "Semis RV", owner: "Mila", regime: "Crowded", gross: 55400000, net: -6200000, var95: 2790000, stressLoss: 7600000, beta: 1.18, sharpe: 0.94, drawdownPct: -6.2, utilizationPct: 81.1 },
    { book: "Rates Overlay", owner: "Rafa", regime: "Stable", gross: 39000000, net: 4100000, var95: 1680000, stressLoss: 4310000, beta: -0.14, sharpe: 1.81, drawdownPct: -1.2, utilizationPct: 48.6 },
    { book: "Index Hedge", owner: "Sora", regime: "Protective", gross: 28000000, net: -18200000, var95: 1190000, stressLoss: 3110000, beta: -0.73, sharpe: 0.66, drawdownPct: -0.8, utilizationPct: 35.2 },
    { book: "Retail Flow", owner: "Ivy", regime: "Hot", gross: 46200000, net: 12200000, var95: 2920000, stressLoss: 8020000, beta: 1.32, sharpe: 1.08, drawdownPct: -5.5, utilizationPct: 88.4 },
  ],
};

const executionQualityDataset: DataNodeTableVisualizerDataset = {
  id: "execution-quality",
  label: "Execution Quality",
  description: "Venue and routing diagnostics with fill-rate, reject-rate, slippage, latency, and route quality labels.",
  columns: [
    { key: "venue", label: "Venue", format: "text", minWidth: 120, pinned: "left", categorical: true },
    { key: "route", label: "Route", format: "text", minWidth: 150, categorical: true },
    { key: "status", label: "Status", format: "text", minWidth: 120, categorical: true },
    { key: "notional", label: "Notional", format: "currency", minWidth: 140, compact: true, heatmapEligible: true },
    { key: "fillRatePct", label: "Fill Rate", format: "percent", minWidth: 120, decimals: 1, heatmapEligible: true },
    { key: "participationPct", label: "Participation", format: "percent", minWidth: 130, decimals: 1, heatmapEligible: true },
    { key: "slippageBps", label: "Slippage", format: "bps", minWidth: 120, decimals: 1, heatmapEligible: true },
    { key: "feeBps", label: "Fee", format: "bps", minWidth: 100, decimals: 1 },
    { key: "avgFillMs", label: "Latency", format: "number", minWidth: 110, decimals: 0, suffix: " ms", heatmapEligible: true },
    { key: "rejectRatePct", label: "Rejects", format: "percent", minWidth: 110, decimals: 2, heatmapEligible: true },
    { key: "score", label: "Score", format: "number", minWidth: 100, decimals: 1, heatmapEligible: true },
  ],
  rows: [
    { venue: "NASDAQ", route: "Smart / Lit", status: "Healthy", notional: 18200000, fillRatePct: 94.2, participationPct: 18.4, slippageBps: -0.6, feeBps: 0.2, avgFillMs: 41, rejectRatePct: 0.18, score: 9.4 },
    { venue: "NYSE", route: "Primary Close", status: "Healthy", notional: 13600000, fillRatePct: 91.8, participationPct: 11.2, slippageBps: 0.4, feeBps: 0.3, avgFillMs: 58, rejectRatePct: 0.24, score: 8.8 },
    { venue: "IEX", route: "Protected Peg", status: "Watch", notional: 4900000, fillRatePct: 82.1, participationPct: 6.7, slippageBps: 1.6, feeBps: 0.1, avgFillMs: 95, rejectRatePct: 0.82, score: 6.3 },
    { venue: "ARCA", route: "Open Sweep", status: "Healthy", notional: 7200000, fillRatePct: 88.7, participationPct: 13.5, slippageBps: 0.8, feeBps: 0.4, avgFillMs: 62, rejectRatePct: 0.44, score: 7.7 },
    { venue: "BATS", route: "Midpoint Dark", status: "Watch", notional: 9600000, fillRatePct: 79.4, participationPct: 7.3, slippageBps: -1.2, feeBps: 0.0, avgFillMs: 132, rejectRatePct: 1.42, score: 6.9 },
    { venue: "MEMX", route: "Queue Join", status: "Critical", notional: 3100000, fillRatePct: 61.5, participationPct: 4.1, slippageBps: 2.9, feeBps: 0.2, avgFillMs: 184, rejectRatePct: 3.12, score: 4.2 },
  ],
};

export const dataNodeTableVisualizerDatasets = [
  positionsDataset,
  riskMonitorDataset,
  executionQualityDataset,
] as const satisfies readonly DataNodeTableVisualizerDataset[];

const datasetMap = new Map<DataNodeTableVisualizerDatasetId, DataNodeTableVisualizerDataset>(
  dataNodeTableVisualizerDatasets.map((dataset) => [dataset.id, dataset]),
);

function normalizeHexColor(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return hexColorPattern.test(trimmed) ? trimmed.toLowerCase() : undefined;
}

function normalizeTone(value: unknown): DataNodeTableVisualizerTone | undefined {
  return value === "neutral" ||
    value === "primary" ||
    value === "success" ||
    value === "warning" ||
    value === "danger"
    ? value
    : undefined;
}

function normalizeCellValue(value: unknown): DataNodeTableVisualizerCellValue {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  return String(value);
}

function normalizeFrameColumns(value: unknown, fallback: readonly string[]) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const seen = new Set<string>();
  const normalized = value.flatMap((entry) => {
    if (typeof entry !== "string" || !entry.trim()) {
      return [];
    }

    const key = entry.trim();

    if (seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [key];
  });

  return normalized.length > 0 ? normalized : [...fallback];
}

function normalizeFrameRows(value: unknown, columnCount: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!Array.isArray(entry)) {
      return [];
    }

    const row = Array.from({ length: columnCount }, (_, index) =>
      normalizeCellValue(entry[index]),
    );

    return [row];
  });
}

function inferSchemaFormatFromRows(
  columnKey: string,
  rows: readonly DataNodeTableVisualizerFrameRow[],
  columnIndex: number,
): Exclude<DataNodeTableVisualizerColumnFormat, "auto"> {
  const values = rows
    .map((row) => row[columnIndex])
    .filter((value) => value !== null && value !== undefined && value !== "");

  if (values.length === 0) {
    return "text";
  }

  const allNumeric = values.every((value) => getDataNodeTableVisualizerNumericValue(value) !== null);

  if (allNumeric) {
    if (/%|pct|percent/i.test(columnKey)) {
      return "percent";
    }

    if (/bps/i.test(columnKey)) {
      return "bps";
    }

    if (/price|cost|value|gross|net|pnl|notional|amount|exposure/i.test(columnKey)) {
      return "currency";
    }

    return "number";
  }

  return "text";
}

function createSchemaTemplateFromFrame(
  columns: readonly string[],
  rows: readonly DataNodeTableVisualizerFrameRow[],
  dataset: DataNodeTableVisualizerDataset,
) {
  const datasetColumnsByKey = new Map(dataset.columns.map((column) => [column.key, column]));

  return columns.map<DataNodeTableVisualizerColumnSchema>((columnKey, index) => {
    const existing = datasetColumnsByKey.get(columnKey);

    if (existing) {
      return { ...existing };
    }

    return {
      key: columnKey,
      label: columnKey,
      format: inferSchemaFormatFromRows(columnKey, rows, index),
      categorical: false,
    };
  });
}

function normalizeColumnSchema(value: unknown): DataNodeTableVisualizerColumnSchema | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as DataNodeTableVisualizerColumnSchema;
  if (typeof record.key !== "string" || !record.key.trim()) {
    return undefined;
  }

  if (typeof record.label !== "string" || !record.label.trim()) {
    return undefined;
  }

  if (
    record.format !== "text" &&
    record.format !== "number" &&
    record.format !== "currency" &&
    record.format !== "percent" &&
    record.format !== "bps"
  ) {
    return undefined;
  }

  const nextValue: DataNodeTableVisualizerColumnSchema = {
    key: record.key.trim(),
    label: record.label.trim(),
    format: record.format,
  };

  if (typeof record.description === "string" && record.description.trim()) {
    nextValue.description = record.description.trim();
  }

  if (typeof record.minWidth === "number" && Number.isFinite(record.minWidth)) {
    nextValue.minWidth = Math.max(60, Math.trunc(record.minWidth));
  }

  if (typeof record.flex === "number" && Number.isFinite(record.flex)) {
    nextValue.flex = Math.max(0, record.flex);
  }

  if (record.pinned === "left" || record.pinned === "right") {
    nextValue.pinned = record.pinned;
  }

  if (typeof record.decimals === "number" && Number.isFinite(record.decimals)) {
    nextValue.decimals = Math.max(0, Math.min(Math.trunc(record.decimals), 6));
  }

  if (typeof record.prefix === "string") {
    nextValue.prefix = record.prefix;
  }

  if (typeof record.suffix === "string") {
    nextValue.suffix = record.suffix;
  }

  if (typeof record.categorical === "boolean") {
    nextValue.categorical = record.categorical;
  }

  if (typeof record.heatmapEligible === "boolean") {
    nextValue.heatmapEligible = record.heatmapEligible;
  }

  if (typeof record.compact === "boolean") {
    nextValue.compact = record.compact;
  }

  return nextValue;
}

function normalizeColumnSchemas(value: unknown, fallback: readonly DataNodeTableVisualizerColumnSchema[] = []) {
  if (!Array.isArray(value)) {
    return cloneDataNodeTableVisualizerSchema(fallback);
  }

  const seenKeys = new Set<string>();
  const normalized = value.flatMap((entry) => {
    const nextEntry = normalizeColumnSchema(entry);

    if (!nextEntry || seenKeys.has(nextEntry.key)) {
      return [];
    }

    seenKeys.add(nextEntry.key);
    return [nextEntry];
  });

  return normalized;
}

export function cloneDataNodeTableVisualizerSchema(
  columns: readonly DataNodeTableVisualizerColumnSchema[],
): DataNodeTableVisualizerColumnSchema[] {
  return columns.map((column) => ({ ...column }));
}

function normalizeColumnOverride(value: unknown): DataNodeTableVisualizerColumnOverride | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as DataNodeTableVisualizerColumnOverride;
  const nextValue: DataNodeTableVisualizerColumnOverride = {};

  if (typeof record.visible === "boolean") {
    nextValue.visible = record.visible;
  }

  if (typeof record.label === "string" && record.label.trim()) {
    nextValue.label = record.label.trim();
  }

  if (
    record.format === "auto" ||
    record.format === "text" ||
    record.format === "number" ||
    record.format === "currency" ||
    record.format === "percent" ||
    record.format === "bps"
  ) {
    nextValue.format = record.format;
  }

  if (typeof record.decimals === "number" && Number.isFinite(record.decimals)) {
    nextValue.decimals = Math.max(0, Math.min(Math.trunc(record.decimals), 6));
  }

  if (typeof record.prefix === "string") {
    nextValue.prefix = record.prefix;
  }

  if (typeof record.suffix === "string") {
    nextValue.suffix = record.suffix;
  }

  if (typeof record.heatmap === "boolean") {
    nextValue.heatmap = record.heatmap;
  }

  if (typeof record.compact === "boolean") {
    nextValue.compact = record.compact;
  }

  if (record.barMode === "fill" || record.barMode === "none") {
    nextValue.barMode = record.barMode;
  }

  if (
    record.align === "auto" ||
    record.align === "left" ||
    record.align === "center" ||
    record.align === "right"
  ) {
    nextValue.align = record.align;
  }

  if (record.pinned === "none" || record.pinned === "left" || record.pinned === "right") {
    nextValue.pinned = record.pinned;
  }

  return Object.keys(nextValue).length > 0 ? nextValue : undefined;
}

function normalizeValueLabel(value: unknown): DataNodeTableVisualizerValueLabel | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as DataNodeTableVisualizerValueLabel;
  if (typeof record.columnKey !== "string" || !record.columnKey.trim()) {
    return undefined;
  }

  if (typeof record.value !== "string") {
    return undefined;
  }

  return {
    columnKey: record.columnKey.trim(),
    value: record.value,
    label: typeof record.label === "string" && record.label.trim() ? record.label.trim() : undefined,
    tone: normalizeTone(record.tone),
    textColor: normalizeHexColor(record.textColor),
    backgroundColor: normalizeHexColor(record.backgroundColor),
  };
}

function normalizeConditionalRule(value: unknown): DataNodeTableVisualizerConditionalRule | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as DataNodeTableVisualizerConditionalRule;
  if (typeof record.columnKey !== "string" || !record.columnKey.trim()) {
    return undefined;
  }

  const numericValue = Number(record.value);
  if (!Number.isFinite(numericValue)) {
    return undefined;
  }

  if (
    record.operator !== "gt" &&
    record.operator !== "gte" &&
    record.operator !== "lt" &&
    record.operator !== "lte" &&
    record.operator !== "eq"
  ) {
    return undefined;
  }

  return {
    id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : createDataNodeTableVisualizerRuleId(),
    columnKey: record.columnKey.trim(),
    operator: record.operator,
    value: numericValue,
    tone: normalizeTone(record.tone),
    textColor: normalizeHexColor(record.textColor),
    backgroundColor: normalizeHexColor(record.backgroundColor),
  };
}

function normalizeColumnOverrides(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, override]) => {
      const normalized = normalizeColumnOverride(override);
      return normalized ? [[key, normalized] as const] : [];
    }),
  ) satisfies Record<string, DataNodeTableVisualizerColumnOverride>;
}

function stripSchemaManagedFieldsFromColumnOverrides(
  value: Record<string, DataNodeTableVisualizerColumnOverride> | undefined,
) {
  return Object.fromEntries(
    Object.entries(normalizeColumnOverrides(value)).flatMap(([key, override]) => {
      const nextOverride = { ...override };
      delete nextOverride.label;
      delete nextOverride.format;

      return Object.keys(nextOverride).length > 0 ? [[key, nextOverride] as const] : [];
    }),
  ) satisfies Record<string, DataNodeTableVisualizerColumnOverride>;
}

const legacyShippedColumnOverrides: Record<string, DataNodeTableVisualizerColumnOverride> = {
  quantity: { barMode: "fill" },
  pnl: { barMode: "fill", heatmap: true },
  exposure: { heatmap: true, compact: true },
  conviction: { barMode: "fill", heatmap: true, suffix: " /10" },
  dayChangePct: { heatmap: true },
  utilizationPct: { barMode: "fill", heatmap: true, suffix: "%" },
  fillRatePct: { barMode: "fill", heatmap: true, suffix: "%" },
  participationPct: { barMode: "fill", heatmap: true, suffix: "%" },
  avgFillMs: { barMode: "fill", heatmap: true, suffix: " ms" },
  notional: { barMode: "fill", heatmap: true, compact: true },
  score: { barMode: "fill", heatmap: true },
  slippageBps: { heatmap: true },
};

const legacyShippedValueLabels: DataNodeTableVisualizerValueLabel[] = [
  { columnKey: "side", value: "Long", label: "Long", tone: "primary" },
  { columnKey: "side", value: "Short", label: "Short", tone: "warning" },
  { columnKey: "status", value: "Active", label: "Active", tone: "success" },
  { columnKey: "status", value: "Watch", label: "Watch", tone: "warning" },
  { columnKey: "status", value: "Trim", label: "Trim", tone: "primary" },
  { columnKey: "status", value: "Reduce", label: "Reduce", tone: "danger" },
  { columnKey: "status", value: "Healthy", label: "Healthy", tone: "success" },
  { columnKey: "status", value: "Critical", label: "Critical", tone: "danger" },
  { columnKey: "regime", value: "Stable", label: "Stable", tone: "success" },
  { columnKey: "regime", value: "Watch", label: "Watch", tone: "warning" },
  { columnKey: "regime", value: "Crowded", label: "Crowded", tone: "warning" },
  { columnKey: "regime", value: "Protective", label: "Protective", tone: "primary" },
  { columnKey: "regime", value: "Hot", label: "Hot", tone: "danger" },
];

const legacyShippedConditionalRules: DataNodeTableVisualizerConditionalRule[] = [
  { id: "pnl-positive", columnKey: "pnl", operator: "gt", value: 0, tone: "primary" },
  { id: "pnl-negative", columnKey: "pnl", operator: "lt", value: 0, tone: "danger" },
  { id: "drawdown-risk", columnKey: "drawdownPct", operator: "lt", value: -5, tone: "danger" },
  { id: "exec-watch", columnKey: "slippageBps", operator: "gt", value: 1.5, tone: "warning" },
  { id: "utilization-hot", columnKey: "utilizationPct", operator: "gt", value: 80, tone: "danger" },
  { id: "reject-rate-hot", columnKey: "rejectRatePct", operator: "gt", value: 1, tone: "danger" },
  { id: "score-low", columnKey: "score", operator: "lt", value: 6, tone: "warning" },
];

function serializeColumnOverridesForComparison(
  value: Record<string, DataNodeTableVisualizerColumnOverride> | undefined,
) {
  const normalized = normalizeColumnOverrides(value);

  return JSON.stringify(
    Object.keys(normalized)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, normalized[key]]),
  );
}

function serializeValueLabelsForComparison(value: DataNodeTableVisualizerValueLabel[] | undefined) {
  return JSON.stringify(
    (value ?? [])
      .map((entry) => normalizeValueLabel(entry))
      .filter((entry): entry is DataNodeTableVisualizerValueLabel => Boolean(entry)),
  );
}

function serializeConditionalRulesForComparison(
  value: DataNodeTableVisualizerConditionalRule[] | undefined,
) {
  return JSON.stringify(
    (value ?? [])
      .map((entry) => normalizeConditionalRule(entry))
      .filter((entry): entry is DataNodeTableVisualizerConditionalRule => Boolean(entry)),
  );
}

const legacyShippedColumnOverridesSignature =
  serializeColumnOverridesForComparison(legacyShippedColumnOverrides);
const legacyShippedValueLabelsSignature =
  serializeValueLabelsForComparison(legacyShippedValueLabels);
const legacyShippedConditionalRulesSignature =
  serializeConditionalRulesForComparison(legacyShippedConditionalRules);

export function stripLegacyDataNodeTableVisualizerDisplayConfig(
  props: DataNodeTableVisualizerProps,
): DataNodeTableVisualizerProps {
  const nextProps: DataNodeTableVisualizerProps = { ...props };

  if (
    serializeColumnOverridesForComparison(props.columnOverrides) ===
    legacyShippedColumnOverridesSignature
  ) {
    nextProps.columnOverrides = {};
  }

  if (
    serializeValueLabelsForComparison(props.valueLabels) ===
    legacyShippedValueLabelsSignature
  ) {
    nextProps.valueLabels = [];
  }

  if (
    serializeConditionalRulesForComparison(props.conditionalRules) ===
    legacyShippedConditionalRulesSignature
  ) {
    nextProps.conditionalRules = [];
  }

  return nextProps;
}

export function createDataNodeTableVisualizerRuleId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `table-rule-${uuid}` : `table-rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getDataNodeTableVisualizerDataset(datasetId?: unknown) {
  if (typeof datasetId === "string" && datasetMap.has(datasetId as DataNodeTableVisualizerDatasetId)) {
    return datasetMap.get(datasetId as DataNodeTableVisualizerDatasetId)!;
  }

  return positionsDataset;
}

export function buildDataNodeTableVisualizerFrameFromDataset(
  dataset: DataNodeTableVisualizerDataset,
) {
  const columns = dataset.columns.map((column) => column.key);
  const rows = dataset.rows.map((row) => columns.map((columnKey) => normalizeCellValue(row[columnKey])));

  return {
    columns,
    rows,
  };
}

export function buildDataNodeTableVisualizerRowObjects(
  columns: readonly string[],
  rows: readonly DataNodeTableVisualizerFrameRow[],
) {
  return rows.map<DataNodeTableVisualizerRow>((row) =>
    Object.fromEntries(
      columns.map((columnKey, index) => [columnKey, normalizeCellValue(row[index])]),
    ),
  );
}

export function resolveDataNodeTableVisualizerFrame(
  props: Pick<DataNodeTableVisualizerProps, "columns" | "rows">,
  dataset: DataNodeTableVisualizerDataset,
) {
  const datasetFrame = buildDataNodeTableVisualizerFrameFromDataset(dataset);
  const columns = normalizeFrameColumns(props.columns, datasetFrame.columns);
  const rows =
    Array.isArray(props.rows) && props.rows.length > 0
      ? normalizeFrameRows(props.rows, columns.length)
      : dataset.rows.map((row) => columns.map((columnKey) => normalizeCellValue(row[columnKey])));

  return {
    columns,
    rows,
  };
}

export function resolveDataNodeTableVisualizerSchema(
  props: Pick<DataNodeTableVisualizerProps, "columnOverrides" | "columns" | "rows" | "schema">,
  dataset: DataNodeTableVisualizerDataset,
) {
  const frame = resolveDataNodeTableVisualizerFrame(props, dataset);

  if (Array.isArray(props.schema)) {
    return normalizeColumnSchemas(
      props.schema,
      createSchemaTemplateFromFrame(frame.columns, frame.rows, dataset),
    );
  }

  const normalizedOverrides = normalizeColumnOverrides(props.columnOverrides);

  return createSchemaTemplateFromFrame(frame.columns, frame.rows, dataset).map((column) => {
    const override = normalizedOverrides[column.key];

    return {
      ...column,
      label: override?.label ?? column.label,
      format:
        override?.format && override.format !== "auto"
          ? override.format
          : column.format,
    };
  });
}

export function constrainDataNodeTableVisualizerPropsToDataset(
  props: DataNodeTableVisualizerProps,
  datasetOrId: DataNodeTableVisualizerDataset | DataNodeTableVisualizerDatasetId,
): DataNodeTableVisualizerProps {
  const migratedProps = stripLegacyDataNodeTableVisualizerDisplayConfig(props);
  const dataset =
    typeof datasetOrId === "string" ? getDataNodeTableVisualizerDataset(datasetOrId) : datasetOrId;
  const frame = resolveDataNodeTableVisualizerFrame(migratedProps, dataset);
  const schema = resolveDataNodeTableVisualizerSchema(migratedProps, dataset);
  const columnKeys = new Set(schema.map((column) => column.key));

  return {
    ...migratedProps,
    datasetId: dataset.id,
    columns: frame.columns,
    rows: frame.rows,
    schema,
    columnOverrides: Object.fromEntries(
      Object.entries(stripSchemaManagedFieldsFromColumnOverrides(migratedProps.columnOverrides)).filter(([key]) =>
        columnKeys.has(key),
      ),
    ),
    valueLabels: (migratedProps.valueLabels ?? []).filter((entry) => columnKeys.has(entry.columnKey)),
    conditionalRules: (migratedProps.conditionalRules ?? []).filter((entry) => columnKeys.has(entry.columnKey)),
  };
}

export function resolveDataNodeTableVisualizerProps(props: DataNodeTableVisualizerProps): ResolvedDataNodeTableVisualizerProps {
  const migratedProps = stripLegacyDataNodeTableVisualizerDisplayConfig(props);
  const dataset = getDataNodeTableVisualizerDataset(migratedProps.datasetId);
  const frame = resolveDataNodeTableVisualizerFrame(migratedProps, dataset);
  const schema = resolveDataNodeTableVisualizerSchema(migratedProps, dataset);

  return {
    datasetId: dataset.id,
    columns: frame.columns,
    rows: frame.rows,
    schema,
    density: migratedProps.density === "compact" ? "compact" : "comfortable",
    showToolbar: migratedProps.showToolbar !== false,
    showSearch: migratedProps.showSearch !== false,
    zebraRows: migratedProps.zebraRows !== false,
    pagination: migratedProps.pagination !== false,
    pageSize:
      typeof migratedProps.pageSize === "number" && Number.isFinite(migratedProps.pageSize)
        ? Math.max(5, Math.min(Math.trunc(migratedProps.pageSize), 50))
        : defaultPageSize,
    columnOverrides: stripSchemaManagedFieldsFromColumnOverrides(migratedProps.columnOverrides),
    valueLabels: Array.isArray(migratedProps.valueLabels)
      ? migratedProps.valueLabels
          .map((entry) => normalizeValueLabel(entry))
          .filter((entry): entry is DataNodeTableVisualizerValueLabel => Boolean(entry))
      : [],
    conditionalRules: Array.isArray(migratedProps.conditionalRules)
      ? migratedProps.conditionalRules
          .map((entry) => normalizeConditionalRule(entry))
          .filter((entry): entry is DataNodeTableVisualizerConditionalRule => Boolean(entry))
      : [],
  };
}

export function resolveDataNodeTableVisualizerColumns(
  props: ResolvedDataNodeTableVisualizerProps,
) {
  return props.schema.map<ResolvedDataNodeTableVisualizerColumnConfig>((column) => {
    const override = props.columnOverrides[column.key] ?? {};
    const effectiveFormat =
      override.format && override.format !== "auto" ? override.format : column.format;

    return {
      ...column,
      label: override.label ?? column.label,
      format: effectiveFormat,
      decimals: override.decimals ?? column.decimals,
      prefix: override.prefix ?? column.prefix,
      suffix: override.suffix ?? column.suffix,
      compact: override.compact ?? column.compact ?? false,
      visible: override.visible ?? true,
      heatmap: effectiveFormat !== "text" ? (override.heatmap ?? false) : false,
      barMode: override.barMode ?? "none",
      align:
        override.align && override.align !== "auto"
          ? override.align
          : effectiveFormat === "text"
            ? "left"
            : "right",
      pinned:
        override.pinned && override.pinned !== "none"
          ? override.pinned
          : column.pinned,
    };
  });
}

export function getDataNodeTableVisualizerNumericValue(value: DataNodeTableVisualizerCellValue) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getDataNodeTableVisualizerValueLabel(
  props: ResolvedDataNodeTableVisualizerProps,
  columnKey: string,
  value: DataNodeTableVisualizerCellValue,
) {
  const lookupValue = value == null ? "" : String(value);
  return (
    props.valueLabels.find(
      (entry) => entry.columnKey === columnKey && entry.value === lookupValue,
    ) ?? null
  );
}

export function getDataNodeTableVisualizerColumnRange(
  rows: DataNodeTableVisualizerRow[],
  columnKey: string,
) {
  const values = rows
    .map((row) => getDataNodeTableVisualizerNumericValue(row[columnKey]))
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return null;
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export function getDataNodeTableVisualizerCategoricalValues(
  rows: readonly DataNodeTableVisualizerRow[],
  columnKey: string,
) {
  const values = new Set<string>();

  rows.forEach((row) => {
    const value = row[columnKey];
    if (value !== null && value !== undefined && value !== "") {
      values.add(String(value));
    }
  });

  return [...values.values()];
}

export function validateDataNodeTableVisualizerSchema(
  rows: readonly DataNodeTableVisualizerRow[],
  columns: readonly Pick<ResolvedDataNodeTableVisualizerColumnConfig, "format" | "key">[],
): DataNodeTableVisualizerSchemaValidationResult {
  const issues: DataNodeTableVisualizerSchemaValidationIssue[] = [];

  if (columns.length === 0) {
    issues.push({ code: "empty_schema" });
    return {
      isValid: false,
      issues,
    };
  }

  if (rows.length === 0) {
    return {
      isValid: true,
      issues,
    };
  }

  const sampledRows = rows.slice(0, 50);
  const missingColumns = columns
    .filter((column) =>
      sampledRows.every((row) => !Object.prototype.hasOwnProperty.call(row, column.key)),
    )
    .map((column) => column.key);

  if (missingColumns.length > 0) {
    issues.push({
      code: "missing_columns",
      columnKeys: missingColumns,
    });
  }

  const nonNumericColumns = columns
    .filter((column) => column.format !== "text")
    .filter((column) => {
      const values = sampledRows
        .map((row) => row[column.key])
        .filter((value) => value !== null && value !== undefined && value !== "");

      if (values.length === 0) {
        return false;
      }

      return values.every((value) => getDataNodeTableVisualizerNumericValue(value) === null);
    })
    .map((column) => column.key);

  if (nonNumericColumns.length > 0) {
    issues.push({
      code: "non_numeric_columns",
      columnKeys: nonNumericColumns,
    });
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

export function formatDataNodeTableVisualizerValue(
  value: DataNodeTableVisualizerCellValue,
  column: Pick<
    ResolvedDataNodeTableVisualizerColumnConfig,
    "compact" | "decimals" | "format" | "prefix" | "suffix"
  >,
) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (column.format === "text") {
    return `${column.prefix ?? ""}${String(value)}${column.suffix ?? ""}`;
  }

  const numericValue = getDataNodeTableVisualizerNumericValue(value);

  if (numericValue === null) {
    return String(value);
  }

  const digits = column.decimals ?? (column.format === "currency" ? 2 : column.format === "percent" || column.format === "bps" ? 1 : 0);
  const notation = column.compact ? "compact" : "standard";
  const formatterKey = `${column.format}:${digits}:${notation}`;
  const formatter = getNumberFormatter(formatterKey, () => {
    if (column.format === "currency") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
    }

    return new Intl.NumberFormat("en-US", {
      notation,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  });

  let formatted = formatter.format(numericValue);

  if (column.format === "percent") {
    formatted = `${formatted}%`;
  } else if (column.format === "bps") {
    formatted = `${formatted} bps`;
  }

  return `${column.prefix ?? ""}${formatted}${column.suffix ?? ""}`;
}

export function evaluateDataNodeTableVisualizerRule(
  value: number,
  rule: Pick<DataNodeTableVisualizerConditionalRule, "operator" | "value">,
) {
  if (rule.operator === "gt") {
    return value > rule.value;
  }

  if (rule.operator === "gte") {
    return value >= rule.value;
  }

  if (rule.operator === "lt") {
    return value < rule.value;
  }

  if (rule.operator === "lte") {
    return value <= rule.value;
  }

  return value === rule.value;
}

const numberFormatterCache = new Map<string, Intl.NumberFormat>();

function getNumberFormatter(key: string, factory: () => Intl.NumberFormat) {
  const existing = numberFormatterCache.get(key);

  if (existing) {
    return existing;
  }

  const nextFormatter = factory();
  numberFormatterCache.set(key, nextFormatter);
  return nextFormatter;
}

export const dataNodeTableVisualizerDatasetOptions = dataNodeTableVisualizerDatasets.map((dataset) => ({
  value: dataset.id,
  label: dataset.label,
  description: dataset.description,
}));

export const dataNodeTableVisualizerFormatOptions: Array<{
  value: DataNodeTableVisualizerColumnFormat;
  label: string;
}> = [
  { value: "auto", label: "Auto" },
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "percent", label: "Percent" },
  { value: "bps", label: "Bps" },
];

export const dataNodeTableVisualizerDensityOptions: Array<{
  value: DataNodeTableVisualizerDensity;
  label: string;
}> = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

export const dataNodeTableVisualizerBarModeOptions: Array<{
  value: DataNodeTableVisualizerBarMode;
  label: string;
}> = [
  { value: "none", label: "None" },
  { value: "fill", label: "Filled bar" },
];

export const dataNodeTableVisualizerAlignOptions: Array<{
  value: DataNodeTableVisualizerAlign;
  label: string;
}> = [
  { value: "auto", label: "Auto" },
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

export const dataNodeTableVisualizerPinnedOptions: Array<{
  value: DataNodeTableVisualizerPinned;
  label: string;
}> = [
  { value: "none", label: "None" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

export const dataNodeTableVisualizerOperatorOptions: Array<{
  value: DataNodeTableVisualizerOperator;
  label: string;
}> = [
  { value: "gt", label: "> greater than" },
  { value: "gte", label: ">= greater or equal" },
  { value: "lt", label: "< less than" },
  { value: "lte", label: "<= less or equal" },
  { value: "eq", label: "= equal" },
];

export const dataNodeTableVisualizerToneOptions: Array<{
  value: DataNodeTableVisualizerTone;
  label: string;
}> = [
  { value: "neutral", label: "Neutral" },
  { value: "primary", label: "Primary" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "danger", label: "Danger" },
];

export const dataNodeTableVisualizerDefaultProps: DataNodeTableVisualizerProps = {
  datasetId: "positions",
  ...buildDataNodeTableVisualizerFrameFromDataset(positionsDataset),
  schema: cloneDataNodeTableVisualizerSchema(positionsDataset.columns),
  density: "comfortable",
  showToolbar: true,
  showSearch: true,
  zebraRows: true,
  pagination: true,
  pageSize: 10,
  columnOverrides: {},
  valueLabels: [],
  conditionalRules: [],
};
