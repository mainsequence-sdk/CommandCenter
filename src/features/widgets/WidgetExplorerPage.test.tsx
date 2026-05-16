/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { defineWidget } from "@/widgets/types";

import { WidgetCatalogDemoPreview } from "./WidgetExplorerPage";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }

  host?.remove();
  root = null;
  host = null;
});

function renderPreview(widget: Parameters<typeof WidgetCatalogDemoPreview>[0]["widget"]) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);

  act(() => {
    root!.render(<WidgetCatalogDemoPreview widget={widget} />);
  });

  return host;
}

describe("WidgetCatalogDemoPreview", () => {
  it("renders widget mock fixtures in catalog demo mode", () => {
    const widget = defineWidget<Record<string, unknown>>({
      id: "test-catalog-preview",
      widgetVersion: "1.0.0",
      title: "Catalog Preview Widget",
      description: "Catalog preview test widget.",
      category: "Test",
      kind: "custom",
      source: "test",
      defaultSize: { w: 4, h: 3 },
      mockTitle: "Demo Catalog Preview",
      mockProps: {
        label: "Fixture label",
      },
      mockRuntimeState: {
        status: "ready",
        marker: "Fixture runtime",
      },
      component: ({ props, runtimeState }) => (
        <div>
          <span>{String(props.label)}</span>
          <span>{String(runtimeState?.marker)}</span>
        </div>
      ),
    });

    const container = renderPreview(widget);

    expect(container.textContent).toContain("Demo Preview");
    expect(container.textContent).toContain("Demo Catalog Preview");
    expect(container.textContent).toContain("Fixture label");
    expect(container.textContent).toContain("Fixture runtime");
  });
});
