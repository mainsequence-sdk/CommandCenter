/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { TabularMergeKeyMapping } from "@/widgets/shared/incremental-tabular-consumer";

import { TabularMergeMappingEditor } from "./TabularMergeMappingEditor";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
});

describe("TabularMergeMappingEditor", () => {
  it("emits an empty editable mapping when Add mapping is clicked", () => {
    let latestMappings: TabularMergeKeyMapping[] | undefined;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <TabularMergeMappingEditor
          title="Latest row mapping"
          description="Test description"
          editable
          emptyDescription="No mappings"
          help="Test help"
          idBase="merge-editor-test"
          liveFieldOptions={["symbol"]}
          mappings={[]}
          onChange={(mappings) => {
            latestMappings = mappings;
          }}
          seedFieldOptions={["symbol"]}
        />,
      );
    });

    const addButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Add mapping",
    );

    expect(addButton).toBeDefined();
    act(() => {
      addButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(latestMappings).toEqual([{ seedField: "", liveField: "" }]);
  });
});
