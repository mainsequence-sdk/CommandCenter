/** @vitest-environment jsdom */

import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockedUseTabularWidgetSourceControllerContext = vi.hoisted(() => vi.fn());

vi.mock("@/widgets/shared/tabular-widget-source", async () => {
  const actual = await vi.importActual<typeof import("@/widgets/shared/tabular-widget-source")>(
    "@/widgets/shared/tabular-widget-source",
  );

  return {
    ...actual,
    useTabularWidgetSourceControllerContext: mockedUseTabularWidgetSourceControllerContext,
  };
});

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const [{ useGraphControllerContext }] = await Promise.all([
  import("./controller"),
]);

type GraphWidgetProps = import("./graphModel").GraphWidgetProps;
type GraphControllerContext = import("./controller").GraphControllerContext;
type ResolvedWidgetInputs = import("@/widgets/types").ResolvedWidgetInputs;
type TabularFrameSourceV1 = import("@/widgets/shared/tabular-frame-source").TabularFrameSourceV1;

function buildDeltaOnlyControllerContext() {
  return {
    consumerState: {
      kind: "ready",
      dataset: null,
      deltaDataset: {
        status: "ready",
        columns: ["time", "price", "symbol"],
        rows: [
          {
            time: "2026-05-12T13:56:00.000Z",
            price: 80748.3,
            symbol: "BTCUSDT",
          },
        ],
        fields: [
          {
            key: "time",
            label: "time",
            type: "datetime",
            provenance: "published",
          },
          {
            key: "price",
            label: "price",
            type: "number",
            provenance: "published",
          },
          {
            key: "symbol",
            label: "symbol",
            type: "string",
            provenance: "published",
          },
        ],
        source: {
          kind: "test-frame",
        },
      },
      inputStatus: "valid",
      sourceWidgetId: "stream-source",
      sourceOutputId: "updates",
      sourceWidgetTitle: "Stream source",
      error: null,
      requiresUpstreamResolution: false,
      hasCanonicalSourceBinding: true,
      hasPublishedValue: true,
      isEmpty: false,
    },
    currentWidgetInstanceId: "graph-1",
    filterWidgetOptions: [],
    fieldPickerOptions: [],
    hasLoadedTabularSourceDetail: false,
    hasNoData: false,
    hasResolvedFilterWidgetSource: true,
    isAwaitingBoundSourceValue: false,
    isFilterWidgetSource: false,
    referencedFilterWidget: null,
    requiresUpstreamResolution: false,
    resolvedSourceWidget: null,
    resolvedConfig: {
      availableFields: [],
    },
    resolvedSourceDataset: null,
    resolvedSourceDeltaFrame: {
      status: "ready",
      columns: ["time", "price", "symbol"],
      rows: [
        {
          time: "2026-05-12T13:56:00.000Z",
          price: 80748.3,
          symbol: "BTCUSDT",
        },
      ],
      fields: [
        {
          key: "time",
          label: "time",
          type: "datetime",
          provenance: "backend",
        },
        {
          key: "price",
          label: "price",
          type: "number",
          provenance: "backend",
        },
        {
          key: "symbol",
          label: "symbol",
          type: "string",
          provenance: "backend",
        },
      ],
      source: {
        kind: "test-frame",
      },
    },
    resolvedSourceFrame: null,
    resolvedSourceProps: {},
    selectedTabularSourceDetailQuery: { data: null, isLoading: false },
    selectedSourceId: 0,
    sourceMode: "bound",
    sourceWidgetId: "stream-source",
    supportsUniqueIdentifierList: false,
  } as const;
}

function buildEmptyBaseWithDeltaControllerContext() {
  return {
    ...buildDeltaOnlyControllerContext(),
    resolvedSourceDataset: {
      status: "loading",
      columns: [],
      rows: [],
      source: {
        kind: "test-frame",
      },
    },
  } as const;
}

function buildUnresolvedSourceControllerContext() {
  return {
    ...buildDeltaOnlyControllerContext(),
    consumerState: {
      kind: "unbound",
      dataset: null,
      deltaDataset: null,
      inputStatus: "unbound",
      sourceWidgetId: undefined,
      sourceOutputId: undefined,
      sourceWidgetTitle: null,
      error: null,
      requiresUpstreamResolution: false,
      hasCanonicalSourceBinding: false,
      hasPublishedValue: false,
      isEmpty: false,
    },
    resolvedConfig: {
      availableFields: [],
    },
    resolvedSourceDataset: null,
    resolvedSourceDeltaFrame: null,
    resolvedSourceFrame: null,
    sourceWidgetId: undefined,
  } as const;
}

function Harness({
  props,
  onContext,
  resolvedInputs,
}: {
  props: GraphWidgetProps;
  onContext: (context: GraphControllerContext) => void;
  resolvedInputs?: ResolvedWidgetInputs;
}) {
  const context = useGraphControllerContext({
    props,
    instanceId: "graph-1",
    resolvedInputs,
  });

  useEffect(() => {
    onContext(context);
  }, [context, onContext]);

  return null;
}

interface HarnessDriver {
  render: (props?: GraphWidgetProps, resolvedInputs?: ResolvedWidgetInputs) => Promise<void>;
  getContext: () => GraphControllerContext | null;
  cleanup: () => void;
}

function createHarness(): HarnessDriver {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  let latestContext: GraphControllerContext | null = null;

  return {
    async render(props = {}, resolvedInputs) {
      await act(async () => {
        root.render(
          <Harness
            props={props}
            resolvedInputs={resolvedInputs}
            onContext={(context) => {
              latestContext = context;
            }}
          />,
        );
      });
    },
    getContext: () => latestContext,
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
  mockedUseTabularWidgetSourceControllerContext.mockReset();
  while (harnesses.length > 0) {
    harnesses.pop()?.cleanup();
  }
});

describe("useGraphControllerContext", () => {
  it("derives graph field options from liveUpdates when no base dataset is present", async () => {
    mockedUseTabularWidgetSourceControllerContext.mockReturnValue(
      buildDeltaOnlyControllerContext(),
    );
    const harness = createHarness();
    harnesses.push(harness);

    await harness.render();

    const context = harness.getContext();

    expect(context?.resolvedSourceDataset?.rows).toEqual([
      {
        time: "2026-05-12T13:56:00.000Z",
        price: 80748.3,
        symbol: "BTCUSDT",
      },
    ]);
    expect(context?.resolvedConfig.availableFields.map((field) => field.key)).toEqual([
      "time",
      "price",
      "symbol",
    ]);
    expect(context?.xAxisOptions.map((option) => option.value)).toContain("time");
    expect(context?.yAxisOptions.map((option) => option.value)).toContain("price");
  });

  it("uses liveUpdates fields when the retained base frame is present but empty", async () => {
    mockedUseTabularWidgetSourceControllerContext.mockReturnValue(
      buildEmptyBaseWithDeltaControllerContext(),
    );
    const harness = createHarness();
    harnesses.push(harness);

    await harness.render();

    const context = harness.getContext();

    expect(context?.resolvedSourceDataset?.rows).toEqual([
      {
        time: "2026-05-12T13:56:00.000Z",
        price: 80748.3,
        symbol: "BTCUSDT",
      },
    ]);
    expect(context?.resolvedConfig.availableFields.map((field) => field.key)).toEqual([
      "time",
      "price",
      "symbol",
    ]);
  });

  it("passes explicit settings resolved inputs into the tabular source controller", async () => {
    mockedUseTabularWidgetSourceControllerContext.mockReturnValue(
      buildDeltaOnlyControllerContext(),
    );
    const harness = createHarness();
    harnesses.push(harness);
    const resolvedInputs = {
      liveUpdates: {
        inputId: "liveUpdates",
        label: "Live updates",
        status: "valid",
        sourceWidgetId: "stream-source",
        sourceOutputId: "updates",
        contractId: "core.tabular_frame@v1",
      },
    } satisfies ResolvedWidgetInputs;

    await harness.render({}, resolvedInputs);

    expect(mockedUseTabularWidgetSourceControllerContext).toHaveBeenCalledWith(
      expect.objectContaining({
        currentWidgetInstanceId: "graph-1",
        resolvedInputs,
      }),
    );
  });

  it("derives graph field options from explicit live update inputs when the single-source controller has no fields", async () => {
    mockedUseTabularWidgetSourceControllerContext.mockReturnValue(
      buildUnresolvedSourceControllerContext(),
    );
    const harness = createHarness();
    harnesses.push(harness);
    const liveFrame = {
      status: "ready",
      columns: ["time", "price", "symbol"],
      rows: [
        {
          time: 1778588664534,
          price: 80790.1,
          symbol: "BTCUSDT",
        },
      ],
      fields: [
        {
          key: "time",
          label: "time",
          type: "datetime",
          provenance: "backend",
        },
        {
          key: "price",
          label: "price",
          type: "number",
          provenance: "backend",
        },
        {
          key: "symbol",
          label: "symbol",
          type: "string",
          provenance: "backend",
        },
      ],
    } satisfies TabularFrameSourceV1;
    const resolvedInputs = {
      seedData: {
        inputId: "seedData",
        label: "Seed data",
        status: "unbound",
      },
      liveUpdates: {
        inputId: "liveUpdates",
        label: "Live updates",
        status: "valid",
        sourceWidgetId: "stream-source",
        sourceOutputId: "updates",
        contractId: "core.tabular_frame@v1",
        upstreamBase: liveFrame,
        upstreamDelta: liveFrame,
      },
    } as ResolvedWidgetInputs;

    await harness.render({}, resolvedInputs);

    const context = harness.getContext();

    expect(context?.consumerState.kind).toBe("ready");
    expect(context?.resolvedConfig.availableFields.map((field) => field.key)).toEqual([
      "time",
      "price",
      "symbol",
    ]);
    expect(context?.xAxisOptions.map((option) => option.value)).toContain("time");
    expect(context?.yAxisOptions.map((option) => option.value)).toContain("price");
  });
});
