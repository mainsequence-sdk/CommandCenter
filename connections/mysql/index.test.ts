import { describe, expect, it } from "vitest";

import { SharedSqlConnectionQueryEditor } from "@/connections/sql/SharedSqlConnectionQueryEditor";
import { SharedSqlConnectionAuthoringSummary } from "@/connections/sql/sharedSqlAuthoring";

import postgreSqlConnection from "../postgresql";

import {
  MYSQL_DEFAULT_SQL_TABLE_QUERY,
  MYSQL_DEFAULT_TIME_SERIES_QUERY,
  mysqlConnection,
} from "./index";

describe("mysqlConnection", () => {
  it("registers MySQL as a shared SQL Command Center connection type", () => {
    expect(mysqlConnection).toMatchObject({
      id: "mysql.database",
      version: 1,
      title: "MySQL",
      source: "mysql",
      category: "Databases",
      accessMode: "proxy",
      capabilities: ["query", "resource", "health-check"],
      requiredPermissions: ["mysql:query"],
    });
  });

  it("reuses the shared SQL authoring surface instead of forking PostgreSQL UI", () => {
    expect(mysqlConnection.queryEditor).toBe(SharedSqlConnectionQueryEditor);
    expect(postgreSqlConnection.queryEditor).toBe(SharedSqlConnectionQueryEditor);
    expect(mysqlConnection.authoringContract?.SummaryComponent).toBe(
      SharedSqlConnectionAuthoringSummary,
    );
    expect(postgreSqlConnection.authoringContract?.SummaryComponent).toBe(
      SharedSqlConnectionAuthoringSummary,
    );
    expect(mysqlConnection.queryModels?.map((model) => model.id)).toEqual(
      postgreSqlConnection.queryModels?.map((model) => model.id),
    );
  });

  it("keeps only engine-specific schema differences from PostgreSQL", () => {
    const publicFields = mysqlConnection.publicConfigSchema.fields;
    const publicFieldIds = publicFields.map((field) => field.id);
    const secureFieldIds = mysqlConnection.secureConfigSchema?.fields.map((field) => field.id);
    const sslMode = publicFields.find((field) => field.id === "sslMode");
    const port = publicFields.find((field) => field.id === "port");
    const sqlTableModel = mysqlConnection.queryModels?.find((model) => model.id === "sql-table");
    const sqlTimeSeriesModel = mysqlConnection.queryModels?.find(
      (model) => model.id === "sql-time-series",
    );

    expect(publicFieldIds).toEqual([
      "host",
      "port",
      "database",
      "username",
      "sslMode",
      "defaultSchema",
      "defaultCharset",
      "connectionTimezone",
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
    expect(publicFields.every((field) => field.description)).toBe(true);
    expect(mysqlConnection.secureConfigSchema?.fields.every((field) => field.description)).toBe(
      true,
    );
    expect(port?.defaultValue).toBe(3306);
    expect(sslMode?.defaultValue).toBe("required");
    expect(sslMode?.options?.map((option) => option.value)).toEqual([
      "disabled",
      "preferred",
      "required",
      "verify-ca",
      "verify-identity",
    ]);
    expect(sqlTableModel?.defaultQuery).toEqual({
      kind: "sql-table",
      sql: MYSQL_DEFAULT_SQL_TABLE_QUERY,
    });
    expect(sqlTimeSeriesModel?.defaultQuery).toEqual({
      kind: "sql-time-series",
      sql: MYSQL_DEFAULT_TIME_SERIES_QUERY,
      timeField: "time",
    });
  });

  it("documents the backend adapter boundary and extra MySQL fields", () => {
    expect(mysqlConnection.usageGuidance).toContain("type_id: mysql.database");
    expect(mysqlConnection.usageGuidance).toContain("### defaultCharset");
    expect(mysqlConnection.usageGuidance).toContain("### connectionTimezone");
    expect(mysqlConnection.usageGuidance).toContain("browser code never opens database sockets");
  });
});
