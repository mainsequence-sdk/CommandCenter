import { describe, expect, it } from "vitest";

import {
  WIDGET_REFERENCE_PROPS_OUTPUT_ID,
  WIDGET_REFERENCE_RUNTIME_STATE_OUTPUT_ID,
  WIDGET_REFERENCE_TITLE_INPUT_ID,
} from "@/dashboards/widget-instance-references";

import {
  buildWidgetReferenceLanguageSourceWidgets,
  compileWidgetReferenceExpression,
  deriveWidgetReferenceExpressionBindings,
  parseWidgetReferenceExpression,
  reconcileWidgetReferenceExpressionBindings,
  resolveWidgetReferenceDisplayToken,
  resolveWidgetReferenceCompletionContext,
  syncWidgetReferenceExpressionBindings,
  type WidgetReferenceLanguageSourceWidget,
} from "./widget-reference-language";
import type { DashboardWidgetDependencyModel } from "./widget-dependencies";

describe("widget reference language", () => {
  const sourceWidgets: WidgetReferenceLanguageSourceWidget[] = [
    {
      id: "table-1",
      title: "Prices Table",
      widgetId: "table",
      outputs: [
        { id: "selectedRows" },
        {
          id: "activeRow",
          label: "Active row",
          contract: "core.value.json@v1",
          valueDescriptor: {
            kind: "object",
            contract: "core.value.json@v1",
            fields: [
              {
                key: "symbol",
                label: "Symbol",
                value: {
                  kind: "primitive",
                  contract: "core.value.string@v1",
                  primitive: "string",
                },
              },
            ],
          },
        },
        { id: "activeCellValue" },
      ],
    },
    {
      id: "query-1",
      title: "Query Source",
      widgetId: "connection-query",
      outputs: [
        { id: "dataset" },
      ],
    },
  ];

  it("parses exact widget reference expressions", () => {
    expect(parseWidgetReferenceExpression("$(table-1).activeRow.symbol")).toEqual({
      raw: "$(table-1).activeRow.symbol",
      widgetToken: "table-1",
      root: "activeRow",
      accessors: [
        {
          kind: "path",
          segment: "symbol",
        },
      ],
    });
  });

  it("compiles declared output references with ordered transform steps", () => {
    const compiled = compileWidgetReferenceExpression(
      "$(Prices Table).selectedRows.rows[0].symbol",
      sourceWidgets,
    );

    expect(compiled).toEqual({
      ok: true,
      compiled: {
        sourceWidgetId: "table-1",
        sourceOutputId: "selectedRows",
        transformSteps: [
          {
            id: "extract-path",
            path: ["rows"],
          },
          {
            id: "select-array-item",
            mode: "index",
            index: 0,
          },
          {
            id: "extract-path",
            path: ["symbol"],
          },
        ],
      },
    });
  });

  it("compiles props and runtimeState discovery roots", () => {
    expect(
      compileWidgetReferenceExpression(
        "$(query-1).props.query.symbols[0]",
        sourceWidgets,
      ),
    ).toEqual({
      ok: true,
      compiled: {
        sourceWidgetId: "query-1",
        sourceOutputId: WIDGET_REFERENCE_PROPS_OUTPUT_ID,
        transformSteps: [
          {
            id: "extract-path",
            path: ["query", "symbols"],
          },
          {
            id: "select-array-item",
            mode: "index",
            index: 0,
          },
        ],
      },
    });

    expect(
      compileWidgetReferenceExpression(
        "$(Prices Table).runtimeState.interaction.selection.selectedRowKeys[last]",
        sourceWidgets,
      ),
    ).toEqual({
      ok: true,
      compiled: {
        sourceWidgetId: "table-1",
        sourceOutputId: WIDGET_REFERENCE_RUNTIME_STATE_OUTPUT_ID,
        transformSteps: [
          {
            id: "extract-path",
            path: ["interaction", "selection", "selectedRowKeys"],
          },
          {
            id: "select-array-item",
            mode: "last",
            index: undefined,
          },
        ],
      },
    });
  });

  it("compiles widget ids, output ids, and descriptor fields case-insensitively", () => {
    expect(
      compileWidgetReferenceExpression(
        "$(TABLE-1).ACTIVEROW.SYMBOL",
        sourceWidgets,
      ),
    ).toEqual({
      ok: true,
      compiled: {
        sourceWidgetId: "table-1",
        sourceOutputId: "activeRow",
        transformSteps: [
          {
            id: "extract-path",
            path: ["symbol"],
          },
        ],
      },
    });

    expect(
      compileWidgetReferenceExpression(
        "$(TABLE-1).ACTIVECELLVALUE",
        sourceWidgets,
      ),
    ).toEqual({
      ok: true,
      compiled: {
        sourceWidgetId: "table-1",
        sourceOutputId: "activeCellValue",
        transformSteps: undefined,
      },
    });
  });

  it("completes widget sources after a selected widget token", () => {
    expect(
      resolveWidgetReferenceCompletionContext({
        sourceWidgets,
        value: "$(table-1).",
      })?.options.map((option) => option.insertText),
    ).toEqual(expect.arrayContaining(["activeRow", "props", "runtimeState", "title"]));
  });

  it("completes nested source fields from value descriptors", () => {
    const completion = resolveWidgetReferenceCompletionContext({
      sourceWidgets,
      value: "$(table-1).activeRow.",
    });

    expect(completion?.kind).toBe("field");
    expect(completion?.options).toEqual([
      expect.objectContaining({
        insertText: "symbol",
        label: "Symbol",
      }),
    ]);
  });

  it("resolves display metadata for completed whole-value references", () => {
    expect(
      resolveWidgetReferenceDisplayToken({
        sourceWidgets,
        value: "$(table-1).activeRow.symbol",
      }),
    ).toEqual({
      expression: "$(table-1).activeRow.symbol",
      widgetId: "table-1",
      widgetLabel: "Prices Table",
      sourceLabel: "Active row",
      pathLabel: "symbol",
      label: "Prices Table · Active row.symbol",
      detail: "table-1",
    });
  });

  it("derives title and prop bindings from expression-authored settings", () => {
    const derived = deriveWidgetReferenceExpressionBindings({
      title: "$(Prices Table).activeCellValue",
      props: {
        query: {
          symbols: ["$(table-1).activeRow.symbol"],
        },
      },
      sourceWidgets,
    });

    expect(derived.errors).toEqual([]);
    expect(derived.managedInputIds).toContain(WIDGET_REFERENCE_TITLE_INPUT_ID);
    expect(derived.targets).toMatchObject([
      {
        inputId: WIDGET_REFERENCE_TITLE_INPUT_ID,
        binding: {
          sourceWidgetId: "table-1",
          sourceOutputId: "activeCellValue",
        },
      },
      {
        inputId: "__widget-reference.target.prop:query%2Fsymbols",
        binding: {
          sourceWidgetId: "table-1",
          sourceOutputId: "activeRow",
          transformSteps: [
            {
              id: "extract-path",
              path: ["symbol"],
            },
          ],
        },
      },
    ]);
  });

  it("removes stale expression-managed bindings when the expression is cleared", () => {
    const nextBindings = syncWidgetReferenceExpressionBindings({
      bindings: {
        [WIDGET_REFERENCE_TITLE_INPUT_ID]: {
          sourceWidgetId: "table-1",
          sourceOutputId: "activeCellValue",
        },
        staticBinding: {
          sourceWidgetId: "query-1",
          sourceOutputId: "dataset",
        },
      },
      managedInputIds: [WIDGET_REFERENCE_TITLE_INPUT_ID],
      nextExpressions: {
        errors: [],
        managedInputIds: [],
        targets: [],
      },
    });

    expect(nextBindings).toEqual({
      staticBinding: {
        sourceWidgetId: "query-1",
        sourceOutputId: "dataset",
      },
    });
  });

  it("reconciles prop expression bindings when a managed field clears its token", () => {
    const nextBindings = reconcileWidgetReferenceExpressionBindings({
      bindings: {
        "__widget-reference.target.prop:query%2Fsymbols": {
          sourceWidgetId: "table-1",
          sourceOutputId: "activeRow",
          transformSteps: [
            {
              id: "extract-path",
              path: ["symbol"],
            },
          ],
        },
        staticBinding: {
          sourceWidgetId: "query-1",
          sourceOutputId: "dataset",
        },
      },
      currentProps: {
        query: {
          symbols: ["$(table-1).activeRow.symbol"],
        },
      },
      nextProps: {
        query: {
          symbols: [],
        },
      },
      sourceWidgets,
    });

    expect(nextBindings).toEqual({
      errors: [],
      managedInputIds: [],
      bindings: {
        staticBinding: {
          sourceWidgetId: "query-1",
          sourceOutputId: "dataset",
        },
      },
    });
  });

  it("surfaces ambiguous title errors", () => {
    const result = compileWidgetReferenceExpression("$(Duplicate).activeRow.symbol", [
      {
        id: "table-1",
        title: "Duplicate",
        widgetId: "table",
        outputs: [{ id: "activeRow" }],
      },
      {
        id: "table-2",
        title: "Duplicate",
        widgetId: "table",
        outputs: [{ id: "activeRow" }],
      },
    ]);

    expect(result).toEqual({
      ok: false,
      error:
        'Widget reference "Duplicate" is ambiguous. Use the widget instance id instead of the shared title.',
    });
  });

  it("builds source widgets from the dependency model", () => {
    const model = {
      entries: [
        {
          instance: {
            id: "table-1",
            title: "Prices Table",
            widgetId: "table",
            layout: { w: 8, h: 6 },
          },
        },
      ],
      graph: { nodes: [], edges: [] },
      getWidgetDefinition: () => undefined,
      resolveIo: () => ({
        outputs: [{ id: "activeRow", label: "Active row", contract: "core.value.json@v1" }],
      }),
      resolveOutputs: () => undefined,
      resolveInputs: () => undefined,
    } as unknown as DashboardWidgetDependencyModel;

    expect(buildWidgetReferenceLanguageSourceWidgets(model)).toEqual([
      {
        id: "table-1",
        title: "Prices Table",
        widgetId: "table",
        outputs: [
          {
            id: "activeRow",
            label: "Active row",
            contract: "core.value.json@v1",
            valueDescriptor: undefined,
            description: undefined,
          },
        ],
      },
    ]);
  });

  it("uses inferred runtime descriptors for unknown JSON outputs", () => {
    const model = {
      entries: [
        {
          instance: {
            id: "table-1",
            title: "Prices Table",
            widgetId: "table",
            layout: { w: 8, h: 6 },
          },
        },
      ],
      graph: { nodes: [], edges: [] },
      getWidgetDefinition: () => undefined,
      resolveIo: () => ({
        outputs: [{ id: "activeRow", label: "Active row", contract: "core.value.json@v1" }],
      }),
      resolveOutputs: () => ({
        activeRow: {
          outputId: "activeRow",
          label: "Active row",
          contractId: "core.value.json@v1",
          value: {
            symbol: "BTCUSDT",
          },
          valueDescriptor: {
            kind: "object",
            contract: "core.value.json@v1",
            fields: [
              {
                key: "symbol",
                label: "symbol",
                value: {
                  kind: "primitive",
                  contract: "core.value.string@v1",
                  primitive: "string",
                },
              },
            ],
          },
        },
      }),
      resolveInputs: () => undefined,
    } as unknown as DashboardWidgetDependencyModel;

    const completion = resolveWidgetReferenceCompletionContext({
      sourceWidgets: buildWidgetReferenceLanguageSourceWidgets(model),
      value: "$(table-1).activeRow.Sym",
    });

    expect(completion?.options).toEqual([
      expect.objectContaining({
        insertText: "symbol",
      }),
    ]);
  });
});
