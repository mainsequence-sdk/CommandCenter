/** @vitest-environment jsdom */

import { act, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

const localStorageState = new Map<string, string>();
const localStorageStub: Storage = {
  get length() {
    return localStorageState.size;
  },
  clear() {
    localStorageState.clear();
  },
  getItem(key) {
    return localStorageState.get(key) ?? null;
  },
  key(index) {
    return [...localStorageState.keys()][index] ?? null;
  },
  removeItem(key) {
    localStorageState.delete(key);
  },
  setItem(key, value) {
    localStorageState.set(key, value);
  },
};

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: localStorageStub,
});
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: localStorageStub,
});
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const [
  { CORE_TABULAR_FRAME_SOURCE_CONTRACT },
  { attachWidgetRuntimeUpdateContext, projectWidgetRuntimeUpdateOutput, resolveWidgetRuntimeUpdateParts },
  { TABULAR_LIVE_UPDATES_INPUT_ID, TABULAR_SEED_INPUT_ID, useIncrementalTabularConsumerBindingState },
] = await Promise.all([
  import("@/widgets/shared/tabular-frame-source"),
  import("@/widgets/shared/runtime-update"),
  import("./incremental-tabular-consumer"),
]);

type ResolvedWidgetInput = import("@/widgets/types").ResolvedWidgetInput;
type ResolvedWidgetInputs = import("@/widgets/types").ResolvedWidgetInputs;
type TabularFrameSourceV1 = import("@/widgets/shared/tabular-frame-source").TabularFrameSourceV1;

function frame(
  rows: Array<Record<string, unknown>>,
  updatedAtMs: number,
): TabularFrameSourceV1 {
  return {
    status: "ready",
    columns: ["time", "value"],
    rows,
    source: {
      kind: "test-frame",
      updatedAtMs,
    },
  };
}

function buildSeedInput(
  inputId: string,
  rows: Array<Record<string, unknown>>,
  updatedAtMs: number,
): ResolvedWidgetInput {
  const value = frame(rows, updatedAtMs);

  return {
    inputId,
    label: inputId,
    status: "valid",
    sourceWidgetId: "seed-source",
    sourceOutputId: "dataset",
    contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    value,
    upstreamBase: value,
  };
}

function buildUpdatesInput(input: {
  inputId: string;
  publicationRole: "seed" | "update";
  sourceRunId: string;
  baseRows: Array<Record<string, unknown>>;
  deltaRows?: Array<Record<string, unknown>>;
  updatedAtMs: number;
  mergeKeyFields?: string[];
}): ResolvedWidgetInput {
  const baseFrame = frame(input.baseRows, input.updatedAtMs);
  const deltaFrame = input.deltaRows
    ? frame(input.deltaRows, input.updatedAtMs + 1)
    : undefined;
  const published = attachWidgetRuntimeUpdateContext(baseFrame, {
    contractVersion: "widget-runtime-update@v1",
    mode: deltaFrame ? "delta" : "snapshot",
    publicationSemantics: "incremental",
    publicationRole: input.publicationRole,
    sourceRunId: input.sourceRunId,
    sourceOutputId: "dataset",
    outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    deltaOutput: deltaFrame,
    retainedOutputLocation: "carrier",
    diagnostics: input.mergeKeyFields?.length
      ? { mergeKeyFields: input.mergeKeyFields }
      : undefined,
  });
  const projected = projectWidgetRuntimeUpdateOutput(published, {
    sourceOutputId: "updates",
    outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  });
  const parts = resolveWidgetRuntimeUpdateParts<TabularFrameSourceV1, TabularFrameSourceV1>(projected);

  return {
    inputId: input.inputId,
    label: input.inputId,
    status: "valid",
    sourceWidgetId: "live-source",
    sourceOutputId: "updates",
    contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    value: projected,
    upstreamBase: parts.upstreamBase,
    upstreamDelta: parts.upstreamDelta,
    upstreamUpdate: parts.upstreamUpdate,
  };
}

interface SnapshotState {
  dataset: TabularFrameSourceV1 | null;
  runtimeState?: Record<string, unknown>;
  active: boolean;
}

function Harness({
  resolvedInputs,
  onSnapshot,
  onRuntimeStateEvent,
}: {
  resolvedInputs?: ResolvedWidgetInputs;
  onSnapshot: (snapshot: SnapshotState) => void;
  onRuntimeStateEvent?: (runtimeState: Record<string, unknown> | undefined) => void;
}) {
  const [runtimeState, setRuntimeState] = useState<Record<string, unknown> | undefined>(undefined);
  const bindingState = useIncrementalTabularConsumerBindingState({
    instanceId: "consumer-1",
    onRuntimeStateChange: (nextRuntimeState) => {
      setRuntimeState(nextRuntimeState);
      onRuntimeStateEvent?.(nextRuntimeState);
    },
    resolvedInputs,
    runtimeState,
  });

  useEffect(() => {
    onSnapshot({
      dataset: bindingState.dataset,
      runtimeState,
      active: bindingState.active,
    });
  }, [bindingState.active, bindingState.dataset, onSnapshot, runtimeState]);

  return null;
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

interface HarnessDriver {
  render: (resolvedInputs?: ResolvedWidgetInputs) => Promise<void>;
  getSnapshot: () => SnapshotState | null;
  getRuntimeEventCount: () => number;
  cleanup: () => void;
}

function createHarness(): HarnessDriver {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  let latestSnapshot: SnapshotState | null = null;
  let runtimeEventCount = 0;

  return {
    async render(resolvedInputs) {
      await act(async () => {
        root.render(
          <Harness
            resolvedInputs={resolvedInputs}
            onSnapshot={(snapshot) => {
              latestSnapshot = snapshot;
            }}
            onRuntimeStateEvent={() => {
              runtimeEventCount += 1;
            }}
          />,
        );
      });
      await flushEffects();
    },
    getSnapshot: () => latestSnapshot,
    getRuntimeEventCount: () => runtimeEventCount,
    cleanup() {
      root.unmount();
      container.remove();
    },
  };
}

const harnesses: HarnessDriver[] = [];

afterEach(() => {
  while (harnesses.length > 0) {
    harnesses.pop()?.cleanup();
  }
});

describe("incremental tabular consumer", () => {
  it("initializes from retained seed dataset bindings", async () => {
    const harness = createHarness();
    harnesses.push(harness);

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        TABULAR_SEED_INPUT_ID,
        [{ time: "2026-04-29T00:00:00.000Z", value: 1 }],
        100,
      ),
    });

    expect(harness.getSnapshot()?.active).toBe(true);
    expect(harness.getSnapshot()?.dataset?.rows).toEqual([
      { time: "2026-04-29T00:00:00.000Z", value: 1 },
    ]);
  });

  it("replaces prior state when seedData receives a new seed publication", async () => {
    const harness = createHarness();
    harnesses.push(harness);

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        TABULAR_SEED_INPUT_ID,
        [{ time: "2026-04-29T00:00:00.000Z", value: 1 }],
        100,
      ),
    });

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildUpdatesInput({
        inputId: TABULAR_SEED_INPUT_ID,
        publicationRole: "seed",
        sourceRunId: "http-seed-2",
        baseRows: [{ time: "2026-04-29T00:05:00.000Z", value: 5 }],
        updatedAtMs: 200,
      }),
    });

    expect(harness.getSnapshot()?.dataset?.rows).toEqual([
      { time: "2026-04-29T00:05:00.000Z", value: 5 },
    ]);
  });

  it("ignores update publications bound on seedData", async () => {
    const harness = createHarness();
    harnesses.push(harness);

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        TABULAR_SEED_INPUT_ID,
        [{ time: "2026-04-29T00:00:00.000Z", value: 1 }],
        100,
      ),
    });

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildUpdatesInput({
        inputId: TABULAR_SEED_INPUT_ID,
        publicationRole: "update",
        sourceRunId: "ws-update-1",
        baseRows: [
          { time: "2026-04-29T00:00:00.000Z", value: 1 },
          { time: "2026-04-29T00:01:00.000Z", value: 2 },
        ],
        deltaRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
        updatedAtMs: 200,
      }),
    });

    expect(harness.getSnapshot()?.dataset?.rows).toEqual([
      { time: "2026-04-29T00:00:00.000Z", value: 1 },
    ]);
  });

  it("applies live update batches after a seed and can also initialize from updates alone", async () => {
    const harness = createHarness();
    harnesses.push(harness);

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        TABULAR_SEED_INPUT_ID,
        [{ time: "2026-04-29T00:00:00.000Z", value: 1 }],
        100,
      ),
      [TABULAR_LIVE_UPDATES_INPUT_ID]: buildUpdatesInput({
        inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
        publicationRole: "update",
        sourceRunId: "ws-run-1",
        baseRows: [
          { time: "2026-04-29T00:00:00.000Z", value: 1 },
          { time: "2026-04-29T00:01:00.000Z", value: 2 },
        ],
        deltaRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
        updatedAtMs: 200,
        mergeKeyFields: ["time"],
      }),
    });

    expect(harness.getSnapshot()?.dataset?.rows).toEqual([
      { time: "2026-04-29T00:00:00.000Z", value: 1 },
      { time: "2026-04-29T00:01:00.000Z", value: 2 },
    ]);

    const updatesOnlyHarness = createHarness();
    harnesses.push(updatesOnlyHarness);

    await updatesOnlyHarness.render({
      [TABULAR_LIVE_UPDATES_INPUT_ID]: buildUpdatesInput({
        inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
        publicationRole: "update",
        sourceRunId: "ws-run-init",
        baseRows: [{ time: "2026-04-29T00:02:00.000Z", value: 3 }],
        deltaRows: [{ time: "2026-04-29T00:02:00.000Z", value: 3 }],
        updatedAtMs: 300,
        mergeKeyFields: ["time"],
      }),
    });

    expect(updatesOnlyHarness.getSnapshot()?.dataset?.rows).toEqual([
      { time: "2026-04-29T00:02:00.000Z", value: 3 },
    ]);
  });

  it("keeps the seed baseline when live updates restart with a new sourceRunId", async () => {
    const harness = createHarness();
    harnesses.push(harness);

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        TABULAR_SEED_INPUT_ID,
        [{ time: "2026-04-29T00:00:00.000Z", value: 1 }],
        100,
      ),
      [TABULAR_LIVE_UPDATES_INPUT_ID]: buildUpdatesInput({
        inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
        publicationRole: "update",
        sourceRunId: "ws-run-1",
        baseRows: [
          { time: "2026-04-29T00:00:00.000Z", value: 1 },
          { time: "2026-04-29T00:01:00.000Z", value: 2 },
        ],
        deltaRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
        updatedAtMs: 200,
        mergeKeyFields: ["time"],
      }),
    });

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        TABULAR_SEED_INPUT_ID,
        [{ time: "2026-04-29T00:00:00.000Z", value: 1 }],
        100,
      ),
      [TABULAR_LIVE_UPDATES_INPUT_ID]: buildUpdatesInput({
        inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
        publicationRole: "update",
        sourceRunId: "ws-run-2",
        baseRows: [{ time: "2026-04-29T00:10:00.000Z", value: 10 }],
        deltaRows: [{ time: "2026-04-29T00:10:00.000Z", value: 10 }],
        updatedAtMs: 400,
        mergeKeyFields: ["time"],
      }),
    });

    expect(harness.getSnapshot()?.dataset?.rows).toEqual([
      { time: "2026-04-29T00:00:00.000Z", value: 1 },
      { time: "2026-04-29T00:10:00.000Z", value: 10 },
    ]);
  });

  it("unions live seed snapshots onto the historical seed baseline using merge keys", async () => {
    const harness = createHarness();
    harnesses.push(harness);

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        TABULAR_SEED_INPUT_ID,
        [
          { time: "2026-04-29T00:00:00.000Z", value: 1 },
          { time: "2026-04-29T00:01:00.000Z", value: 2 },
        ],
        100,
      ),
      [TABULAR_LIVE_UPDATES_INPUT_ID]: buildUpdatesInput({
        inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
        publicationRole: "seed",
        sourceRunId: "ws-seed-1",
        baseRows: [
          { time: "2026-04-29T00:01:00.000Z", value: 20 },
          { time: "2026-04-29T00:02:00.000Z", value: 3 },
        ],
        updatedAtMs: 200,
        mergeKeyFields: ["time"],
      }),
    });

    expect(harness.getSnapshot()?.dataset?.rows).toEqual([
      { time: "2026-04-29T00:00:00.000Z", value: 1 },
      { time: "2026-04-29T00:01:00.000Z", value: 20 },
      { time: "2026-04-29T00:02:00.000Z", value: 3 },
    ]);
  });

  it("keeps the retained dataset stable when an update publication carries an empty delta batch", async () => {
    const harness = createHarness();
    harnesses.push(harness);

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        TABULAR_SEED_INPUT_ID,
        [{ time: "2026-04-29T00:00:00.000Z", value: 1 }],
        100,
      ),
      [TABULAR_LIVE_UPDATES_INPUT_ID]: buildUpdatesInput({
        inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
        publicationRole: "update",
        sourceRunId: "ws-run-1",
        baseRows: [{ time: "2026-04-29T00:00:00.000Z", value: 1 }],
        deltaRows: [],
        updatedAtMs: 200,
      }),
    });

    expect(harness.getSnapshot()?.dataset?.rows).toEqual([
      { time: "2026-04-29T00:00:00.000Z", value: 1 },
    ]);
  });

  it("does not republish equivalent runtime state on a stable rerender", async () => {
    const harness = createHarness();
    harnesses.push(harness);

    const resolvedInputs = {
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        TABULAR_SEED_INPUT_ID,
        [{ time: "2026-04-29T00:00:00.000Z", value: 1 }],
        100,
      ),
      [TABULAR_LIVE_UPDATES_INPUT_ID]: buildUpdatesInput({
        inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
        publicationRole: "update",
        sourceRunId: "ws-run-stable",
        baseRows: [
          { time: "2026-04-29T00:00:00.000Z", value: 1 },
          { time: "2026-04-29T00:01:00.000Z", value: 2 },
        ],
        deltaRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
        updatedAtMs: 200,
        mergeKeyFields: ["time"],
      }),
    } satisfies ResolvedWidgetInputs;

    await harness.render(resolvedInputs);
    const runtimeEventCountAfterFirstRender = harness.getRuntimeEventCount();

    await harness.render(resolvedInputs);

    expect(harness.getRuntimeEventCount()).toBe(runtimeEventCountAfterFirstRender);
  });
});
