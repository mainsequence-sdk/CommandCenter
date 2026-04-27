import { describe, expect, it } from "vitest";

import type {
  AnyConnectionTypeDefinition,
  ConnectionInstance,
} from "@/connections/types";

import { resolveConnectionPickerInstances } from "./ConnectionPicker";

const prometheusType = {
  id: "prometheus.remote",
  version: 1,
  title: "Prometheus",
  description: "Prometheus",
  source: "prometheus",
  category: "Observability",
  capabilities: ["query"],
  accessMode: "proxy",
  publicConfigSchema: { version: 1, fields: [] },
  queryModels: [],
} satisfies AnyConnectionTypeDefinition;

function createInstance(input: {
  id: string | number;
  typeId: string;
  name: string;
  isDefault?: boolean;
  isSystem?: boolean;
}): ConnectionInstance {
  return {
    id: input.id,
    typeId: input.typeId,
    typeVersion: 1,
    name: input.name,
    publicConfig: {},
    secureFields: {},
    status: "ok",
    isDefault: input.isDefault,
    isSystem: input.isSystem,
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
  };
}

describe("resolveConnectionPickerInstances", () => {
  it("returns backend-managed instances only", () => {
    const instances = resolveConnectionPickerInstances({
      backendInstances: [
        createInstance({
          id: 42,
          typeId: "prometheus.remote",
          name: "Prometheus Prod",
        }),
      ],
      typesById: new Map([[prometheusType.id, prometheusType]]),
    });

    expect(instances.map((instance) => instance.id)).toEqual([42]);
  });

  it("sorts default backend instances ahead of others", () => {
    const instances = resolveConnectionPickerInstances({
      backendInstances: [
        createInstance({
          id: 42,
          typeId: "prometheus.remote",
          name: "Prometheus Secondary",
        }),
        createInstance({
          id: 7,
          typeId: "prometheus.remote",
          name: "Prometheus Default",
          isDefault: true,
        }),
      ],
      typesById: new Map([[prometheusType.id, prometheusType]]),
    });

    expect(instances.map((instance) => instance.id)).toEqual([7, 42]);
  });
});
