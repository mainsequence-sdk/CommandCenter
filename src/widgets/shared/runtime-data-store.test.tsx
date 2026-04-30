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

  it("applies deltas with merge-key replacement and retention", () => {
    const store = createRuntimeDataStore("workspace-1");
    const baseRef = store.putSnapshot({
      ownerId: "source-1",
      outputId: "dataset",
      frame: frame([
        { id: "a", value: 1 },
        { id: "b", value: 2 },
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
      replaced: 1,
      pruned: 1,
      retained: 2,
    });
    expect(store.readFrame(result.outputRef)?.rows).toEqual([
      { id: "b", value: 20 },
      { id: "c", value: 3 },
    ]);
    expect(store.readFrame(result.deltaRef)?.rows).toEqual([
      { id: "b", value: 20 },
      { id: "c", value: 3 },
    ]);
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
