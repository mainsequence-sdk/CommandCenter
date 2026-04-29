import { describe, expect, it } from "vitest";

import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";
import { readWidgetRuntimeUpdateContext } from "@/widgets/shared/runtime-update";

import { resolveTabularTransformOutput, type TabularTransformWidgetProps } from "./tabularTransformModel";

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
});
