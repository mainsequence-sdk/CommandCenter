import type { ConnectionTypeDefinition } from "@/connections/types";
import mssqlLogoUrl from "@/connections/assets/mssql-logo.svg";
import {
  createSharedSqlConnectionDefinition,
  type SharedSqlConnectionQuery,
  type SharedSqlPublicConfig,
  type SharedSqlQueryCachePolicy,
} from "@/connections/sql/sharedSqlConnection";

export const MSSQL_CONNECTION_TYPE_ID = "mssql.database";
export const MSSQL_DEFAULT_SQL_TABLE_QUERY = `select top (100) table_catalog, table_schema, table_name
from information_schema.tables
where table_catalog not in ('master', 'model', 'msdb', 'tempdb')
order by table_catalog, table_schema, table_name`;
export const MSSQL_DEFAULT_TIME_SERIES_QUERY =
  "select [time], [value]\nfrom dbo.metrics\nwhere $__timeFilter([time])\norder by [time]";

export type MssqlQueryCachePolicy = SharedSqlQueryCachePolicy;
export interface MssqlPublicConfig extends Omit<SharedSqlPublicConfig, "sslMode"> {}
export interface MssqlSecureConfig {
  password?: string;
}
export type MssqlConnectionQuery = SharedSqlConnectionQuery;

const mssqlConnectionBase = createSharedSqlConnectionDefinition({
  id: MSSQL_CONNECTION_TYPE_ID,
  version: 1,
  title: "SQL Server",
  description:
    "Connects Command Center data sources to backend-managed live Microsoft SQL Server query execution.",
  source: "mssql",
  category: "Databases",
  iconUrl: mssqlLogoUrl,
  tags: ["sql", "database", "table", "mssql", "sql-server"],
  capabilities: ["query", "resource", "health-check"],
  accessMode: "proxy",
  requiredPermissions: ["mssql:query"],
  providerName: "SQL Server",
  defaultPort: 1433,
  defaultSchema: "dbo",
  defaultSqlTableQuery: MSSQL_DEFAULT_SQL_TABLE_QUERY,
  timeSeriesExampleSql: MSSQL_DEFAULT_TIME_SERIES_QUERY,
  schemaExample: "dbo",
  tableExample: "orders",
  configFieldHelp: {
    host: "SQL Server hostname or DNS name resolved by the Command Center backend. No default is provided.",
    port: "TCP port for the SQL Server endpoint. Defaults to 1433.",
    database:
      "Command Center database name sent as publicConfig.database. This is the authoritative SQL Server database selected by the backend adapter.",
    username:
      "SQL Server login sent as publicConfig.username. Use Command Center key username, not database_user.",
    defaultSchema:
      "Schema used by SQL Server metadata queries and unqualified authoring helpers. Defaults to dbo.",
  },
  secureFieldHelp: {
    password:
      "Write-only SQL Server password. The frontend sends it on create/update and only reads secureFields.password afterward.",
  },
  secureFieldIds: ["password"],
  publicFieldGuidanceOverrides: {
    host: {
      example: "sqlserver.example.com",
      constraints:
        "Required per connection instance; never hard-code an environment host as a default.",
    },
    database: {
      example: "analytics",
      meaning: "SQL Server database selected after the backend opens the server connection.",
      constraints:
        "Required per connection instance. Use Command Center key database, not database_name.",
    },
    username: {
      example: "readonly_user",
      meaning: "SQL Server login used for health checks, metadata reads, and SQL execution.",
      constraints:
        "Required per connection instance. Use Command Center key username, not database_user.",
    },
    defaultSchema: {
      defaultValue: "dbo",
      example: "dbo",
      meaning:
        "SQL Server schema used by metadata queries and unqualified SQL helpers when no schema is supplied.",
    },
  },
  providerApiWarning:
    "Do not add frontend TLS/auth fields for SQL Server unless the backend mssql.database adapter contract is expanded.",
});

export const mssqlConnection = mssqlConnectionBase as ConnectionTypeDefinition<
  MssqlPublicConfig,
  MssqlConnectionQuery
>;

export default mssqlConnection;
