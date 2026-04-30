import { describe, expect, it } from "vitest";

import {
  attachWidgetRuntimeUpdateContext,
  projectWidgetRuntimeUpdateOutput,
  resolveWidgetRuntimeUpdateParts,
} from "@/widgets/shared/runtime-update";
import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";
import {
  TABULAR_LIVE_UPDATES_INPUT_ID,
  TABULAR_UPDATES_OUTPUT_ID,
} from "@/widgets/shared/incremental-tabular-consumer";
import {
  TABULAR_SOURCE_CONTRACT,
  TABULAR_SOURCE_INPUT_ID,
  TABULAR_SOURCE_OUTPUT_ID,
} from "@/widgets/shared/tabular-widget-source";

import {
  resolveStatisticSettingsDataset,
  resolveStatisticSourceDataset,
} from "./statisticPreview";

function frame(rows: Array<Record<string, unknown>>, updatedAtMs: number): TabularFrameSourceV1 {
  return {
    status: "ready",
    columns: ["timestamp", "value"],
    fields: [
      { key: "timestamp", type: "datetime", provenance: "manual" },
      { key: "value", type: "number", provenance: "manual" },
    ],
    rows,
    source: {
      kind: "test-frame",
      updatedAtMs,
    },
  };
}

describe("statistic preview dataset resolution", () => {
  it("keeps legacy sourceData preview behavior", () => {
    const dataset = resolveStatisticSourceDataset({
      [TABULAR_SOURCE_INPUT_ID]: {
        inputId: TABULAR_SOURCE_INPUT_ID,
        label: "Source data",
        status: "valid",
        sourceWidgetId: "source-1",
        sourceOutputId: TABULAR_SOURCE_OUTPUT_ID,
        contractId: TABULAR_SOURCE_CONTRACT,
        value: frame([{ timestamp: "2026-04-30T00:00:00.000Z", value: 1 }], 100),
      },
    });

    expect(dataset?.rows).toEqual([
      { timestamp: "2026-04-30T00:00:00.000Z", value: 1 },
    ]);
  });

  it("resolves field options from liveUpdates bindings in settings mode", () => {
    const baseFrame = frame(
      [{ timestamp: "2026-04-30T00:00:00.000Z", value: 1 }],
      100,
    );
    const deltaFrame = frame(
      [{ timestamp: "2026-04-30T00:01:00.000Z", value: 2 }],
      101,
    );
    const published = attachWidgetRuntimeUpdateContext(baseFrame, {
      contractVersion: "widget-runtime-update@v1",
      mode: "delta",
      publicationSemantics: "incremental",
      publicationRole: "update",
      sourceRunId: "ws-run-1",
      sourceOutputId: "dataset",
      outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      deltaOutput: deltaFrame,
      retainedOutputLocation: "carrier",
    });
    const projected = projectWidgetRuntimeUpdateOutput(published, {
      sourceOutputId: TABULAR_UPDATES_OUTPUT_ID,
      outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    });
    const parts = resolveWidgetRuntimeUpdateParts<TabularFrameSourceV1, TabularFrameSourceV1>(
      projected,
    );

    const dataset = resolveStatisticSettingsDataset({
      [TABULAR_LIVE_UPDATES_INPUT_ID]: {
        inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
        label: "Live updates",
        status: "valid",
        sourceWidgetId: "stream-1",
        sourceOutputId: TABULAR_UPDATES_OUTPUT_ID,
        contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        value: projected,
        upstreamBase: parts.upstreamBase,
        upstreamDelta: parts.upstreamDelta,
        upstreamUpdate: parts.upstreamUpdate,
      },
    });

    expect(dataset?.columns).toEqual(["timestamp", "value"]);
    expect(dataset?.rows).toEqual([
      { timestamp: "2026-04-30T00:00:00.000Z", value: 1 },
    ]);
  });
});
