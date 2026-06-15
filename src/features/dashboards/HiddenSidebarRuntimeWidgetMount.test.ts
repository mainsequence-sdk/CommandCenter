import { describe, expect, it } from "vitest";

import type { DashboardWidgetInstance } from "@/dashboards/types";
import { createDashboardWidgetDependencyModel } from "@/dashboards/widget-dependencies";
import {
  buildWidgetReferencePropInputId,
  resolveReferenceBackedWidgetState,
} from "@/dashboards/widget-instance-references";
import type { ConnectionQueryModel } from "@/connections/types";
import { hasPendingConnectionStreamReferenceValues } from "@/widgets/core/connection-stream-query/ConnectionStreamQueryWidget";
import {
  buildConnectionStreamQueryRequest,
  buildConnectionStreamQueryRuntimeKey,
  type ConnectionStreamQueryWidgetProps,
} from "@/widgets/core/connection-stream-query/connectionStreamQueryModel";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";
import { CORE_VALUE_JSON_CONTRACT } from "@/widgets/shared/value-contracts";
import { defineWidget, type WidgetDefinition } from "@/widgets/types";
import {
  CORE_CONNECTION_STREAM_QUERY_WIDGET_ID,
  CORE_GRAPH_WIDGET_ID,
} from "@/widgets/widget-type-normalization";

import { resolveHiddenSidebarRuntimeWidgetMountState } from "./HiddenSidebarRuntimeWidgetMount";

const graphWidget = defineWidget({
  id: CORE_GRAPH_WIDGET_ID,
  widgetVersion: "1.0.0",
  title: "Graph",
  description: "Graph",
  category: "Core",
  kind: "chart",
  source: "core",
  io: {},
  buildAgentSnapshot: () => ({
    displayKind: "chart",
    state: "idle",
    summary: "Graph test widget.",
  }),
  component: () => null,
});

const connectionStreamWidget = defineWidget({
  id: CORE_CONNECTION_STREAM_QUERY_WIDGET_ID,
  widgetVersion: "1.0.0",
  title: "Connection Stream Query",
  description: "Connection Stream Query",
  category: "Core",
  kind: "custom",
  source: "core",
  io: {},
  buildAgentSnapshot: () => ({
    displayKind: "custom",
    state: "idle",
    summary: "Connection stream query test widget.",
  }),
  component: () => null,
});

const jsonInteractionSourceWidget = defineWidget({
  id: "json-interaction-source",
  widgetVersion: "1.0.0",
  title: "JSON Interaction Source",
  description: "JSON Interaction Source",
  category: "Core",
  kind: "custom",
  source: "core",
  io: {
    outputs: [
      {
        id: "activeCellValue",
        label: "Active cell value",
        contract: CORE_VALUE_JSON_CONTRACT,
        valueDescriptor: {
          kind: "unknown",
          contract: CORE_VALUE_JSON_CONTRACT,
        },
        resolveValue: ({ runtimeState }) => runtimeState?.value,
      },
    ],
  },
  buildAgentSnapshot: () => ({
    displayKind: "custom",
    state: "idle",
    summary: "JSON interaction source test widget.",
  }),
  component: () => null,
});

const widgetDefinitions = new Map<string, WidgetDefinition>([
  [CORE_GRAPH_WIDGET_ID, graphWidget],
  [CORE_CONNECTION_STREAM_QUERY_WIDGET_ID, connectionStreamWidget],
  ["json-interaction-source", jsonInteractionSourceWidget],
]);

const streamQueryModel = {
  id: "binance-usdm-futures-ohlc",
  label: "USD-M Futures OHLC",
  outputContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
  stream: {
    transport: "websocket",
    modes: ["snapshot", "delta"],
  },
} satisfies ConnectionQueryModel;

const dashboardState = {
  timeRangeKey: "15m" as const,
  rangeStartMs: 1000,
  rangeEndMs: 2000,
  refreshIntervalMs: null,
};

function resolveWidgetDefinition(widgetId: string) {
  return widgetDefinitions.get(widgetId);
}

function widget(overrides: Partial<DashboardWidgetInstance>): DashboardWidgetInstance {
  return {
    id: "widget-1",
    widgetId: CORE_GRAPH_WIDGET_ID,
    layout: {
      cols: 8,
      rows: 6,
    },
    ...overrides,
  };
}

function resolveStreamRuntimeKeyFromMountState(input: {
  dependencyModel: ReturnType<typeof createDashboardWidgetDependencyModel>;
  stream: DashboardWidgetInstance;
}) {
  const mountState = resolveHiddenSidebarRuntimeWidgetMountState({
    dependencyModel: input.dependencyModel,
    instance: input.stream,
    widgetId: input.stream.widgetId,
  });
  const effectiveProps = resolveReferenceBackedWidgetState({
    props: mountState.props,
    resolvedInputs: mountState.resolvedInputs,
  }).props as ConnectionStreamQueryWidgetProps;
  const request = buildConnectionStreamQueryRequest(
    effectiveProps,
    dashboardState,
    streamQueryModel,
    "private-dashboard",
  );

  if (!request) {
    throw new Error("Expected stream request to be buildable.");
  }

  return buildConnectionStreamQueryRuntimeKey({
    executionSurface: "private-dashboard",
    request,
  });
}

describe("resolveHiddenSidebarRuntimeWidgetMountState", () => {
  it("passes resolved inputs to direct connection stream hidden mounts", () => {
    const stream = widget({
      id: "stream-1",
      widgetId: CORE_CONNECTION_STREAM_QUERY_WIDGET_ID,
      props: {
        connectionRef: {
          id: 5,
          typeId: "finance.binance-market-data",
        },
        queryModelId: "binance-usdm-futures-ohlc",
        query: {
          kind: "binance-usdm-futures-ohlc",
          symbols: ["$(SOURCE-1).ACTIVECELLVALUE"],
          interval: "1m",
        },
      },
    });
    const widgets = [
      stream,
      widget({
        id: "source-1",
        widgetId: "json-interaction-source",
        runtimeState: {
          value: "ETHUSDT",
        },
      }),
    ];
    const model = createDashboardWidgetDependencyModel(widgets, resolveWidgetDefinition);
    const mountState = resolveHiddenSidebarRuntimeWidgetMountState({
      dependencyModel: model,
      instance: stream,
      widgetId: stream.widgetId,
    });
    const inputId = buildWidgetReferencePropInputId(["query", "symbols"]);

    expect(mountState.props).toBe(stream.props);
    expect(mountState.resolvedInputs?.[inputId]).toMatchObject({
      status: "valid",
      value: "ETHUSDT",
    });
    expect(
      resolveReferenceBackedWidgetState({
        props: mountState.props,
        resolvedInputs: mountState.resolvedInputs,
      }).props,
    ).toMatchObject({
      query: {
        symbols: ["ETHUSDT"],
      },
    });
  });

  it("changes the direct stream runtime key when the referenced variable value changes", () => {
    const stream = widget({
      id: "stream-1",
      widgetId: CORE_CONNECTION_STREAM_QUERY_WIDGET_ID,
      props: {
        connectionRef: {
          id: 5,
          typeId: "finance.binance-market-data",
        },
        queryModelId: "binance-usdm-futures-ohlc",
        query: {
          kind: "binance-usdm-futures-ohlc",
          symbols: ["$(SOURCE-1).ACTIVECELLVALUE"],
          interval: "1m",
        },
      },
    });
    const widgetsForValue = (value: string) => [
      stream,
      widget({
        id: "source-1",
        widgetId: "json-interaction-source",
        runtimeState: {
          value,
        },
      }),
    ];

    const btcModel = createDashboardWidgetDependencyModel(
      widgetsForValue("BTCUSDT"),
      resolveWidgetDefinition,
    );
    const ethModel = createDashboardWidgetDependencyModel(
      widgetsForValue("ETHUSDT"),
      resolveWidgetDefinition,
    );
    const sameBtcModel = createDashboardWidgetDependencyModel(
      widgetsForValue("BTCUSDT"),
      resolveWidgetDefinition,
    );

    expect(
      resolveStreamRuntimeKeyFromMountState({
        dependencyModel: btcModel,
        stream,
      }),
    ).not.toBe(
      resolveStreamRuntimeKeyFromMountState({
        dependencyModel: ethModel,
        stream,
      }),
    );
    expect(
      resolveStreamRuntimeKeyFromMountState({
        dependencyModel: btcModel,
        stream,
      }),
    ).toBe(
      resolveStreamRuntimeKeyFromMountState({
        dependencyModel: sameBtcModel,
        stream,
      }),
    );
  });

  it("projects managed stream props from the owner without mutating the hidden source", () => {
    const owner = widget({
      id: "graph-1",
      widgetId: CORE_GRAPH_WIDGET_ID,
      props: {
        graphSourceMode: "connection-stream",
        embeddedConnectionQuery: {
          connectionRef: {
            id: 5,
            typeId: "finance.binance-market-data",
          },
          queryModelId: "binance-usdm-futures-ohlc",
          query: {
            kind: "binance-usdm-futures-ohlc",
            symbols: ["$(SOURCE-1).ACTIVECELLVALUE"],
            interval: "1m",
          },
        },
      },
    });
    const managedSource = widget({
      id: "stream-1",
      widgetId: CORE_CONNECTION_STREAM_QUERY_WIDGET_ID,
      managedBy: {
        ownerInstanceId: owner.id,
        role: "embedded-connection-source",
      },
      props: {
        connectionRef: {
          id: 5,
          typeId: "finance.binance-market-data",
        },
        queryModelId: "binance-usdm-futures-ohlc",
        query: {
          kind: "binance-usdm-futures-ohlc",
          symbols: ["STALE"],
          interval: "1m",
        },
      },
    });
    const widgets = [
      owner,
      managedSource,
      widget({
        id: "source-1",
        widgetId: "json-interaction-source",
        runtimeState: {
          value: "ETHUSDT",
        },
      }),
    ];
    const model = createDashboardWidgetDependencyModel(widgets, resolveWidgetDefinition);
    const mountState = resolveHiddenSidebarRuntimeWidgetMountState({
      dependencyModel: model,
      instance: managedSource,
      widgetId: managedSource.widgetId,
    });

    expect(mountState.props).toMatchObject({
      connectionRef: {
        id: 5,
        typeId: "finance.binance-market-data",
      },
      queryModelId: "binance-usdm-futures-ohlc",
      query: {
        kind: "binance-usdm-futures-ohlc",
        symbols: ["$(SOURCE-1).ACTIVECELLVALUE"],
        interval: "1m",
      },
    });
    expect(
      mountState.resolvedInputs?.[buildWidgetReferencePropInputId(["query", "symbols"])],
    ).toMatchObject({
      status: "valid",
      value: "ETHUSDT",
    });
    expect(
      resolveReferenceBackedWidgetState({
        props: mountState.props,
        resolvedInputs: mountState.resolvedInputs,
      }).props,
    ).toMatchObject({
      query: {
        symbols: ["ETHUSDT"],
      },
    });
    expect(managedSource.props).toMatchObject({
      query: {
        symbols: ["STALE"],
      },
    });
  });

  it("changes the managed stream runtime key when the projected reference value changes", () => {
    const owner = widget({
      id: "graph-1",
      widgetId: CORE_GRAPH_WIDGET_ID,
      props: {
        graphSourceMode: "connection-stream",
        embeddedConnectionQuery: {
          connectionRef: {
            id: 5,
            typeId: "finance.binance-market-data",
          },
          queryModelId: "binance-usdm-futures-ohlc",
          query: {
            kind: "binance-usdm-futures-ohlc",
            symbols: ["$(SOURCE-1).ACTIVECELLVALUE"],
            interval: "1m",
          },
        },
      },
    });
    const managedSource = widget({
      id: "stream-1",
      widgetId: CORE_CONNECTION_STREAM_QUERY_WIDGET_ID,
      managedBy: {
        ownerInstanceId: owner.id,
        role: "embedded-connection-source",
      },
      props: {
        connectionRef: {
          id: 5,
          typeId: "finance.binance-market-data",
        },
        queryModelId: "binance-usdm-futures-ohlc",
        query: {
          kind: "binance-usdm-futures-ohlc",
          symbols: ["STALE"],
          interval: "1m",
        },
      },
    });
    const widgetsForValue = (value: string) => [
      owner,
      managedSource,
      widget({
        id: "source-1",
        widgetId: "json-interaction-source",
        runtimeState: {
          value,
        },
      }),
    ];
    const btcModel = createDashboardWidgetDependencyModel(
      widgetsForValue("BTCUSDT"),
      resolveWidgetDefinition,
    );
    const ethModel = createDashboardWidgetDependencyModel(
      widgetsForValue("ETHUSDT"),
      resolveWidgetDefinition,
    );

    expect(
      resolveStreamRuntimeKeyFromMountState({
        dependencyModel: btcModel,
        stream: managedSource,
      }),
    ).not.toBe(
      resolveStreamRuntimeKeyFromMountState({
        dependencyModel: ethModel,
        stream: managedSource,
      }),
    );
  });

  it("keeps non-stream hidden mounts on raw props", () => {
    const graph = widget({
      id: "graph-1",
      widgetId: CORE_GRAPH_WIDGET_ID,
      props: {
        title: "Raw graph",
      },
    });
    const model = createDashboardWidgetDependencyModel([graph], resolveWidgetDefinition);
    const mountState = resolveHiddenSidebarRuntimeWidgetMountState({
      dependencyModel: model,
      instance: graph,
      widgetId: graph.widgetId,
    });

    expect(mountState).toEqual({
      props: graph.props,
    });
  });

  it("detects unresolved reference tokens before a stream subscription starts", () => {
    expect(
      hasPendingConnectionStreamReferenceValues({
        props: {
          query: {
            kind: "binance-usdm-futures-ohlc",
            symbols: ["$(SOURCE-1).ACTIVECELLVALUE"],
          },
        },
      }),
    ).toBe(true);
    expect(
      hasPendingConnectionStreamReferenceValues({
        props: {
          query: {
            kind: "binance-usdm-futures-ohlc",
            symbols: ["ETHUSDT"],
          },
        },
      }),
    ).toBe(false);
  });

  it("does not block subscription when only editor metadata still contains raw tokens", () => {
    expect(
      hasPendingConnectionStreamReferenceValues({
        props: {
          query: {
            kind: "binance-usdm-futures-ohlc",
            symbols: ["ETHUSDT"],
          },
          queryEditorState: {
            symbols: ["$(SOURCE-1).ACTIVECELLVALUE"],
          },
        },
      }),
    ).toBe(false);
  });
});
