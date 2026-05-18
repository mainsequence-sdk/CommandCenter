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

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
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

    const input = container.querySelector("input");
    expect(input).not.toBeNull();

    await act(async () => {
      input!.focus();
      setNativeInputValue(input!, "$(table-1).activeRow.symbol");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
      await flushEffects();
    });

    await act(async () => {
      input!.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Enter",
        }),
      );
      await flushEffects();
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

    const input = container.querySelector("input");
    expect(input).not.toBeNull();

    await act(async () => {
      input!.focus();
      setNativeInputValue(input!, "$(table-1).activeRow.");
      input!.setSelectionRange(input!.value.length, input!.value.length);
      input!.dispatchEvent(new Event("input", { bubbles: true }));
      input!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
});
