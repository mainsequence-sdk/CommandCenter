import type {
  ConnectionSchemaField,
  ConnectionSchemaFieldOption,
  ConnectionTypeDefinition,
} from "@/connections/types";
import mysqlLogoUrl from "@/connections/assets/mysql-logo.svg";
import {
  createSharedSqlConnectionDefinition,
  type SharedSqlConnectionQuery,
  type SharedSqlPublicConfig,
  type SharedSqlQueryCachePolicy,
  type SharedSqlSecureConfig,
} from "@/connections/sql/sharedSqlConnection";

export const MYSQL_CONNECTION_TYPE_ID = "mysql.database";
export const MYSQL_DEFAULT_SQL_TABLE_QUERY = `select table_schema, table_name
from information_schema.tables
where table_schema not in ('information_schema', 'mysql', 'performance_schema', 'sys')
order by table_schema, table_name
limit 100`;
export const MYSQL_DEFAULT_TIME_SERIES_QUERY =
  "select time, value\nfrom metrics\nwhere $__timeFilter(time)\norder by time";

const MYSQL_SSL_MODE_OPTIONS: ConnectionSchemaFieldOption[] = [
  { label: "Disabled", value: "disabled" },
  { label: "Preferred", value: "preferred" },
  { label: "Required", value: "required" },
  { label: "Verify CA", value: "verify-ca" },
  { label: "Verify identity", value: "verify-identity" },
];

const mysqlExtraPublicConfigFields: ConnectionSchemaField[] = [
  {
    id: "defaultCharset",
    sectionId: "database",
    label: "Default charset",
    description:
      "Optional MySQL character set requested by the backend driver. Defaults to utf8mb4 when omitted.",
    type: "string",
    required: false,
    defaultValue: "utf8mb4",
  },
  {
    id: "connectionTimezone",
    sectionId: "database",
    label: "Connection timezone",
    description:
      "Optional timezone used by the backend MySQL driver when decoding temporal values. Defaults to UTC when omitted.",
    type: "string",
    required: false,
    defaultValue: "UTC",
  },
];

export type MySqlQueryCachePolicy = SharedSqlQueryCachePolicy;
export interface MySqlPublicConfig extends SharedSqlPublicConfig {
  defaultCharset?: string;
  connectionTimezone?: string;
}
export type MySqlSecureConfig = SharedSqlSecureConfig;
export type MySqlConnectionQuery = SharedSqlConnectionQuery;

const mysqlConnectionBase = createSharedSqlConnectionDefinition({
  id: MYSQL_CONNECTION_TYPE_ID,
  version: 1,
  title: "MySQL",
  description:
    "Connects Command Center data sources to backend-managed live MySQL query execution.",
  source: "mysql",
  category: "Databases",
  iconUrl: mysqlLogoUrl,
  tags: ["sql", "database", "table", "mysql"],
  capabilities: ["query", "resource", "health-check"],
  accessMode: "proxy",
  requiredPermissions: ["mysql:query"],
  providerName: "MySQL",
  defaultPort: 3306,
  defaultSchema: "my_database",
  sslModeDefaultValue: "required",
  sslModeOptions: MYSQL_SSL_MODE_OPTIONS,
  defaultSqlTableQuery: MYSQL_DEFAULT_SQL_TABLE_QUERY,
  timeSeriesExampleSql: MYSQL_DEFAULT_TIME_SERIES_QUERY,
  schemaExample: "my_database",
  tableExample: "orders",
  configFieldHelp: {
    port: "TCP port for the MySQL server. Defaults to 3306.",
    database:
      "Command Center database/catalog name sent as publicConfig.database. This is the authoritative MySQL database selected by the backend adapter.",
    sslMode:
      "TLS mode used by the backend MySQL driver. Use required, verify-ca, or verify-identity for encrypted production connections.",
    defaultSchema:
      "Optional schema/catalog name used by shared SQL authoring UI and metadata lookups. For MySQL this usually matches the selected database.",
  },
  publicFieldGuidanceOverrides: {
    database: {
      meaning: "MySQL database/catalog selected after the backend opens the server connection.",
      constraints: "Use Command Center key database, not database_name.",
    },
    sslMode: {
      defaultValue: "required",
      example: "required",
      constraints:
        "Allowed values are disabled, preferred, required, verify-ca, and verify-identity.",
    },
    defaultSchema: {
      defaultValue: "my_database",
      example: "my_database",
      meaning:
        "Schema/catalog used by metadata queries and unqualified SQL helpers when no schema is supplied.",
    },
  },
  extraPublicConfigFields: mysqlExtraPublicConfigFields,
  extraPublicFieldGuidance: [
    {
      id: "defaultCharset",
      label: "Default charset",
      type: "string",
      required: "no",
      defaultValue: "utf8mb4",
      example: "utf8mb4",
      usedBy: "backend adapter",
      meaning: "Character set requested when the backend driver opens MySQL sessions.",
      constraints: "Must be a character set supported by the configured MySQL server.",
      help: "Optional MySQL character set requested by the backend driver. Defaults to utf8mb4 when omitted.",
    },
    {
      id: "connectionTimezone",
      label: "Connection timezone",
      type: "string",
      required: "no",
      defaultValue: "UTC",
      example: "UTC",
      usedBy: "backend adapter",
      meaning: "Timezone used by the backend driver when decoding MySQL temporal values.",
      constraints: "Use a backend-supported timezone token such as UTC.",
      help: "Optional timezone used by the backend MySQL driver when decoding temporal values. Defaults to UTC when omitted.",
    },
  ],
  extraExamplePublicConfig: {
    defaultCharset: "utf8mb4",
    connectionTimezone: "UTC",
  },
});

export const mysqlConnection = mysqlConnectionBase as ConnectionTypeDefinition<
  MySqlPublicConfig,
  MySqlConnectionQuery
>;

export default mysqlConnection;
