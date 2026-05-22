import { describe, expect, it } from "vitest";

import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";
import {
  TABULAR_LIVE_UPDATES_INPUT_ID,
  TABULAR_SEED_INPUT_ID,
  TABULAR_UPDATES_OUTPUT_ID,
} from "@/widgets/shared/incremental-tabular-consumer";
import {
  readWidgetRuntimeUpdateContext,
  WIDGET_RUNTIME_UPDATE_CONTRACT_VERSION,
} from "@/widgets/shared/runtime-update";
import { createRuntimeDataStore } from "@/widgets/shared/runtime-data-store";

import {
  resolveTabularTransformChannelOutput,
  resolveTabularTransformOutput,
  resolveTabularTransformSourceConsumerState,
  TABULAR_TRANSFORM_SINGLE_SOURCE_ERROR,
  type TabularTransformWidgetProps,
} from "./tabularTransformModel";

function frame(
  rows: Array<Record<string, unknown>>,
  fields: TabularFrameSourceV1["fields"] = [
    { key: "__name__", type: "string", provenance: "manual" },
    { key: "queue_name", type: "string", provenance: "manual" },
    { key: "value", type: "number", provenance: "manual" },
    { key: "time", type: "datetime", provenance: "manual" },
  ],
): TabularFrameSourceV1 {
  return {
    status: "ready",
    columns: fields.map((field) => field.key),
    fields,
    rows,
    source: {
      kind: "connection-query",
    },
  };
}

function resolvedInputs(
  source: TabularFrameSourceV1,
  extra?: Record<string, unknown>,
) {
  return {
    sourceData: {
      inputId: "sourceData",
      label: "Source data",
      status: "valid",
      sourceWidgetId: "source-widget",
      sourceOutputId: "dataset",
      contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      value: source,
      ...extra,
    },
  } as const;
}

describe("tabular transform filter mode", () => {
  it("filters rows by exact scalar equality", () => {
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "filter",
        filterRules: [{ field: "__name__", operator: "equals", value: "sent" }],
      } satisfies TabularTransformWidgetProps,
      resolvedInputs: resolvedInputs(
        frame([
          { __name__: "sent", queue_name: "celery", value: 1, time: "2026-04-28T10:00:00.000Z" },
          { __name__: "failed", queue_name: "celery", value: 2, time: "2026-04-28T10:01:00.000Z" },
        ]),
      ),
    });

    expect(output.status).toBe("ready");
    expect(output.rows).toEqual([
      { __name__: "sent", queue_name: "celery", value: 1, time: "2026-04-28T10:00:00.000Z" },
    ]);
  });

  it("keeps an empty ready frame when no rows match", () => {
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "filter",
        filterRules: [{ field: "queue_name", operator: "equals", value: "tdag" }],
      } satisfies TabularTransformWidgetProps,
      resolvedInputs: resolvedInputs(
        frame([
          { __name__: "sent", queue_name: "celery", value: 1, time: "2026-04-28T10:00:00.000Z" },
        ]),
      ),
    });

    expect(output.status).toBe("ready");
    expect(output.rows).toEqual([]);
    expect(output.columns).toEqual(["__name__", "queue_name", "value", "time"]);
    expect(output.fields?.map((field) => field.key)).toEqual(["__name__", "queue_name", "value", "time"]);
  });

  it("transforms an idle upstream frame when the frame still carries rows", () => {
    const idleSource = {
      ...frame([
        { __name__: "sent", queue_name: "celery", value: 1, time: "2026-04-28T10:00:00.000Z" },
      ]),
      status: "idle",
    } satisfies TabularFrameSourceV1;
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "filter",
        filterRules: [{ field: "__name__", operator: "equals", value: "sent" }],
      } satisfies TabularTransformWidgetProps,
      resolvedInputs: resolvedInputs(idleSource),
    });

    expect(output.status).toBe("ready");
    expect(output.rows).toEqual([
      { __name__: "sent", queue_name: "celery", value: 1, time: "2026-04-28T10:00:00.000Z" },
    ]);
  });

  it("filters rows by set membership", () => {
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "filter",
        filterRules: [{ field: "__name__", operator: "in", value: ["sent", "failed"] }],
      } satisfies TabularTransformWidgetProps,
      resolvedInputs: resolvedInputs(
        frame([
          { __name__: "sent", queue_name: "celery", value: 1, time: "2026-04-28T10:00:00.000Z" },
          { __name__: "failed", queue_name: "celery", value: 2, time: "2026-04-28T10:01:00.000Z" },
          { __name__: "received", queue_name: "celery", value: 3, time: "2026-04-28T10:02:00.000Z" },
        ]),
      ),
    });

    expect(output.status).toBe("ready");
    expect(output.rows).toHaveLength(2);
    expect(output.rows.map((row) => row.__name__)).toEqual(["sent", "failed"]);
  });

  it("supports lightweight numeric comparison and preserves filtered delta publication", () => {
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "filter",
        filterRules: [{ field: "value", operator: "gte", value: 10 }],
      } satisfies TabularTransformWidgetProps,
      resolvedInputs: resolvedInputs(
        frame([
          { __name__: "sent", queue_name: "celery", value: 5, time: "2026-04-28T10:00:00.000Z" },
          { __name__: "sent", queue_name: "celery", value: 10, time: "2026-04-28T10:01:00.000Z" },
          { __name__: "sent", queue_name: "celery", value: 15, time: "2026-04-28T10:02:00.000Z" },
        ]),
        {
          upstreamBase: frame([
            { __name__: "sent", queue_name: "celery", value: 5, time: "2026-04-28T10:00:00.000Z" },
            { __name__: "sent", queue_name: "celery", value: 10, time: "2026-04-28T10:01:00.000Z" },
            { __name__: "sent", queue_name: "celery", value: 15, time: "2026-04-28T10:02:00.000Z" },
          ]),
          upstreamDelta: frame([
            { __name__: "sent", queue_name: "celery", value: 8, time: "2026-04-28T10:03:00.000Z" },
            { __name__: "sent", queue_name: "celery", value: 12, time: "2026-04-28T10:04:00.000Z" },
          ]),
          upstreamUpdate: {
            contractVersion: "widget-runtime-update@v1",
            mode: "delta",
            sourceWidgetId: "source-widget",
            sourceOutputId: "dataset",
            outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
            retainedOutputLocation: "carrier",
          },
        },
      ),
    });

    expect(output.status).toBe("ready");
    expect(output.rows.map((row) => row.value)).toEqual([10, 15]);

    const update = readWidgetRuntimeUpdateContext(output);
    expect(update?.mode).toBe("delta");
    const deltaOutput = update?.deltaOutput as TabularFrameSourceV1 | undefined;
    expect(deltaOutput?.rows).toEqual([
      { __name__: "sent", queue_name: "celery", value: 12, time: "2026-04-28T10:04:00.000Z" },
    ]);
  });

  it("does not preserve upstream refs when the filtered carrier no longer matches the source frame", () => {
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "filter",
        filterRules: [{ field: "__name__", operator: "equals", value: "failed" }],
      } satisfies TabularTransformWidgetProps,
      resolvedInputs: resolvedInputs(
        frame([
          { __name__: "sent", queue_name: "celery", value: 1, time: "2026-04-28T10:00:00.000Z" },
        ]),
        {
          upstreamBase: frame([
            { __name__: "sent", queue_name: "celery", value: 1, time: "2026-04-28T10:00:00.000Z" },
          ]),
          upstreamUpdate: {
            contractVersion: "widget-runtime-update@v1",
            mode: "snapshot",
            sourceWidgetId: "source-widget",
            sourceOutputId: "dataset",
            outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
            retainedOutputLocation: "carrier",
            retainedOutputRef: {
              kind: "runtime-data-ref",
              refId: "source-widget:dataset",
              workspaceRuntimeId: "workspace-1",
              ownerId: "source-widget",
              outputId: "dataset",
              contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
              version: 1,
              rowCount: 1,
              schemaSignature: "sig-1",
              updatedAtMs: 123,
            },
            outputRef: {
              kind: "runtime-data-ref",
              refId: "source-widget:dataset",
              workspaceRuntimeId: "workspace-1",
              ownerId: "source-widget",
              outputId: "dataset",
              contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
              version: 1,
              rowCount: 1,
              schemaSignature: "sig-1",
              updatedAtMs: 123,
            },
          },
        },
      ),
    });

    expect(output.status).toBe("ready");
    expect(output.rows).toEqual([]);

    const update = readWidgetRuntimeUpdateContext(output);
    expect(update?.outputRef).toBeUndefined();
    expect(update?.retainedOutputRef).toBeUndefined();
  });

  it("returns a configuration error when filter mode has no valid rules", () => {
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "filter",
      } satisfies TabularTransformWidgetProps,
      resolvedInputs: resolvedInputs(
        frame([
          { __name__: "sent", queue_name: "celery", value: 1, time: "2026-04-28T10:00:00.000Z" },
        ]),
      ),
    });

    expect(output.status).toBe("error");
    expect(output.error).toContain("Add at least one filter rule");
  });

  it("returns a configuration error when a filter field is not present in the source dataset", () => {
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "filter",
        filterRules: [{ field: "__name__", operator: "equals", value: "sent" }],
      } satisfies TabularTransformWidgetProps,
      resolvedInputs: resolvedInputs(
        frame(
          [{ queue_name: "celery", value: 1, time: "2026-04-28T10:00:00.000Z" }],
          [
            { key: "queue_name", type: "string", provenance: "manual" },
            { key: "value", type: "number", provenance: "manual" },
            { key: "time", type: "datetime", provenance: "manual" },
          ],
        ),
      ),
    });

    expect(output.status).toBe("error");
    expect(output.error).toContain('references "__name__"');
  });

  it("returns a configuration error when a typed comparison value is invalid", () => {
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "filter",
        filterRules: [{ field: "value", operator: "gte", value: "abc" }],
      } satisfies TabularTransformWidgetProps,
      resolvedInputs: resolvedInputs(
        frame([
          { __name__: "sent", queue_name: "celery", value: 1, time: "2026-04-28T10:00:00.000Z" },
        ]),
      ),
    });

    expect(output.status).toBe("error");
    expect(output.error).toContain("Filter rule 1");
  });

  it("authors computed columns in the transform widget and projects them downstream", () => {
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "none",
        computedColumns: [
          {
            key: "one_day_return",
            label: "1D",
            type: "number",
            formulaExpression: "PERCENT_CHANGE([last_price], [previous_close])",
          },
        ],
        projectFields: ["symbol", "one_day_return"],
      } satisfies TabularTransformWidgetProps,
      resolvedInputs: resolvedInputs(
        frame(
          [
            { symbol: "BTCUSDT", last_price: 110, previous_close: 100 },
            { symbol: "ETHUSDT", last_price: 95, previous_close: 100 },
          ],
          [
            { key: "symbol", type: "string", provenance: "manual" },
            { key: "last_price", type: "number", provenance: "manual" },
            { key: "previous_close", type: "number", provenance: "manual" },
          ],
        ),
      ),
    });

    expect(output.status).toBe("ready");
    expect(output.columns).toEqual(["symbol", "one_day_return"]);
    expect(output.rows).toEqual([
      { symbol: "BTCUSDT", one_day_return: 10 },
      { symbol: "ETHUSDT", one_day_return: -5 },
    ]);
    expect(output.meta).toBeUndefined();
    expect(output.fields?.find((field) => field.key === "one_day_return")).toMatchObject({
      provenance: "derived",
      derivedFrom: ["last_price", "previous_close"],
    });
  });

  it("publishes computed columns into transformed deltas when the transform can stream row deltas", () => {
    const baseFrame = frame(
      [{ symbol: "BTCUSDT", last_price: 110, previous_close: 100 }],
      [
        { key: "symbol", type: "string", provenance: "manual" },
        { key: "last_price", type: "number", provenance: "manual" },
        { key: "previous_close", type: "number", provenance: "manual" },
      ],
    );
    const deltaFrame = frame(
      [{ symbol: "ETHUSDT", last_price: 95, previous_close: 100 }],
      [
        { key: "symbol", type: "string", provenance: "manual" },
        { key: "last_price", type: "number", provenance: "manual" },
        { key: "previous_close", type: "number", provenance: "manual" },
      ],
    );
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "filter",
        filterRules: [{ field: "symbol", operator: "not-equals", value: "ignore-me" }],
        computedColumns: [
          {
            key: "one_day_return",
            type: "number",
            formulaExpression: "PERCENT_CHANGE([last_price], [previous_close])",
          },
        ],
      } satisfies TabularTransformWidgetProps,
      resolvedInputs: resolvedInputs(baseFrame, {
        upstreamBase: baseFrame,
        upstreamDelta: deltaFrame,
        upstreamUpdate: {
          contractVersion: "widget-runtime-update@v1",
          mode: "delta",
          sourceWidgetId: "source-widget",
          sourceOutputId: "dataset",
          outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          retainedOutputLocation: "carrier",
        },
      }),
    });

    expect(output.status).toBe("ready");
    const update = readWidgetRuntimeUpdateContext(output);
    const deltaOutput = update?.deltaOutput as TabularFrameSourceV1 | undefined;
    expect(deltaOutput?.rows).toEqual([
      { symbol: "ETHUSDT", last_price: 95, previous_close: 100, one_day_return: -5 },
    ]);
    expect(deltaOutput?.meta).toBeUndefined();
  });

  it("treats live delta publications as source data when no retained base frame is present", () => {
    const deltaFrame = frame(
      [{ symbol: "ETHUSDT", close: 2136.36 }],
      [
        { key: "symbol", type: "string", provenance: "backend" },
        { key: "close", type: "number", provenance: "backend" },
      ],
    );
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "none",
        computedColumns: [
          {
            key: "last",
            label: "Last",
            type: "number",
            formulaExpression: "[close]",
          },
        ],
        projectFields: ["symbol", "last"],
      } satisfies TabularTransformWidgetProps,
      resolvedInputs: {
        [TABULAR_LIVE_UPDATES_INPUT_ID]: {
          inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
          label: "Live updates",
          status: "valid",
          sourceWidgetId: "stream-1",
          sourceOutputId: TABULAR_UPDATES_OUTPUT_ID,
          contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          upstreamDelta: deltaFrame,
          upstreamUpdate: {
            contractVersion: WIDGET_RUNTIME_UPDATE_CONTRACT_VERSION,
            mode: "delta",
            sourceWidgetId: "stream-1",
            sourceOutputId: TABULAR_UPDATES_OUTPUT_ID,
            outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
            retainedOutputLocation: "carrier",
          },
        },
      },
    });

    expect(output.status).toBe("ready");
    expect(output.columns).toEqual(["symbol", "last"]);
    expect(output.rows).toEqual([{ symbol: "ETHUSDT", last: 2136.36 }]);
    expect(output.source?.context?.statusProvenance).toMatchObject({
      liveBound: true,
      seedBound: false,
    });
  });

  it("keeps the last published transform output ready during valid live-input lifecycle gaps", () => {
    const runtimeFrame = frame(
      [{ symbol: "ETHUSDT", last: 2136.36 }],
      [
        { key: "symbol", type: "string", provenance: "backend" },
        { key: "last", type: "number", provenance: "derived" },
      ],
    );
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "none",
        computedColumns: [
          {
            key: "last",
            label: "Last",
            type: "number",
            formulaExpression: "[close]",
          },
        ],
        projectFields: ["symbol", "last"],
      } satisfies TabularTransformWidgetProps,
      runtimeState: runtimeFrame,
      resolvedInputs: {
        [TABULAR_LIVE_UPDATES_INPUT_ID]: {
          inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
          label: "Live updates",
          status: "valid",
          sourceWidgetId: "stream-1",
          sourceOutputId: TABULAR_UPDATES_OUTPUT_ID,
          contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        },
      },
    });

    expect(output.status).toBe("ready");
    expect(output.rows).toEqual([{ symbol: "ETHUSDT", last: 2136.36 }]);
    expect(output.source?.context?.statusProvenance).toMatchObject({
      liveBound: true,
      seedBound: false,
    });
  });

  it("materializes retained stream rows from runtime refs before projection", () => {
    const store = createRuntimeDataStore("tabular-transform-test");
    const retainedFrame = frame(
      [{ symbol: "ETHUSDT", close: 2136.36 }],
      [
        { key: "symbol", type: "string", provenance: "backend" },
        { key: "close", type: "number", provenance: "backend" },
      ],
    );
    const retainedRef = store.putSnapshot({
      ownerId: "stream-1",
      outputId: "updates",
      frame: retainedFrame,
    });
    const carrierFrame = {
      ...retainedFrame,
      rows: [],
    };
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "none",
        computedColumns: [
          {
            key: "last",
            label: "Last",
            type: "number",
            formulaExpression: "[close]",
          },
        ],
        projectFields: ["symbol", "last"],
      } satisfies TabularTransformWidgetProps,
      runtimeDataStore: store,
      resolvedInputs: resolvedInputs(carrierFrame, {
        upstreamBaseRef: retainedRef,
        upstreamUpdate: {
          contractVersion: "widget-runtime-update@v1",
          mode: "snapshot",
          sourceWidgetId: "stream-1",
          sourceOutputId: "updates",
          outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          retainedOutputLocation: "carrier",
          outputRef: retainedRef,
        },
      }),
    });

    expect(output.status).toBe("ready");
    expect(output.columns).toEqual(["symbol", "last"]);
    expect(output.rows).toEqual([{ symbol: "ETHUSDT", last: 2136.36 }]);
  });

  it("computes numeric columns from numeric string row values even when the source field is not declared", () => {
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "none",
        computedColumns: [
          {
            key: "last",
            label: "Last",
            type: "number",
            formulaExpression: "[close]",
          },
        ],
        projectFields: ["symbol", "last"],
      } satisfies TabularTransformWidgetProps,
      resolvedInputs: resolvedInputs({
        status: "ready",
        columns: ["symbol"],
        fields: [{ key: "symbol", type: "string", provenance: "backend" }],
        rows: [
          { symbol: "ETHUSDT", close: "2136.36" },
          { symbol: "BTCUSDT", close: "109420.5" },
        ],
      }),
    });

    expect(output.status).toBe("ready");
    expect(output.columns).toEqual(["symbol", "last"]);
    expect(output.rows).toEqual([
      { symbol: "ETHUSDT", last: 2136.36 },
      { symbol: "BTCUSDT", last: 109420.5 },
    ]);
  });

  it("keeps passthrough mode as the default non-merge behavior", () => {
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "none",
        computedColumns: [
          {
            key: "last",
            label: "Last",
            type: "number",
            formulaExpression: "[close]",
          },
        ],
        projectFields: ["symbol", "last"],
      } satisfies TabularTransformWidgetProps,
      resolvedInputs: resolvedInputs(
        frame(
          [
            { symbol: "ETHUSDT", close: 2136 },
            { symbol: "ETHUSDT", close: 2137 },
          ],
          [
            { key: "symbol", type: "string", provenance: "manual" },
            { key: "close", type: "number", provenance: "manual" },
          ],
        ),
      ),
    });

    expect(output.status).toBe("ready");
    expect(output.rows).toEqual([
      { symbol: "ETHUSDT", last: 2136 },
      { symbol: "ETHUSDT", last: 2137 },
    ]);
  });

  it("normalizes legacy append row merge mode to passthrough behavior", () => {
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "none",
        rowMergeMode: "append",
      } as unknown as TabularTransformWidgetProps,
      resolvedInputs: resolvedInputs(
        frame(
          [
            { symbol: "ETHUSDT", last: 2136 },
            { symbol: "ETHUSDT", last: 2137 },
          ],
          [
            { key: "symbol", type: "string", provenance: "manual" },
            { key: "last", type: "number", provenance: "manual" },
          ],
        ),
      ),
    });

    expect(output.status).toBe("ready");
    expect(output.rows).toEqual([
      { symbol: "ETHUSDT", last: 2136 },
      { symbol: "ETHUSDT", last: 2137 },
    ]);
  });

  it("collapses transformed rows to the latest row per configured key", () => {
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "none",
        computedColumns: [
          {
            key: "last",
            label: "Last",
            type: "number",
            formulaExpression: "[close]",
          },
        ],
        projectFields: ["symbol", "last"],
        rowMergeMode: "latest",
        rowMergeKeyFields: ["symbol"],
      } satisfies TabularTransformWidgetProps,
      resolvedInputs: resolvedInputs(
        frame(
          [
            { symbol: "ETHUSDT", close: 2136 },
            { symbol: "BTCUSDT", close: 77650 },
            { symbol: "ETHUSDT", close: 2138 },
            { symbol: "BTCUSDT", close: 77655 },
          ],
          [
            { key: "symbol", type: "string", provenance: "manual" },
            { key: "close", type: "number", provenance: "manual" },
          ],
        ),
      ),
    });

    expect(output.status).toBe("ready");
    expect(output.columns).toEqual(["symbol", "last"]);
    expect(output.rows).toEqual([
      { symbol: "ETHUSDT", last: 2138 },
      { symbol: "BTCUSDT", last: 77655 },
    ]);
  });

  it("supports table-style merge mappings when incoming key names differ", () => {
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "none",
        rowMergeMode: "latest",
        rowMergeKeyMappings: [{ seedField: "symbol", liveField: "ticker" }],
      } satisfies TabularTransformWidgetProps,
      resolvedInputs: resolvedInputs(
        frame(
          [
            { ticker: "ETHUSDT", last: 2136 },
            { ticker: "ETHUSDT", last: 2139 },
          ],
          [
            { key: "ticker", type: "string", provenance: "manual" },
            { key: "last", type: "number", provenance: "manual" },
          ],
        ),
      ),
    });

    expect(output.status).toBe("ready");
    expect(output.columns).toEqual(["symbol", "last"]);
    expect(output.rows).toEqual([{ symbol: "ETHUSDT", last: 2139 }]);
  });

  it("preserves previous row fields when latest updates omit them", () => {
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "none",
        rowMergeMode: "latest",
        rowMergeKeyFields: ["symbol"],
      } satisfies TabularTransformWidgetProps,
      resolvedInputs: resolvedInputs(
        frame(
          [
            { symbol: "ETHUSDT", sector: "Layer 1", last: 2136 },
            { symbol: "ETHUSDT", last: 2139 },
          ],
          [
            { key: "symbol", type: "string", provenance: "manual" },
            { key: "sector", type: "string", provenance: "manual" },
            { key: "last", type: "number", provenance: "manual" },
          ],
        ),
      ),
    });

    expect(output.status).toBe("ready");
    expect(output.rows).toEqual([
      { symbol: "ETHUSDT", sector: "Layer 1", last: 2139 },
    ]);
  });

  it("advertises latest-row merge keys on transformed live updates", () => {
    const baseFrame = frame(
      [
        { symbol: "ETHUSDT", close: 2136 },
        { symbol: "BTCUSDT", close: 77650 },
      ],
      [
        { key: "symbol", type: "string", provenance: "manual" },
        { key: "close", type: "number", provenance: "manual" },
      ],
    );
    const deltaFrame = frame(
      [
        { symbol: "ETHUSDT", close: 2138 },
        { symbol: "ETHUSDT", close: 2139 },
      ],
      [
        { key: "symbol", type: "string", provenance: "manual" },
        { key: "close", type: "number", provenance: "manual" },
      ],
    );
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "none",
        computedColumns: [
          {
            key: "last",
            label: "Last",
            type: "number",
            formulaExpression: "[close]",
          },
        ],
        projectFields: ["symbol", "last"],
        rowMergeMode: "latest",
        rowMergeKeyFields: ["symbol"],
      } satisfies TabularTransformWidgetProps,
      resolvedInputs: resolvedInputs(baseFrame, {
        upstreamBase: baseFrame,
        upstreamDelta: deltaFrame,
        upstreamUpdate: {
          contractVersion: "widget-runtime-update@v1",
          mode: "delta",
          sourceWidgetId: "source-widget",
          sourceOutputId: "updates",
          outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          retainedOutputLocation: "carrier",
        },
      }),
    });

    expect(output.status).toBe("ready");
    expect(output.rows).toEqual([
      { symbol: "ETHUSDT", last: 2136 },
      { symbol: "BTCUSDT", last: 77650 },
    ]);

    const update = readWidgetRuntimeUpdateContext(output);
    expect(update?.diagnostics?.mergeKeyFields).toEqual(["symbol"]);
    const deltaOutput = update?.deltaOutput as TabularFrameSourceV1 | undefined;
    expect(deltaOutput?.rows).toEqual([{ symbol: "ETHUSDT", last: 2139 }]);
  });

  it("returns a configuration error when latest-row merge has no mappings", () => {
    const output = resolveTabularTransformOutput({
      props: {
        rowMergeMode: "latest",
      } satisfies TabularTransformWidgetProps,
      resolvedInputs: resolvedInputs(
        frame(
          [{ symbol: "ETHUSDT", close: 2136 }],
          [
            { key: "symbol", type: "string", provenance: "manual" },
            { key: "close", type: "number", provenance: "manual" },
          ],
        ),
      ),
    });

    expect(output.status).toBe("error");
    expect(output.error).toContain("at least one merge mapping");
  });

  it("returns a configuration error when a computed-column formula is invalid", () => {
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "none",
        computedColumns: [
          {
            key: "broken_return",
            type: "number",
            formulaExpression: "last_price * 10",
          },
        ],
      } satisfies TabularTransformWidgetProps,
      resolvedInputs: resolvedInputs(
        frame(
          [{ last_price: 110 }],
          [{ key: "last_price", type: "number", provenance: "manual" }],
        ),
      ),
    });

    expect(output.status).toBe("error");
    expect(output.error).toContain("Wrap field names in brackets");
  });
});

describe("tabular transform live-only retention", () => {
  it("keeps a retained transformed output ready during a transient live-only idle publication", () => {
    const idleLiveFrame = {
      status: "idle",
      columns: ["symbol", "close"],
      rows: [],
      fields: [
        { key: "symbol", type: "string", provenance: "manual" },
        { key: "close", type: "number", provenance: "manual" },
      ],
      source: {
        kind: "connection-stream-query",
      },
    } satisfies TabularFrameSourceV1;
    const retainedOutput = frame(
      [{ symbol: "ETHUSDT", last: 2139 }],
      [
        { key: "symbol", type: "string", provenance: "manual" },
        { key: "last", type: "number", provenance: "derived" },
      ],
    );
    const liveOnlyInputs = {
      [TABULAR_LIVE_UPDATES_INPUT_ID]: {
        inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
        label: "Live updates",
        status: "valid",
        sourceWidgetId: "stream-widget",
        sourceOutputId: TABULAR_UPDATES_OUTPUT_ID,
        contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        value: idleLiveFrame,
      },
    } as const;

    const consumerState = resolveTabularTransformSourceConsumerState(
      liveOnlyInputs,
      undefined,
      retainedOutput,
    );
    const output = resolveTabularTransformOutput({
      props: {
        transformMode: "none",
        computedColumns: [
          {
            key: "last",
            label: "Last",
            type: "number",
            formulaExpression: "[close]",
          },
        ],
        projectFields: ["symbol", "last"],
      } satisfies TabularTransformWidgetProps,
      resolvedInputs: liveOnlyInputs,
      runtimeState: retainedOutput,
    });

    expect(consumerState.kind).toBe("ready");
    expect(consumerState.requiresUpstreamResolution).toBe(false);
    expect(output.status).toBe("ready");
    expect(output.rows).toEqual([{ symbol: "ETHUSDT", last: 2139 }]);
    expect(output.columns).toEqual(["symbol", "last"]);
    expect(output.source?.context?.statusProvenance).toMatchObject({
      activeInputRole: "live",
      liveBound: true,
      seedBound: false,
    });
  });

  it("does not publish the dataset output when the transform is bound to live updates", () => {
    const liveFrame = frame(
      [{ symbol: "ETHUSDT", close: 2136.36 }],
      [
        { key: "symbol", type: "string", provenance: "manual" },
        { key: "close", type: "number", provenance: "manual" },
      ],
    );

    const output = resolveTabularTransformChannelOutput({
      outputChannel: "dataset",
      props: { transformMode: "none" } satisfies TabularTransformWidgetProps,
      resolvedInputs: {
        [TABULAR_LIVE_UPDATES_INPUT_ID]: {
          inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
          label: "Live updates",
          status: "valid",
          sourceWidgetId: "stream-widget",
          sourceOutputId: TABULAR_UPDATES_OUTPUT_ID,
          contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          value: liveFrame,
        },
      },
    });

    expect(output.status).toBe("idle");
    expect(output.rows).toEqual([]);
    expect(output.source?.context?.statusProvenance).toMatchObject({
      activeInputRole: "live",
      liveBound: true,
      seedBound: false,
    });
    expect(output.source?.context?.inactiveOutputReason).toContain("dataset output is inactive");
  });

  it("does not publish the updates output when the transform is bound to seed data", () => {
    const seedFrame = frame([{ symbol: "ETHUSDT", close: 2136.36 }]);

    const output = resolveTabularTransformChannelOutput({
      outputChannel: "updates",
      props: { transformMode: "none" } satisfies TabularTransformWidgetProps,
      resolvedInputs: {
        [TABULAR_SEED_INPUT_ID]: {
          inputId: TABULAR_SEED_INPUT_ID,
          label: "Seed data",
          status: "valid",
          sourceWidgetId: "seed-widget",
          sourceOutputId: "dataset",
          contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          value: seedFrame,
        },
      },
    });

    expect(output.status).toBe("idle");
    expect(output.rows).toEqual([]);
    expect(output.source?.context?.statusProvenance).toMatchObject({
      activeInputRole: "seed",
      liveBound: false,
      seedBound: true,
    });
    expect(output.source?.context?.inactiveOutputReason).toContain("updates output is inactive");
  });

  it("returns a configuration error when seed data and live updates are both bound", () => {
    const seedFrame = frame([{ symbol: "ETHUSDT", close: 2136.36 }]);
    const liveFrame = frame([{ symbol: "BTCUSDT", close: 77650 }]);

    const output = resolveTabularTransformOutput({
      props: { transformMode: "none" } satisfies TabularTransformWidgetProps,
      resolvedInputs: {
        [TABULAR_SEED_INPUT_ID]: {
          inputId: TABULAR_SEED_INPUT_ID,
          label: "Seed data",
          status: "valid",
          sourceWidgetId: "seed-widget",
          sourceOutputId: "dataset",
          contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          value: seedFrame,
        },
        [TABULAR_LIVE_UPDATES_INPUT_ID]: {
          inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
          label: "Live updates",
          status: "valid",
          sourceWidgetId: "stream-widget",
          sourceOutputId: TABULAR_UPDATES_OUTPUT_ID,
          contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          value: liveFrame,
        },
      },
    });

    expect(output.status).toBe("error");
    expect(output.error).toBe(TABULAR_TRANSFORM_SINGLE_SOURCE_ERROR);
    expect(output.source?.context?.statusProvenance).toMatchObject({
      activeInputRole: "conflict",
      liveBound: true,
      seedBound: true,
    });
  });
});
