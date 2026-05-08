import { describe, expect, it } from "vitest";

import {
  buildStackedGraphSeriesProjection,
  buildGraphChartSeries,
  buildGraphSeriesConfigKey,
  buildGraphSeries,
  formatGraphAxisValue,
  reduceIncrementalGraphSeries,
  type ResolvedGraphConfig,
} from "./graphModel";

const config = {
  groupField: "symbol",
  limit: 14_000,
  maxSeries: 8,
  xField: "time",
  yField: "value",
} satisfies Pick<
  ResolvedGraphConfig,
  "groupField" | "limit" | "maxSeries" | "seriesOverrides" | "xField" | "yField"
>;

describe("graph incremental series projection", () => {
  it("projects delta rows to the same series and chart bucket as retained rows", () => {
    const retained = buildGraphChartSeries(
      buildGraphSeries(
        [
          { time: "2026-04-25T00:01:00.000Z", symbol: "AAPL", value: 10 },
          { time: "2026-04-25T00:02:00.000Z", symbol: "AAPL", value: 20 },
        ],
        config,
      ).series,
      "datetime",
    );
    const delta = buildGraphChartSeries(
      buildGraphSeries(
        [
          { time: "2026-04-25T00:02:00.000Z", symbol: "AAPL", value: 22 },
        ],
        config,
      ).series,
      "datetime",
    );

    expect(retained.series[0]?.id).toBe("AAPL");
    expect(delta.series[0]?.id).toBe("AAPL");
    expect(delta.series[0]?.points).toEqual([
      { time: Date.parse("2026-04-25T00:02:00.000Z"), value: 22 },
    ]);
  });

  it("uses the configured maxSeries limit instead of a hardcoded cap", () => {
    const result = buildGraphSeries(
      [
        { time: "2026-04-25T00:01:00.000Z", symbol: "AAPL", value: 10 },
        { time: "2026-04-25T00:02:00.000Z", symbol: "AAPL", value: 11 },
        { time: "2026-04-25T00:01:00.000Z", symbol: "MSFT", value: 20 },
        { time: "2026-04-25T00:02:00.000Z", symbol: "MSFT", value: 21 },
        { time: "2026-04-25T00:01:00.000Z", symbol: "NVDA", value: 30 },
        { time: "2026-04-25T00:02:00.000Z", symbol: "NVDA", value: 31 },
      ],
      {
        ...config,
        maxSeries: 2,
      },
    );

    expect(result.series.map((series) => series.id)).toEqual(["AAPL", "MSFT"]);
    expect(result.droppedGroups).toBe(1);
    expect(result.totalGroups).toBe(3);
  });

  it("keeps only the latest configured points per series", () => {
    const result = buildGraphSeries(
      [
        { time: "2026-04-25T00:01:00.000Z", symbol: "AAPL", value: 10 },
        { time: "2026-04-25T00:02:00.000Z", symbol: "AAPL", value: 11 },
        { time: "2026-04-25T00:03:00.000Z", symbol: "AAPL", value: 12 },
      ],
      {
        ...config,
        limit: 2,
      },
    );

    expect(result.series[0]?.sourcePointCount).toBe(3);
    expect(result.series[0]?.pointCount).toBe(2);
    expect(result.series[0]?.points).toEqual([
      { time: Date.parse("2026-04-25T00:02:00.000Z"), value: 11 },
      { time: Date.parse("2026-04-25T00:03:00.000Z"), value: 12 },
    ]);
  });

  it("builds a stable config key for equivalent graph series configs", () => {
    expect(
      buildGraphSeriesConfigKey({
        ...config,
        seriesOverrides: {
          MSFT: { lineStyle: "dashed", color: "#ff0000" },
          AAPL: { color: "#00ff00" },
        },
      }),
    ).toBe(
      buildGraphSeriesConfigKey({
        ...config,
        seriesOverrides: {
          AAPL: { color: "#00ff00" },
          MSFT: { color: "#ff0000", lineStyle: "dashed" },
        },
      }),
    );
  });

  it("formats axis labels with scale, decimals, and suffix", () => {
    expect(formatGraphAxisValue(12_500_000, {
      yAxisDecimals: 1,
      yAxisScaleZeros: 6,
      yAxisSuffix: "M",
    })).toBe("12.5M");
  });

  it("normalizes negative zero axis labels back to zero", () => {
    expect(formatGraphAxisValue(-0.00000001, {
      yAxisDecimals: 2,
      yAxisScaleZeros: 0,
      yAxisSuffix: "%",
    })).toBe("0.00%");
  });

  it("keeps the latest points as a bounded queue for incremental updates", () => {
    const seeded = buildGraphSeries(
      [
        { time: "2026-04-25T00:01:00.000Z", symbol: "AAPL", value: 10 },
        { time: "2026-04-25T00:02:00.000Z", symbol: "AAPL", value: 11 },
      ],
      {
        ...config,
        limit: 2,
      },
    );
    const updated = reduceIncrementalGraphSeries(
      seeded,
      [{ time: "2026-04-25T00:03:00.000Z", symbol: "AAPL", value: 12 }],
      {
        ...config,
        limit: 2,
      },
    );

    expect(updated.updateMode).toBe("snapshot");
    expect(updated.result.series[0]?.points).toEqual([
      { time: Date.parse("2026-04-25T00:02:00.000Z"), value: 11 },
      { time: Date.parse("2026-04-25T00:03:00.000Z"), value: 12 },
    ]);
  });

  it("keeps delta updates incremental when they only append the newest point", () => {
    const seeded = buildGraphSeries(
      [
        { time: "2026-04-25T00:01:00.000Z", symbol: "AAPL", value: 10 },
      ],
      config,
    );
    const updated = reduceIncrementalGraphSeries(
      seeded,
      [{ time: "2026-04-25T00:02:00.000Z", symbol: "AAPL", value: 11 }],
      config,
    );

    expect(updated.updateMode).toBe("delta");
    expect(updated.result.series[0]?.points).toEqual([
      { time: Date.parse("2026-04-25T00:01:00.000Z"), value: 10 },
      { time: Date.parse("2026-04-25T00:02:00.000Z"), value: 11 },
    ]);
    expect(updated.deltaSeries[0]?.points).toEqual([
      { time: Date.parse("2026-04-25T00:02:00.000Z"), value: 11 },
    ]);
  });

  it("forces a snapshot when an incremental update mutates older history", () => {
    const seeded = buildGraphSeries(
      [
        { time: "2026-04-25T00:01:00.000Z", symbol: "AAPL", value: 10 },
        { time: "2026-04-25T00:02:00.000Z", symbol: "AAPL", value: 11 },
      ],
      config,
    );
    const updated = reduceIncrementalGraphSeries(
      seeded,
      [{ time: "2026-04-25T00:01:00.000Z", symbol: "AAPL", value: 12 }],
      config,
    );

    expect(updated.updateMode).toBe("snapshot");
    expect(updated.result.series[0]?.points).toEqual([
      { time: Date.parse("2026-04-25T00:01:00.000Z"), value: 12 },
      { time: Date.parse("2026-04-25T00:02:00.000Z"), value: 11 },
    ]);
  });

  it("keeps sub-second datetime points for echarts", () => {
    const sameSecondSeries = buildGraphSeries(
      [
        { time: "2026-04-25T00:01:00.100Z", symbol: "AAPL", value: 10 },
        { time: "2026-04-25T00:01:00.900Z", symbol: "AAPL", value: 11 },
      ],
      config,
    );

    const chartSeries = buildGraphChartSeries(
      sameSecondSeries.series,
      "datetime",
      "echarts",
    );

    expect(chartSeries.collapsedPointCount).toBe(0);
    expect(chartSeries.series[0]?.points).toEqual([
      { time: Date.parse("2026-04-25T00:01:00.100Z"), value: 10 },
      { time: Date.parse("2026-04-25T00:01:00.900Z"), value: 11 },
    ]);
  });

  it("projects stacked series against the union of visible timestamps", () => {
    const result = buildGraphSeries(
      [
        { time: "2026-04-25T00:01:00.000Z", symbol: "AAPL", value: 10 },
        { time: "2026-04-25T00:02:00.000Z", symbol: "AAPL", value: 11 },
        { time: "2026-04-25T00:02:00.000Z", symbol: "MSFT", value: 20 },
        { time: "2026-04-25T00:03:00.000Z", symbol: "MSFT", value: 21 },
      ],
      config,
    );

    const stacked = buildStackedGraphSeriesProjection(result.series);

    expect(stacked.map((series) => series.id)).toEqual(["AAPL", "MSFT"]);
    expect(stacked[0]?.points).toEqual([
      { time: Date.parse("2026-04-25T00:01:00.000Z"), value: 10 },
      { time: Date.parse("2026-04-25T00:02:00.000Z"), value: 11 },
      { time: Date.parse("2026-04-25T00:03:00.000Z"), value: 0 },
    ]);
    expect(stacked[1]?.points).toEqual([
      { time: Date.parse("2026-04-25T00:01:00.000Z"), value: 10 },
      { time: Date.parse("2026-04-25T00:02:00.000Z"), value: 31 },
      { time: Date.parse("2026-04-25T00:03:00.000Z"), value: 21 },
    ]);
  });
});
