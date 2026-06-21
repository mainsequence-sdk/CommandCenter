import type {
  ConnectionAccessMode,
  ConnectionCapability,
  ConnectionPhysicalDataSourceMetadata,
  ConnectionSchemaFieldOption,
  ConnectionTypeDefinition,
} from "@/connections/types";
import postgreSqlLogoUrl from "@/connections/assets/postgresql-logo.svg";
import {
  SharedSqlConnectionQueryEditor,
} from "@/connections/sql/SharedSqlConnectionQueryEditor";
import {
  buildSharedSqlUsageGuidance,
  createSharedSqlArtifacts,
  createSharedSqlConfigFieldHelp,
  createSharedSqlSecureFieldHelp,
  type SharedSqlConnectionQuery,
  type SharedSqlPublicConfig,
  type SharedSqlQueryCachePolicy,
  type SharedSqlSchemaQueryKind,
  type SharedSqlSecureConfig,
  type SharedSqlSqlQueryKind,
} from "@/connections/sql/sharedSqlConnection";
import { createSharedSqlConnectionAuthoringContract } from "@/connections/sql/sharedSqlAuthoring";

export const POSTGRESQL_CONNECTION_TYPE_ID = "postgresql.database";
export const POSTGRESQL_DEFAULT_SQL_TABLE_QUERY = `select table_schema, table_name
from information_schema.tables
where table_schema not in ('information_schema', 'pg_catalog')
order by table_schema, table_name
limit 100`;
export const POSTGRESQL_DEFAULT_TIME_SERIES_QUERY =
  "select time, value\nfrom public.metrics\nwhere $__timeFilter(time)\norder by time";

const POSTGRESQL_SSL_MODE_OPTIONS: ConnectionSchemaFieldOption[] = [
  { label: "Disable", value: "disable" },
  { label: "Prefer", value: "prefer" },
  { label: "Require", value: "require" },
  { label: "Verify CA", value: "verify-ca" },
  { label: "Verify full", value: "verify-full" },
];

export type PostgreSqlQueryCachePolicy = SharedSqlQueryCachePolicy;
export type PostgreSqlSqlQueryKind = SharedSqlSqlQueryKind;
export type PostgreSqlSchemaQueryKind = SharedSqlSchemaQueryKind;
export type PostgreSqlPublicConfig = SharedSqlPublicConfig;
export type PostgreSqlSecureConfig = SharedSqlSecureConfig;
export type PostgreSqlConnectionQuery = SharedSqlConnectionQuery;

export const postgreSqlConfigFieldHelp = {
  ...createSharedSqlConfigFieldHelp({
    defaultPort: 5432,
    defaultSchema: "public",
    providerName: "PostgreSQL-compatible",
  }),
  port: "TCP port for the PostgreSQL-compatible server. Defaults to 5432.",
  sslMode:
    "TLS mode used by the backend database driver. Use require for encrypted production connections.",
} as const;

export const postgreSqlSecureFieldHelp = {
  ...createSharedSqlSecureFieldHelp(),
  tlsCaCertificate: "Optional write-only PEM CA certificate used by verify-ca or verify-full TLS modes.",
} as const;

const postgreSqlArtifacts = createSharedSqlArtifacts({
  providerName: "PostgreSQL-compatible",
  typeId: POSTGRESQL_CONNECTION_TYPE_ID,
  defaultPort: 5432,
  defaultSchema: "public",
  sslModeDefaultValue: "require",
  sslModeOptions: POSTGRESQL_SSL_MODE_OPTIONS,
  defaultSqlTableQuery: POSTGRESQL_DEFAULT_SQL_TABLE_QUERY,
  timeSeriesExampleSql: POSTGRESQL_DEFAULT_TIME_SERIES_QUERY,
  schemaExample: "public",
  tableExample: "orders",
  configFieldHelp: postgreSqlConfigFieldHelp,
  secureFieldHelp: postgreSqlSecureFieldHelp,
  providerApiWarning: "Do not use this for provider APIs that are not PostgreSQL-compatible.",
});

export const postgreSqlPublicConfigSchema = postgreSqlArtifacts.publicConfigSchema;
export const postgreSqlSecureConfigSchema = postgreSqlArtifacts.secureConfigSchema;
export const postgreSqlConnectionQueryModels = postgreSqlArtifacts.queryModels;

export interface PostgreSqlCompatibleConnectionDefinitionOptions {
  id: string;
  version: number;
  title: string;
  description: string;
  source: string;
  category: string;
  iconUrl?: string;
  tags?: string[];
  capabilities: ConnectionCapability[];
  accessMode: ConnectionAccessMode;
  requiredPermissions: string[];
  providerName: string;
  physicalDataSource?: ConnectionPhysicalDataSourceMetadata;
}

export function buildPostgreSqlCompatibleUsageGuidance({
  providerName,
  typeId,
  physicalDataSource,
}: {
  providerName: string;
  typeId: string;
  physicalDataSource?: ConnectionPhysicalDataSourceMetadata;
}) {
  return buildSharedSqlUsageGuidance({
    defaultSqlTableQuery: POSTGRESQL_DEFAULT_SQL_TABLE_QUERY,
    physicalDataSource,
    providerApiWarning: "Do not use this for provider APIs that are not PostgreSQL-compatible.",
    providerName,
    publicFieldGuidance: postgreSqlArtifacts.publicFieldGuidance,
    schemaExample: "public",
    secureFieldGuidance: postgreSqlArtifacts.secureFieldGuidance,
    tableExample: "orders",
    timeSeriesExampleSql: POSTGRESQL_DEFAULT_TIME_SERIES_QUERY,
    typeId,
  });
}

export function createPostgreSqlCompatibleConnectionDefinition({
  accessMode,
  capabilities,
  category,
  description,
  iconUrl,
  id,
  physicalDataSource,
  providerName,
  requiredPermissions,
  source,
  tags,
  title,
  version,
}: PostgreSqlCompatibleConnectionDefinitionOptions): ConnectionTypeDefinition<
  PostgreSqlPublicConfig,
  PostgreSqlConnectionQuery
> {
  return {
    id,
    version,
    title,
    description,
    source,
    category,
    iconUrl,
    tags,
    capabilities,
    accessMode,
    publicConfigSchema: postgreSqlPublicConfigSchema,
    secureConfigSchema: postgreSqlSecureConfigSchema,
    queryModels: postgreSqlConnectionQueryModels,
    requiredPermissions,
    queryEditor: SharedSqlConnectionQueryEditor,
    authoringContract: createSharedSqlConnectionAuthoringContract({ providerName }),
    physicalDataSource,
    usageGuidance: buildPostgreSqlCompatibleUsageGuidance({
      providerName,
      typeId: id,
      physicalDataSource,
    }),
    examples: [
      {
        title: `${providerName} analytics database`,
        publicConfig: {
          host: "db.example.com",
          port: 5432,
          database: "my_database",
          username: "my_user",
          sslMode: "require",
          defaultSchema: "public",
          maxOpenConnections: 10,
          connectionMaxLifetimeMs: 1800000,
          statementTimeoutMs: 30000,
          rowLimit: 1000,
          queryCachePolicy: "safe",
          queryCacheTtlMs: 300000,
          metadataCacheTtlMs: 300000,
          dedupeInFlight: true,
        },
        query: {
          kind: "sql-table",
          sql: POSTGRESQL_DEFAULT_SQL_TABLE_QUERY,
        },
      },
      {
        title: `${providerName} schema columns`,
        query: {
          kind: "schema-columns",
          schema: "public",
          table: "orders",
        },
      },
    ],
  };
}

export const postgreSqlConnection = createPostgreSqlCompatibleConnectionDefinition({
  id: POSTGRESQL_CONNECTION_TYPE_ID,
  version: 4,
  title: "PostgreSQL",
  description:
    "Connects Command Center data sources to backend-managed live PostgreSQL query execution.",
  source: "postgresql",
  category: "Databases",
  iconUrl: postgreSqlLogoUrl,
  tags: ["sql", "database", "table", "postgresql"],
  capabilities: ["query", "resource", "health-check"],
  accessMode: "proxy",
  requiredPermissions: ["postgresql:query"],
  providerName: "PostgreSQL",
});

export default postgreSqlConnection;
