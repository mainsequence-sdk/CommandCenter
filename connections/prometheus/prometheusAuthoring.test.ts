import { describe, expect, it } from "vitest";

import type { ConnectionInstance } from "@/connections/types";

import { prometheusConnection } from "./index";
import { resolvePrometheusDraftDefaults } from "./prometheusAuthoring";

const baseConnectionInstance: ConnectionInstance = {
  id: 42,
  typeId: prometheusConnection.id,
  typeVersion: prometheusConnection.version,
  name: "Prometheus Default",
  publicConfig: {
    endpointMode: "prometheus-compatible",
    authType: "none",
    defaultExploreLookback: "6h",
    maxDataPoints: 2048,
    defaultEditor: "builder",
  },
  secureFields: {},
  status: "ok",
  createdAt: "2026-04-27T00:00:00.000Z",
  updatedAt: "2026-04-27T00:00:00.000Z",
};

describe("prometheus authoring defaults", () => {
  it("prefers the range query model and seeds maxDataPoints from the connection config", () => {
    const defaults = resolvePrometheusDraftDefaults({
      connectionInstance: baseConnectionInstance,
      connectionType: prometheusConnection,
      queryModels: prometheusConnection.queryModels ?? [],
    });

    expect(defaults.queryModelId).toBe("promql-range");
    expect(defaults.query).toMatchObject({
      kind: "promql-range",
      stepMs: 300000,
      maxDataPoints: 2048,
    });
    expect(typeof defaults.fixedStartMs).toBe("number");
    expect(typeof defaults.fixedEndMs).toBe("number");
    expect((defaults.fixedEndMs ?? 0) - (defaults.fixedStartMs ?? 0)).toBe(6 * 60 * 60 * 1000);
  });

  it("switches payload shape when the instant query model is selected", () => {
    const instantModel = (prometheusConnection.queryModels ?? []).find(
      (model) => model.id === "promql-instant",
    );

    const defaults = resolvePrometheusDraftDefaults({
      connectionInstance: baseConnectionInstance,
      connectionType: prometheusConnection,
      queryModels: prometheusConnection.queryModels ?? [],
      selectedQueryModel: instantModel,
    });

    expect(defaults.queryModelId).toBe("promql-instant");
    expect(defaults.query).toEqual({
      kind: "promql-instant",
      query: 'sum by (job) (rate(http_requests_total[$__rate_interval]))',
    });
  });
});
