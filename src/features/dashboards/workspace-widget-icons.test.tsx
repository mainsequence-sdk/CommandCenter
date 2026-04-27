import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { resolveWorkspaceWidgetIcon } from "./workspace-widget-icons";

describe("resolveWorkspaceWidgetIcon", () => {
  it("uses the selected connection type icon for configured connection-query widgets", () => {
    const Icon = resolveWorkspaceWidgetIcon({
      id: "connection-query",
      title: "Connection Query",
      props: {
        connectionRef: {
          id: 6,
          typeId: "prometheus.remote",
        },
      },
    });

    const markup = renderToStaticMarkup(
      createElement(Icon, { className: "h-4 w-4" }),
    );

    expect(markup).toContain("Prometheus logo");
    expect(markup).toContain("<img");
  });

  it("falls back to the generic widget icon when no connection type is configured", () => {
    const Icon = resolveWorkspaceWidgetIcon({
      id: "connection-query",
      title: "Connection Query",
      props: {},
    });

    const markup = renderToStaticMarkup(
      createElement(Icon, { className: "h-4 w-4" }),
    );

    expect(markup).toContain("<svg");
    expect(markup).not.toContain("Prometheus logo");
  });
});
