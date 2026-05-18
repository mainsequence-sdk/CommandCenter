/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MockApiConnectionQueryEditor } from "./MockApiConnectionQueryEditor";
import {
  MOCK_API_QUERY_KIND,
  type MockApiConnectionQuery,
} from "./mock-api-contract";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

function flushEffects() {
  return new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), 0);
  });
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;

  valueSetter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("MockApiConnectionQueryEditor", () => {
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

  it("publishes valid JSON edits immediately so widget settings can become dirty before blur", async () => {
    const onChange = vi.fn();
    const query: MockApiConnectionQuery = {
      kind: MOCK_API_QUERY_KIND,
      responseBody: [{ symbol: "BTCUSDT" }],
    };

    await act(async () => {
      root.render(
        <MockApiConnectionQueryEditor
          value={query}
          onChange={onChange}
        />,
      );
      await flushEffects();
    });

    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();

    await act(async () => {
      textarea!.focus();
      setTextareaValue(textarea!, '[{"symbol":"ETHUSDT"}]');
      await flushEffects();
    });

    expect(onChange).toHaveBeenCalledWith({
      kind: MOCK_API_QUERY_KIND,
      responseBody: [{ symbol: "ETHUSDT" }],
    });
  });

  it("keeps invalid JSON local and shows the parse error", async () => {
    const onChange = vi.fn();

    await act(async () => {
      root.render(
        <MockApiConnectionQueryEditor
          value={{
            kind: MOCK_API_QUERY_KIND,
            responseBody: [{ symbol: "BTCUSDT" }],
          }}
          onChange={onChange}
        />,
      );
      await flushEffects();
    });

    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();

    await act(async () => {
      textarea!.focus();
      setTextareaValue(textarea!, '[{"symbol":]');
      await flushEffects();
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Unexpected");
  });
});
