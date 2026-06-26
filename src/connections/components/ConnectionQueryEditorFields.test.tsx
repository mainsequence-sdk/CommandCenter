/** @vitest-environment jsdom */

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { WidgetVariableReferenceInputProvider } from "@/widgets/shared/widget-variable-reference-input";
import type { WidgetReferenceLanguageSourceWidget } from "@/dashboards/widget-reference-language";

import { QueryStringListField } from "./ConnectionQueryEditorFields";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

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
          ],
        },
      },
    ],
  },
];

function flushEffects() {
  return new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), 0);
  });
}

function setNativeTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  descriptor?.set?.call(textarea, value);
}

describe("QueryStringListField widget references", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  it("updates the committed list while typing plain symbols", async () => {
    function Harness() {
      const [value, setValue] = useState<string[] | undefined>(["AAPL"]);

      return (
        <WidgetVariableReferenceInputProvider sourceWidgets={sourceWidgets}>
          <QueryStringListField
            label="Symbols"
            value={value}
            onChange={setValue}
            placeholder="AAPL, MSFT"
          />
          <div data-testid="value">{JSON.stringify(value ?? null)}</div>
        </WidgetVariableReferenceInputProvider>
      );
    }

    await act(async () => {
      root.render(<Harness />);
      await flushEffects();
    });

    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();
    expect(textarea!.value).toBe("AAPL");

    await act(async () => {
      textarea!.focus();
      setNativeTextareaValue(textarea!, "AAPL\nMSFT");
      textarea!.dispatchEvent(new Event("input", { bubbles: true }));
      await flushEffects();
    });

    expect(textarea!.value).toBe("AAPL\nMSFT");
    expect(container.querySelector('[data-testid="value"]')?.textContent).toBe(
      '["AAPL","MSFT"]',
    );
  });

  it("normalizes comma-separated values on blur", async () => {
    function Harness() {
      const [value, setValue] = useState<string[] | undefined>(undefined);

      return (
        <WidgetVariableReferenceInputProvider sourceWidgets={sourceWidgets}>
          <QueryStringListField
            label="Symbols"
            value={value}
            onChange={setValue}
            placeholder="AAPL, MSFT"
          />
          <div data-testid="value">{JSON.stringify(value ?? null)}</div>
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
      setNativeTextareaValue(textarea!, "AAPL, MSFT, AAPL");
      textarea!.dispatchEvent(new Event("input", { bubbles: true }));
      textarea!.blur();
      await flushEffects();
      await flushEffects();
    });

    expect(textarea!.value).toBe("AAPL\nMSFT");
    expect(container.querySelector('[data-testid="value"]')?.textContent).toBe(
      '["AAPL","MSFT"]',
    );
  });

  it("commits a complete widget reference with Enter", async () => {
    function Harness() {
      const [value, setValue] = useState<string[] | undefined>(undefined);

      return (
        <WidgetVariableReferenceInputProvider sourceWidgets={sourceWidgets}>
          <QueryStringListField
            label="Symbols"
            value={value}
            onChange={setValue}
            placeholder="AAPL, MSFT"
          />
          <div data-testid="value">{JSON.stringify(value ?? null)}</div>
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
      setNativeTextareaValue(textarea!, "$(table-1).activeRow.symbol");
      textarea!.dispatchEvent(new Event("input", { bubbles: true }));
      await flushEffects();
    });

    expect(container.querySelector('[data-testid="value"]')?.textContent).toBe(
      '["$(table-1).activeRow.symbol"]',
    );
  });

  it("commits nested field completions immediately for buffered list inputs", async () => {
    function Harness() {
      const [value, setValue] = useState<string[] | undefined>(undefined);

      return (
        <WidgetVariableReferenceInputProvider sourceWidgets={sourceWidgets}>
          <QueryStringListField
            label="Symbols"
            value={value}
            onChange={setValue}
            placeholder="AAPL, MSFT"
          />
          <div data-testid="value">{JSON.stringify(value ?? null)}</div>
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
      setNativeTextareaValue(textarea!, "$(table-1).activeRow.");
      textarea!.setSelectionRange(textarea!.value.length, textarea!.value.length);
      textarea!.dispatchEvent(new Event("input", { bubbles: true }));
      textarea!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushEffects();
    });

    const symbolOption = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Symbol"),
    );
    expect(symbolOption).not.toBeUndefined();

    await act(async () => {
      symbolOption!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await flushEffects();
      await flushEffects();
    });

    expect(container.querySelector('[data-testid="value"]')?.textContent).toBe(
      '["$(table-1).activeRow.symbol"]',
    );
  });

  it("keeps source completions editable so nested fields can be selected next", async () => {
    function Harness() {
      const [value, setValue] = useState<string[] | undefined>(undefined);

      return (
        <WidgetVariableReferenceInputProvider sourceWidgets={sourceWidgets}>
          <QueryStringListField
            label="Symbols"
            value={value}
            onChange={setValue}
            placeholder="AAPL, MSFT"
          />
          <div data-testid="value">{JSON.stringify(value ?? null)}</div>
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
      setNativeTextareaValue(textarea!, "$(table-1).");
      textarea!.setSelectionRange(textarea!.value.length, textarea!.value.length);
      textarea!.dispatchEvent(new Event("input", { bubbles: true }));
      textarea!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushEffects();
    });

    const activeRowOption = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Active row"),
    );
    expect(activeRowOption).not.toBeUndefined();

    await act(async () => {
      activeRowOption!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await flushEffects();
      await flushEffects();
    });

    expect(textarea!.value).toBe("$(table-1).activeRow");
    expect(container.querySelector('[data-testid="value"]')?.textContent).toBe(
      '["$(table-1).activeRow"]',
    );

    await act(async () => {
      setNativeTextareaValue(textarea!, `${textarea!.value}.`);
      textarea!.setSelectionRange(textarea!.value.length, textarea!.value.length);
      textarea!.dispatchEvent(new Event("input", { bubbles: true }));
      textarea!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushEffects();
    });

    const symbolOption = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Symbol"),
    );
    expect(symbolOption).not.toBeUndefined();

    await act(async () => {
      symbolOption!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await flushEffects();
      await flushEffects();
    });

    expect(container.querySelector('[data-testid="value"]')?.textContent).toBe(
      '["$(table-1).activeRow.symbol"]',
    );
  });

  it("appends suggestions to the editable text list", async () => {
    function Harness() {
      const [value, setValue] = useState<string[] | undefined>(["AAPL"]);

      return (
        <WidgetVariableReferenceInputProvider sourceWidgets={sourceWidgets}>
          <QueryStringListField
            label="Symbols"
            value={value}
            onChange={setValue}
            placeholder="AAPL, MSFT"
            suggestions={[{ value: "MSFT" }]}
          />
          <div data-testid="value">{JSON.stringify(value ?? null)}</div>
        </WidgetVariableReferenceInputProvider>
      );
    }

    await act(async () => {
      root.render(<Harness />);
      await flushEffects();
    });

    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();

    const suggestionButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("MSFT"),
    );
    expect(suggestionButton).not.toBeUndefined();

    await act(async () => {
      suggestionButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushEffects();
      await flushEffects();
    });

    expect(textarea!.value).toBe("AAPL\nMSFT");
    expect(container.querySelector('[data-testid="value"]')?.textContent).toBe(
      '["AAPL","MSFT"]',
    );
  });

  it("removes values with normal text editing", async () => {
    function Harness() {
      const [value, setValue] = useState<string[] | undefined>(["AAPL", "MSFT"]);

      return (
        <WidgetVariableReferenceInputProvider sourceWidgets={sourceWidgets}>
          <QueryStringListField
            label="Symbols"
            value={value}
            onChange={setValue}
            placeholder="AAPL, MSFT"
          />
          <div data-testid="value">{JSON.stringify(value ?? null)}</div>
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
      setNativeTextareaValue(textarea!, "MSFT");
      textarea!.dispatchEvent(new Event("input", { bubbles: true }));
      await flushEffects();
    });

    expect(container.querySelector('[data-testid="value"]')?.textContent).toBe('["MSFT"]');
  });
});
