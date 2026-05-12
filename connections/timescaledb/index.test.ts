import { describe, expect, it } from "vitest";

import {
  postgreSqlConnectionQueryModels,
  postgreSqlPublicConfigSchema,
  postgreSqlSecureConfigSchema,
} from "../postgresql";

import { timescaleDbConnection } from "./index";

describe("timescaleDbConnection", () => {
  it("registers TimescaleDB as a PostgreSQL-compatible Command Center connection type", () => {
    expect(timescaleDbConnection).toMatchObject({
      id: "timescaledb.database",
      version: 1,
      title: "TimescaleDB Database",
      source: "main_sequence",
      category: "Database",
      accessMode: "server-only",
      capabilities: [
        "query",
        "resource",
        "health-check",
        "sql-read",
        "sql-write",
        "physical-data-source",
        "timescale-extension",
      ],
      requiredPermissions: ["timescaledb:query"],
    });
  });

  it("reuses PostgreSQL-compatible schemas and query models", () => {
    expect(timescaleDbConnection.publicConfigSchema).toBe(postgreSqlPublicConfigSchema);
    expect(timescaleDbConnection.secureConfigSchema).toBe(postgreSqlSecureConfigSchema);
    expect(timescaleDbConnection.queryModels).toBe(postgreSqlConnectionQueryModels);
    expect(timescaleDbConnection.queryModels?.map((model) => model.id)).toEqual([
      "sql-table",
      "sql-time-series",
      "schema-tables",
      "schema-columns",
    ]);
  });

  it("uses Command Center public config names and write-only secure fields", () => {
    const publicFieldIds = timescaleDbConnection.publicConfigSchema.fields.map((field) => field.id);
    const secureFieldIds = timescaleDbConnection.secureConfigSchema?.fields.map((field) => field.id);

    expect(publicFieldIds).toEqual([
      "host",
      "port",
      "database",
      "username",
      "sslMode",
      "defaultSchema",
      "maxOpenConnections",
      "connectionMaxLifetimeMs",
      "statementTimeoutMs",
      "rowLimit",
      "queryCachePolicy",
      "queryCacheTtlMs",
      "metadataCacheTtlMs",
      "dedupeInFlight",
    ]);
    expect(publicFieldIds).not.toContain("database_name");
    expect(publicFieldIds).not.toContain("database_user");
    expect(secureFieldIds).toEqual([
      "password",
      "tlsCaCertificate",
      "tlsClientCertificate",
      "tlsClientKey",
    ]);
    expect(timescaleDbConnection.publicConfigSchema.fields.every((field) => field.description)).toBe(
      true,
    );
    expect(timescaleDbConnection.secureConfigSchema?.fields.every((field) => field.description)).toBe(
      true,
    );
  });

  it("declares Timescale physical data-source projection metadata", () => {
    expect(timescaleDbConnection.physicalDataSource).toEqual({
      eligible: true,
      dataSourceClassType: "timescale_db",
      requiresCapabilities: ["sql-write", "timescale-extension"],
      defaultRegistrationMode: "auto-when-write-capable",
      managedLifecycle: false,
    });
  });
});
