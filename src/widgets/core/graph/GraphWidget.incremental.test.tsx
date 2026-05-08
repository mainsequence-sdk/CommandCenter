/** @vitest-environment jsdom */

import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WidgetDefinition } from "@/widgets/types";
import type { GraphWidgetProps } from "./graphModel";

vi.mock("./TradingViewSeriesChart", () => ({
  TradingViewSeriesChart: (props: Record<string, unknown>) => {
    (globalThis as typeof globalThis & {
      __graphLastTradingViewProps?: Record<string, unknown>;
    }).__graphLastTradingViewProps = props;
    return null;
  },
}));

vi.mock("./EChartsSeriesChart", () => ({
  EChartsSeriesChart: () => null,
}));

vi.mock("./GraphChartErrorBoundary", () => ({
  GraphChartErrorBoundary: ({ children }: { children: ReactNode }) => children,
}));

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
  { TABULAR_SEED_INPUT_ID },
  { GraphWidget },
] = await Promise.all([
  import("@/widgets/shared/tabular-frame-source"),
  import("@/widgets/shared/runtime-update"),
  import("@/widgets/shared/incremental-tabular-consumer"),
  import("./GraphWidget"),
]);

type ResolvedWidgetInput = import("@/widgets/types").ResolvedWidgetInput;
type ResolvedWidgetInputs = import("@/widgets/types").ResolvedWidgetInputs;
type TabularFrameSourceV1 = import("@/widgets/shared/tabular-frame-source").TabularFrameSourceV1;

const graphWidgetStub = { id: "graph" } as WidgetDefinition<Record<string, unknown>>;

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
  rows: Array<Record<string, unknown>>,
  updatedAtMs: number,
): ResolvedWidgetInput {
  const baseFrame = frame(rows, updatedAtMs);
  const published = attachWidgetRuntimeUpdateContext(baseFrame, {
    contractVersion: "widget-runtime-update@v1",
    mode: "snapshot",
    publicationSemantics: "incremental",
    publicationRole: "seed",
    sourceRunId: "seed-http-run",
    sourceOutputId: "dataset",
    outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    retainedOutputLocation: "carrier",
  });
  const projected = projectWidgetRuntimeUpdateOutput(published, {
    sourceOutputId: "updates",
    outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  });
  const parts = resolveWidgetRuntimeUpdateParts<TabularFrameSourceV1, TabularFrameSourceV1>(projected);

  return {
    inputId: TABULAR_SEED_INPUT_ID,
    label: TABULAR_SEED_INPUT_ID,
    status: "valid",
    sourceWidgetId: "seed-source",
    sourceOutputId: "updates",
    contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    value: projected,
    upstreamBase: parts.upstreamBase,
    upstreamDelta: parts.upstreamDelta,
    upstreamUpdate: parts.upstreamUpdate,
  };
}

function buildLiveInput(input: {
  role?: "seed" | "update";
  baseRows: Array<Record<string, unknown>>;
  deltaRows?: Array<Record<string, unknown>>;
  sourceRunId: string;
  updatedAtMs: number;
}): ResolvedWidgetInput {
  const baseFrame = frame(input.baseRows, input.updatedAtMs);
  const deltaFrame = input.deltaRows
    ? frame(input.deltaRows, input.updatedAtMs + 1)
    : undefined;
  const published = attachWidgetRuntimeUpdateContext(baseFrame, {
    contractVersion: "widget-runtime-update@v1",
    mode: deltaFrame ? "delta" : "snapshot",
    publicationSemantics: "incremental",
    publicationRole: input.role ?? "update",
    sourceRunId: input.sourceRunId,
    sourceOutputId: "dataset",
    outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    deltaOutput: deltaFrame,
    retainedOutputLocation: "carrier",
  });
  const projected = projectWidgetRuntimeUpdateOutput(published, {
    sourceOutputId: "updates",
    outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  });
  const parts = resolveWidgetRuntimeUpdateParts<TabularFrameSourceV1, TabularFrameSourceV1>(projected);

  return {
    inputId: "liveUpdates",
    label: "liveUpdates",
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

function Harness({
  resolvedInputs,
  onRuntimeStateEvent,
  props,
}: {
  resolvedInputs?: ResolvedWidgetInputs;
  onRuntimeStateEvent: (runtimeState: Record<string, unknown> | undefined) => void;
  props?: GraphWidgetProps;
}) {
  const [runtimeState, setRuntimeState] = useState<Record<string, unknown> | undefined>(undefined);

  return (
    <GraphWidget
      widget={graphWidgetStub}
      props={{
        provider: "tradingview",
        chartType: "line",
        xField: "time",
        yField: "value",
        ...props,
      }}
      presentation={undefined}
      instanceId="graph-1"
      editable={false}
      runtimeState={runtimeState}
      resolvedInputs={resolvedInputs}
      onRuntimeStateChange={(nextRuntimeState) => {
        setRuntimeState(nextRuntimeState);
        onRuntimeStateEvent(nextRuntimeState);
      }}
    />
  );
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

interface HarnessDriver {
  render: (resolvedInputs?: ResolvedWidgetInputs, props?: GraphWidgetProps) => Promise<void>;
  getRuntimeEventCount: () => number;
  cleanup: () => void;
}

function createHarness(): HarnessDriver {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  let runtimeEventCount = 0;

  return {
    async render(resolvedInputs, props) {
      await act(async () => {
        root.render(
          <Harness
            resolvedInputs={resolvedInputs}
            props={props}
            onRuntimeStateEvent={() => {
              runtimeEventCount += 1;
            }}
          />,
        );
      });
      await flushEffects();
    },
    getRuntimeEventCount: () => runtimeEventCount,
    cleanup() {
      void act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

const harnesses: HarnessDriver[] = [];

afterEach(() => {
  delete (globalThis as typeof globalThis & {
    __graphLastTradingViewProps?: Record<string, unknown>;
  }).__graphLastTradingViewProps;
  while (harnesses.length > 0) {
    harnesses.pop()?.cleanup();
  }
});

describe("GraphWidget incremental bindings", () => {
  it("does not loop on stable incremental seed rerenders", async () => {
    const harness = createHarness();
    harnesses.push(harness);

    const resolvedInputs = {
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        [{ time: "2026-04-29T00:00:00.000Z", value: 1 }],
        100,
      ),
    } satisfies ResolvedWidgetInputs;

    await harness.render(resolvedInputs);
    const firstEventCount = harness.getRuntimeEventCount();

    await harness.render(resolvedInputs);

    expect(harness.getRuntimeEventCount()).toBe(firstEventCount);
  });

  it("uses delta renderer props for tail-safe live updates", async () => {
    const harness = createHarness();
    harnesses.push(harness);

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        [{ time: "2026-04-29T00:00:00.000Z", value: 1 }],
        100,
      ),
    });

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        [{ time: "2026-04-29T00:00:00.000Z", value: 1 }],
        100,
      ),
      liveUpdates: buildLiveInput({
        baseRows: [
          { time: "2026-04-29T00:00:00.000Z", value: 1 },
          { time: "2026-04-29T00:01:00.000Z", value: 2 },
        ],
        deltaRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2 }],
        sourceRunId: "ws-run-1",
        updatedAtMs: 200,
      }),
    });

    const chartProps = (globalThis as typeof globalThis & {
      __graphLastTradingViewProps?: Record<string, unknown>;
    }).__graphLastTradingViewProps;

    expect(chartProps?.updateMode).toBe("delta");
    expect(Array.isArray(chartProps?.deltaSeries)).toBe(true);
    expect((chartProps?.deltaSeries as Array<{ points: Array<unknown> }>)[0]?.points).toEqual([
      { time: Date.parse("2026-04-29T00:01:00.000Z"), value: 2 },
    ]);
  });

  it("resets from snapshot-mode live publications instead of reducing them as deltas", async () => {
    const harness = createHarness();
    harnesses.push(harness);

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        [{ time: "2026-04-29T00:00:00.000Z", value: 1 }],
        100,
      ),
    });

    await harness.render({
      [TABULAR_SEED_INPUT_ID]: buildSeedInput(
        [{ time: "2026-04-29T00:00:00.000Z", value: 1 }],
        100,
      ),
      liveUpdates: buildLiveInput({
        role: "update",
        baseRows: [
          { time: "2026-04-29T00:10:00.000Z", value: 10 },
          { time: "2026-04-29T00:11:00.000Z", value: 11 },
        ],
        sourceRunId: "ws-run-snapshot",
        updatedAtMs: 400,
      }),
    });

    const chartProps = (globalThis as typeof globalThis & {
      __graphLastTradingViewProps?: Record<string, unknown>;
    }).__graphLastTradingViewProps;

    expect(chartProps?.updateMode).toBe("snapshot");
    expect((chartProps?.series as Array<{ points: Array<unknown> }>)[0]?.points).toEqual([
      { time: Date.parse("2026-04-29T00:10:00.000Z"), value: 10 },
      { time: Date.parse("2026-04-29T00:11:00.000Z"), value: 11 },
    ]);
  });

  it("forces stacked TradingView charts onto snapshot updates", async () => {
    const harness = createHarness();
    harnesses.push(harness);

    await harness.render(
      {
        [TABULAR_SEED_INPUT_ID]: buildSeedInput(
          [{ time: "2026-04-29T00:00:00.000Z", value: 1, symbol: "AAPL" }],
          100,
        ),
      },
      {
        groupField: "symbol",
        stackSeries: true,
      },
    );

    await harness.render(
      {
        [TABULAR_SEED_INPUT_ID]: buildSeedInput(
          [{ time: "2026-04-29T00:00:00.000Z", value: 1, symbol: "AAPL" }],
          100,
        ),
        liveUpdates: buildLiveInput({
          baseRows: [
            { time: "2026-04-29T00:00:00.000Z", value: 1, symbol: "AAPL" },
            { time: "2026-04-29T00:01:00.000Z", value: 2, symbol: "AAPL" },
          ],
          deltaRows: [{ time: "2026-04-29T00:01:00.000Z", value: 2, symbol: "AAPL" }],
          sourceRunId: "ws-run-stacked",
          updatedAtMs: 250,
        }),
      },
      {
        groupField: "symbol",
        stackSeries: true,
      },
    );

    const chartProps = (globalThis as typeof globalThis & {
      __graphLastTradingViewProps?: Record<string, unknown>;
    }).__graphLastTradingViewProps;

    expect(chartProps?.stackSeries).toBe(true);
    expect(chartProps?.updateMode).toBe("snapshot");
  });
});
