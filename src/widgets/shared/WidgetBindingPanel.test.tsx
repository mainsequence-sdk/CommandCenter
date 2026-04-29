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
        : [datasetOutputDefinition],
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
    outputs: [datasetOutputDefinition],
  },
});

const widgetDefinitions = new Map<string, WidgetDefinition>([
  [graphWidgetDefinition.id, graphWidgetDefinition],
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

function getSourceOutputSelect(container: HTMLElement) {
  return container.querySelector("select.sr-only");
}

function getApplyBindingsButton(container: HTMLElement) {
  return findButtonByText(container, "Apply bindings");
}

function getSourceWidgetValue(container: HTMLElement) {
  return getSourceWidgetTrigger(container)?.textContent ?? "";
}

async function selectSourceWidget(container: HTMLElement, label: string) {
  await act(async () => {
    click(getSourceWidgetTrigger(container));
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
): WidgetBindingPanelHarness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let latestBindings: WidgetInstanceBindings | undefined;
  let currentWidgets = initialWidgets;

  async function render(widgets: DashboardWidgetInstance[]) {
    currentWidgets = widgets;
    const instance = currentWidgets.find((widget) => widget.id === "graph-1");

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
            widget={graphWidgetDefinition}
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
});
