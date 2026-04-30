import { describe, expect, it } from "vitest";

import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";
import { TABULAR_SEED_INPUT_ID } from "@/widgets/shared/incremental-tabular-consumer";

import { mainSequenceOhlcBarsWidget } from "./definition";
import { DATA_NODE_SOURCE_OUTPUT_ID } from "../../../workbench/widgets/data-node-shared/widgetBindings";

function frame(rows: Array<Record<string, unknown>>, updatedAtMs: number): TabularFrameSourceV1 {
  return {
    status: "ready",
    columns: ["time", "open", "high", "low", "close"],
    rows,
    source: {
      kind: "test-frame",
      updatedAtMs,
    },
  };
}

function buildSeedResolvedInput() {
  const baseFrame = frame([
    {
      time: "2026-04-29T00:00:00.000Z",
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
    },
  ], 100);
  return {
    inputId: TABULAR_SEED_INPUT_ID,
    label: "Seed data",
    status: "valid" as const,
    sourceWidgetId: "seed-source",
    sourceOutputId: DATA_NODE_SOURCE_OUTPUT_ID,
    contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    value: baseFrame,
    upstreamBase: baseFrame,
  };
}

describe("mainSequenceOhlcBarsWidget", () => {
  it("documents the new seed/live authoring contract", () => {
    const io = mainSequenceOhlcBarsWidget.io;
    const registryContract = mainSequenceOhlcBarsWidget.registryContract;

    expect(io).toBeDefined();
    expect(registryContract?.configuration).toBeDefined();
    expect(registryContract?.io).toBeDefined();

    expect(mainSequenceOhlcBarsWidget.widgetVersion).toBe("1.1.1");
    expect(io!.inputs?.[0]?.acceptedOutputIds).toEqual([
      DATA_NODE_SOURCE_OUTPUT_ID,
    ]);
    expect(registryContract!.configuration!.requiredSetupSteps?.[0]).toContain("seedData");
    expect(registryContract!.io!.ioNotes?.[0]).toContain("seedData");
    expect(registryContract!.io!.ioNotes?.[1]).toContain("liveUpdates");
  });

  it("builds an agent snapshot from seed role bindings", async () => {
    const snapshot = await Promise.resolve(mainSequenceOhlcBarsWidget.buildAgentSnapshot!({
      props: {
        timeField: "time",
        openField: "open",
        highField: "high",
        lowField: "low",
        closeField: "close",
      },
      resolvedInputs: {
        [TABULAR_SEED_INPUT_ID]: buildSeedResolvedInput(),
      },
      runtimeState: undefined,
    } as never));

    expect(snapshot.state).toBe("ready");
    expect(snapshot.data).toMatchObject({
      rowCount: 1,
      pointCount: 1,
    });
  });
});
