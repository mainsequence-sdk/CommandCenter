import { describe, expect, it } from "vitest";

import { resolveWidgetStatusSummary } from "./widget-status";

describe("resolveWidgetStatusSummary", () => {
  it("uses a red dot for finite execution errors", () => {
    const summary = resolveWidgetStatusSummary({
      executionState: {
        status: "error",
        error: "Request failed.",
      },
    });

    expect(summary).toMatchObject({
      indicator: "dot",
      isError: true,
      label: "Execution error",
      sources: ["finite-execution"],
      tone: "danger",
    });
  });

  it("uses a red dot for upstream execution blockers", () => {
    const summary = resolveWidgetStatusSummary({
      executionState: {
        status: "upstream-error",
        error: "Blocked by Source.",
        blockedByWidgetId: "source-1",
      },
    });

    expect(summary).toMatchObject({
      detail: "Blocked by Source.",
      indicator: "dot",
      isError: true,
      label: "Upstream error",
      sources: ["upstream"],
      tone: "danger",
    });
  });

  it("uses a red lightning indicator for stream errors", () => {
    const summary = resolveWidgetStatusSummary({
      runtimeState: {
        status: "error",
        streamStatus: "error",
        error: "Socket closed.",
      },
    });

    expect(summary).toMatchObject({
      detail: "Socket closed.",
      indicator: "lightning",
      isError: true,
      label: "Stream error",
      sources: ["stream-publication"],
      tone: "danger",
    });
  });

  it("combines dot and lightning when finite and stream errors are both active", () => {
    const summary = resolveWidgetStatusSummary({
      executionState: {
        status: "error",
        error: "Execution failed.",
      },
      runtimeState: {
        status: "error",
        streamStatus: "error",
        error: "Socket closed.",
      },
    });

    expect(summary).toMatchObject({
      indicator: "dot+lightning",
      isError: true,
      label: "Execution and stream error",
      sources: ["finite-execution", "stream-publication"],
      tone: "danger",
    });
  });

  it("keeps a retained live stream green instead of showing stale finite waiting", () => {
    const summary = resolveWidgetStatusSummary({
      executionState: {
        status: "waiting",
        error: "Waiting for upstream.",
      },
      runtimeState: {
        status: "ready",
        streamStatus: "live",
        columns: ["symbol", "last"],
        rows: [{ symbol: "BTCUSDT", last: 100 }],
      },
    });

    expect(summary).toMatchObject({
      indicator: "lightning",
      isError: false,
      label: "Live",
      sources: ["stream-publication"],
      tone: "success",
    });
  });

  it("shows stream waiting before the first usable publication", () => {
    const summary = resolveWidgetStatusSummary({
      runtimeState: {
        status: "idle",
        streamStatus: "connecting",
        columns: [],
        rows: [],
      },
    });

    expect(summary).toMatchObject({
      detail: "Waiting for the first usable stream publication.",
      indicator: "lightning",
      isError: false,
      label: "Connecting",
      sources: ["stream-publication"],
      tone: "warning",
    });
  });
});
