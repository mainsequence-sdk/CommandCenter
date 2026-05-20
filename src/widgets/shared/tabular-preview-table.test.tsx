/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TabularPreviewTable } from "./tabular-preview-table";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

describe("TabularPreviewTable", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps projected column headers visible when the preview has no rows", () => {
    act(() => {
      root.render(
        <TabularPreviewTable
          columns={["symbol", "last"]}
          rows={[]}
          emptyMessage="No transformed rows are available."
        />,
      );
    });

    expect(container.querySelector("thead")?.textContent).toContain("symbol");
    expect(container.querySelector("thead")?.textContent).toContain("last");
    expect(container.textContent).toContain("No transformed rows are available.");
  });
});
