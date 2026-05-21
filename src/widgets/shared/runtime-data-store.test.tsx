import { describe, expect, it } from "vitest";

import { CORE_TABULAR_FRAME_SOURCE_CONTRACT, type TabularFrameSourceV1 } from "@/widgets/shared/tabular-frame-source";
import {
  createRuntimeDataStore,
  getRuntimeDataRef,
  materializeRuntimeTabularFrame,
  storeTabularFrameRuntimeState,
} from "./runtime-data-store";

function frame(rows: Array<Record<string, unknown>>): TabularFrameSourceV1 {
  return {
    status: "ready",
    columns: ["id", "value"],
    rows,
    source: {
      kind: "test-frame",
    },
  };
}

describe("runtime data store", () => {
  it("stores tabular snapshots once and returns ref-backed frame shells", () => {
    const store = createRuntimeDataStore("workspace-1");
    const sourceFrame = frame([
      { id: "a", value: 1 },
      { id: "b", value: 2 },
    ]);
    const shell = storeTabularFrameRuntimeState({
      frame: sourceFrame,
      ownerId: "source-1",
      outputId: "dataset",
      store,
    });
    const ref = getRuntimeDataRef(shell);

    expect(shell.rows).toEqual([]);
    expect(ref).toMatchObject({
      contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      ownerId: "source-1",
      outputId: "dataset",
      rowCount: 2,
      version: 1,
    });
    expect(materializeRuntimeTabularFrame(shell, store)?.rows).toEqual(sourceFrame.rows);
  });

  it("can preserve inline rows in ref-backed frame shells for cold reload consumers", () => {
    const store = createRuntimeDataStore("workspace-inline-rows");
    const sourceFrame = frame([
      { id: "a", value: 1 },
      { id: "b", value: 2 },
    ]);
    const shell = storeTabularFrameRuntimeState({
      frame: sourceFrame,
      ownerId: "source-1",
      outputId: "dataset",
      store,
      includeRowsInShell: true,
    });
    const ref = getRuntimeDataRef(shell);

    expect(shell.rows).toEqual(sourceFrame.rows);
    expect(ref).toMatchObject({
      contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      ownerId: "source-1",
      outputId: "dataset",
      rowCount: 2,
      version: 1,
    });
    expect(materializeRuntimeTabularFrame(shell, store)?.rows).toEqual(sourceFrame.rows);
  });

  it("applies partial deltas as merge-key patches with retention", () => {
    const store = createRuntimeDataStore("workspace-1");
    const baseRef = store.putSnapshot({
      ownerId: "source-1",
      outputId: "dataset",
      frame: frame([
        { id: "a", value: 1 },
        { id: "b", value: 2, label: "Beta" },
      ]),
    });

    const result = store.applyDelta({
      ownerId: "source-1",
      outputId: "dataset",
      baseRef,
      deltaFrame: frame([
        { id: "b", value: 20 },
        { id: "c", value: 3 },
      ]),
      mergeKeyFields: ["id"],
      retention: { maxRows: 2 },
    });

    expect(result.operations).toMatchObject({
      appended: 1,
      patched: 1,
      pruned: 1,
      retained: 2,
    });
    expect(store.readFrame(result.outputRef)?.rows).toEqual([
      { id: "b", value: 20, label: "Beta" },
      { id: "c", value: 3 },
    ]);
    expect(store.readFrame(result.deltaRef)?.rows).toEqual([
      { id: "b", value: 20 },
      { id: "c", value: 3 },
    ]);
  });

  it("combines seed and live refs with keyed patching and retention", () => {
    const store = createRuntimeDataStore("workspace-1");
    const seedRef = store.putSnapshot({
      ownerId: "seed-source",
      outputId: "dataset",
      frame: frame([
        { id: "a", value: 1 },
        { id: "b", value: 2, label: "Beta" },
      ]),
    });
    const liveRef = store.putSnapshot({
      ownerId: "live-source",
      outputId: "updates",
      frame: frame([
        { id: "b", value: 20 },
        { id: "c", value: 3 },
      ]),
    });

    const outputRef = store.combine({
      ownerId: "consumer-1",
      outputId: "dataset",
      seedRef,
      liveRef,
      mergeKeyFields: ["id"],
      retention: { maxRows: 2 },
    });

    expect(outputRef).toMatchObject({
      ownerId: "consumer-1",
      outputId: "dataset",
      rowCount: 2,
    });
    expect(outputRef ? store.readFrame(outputRef)?.rows : null).toEqual([
      { id: "b", value: 20, label: "Beta" },
      { id: "c", value: 3 },
    ]);
  });

  it("combines seed and live refs with differently named merge fields", () => {
    const store = createRuntimeDataStore("workspace-1");
    const seedRef = store.putSnapshot({
      ownerId: "seed-source",
      outputId: "dataset",
      frame: {
        ...frame([
          { symbol: "BTCUSDT", last: 100, name: "Bitcoin" },
        ]),
        columns: ["symbol", "last", "name"],
      },
    });
    const liveRef = store.putSnapshot({
      ownerId: "live-source",
      outputId: "updates",
      frame: {
        ...frame([{ ticker: "BTCUSDT", last: 101 }]),
        columns: ["ticker", "last"],
      },
    });

    const outputRef = store.combine({
      ownerId: "consumer-1",
      outputId: "dataset",
      seedRef,
      liveRef,
      mergeKeyFields: [],
      mergeKeyMappings: [{ seedField: "symbol", liveField: "ticker" }],
    });

    expect(outputRef ? store.readFrame(outputRef)?.columns : null).toEqual([
      "symbol",
      "last",
      "name",
    ]);
    expect(outputRef ? store.readFrame(outputRef)?.rows : null).toEqual([
      { symbol: "BTCUSDT", last: 101, name: "Bitcoin" },
    ]);
  });

  it("reuses the combined ref when publication identity and reduced rows are unchanged", () => {
    const store = createRuntimeDataStore("workspace-1");
    const seedRef = store.putSnapshot({
      ownerId: "seed-source",
      outputId: "dataset",
      frame: frame([{ id: "a", value: 1 }]),
    });
    const liveRef = store.putSnapshot({
      ownerId: "live-source",
      outputId: "updates",
      frame: frame([{ id: "b", value: 2 }]),
    });

    const firstRef = store.combine({
      ownerId: "consumer-1",
      outputId: "dataset",
      seedRef,
      liveRef,
      mergeKeyFields: ["id"],
      signature: "seed:v1|live:v1",
    });
    const secondRef = store.combine({
      ownerId: "consumer-1",
      outputId: "dataset",
      seedRef,
      liveRef,
      mergeKeyFields: ["id"],
      signature: "seed:v1|live:v1",
    });

    expect(secondRef).toEqual(firstRef);
    expect(secondRef?.version).toBe(firstRef?.version);
  });

  it("reuses the combined ref when publication identity changes but the reduced data does not", () => {
    const store = createRuntimeDataStore("workspace-1");
    const seedRef = store.putSnapshot({
      ownerId: "seed-source",
      outputId: "dataset",
      frame: frame([{ id: "a", value: 1 }]),
    });
    const liveRef = store.putSnapshot({
      ownerId: "live-source",
      outputId: "updates",
      frame: frame([{ id: "b", value: 2 }]),
    });

    const firstRef = store.combine({
      ownerId: "consumer-1",
      outputId: "dataset",
      seedRef,
      liveRef,
      mergeKeyFields: ["id"],
      signature: "seed:v1|live:v1",
    });
    const secondRef = store.combine({
      ownerId: "consumer-1",
      outputId: "dataset",
      seedRef,
      liveRef,
      mergeKeyFields: ["id"],
      signature: "seed:v1|live:v2-lifecycle-only",
    });

    expect(secondRef).toEqual(firstRef);
    expect(secondRef?.version).toBe(firstRef?.version);
  });

  it("treats released-owner refs as stale", () => {
    const store = createRuntimeDataStore("workspace-1");
    const ref = store.putSnapshot({
      ownerId: "source-1",
      outputId: "dataset",
      frame: frame([{ id: "a", value: 1 }]),
    });

    expect(store.readFrame(ref)?.rows).toHaveLength(1);

    store.releaseOwner("source-1");

    expect(store.readFrame(ref)).toBeNull();
    expect(materializeRuntimeTabularFrame(ref, store)).toBeNull();
  });
});
