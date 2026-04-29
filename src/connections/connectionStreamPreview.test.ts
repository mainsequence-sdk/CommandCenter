import { describe, expect, it } from "vitest";

import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";
import { attachWidgetRuntimeUpdateContext } from "@/widgets/shared/runtime-update";
import type { ConnectionStreamQueryRuntimeState } from "@/widgets/core/connection-stream-query/connectionStreamQueryModel";

import {
  buildConnectionStreamPreviewState,
  resolveStreamPreviewGraphDefaults,
} from "./connectionStreamPreview";
import type { ConnectionQueryModel } from "./types";

function createQueryModel(
  preview: ConnectionQueryModel["preview"],
): ConnectionQueryModel {
  return {
    id: "test-stream",
    label: "Test stream",
    outputContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
    stream: {
      transport: "websocket",
      modes: ["snapshot", "delta"],
      defaultMode: "snapshot",
    },
    preview,
  };
}

function createRuntimeFrame(input: {
  rows: Array<Record<string, unknown>>;
  columns?: string[];
  fields?: ConnectionStreamQueryRuntimeState["fields"];
  status?: ConnectionStreamQueryRuntimeState["status"];
  streamStatus?: ConnectionStreamQueryRuntimeState["streamStatus"];
  graphDefaults?: Record<string, unknown>;
}) {
  const base = {
    status: input.status ?? "ready",
    streamStatus: input.streamStatus ?? "live",
    columns: input.columns ?? Object.keys(input.rows[0] ?? {}),
    rows: input.rows,
    fields:
      input.fields ??
      (input.columns ?? Object.keys(input.rows[0] ?? {})).map((key) => ({
        key,
        type: key.toLowerCase().includes("time") ? "datetime" : "number",
      })),
    source: {
      kind: "connection-stream-query",
      context: input.graphDefaults
        ? {
            graphDefaults: input.graphDefaults,
          }
        : {},
    },
  } satisfies ConnectionStreamQueryRuntimeState;

  return base;
}

describe("connection stream preview accumulation", () => {
  it("accumulates snapshot history with row-identity upserts", () => {
    const queryModel = createQueryModel({
      graph: {
        xField: "openTime",
        yField: "close",
        groupField: "symbol",
        rowIdentityFields: ["openTime", "symbol", "interval", "marketType"],
      },
    });
    const firstRuntimeFrame = attachWidgetRuntimeUpdateContext(
      createRuntimeFrame({
        rows: [
          {
            openTime: "2026-04-29T10:00:00Z",
            close: 100,
            symbol: "BTCUSDT",
            interval: "1m",
            marketType: "spot",
          },
        ],
      }),
      {
        contractVersion: "widget-runtime-update@v1",
        mode: "snapshot",
      },
    );
    const firstPreview = buildConnectionStreamPreviewState({
      runtimeFrame: firstRuntimeFrame,
      queryModel,
    });
    const nextRuntimeFrame = attachWidgetRuntimeUpdateContext(
      createRuntimeFrame({
        rows: [
          {
            openTime: "2026-04-29T10:01:00Z",
            close: 101,
            symbol: "BTCUSDT",
            interval: "1m",
            marketType: "spot",
          },
        ],
      }),
      {
        contractVersion: "widget-runtime-update@v1",
        mode: "snapshot",
      },
    );

    const nextPreview = buildConnectionStreamPreviewState({
      retainedPreviewState: firstPreview,
      runtimeFrame: nextRuntimeFrame,
      queryModel,
    });

    expect(nextPreview.accumulationMode).toBe("snapshot-upsert");
    expect(nextPreview.frame.rows).toEqual([
      {
        openTime: "2026-04-29T10:00:00Z",
        close: 100,
        symbol: "BTCUSDT",
        interval: "1m",
        marketType: "spot",
      },
      {
        openTime: "2026-04-29T10:01:00Z",
        close: 101,
        symbol: "BTCUSDT",
        interval: "1m",
        marketType: "spot",
      },
    ]);
    expect(nextPreview.lastPlottedAtMs).toBe(Date.parse("2026-04-29T10:01:00Z"));
    expect(resolveStreamPreviewGraphDefaults({
      frame: nextPreview.frame,
      queryModel,
    })).toMatchObject({
      xField: "openTime",
      yField: "close",
      groupField: "symbol",
    });
  });

  it("appends delta rows from the delta payload instead of duplicating the retained frame", () => {
    const queryModel = createQueryModel({
      graph: {
        xField: "time",
        yField: "price",
      },
    });
    const retainedPreview = buildConnectionStreamPreviewState({
      runtimeFrame: attachWidgetRuntimeUpdateContext(
        createRuntimeFrame({
          rows: [
            { time: "2026-04-29T10:00:00Z", price: 100 },
          ],
        }),
        {
          contractVersion: "widget-runtime-update@v1",
          mode: "snapshot",
        },
      ),
      queryModel,
    });
    const deltaRuntimeFrame = attachWidgetRuntimeUpdateContext(
      createRuntimeFrame({
        rows: [
          { time: "2026-04-29T10:00:00Z", price: 100 },
          { time: "2026-04-29T10:00:01Z", price: 101 },
        ],
      }),
      {
        contractVersion: "widget-runtime-update@v1",
        mode: "delta",
        deltaOutput: createRuntimeFrame({
          rows: [
            { time: "2026-04-29T10:00:01Z", price: 101 },
          ],
        }),
      },
    );

    const nextPreview = buildConnectionStreamPreviewState({
      retainedPreviewState: retainedPreview,
      runtimeFrame: deltaRuntimeFrame,
      queryModel,
    });

    expect(nextPreview.accumulationMode).toBe("delta-append");
    expect(nextPreview.frame.rows).toEqual([
      { time: "2026-04-29T10:00:00Z", price: 100 },
      { time: "2026-04-29T10:00:01Z", price: 101 },
    ]);
  });

  it("trims retained preview rows to the configured cap", () => {
    const queryModel = createQueryModel({
      graph: {
        xField: "time",
        yField: "price",
        rowIdentityFields: ["time"],
        maxRetainedRows: 2,
      },
    });
    const retainedPreview = buildConnectionStreamPreviewState({
      runtimeFrame: attachWidgetRuntimeUpdateContext(
        createRuntimeFrame({
          rows: [
            { time: "2026-04-29T10:00:00Z", price: 100 },
            { time: "2026-04-29T10:00:01Z", price: 101 },
          ],
        }),
        {
          contractVersion: "widget-runtime-update@v1",
          mode: "snapshot",
        },
      ),
      queryModel,
    });

    const nextPreview = buildConnectionStreamPreviewState({
      retainedPreviewState: retainedPreview,
      runtimeFrame: attachWidgetRuntimeUpdateContext(
        createRuntimeFrame({
          rows: [
            { time: "2026-04-29T10:00:02Z", price: 102 },
          ],
        }),
        {
          contractVersion: "widget-runtime-update@v1",
          mode: "snapshot",
        },
      ),
      queryModel,
    });

    expect(nextPreview.maxRetainedRows).toBe(2);
    expect(nextPreview.frame.rows).toEqual([
      { time: "2026-04-29T10:00:01Z", price: 101 },
      { time: "2026-04-29T10:00:02Z", price: 102 },
    ]);
  });

  it("resets accumulation when the runtime schema changes", () => {
    const queryModel = createQueryModel({
      graph: {
        xField: "time",
        yField: "price",
        rowIdentityFields: ["time"],
      },
    });
    const retainedPreview = buildConnectionStreamPreviewState({
      runtimeFrame: attachWidgetRuntimeUpdateContext(
        createRuntimeFrame({
          rows: [{ time: "2026-04-29T10:00:00Z", price: 100 }],
        }),
        {
          contractVersion: "widget-runtime-update@v1",
          mode: "snapshot",
        },
      ),
      queryModel,
    });

    const nextPreview = buildConnectionStreamPreviewState({
      retainedPreviewState: retainedPreview,
      runtimeFrame: attachWidgetRuntimeUpdateContext(
        createRuntimeFrame({
          rows: [{ time: "2026-04-29T10:00:01Z", quantity: 5 }],
          columns: ["time", "quantity"],
          fields: [
            { key: "time", type: "datetime" },
            { key: "quantity", type: "number" },
          ],
        }),
        {
          contractVersion: "widget-runtime-update@v1",
          mode: "snapshot",
        },
      ),
      queryModel,
    });

    expect(nextPreview.accumulationMode).toBe("live-frame");
    expect(nextPreview.frame.rows).toEqual([
      { time: "2026-04-29T10:00:01Z", quantity: 5 },
    ]);
  });

  it("keeps retained preview rows visible while the stream reconnects", () => {
    const queryModel = createQueryModel({
      graph: {
        xField: "time",
        yField: "price",
      },
    });
    const retainedPreview = buildConnectionStreamPreviewState({
      runtimeFrame: attachWidgetRuntimeUpdateContext(
        createRuntimeFrame({
          rows: [{ time: "2026-04-29T10:00:00Z", price: 100 }],
        }),
        {
          contractVersion: "widget-runtime-update@v1",
          mode: "snapshot",
        },
      ),
      queryModel,
    });

    const reconnectingPreview = buildConnectionStreamPreviewState({
      retainedPreviewState: retainedPreview,
      runtimeFrame: createRuntimeFrame({
        rows: [],
        status: "loading",
        streamStatus: "reconnecting",
      }),
      queryModel,
    });

    expect(reconnectingPreview.frame.rows).toEqual([
      { time: "2026-04-29T10:00:00Z", price: 100 },
    ]);
    expect(reconnectingPreview.frame.streamStatus).toBe("reconnecting");
  });
});
