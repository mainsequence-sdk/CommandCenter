import { describe, expect, it } from "vitest";
import { TickMarkType } from "lightweight-charts";

import { shouldForceOhlcSnapshot } from "./ohlcBarsRender";
import { formatOhlcAxisTickLabel, formatOhlcCrosshairTimeLabel } from "./ohlcBarsTime";

describe("shouldForceOhlcSnapshot", () => {
  it("forces a snapshot when the seed baseline arrives after live delta rendering started", () => {
    expect(
      shouldForceOhlcSnapshot({
        chartUpdateMode: "delta",
        deltaPointCount: 1,
        hasStudies: false,
        shapeKeyChanged: false,
        seedPublicationChanged: true,
        livePublicationRole: "update",
        liveMode: "delta",
        liveSourceRunChanged: false,
        nextPointCount: 500,
        previousPointCount: 1,
        nextFirstPointTime: 1_700_000_000_000,
        previousFirstPointTime: 1_700_100_000_000,
      }),
    ).toBe(true);
  });

  it("keeps delta mode when only new live updates advance the visible tail", () => {
    expect(
      shouldForceOhlcSnapshot({
        chartUpdateMode: "delta",
        deltaPointCount: 1,
        hasStudies: false,
        shapeKeyChanged: false,
        seedPublicationChanged: false,
        livePublicationRole: "update",
        liveMode: "delta",
        liveSourceRunChanged: false,
        nextPointCount: 101,
        previousPointCount: 100,
        nextFirstPointTime: 1_700_000_000_000,
        previousFirstPointTime: 1_700_000_000_000,
      }),
    ).toBe(false);
  });
});

describe("formatOhlcAxisTickLabel", () => {
  it("shows date labels for datetime daily ticks instead of time-only labels", () => {
    const label = formatOhlcAxisTickLabel({
      locale: "en-US",
      tickMarkType: TickMarkType.DayOfMonth,
      time: "2025-04-19T00:00:00Z",
      timeAxisMode: "datetime",
    });

    expect(label).toContain("Apr");
    expect(label).not.toContain(":");
  });

  it("shows intraday time for time ticks", () => {
    const label = formatOhlcAxisTickLabel({
      locale: "en-US",
      tickMarkType: TickMarkType.Time,
      time: "2025-04-19T00:18:00Z",
      timeAxisMode: "datetime",
    });

    expect(label).toContain(":");
    expect(label).not.toContain("Apr");
  });

  it("keeps date-only fields on canonical date labels", () => {
    expect(
      formatOhlcAxisTickLabel({
        locale: "en-US",
        tickMarkType: TickMarkType.DayOfMonth,
        time: "2025-04-19T00:00:00Z",
        timeAxisMode: "date",
      }),
    ).toBe("2025-04-19");
  });
});

describe("formatOhlcCrosshairTimeLabel", () => {
  it("shows full datetime for datetime series hover labels", () => {
    const label = formatOhlcCrosshairTimeLabel({
      includeSeconds: true,
      locale: "en-US",
      time: "2025-04-19T00:18:00Z",
      timeAxisMode: "datetime",
    });

    expect(label).toContain("Apr");
    expect(label).toContain("2025");
    expect(label).toContain(":");
  });
});
