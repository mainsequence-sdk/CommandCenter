import { describe, expect, it } from "vitest";

import type { AnyConnectionTypeDefinition } from "@/connections/types";

import { connectionRuntimeDefinitions, hydrateConnectionRuntime } from "./connection-runtime";

function createDefinition(
  input: Partial<AnyConnectionTypeDefinition> = {},
): AnyConnectionTypeDefinition {
  return {
    id: "test.stream-runtime",
    version: 1,
    title: "Stream Runtime",
    description: "Connection used for runtime hydration tests.",
    source: "test",
    category: "Tests",
    capabilities: ["query"],
    accessMode: "proxy",
    publicConfigSchema: {
      version: 1,
      fields: [],
    },
    queryModels: [
      {
        id: "runtime-query",
        label: "Runtime query",
        outputContracts: ["core.tabular_frame@v1"],
      },
    ],
    ...input,
  };
}

describe("hydrateConnectionRuntime", () => {
  it("loads the TimescaleDB custom connection definition", () => {
    expect(
      connectionRuntimeDefinitions.some(
        (definition) => definition.id === "timescaledb.database",
      ),
    ).toBe(true);
  });

  it("preserves stream metadata from local runtime query models", () => {
    const localDefinition = createDefinition({
      version: 2,
      capabilities: ["query", "stream"],
      queryModels: [
        {
          id: "runtime-query",
          label: "Runtime query",
          outputContracts: ["core.tabular_frame@v1"],
          stream: {
            transport: "websocket",
            modes: ["snapshot", "delta"],
            defaultMode: "delta",
            supportsResume: true,
            heartbeatMs: 15_000,
          },
        },
      ],
    });
    const backendDefinition = createDefinition({
      version: 1,
      queryModels: [
        {
          id: "runtime-query",
          label: "Backend query",
          outputContracts: ["core.tabular_frame@v1"],
        },
      ],
    });

    const hydrated = hydrateConnectionRuntime(backendDefinition, {
      runtimeDefinitions: [localDefinition],
    });

    expect(hydrated.queryModels?.[0].stream).toEqual({
      transport: "websocket",
      modes: ["snapshot", "delta"],
      defaultMode: "delta",
      supportsResume: true,
      heartbeatMs: 15_000,
    });
  });

  it("hydrates physical data-source metadata from a local runtime definition", () => {
    const localDefinition = createDefinition({
      id: "timescaledb.database",
      version: 1,
      physicalDataSource: {
        eligible: true,
        dataSourceClassType: "timescale_db",
        requiresCapabilities: ["sql-write", "timescale-extension"],
        defaultRegistrationMode: "auto-when-write-capable",
        managedLifecycle: false,
      },
    });
    const backendDefinition = createDefinition({
      id: "timescaledb.database",
      version: 1,
      physicalDataSource: undefined,
    });

    const hydrated = hydrateConnectionRuntime(backendDefinition, {
      runtimeDefinitions: [localDefinition],
    });

    expect(hydrated.physicalDataSource).toEqual({
      eligible: true,
      dataSourceClassType: "timescale_db",
      requiresCapabilities: ["sql-write", "timescale-extension"],
      defaultRegistrationMode: "auto-when-write-capable",
      managedLifecycle: false,
    });
  });
});
