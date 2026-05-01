import { describe, expect, it } from "vitest";

import { shouldForceOhlcSnapshot } from "./ohlcBarsRender";

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
