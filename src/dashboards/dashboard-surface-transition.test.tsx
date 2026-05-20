/** @vitest-environment jsdom */
/** @vitest-environment-options {"url":"http://localhost/workspaces/test"} */

import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import type { DashboardWidgetInstance } from "@/dashboards/types";
import type {
  DashboardExecutionSurface,
} from "@/dashboards/dashboard-surface-hydration";
import type { TabularFrameSourceV1 } from "@/widgets/shared/tabular-frame-source";
import type { WidgetDefinition, WidgetExecutionReason } from "@/widgets/types";

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
  { DashboardControlsProvider },
  { DashboardWidgetDependenciesProvider },
  {
    DashboardWidgetExecutionProvider,
    useDashboardWidgetExecution,
    useResolveWidgetUpstream,
  },
  { DashboardWidgetRegistryProvider },
  { shouldMountSidebarOnlyWidgets },
  { CORE_TABULAR_FRAME_SOURCE_CONTRACT },
  {
    TABULAR_SOURCE_INPUT_ID,
    TABULAR_SOURCE_OUTPUT_ID,
    useResolvedTabularWidgetSourceBinding,
  },
  { defineWidget },
] = await Promise.all([
  import("@/dashboards/DashboardControls"),
  import("@/dashboards/DashboardWidgetDependencies"),
  import("@/dashboards/DashboardWidgetExecution"),
  import("@/dashboards/DashboardWidgetRegistry"),
  import("@/dashboards/dashboard-surface-hydration"),
  import("@/widgets/shared/tabular-frame-source"),
  import("@/widgets/shared/tabular-widget-source"),
  import("@/widgets/types"),
]);

const READY_DATASET: TabularFrameSourceV1 = {
  status: "ready",
  columns: ["time", "value"],
  rows: [
    {
      time: 1,
      value: 42,
    },
  ],
  fields: [
    {
      key: "time",
      type: "datetime",
    },
    {
      key: "value",
      type: "number",
    },
  ],
  source: {
    kind: "test",
    id: "source-widget-1",
    label: "Test Source",
  },
};

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

function flushTimers(ms = 0) {
  return new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), ms);
  });
}

async function waitFor(check: () => void, timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      check();
      return;
    } catch (error) {
      lastError = error;
    }

    await act(async () => {
      await flushTimers(5);
    });
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Timed out while waiting for dashboard surface transition state.");
}

function updateWidgetRuntimeState(
  widgets: DashboardWidgetInstance[],
  instanceId: string,
  runtimeState: Record<string, unknown> | undefined,
) {
  return widgets.map((widget) =>
    widget.id === instanceId
      ? {
          ...widget,
          runtimeState,
        }
      : widget,
  );
}

function clearSourceRuntimeState(widgets: DashboardWidgetInstance[]) {
  return widgets.map((widget) =>
    widget.id === "source-widget-1"
      ? {
          ...widget,
          runtimeState: undefined,
        }
      : widget,
  );
}

function createInitialWidgets(): DashboardWidgetInstance[] {
  return [
    {
      id: "source-widget-1",
      widgetId: "test-source",
      title: "Source",
      layout: { cols: 8, rows: 4 },
      presentation: {
        placementMode: "sidebar",
        railVisibility: "hidden",
      },
    },
    {
      id: "consumer-visible-1",
      widgetId: "test-consumer",
      title: "Visible consumer",
      layout: { cols: 8, rows: 4 },
      bindings: {
        [TABULAR_SOURCE_INPUT_ID]: {
          sourceWidgetId: "source-widget-1",
          sourceOutputId: TABULAR_SOURCE_OUTPUT_ID,
        },
      },
    },
    {
      id: "consumer-hidden-1",
      widgetId: "test-consumer",
      title: "Hidden consumer",
      layout: { cols: 8, rows: 4 },
      presentation: {
        placementMode: "sidebar",
        railVisibility: "hidden",
      },
      bindings: {
        [TABULAR_SOURCE_INPUT_ID]: {
          sourceWidgetId: "source-widget-1",
          sourceOutputId: TABULAR_SOURCE_OUTPUT_ID,
        },
      },
    },
  ];
}

function createWidgetsWithoutSource(): DashboardWidgetInstance[] {
  return createInitialWidgets().filter((widget) => widget.id !== "source-widget-1");
}

interface RecordedExecution {
  instanceId: string;
  reason: WidgetExecutionReason;
  gate: ReturnType<typeof createDeferred<void>>;
}

type ExecutionTrackerRuntimeOutcome = Record<string, unknown> | (() => Record<string, unknown>);

function createExecutionTracker(
  options: {
    runtimeOutcome?: ExecutionTrackerRuntimeOutcome;
  } = {},
) {
  const executionHistory: Array<Pick<RecordedExecution, "instanceId" | "reason">> = [];
  const pendingExecutions: RecordedExecution[] = [];
  const runtimeOutcome =
    options.runtimeOutcome ??
    (() => ({
      ...READY_DATASET,
    }));

  return {
    allExecutionReasons() {
      return executionHistory.map((entry) => entry.reason);
    },
    pendingExecutionReasons() {
      return pendingExecutions.map((entry) => entry.reason);
    },
    pendingExecutionCount() {
      return pendingExecutions.length;
    },
    execute({
      instanceId,
      reason,
    }: {
      instanceId: string;
      reason: WidgetExecutionReason;
    }) {
      const gate = createDeferred<void>();
      executionHistory.push({
        instanceId,
        reason,
      });
      pendingExecutions.push({
        instanceId,
        reason,
        gate,
      });

      return gate.promise.then(() => ({
        status: "success" as const,
        runtimeStatePatch:
          typeof runtimeOutcome === "function"
            ? runtimeOutcome()
            : runtimeOutcome,
      }));
    },
    releaseNext(reason?: WidgetExecutionReason) {
      const index =
        reason == null
          ? 0
          : pendingExecutions.findIndex((entry) => entry.reason === reason);
      const next = index >= 0 ? pendingExecutions[index] : undefined;

      if (!next) {
        throw new Error(
          reason
            ? `No pending execution recorded for ${reason}.`
            : "No pending execution recorded.",
        );
      }

      pendingExecutions.splice(index, 1);
      next.gate.resolve();
    },
  };
}

function createWidgetDefinitions(
  tracker: ReturnType<typeof createExecutionTracker>,
) {
  const sourceWidget = defineWidget({
    id: "test-source",
    widgetVersion: "1.0.0",
    title: "Test Source",
    description: "Test source widget.",
    category: "Test",
    kind: "custom",
    source: "test",
    component: () => null,
    workspaceRuntimeMode: "execution-owner",
    io: {
      outputs: [
        {
          id: TABULAR_SOURCE_OUTPUT_ID,
          label: "Dataset",
          contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          resolveValue: ({ runtimeState }) => runtimeState,
        },
      ],
    },
    execution: {
      getRefreshPolicy: () => "allow-refresh",
      execute: ({ instanceId, reason }) =>
        tracker.execute({
          instanceId,
          reason,
        }),
    },
  });
  const consumerWidget = defineWidget({
    id: "test-consumer",
    widgetVersion: "1.0.0",
    title: "Test Consumer",
    description: "Test consumer widget.",
    category: "Test",
    kind: "custom",
    source: "test",
    component: () => null,
    workspaceRuntimeMode: "consumer",
    io: {
      inputs: [
        {
          id: TABULAR_SOURCE_INPUT_ID,
          label: "Dataset",
          accepts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
          required: true,
        },
      ],
    },
  });
  const definitions = new Map<string, WidgetDefinition>([
    [sourceWidget.id, sourceWidget],
    [consumerWidget.id, consumerWidget],
  ]);

  return (widgetId: string) => definitions.get(widgetId);
}

function ConsumerProbe({
  instanceId,
  testId,
}: {
  instanceId: string;
  testId: string;
}) {
  const sourceBinding = useResolvedTabularWidgetSourceBinding({
    props: {},
    currentWidgetInstanceId: instanceId,
  });
  useResolveWidgetUpstream(instanceId, {
    enabled: sourceBinding.requiresUpstreamResolution,
  });

  return (
    <div data-testid={testId}>
      {sourceBinding.consumerState.kind}
    </div>
  );
}

function AlwaysResolvingConsumerProbe({
  instanceId,
  testId,
}: {
  instanceId: string;
  testId: string;
}) {
  const requirement = useResolveWidgetUpstream(instanceId, {
    enabled: true,
  });

  return (
    <div data-testid={testId}>
      {requirement?.needsResolution ? "needs-resolution" : "settled"}
    </div>
  );
}

function HiddenSidebarOnlyRuntimeConsumer({
  instanceId,
}: {
  instanceId: string;
}) {
  const execution = useDashboardWidgetExecution();
  const shouldMount = shouldMountSidebarOnlyWidgets({
    dashboardSurfaceHydrationActive:
      execution?.dashboardSurfaceHydrationActive === true,
  });

  if (!shouldMount) {
    return null;
  }

  return (
    <div data-testid="hidden-sidebar-consumer-mounted">
      <ConsumerProbe
        instanceId={instanceId}
        testId="hidden-sidebar-consumer-state"
      />
    </div>
  );
}

function DashboardSurface({
  forcePassiveResolution = false,
}: {
  forcePassiveResolution?: boolean;
}) {
  const execution = useDashboardWidgetExecution();

  return (
    <div data-testid="dashboard-surface">
      <div data-testid="dashboard-hydration-reason">
        {execution?.dashboardSurfaceHydrationReason ?? "none"}
      </div>
      {forcePassiveResolution ? (
        <AlwaysResolvingConsumerProbe
          instanceId="consumer-visible-1"
          testId="visible-consumer-state"
        />
      ) : (
        <ConsumerProbe
          instanceId="consumer-visible-1"
          testId="visible-consumer-state"
        />
      )}
      {forcePassiveResolution ? null : (
        <HiddenSidebarOnlyRuntimeConsumer instanceId="consumer-hidden-1" />
      )}
    </div>
  );
}

function DashboardHydrationStatusProbe() {
  const execution = useDashboardWidgetExecution();

  return (
    <div data-testid="dashboard-surface">
      <div data-testid="dashboard-hydration-reason">
        {execution?.dashboardSurfaceHydrationReason ?? "none"}
      </div>
    </div>
  );
}

function GraphSurface() {
  return <div data-testid="graph-surface">graph</div>;
}

function TestWorkspaceHarness({
  activeSurface,
  enableAutomaticHydration = true,
  forcePassiveResolution = false,
  tracker,
}: {
  activeSurface: DashboardExecutionSurface;
  enableAutomaticHydration?: boolean;
  forcePassiveResolution?: boolean;
  tracker: ReturnType<typeof createExecutionTracker>;
}) {
  const [widgets, setWidgets] = useState<DashboardWidgetInstance[]>(() =>
    createInitialWidgets(),
  );
  const resolveWidgetDefinition = useMemo(
    () => createWidgetDefinitions(tracker),
    [tracker],
  );

  useEffect(() => {
    if (activeSurface !== "graph") {
      return;
    }

    setWidgets((current) => clearSourceRuntimeState(current));
  }, [activeSurface]);

  const body: ReactNode =
    activeSurface === "graph"
      ? <GraphSurface />
      : <DashboardSurface forcePassiveResolution={forcePassiveResolution} />;

  return (
    <MemoryRouter initialEntries={["/workspaces/test"]}>
      <DashboardControlsProvider
        controls={{
          enabled: true,
          actions: {
            enabled: false,
          },
        }}
        onStateChange={() => undefined}
      >
        <DashboardWidgetRegistryProvider widgets={widgets}>
          <DashboardWidgetExecutionProvider
            activeSurface={activeSurface}
            enableAutomaticHydration={enableAutomaticHydration}
            scopeId="workspace-test"
            widgets={widgets}
            writeRuntimeState={(instanceId, runtimeState) => {
              setWidgets((current) =>
                updateWidgetRuntimeState(current, instanceId, runtimeState),
              );
            }}
            resolveWidgetDefinition={resolveWidgetDefinition}
          >
            <DashboardWidgetDependenciesProvider
              widgets={widgets}
              resolveWidgetDefinition={resolveWidgetDefinition}
            >
              {body}
            </DashboardWidgetDependenciesProvider>
          </DashboardWidgetExecutionProvider>
        </DashboardWidgetRegistryProvider>
      </DashboardControlsProvider>
    </MemoryRouter>
  );
}

function TestConfigurationHydrationHarness({
  includeSource,
  tracker,
}: {
  includeSource: boolean;
  tracker: ReturnType<typeof createExecutionTracker>;
}) {
  const widgets = useMemo(
    () => (includeSource ? createInitialWidgets() : createWidgetsWithoutSource()),
    [includeSource],
  );
  const resolveWidgetDefinition = useMemo(
    () => createWidgetDefinitions(tracker),
    [tracker],
  );

  return (
    <MemoryRouter initialEntries={["/workspaces/test"]}>
      <DashboardControlsProvider
        controls={{
          enabled: true,
          actions: {
            enabled: false,
          },
        }}
        onStateChange={() => undefined}
      >
        <DashboardWidgetRegistryProvider widgets={widgets}>
          <DashboardWidgetExecutionProvider
            activeSurface="dashboard"
            enableAutomaticHydration
            scopeId="workspace-test"
            widgets={widgets}
            writeRuntimeState={() => undefined}
            resolveWidgetDefinition={resolveWidgetDefinition}
          >
            <DashboardWidgetDependenciesProvider
              widgets={widgets}
              resolveWidgetDefinition={resolveWidgetDefinition}
            >
              <DashboardHydrationStatusProbe />
            </DashboardWidgetDependenciesProvider>
          </DashboardWidgetExecutionProvider>
        </DashboardWidgetRegistryProvider>
      </DashboardControlsProvider>
    </MemoryRouter>
  );
}

function queryByTestId(container: HTMLElement, testId: string) {
  return container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

function getTextByTestId(container: HTMLElement, testId: string) {
  const element = queryByTestId(container, testId);

  if (!element) {
    throw new Error(`Unable to find [data-testid="${testId}"].`);
  }

  return element.textContent ?? "";
}

function createMountedHarness(
  tracker: ReturnType<typeof createExecutionTracker>,
  options: {
    enableAutomaticHydration?: boolean;
    forcePassiveResolution?: boolean;
  } = {},
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  return {
    container,
    async render(activeSurface: DashboardExecutionSurface) {
      await act(async () => {
        root.render(
          <TestWorkspaceHarness
            activeSurface={activeSurface}
            enableAutomaticHydration={options.enableAutomaticHydration}
            forcePassiveResolution={options.forcePassiveResolution}
            tracker={tracker}
          />,
        );
      });
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function createMountedConfigurationHarness(
  tracker: ReturnType<typeof createExecutionTracker>,
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  return {
    container,
    async render(includeSource: boolean) {
      await act(async () => {
        root.render(
          <TestConfigurationHydrationHarness
            includeSource={includeSource}
            tracker={tracker}
          />,
        );
      });
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

interface MountedHarness {
  container: HTMLElement;
  render: (...args: any[]) => Promise<void>;
  unmount: () => Promise<void>;
}

let activeHarness: MountedHarness | undefined;

afterEach(async () => {
  if (activeHarness) {
    await activeHarness.unmount();
    activeHarness = undefined;
  }
});

describe("dashboard surface transition hydration", () => {
  it("retries automatic hydration when the widget configuration becomes refreshable after an empty first pass", async () => {
    const tracker = createExecutionTracker();
    activeHarness = createMountedConfigurationHarness(tracker);

    await activeHarness!.render(false);

    await act(async () => {
      await flushTimers(25);
    });

    expect(tracker.allExecutionReasons()).toEqual([]);
    expect(getTextByTestId(activeHarness!.container, "dashboard-hydration-reason"))
      .toBe("none");

    await activeHarness!.render(true);

    await waitFor(() => {
      expect(tracker.allExecutionReasons()).toEqual(["dashboard-refresh"]);
      expect(tracker.pendingExecutionReasons()).toEqual(["dashboard-refresh"]);
      expect(getTextByTestId(activeHarness!.container, "dashboard-hydration-reason"))
        .toBe("initial-entry");
    });

    tracker.releaseNext("dashboard-refresh");

    await waitFor(() => {
      expect(tracker.pendingExecutionCount()).toBe(0);
      expect(getTextByTestId(activeHarness!.container, "dashboard-hydration-reason"))
        .toBe("none");
    });
  });

  it("runs passive upstream resolution once per invalidation even when the consumer still asks after runtime writes", async () => {
    const tracker = createExecutionTracker();
    activeHarness = createMountedHarness(tracker, {
      enableAutomaticHydration: false,
      forcePassiveResolution: true,
    });

    await activeHarness!.render("dashboard");

    await waitFor(() => {
      expect(tracker.allExecutionReasons()).toEqual(["manual-recalculate"]);
      expect(tracker.pendingExecutionReasons()).toEqual(["manual-recalculate"]);
      expect(getTextByTestId(activeHarness!.container, "visible-consumer-state"))
        .toBe("needs-resolution");
    });

    tracker.releaseNext("manual-recalculate");

    await waitFor(() => {
      expect(tracker.pendingExecutionCount()).toBe(0);
    });

    await act(async () => {
      await flushTimers(25);
    });

    expect(tracker.allExecutionReasons()).toEqual(["manual-recalculate"]);
  });

  it("does not retry passive upstream resolution after a settled error publication", async () => {
    const tracker = createExecutionTracker({
      runtimeOutcome: {
        status: "error",
        error: "The upstream answered with a settled error.",
        columns: [],
        rows: [],
      },
    });
    activeHarness = createMountedHarness(tracker, {
      enableAutomaticHydration: false,
      forcePassiveResolution: true,
    });

    await activeHarness!.render("dashboard");

    await waitFor(() => {
      expect(tracker.allExecutionReasons()).toEqual(["manual-recalculate"]);
      expect(tracker.pendingExecutionReasons()).toEqual(["manual-recalculate"]);
    });

    tracker.releaseNext("manual-recalculate");

    await waitFor(() => {
      expect(tracker.pendingExecutionCount()).toBe(0);
    });

    await act(async () => {
      await flushTimers(25);
    });

    expect(tracker.allExecutionReasons()).toEqual(["manual-recalculate"]);
    expect(getTextByTestId(activeHarness!.container, "visible-consumer-state"))
      .toBe("needs-resolution");
  });

  it("keeps the dashboard visible, suppresses passive visible consumer re-resolution, and defers hidden sidebar-only consumers during graph return hydration", async () => {
    const tracker = createExecutionTracker();
    activeHarness = createMountedHarness(tracker);

    await activeHarness!.render("dashboard");

    await waitFor(() => {
      expect(tracker.allExecutionReasons()).toEqual(["dashboard-refresh"]);
      expect(tracker.pendingExecutionReasons()).toEqual(["dashboard-refresh"]);
      expect(getTextByTestId(activeHarness!.container, "dashboard-hydration-reason"))
        .toBe("initial-entry");
      expect(queryByTestId(activeHarness!.container, "dashboard-surface"))
        .not.toBeNull();
      expect(queryByTestId(activeHarness!.container, "hidden-sidebar-consumer-mounted"))
        .toBeNull();
      expect(getTextByTestId(activeHarness!.container, "visible-consumer-state"))
        .toBe("awaiting-upstream");
      expect(tracker.allExecutionReasons()).not.toContain("manual-recalculate");
    });

    tracker.releaseNext("dashboard-refresh");

    await waitFor(() => {
      expect(getTextByTestId(activeHarness!.container, "dashboard-hydration-reason"))
        .toBe("none");
      expect(getTextByTestId(activeHarness!.container, "visible-consumer-state"))
        .toBe("ready");
      expect(queryByTestId(activeHarness!.container, "hidden-sidebar-consumer-mounted"))
        .not.toBeNull();
      expect(tracker.pendingExecutionCount()).toBe(0);
    });

    await activeHarness!.render("graph");

    await waitFor(() => {
      expect(queryByTestId(activeHarness!.container, "dashboard-surface")).toBeNull();
      expect(queryByTestId(activeHarness!.container, "graph-surface")).not.toBeNull();
    });

    await activeHarness!.render("dashboard");

    expect(queryByTestId(activeHarness!.container, "dashboard-surface")).not.toBeNull();

    await waitFor(() => {
      expect(getTextByTestId(activeHarness!.container, "dashboard-hydration-reason"))
        .toBe("surface-return");
      expect(queryByTestId(activeHarness!.container, "hidden-sidebar-consumer-mounted"))
        .toBeNull();
      expect(getTextByTestId(activeHarness!.container, "visible-consumer-state"))
        .toBe("awaiting-upstream");
      expect(tracker.allExecutionReasons()).toEqual([
        "dashboard-refresh",
        "dashboard-refresh",
      ]);
      expect(tracker.pendingExecutionReasons()).toEqual(["dashboard-refresh"]);
      expect(tracker.allExecutionReasons()).not.toContain("manual-recalculate");
    });

    tracker.releaseNext("dashboard-refresh");

    await waitFor(() => {
      expect(getTextByTestId(activeHarness!.container, "dashboard-hydration-reason"))
        .toBe("none");
      expect(getTextByTestId(activeHarness!.container, "visible-consumer-state"))
        .toBe("ready");
      expect(queryByTestId(activeHarness!.container, "hidden-sidebar-consumer-mounted"))
        .not.toBeNull();
      expect(tracker.pendingExecutionCount()).toBe(0);
    });
  });
});
