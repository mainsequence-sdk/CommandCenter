import { describe, expect, it } from "vitest";

import mssqlIcon from "@/connections/assets/mssql-logo.svg";

import { resolvePhysicalDataSourceIcon } from "./physicalDataSourceIcons";

describe("resolvePhysicalDataSourceIcon", () => {
  it.each(["mssql", "sql_server", "mssql_db", "sqlserver"])(
    "maps SQL Server physical source class type %s to the MSSQL icon",
    (classType) => {
      expect(resolvePhysicalDataSourceIcon({ classType })).toBe(mssqlIcon);
    },
  );

  it("ignores symbolic non-image source logo values", () => {
    expect(resolvePhysicalDataSourceIcon({ sourceLogo: "database" })).toBeNull();
  });
});
