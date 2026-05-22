import { describe, expect, it } from "vitest";

import {
  TABULAR_LIVE_UPDATES_INPUT_ID,
  TABULAR_SEED_INPUT_ID,
  TABULAR_UPDATES_OUTPUT_ID,
} from "@/widgets/shared/incremental-tabular-consumer";
import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";
import {
  readWidgetRuntimeUpdateContext,
  WIDGET_RUNTIME_UPDATE_CONTRACT_VERSION,
} from "@/widgets/shared/runtime-update";

import { tabularTransformWidget } from "./definition";
import {
  TABULAR_TRANSFORM_DATASET_OUTPUT_ID,
  type TabularTransformWidgetProps,
} from "./tabularTransformModel";

function frame(rows: Array<Record<string, unknown>>): TabularFrameSourceV1 {
  return {
    status: "ready",
    columns: ["symbol", "close"],
    fields: [
      { key: "symbol", type: "string", provenance: "backend" },
      { key: "close", type: "number", provenance: "backend" },
    ],
    rows,
  };
}

describe("tabularTransformWidget IO", () => {
  it("publishes explicit dataset and updates outputs for seed and live consumers", () => {
    const outputIds = tabularTransformWidget.io?.outputs?.map((output) => output.id);

    expect(outputIds).toContain(TABULAR_TRANSFORM_DATASET_OUTPUT_ID);
    expect(outputIds).toContain(TABULAR_UPDATES_OUTPUT_ID);
  });

  it("projects transformed stream publications onto the updates output", () => {
    const updatesOutput = tabularTransformWidget.io?.outputs?.find(
      (output) => output.id === TABULAR_UPDATES_OUTPUT_ID,
    );
    const baseFrame = frame([
      { symbol: "BTCUSDT", close: 100 },
      { symbol: "ETHUSDT", close: 2000 },
    ]);
    const deltaFrame = frame([
      { symbol: "ETHUSDT", close: 2100 },
      { symbol: "SOLUSDT", close: 150 },
    ]);
    const props = {
      transformMode: "filter",
      filterRules: [{ field: "symbol", operator: "equals", value: "ETHUSDT" }],
    } satisfies TabularTransformWidgetProps;

    expect(updatesOutput?.resolveValue).toBeTypeOf("function");

    const value = updatesOutput?.resolveValue?.({
      widgetId: "tabular-transform",
      instanceId: "tabular-transform-1",
      props,
      resolvedInputs: {
        [TABULAR_LIVE_UPDATES_INPUT_ID]: {
          inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
          label: "Live updates",
          status: "valid",
          sourceWidgetId: "stream-1",
          sourceOutputId: TABULAR_UPDATES_OUTPUT_ID,
          contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          value: baseFrame,
          upstreamBase: baseFrame,
          upstreamDelta: deltaFrame,
          upstreamUpdate: {
            contractVersion: WIDGET_RUNTIME_UPDATE_CONTRACT_VERSION,
            mode: "delta",
            publicationSemantics: "incremental",
            publicationRole: "update",
            sourceWidgetId: "stream-1",
            sourceOutputId: TABULAR_UPDATES_OUTPUT_ID,
            outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
            retainedOutputLocation: "carrier",
          },
        },
      },
    }) as TabularFrameSourceV1;

    expect(value.rows).toEqual([{ symbol: "ETHUSDT", close: 2100 }]);

    const update = readWidgetRuntimeUpdateContext(value);
    expect(update?.sourceOutputId).toBe(TABULAR_UPDATES_OUTPUT_ID);
    expect(update?.outputContractId).toBe(CORE_TABULAR_FRAME_SOURCE_CONTRACT);
    expect(update?.retainedOutputLocation).toBe("envelope");
    expect((update?.retainedOutput as TabularFrameSourceV1 | undefined)?.rows).toEqual([
      { symbol: "ETHUSDT", close: 2000 },
    ]);
  });

  it("keeps live consumer input ids aligned with the published updates output", () => {
    expect(TABULAR_LIVE_UPDATES_INPUT_ID).toBe("liveUpdates");
    expect(
      tabularTransformWidget.io?.outputs?.some((output) => output.id === TABULAR_UPDATES_OUTPUT_ID),
    ).toBe(true);
  });

  it("is executable when a live delta publication is present without a retained base frame", () => {
    const deltaFrame = frame([{ symbol: "ETHUSDT", close: 2136.36 }]);
    const readiness = tabularTransformWidget.execution?.getExecutionReadiness?.({
      executionSurface: "private-dashboard",
      widgetId: "tabular-transform",
      instanceId: "tabular-transform-1",
      reason: "dashboard-refresh",
      props: {
        transformMode: "none",
        computedColumns: [
          {
            key: "last",
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

    expect(readiness).toEqual({ status: "ready" });
  });

  it("exposes role-specific seed and live update inputs instead of legacy single-source authoring", () => {
    const inputs = tabularTransformWidget.io?.inputs ?? [];

    expect(inputs.find((input) => input.id === TABULAR_SEED_INPUT_ID)).toMatchObject({
      acceptedOutputIds: [TABULAR_TRANSFORM_DATASET_OUTPUT_ID],
      required: false,
    });
    expect(inputs.find((input) => input.id === TABULAR_LIVE_UPDATES_INPUT_ID)).toMatchObject({
      acceptedOutputIds: [TABULAR_UPDATES_OUTPUT_ID],
      required: false,
    });
    expect(inputs.some((input) => input.id === "sourceData")).toBe(false);
  });
});
