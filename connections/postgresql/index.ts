import type {
  ConnectionAccessMode,
  ConnectionCapability,
  ConnectionConfigSchema,
  ConnectionPhysicalDataSourceMetadata,
  ConnectionQueryModel,
  ConnectionTypeDefinition,
} from "@/connections/types";
import postgreSqlLogoUrl from "@/connections/assets/postgresql-logo.svg";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";

import { PostgreSqlConnectionQueryEditor } from "./PostgreSqlConnectionQueryEditor";
import { createPostgreSqlConnectionAuthoringContract } from "./postgreSqlAuthoring";

export const POSTGRESQL_CONNECTION_TYPE_ID = "postgresql.database";
export const POSTGRESQL_DEFAULT_SQL_TABLE_QUERY = `select table_schema, table_name
from information_schema.tables
where table_schema not in ('information_schema', 'pg_catalog')
order by table_schema, table_name
limit 100`;

export type PostgreSqlQueryCachePolicy = "disabled" | "safe";
export type PostgreSqlSqlQueryKind =
  | "sql"
  | "sql-table"
  | "sql-time-series"
  | "sql-timeseries";
export type PostgreSqlSchemaQueryKind = "schema-tables" | "schema-columns";

export interface PostgreSqlPublicConfig {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  sslMode?: string;
  defaultSchema?: string;
  maxOpenConnections?: number;
  connectionMaxLifetimeMs?: number;
  statementTimeoutMs?: number;
  rowLimit?: number;
  queryCachePolicy?: PostgreSqlQueryCachePolicy;
  queryCacheTtlMs?: number;
  metadataCacheTtlMs?: number;
  dedupeInFlight?: boolean;
}

export interface PostgreSqlSecureConfig {
  password?: string;
  tlsCaCertificate?: string;
  tlsClientCertificate?: string;
  tlsClientKey?: string;
}

export type PostgreSqlConnectionQuery =
  | {
      kind: PostgreSqlSqlQueryKind;
      sql: string;
      maxRows?: number;
      parameters?: Record<string, unknown>;
      timeField?: string;
      valueField?: string;
      valueFields?: string[];
      seriesFields?: string[];
      unit?: string;
    }
  | {
      kind: "schema-tables";
      schema?: string;
    }
  | {
      kind: "schema-columns";
      schema?: string;
      table: string;
    };

type FieldGuidance = {
  id: string;
  label: string;
  type: string;
  required: "yes" | "no";
  defaultValue: string;
  example: string;
  usedBy: string;
  meaning: string;
  constraints: string;
  help: string;
};

export const postgreSqlConfigFieldHelp = {
  host: "Database hostname or DNS name resolved by the Command Center backend, for example db.example.com.",
  port: "TCP port for the PostgreSQL-compatible server. Defaults to 5432.",
  database: "Command Center database name sent as publicConfig.database. Do not use physical data-source field database_name here.",
  username: "Database user sent as publicConfig.username. Do not use physical data-source field database_user here.",
  sslMode: "TLS mode used by the backend database driver. Use require for encrypted production connections.",
  defaultSchema: "Schema used when a query or metadata lookup omits an explicit schema. Defaults to public.",
  maxOpenConnections: "Maximum backend pool size for this connection instance. Defaults to 10.",
  connectionMaxLifetimeMs: "Maximum backend pooled-connection lifetime in milliseconds before the pool recycles it. Defaults to 1800000.",
  statementTimeoutMs: "Per-statement timeout in milliseconds applied by the backend adapter. Defaults to 30000.",
  rowLimit: "Default maximum rows the backend adapter should return when a request does not provide a stricter limit. Defaults to 1000.",
  queryCachePolicy: "Result-cache policy for safe read queries. Use safe to cache eligible reads or disabled to bypass result caching by default.",
  queryCacheTtlMs: "Default result-cache lifetime in milliseconds for safe read queries. Default is 5 minutes. Requests may override this value.",
  metadataCacheTtlMs: "Default cache lifetime in milliseconds for schema/table/column metadata lookups.",
  dedupeInFlight: "When enabled, the backend should share one running query for identical requests on this data source.",
} as const;

export const postgreSqlSecureFieldHelp = {
  password: "Write-only database password. The frontend sends it on create/update and only reads secureFields.password afterward.",
  tlsCaCertificate: "Optional write-only PEM CA certificate used by verify-ca or verify-full TLS modes.",
  tlsClientCertificate: "Optional write-only PEM client certificate used for mutual TLS.",
  tlsClientKey: "Optional write-only PEM private key paired with the TLS client certificate.",
} as const;

const publicFieldGuidance: FieldGuidance[] = [
  {
    id: "host",
    label: "Host",
    type: "string",
    required: "yes",
    defaultValue: "none",
    example: "db.example.com",
    usedBy: "frontend form and backend adapter",
    meaning: "Network host for the PostgreSQL-compatible database.",
    constraints: "Must be reachable from the backend; do not include a scheme or port.",
    help: postgreSqlConfigFieldHelp.host,
  },
  {
    id: "port",
    label: "Port",
    type: "number",
    required: "yes",
    defaultValue: "5432",
    example: "5432",
    usedBy: "frontend form and backend adapter",
    meaning: "TCP port opened by the database service.",
    constraints: "Must be a valid positive port number.",
    help: postgreSqlConfigFieldHelp.port,
  },
  {
    id: "database",
    label: "Database",
    type: "string",
    required: "yes",
    defaultValue: "none",
    example: "my_database",
    usedBy: "frontend form and backend adapter",
    meaning: "Database selected after the backend opens the server connection.",
    constraints: "Use Command Center key database, not database_name.",
    help: postgreSqlConfigFieldHelp.database,
  },
  {
    id: "username",
    label: "Username",
    type: "string",
    required: "yes",
    defaultValue: "none",
    example: "my_user",
    usedBy: "frontend form and backend adapter",
    meaning: "Database role used for health checks, metadata reads, SQL execution, and write probes.",
    constraints: "Use Command Center key username, not database_user.",
    help: postgreSqlConfigFieldHelp.username,
  },
  {
    id: "sslMode",
    label: "SSL mode",
    type: "select",
    required: "yes",
    defaultValue: "require",
    example: "require",
    usedBy: "frontend form and backend adapter",
    meaning: "TLS verification mode for the backend database driver.",
    constraints: "Allowed values are disable, prefer, require, verify-ca, and verify-full.",
    help: postgreSqlConfigFieldHelp.sslMode,
  },
  {
    id: "defaultSchema",
    label: "Default schema",
    type: "string",
    required: "no",
    defaultValue: "public",
    example: "public",
    usedBy: "frontend form and backend adapter",
    meaning: "Schema used by metadata queries and unqualified SQL helpers when no schema is supplied.",
    constraints: "Must be a valid schema name for the configured database.",
    help: postgreSqlConfigFieldHelp.defaultSchema,
  },
  {
    id: "maxOpenConnections",
    label: "Maximum open connections",
    type: "number",
    required: "no",
    defaultValue: "10",
    example: "10",
    usedBy: "backend adapter",
    meaning: "Maximum number of pooled backend database connections for this instance.",
    constraints: "Must be positive and should respect database-side connection limits.",
    help: postgreSqlConfigFieldHelp.maxOpenConnections,
  },
  {
    id: "connectionMaxLifetimeMs",
    label: "Connection max lifetime",
    type: "number",
    required: "no",
    defaultValue: "1800000",
    example: "1800000",
    usedBy: "backend adapter",
    meaning: "Age after which backend pooled connections are recycled.",
    constraints: "Milliseconds; must be positive when provided.",
    help: postgreSqlConfigFieldHelp.connectionMaxLifetimeMs,
  },
  {
    id: "statementTimeoutMs",
    label: "Statement timeout",
    type: "number",
    required: "no",
    defaultValue: "30000",
    example: "30000",
    usedBy: "backend adapter",
    meaning: "Maximum runtime for SQL statements and metadata reads.",
    constraints: "Milliseconds; should be low enough to protect shared databases.",
    help: postgreSqlConfigFieldHelp.statementTimeoutMs,
  },
  {
    id: "rowLimit",
    label: "Default row limit",
    type: "number",
    required: "no",
    defaultValue: "1000",
    example: "1000",
    usedBy: "backend adapter",
    meaning: "Instance default returned-row cap when a query does not provide a stricter limit.",
    constraints: "Must be positive when provided.",
    help: postgreSqlConfigFieldHelp.rowLimit,
  },
  {
    id: "queryCachePolicy",
    label: "Query result cache",
    type: "select",
    required: "no",
    defaultValue: "safe",
    example: "safe",
    usedBy: "backend adapter",
    meaning: "Default cache eligibility for completed safe read queries.",
    constraints: "Allowed values are disabled and safe.",
    help: postgreSqlConfigFieldHelp.queryCachePolicy,
  },
  {
    id: "queryCacheTtlMs",
    label: "Query cache TTL",
    type: "number",
    required: "no",
    defaultValue: "300000",
    example: "300000",
    usedBy: "backend adapter",
    meaning: "Default lifetime for cached safe query responses.",
    constraints: "Milliseconds; request-level cacheTtlMs may override it.",
    help: postgreSqlConfigFieldHelp.queryCacheTtlMs,
  },
  {
    id: "metadataCacheTtlMs",
    label: "Metadata cache TTL",
    type: "number",
    required: "no",
    defaultValue: "300000",
    example: "300000",
    usedBy: "backend adapter",
    meaning: "Default lifetime for cached schema/table/column metadata.",
    constraints: "Milliseconds; must be non-negative when provided.",
    help: postgreSqlConfigFieldHelp.metadataCacheTtlMs,
  },
  {
    id: "dedupeInFlight",
    label: "Dedupe in-flight identical queries",
    type: "boolean",
    required: "no",
    defaultValue: "true",
    example: "true",
    usedBy: "backend adapter",
    meaning: "Whether identical running requests should share the same backend work.",
    constraints: "Boolean; cache keys must not include secrets.",
    help: postgreSqlConfigFieldHelp.dedupeInFlight,
  },
];

const secureFieldGuidance: FieldGuidance[] = [
  {
    id: "password",
    label: "Password",
    type: "secret",
    required: "no",
    defaultValue: "none",
    example: "secret",
    usedBy: "backend adapter",
    meaning: "Database password resolved from backend secure config.",
    constraints: "Write-only; never returned except secureFields.password = true.",
    help: postgreSqlSecureFieldHelp.password,
  },
  {
    id: "tlsCaCertificate",
    label: "TLS CA certificate",
    type: "secret",
    required: "no",
    defaultValue: "none",
    example: "-----BEGIN CERTIFICATE-----",
    usedBy: "backend adapter",
    meaning: "CA certificate used to verify the database server certificate.",
    constraints: "Write-only PEM text; do not log or include in cache keys.",
    help: postgreSqlSecureFieldHelp.tlsCaCertificate,
  },
  {
    id: "tlsClientCertificate",
    label: "TLS client certificate",
    type: "secret",
    required: "no",
    defaultValue: "none",
    example: "-----BEGIN CERTIFICATE-----",
    usedBy: "backend adapter",
    meaning: "Client certificate for mutual TLS authentication.",
    constraints: "Write-only PEM text; requires matching tlsClientKey.",
    help: postgreSqlSecureFieldHelp.tlsClientCertificate,
  },
  {
    id: "tlsClientKey",
    label: "TLS client key",
    type: "secret",
    required: "no",
    defaultValue: "none",
    example: "-----BEGIN PRIVATE KEY-----",
    usedBy: "backend adapter",
    meaning: "Private key for mutual TLS authentication.",
    constraints: "Write-only PEM text; never return to the frontend.",
    help: postgreSqlSecureFieldHelp.tlsClientKey,
  },
];

function formatFieldGuidance(fields: FieldGuidance[]) {
  return fields
    .map(
      (field) => `### ${field.id}

- Label: ${field.label}
- Type: ${field.type}
- Required: ${field.required}
- Default: ${field.defaultValue}
- Example: ${field.example}
- Used by: ${field.usedBy}
- Meaning: ${field.meaning}
- Constraints: ${field.constraints}
- UI help: ${field.help}`,
    )
    .join("\n\n");
}

export const postgreSqlPublicConfigSchema: ConnectionConfigSchema = {
  version: 1,
  sections: [
    {
      id: "database",
      title: "Database",
      description: "Connection target and default schema.",
    },
    {
      id: "pooling",
      title: "Pooling",
      description: "Backend adapter pool controls.",
    },
    {
      id: "query-policy",
      title: "Query policy",
      description:
        "Instance-level defaults for row limits, timeouts, cache behavior, and request de-duplication.",
    },
  ],
  fields: [
    {
      id: "host",
      sectionId: "database",
      label: "Host",
      description: postgreSqlConfigFieldHelp.host,
      type: "string",
      required: true,
    },
    {
      id: "port",
      sectionId: "database",
      label: "Port",
      description: postgreSqlConfigFieldHelp.port,
      type: "number",
      required: true,
      defaultValue: 5432,
    },
    {
      id: "database",
      sectionId: "database",
      label: "Database",
      description: postgreSqlConfigFieldHelp.database,
      type: "string",
      required: true,
    },
    {
      id: "username",
      sectionId: "database",
      label: "Username",
      description: postgreSqlConfigFieldHelp.username,
      type: "string",
      required: true,
    },
    {
      id: "sslMode",
      sectionId: "database",
      label: "SSL mode",
      description: postgreSqlConfigFieldHelp.sslMode,
      type: "select",
      required: true,
      defaultValue: "require",
      options: [
        { label: "Disable", value: "disable" },
        { label: "Prefer", value: "prefer" },
        { label: "Require", value: "require" },
        { label: "Verify CA", value: "verify-ca" },
        { label: "Verify full", value: "verify-full" },
      ],
    },
    {
      id: "defaultSchema",
      sectionId: "database",
      label: "Default schema",
      description: postgreSqlConfigFieldHelp.defaultSchema,
      type: "string",
      required: false,
      defaultValue: "public",
    },
    {
      id: "maxOpenConnections",
      sectionId: "pooling",
      label: "Maximum open connections",
      description: postgreSqlConfigFieldHelp.maxOpenConnections,
      type: "number",
      required: false,
      defaultValue: 10,
    },
    {
      id: "connectionMaxLifetimeMs",
      sectionId: "pooling",
      label: "Connection max lifetime",
      description: postgreSqlConfigFieldHelp.connectionMaxLifetimeMs,
      type: "number",
      required: false,
      defaultValue: 1800000,
    },
    {
      id: "statementTimeoutMs",
      sectionId: "query-policy",
      label: "Statement timeout",
      description: postgreSqlConfigFieldHelp.statementTimeoutMs,
      type: "number",
      required: false,
      defaultValue: 30000,
    },
    {
      id: "rowLimit",
      sectionId: "query-policy",
      label: "Default row limit",
      description: postgreSqlConfigFieldHelp.rowLimit,
      type: "number",
      required: false,
      defaultValue: 1000,
    },
    {
      id: "queryCachePolicy",
      sectionId: "query-policy",
      label: "Query result cache",
      description: postgreSqlConfigFieldHelp.queryCachePolicy,
      type: "select",
      required: false,
      defaultValue: "safe",
      options: [
        { label: "Disabled", value: "disabled" },
        { label: "Safe read queries", value: "safe" },
      ],
    },
    {
      id: "queryCacheTtlMs",
      sectionId: "query-policy",
      label: "Query cache TTL",
      description: postgreSqlConfigFieldHelp.queryCacheTtlMs,
      type: "number",
      required: false,
      defaultValue: 300000,
    },
    {
      id: "metadataCacheTtlMs",
      sectionId: "query-policy",
      label: "Metadata cache TTL",
      description: postgreSqlConfigFieldHelp.metadataCacheTtlMs,
      type: "number",
      required: false,
      defaultValue: 300000,
    },
    {
      id: "dedupeInFlight",
      sectionId: "query-policy",
      label: "Dedupe in-flight identical queries",
      description: postgreSqlConfigFieldHelp.dedupeInFlight,
      type: "boolean",
      required: false,
      defaultValue: true,
    },
  ],
};

export const postgreSqlSecureConfigSchema: ConnectionConfigSchema = {
  version: 1,
  fields: [
    {
      id: "password",
      label: "Password",
      description: postgreSqlSecureFieldHelp.password,
      type: "secret",
      required: false,
    },
    {
      id: "tlsCaCertificate",
      label: "TLS CA certificate",
      description: postgreSqlSecureFieldHelp.tlsCaCertificate,
      type: "secret",
      required: false,
    },
    {
      id: "tlsClientCertificate",
      label: "TLS client certificate",
      description: postgreSqlSecureFieldHelp.tlsClientCertificate,
      type: "secret",
      required: false,
    },
    {
      id: "tlsClientKey",
      label: "TLS client key",
      description: postgreSqlSecureFieldHelp.tlsClientKey,
      type: "secret",
      required: false,
    },
  ],
};

export const postgreSqlConnectionQueryModels: ConnectionQueryModel[] = [
  {
    id: "sql-table",
    label: "SQL table",
    description:
      "Executes user-authored PostgreSQL-compatible SQL through the backend adapter and returns core.tabular_frame@v1.",
    outputContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
    defaultQuery: {
      kind: "sql-table",
      sql: POSTGRESQL_DEFAULT_SQL_TABLE_QUERY,
    },
    supportsVariables: true,
  },
  {
    id: "sql-time-series",
    label: "SQL time series",
    description:
      "Executes PostgreSQL-compatible SQL with the top-level timeRange, expands time macros on the backend, and returns core.tabular_frame@v1.",
    outputContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
    defaultQuery: {
      kind: "sql-time-series",
      sql: "select time, value\nfrom public.metrics\nwhere $__timeFilter(time)\norder by time",
      timeField: "time",
    },
    timeRangeAware: true,
    supportsVariables: true,
  },
  {
    id: "schema-tables",
    label: "Schema tables",
    description:
      "Reads safe information_schema table metadata for the requested schema or the configured defaultSchema and returns core.tabular_frame@v1.",
    outputContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
    defaultQuery: {
      kind: "schema-tables",
      schema: "public",
    },
    supportsMaxRows: false,
  },
  {
    id: "schema-columns",
    label: "Schema columns",
    description:
      "Reads safe information_schema column metadata for the requested table and returns core.tabular_frame@v1.",
    outputContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
    defaultQuery: {
      kind: "schema-columns",
      schema: "public",
      table: "orders",
    },
    supportsMaxRows: false,
  },
];

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
  return `## purpose

Connects widgets, Explore flows, and backend registry workflows to a backend-owned ${providerName} database connection. Runtime access stays server-side; browser code never opens database sockets or receives secrets.

## whenToUse

- Use when Command Center needs SQL query, schema metadata, or physical data-source projection for a configured ${providerName} database.
- Use the SQL table path for generic tabular reads.
- Use the SQL time-series path when the request needs a top-level timeRange and backend SQL time macros.

## whenNotToUse

- Do not use this as a browser-side database client.
- Do not place physical data-source model fields such as database_name or database_user in publicConfig.
- Do not use this for provider APIs that are not PostgreSQL-compatible.

## configurationFields

${formatFieldGuidance(publicFieldGuidance)}

## secureFields

${formatFieldGuidance(secureFieldGuidance)}

## queryModels

### sql-table

- Payload: { "kind": "sql-table", "sql": "${POSTGRESQL_DEFAULT_SQL_TABLE_QUERY.replace(/\n/g, " ")}" }
- Returns: core.tabular_frame@v1
- Notes: backend applies authorization, statement timeout, row limits, cache policy, variables, and SQL execution. The default authoring seed lists visible tables through information_schema so first-run Explore previews work on more databases.

### sql-time-series

- Payload: { "kind": "sql-time-series", "sql": "select time, value from public.metrics where $__timeFilter(time) order by time", "timeField": "time" }
- Returns: core.tabular_frame@v1
- Notes: backend expands time macros using ConnectionQueryRequest.timeRange and can publish time-series hints in frame metadata.

### schema-tables

- Payload: { "kind": "schema-tables", "schema": "public" }
- Returns: core.tabular_frame@v1
- Notes: backend reads safe information_schema table metadata and uses defaultSchema when schema is omitted.

### schema-columns

- Payload: { "kind": "schema-columns", "schema": "public", "table": "orders" }
- Returns: core.tabular_frame@v1
- Notes: backend reads safe information_schema column metadata for the requested table.

## backendOwnership

- type_id: ${typeId}
- Backend owns connection pooling, TLS material, password resolution, SQL macro expansion, row limits, statement timeout, cache policy, cache keys, in-flight dedupe, permission checks, audit summaries, health checks, schema resources, physical-source write probes, and frame normalization.
- Cache keys must include connection id, type id/version, query kind, normalized query payload, effective time range, variables, row limit, and relevant public config. Cache keys must not include secret values.
- Unsafe operations are controlled by platform authorization plus database-side permissions; frontend validation is not a security boundary.
${physicalDataSource ? `
## physicalDataSource

- eligible: ${String(physicalDataSource.eligible)}
- dataSourceClassType: ${physicalDataSource.dataSourceClassType}
- requiresCapabilities: ${(physicalDataSource.requiresCapabilities ?? []).join(", ")}
- defaultRegistrationMode: ${physicalDataSource.defaultRegistrationMode ?? "none"}
- managedLifecycle: ${String(physicalDataSource.managedLifecycle ?? false)}
- Projection rule: backend may create or update the physical data source after create/update or a successful test only when the connection health check works, the write probe works, and any adapter-specific extension probe succeeds.
` : ""}`;
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
    queryEditor: PostgreSqlConnectionQueryEditor,
    authoringContract: createPostgreSqlConnectionAuthoringContract({ providerName }),
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
