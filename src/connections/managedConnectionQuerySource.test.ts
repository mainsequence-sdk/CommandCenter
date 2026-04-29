import { describe, expect, it } from "vitest";

import {
  buildConnectionQuerySourceIdentityLabel,
  resolveConnectionQueryRuntimeSummary,
  resolveManagedConnectionQuerySource,
} from "@/connections/managedConnectionQuerySource";

describe("managed connection query source helpers", () => {
  it("resolves the owner-managed connection source and preserves incremental props", () => {
    const managedSource = resolveManagedConnectionQuerySource(
      [
        {
          id: "graph-source-1",
          widgetId: "connection-query",
          title: "CPU source",
          managedBy: {
            ownerInstanceId: "graph-1",
            role: "embedded-connection-source",
          },
          props: {
            connectionRef: {
              id: 42,
              typeId: "prometheus",
            },
            queryModelId: "promql-range",
            query: {
              kind: "promql-range",
              expr: "rate(node_cpu_seconds_total[5m])",
            },
            incrementalRefreshMode: "incremental",
            incrementalTimeField: "timestamp",
            incrementalMergeKeyFields: ["timestamp", "cpu"],
            incrementalOverlapMs: 30_000,
            incrementalRetentionMs: 900_000,
            incrementalDedupePolicy: "latest",
          },
        },
      ],
      "graph-1",
    );

    expect(managedSource).not.toBeNull();
    expect(managedSource?.props.incrementalRefreshMode).toBe("incremental");
    expect(managedSource?.props.incrementalTimeField).toBe("timestamp");
    expect(managedSource?.props.incrementalMergeKeyFields).toEqual(["timestamp", "cpu"]);
    expect(managedSource?.props.incrementalOverlapMs).toBe(30_000);
    expect(managedSource?.props.incrementalRetentionMs).toBe(900_000);
    expect(managedSource?.props.incrementalDedupePolicy).toBe("latest");
    expect(buildConnectionQuerySourceIdentityLabel(managedSource?.props ?? {})).toBe(
      "prometheus / 42 / promql-range",
    );
  });

  it("resolves owner-managed stream sources and preserves stream props", () => {
    const managedSource = resolveManagedConnectionQuerySource(
      [
        {
          id: "graph-stream-source-1",
          widgetId: "connection-stream-query",
          title: "Ticker source",
          managedBy: {
            ownerInstanceId: "graph-1",
            role: "embedded-connection-source",
          },
          props: {
            connectionRef: {
              id: 99,
              typeId: "binance",
            },
            queryModelId: "ticker-stream",
            query: {
              kind: "ticker",
            },
            mergeKeyFields: ["symbol"],
            retentionMaxRows: 500,
          },
        },
      ],
      "graph-1",
    );

    expect(managedSource).not.toBeNull();
    expect(managedSource?.props.mergeKeyFields).toEqual(["symbol"]);
    expect(managedSource?.props.retentionMaxRows).toBe(500);
    expect(buildConnectionQuerySourceIdentityLabel(managedSource?.props ?? {})).toBe(
      "binance / 99 / ticker-stream",
    );
  });

  it("summarizes runtime error states for owner settings surfaces", () => {
    expect(
      resolveConnectionQueryRuntimeSummary({
        status: "error",
        error: "Prometheus returned 422 for the current query.",
        columns: [],
        rows: [],
      }),
    ).toEqual({
      status: "error",
      tone: "danger",
      title: "Runtime error",
      description: "Prometheus returned 422 for the current query.",
    });
  });

  it("summarizes ready tabular runtime frames", () => {
    expect(
      resolveConnectionQueryRuntimeSummary({
        status: "ready",
        columns: ["timestamp", "value"],
        rows: [
          { timestamp: "2026-01-01T00:00:00Z", value: 1 },
          { timestamp: "2026-01-01T00:01:00Z", value: 2 },
        ],
      }),
    ).toEqual({
      status: "ready",
      tone: "success",
      title: "Ready",
      description: "2 rows across 2 columns.",
    });
  });
});
