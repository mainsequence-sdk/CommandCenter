import timescaleLogoUrl from "@/connections/assets/timescale-logo.png";

import {
  createPostgreSqlCompatibleConnectionDefinition,
  type PostgreSqlConnectionQuery,
  type PostgreSqlPublicConfig,
} from "../postgresql";

export const TIMESCALEDB_CONNECTION_TYPE_ID = "timescaledb.database";

export const timescaleDbConnection = createPostgreSqlCompatibleConnectionDefinition({
  id: TIMESCALEDB_CONNECTION_TYPE_ID,
  version: 1,
  title: "TimescaleDB Database",
  description:
    "Connects Command Center to backend-managed TimescaleDB SQL execution and physical data-source projection.",
  source: "main_sequence",
  category: "Database",
  iconUrl: timescaleLogoUrl,
  tags: ["timescaledb", "timescale", "postgresql", "sql", "database", "time-series"],
  capabilities: [
    "query",
    "resource",
    "health-check",
    "sql-read",
    "sql-write",
    "physical-data-source",
    "timescale-extension",
  ],
  accessMode: "server-only",
  requiredPermissions: ["timescaledb:query"],
  providerName: "TimescaleDB",
  physicalDataSource: {
    eligible: true,
    dataSourceClassType: "timescale_db",
    requiresCapabilities: ["sql-write", "timescale-extension"],
    defaultRegistrationMode: "auto-when-write-capable",
    managedLifecycle: false,
  },
});

export type TimescaleDbPublicConfig = PostgreSqlPublicConfig;
export type TimescaleDbConnectionQuery = PostgreSqlConnectionQuery;

export default timescaleDbConnection;
