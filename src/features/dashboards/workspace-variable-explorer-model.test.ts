import { describe, expect, it } from "vitest";

import type { DashboardWidgetInstance } from "@/dashboards/types";
import type { DashboardWidgetDependencyModel } from "@/dashboards/widget-dependencies";
import type {
  WorkspaceVariableReferenceEntry,
  WorkspaceVariableReferenceRegistry,
} from "@/dashboards/widget-variable-registry";
import { CORE_VALUE_JSON_CONTRACT } from "@/widgets/shared/value-contracts";
import type { WidgetPortBinding } from "@/widgets/types";

import {
  buildWorkspaceVariableExplorerModel,
  filterWorkspaceVariableExplorerEntries,
  serializeWorkspaceVariableValuePreview,
} from "./workspace-variable-explorer-model";

function widget(input: Partial<DashboardWidgetInstance> & Pick<DashboardWidgetInstance, "id">) {
  return {
    widgetId: "test-widget",
    layout: {
      w: 4,
      h: 3,
    },
    ...input,
  } satisfies DashboardWidgetInstance;
}

function binding(input: Pick<WidgetPortBinding, "sourceWidgetId" | "sourceOutputId">) {
  return input as WidgetPortBinding;
}

function variableEntry(input: {
  sourceWidgetId: string;
  sourceOutputId: string;
  transformSignature?: string;
  consumers?: WorkspaceVariableReferenceEntry["consumers"];
}) {
  const transformSignature = input.transformSignature ?? "identity";

  return {
    id: JSON.stringify([input.sourceWidgetId, input.sourceOutputId, transformSignature]),
    key: {
      sourceWidgetId: input.sourceWidgetId,
      sourceOutputId: input.sourceOutputId,
      transformSignature,
    },
    consumers: input.consumers ?? [],
  } satisfies WorkspaceVariableReferenceEntry;
}

function variableRegistry(entries: WorkspaceVariableReferenceEntry[]) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const bySourceWidgetId = new Map<string, WorkspaceVariableReferenceEntry[]>();
  const byConsumerWidgetId = new Map<string, WorkspaceVariableReferenceEntry[]>();

  entries.forEach((entry) => {
    bySourceWidgetId.set(entry.key.sourceWidgetId, [
      ...(bySourceWidgetId.get(entry.key.sourceWidgetId) ?? []),
      entry,
    ]);
    entry.consumers.forEach((consumer) => {
      byConsumerWidgetId.set(consumer.targetWidgetId, [
        ...(byConsumerWidgetId.get(consumer.targetWidgetId) ?? []),
        entry,
      ]);
    });
  });

  return {
    entries,
    byId,
    bySourceWidgetId,
    byConsumerWidgetId,
  } satisfies WorkspaceVariableReferenceRegistry;
}

function dependencyModel(input: {
  registry: WorkspaceVariableReferenceRegistry;
  outputs?: Record<string, Record<string, unknown>>;
}) {
  return {
    entries: [],
    graph: {
      nodes: [],
      edges: [],
    },
    variableRegistry: input.registry,
    getWidgetDefinition: (widgetId: string) => ({
      id: widgetId,
      title: widgetId,
    }),
    resolveIo: () => undefined,
    resolveInputs: () => undefined,
    resolveInputsForInstance: () => undefined,
    resolveOutputs: (instanceId: string) =>
      Object.fromEntries(
        Object.entries(input.outputs?.[instanceId] ?? {}).map(([outputId, value]) => [
          outputId,
          {
            outputId,
            label: outputId,
            contractId: CORE_VALUE_JSON_CONTRACT,
            value,
          },
        ]),
      ),
  } as unknown as DashboardWidgetDependencyModel;
}

describe("workspace variable explorer model", () => {
  it("builds current variable entries from active references with materialized values", () => {
    const widgets = [
      widget({
        id: "table-1",
        title: "Crypto Tickers",
      }),
      widget({
        id: "graph-1",
        title: "Price Graph",
      }),
    ];
    const entry = variableEntry({
      sourceWidgetId: "table-1",
      sourceOutputId: "activeCellValue",
      consumers: [
        {
          targetWidgetId: "graph-1",
          targetInputId: "__widget-reference.title",
          targetKind: "title",
          binding: binding({
            sourceWidgetId: "table-1",
            sourceOutputId: "activeCellValue",
          }),
        },
      ],
    });

    const explorerModel = buildWorkspaceVariableExplorerModel({
      dependencyModel: dependencyModel({
        registry: variableRegistry([entry]),
        outputs: {
          "table-1": {
            activeCellValue: "ETHUSDT",
          },
        },
      }),
      widgets,
    });

    expect(explorerModel.currentVariables).toHaveLength(1);
    expect(explorerModel.referencedVariables).toHaveLength(0);
    expect(explorerModel.currentVariables[0]).toMatchObject({
      sourceWidgetTitle: "Crypto Tickers",
      sourceOutputId: "activeCellValue",
      referenceToken: "$(table-1).activeCellValue",
      status: "ready",
      valuePreview: {
        text: "ETHUSDT",
      },
      consumers: [
        expect.objectContaining({
          targetWidgetTitle: "Price Graph",
          targetKind: "title",
        }),
      ],
    });
  });

  it("separates referenced variables whose source value is null or unavailable", () => {
    const widgets = [
      widget({
        id: "asset-screener-1",
        title: "Asset Screener",
      }),
      widget({
        id: "connection-query-1",
        title: "Market Data Query",
      }),
    ];
    const entry = variableEntry({
      sourceWidgetId: "asset-screener-1",
      sourceOutputId: "activeCellValue",
      consumers: [
        {
          targetWidgetId: "connection-query-1",
          targetInputId: "__widget-reference.prop.query.symbols",
          targetKind: "prop",
          propPath: ["query", "symbols"],
          binding: binding({
            sourceWidgetId: "asset-screener-1",
            sourceOutputId: "activeCellValue",
          }),
        },
      ],
    });

    const explorerModel = buildWorkspaceVariableExplorerModel({
      dependencyModel: dependencyModel({
        registry: variableRegistry([entry]),
        outputs: {
          "asset-screener-1": {
            activeCellValue: null,
          },
        },
      }),
      widgets,
    });

    expect(explorerModel.currentVariables).toHaveLength(0);
    expect(explorerModel.referencedVariables).toHaveLength(1);
    expect(explorerModel.referencedVariables[0]).toMatchObject({
      status: "waiting",
      valuePreview: {
        text: "No current value (null)",
      },
      consumers: [
        expect.objectContaining({
          propPath: ["query", "symbols"],
          targetWidgetTitle: "Market Data Query",
        }),
      ],
    });
  });

  it("does not expose unused possible widget outputs", () => {
    const explorerModel = buildWorkspaceVariableExplorerModel({
      dependencyModel: dependencyModel({
        registry: variableRegistry([]),
        outputs: {
          "table-1": {
            activeCellValue: "BTCUSDT",
          },
        },
      }),
      widgets: [
        widget({
          id: "table-1",
        }),
      ],
    });

    expect(explorerModel.currentVariables).toEqual([]);
    expect(explorerModel.referencedVariables).toEqual([]);
  });

  it("keeps consumer groups searchable by target widget and transform path", () => {
    const entry = variableEntry({
      sourceWidgetId: "table-1",
      sourceOutputId: "activeRow",
      transformSignature: "extract-path:Symbol",
      consumers: [
        {
          targetWidgetId: "graph-1",
          targetInputId: "__widget-reference.title",
          targetKind: "title",
          binding: binding({
            sourceWidgetId: "table-1",
            sourceOutputId: "activeRow",
          }),
        },
        {
          targetWidgetId: "connection-query-1",
          targetInputId: "__widget-reference.prop.query.symbols",
          targetKind: "prop",
          propPath: ["query", "symbols"],
          binding: binding({
            sourceWidgetId: "table-1",
            sourceOutputId: "activeRow",
          }),
        },
      ],
    });
    const explorerModel = buildWorkspaceVariableExplorerModel({
      dependencyModel: dependencyModel({
        registry: variableRegistry([entry]),
        outputs: {
          "table-1": {
            activeRow: {
              Symbol: "BTCUSDT",
            },
          },
        },
      }),
      widgets: [
        widget({
          id: "table-1",
          title: "Crypto Table",
        }),
        widget({
          id: "graph-1",
          title: "Header Graph",
        }),
        widget({
          id: "connection-query-1",
          title: "Binance Query",
        }),
      ],
    });

    expect(explorerModel.currentVariables[0]?.referenceToken).toBe(
      "$(table-1).activeRow.Symbol",
    );
    expect(explorerModel.totalConsumers).toBe(2);
    expect(
      filterWorkspaceVariableExplorerEntries(explorerModel.currentVariables, "binance"),
    ).toHaveLength(1);
    expect(
      filterWorkspaceVariableExplorerEntries(explorerModel.currentVariables, "symbol"),
    ).toHaveLength(1);
  });

  it("truncates large value previews", () => {
    const preview = serializeWorkspaceVariableValuePreview("x".repeat(80), {
      maxLength: 24,
    });

    expect(preview.truncated).toBe(true);
    expect(preview.text).toHaveLength(24);
    expect(preview.text.endsWith("…")).toBe(true);
  });
});
