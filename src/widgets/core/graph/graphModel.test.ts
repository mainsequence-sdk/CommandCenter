import { describe, expect, it } from "vitest";

import {
  buildGraphChartSeries,
  buildGraphSeries,
  type ResolvedGraphConfig,
} from "./graphModel";

const config = {
  groupField: "symbol",
  xField: "time",
  yField: "value",
} satisfies Pick<ResolvedGraphConfig, "groupField" | "seriesOverrides" | "xField" | "yField">;

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
});
