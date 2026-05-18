import { describe, expect, it } from "vitest";

import {
  WIDGET_REFERENCE_TITLE_INPUT_ID,
  buildWidgetReferencePropInputId,
} from "@/dashboards/widget-instance-references";

import {
  buildWorkspaceVariableReferenceRegistry,
} from "./widget-variable-registry";

describe("workspace variable reference registry", () => {
  it("registers only linked variable references and groups shared keys", () => {
    const registry = buildWorkspaceVariableReferenceRegistry([
      {
        id: "table-1",
      },
      {
        id: "card-1",
        bindings: {
          [WIDGET_REFERENCE_TITLE_INPUT_ID]: {
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
      },
      {
        id: "chart-1",
        bindings: {
          [buildWidgetReferencePropInputId(["query", "symbol"])]: {
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
      },
      {
        id: "unlinked-1",
      },
    ]);

    expect(registry.entries).toHaveLength(1);
    expect(registry.entries[0]?.key).toEqual({
      sourceWidgetId: "table-1",
      sourceOutputId: "activeRow",
      transformSignature: "extract-path:symbol",
    });
    expect(registry.entries[0]?.consumers).toEqual([
      expect.objectContaining({
        targetWidgetId: "card-1",
        targetInputId: WIDGET_REFERENCE_TITLE_INPUT_ID,
        targetKind: "title",
      }),
      expect.objectContaining({
        targetWidgetId: "chart-1",
        targetInputId: buildWidgetReferencePropInputId(["query", "symbol"]),
        targetKind: "prop",
        propPath: ["query", "symbol"],
      }),
    ]);
    expect(registry.bySourceWidgetId.get("table-1")).toHaveLength(1);
    expect(registry.byConsumerWidgetId.get("card-1")).toHaveLength(1);
    expect(registry.byConsumerWidgetId.get("unlinked-1")).toBeUndefined();
  });

  it("ignores self-references when building active variable indexes", () => {
    const registry = buildWorkspaceVariableReferenceRegistry([
      {
        id: "table-1",
        bindings: {
          self: {
            sourceWidgetId: "table-1",
            sourceOutputId: "activeRow",
          },
        },
      },
    ]);

    expect(registry.entries).toEqual([]);
  });

  it("ignores ordinary widget input bindings because they are dependency graph edges, not variable-script references", () => {
    const registry = buildWorkspaceVariableReferenceRegistry([
      {
        id: "graph-1",
        bindings: {
          sourceData: {
            sourceWidgetId: "query-1",
            sourceOutputId: "dataset",
          },
        },
      },
    ]);

    expect(registry.entries).toEqual([]);
  });
});
