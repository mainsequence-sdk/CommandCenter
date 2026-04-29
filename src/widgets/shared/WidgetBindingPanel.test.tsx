/** @vitest-environment jsdom */

import { act } from "react-dom/test-utils";
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
  { DashboardWidgetDependenciesProvider },
  { WidgetBindingPanel },
  { CORE_TABULAR_FRAME_SOURCE_CONTRACT, TABULAR_FRAME_SOURCE_VALUE_DESCRIPTOR },
  { defineWidget },
] = await Promise.all([
  import("@/dashboards/DashboardWidgetDependencies"),
  import("@/widgets/shared/WidgetBindingPanel"),
  import("@/widgets/shared/tabular-frame-source"),
  import("@/widgets/types"),
]);

type DashboardWidgetInstance = import("@/dashboards/types").DashboardWidgetInstance;
type WidgetDefinition = import("@/widgets/types").WidgetDefinition;
type WidgetInstanceBindings = import("@/widgets/types").WidgetInstanceBindings;

const graphWidgetDefinition = defineWidget({
  id: "graph",
  widgetVersion: "1.0.0",
  title: "Graph",
  description: "Graph",
  category: "Core",
  kind: "chart",
  source: "test",
  component: () => null,
  io: {
    inputs: [
      {
        id: "sourceData",
        label: "Source data",
        accepts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
        required: true,
      },
    ],
  },
});

const datasetOutputDefinition = {
  id: "dataset",
  label: "Dataset",
  contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  description: "Dataset",
  valueDescriptor: TABULAR_FRAME_SOURCE_VALUE_DESCRIPTOR,
} as const;

const updatesOutputDefinition = {
  id: "updates",
  label: "Updates",
  contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  description: "Updates",
  valueDescriptor: TABULAR_FRAME_SOURCE_VALUE_DESCRIPTOR,
} as const;

const streamSourceDefinition = defineWidget({
  id: "connection-stream-query",
  widgetVersion: "1.0.0",
  title: "Connection Stream Query (WS)",
  description: "Connection Stream Query (WS)",
  category: "Core",
  kind: "custom",
  source: "test",
  component: () => null,
  defaultPresentation: {
    placementMode: "sidebar",
  },
  resolveIo: ({ runtimeState }) => ({
    outputs:
      runtimeState && typeof runtimeState === "object" && runtimeState.hideOutput
        ? []
        : [datasetOutputDefinition, updatesOutputDefinition],
  }),
});

const httpSourceDefinition = defineWidget({
  id: "connection-query",
  widgetVersion: "1.0.0",
  title: "Connection Query (HTTP)",
  description: "Connection Query (HTTP)",
  category: "Core",
  kind: "custom",
  source: "test",
  component: () => null,
  defaultPresentation: {
    placementMode: "sidebar",
  },
  io: {
    outputs: [datasetOutputDefinition, updatesOutputDefinition],
  },
});

const incrementalConsumerWidgetDefinition = defineWidget({
  id: "graph-incremental",
  widgetVersion: "1.0.0",
  title: "Graph Incremental",
  description: "Graph Incremental",
  category: "Core",
  kind: "chart",
  source: "test",
  component: () => null,
  io: {
    inputs: [
      {
        id: "seedData",
        label: "Seed data",
        accepts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
        acceptedOutputIds: ["dataset", "updates"],
        required: false,
      },
      {
        id: "liveUpdates",
        label: "Live updates",
        accepts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
        acceptedOutputIds: ["updates"],
        required: false,
      },
    ],
  },
});

const widgetDefinitions = new Map<string, WidgetDefinition>([
  [graphWidgetDefinition.id, graphWidgetDefinition],
  [incrementalConsumerWidgetDefinition.id, incrementalConsumerWidgetDefinition],
  [streamSourceDefinition.id, streamSourceDefinition],
  [httpSourceDefinition.id, httpSourceDefinition],
]);

function resolveWidgetDefinition(widgetId: string) {
  return widgetDefinitions.get(widgetId);
}

function buildWidgets(input?: {
  consumerBindings?: WidgetInstanceBindings;
  consumerTitle?: string;
  sourceRuntimeState?: Record<string, unknown>;
  secondStreamRuntimeState?: Record<string, unknown>;
}) {
  return [
    {
      id: "graph-1",
      widgetId: "graph",
      title: input?.consumerTitle ?? "OHLC Graph",
      layout: {
        cols: 12,
        rows: 8,
      },
      bindings: input?.consumerBindings ?? {},
    },
    {
      id: "stream-1",
      widgetId: "connection-stream-query",
      title: "WS OHLC",
      layout: {
        cols: 12,
        rows: 8,
      },
      presentation: {
        placementMode: "sidebar",
      },
      runtimeState: input?.sourceRuntimeState,
    },
    {
      id: "stream-2",
      widgetId: "connection-stream-query",
      title: "WS Trades",
      layout: {
        cols: 12,
        rows: 8,
      },
      presentation: {
        placementMode: "sidebar",
      },
      runtimeState: input?.secondStreamRuntimeState,
    },
    {
      id: "http-1",
      widgetId: "connection-query",
      title: "HTTP OHLC",
      layout: {
        cols: 12,
        rows: 8,
      },
      presentation: {
        placementMode: "sidebar",
      },
    },
  ] satisfies DashboardWidgetInstance[];
}

function click(node: Element | null) {
  if (!(node instanceof HTMLElement)) {
    throw new Error("Expected an element to click.");
  }

  node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function changeSelectValue(node: Element | null, value: string) {
  if (!(node instanceof HTMLSelectElement)) {
    throw new Error("Expected a select element.");
  }

  node.value = value;
  node.dispatchEvent(new Event("change", { bubbles: true }));
}

function findButtonByText(container: HTMLElement, text: string) {
  return [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes(text),
  ) ?? null;
}

function getListboxTriggers(container: HTMLElement) {
  return [...container.querySelectorAll('button[aria-haspopup="listbox"]')] as HTMLButtonElement[];
}

function getSourceWidgetTrigger(container: HTMLElement) {
  return getListboxTriggers(container)[0] ?? null;
}

function getSourceWidgetTriggerAt(container: HTMLElement, index: number) {
  return getListboxTriggers(container)[index] ?? null;
}

function findBindingSection(container: HTMLElement, inputLabel: string) {
  const labelNode = [...container.querySelectorAll("*")].find(
    (node) => node.textContent?.trim() === inputLabel,
  );

  return labelNode?.closest("section") as HTMLElement | undefined;
}

function getSourceWidgetTriggerForInput(container: HTMLElement, inputLabel: string) {
  return findBindingSection(container, inputLabel)?.querySelector(
    'button[aria-haspopup="listbox"]',
  ) ?? null;
}

function getSourceOutputSelect(container: HTMLElement) {
  return container.querySelector("select.sr-only");
}

function getSourceOutputSelectAt(container: HTMLElement, index: number) {
  return container.querySelectorAll("select.sr-only")[index] ?? null;
}

function getSourceOutputSelectForInput(container: HTMLElement, inputLabel: string) {
  return findBindingSection(container, inputLabel)?.querySelector("select.sr-only") ?? null;
}

function getApplyBindingsButton(container: HTMLElement) {
  return findButtonByText(container, "Apply bindings");
}

function getSourceWidgetValue(container: HTMLElement) {
  return getSourceWidgetTrigger(container)?.textContent ?? "";
}

async function selectSourceWidget(
  container: HTMLElement,
  label: string,
  triggerIndex = 0,
) {
  await act(async () => {
    click(getSourceWidgetTriggerAt(container, triggerIndex));
  });

  await act(async () => {
    click(findButtonByText(container, label));
  });
}

async function selectSourceWidgetForInput(
  container: HTMLElement,
  inputLabel: string,
  label: string,
) {
  await act(async () => {
    click(getSourceWidgetTriggerForInput(container, inputLabel));
  });

  await act(async () => {
    click(findButtonByText(container, label));
  });
}

interface WidgetBindingPanelHarness {
  container: HTMLDivElement;
  render: (widgets: DashboardWidgetInstance[]) => Promise<void>;
  getLatestBindings: () => WidgetInstanceBindings | undefined;
  cleanup: () => void;
}

function createHarness(
  initialWidgets: DashboardWidgetInstance[],
  options?: {
    consumerWidgetDefinition?: WidgetDefinition;
    consumerInstanceId?: string;
  },
): WidgetBindingPanelHarness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let latestBindings: WidgetInstanceBindings | undefined;
  let currentWidgets = initialWidgets;
  const consumerWidgetDefinition = options?.consumerWidgetDefinition ?? graphWidgetDefinition;
  const consumerInstanceId = options?.consumerInstanceId ?? "graph-1";

  async function render(widgets: DashboardWidgetInstance[]) {
    currentWidgets = widgets;
    const instance = currentWidgets.find((widget) => widget.id === consumerInstanceId);

    if (!instance) {
      throw new Error("Expected graph instance.");
    }

    await act(async () => {
      root.render(
        <DashboardWidgetDependenciesProvider
          widgets={currentWidgets}
          resolveWidgetDefinition={resolveWidgetDefinition}
        >
          <WidgetBindingPanel
            editable
            instance={instance}
            widget={consumerWidgetDefinition}
            onBindingsChange={(bindings) => {
              latestBindings = bindings;
            }}
          />
        </DashboardWidgetDependenciesProvider>,
      );
    });
  }

  return {
    container,
    async render(widgets) {
      await render(widgets);
    },
    getLatestBindings: () => latestBindings,
    cleanup() {
      root.unmount();
      container.remove();
    },
  };
}

function buildIncrementalWidgets(input?: {
  consumerBindings?: WidgetInstanceBindings;
  sourceRuntimeState?: Record<string, unknown>;
  secondStreamRuntimeState?: Record<string, unknown>;
}) {
  return [
    {
      id: "graph-incremental-1",
      widgetId: "graph-incremental",
      title: "Incremental Graph",
      layout: {
        cols: 12,
        rows: 8,
      },
      bindings: input?.consumerBindings ?? {},
    },
    ...buildWidgets({
      consumerBindings: {},
      sourceRuntimeState: input?.sourceRuntimeState,
      secondStreamRuntimeState: input?.secondStreamRuntimeState,
    }).filter((widget) => widget.id !== "graph-1"),
  ] satisfies DashboardWidgetInstance[];
}

const harnesses: WidgetBindingPanelHarness[] = [];

afterEach(() => {
  while (harnesses.length > 0) {
    harnesses.pop()?.cleanup();
  }
});

describe("WidgetBindingPanel", () => {
  it("keeps a selected websocket source widget selected across runtime and preview rerenders", async () => {
    const harness = createHarness(
      buildWidgets({
        consumerBindings: {},
        sourceRuntimeState: {
          tick: 0,
        },
      }),
    );
    harnesses.push(harness);

    await harness.render(
      buildWidgets({
        consumerBindings: {},
        sourceRuntimeState: {
          tick: 0,
        },
      }),
    );

    await selectSourceWidget(harness.container, "WS OHLC");
    expect(getSourceWidgetValue(harness.container)).toContain("WS OHLC");

    await harness.render(
      buildWidgets({
        consumerBindings: {},
        consumerTitle: "OHLC Graph Preview",
        sourceRuntimeState: {
          tick: 1,
          hideOutput: true,
        },
      }),
    );

    expect(getSourceWidgetValue(harness.container)).toContain("WS OHLC");
  });

  it("does not snap back to the previously committed websocket binding while editing a new selection", async () => {
    const harness = createHarness(
      buildWidgets({
        consumerBindings: {
          sourceData: {
            sourceWidgetId: "stream-1",
            sourceOutputId: "dataset",
          },
        },
        sourceRuntimeState: {
          tick: 0,
        },
        secondStreamRuntimeState: {
          tick: 0,
        },
      }),
    );
    harnesses.push(harness);

    await harness.render(
      buildWidgets({
        consumerBindings: {
          sourceData: {
            sourceWidgetId: "stream-1",
            sourceOutputId: "dataset",
          },
        },
        sourceRuntimeState: {
          tick: 0,
        },
        secondStreamRuntimeState: {
          tick: 0,
        },
      }),
    );

    expect(getSourceWidgetValue(harness.container)).toContain("WS OHLC");

    await selectSourceWidget(harness.container, "WS Trades");
    expect(getSourceWidgetValue(harness.container)).toContain("WS Trades");

    await harness.render(
      buildWidgets({
        consumerBindings: {
          sourceData: {
            sourceWidgetId: "stream-1",
            sourceOutputId: "dataset",
          },
        },
        consumerTitle: "OHLC Graph Preview",
        sourceRuntimeState: {
          tick: 1,
        },
        secondStreamRuntimeState: {
          tick: 1,
        },
      }),
    );

    expect(getSourceWidgetValue(harness.container)).toContain("WS Trades");
  });

  it("applies dataset bindings for websocket sources", async () => {
    const harness = createHarness(
      buildWidgets({
        consumerBindings: {},
      }),
    );
    harnesses.push(harness);

    await harness.render(
      buildWidgets({
        consumerBindings: {},
      }),
    );

    await selectSourceWidget(harness.container, "WS OHLC");

    await act(async () => {
      changeSelectValue(getSourceOutputSelect(harness.container), "dataset");
    });

    await act(async () => {
      click(getApplyBindingsButton(harness.container));
    });

    expect(harness.getLatestBindings()).toEqual({
      sourceData: {
        sourceWidgetId: "stream-1",
        sourceOutputId: "dataset",
      },
    });
  });

  it("keeps secondary websocket sources selectable after another websocket source goes live", async () => {
    const harness = createHarness(
      buildWidgets({
        consumerBindings: {},
        sourceRuntimeState: {
          tick: 0,
        },
        secondStreamRuntimeState: {
          tick: 0,
        },
      }),
    );
    harnesses.push(harness);

    await harness.render(
      buildWidgets({
        consumerBindings: {},
        sourceRuntimeState: {
          tick: 0,
        },
        secondStreamRuntimeState: {
          tick: 0,
        },
      }),
    );

    await selectSourceWidget(harness.container, "WS Trades");
    expect(getSourceWidgetValue(harness.container)).toContain("WS Trades");

    await harness.render(
      buildWidgets({
        consumerBindings: {},
        sourceRuntimeState: {
          tick: 1,
        },
        secondStreamRuntimeState: {
          tick: 1,
          hideOutput: true,
        },
      }),
    );

    expect(getSourceWidgetValue(harness.container)).toContain("WS Trades");

    await act(async () => {
      changeSelectValue(getSourceOutputSelect(harness.container), "dataset");
    });

    await act(async () => {
      click(getApplyBindingsButton(harness.container));
    });

    expect(harness.getLatestBindings()).toEqual({
      sourceData: {
        sourceWidgetId: "stream-2",
        sourceOutputId: "dataset",
      },
    });
  });

  it("keeps existing http source selection behavior unchanged", async () => {
    const harness = createHarness(
      buildWidgets({
        consumerBindings: {},
      }),
    );
    harnesses.push(harness);

    await harness.render(
      buildWidgets({
        consumerBindings: {},
      }),
    );

    await selectSourceWidget(harness.container, "HTTP OHLC");
    expect(getSourceWidgetValue(harness.container)).toContain("HTTP OHLC");

    await act(async () => {
      changeSelectValue(getSourceOutputSelect(harness.container), "dataset");
    });

    await act(async () => {
      click(getApplyBindingsButton(harness.container));
    });

    expect(harness.getLatestBindings()).toEqual({
      sourceData: {
        sourceWidgetId: "http-1",
        sourceOutputId: "dataset",
      },
    });
  });

  it("lets seedData bind retained dataset outputs and liveUpdates bind only explicit updates outputs", async () => {
    const harness = createHarness(buildIncrementalWidgets(), {
      consumerWidgetDefinition: incrementalConsumerWidgetDefinition,
      consumerInstanceId: "graph-incremental-1",
    });
    harnesses.push(harness);

    await harness.render(buildIncrementalWidgets());

    await selectSourceWidgetForInput(harness.container, "Seed data", "HTTP OHLC");
    await act(async () => {
      changeSelectValue(getSourceOutputSelectForInput(harness.container, "Seed data"), "dataset");
    });

    await selectSourceWidgetForInput(harness.container, "Live updates", "WS OHLC");
    const liveOptions = [
      ...((getSourceOutputSelectForInput(
        harness.container,
        "Live updates",
      ) as HTMLSelectElement | null)?.options ?? []),
    ].map((option) => option.value).filter(Boolean);

    expect(liveOptions).toEqual(["updates"]);

    await act(async () => {
      changeSelectValue(getSourceOutputSelectForInput(harness.container, "Live updates"), "updates");
    });

    await act(async () => {
      click(getApplyBindingsButton(harness.container));
    });

    expect(harness.getLatestBindings()).toEqual({
      seedData: {
        sourceWidgetId: "http-1",
        sourceOutputId: "dataset",
      },
      liveUpdates: {
        sourceWidgetId: "stream-1",
        sourceOutputId: "updates",
      },
    });
  });

  it("allows seedData to bind incremental updates outputs directly", async () => {
    const harness = createHarness(buildIncrementalWidgets(), {
      consumerWidgetDefinition: incrementalConsumerWidgetDefinition,
      consumerInstanceId: "graph-incremental-1",
    });
    harnesses.push(harness);

    await harness.render(buildIncrementalWidgets());

    await selectSourceWidgetForInput(harness.container, "Seed data", "HTTP OHLC");
    const seedOptions = [
      ...((getSourceOutputSelectForInput(
        harness.container,
        "Seed data",
      ) as HTMLSelectElement | null)?.options ?? []),
    ].map((option) => option.value).filter(Boolean);

    expect(seedOptions).toEqual(["dataset", "updates"]);

    await act(async () => {
      changeSelectValue(getSourceOutputSelectForInput(harness.container, "Seed data"), "updates");
    });

    await act(async () => {
      click(getApplyBindingsButton(harness.container));
    });

    expect(harness.getLatestBindings()).toEqual({
      seedData: {
        sourceWidgetId: "http-1",
        sourceOutputId: "updates",
      },
    });
  });
});
