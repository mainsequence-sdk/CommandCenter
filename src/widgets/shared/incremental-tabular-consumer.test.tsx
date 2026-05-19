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
  {
    TABULAR_LIVE_UPDATES_INPUT_ID,
    TABULAR_SEED_INPUT_ID,
    resolveIncrementalTabularBindingSnapshot,
    resolveIncrementalTabularOutputFrame,
    useIncrementalTabularConsumerBindingState,
  },
  {
    createRuntimeDataStore,
    getRuntimeDataRef,
    RuntimeDataStoreProvider,
    storeTabularFrameRuntimeState,
  },
] = await Promise.all([
  import("@/widgets/shared/tabular-frame-source"),
  import("@/widgets/shared/runtime-update"),
  import("./incremental-tabular-consumer"),
  import("./runtime-data-store"),
]);

type ResolvedWidgetInput = import("@/widgets/types").ResolvedWidgetInput;
type ResolvedWidgetInputs = import("@/widgets/types").ResolvedWidgetInputs;
type RuntimeRowSelector = import("./runtime-data-store").RuntimeRowSelector;
type RuntimeDataStore = import("./runtime-data-store").RuntimeDataStore;
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
  status: TabularFrameSourceV1["status"] = "ready",
): ResolvedWidgetInput {
  const value = {
    ...frame(rows, updatedAtMs),
    status,
  } satisfies TabularFrameSourceV1;

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
  baseStatus?: TabularFrameSourceV1["status"];
  deltaStatus?: TabularFrameSourceV1["status"];
  mergeKeyFields?: string[];
}): ResolvedWidgetInput {
  const baseFrame = {
    ...frame(input.baseRows, input.updatedAtMs),
    status: input.baseStatus ?? "ready",
  } satisfies TabularFrameSourceV1;
  const deltaFrame = input.deltaRows
    ? {
        ...frame(input.deltaRows, input.updatedAtMs + 1),
        status: input.deltaStatus ?? "ready",
      } satisfies TabularFrameSourceV1
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

function buildPendingSeedInput(): ResolvedWidgetInput {
  return {
    inputId: TABULAR_SEED_INPUT_ID,
    label: TABULAR_SEED_INPUT_ID,
    status: "valid",
    sourceWidgetId: "seed-source",
    sourceOutputId: "dataset",
    contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  };
}

interface SnapshotState {
  dataset: TabularFrameSourceV1 | null;
  runtimeState?: Record<string, unknown>;
  active: boolean;
}

function HarnessContent({
  initialRuntimeState,
  liveMergeKeyFields,
  resolvedInputs,
  runtimeRowSelector,
  onSnapshot,
  onRuntimeStateEvent,
}: {
  initialRuntimeState?: Record<string, unknown>;
  liveMergeKeyFields?: string[];
  resolvedInputs?: ResolvedWidgetInputs;
  runtimeRowSelector?: RuntimeRowSelector;
  onSnapshot: (snapshot: SnapshotState) => void;
  onRuntimeStateEvent?: (runtimeState: Record<string, unknown> | undefined) => void;
}) {
  const [runtimeState, setRuntimeState] = useState<Record<string, unknown> | undefined>(
    initialRuntimeState,
  );
  const bindingState = useIncrementalTabularConsumerBindingState({
    instanceId: "consumer-1",
    liveMergeKeyFields,
    onRuntimeStateChange: (nextRuntimeState) => {
      setRuntimeState(nextRuntimeState);
      onRuntimeStateEvent?.(nextRuntimeState);
    },
    resolvedInputs,
    runtimeRetention: runtimeRowSelector?.limit ? { maxRows: runtimeRowSelector.limit } : undefined,
    runtimeRowSelector,
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

function Harness({
  initialRuntimeState,
  liveMergeKeyFields,
  resolvedInputs,
  runtimeDataStore,
  runtimeRowSelector,
  onSnapshot,
  onRuntimeStateEvent,
}: {
  initialRuntimeState?: Record<string, unknown>;
  liveMergeKeyFields?: string[];
  resolvedInputs?: ResolvedWidgetInputs;
  runtimeDataStore?: RuntimeDataStore;
  runtimeRowSelector?: RuntimeRowSelector;
  onSnapshot: (snapshot: SnapshotState) => void;
  onRuntimeStateEvent?: (runtimeState: Record<string, unknown> | undefined) => void;
}) {
  const content = (
    <HarnessContent
      initialRuntimeState={initialRuntimeState}
      liveMergeKeyFields={liveMergeKeyFields}
      resolvedInputs={resolvedInputs}
      runtimeRowSelector={runtimeRowSelector}
      onSnapshot={onSnapshot}
      onRuntimeStateEvent={onRuntimeStateEvent}
    />
  );

  return runtimeDataStore
    ? <RuntimeDataStoreProvider store={runtimeDataStore}>{content}</RuntimeDataStoreProvider>
    : content;
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

function createHarness(
  runtimeDataStore?: RuntimeDataStore,
  runtimeRowSelector?: RuntimeRowSelector,
  liveMergeKeyFields?: string[],
  initialRuntimeState?: Record<string, unknown>,
): HarnessDriver {
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
            initialRuntimeState={initialRuntimeState}
            liveMergeKeyFields={liveMergeKeyFields}
            resolvedInputs={resolvedInputs}
            runtimeDataStore={runtimeDataStore}
            runtimeRowSelector={runtimeRowSelector}
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

  it("preserves interaction runtime state when retained frames are republished", async () => {
    const initialRuntimeState = {
      ...frame([{ time: "2026-04-29T00:00:00.000Z", value: 1 }], 50),
      interaction: {
        selection: {
          mode: "cell",
          activeCell: {
            rowIndex: 0,
            rowKey: '["uid:BTCUSDT"]',
            columnKey: "Symbol",
            value: "BTCUSDT",
          },
        },
      },
    };
    const harness = createHarness(undefined, undefined, undefined, initialRuntimeState);
    harnesses.push(harness);

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        TABULAR_SEED_INPUT_ID,
        [{ time: "2026-04-29T00:05:00.000Z", value: 2 }],
        100,
      ),
    });

    expect(harness.getSnapshot()?.runtimeState).toMatchObject({
      interaction: initialRuntimeState.interaction,
      rows: [{ time: "2026-04-29T00:05:00.000Z", value: 2 }],
    });

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        TABULAR_SEED_INPUT_ID,
        [{ time: "2026-04-29T00:10:00.000Z", value: 3 }],
        200,
      ),
    });

    expect(harness.getSnapshot()?.runtimeState).toMatchObject({
      interaction: initialRuntimeState.interaction,
      rows: [{ time: "2026-04-29T00:10:00.000Z", value: 3 }],
    });
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

  it("can append live updates even when source diagnostics advertise merge keys", async () => {
    const harness = createHarness(undefined, undefined, []);
    harnesses.push(harness);

    await harness.render({
      [TABULAR_LIVE_UPDATES_INPUT_ID]: buildUpdatesInput({
        inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
        publicationRole: "update",
        sourceRunId: "ws-run-append-for-chart",
        baseRows: [
          {
            time: "2026-04-29T00:00:00.000Z",
            value: 1,
            symbol: "BTCUSDT",
          },
        ],
        deltaRows: [
          {
            time: "2026-04-29T00:00:00.000Z",
            value: 1,
            symbol: "BTCUSDT",
          },
        ],
        updatedAtMs: 100,
        mergeKeyFields: ["symbol"],
      }),
    });

    await harness.render({
      [TABULAR_LIVE_UPDATES_INPUT_ID]: buildUpdatesInput({
        inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
        publicationRole: "update",
        sourceRunId: "ws-run-append-for-chart",
        baseRows: [
          {
            time: "2026-04-29T00:01:00.000Z",
            value: 2,
            symbol: "BTCUSDT",
          },
        ],
        deltaRows: [
          {
            time: "2026-04-29T00:01:00.000Z",
            value: 2,
            symbol: "BTCUSDT",
          },
        ],
        updatedAtMs: 200,
        mergeKeyFields: ["symbol"],
      }),
    });

    expect(harness.getSnapshot()?.dataset?.rows).toEqual([
      {
        time: "2026-04-29T00:00:00.000Z",
        value: 1,
        symbol: "BTCUSDT",
      },
      {
        time: "2026-04-29T00:01:00.000Z",
        value: 2,
        symbol: "BTCUSDT",
      },
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

  it("does not republish by-value publications when only updatedAtMs changes", async () => {
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
        sourceRunId: "ws-run-volatile-timestamp",
        baseRows: [
          { time: "2026-04-29T00:00:00.000Z", value: 1 },
          { time: "2026-04-29T00:01:00.000Z", value: 2 },
        ],
        deltaRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
        updatedAtMs: 200,
        mergeKeyFields: ["time"],
      }),
    });
    const runtimeEventCountAfterFirstRender = harness.getRuntimeEventCount();

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        TABULAR_SEED_INPUT_ID,
        [{ time: "2026-04-29T00:00:00.000Z", value: 1 }],
        900,
      ),
      [TABULAR_LIVE_UPDATES_INPUT_ID]: buildUpdatesInput({
        inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
        publicationRole: "update",
        sourceRunId: "ws-run-volatile-timestamp",
        baseRows: [
          { time: "2026-04-29T00:00:00.000Z", value: 1 },
          { time: "2026-04-29T00:01:00.000Z", value: 2 },
        ],
        deltaRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
        updatedAtMs: 901,
        mergeKeyFields: ["time"],
      }),
    });

    expect(harness.getRuntimeEventCount()).toBe(runtimeEventCountAfterFirstRender);
    expect(harness.getSnapshot()?.dataset?.rows).toEqual([
      { time: "2026-04-29T00:00:00.000Z", value: 1 },
      { time: "2026-04-29T00:01:00.000Z", value: 2 },
    ]);
  });

  it("does not republish equivalent ref-backed live state on a stable rerender", async () => {
    const runtimeDataStore = createRuntimeDataStore("workspace-1");
    const harness = createHarness(runtimeDataStore);
    harnesses.push(harness);

    const resolvedInputs = {
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

  it("waits for the seed baseline before exposing live-only rows when seedData is bound", async () => {
    const harness = createHarness(createRuntimeDataStore("workspace-1"));
    harnesses.push(harness);
    const liveInput = buildUpdatesInput({
      inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
      publicationRole: "update",
      sourceRunId: "ws-run-live-only",
      baseRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
      deltaRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
      updatedAtMs: 200,
      mergeKeyFields: ["time"],
    });

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildPendingSeedInput(),
      [TABULAR_LIVE_UPDATES_INPUT_ID]: liveInput,
    });

    expect(harness.getSnapshot()?.dataset?.status).toBe("loading");
    expect(harness.getSnapshot()?.dataset?.rows).toEqual([]);

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        TABULAR_SEED_INPUT_ID,
        [{ time: "2026-04-29T00:00:00.000Z", value: 1 }],
        100,
      ),
      [TABULAR_LIVE_UPDATES_INPUT_ID]: liveInput,
    });

    expect(harness.getSnapshot()?.dataset?.rows).toEqual([
      { time: "2026-04-29T00:00:00.000Z", value: 1 },
      { time: "2026-04-29T00:01:00.000Z", value: 2 },
    ]);
  });

  it("waits for a non-empty seed baseline when live updates arrive before historical rows", async () => {
    const harness = createHarness(createRuntimeDataStore("workspace-1"));
    harnesses.push(harness);
    const liveInput = buildUpdatesInput({
      inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
      publicationRole: "update",
      sourceRunId: "ws-run-live-first",
      baseRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
      deltaRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
      updatedAtMs: 200,
      mergeKeyFields: ["time"],
    });

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(TABULAR_SEED_INPUT_ID, [], 100),
      [TABULAR_LIVE_UPDATES_INPUT_ID]: liveInput,
    });

    expect(harness.getSnapshot()?.dataset?.status).toBe("loading");
    expect(harness.getSnapshot()?.dataset?.rows).toEqual([]);

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        TABULAR_SEED_INPUT_ID,
        [{ time: "2026-04-29T00:00:00.000Z", value: 1 }],
        150,
      ),
      [TABULAR_LIVE_UPDATES_INPUT_ID]: liveInput,
    });

    expect(harness.getSnapshot()?.dataset?.rows).toEqual([
      { time: "2026-04-29T00:00:00.000Z", value: 1 },
      { time: "2026-04-29T00:01:00.000Z", value: 2 },
    ]);
  });

  it("does not clear an existing combined dataset when the live lane temporarily becomes empty", async () => {
    const harness = createHarness(createRuntimeDataStore("workspace-1"));
    harnesses.push(harness);
    const seedInput = buildSeedInput(
      TABULAR_SEED_INPUT_ID,
      [{ time: "2026-04-29T00:00:00.000Z", value: 1 }],
      100,
    );

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: seedInput,
      [TABULAR_LIVE_UPDATES_INPUT_ID]: buildUpdatesInput({
        inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
        publicationRole: "update",
        sourceRunId: "ws-run-live",
        baseRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
        deltaRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
        updatedAtMs: 200,
        mergeKeyFields: ["time"],
      }),
    });

    expect(harness.getSnapshot()?.dataset?.rows).toEqual([
      { time: "2026-04-29T00:00:00.000Z", value: 1 },
      { time: "2026-04-29T00:01:00.000Z", value: 2 },
    ]);

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: seedInput,
      [TABULAR_LIVE_UPDATES_INPUT_ID]: buildUpdatesInput({
        inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
        publicationRole: "update",
        sourceRunId: "ws-run-reconnecting",
        baseRows: [],
        updatedAtMs: 300,
        mergeKeyFields: ["time"],
      }),
    });

    expect(harness.getSnapshot()?.dataset?.status).toBe("ready");
    expect(harness.getSnapshot()?.dataset?.rows).toEqual([
      { time: "2026-04-29T00:00:00.000Z", value: 1 },
    ]);
  });

  it("does not materialize live-only output frames while seedData is still awaiting upstream", () => {
    const frame = resolveIncrementalTabularOutputFrame({
      resolvedInputs: {
        [TABULAR_SEED_INPUT_ID]: buildPendingSeedInput(),
        [TABULAR_LIVE_UPDATES_INPUT_ID]: buildUpdatesInput({
          inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
          publicationRole: "update",
          sourceRunId: "ws-run-live-only",
          baseRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
          deltaRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
          updatedAtMs: 200,
          mergeKeyFields: ["time"],
        }),
      },
    });

    expect(frame).toBeNull();
  });

  it("does not materialize live-only output frames while seedData is valid but empty", () => {
    const frame = resolveIncrementalTabularOutputFrame({
      resolvedInputs: {
        [TABULAR_SEED_INPUT_ID]: buildSeedInput(TABULAR_SEED_INPUT_ID, [], 100),
        [TABULAR_LIVE_UPDATES_INPUT_ID]: buildUpdatesInput({
          inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
          publicationRole: "update",
          sourceRunId: "ws-run-live-first",
          baseRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
          deltaRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
          updatedAtMs: 200,
          mergeKeyFields: ["time"],
        }),
      },
    });

    expect(frame).toBeNull();
  });

  it("treats idle seed datasets as awaiting upstream instead of empty ready output", () => {
    const resolvedInputs = {
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        TABULAR_SEED_INPUT_ID,
        [],
        100,
        "idle",
      ),
    } satisfies ResolvedWidgetInputs;

    expect(
      resolveIncrementalTabularOutputFrame({
        resolvedInputs,
      }),
    ).toBeNull();

    const snapshot = resolveIncrementalTabularBindingSnapshot({
      resolvedInputs,
    });

    expect(snapshot.active).toBe(true);
    expect(snapshot.dataset).toBeNull();
    expect(snapshot.consumerState.kind).toBe("awaiting-upstream");
    expect(snapshot.consumerState.requiresUpstreamResolution).toBe(true);
  });

  it("combines seedData and liveUpdates frames in preview resolution", () => {
    const frame = resolveIncrementalTabularOutputFrame({
      resolvedInputs: {
        [TABULAR_SEED_INPUT_ID]: buildSeedInput(
          TABULAR_SEED_INPUT_ID,
          [{ time: "2026-04-29T00:00:00.000Z", value: 1 }],
          100,
        ),
        [TABULAR_LIVE_UPDATES_INPUT_ID]: buildUpdatesInput({
          inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
          publicationRole: "update",
          sourceRunId: "ws-run-preview-union",
          baseRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
          deltaRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
          updatedAtMs: 200,
          mergeKeyFields: ["time"],
        }),
      },
    });

    expect(frame?.rows).toEqual([
      { time: "2026-04-29T00:00:00.000Z", value: 1 },
      { time: "2026-04-29T00:01:00.000Z", value: 2 },
    ]);
    expect(frame?.status).toBe("ready");
  });

  it("keeps dual-source snapshot state anchored to the seed lane", () => {
    const snapshot = resolveIncrementalTabularBindingSnapshot({
      resolvedInputs: {
        [TABULAR_SEED_INPUT_ID]: buildSeedInput(
          TABULAR_SEED_INPUT_ID,
          [{ time: "2026-04-29T00:00:00.000Z", value: 1 }],
          100,
        ),
        [TABULAR_LIVE_UPDATES_INPUT_ID]: buildUpdatesInput({
          inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
          publicationRole: "update",
          sourceRunId: "ws-run-anchor",
          baseRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
          deltaRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
          updatedAtMs: 200,
          mergeKeyFields: ["time"],
        }),
      },
    });

    expect(snapshot.consumerState.sourceWidgetId).toBe("seed-source");
    expect(snapshot.dataset?.rows).toEqual([
      { time: "2026-04-29T00:00:00.000Z", value: 1 },
      { time: "2026-04-29T00:01:00.000Z", value: 2 },
    ]);
  });

  it("keeps retained history visible when the live lane temporarily reports loading", async () => {
    const harness = createHarness();
    harnesses.push(harness);
    const seedInput = buildSeedInput(
      TABULAR_SEED_INPUT_ID,
      [{ time: "2026-04-29T00:00:00.000Z", value: 1 }],
      100,
    );

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: seedInput,
      [TABULAR_LIVE_UPDATES_INPUT_ID]: buildUpdatesInput({
        inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
        publicationRole: "update",
        sourceRunId: "ws-run-live",
        baseRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
        deltaRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
        updatedAtMs: 200,
        mergeKeyFields: ["time"],
      }),
    });

    expect(harness.getSnapshot()?.dataset?.rows).toEqual([
      { time: "2026-04-29T00:00:00.000Z", value: 1 },
      { time: "2026-04-29T00:01:00.000Z", value: 2 },
    ]);

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: seedInput,
      [TABULAR_LIVE_UPDATES_INPUT_ID]: buildUpdatesInput({
        inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
        publicationRole: "update",
        sourceRunId: "ws-run-live",
        baseRows: [],
        updatedAtMs: 300,
        baseStatus: "loading",
        mergeKeyFields: ["time"],
      }),
    });

    expect(harness.getSnapshot()?.dataset?.status).toBe("ready");
    expect(harness.getSnapshot()?.dataset?.rows).toEqual([
      { time: "2026-04-29T00:00:00.000Z", value: 1 },
    ]);
  });

  it("keys ref-backed publication stability by ref version instead of materialized timestamps", async () => {
    const runtimeDataStore = createRuntimeDataStore("workspace-1");
    const harness = createHarness(runtimeDataStore);
    harnesses.push(harness);
    const baseRef = runtimeDataStore.putSnapshot({
      ownerId: "live-source",
      outputId: "dataset",
      frame: frame(
        [
          { time: "2026-04-29T00:00:00.000Z", value: 1 },
          { time: "2026-04-29T00:01:00.000Z", value: 2 },
        ],
        200,
      ),
    });
    const deltaRef = runtimeDataStore.putSnapshot({
      ownerId: "live-source",
      outputId: "updates:delta",
      frame: frame([{ time: "2026-04-29T00:01:00.000Z", value: 2 }], 201),
    });
    const upstreamUpdate = {
      contractVersion: "widget-runtime-update@v1" as const,
      mode: "delta" as const,
      publicationSemantics: "incremental" as const,
      publicationRole: "update" as const,
      sourceRunId: "ws-ref-stable",
      sourceOutputId: "updates",
      outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      retainedOutputLocation: "carrier" as const,
      retainedOutputRef: baseRef,
      outputRef: baseRef,
      deltaOutputRef: deltaRef,
      diagnostics: { mergeKeyFields: ["time"] },
    };
    const carrier = attachWidgetRuntimeUpdateContext(frame([], 202), upstreamUpdate);
    const resolvedInputs = {
      [TABULAR_LIVE_UPDATES_INPUT_ID]: {
        inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
        label: TABULAR_LIVE_UPDATES_INPUT_ID,
        status: "valid",
        sourceWidgetId: "live-source",
        sourceOutputId: "updates",
        contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        value: carrier,
        valueRef: baseRef,
        upstreamBase: carrier,
        upstreamBaseRef: baseRef,
        upstreamDeltaRef: deltaRef,
        upstreamUpdate,
      },
    } satisfies ResolvedWidgetInputs;

    await harness.render(resolvedInputs);
    const runtimeEventCountAfterFirstRender = harness.getRuntimeEventCount();

    const baseFrame = runtimeDataStore.readFrame(baseRef);
    const deltaFrame = runtimeDataStore.readFrame(deltaRef);

    if (baseFrame?.source) {
      baseFrame.source.updatedAtMs = 999;
    }
    if (deltaFrame?.source) {
      deltaFrame.source.updatedAtMs = 1000;
    }

    await harness.render(resolvedInputs);

    expect(harness.getRuntimeEventCount()).toBe(runtimeEventCountAfterFirstRender);
  });

  it("does not republish ref-backed dual-role state when only carrier metadata changes", async () => {
    const runtimeDataStore = createRuntimeDataStore("workspace-1");
    const harness = createHarness(runtimeDataStore);
    harnesses.push(harness);
    const seedRef = runtimeDataStore.putSnapshot({
      ownerId: "seed-source",
      outputId: "dataset",
      frame: frame([{ time: "2026-04-29T00:00:00.000Z", value: 1 }], 100),
    });
    const liveBaseRef = runtimeDataStore.putSnapshot({
      ownerId: "live-source",
      outputId: "updates",
      frame: frame(
        [
          { time: "2026-04-29T00:00:00.000Z", value: 1 },
          { time: "2026-04-29T00:01:00.000Z", value: 2 },
        ],
        200,
      ),
    });
    const liveDeltaRef = runtimeDataStore.putSnapshot({
      ownerId: "live-source",
      outputId: "updates:delta",
      frame: frame([{ time: "2026-04-29T00:01:00.000Z", value: 2 }], 201),
    });

    const firstResolvedInputs = {
      [TABULAR_SEED_INPUT_ID]: {
        inputId: TABULAR_SEED_INPUT_ID,
        label: TABULAR_SEED_INPUT_ID,
        status: "valid",
        sourceWidgetId: "seed-source",
        sourceOutputId: "dataset",
        contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        value: attachWidgetRuntimeUpdateContext(frame([], 110), {
          contractVersion: "widget-runtime-update@v1",
          mode: "snapshot",
          publicationSemantics: "incremental",
          publicationRole: "seed",
          sourceRunId: "seed-run-1",
          sourceOutputId: "dataset",
          outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          retainedOutputLocation: "carrier",
          retainedOutputRef: seedRef,
          outputRef: seedRef,
        }),
        valueRef: seedRef,
        upstreamBaseRef: seedRef,
      },
      [TABULAR_LIVE_UPDATES_INPUT_ID]: {
        inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
        label: TABULAR_LIVE_UPDATES_INPUT_ID,
        status: "valid",
        sourceWidgetId: "live-source",
        sourceOutputId: "updates",
        contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        value: attachWidgetRuntimeUpdateContext(frame([], 210), {
          contractVersion: "widget-runtime-update@v1",
          mode: "delta",
          publicationSemantics: "incremental",
          publicationRole: "update",
          sourceRunId: "ws-run-1",
          sequence: 10,
          sourceOutputId: "updates",
          outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          retainedOutputLocation: "carrier",
          retainedOutputRef: liveBaseRef,
          outputRef: liveBaseRef,
          deltaOutputRef: liveDeltaRef,
          diagnostics: { mergeKeyFields: ["time"] },
        }),
        valueRef: liveBaseRef,
        upstreamBaseRef: liveBaseRef,
        upstreamDeltaRef: liveDeltaRef,
        upstreamUpdate: {
          contractVersion: "widget-runtime-update@v1",
          mode: "delta",
          publicationSemantics: "incremental",
          publicationRole: "update",
          sourceRunId: "ws-run-1",
          sequence: 10,
          sourceOutputId: "updates",
          outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          retainedOutputLocation: "carrier",
          retainedOutputRef: liveBaseRef,
          outputRef: liveBaseRef,
          deltaOutputRef: liveDeltaRef,
          diagnostics: { mergeKeyFields: ["time"] },
        },
      },
    } satisfies ResolvedWidgetInputs;

    await harness.render(firstResolvedInputs);
    const eventCountAfterFirstRender = harness.getRuntimeEventCount();

    const secondResolvedInputs = {
      ...firstResolvedInputs,
      [TABULAR_LIVE_UPDATES_INPUT_ID]: {
        ...firstResolvedInputs[TABULAR_LIVE_UPDATES_INPUT_ID],
        value: attachWidgetRuntimeUpdateContext(frame([], 999), {
          contractVersion: "widget-runtime-update@v1",
          mode: "delta",
          publicationSemantics: "incremental",
          publicationRole: "update",
          sourceRunId: "ws-run-1",
          sequence: 11,
          sourceOutputId: "updates",
          outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          retainedOutputLocation: "carrier",
          retainedOutputRef: liveBaseRef,
          outputRef: liveBaseRef,
          deltaOutputRef: liveDeltaRef,
          diagnostics: { mergeKeyFields: ["time"] },
        }),
        upstreamUpdate: {
          contractVersion: "widget-runtime-update@v1",
          mode: "delta",
          publicationSemantics: "incremental",
          publicationRole: "update",
          sourceRunId: "ws-run-1",
          sequence: 11,
          sourceOutputId: "updates",
          outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          retainedOutputLocation: "carrier",
          retainedOutputRef: liveBaseRef,
          outputRef: liveBaseRef,
          deltaOutputRef: liveDeltaRef,
          diagnostics: { mergeKeyFields: ["time"] },
        },
      },
    } satisfies ResolvedWidgetInputs;

    await harness.render(secondResolvedInputs);

    expect(harness.getRuntimeEventCount()).toBe(eventCountAfterFirstRender);
  });

  it("advances ref-backed dual-role reductions exactly once for a new live delta publication", async () => {
    const runtimeDataStore = createRuntimeDataStore("workspace-1");
    const harness = createHarness(runtimeDataStore);
    harnesses.push(harness);
    const seedRef = runtimeDataStore.putSnapshot({
      ownerId: "seed-source",
      outputId: "dataset",
      frame: frame([{ time: "2026-04-29T00:00:00.000Z", value: 1 }], 100),
    });
    const liveBaseRefV1 = runtimeDataStore.putSnapshot({
      ownerId: "live-source",
      outputId: "updates",
      frame: frame(
        [
          { time: "2026-04-29T00:00:00.000Z", value: 1 },
          { time: "2026-04-29T00:01:00.000Z", value: 2 },
        ],
        200,
      ),
    });
    const liveDeltaRefV1 = runtimeDataStore.putSnapshot({
      ownerId: "live-source",
      outputId: "updates:delta",
      frame: frame([{ time: "2026-04-29T00:01:00.000Z", value: 2 }], 201),
    });

    const firstResolvedInputs = {
      [TABULAR_SEED_INPUT_ID]: {
        inputId: TABULAR_SEED_INPUT_ID,
        label: TABULAR_SEED_INPUT_ID,
        status: "valid",
        sourceWidgetId: "seed-source",
        sourceOutputId: "dataset",
        contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        value: attachWidgetRuntimeUpdateContext(frame([], 110), {
          contractVersion: "widget-runtime-update@v1",
          mode: "snapshot",
          publicationSemantics: "incremental",
          publicationRole: "seed",
          sourceRunId: "seed-run-1",
          sourceOutputId: "dataset",
          outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          retainedOutputLocation: "carrier",
          retainedOutputRef: seedRef,
          outputRef: seedRef,
        }),
        valueRef: seedRef,
        upstreamBaseRef: seedRef,
      },
      [TABULAR_LIVE_UPDATES_INPUT_ID]: {
        inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
        label: TABULAR_LIVE_UPDATES_INPUT_ID,
        status: "valid",
        sourceWidgetId: "live-source",
        sourceOutputId: "updates",
        contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        value: attachWidgetRuntimeUpdateContext(frame([], 210), {
          contractVersion: "widget-runtime-update@v1",
          mode: "delta",
          publicationSemantics: "incremental",
          publicationRole: "update",
          sourceRunId: "ws-run-1",
          sequence: 10,
          sourceOutputId: "updates",
          outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          retainedOutputLocation: "carrier",
          retainedOutputRef: liveBaseRefV1,
          outputRef: liveBaseRefV1,
          deltaOutputRef: liveDeltaRefV1,
          diagnostics: { mergeKeyFields: ["time"] },
        }),
        valueRef: liveBaseRefV1,
        upstreamBaseRef: liveBaseRefV1,
        upstreamDeltaRef: liveDeltaRefV1,
        upstreamUpdate: {
          contractVersion: "widget-runtime-update@v1",
          mode: "delta",
          publicationSemantics: "incremental",
          publicationRole: "update",
          sourceRunId: "ws-run-1",
          sequence: 10,
          sourceOutputId: "updates",
          outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          retainedOutputLocation: "carrier",
          retainedOutputRef: liveBaseRefV1,
          outputRef: liveBaseRefV1,
          deltaOutputRef: liveDeltaRefV1,
          diagnostics: { mergeKeyFields: ["time"] },
        },
      },
    } satisfies ResolvedWidgetInputs;

    await harness.render(firstResolvedInputs);
    const eventCountAfterFirstRender = harness.getRuntimeEventCount();

    const liveBaseRefV2 = runtimeDataStore.putSnapshot({
      ownerId: "live-source",
      outputId: "updates",
      frame: frame(
        [
          { time: "2026-04-29T00:00:00.000Z", value: 1 },
          { time: "2026-04-29T00:01:00.000Z", value: 2 },
          { time: "2026-04-29T00:02:00.000Z", value: 3 },
        ],
        300,
      ),
    });
    const liveDeltaRefV2 = runtimeDataStore.putSnapshot({
      ownerId: "live-source",
      outputId: "updates:delta",
      frame: frame([{ time: "2026-04-29T00:02:00.000Z", value: 3 }], 301),
    });

    const secondResolvedInputs = {
      ...firstResolvedInputs,
      [TABULAR_LIVE_UPDATES_INPUT_ID]: {
        ...firstResolvedInputs[TABULAR_LIVE_UPDATES_INPUT_ID],
        value: attachWidgetRuntimeUpdateContext(frame([], 310), {
          contractVersion: "widget-runtime-update@v1",
          mode: "delta",
          publicationSemantics: "incremental",
          publicationRole: "update",
          sourceRunId: "ws-run-1",
          sequence: 11,
          sourceOutputId: "updates",
          outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          retainedOutputLocation: "carrier",
          retainedOutputRef: liveBaseRefV2,
          outputRef: liveBaseRefV2,
          deltaOutputRef: liveDeltaRefV2,
          diagnostics: { mergeKeyFields: ["time"] },
        }),
        valueRef: liveBaseRefV2,
        upstreamBaseRef: liveBaseRefV2,
        upstreamDeltaRef: liveDeltaRefV2,
        upstreamUpdate: {
          contractVersion: "widget-runtime-update@v1",
          mode: "delta",
          publicationSemantics: "incremental",
          publicationRole: "update",
          sourceRunId: "ws-run-1",
          sequence: 11,
          sourceOutputId: "updates",
          outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          retainedOutputLocation: "carrier",
          retainedOutputRef: liveBaseRefV2,
          outputRef: liveBaseRefV2,
          deltaOutputRef: liveDeltaRefV2,
          diagnostics: { mergeKeyFields: ["time"] },
        },
      },
    } satisfies ResolvedWidgetInputs;

    await harness.render(secondResolvedInputs);

    expect(harness.getRuntimeEventCount()).toBe(eventCountAfterFirstRender + 1);
    expect(harness.getSnapshot()?.dataset?.rows).toEqual([
      { time: "2026-04-29T00:00:00.000Z", value: 1 },
      { time: "2026-04-29T00:01:00.000Z", value: 2 },
      { time: "2026-04-29T00:02:00.000Z", value: 3 },
    ]);
  });

  it("stores consumer runtime state as refs when a runtime data store is available", async () => {
    const runtimeDataStore = createRuntimeDataStore("workspace-1");
    const sourceFrame = frame(
      [
        { time: "2026-04-29T00:00:00.000Z", value: 1 },
        { time: "2026-04-29T00:01:00.000Z", value: 2 },
      ],
      100,
    );
    const sourceShell = storeTabularFrameRuntimeState({
      frame: sourceFrame,
      ownerId: "seed-source",
      outputId: "dataset",
      store: runtimeDataStore,
    });
    const sourceRef = getRuntimeDataRef(sourceShell);
    const harness = createHarness(runtimeDataStore);
    harnesses.push(harness);

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: {
        inputId: TABULAR_SEED_INPUT_ID,
        label: TABULAR_SEED_INPUT_ID,
        status: "valid",
        sourceWidgetId: "seed-source",
        sourceOutputId: "dataset",
        contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        value: sourceShell,
        valueRef: sourceRef,
        upstreamBase: sourceShell,
        upstreamBaseRef: sourceRef,
      },
    });

    const snapshot = harness.getSnapshot();
    const runtimeState = snapshot?.runtimeState as
      | { rows?: unknown[]; source?: { context?: { incrementalConsumer?: Record<string, unknown> } } }
      | undefined;
    const consumerMeta = runtimeState?.source?.context?.incrementalConsumer;

    expect(snapshot?.dataset?.rows).toEqual(sourceFrame.rows);
    expect(runtimeState?.rows).toEqual([]);
    expect(getRuntimeDataRef(snapshot?.runtimeState)?.rowCount).toBe(2);
    expect(consumerMeta?.seedRef).toMatchObject({
      kind: "runtime-data-ref",
      rowCount: 2,
    });
    expect(consumerMeta?.outputRef).toMatchObject({
      kind: "runtime-data-ref",
      rowCount: 2,
    });
    expect(consumerMeta?.seedFrame).toBeNull();
    expect(consumerMeta?.liveFrame).toBeNull();
  });

  it("replaces by-value seed refs when seedData changes with a runtime data store", async () => {
    const runtimeDataStore = createRuntimeDataStore("workspace-1");
    const harness = createHarness(runtimeDataStore);
    harnesses.push(harness);

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        TABULAR_SEED_INPUT_ID,
        [{ time: "2026-04-29T00:00:00.000Z", value: 1 }],
        100,
      ),
    });

    const firstRuntimeState = harness.getSnapshot()?.runtimeState as
      | { source?: { context?: { incrementalConsumer?: Record<string, unknown> } } }
      | undefined;
    const firstConsumerMeta = firstRuntimeState?.source?.context?.incrementalConsumer;
    const firstSeedVersion =
      typeof (firstConsumerMeta?.seedRef as { version?: unknown } | undefined)?.version === "number"
        ? (firstConsumerMeta?.seedRef as { version: number }).version
        : 0;

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        TABULAR_SEED_INPUT_ID,
        [{ time: "2026-04-29T00:05:00.000Z", value: 5 }],
        200,
      ),
    });

    const snapshot = harness.getSnapshot();
    const runtimeState = snapshot?.runtimeState as
      | {
          rows?: unknown[];
          source?: { context?: { incrementalConsumer?: Record<string, unknown> } };
        }
      | undefined;
    const consumerMeta = runtimeState?.source?.context?.incrementalConsumer;

    expect(snapshot?.dataset?.rows).toEqual([
      { time: "2026-04-29T00:05:00.000Z", value: 5 },
    ]);
    expect(runtimeState?.rows).toEqual([]);
    expect(getRuntimeDataRef(snapshot?.runtimeState)?.rowCount).toBe(1);
    expect((consumerMeta?.seedRef as { version?: number } | undefined)?.version).toBeGreaterThan(
      firstSeedVersion,
    );
    expect(consumerMeta?.seedFrame).toBeNull();
    expect(consumerMeta?.liveFrame).toBeNull();
  });

  it("applies runtime row selectors to ref-backed consumer output", async () => {
    const runtimeDataStore = createRuntimeDataStore("workspace-1");
    const harness = createHarness(runtimeDataStore, { direction: "latest", limit: 2 });
    harnesses.push(harness);

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        TABULAR_SEED_INPUT_ID,
        [
          { time: "2026-04-29T00:00:00.000Z", value: 1 },
          { time: "2026-04-29T00:01:00.000Z", value: 2 },
          { time: "2026-04-29T00:02:00.000Z", value: 3 },
        ],
        100,
      ),
    });

    const snapshot = harness.getSnapshot();
    const outputRef = getRuntimeDataRef(snapshot?.runtimeState);

    expect(snapshot?.dataset?.rows).toEqual([
      { time: "2026-04-29T00:01:00.000Z", value: 2 },
      { time: "2026-04-29T00:02:00.000Z", value: 3 },
    ]);
    expect(outputRef?.rowCount).toBe(2);
    expect(outputRef ? runtimeDataStore.readFrame(outputRef)?.rows : null).toEqual([
      { time: "2026-04-29T00:01:00.000Z", value: 2 },
      { time: "2026-04-29T00:02:00.000Z", value: 3 },
    ]);
  });
});
