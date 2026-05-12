import { describe, expect, it } from "vitest";

import type { AnyConnectionTypeDefinition, ConnectionQueryModel } from "@/connections/types";

import {
  CONNECTION_REGISTRY_VERSION,
  projectConnectionTypeForSync,
  validateConnectionTypeForSync,
} from "./connection-type-sync";

function createConnectionDefinition(
  input: Partial<AnyConnectionTypeDefinition> = {},
): AnyConnectionTypeDefinition {
  return {
    id: "test.streamable-connection",
    version: 1,
    title: "Streamable Test Connection",
    description: "Connection used for registry sync tests.",
    source: "test",
    category: "Tests",
    capabilities: ["query", "stream"],
    accessMode: "proxy",
    publicConfigSchema: {
      version: 1,
      fields: [],
    },
    queryModels: [
      {
        id: "test-stream-query",
        label: "Stream query",
        outputContracts: ["core.tabular_frame@v1"],
        defaultQuery: {
          kind: "test-stream-query",
          symbol: "BTCUSDT",
        },
        controls: ["symbol"],
        stream: {
          transport: "websocket",
          modes: ["snapshot", "delta"],
          defaultMode: "snapshot",
          supportsResume: true,
          heartbeatMs: 30_000,
          description: "Streams test market data.",
        },
      },
    ],
    requiredPermissions: [],
    ...input,
  };
}

describe("connection type sync metadata", () => {
  it("bumps the registry version for physical data-source metadata", () => {
    expect(CONNECTION_REGISTRY_VERSION).toBe("2026-05-11-physical-data-source-metadata");
  });

  it("projects ConnectionQueryModel.stream into the sync payload", () => {
    const payload = projectConnectionTypeForSync(createConnectionDefinition());

    expect(payload.queryModels[0]).toMatchObject({
      id: "test-stream-query",
      label: "Stream query",
      outputContracts: ["core.tabular_frame@v1"],
      defaultQuery: {
        kind: "test-stream-query",
        symbol: "BTCUSDT",
      },
      controls: ["symbol"],
      stream: {
        transport: "websocket",
        modes: ["snapshot", "delta"],
        defaultMode: "snapshot",
        supportsResume: true,
        heartbeatMs: 30_000,
        description: "Streams test market data.",
      },
    });
  });

  it("requires stream capability when any query model advertises stream metadata", () => {
    const issues = validateConnectionTypeForSync(
      createConnectionDefinition({
        capabilities: ["query"],
      }),
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        section: "queryModels.test-stream-query.stream",
        message:
          "connection capability stream is required when a query model advertises stream metadata.",
      }),
    );
  });

  it("rejects invalid stream metadata before building a manifest", () => {
    const invalidQueryModel = {
      id: "invalid-stream-query",
      label: "Invalid stream query",
      outputContracts: ["core.tabular_frame@v1"],
      stream: {
        transport: "eventsource",
        modes: ["replace"],
        defaultMode: "replace",
        supportsResume: "yes",
        heartbeatMs: 0,
        description: 42,
      },
    } as unknown as ConnectionQueryModel;
    const issues = validateConnectionTypeForSync(
      createConnectionDefinition({
        queryModels: [invalidQueryModel],
      }),
    );
    const messages = issues.map((issue) => issue.message);

    expect(messages).toEqual(
      expect.arrayContaining([
        "stream.transport must be websocket.",
        "stream.modes may only include snapshot or delta.",
        "stream.defaultMode must be snapshot or delta.",
        "stream.supportsResume must be a boolean when provided.",
        "stream.heartbeatMs must be a positive number when provided.",
        "stream.description must be a string when provided.",
      ]),
    );
  });

  it("projects physical data-source metadata into the sync payload", () => {
    const payload = projectConnectionTypeForSync(
      createConnectionDefinition({
        capabilities: [
          "query",
          "resource",
          "health-check",
          "sql-read",
          "sql-write",
          "physical-data-source",
          "timescale-extension",
        ],
        physicalDataSource: {
          eligible: true,
          dataSourceClassType: "timescale_db",
          requiresCapabilities: ["sql-write", "timescale-extension"],
          defaultRegistrationMode: "auto-when-write-capable",
          managedLifecycle: false,
        },
      }),
    );

    expect(payload.physicalDataSource).toEqual({
      eligible: true,
      dataSourceClassType: "timescale_db",
      requiresCapabilities: ["sql-write", "timescale-extension"],
      defaultRegistrationMode: "auto-when-write-capable",
      managedLifecycle: false,
    });
  });

  it("requires advertised capabilities for physical data-source metadata", () => {
    const issues = validateConnectionTypeForSync(
      createConnectionDefinition({
        capabilities: ["query", "sql-write"],
        physicalDataSource: {
          eligible: true,
          dataSourceClassType: "timescale_db",
          requiresCapabilities: ["sql-write", "timescale-extension"],
          defaultRegistrationMode: "auto-when-write-capable",
          managedLifecycle: false,
        },
      }),
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: "physicalDataSource",
          message:
            "connection capability physical-data-source is required when physicalDataSource metadata is provided.",
        }),
        expect.objectContaining({
          section: "physicalDataSource",
          message:
            "physicalDataSource.requiresCapabilities must be included in capabilities: timescale-extension.",
        }),
      ]),
    );
  });
});
