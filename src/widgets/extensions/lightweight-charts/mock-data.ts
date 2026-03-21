import type { UTCTimestamp } from "lightweight-charts";

export interface LightweightChartsHeatmapCell {
  key: string;
  rowLabel: string;
  columnLabel: string;
  signal: number;
  flowPct: number;
  imbalancePct: number;
  spreadBps: number;
  series: Array<{
    time: UTCTimestamp;
    value: number;
  }>;
}

export const lightweightChartsHeatmapRows = [
  "Rates",
  "Credit",
  "FX",
  "Equities",
  "Commodities",
  "Volatility",
] as const;

export const lightweightChartsHeatmapColumns = [
  "Overnight",
  "1W",
  "1M",
  "3M",
  "6M",
  "1Y",
] as const;

const signalMatrix = [
  [0.68, 0.57, 0.24, -0.12, -0.35, -0.46],
  [0.39, 0.51, 0.44, 0.18, -0.11, -0.27],
  [-0.42, -0.25, 0.07, 0.28, 0.46, 0.34],
  [0.11, 0.34, 0.62, 0.59, 0.21, -0.09],
  [-0.31, -0.08, 0.26, 0.49, 0.54, 0.41],
  [0.52, 0.29, -0.14, -0.33, -0.51, -0.63],
] as const;

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function buildSeries(rowIndex: number, columnIndex: number, signal: number) {
  const start = Math.floor(Date.UTC(2026, 2, 18, 6, 0, 0) / 1000);
  const seed = (rowIndex + 1) * 17 + (columnIndex + 1) * 11;
  let currentValue = 100 + rowIndex * 6 + columnIndex * 2 + signal * 8;

  return Array.from({ length: 28 }, (_, index) => {
    const drift = signal * 0.72;
    const wave = Math.sin((index + seed) / 2.35) * 1.9;
    const recoil = Math.cos((index + seed) / 3.9) * 0.9;
    currentValue += drift + wave + recoil;

    return {
      time: (start + index * 14_400) as UTCTimestamp,
      value: round(currentValue),
    };
  });
}

export const lightweightChartsHeatmapCells: LightweightChartsHeatmapCell[] =
  lightweightChartsHeatmapRows.flatMap((rowLabel, rowIndex) =>
    lightweightChartsHeatmapColumns.map((columnLabel, columnIndex) => {
      const signal = signalMatrix[rowIndex]![columnIndex]!;

      return {
        key: `${rowLabel.toLowerCase()}-${columnLabel.toLowerCase()}`,
        rowLabel,
        columnLabel,
        signal,
        flowPct: round(signal * 31 + (rowIndex - columnIndex) * 1.8, 1),
        imbalancePct: round(signal * 24 - columnIndex * 1.3 + rowIndex * 1.1, 1),
        spreadBps: round(8 + (1 - signal) * 7 + columnIndex * 0.8 + rowIndex * 0.45, 1),
        series: buildSeries(rowIndex, columnIndex, signal),
      };
    }),
  );
