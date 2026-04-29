import { describe, expect, it } from "vitest";

import {
  buildGraphChartSeries,
  buildGraphSeries,
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
});
