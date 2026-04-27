import { describe, expect, it } from "vitest";

import { resolvePrometheusEditorMode } from "./PrometheusConnectionQueryEditor";

describe("resolvePrometheusEditorMode", () => {
  it("keeps code mode for saved custom queries when no persisted mode exists yet", () => {
    expect(
      resolvePrometheusEditorMode({
        supportsBuilder: true,
        defaultEditorMode: "builder",
        queryText: "sum(rate(http_requests_total[5m])) by (job)",
      }),
    ).toBe("code");
  });

  it("restores the persisted builder or code mode when available", () => {
    expect(
      resolvePrometheusEditorMode({
        supportsBuilder: true,
        persistedEditorMode: "builder",
        defaultEditorMode: "code",
        queryText: "up",
      }),
    ).toBe("builder");

    expect(
      resolvePrometheusEditorMode({
        supportsBuilder: true,
        persistedEditorMode: "code",
        defaultEditorMode: "builder",
        queryText: "",
      }),
    ).toBe("code");
  });

  it("forces code mode when the selected query model does not support the builder", () => {
    expect(
      resolvePrometheusEditorMode({
        supportsBuilder: false,
        persistedEditorMode: "builder",
        defaultEditorMode: "builder",
        queryText: "up",
      }),
    ).toBe("code");
  });
});
