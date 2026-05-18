/** @vitest-environment jsdom */

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  WIDGET_VARIABLE_REFERENCE_INPUT_CLASS,
  WidgetVariableReferenceInputProvider,
} from "./widget-variable-reference-input";
import type { WidgetReferenceLanguageSourceWidget } from "@/dashboards/widget-reference-language";

const sourceWidgets: WidgetReferenceLanguageSourceWidget[] = [
  {
    id: "table-1",
    title: "Prices Table",
    widgetId: "table",
    widgetTypeTitle: "Table",
    outputs: [
      {
        id: "activeRow",
        label: "Active row",
        contract: "core.value.json@v1" as const,
        valueDescriptor: {
          kind: "object",
          contract: "core.value.json@v1" as const,
          fields: [
            {
              key: "symbol",
              label: "Symbol",
              value: {
                kind: "primitive",
                contract: "core.value.string@v1" as const,
                primitive: "string",
              },
            },
            {
              key: "last_price",
              label: "Last price",
              value: {
                kind: "primitive",
                contract: "core.value.number@v1" as const,
                primitive: "number",
              },
            },
          ],
        },
      },
      {
        id: "activeCellValue",
        label: "Active cell value",
        contract: "core.value.string@v1" as const,
        valueDescriptor: {
          kind: "primitive",
          contract: "core.value.string@v1" as const,
          primitive: "string",
        },
      },
    ],
  },
  {
    id: "chart-1",
    title: "Price Chart",
    widgetId: "graph",
    widgetTypeTitle: "Graph",
    outputs: [{ id: "dataset" }],
  },
];

function flushEffects() {
  return new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), 0);
  });
}

describe("widget variable reference inputs", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("opens widget options when a settings input receives a reference trigger", async () => {
    function Harness() {
      const [value, setValue] = useState("$(");

      return (
        <WidgetVariableReferenceInputProvider sourceWidgets={sourceWidgets}>
          <Input
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
            }}
          />
        </WidgetVariableReferenceInputProvider>
      );
    }

    await act(async () => {
      root.render(<Harness />);
      await flushEffects();
    });

    const input = container.querySelector("input");
    expect(input).not.toBeNull();

    await act(async () => {
      input!.setSelectionRange(2, 2);
      input!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushEffects();
    });

    expect(container.querySelector("[role='listbox']")?.textContent).toContain("Prices Table");
    expect(container.querySelector("[role='listbox']")?.textContent).toContain("table-1");
  });

  it("inserts the selected widget token into the active input", async () => {
    function Harness() {
      const [value, setValue] = useState("Symbol: $(");

      return (
        <WidgetVariableReferenceInputProvider sourceWidgets={sourceWidgets}>
          <Input
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
            }}
          />
        </WidgetVariableReferenceInputProvider>
      );
    }

    await act(async () => {
      root.render(<Harness />);
      await flushEffects();
    });

    const input = container.querySelector("input");
    expect(input).not.toBeNull();

    await act(async () => {
      input!.focus();
      input!.setSelectionRange("Symbol: $(".length, "Symbol: $(".length);
      input!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushEffects();
    });

    const tableOption = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Prices Table"),
    );
    expect(tableOption).not.toBeUndefined();

    await act(async () => {
      tableOption!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await flushEffects();
    });

    expect(input!.value).toBe("Symbol: $(table-1)");
  });

  it("also works for textareas inside the provider", async () => {
    function Harness() {
      const [value, setValue] = useState("$(");

      return (
        <WidgetVariableReferenceInputProvider sourceWidgets={sourceWidgets}>
          <Textarea
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
            }}
          />
        </WidgetVariableReferenceInputProvider>
      );
    }

    await act(async () => {
      root.render(<Harness />);
      await flushEffects();
    });

    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();

    await act(async () => {
      textarea!.focus();
      textarea!.setSelectionRange(2, 2);
      textarea!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushEffects();
    });

    expect(container.querySelector("[role='listbox']")?.textContent).toContain("Prices Table");
  });

  it("supports class-based opt-in for custom text inputs", async () => {
    function Harness() {
      const [value, setValue] = useState("$(");

      return (
        <WidgetVariableReferenceInputProvider sourceWidgets={sourceWidgets}>
          <input
            className={WIDGET_VARIABLE_REFERENCE_INPUT_CLASS}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
            }}
          />
        </WidgetVariableReferenceInputProvider>
      );
    }

    await act(async () => {
      root.render(<Harness />);
      await flushEffects();
    });

    const input = container.querySelector("input");
    expect(input).not.toBeNull();

    await act(async () => {
      input!.focus();
      input!.setSelectionRange(2, 2);
      input!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushEffects();
    });

    expect(container.querySelector("[role='listbox']")?.textContent).toContain("Prices Table");

    const tableOption = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Prices Table"),
    );
    expect(tableOption).not.toBeUndefined();

    await act(async () => {
      tableOption!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await flushEffects();
    });

    expect(input!.value).toBe("$(table-1)");
  });

  it("completes exposed sources after a selected widget token", async () => {
    function Harness() {
      const [value, setValue] = useState("$(table-1).");

      return (
        <WidgetVariableReferenceInputProvider sourceWidgets={sourceWidgets}>
          <Input
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
            }}
          />
        </WidgetVariableReferenceInputProvider>
      );
    }

    await act(async () => {
      root.render(<Harness />);
      await flushEffects();
    });

    const input = container.querySelector("input");
    expect(input).not.toBeNull();

    await act(async () => {
      input!.focus();
      input!.setSelectionRange("$(table-1).".length, "$(table-1).".length);
      input!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushEffects();
    });

    expect(container.querySelector("[role='listbox']")?.textContent).toContain("Active row");

    const activeRowOption = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Active row"),
    );
    expect(activeRowOption).not.toBeUndefined();

    await act(async () => {
      activeRowOption!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await flushEffects();
    });

    expect(input!.value).toBe("$(table-1).activeRow");
  });

  it("commits a completed source reference as a token with Enter", async () => {
    function Harness() {
      const [value, setValue] = useState("$(table-1).activeCell");

      return (
        <WidgetVariableReferenceInputProvider sourceWidgets={sourceWidgets}>
          <Input
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
            }}
          />
        </WidgetVariableReferenceInputProvider>
      );
    }

    await act(async () => {
      root.render(<Harness />);
      await flushEffects();
    });

    const input = container.querySelector("input");
    expect(input).not.toBeNull();

    await act(async () => {
      input!.focus();
      input!.setSelectionRange("$(table-1).activeCell".length, "$(table-1).activeCell".length);
      input!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushEffects();
    });

    expect(container.querySelector("[role='listbox']")?.textContent).toContain("Active cell value");

    await act(async () => {
      input!.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
      }));
      await flushEffects();
    });

    expect(input!.value).toBe("$(table-1).activeCellValue");
    expect(container.textContent).toContain("Prices Table · Active cell value");
  });

  it("completes nested fields after a selected source", async () => {
    function Harness() {
      const [value, setValue] = useState("$(table-1).activeRow.");

      return (
        <WidgetVariableReferenceInputProvider sourceWidgets={sourceWidgets}>
          <Input
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
            }}
          />
        </WidgetVariableReferenceInputProvider>
      );
    }

    await act(async () => {
      root.render(<Harness />);
      await flushEffects();
    });

    const input = container.querySelector("input");
    expect(input).not.toBeNull();

    await act(async () => {
      input!.focus();
      input!.setSelectionRange("$(table-1).activeRow.".length, "$(table-1).activeRow.".length);
      input!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushEffects();
    });

    expect(container.querySelector("[role='listbox']")?.textContent).toContain("Symbol");

    const symbolOption = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Symbol"),
    );
    expect(symbolOption).not.toBeUndefined();

    await act(async () => {
      symbolOption!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await flushEffects();
    });

    expect(input!.value).toBe("$(table-1).activeRow.symbol");
    expect(container.textContent).toContain("Prices Table · Active row.symbol");
  });

  it("renders completed whole-value references as removable tokens", async () => {
    function Harness() {
      const [value, setValue] = useState("$(table-1).activeRow.symbol");

      return (
        <WidgetVariableReferenceInputProvider sourceWidgets={sourceWidgets}>
          <Input
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
            }}
          />
        </WidgetVariableReferenceInputProvider>
      );
    }

    await act(async () => {
      root.render(<Harness />);
      await flushEffects();
    });

    expect(container.textContent).toContain("Prices Table · Active row.symbol");
    expect(container.textContent).toContain("table-1");

    const removeButton = container.querySelector<HTMLButtonElement>(
      "button[aria-label^='Remove reference']",
    );
    const input = container.querySelector("input");

    expect(removeButton).not.toBeNull();
    expect(input).not.toBeNull();

    await act(async () => {
      removeButton!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await flushEffects();
    });

    expect(input!.value).toBe("");
    expect(container.querySelector("button[aria-label^='Remove reference']")).toBeNull();
  });
});
