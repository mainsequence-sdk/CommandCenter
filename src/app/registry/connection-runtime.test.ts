import { describe, expect, it } from "vitest";

import type { AnyConnectionTypeDefinition } from "@/connections/types";

import { hydrateConnectionRuntime } from "./connection-runtime";

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
});
