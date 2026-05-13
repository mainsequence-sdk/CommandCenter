import { describe, expect, it } from "vitest";

import type { GraphSeries } from "./graphModel";
import { buildPaddedValueAxisBounds } from "./EChartsSeriesChart";

describe("buildPaddedValueAxisBounds", () => {
  it("keeps large-magnitude series with small variation tightly framed", () => {
    const series: GraphSeries[] = [
      {
        id: "BTCUSDT",
        label: "BTCUSDT",
        pointCount: 3,
        sourcePointCount: 3,
        points: [
          { time: 1, value: 80_200.12 },
          { time: 2, value: 80_200.18 },
          { time: 3, value: 80_200.27 },
        ],
      },
    ];

    const bounds = buildPaddedValueAxisBounds(series);

    expect(bounds.min).toBeLessThanOrEqual(80_200.12);
    expect(bounds.max).toBeGreaterThanOrEqual(80_200.27);
    expect((bounds.max ?? 0) - (bounds.min ?? 0)).toBeLessThan(1);
  });

  it("avoids excessive padding for flat large-magnitude series", () => {
    const series: GraphSeries[] = [
      {
        id: "BTCUSDT",
        label: "BTCUSDT",
        pointCount: 2,
        sourcePointCount: 2,
        points: [
          { time: 1, value: 80_200.1 },
          { time: 2, value: 80_200.1 },
        ],
      },
    ];

    const bounds = buildPaddedValueAxisBounds(series);

    expect(bounds.min).toBeLessThan(80_200.1);
    expect(bounds.max).toBeGreaterThan(80_200.1);
    expect((bounds.max ?? 0) - (bounds.min ?? 0)).toBeLessThan(500);
  });
});
