import { beforeEach, describe, expect, it } from "vitest";

import type { ConnectionQueryRequest } from "@/connections/types";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";
import type { TabularFrameSourceV1 } from "@/widgets/shared/tabular-frame-source";

import {
  clearRetainedConnectionQueryResponses,
  mergeConnectionQueryIncrementalFrame,
  resolveConnectionQueryIncrementalDecision,
  runConnectionQueryWithInFlightDedupe,
  type ConnectionQueryIncrementalRefreshSettings,
} from "./incrementalConnectionRefresh";

const settings: ConnectionQueryIncrementalRefreshSettings = {
  mode: "incremental",
  timeField: "time",
  mergeKeyFields: ["time", "symbol"],
  overlapMs: 60_000,
  retentionMs: 5 * 60_000,
  dedupePolicy: "latest",
};

function request(from: string, to: string): ConnectionQueryRequest<Record<string, unknown>> {
  return {
    connectionId: "test-connection",
    query: {
      kind: "bars",
      symbol: "AAPL",
    },
    requestedOutputContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    timeRange: { from, to },
    maxRows: 1000,
  };
}

function frame(rows: Array<Record<string, unknown>>): TabularFrameSourceV1 {
  return {
    status: "ready",
    columns: ["time", "symbol", "value"],
    fields: [
      { key: "time", type: "datetime", provenance: "manual" },
      { key: "symbol", type: "string", provenance: "manual" },
      { key: "value", type: "number", provenance: "manual" },
    ],
    rows,
    source: {
      kind: "connection-query",
    },
  };
}

describe("incremental connection refresh", () => {
  beforeEach(() => {
    clearRetainedConnectionQueryResponses();
  });

  it("merges incremental rows by the configured merge-key columns", () => {
    const initialDecision = resolveConnectionQueryIncrementalDecision({
      fullRequest: request("2026-04-25T00:00:00.000Z", "2026-04-25T00:04:00.000Z"),
      settings,
      connectionTypeId: "test",
      queryModelId: "bars",
      scopeId: "widget-1",
      eligible: true,
    });
    const initial = mergeConnectionQueryIncrementalFrame({
      decision: initialDecision,
      settings,
      incomingFrame: frame([
        { time: "2026-04-25T00:01:00.000Z", symbol: "AAPL", value: 10 },
        { time: "2026-04-25T00:02:00.000Z", symbol: "AAPL", value: 20 },
      ]),
    });

    expect(initial.delta.mode).toBe("snapshot");
    expect(initial.frame.rows).toHaveLength(2);

    const deltaDecision = resolveConnectionQueryIncrementalDecision({
      fullRequest: request("2026-04-25T00:00:00.000Z", "2026-04-25T00:04:00.000Z"),
      settings,
      connectionTypeId: "test",
      queryModelId: "bars",
      scopeId: "widget-1",
      eligible: true,
    });
    const merged = mergeConnectionQueryIncrementalFrame({
      decision: deltaDecision,
      settings,
      incomingFrame: frame([
        { time: "2026-04-25T00:02:00.000Z", symbol: "AAPL", value: 22 },
        { time: "2026-04-25T00:03:00.000Z", symbol: "AAPL", value: 30 },
      ]),
    });

    expect(deltaDecision.reason).toBe("delta");
    expect(deltaDecision.request.timeRange?.from).toBe("2026-04-25T00:03:00.000Z");
    expect(merged.delta.mode).toBe("delta");
    expect(merged.delta.rowsAppended).toBe(1);
    expect(merged.delta.rowsReplaced).toBe(1);
    expect(merged.frame.rows).toEqual([
      { time: "2026-04-25T00:01:00.000Z", symbol: "AAPL", value: 10 },
      { time: "2026-04-25T00:02:00.000Z", symbol: "AAPL", value: 22 },
      { time: "2026-04-25T00:03:00.000Z", symbol: "AAPL", value: 30 },
    ]);
  });

  it("builds the next delta from the last request end instead of the observed data watermark", () => {
    const initialDecision = resolveConnectionQueryIncrementalDecision({
      fullRequest: request("2026-04-25T00:00:00.000Z", "2026-04-25T00:10:00.000Z"),
      settings,
      connectionTypeId: "test",
      queryModelId: "bars",
      scopeId: "widget-1",
      eligible: true,
    });

    mergeConnectionQueryIncrementalFrame({
      decision: initialDecision,
      settings,
      incomingFrame: frame([
        { time: "2026-04-25T00:02:00.000Z", symbol: "AAPL", value: 20 },
      ]),
    });

    const deltaDecision = resolveConnectionQueryIncrementalDecision({
      fullRequest: request("2026-04-25T00:05:00.000Z", "2026-04-25T00:15:00.000Z"),
      settings,
      connectionTypeId: "test",
      queryModelId: "bars",
      scopeId: "widget-1",
      eligible: true,
    });

    expect(deltaDecision.reason).toBe("delta");
    expect(deltaDecision.request.timeRange).toEqual({
      from: "2026-04-25T00:09:00.000Z",
      to: "2026-04-25T00:15:00.000Z",
    });
  });

  it("forced full snapshots replace the retained base and seed the next delta cursor", () => {
    const staleDecision = resolveConnectionQueryIncrementalDecision({
      fullRequest: request("2026-04-25T00:00:00.000Z", "2026-04-25T00:10:00.000Z"),
      settings,
      connectionTypeId: "test",
      queryModelId: "bars",
      scopeId: "widget-1",
      eligible: true,
    });

    mergeConnectionQueryIncrementalFrame({
      decision: staleDecision,
      settings,
      incomingFrame: frame([
        { time: "2026-04-25T00:01:00.000Z", symbol: "AAPL", value: 10 },
      ]),
    });

    const forcedDecision = resolveConnectionQueryIncrementalDecision({
      fullRequest: request("2026-04-25T00:10:00.000Z", "2026-04-25T00:20:00.000Z"),
      settings,
      connectionTypeId: "test",
      queryModelId: "bars",
      scopeId: "widget-1",
      eligible: true,
      forceFullSnapshot: true,
    });
    const forced = mergeConnectionQueryIncrementalFrame({
      decision: forcedDecision,
      settings,
      incomingFrame: frame([
        { time: "2026-04-25T00:15:00.000Z", symbol: "AAPL", value: 15 },
      ]),
    });

    expect(forcedDecision.reason).toBe("forced-full-refresh");
    expect(forcedDecision.request.timeRange).toEqual({
      from: "2026-04-25T00:10:00.000Z",
      to: "2026-04-25T00:20:00.000Z",
    });
    expect(forced.delta.mode).toBe("snapshot");
    expect(forced.frame.rows).toEqual([
      { time: "2026-04-25T00:15:00.000Z", symbol: "AAPL", value: 15 },
    ]);

    const nextDecision = resolveConnectionQueryIncrementalDecision({
      fullRequest: request("2026-04-25T00:15:00.000Z", "2026-04-25T00:25:00.000Z"),
      settings,
      connectionTypeId: "test",
      queryModelId: "bars",
      scopeId: "widget-1",
      eligible: true,
    });

    expect(nextDecision.reason).toBe("delta");
    expect(nextDecision.request.timeRange).toEqual({
      from: "2026-04-25T00:19:00.000Z",
      to: "2026-04-25T00:25:00.000Z",
    });
  });

  it("does not collapse rows that share time when identity columns differ", () => {
    const decision = resolveConnectionQueryIncrementalDecision({
      fullRequest: request("2026-04-25T00:00:00.000Z", "2026-04-25T00:01:00.000Z"),
      settings,
      connectionTypeId: "test",
      queryModelId: "bars",
      scopeId: "widget-1",
      eligible: true,
    });
    const merged = mergeConnectionQueryIncrementalFrame({
      decision,
      settings,
      incomingFrame: frame([
        { time: "2026-04-25T00:00:00.000Z", symbol: "AAPL", value: 10 },
        { time: "2026-04-25T00:00:00.000Z", symbol: "MSFT", value: 20 },
      ]),
    });

    expect(merged.frame.rows).toHaveLength(2);
  });

  it("prunes retained rows outside the retention window", () => {
    const initialDecision = resolveConnectionQueryIncrementalDecision({
      fullRequest: request("2026-04-25T00:00:00.000Z", "2026-04-25T00:05:00.000Z"),
      settings,
      connectionTypeId: "test",
      queryModelId: "bars",
      scopeId: "widget-1",
      eligible: true,
    });

    mergeConnectionQueryIncrementalFrame({
      decision: initialDecision,
      settings,
      incomingFrame: frame([
        { time: "2026-04-25T00:00:00.000Z", symbol: "AAPL", value: 10 },
        { time: "2026-04-25T00:04:00.000Z", symbol: "AAPL", value: 40 },
      ]),
    });

    const deltaDecision = resolveConnectionQueryIncrementalDecision({
      fullRequest: request("2026-04-25T00:02:00.000Z", "2026-04-25T00:07:00.000Z"),
      settings,
      connectionTypeId: "test",
      queryModelId: "bars",
      scopeId: "widget-1",
      eligible: true,
    });
    const merged = mergeConnectionQueryIncrementalFrame({
      decision: deltaDecision,
      settings,
      incomingFrame: frame([
        { time: "2026-04-25T00:05:00.000Z", symbol: "AAPL", value: 50 },
      ]),
    });

    expect(merged.frame.rows).toEqual([
      { time: "2026-04-25T00:04:00.000Z", symbol: "AAPL", value: 40 },
      { time: "2026-04-25T00:05:00.000Z", symbol: "AAPL", value: 50 },
    ]);
    expect(merged.delta.rowsPruned).toBe(1);
  });

  it("anchors retention to the latest observed row instead of the requested range end", () => {
    const decision = resolveConnectionQueryIncrementalDecision({
      fullRequest: request("2026-04-25T00:00:00.000Z", "2026-04-25T00:15:00.000Z"),
      settings,
      connectionTypeId: "test",
      queryModelId: "bars",
      scopeId: "widget-1",
      eligible: true,
    });
    const merged = mergeConnectionQueryIncrementalFrame({
      decision,
      settings,
      incomingFrame: frame([
        { time: "2026-04-25T00:00:30.000Z", symbol: "AAPL", value: 5 },
        { time: "2026-04-25T00:04:00.000Z", symbol: "AAPL", value: 40 },
        { time: "2026-04-25T00:06:00.000Z", symbol: "AAPL", value: 60 },
      ]),
    });

    expect(merged.frame.rows).toEqual([
      { time: "2026-04-25T00:04:00.000Z", symbol: "AAPL", value: 40 },
      { time: "2026-04-25T00:06:00.000Z", symbol: "AAPL", value: 60 },
    ]);
    expect(merged.delta.rowsRetained).toBe(2);
    expect(merged.delta.watermarkAfterMs).toBe(Date.parse("2026-04-25T00:06:00.000Z"));
  });

  it("accepts numeric timestamp strings for incremental merge fields", () => {
    const firstTime = Date.parse("2026-04-25T00:04:00.000Z");
    const secondTime = Date.parse("2026-04-25T00:05:00.000Z");
    const decision = resolveConnectionQueryIncrementalDecision({
      fullRequest: request("2026-04-25T00:00:00.000Z", "2026-04-25T00:15:00.000Z"),
      settings,
      connectionTypeId: "test",
      queryModelId: "bars",
      scopeId: "widget-1",
      eligible: true,
    });
    const merged = mergeConnectionQueryIncrementalFrame({
      decision,
      settings,
      incomingFrame: frame([
        { time: String(firstTime), symbol: "AAPL", value: 40 },
        { time: String(secondTime), symbol: "AAPL", value: 50 },
      ]),
    });

    expect(merged.frame.rows).toHaveLength(2);
    expect(merged.delta.watermarkAfterMs).toBe(secondTime);
  });

  it("rejects rows with an invalid configured time field", () => {
    const decision = resolveConnectionQueryIncrementalDecision({
      fullRequest: request("2026-04-25T00:00:00.000Z", "2026-04-25T00:01:00.000Z"),
      settings,
      connectionTypeId: "test",
      queryModelId: "bars",
      scopeId: "widget-1",
      eligible: true,
    });

    expect(() =>
      mergeConnectionQueryIncrementalFrame({
        decision,
        settings,
        incomingFrame: frame([{ time: "not-a-date", symbol: "AAPL", value: 10 }]),
      }),
    ).toThrow(/time field/);
  });

  it("surfaces merge-key collisions when the policy is error", () => {
    const collisionSettings: ConnectionQueryIncrementalRefreshSettings = {
      ...settings,
      mergeKeyFields: ["time"],
      dedupePolicy: "error",
    };
    const initialDecision = resolveConnectionQueryIncrementalDecision({
      fullRequest: request("2026-04-25T00:00:00.000Z", "2026-04-25T00:03:00.000Z"),
      settings: collisionSettings,
      connectionTypeId: "test",
      queryModelId: "bars",
      scopeId: "widget-1",
      eligible: true,
    });

    mergeConnectionQueryIncrementalFrame({
      decision: initialDecision,
      settings: collisionSettings,
      incomingFrame: frame([{ time: "2026-04-25T00:01:00.000Z", symbol: "AAPL", value: 10 }]),
    });

    const deltaDecision = resolveConnectionQueryIncrementalDecision({
      fullRequest: request("2026-04-25T00:00:00.000Z", "2026-04-25T00:03:00.000Z"),
      settings: collisionSettings,
      connectionTypeId: "test",
      queryModelId: "bars",
      scopeId: "widget-1",
      eligible: true,
    });

    expect(() =>
      mergeConnectionQueryIncrementalFrame({
        decision: deltaDecision,
        settings: collisionSettings,
        incomingFrame: frame([{ time: "2026-04-25T00:01:00.000Z", symbol: "MSFT", value: 20 }]),
      }),
    ).toThrow(/duplicate merge key/);
  });

  it("resets to a full snapshot when merge settings change", () => {
    const initialDecision = resolveConnectionQueryIncrementalDecision({
      fullRequest: request("2026-04-25T00:00:00.000Z", "2026-04-25T00:02:00.000Z"),
      settings,
      connectionTypeId: "test",
      queryModelId: "bars",
      scopeId: "widget-1",
      eligible: true,
    });

    mergeConnectionQueryIncrementalFrame({
      decision: initialDecision,
      settings,
      incomingFrame: frame([{ time: "2026-04-25T00:01:00.000Z", symbol: "AAPL", value: 10 }]),
    });

    const resetDecision = resolveConnectionQueryIncrementalDecision({
      fullRequest: request("2026-04-25T00:00:00.000Z", "2026-04-25T00:03:00.000Z"),
      settings: {
        ...settings,
        mergeKeyFields: ["time"],
      },
      connectionTypeId: "test",
      queryModelId: "bars",
      scopeId: "widget-1",
      eligible: true,
    });

    expect(resetDecision.reason).toBe("initial-snapshot");
  });

  it("dedupes identical in-flight incremental requests", async () => {
    const decision = resolveConnectionQueryIncrementalDecision({
      fullRequest: request("2026-04-25T00:00:00.000Z", "2026-04-25T00:02:00.000Z"),
      settings,
      connectionTypeId: "test",
      queryModelId: "bars",
      scopeId: "widget-1",
      eligible: true,
    });
    let calls = 0;
    const run = () => {
      calls += 1;
      return Promise.resolve({ ok: true });
    };

    const [first, second] = await Promise.all([
      runConnectionQueryWithInFlightDedupe(decision, run),
      runConnectionQueryWithInFlightDedupe(decision, run),
    ]);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(calls).toBe(1);
  });
});
