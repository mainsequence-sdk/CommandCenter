import { describe, expect, it } from "vitest";

import {
  WIDGET_REFERENCE_TITLE_INPUT_ID,
  buildWidgetReferencePropInputId,
  resolveReferenceBackedWidgetState,
} from "./widget-instance-references";

describe("widget instance references", () => {
  it("coerces scalar upstream values into array props", () => {
    const resolved = resolveReferenceBackedWidgetState({
      props: {
        query: {
          symbols: [],
        },
      },
      resolvedInputs: {
        [buildWidgetReferencePropInputId(["query", "symbols"])]: {
          inputId: buildWidgetReferencePropInputId(["query", "symbols"]),
          label: "Symbols",
          status: "valid",
          value: "AAPL",
        },
      },
    });

    expect(resolved.props).toEqual({
      query: {
        symbols: ["AAPL"],
      },
    });
  });

  it("coerces scalar title bindings to strings", () => {
    const resolved = resolveReferenceBackedWidgetState({
      instanceTitle: "Original",
      props: {},
      resolvedInputs: {
        [WIDGET_REFERENCE_TITLE_INPUT_ID]: {
          inputId: WIDGET_REFERENCE_TITLE_INPUT_ID,
          label: "Display title",
          status: "valid",
          value: 42,
        },
      },
    });

    expect(resolved.title).toBe("42");
  });

  it("does not leak unresolved reference syntax into the rendered title", () => {
    const resolved = resolveReferenceBackedWidgetState({
      instanceTitle: "$(table-1).activeCellValue",
      props: {},
      resolvedInputs: {
        [WIDGET_REFERENCE_TITLE_INPUT_ID]: {
          inputId: WIDGET_REFERENCE_TITLE_INPUT_ID,
          label: "Display title",
          status: "contract-mismatch",
          value: null,
        },
      },
    });

    expect(resolved.title).toBeUndefined();
  });

  it("coerces string values into numeric props when the target path is numeric", () => {
    const resolved = resolveReferenceBackedWidgetState({
      props: {
        query: {
          limit: 10,
        },
      },
      resolvedInputs: {
        [buildWidgetReferencePropInputId(["query", "limit"])]: {
          inputId: buildWidgetReferencePropInputId(["query", "limit"]),
          label: "Limit",
          status: "valid",
          value: "25",
        },
      },
    });

    expect(resolved.props).toEqual({
      query: {
        limit: 25,
      },
    });
  });
});
