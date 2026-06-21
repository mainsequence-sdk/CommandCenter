import { describe, expect, it } from "vitest";

import { SharedSqlConnectionQueryEditor } from "@/connections/sql/SharedSqlConnectionQueryEditor";
import { SharedSqlConnectionAuthoringSummary } from "@/connections/sql/sharedSqlAuthoring";

import postgreSqlConnection from "../postgresql";

import {
  MSSQL_DEFAULT_SQL_TABLE_QUERY,
  MSSQL_DEFAULT_TIME_SERIES_QUERY,
  mssqlConnection,
} from "./index";

describe("mssqlConnection", () => {
  it("registers SQL Server as a shared SQL Command Center connection type", () => {
    expect(mssqlConnection).toMatchObject({
      id: "mssql.database",
      version: 1,
      title: "SQL Server",
      source: "mssql",
      category: "Databases",
      accessMode: "proxy",
      capabilities: ["query", "resource", "health-check"],
      requiredPermissions: ["mssql:query"],
    });
  });

  it("reuses the shared SQL authoring surface instead of forking SQL UI", () => {
    expect(mssqlConnection.queryEditor).toBe(SharedSqlConnectionQueryEditor);
    expect(postgreSqlConnection.queryEditor).toBe(SharedSqlConnectionQueryEditor);
    expect(mssqlConnection.authoringContract?.SummaryComponent).toBe(
      SharedSqlConnectionAuthoringSummary,
    );
    expect(postgreSqlConnection.authoringContract?.SummaryComponent).toBe(
      SharedSqlConnectionAuthoringSummary,
    );
    expect(mssqlConnection.queryModels?.map((model) => model.id)).toEqual(
      postgreSqlConnection.queryModels?.map((model) => model.id),
    );
  });

  it("matches the backend mssql.database config contract", () => {
    const publicFields = mssqlConnection.publicConfigSchema.fields;
    const publicFieldIds = publicFields.map((field) => field.id);
    const secureFieldIds = mssqlConnection.secureConfigSchema?.fields.map((field) => field.id);
    const port = publicFields.find((field) => field.id === "port");
    const defaultSchema = publicFields.find((field) => field.id === "defaultSchema");
    const sqlTableModel = mssqlConnection.queryModels?.find((model) => model.id === "sql-table");
    const sqlTimeSeriesModel = mssqlConnection.queryModels?.find(
      (model) => model.id === "sql-time-series",
    );

    expect(publicFieldIds).toEqual([
      "host",
      "port",
      "database",
      "username",
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
    expect(publicFieldIds).not.toContain("sslMode");
    expect(publicFieldIds).not.toContain("encrypt");
    expect(publicFieldIds).not.toContain("trustServerCertificate");
    expect(publicFieldIds).not.toContain("database_name");
    expect(publicFieldIds).not.toContain("database_user");
    expect(secureFieldIds).toEqual(["password"]);
    expect(publicFields.every((field) => field.description)).toBe(true);
    expect(mssqlConnection.secureConfigSchema?.fields.every((field) => field.description)).toBe(
      true,
    );
    expect(port?.defaultValue).toBe(1433);
    expect(defaultSchema?.defaultValue).toBe("dbo");
    expect(sqlTableModel?.defaultQuery).toEqual({
      kind: "sql-table",
      sql: MSSQL_DEFAULT_SQL_TABLE_QUERY,
    });
    expect(sqlTimeSeriesModel?.defaultQuery).toEqual({
      kind: "sql-time-series",
      sql: MSSQL_DEFAULT_TIME_SERIES_QUERY,
      timeField: "time",
    });
  });

  it("uses SQL Server dialect seeds instead of MySQL/PostgreSQL limit syntax", () => {
    expect(MSSQL_DEFAULT_SQL_TABLE_QUERY.toLowerCase()).toContain("select top (100)");
    expect(MSSQL_DEFAULT_SQL_TABLE_QUERY.toLowerCase()).not.toContain("limit 100");
    expect(MSSQL_DEFAULT_TIME_SERIES_QUERY).toContain("[time]");
    expect(MSSQL_DEFAULT_TIME_SERIES_QUERY).toContain("dbo.metrics");
  });

  it("documents the backend adapter boundary and exact type id", () => {
    expect(mssqlConnection.usageGuidance).toContain("type_id: mssql.database");
    expect(mssqlConnection.usageGuidance).toContain("### password");
    expect(mssqlConnection.usageGuidance).not.toContain("### sslMode");
    expect(mssqlConnection.usageGuidance).not.toContain("### tlsCaCertificate");
    expect(mssqlConnection.usageGuidance).toContain("browser code never opens database sockets");
  });
});
