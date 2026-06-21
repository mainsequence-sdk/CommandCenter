import type {
  ConnectionAccessMode,
  ConnectionCapability,
  ConnectionConfigSchema,
  ConnectionPhysicalDataSourceMetadata,
  ConnectionQueryModel,
  ConnectionSchemaField,
  ConnectionSchemaFieldOption,
  ConnectionTypeDefinition,
} from "@/connections/types";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";

import { SharedSqlConnectionQueryEditor } from "./SharedSqlConnectionQueryEditor";
import { createSharedSqlConnectionAuthoringContract } from "./sharedSqlAuthoring";

export type SharedSqlQueryCachePolicy = "disabled" | "safe";
export type SharedSqlSqlQueryKind =
  | "sql"
  | "sql-table"
  | "sql-time-series"
  | "sql-timeseries";
export type SharedSqlSchemaQueryKind = "schema-tables" | "schema-columns";
export type SharedSqlQueryKind = SharedSqlSqlQueryKind | SharedSqlSchemaQueryKind;

export interface SharedSqlPublicConfig {
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
  queryCachePolicy?: SharedSqlQueryCachePolicy;
  queryCacheTtlMs?: number;
  metadataCacheTtlMs?: number;
  dedupeInFlight?: boolean;
}

export interface SharedSqlSecureConfig {
  password?: string;
  tlsCaCertificate?: string;
  tlsClientCertificate?: string;
  tlsClientKey?: string;
}

export type SharedSqlSecureFieldId = keyof SharedSqlSecureFieldHelp;

export type SharedSqlConnectionQuery =
  | {
      kind: SharedSqlSqlQueryKind;
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

export type SharedSqlFieldGuidance = {
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

export interface SharedSqlFieldHelp {
  host: string;
  port: string;
  database: string;
  username: string;
  sslMode: string;
  defaultSchema: string;
  maxOpenConnections: string;
  connectionMaxLifetimeMs: string;
  statementTimeoutMs: string;
  rowLimit: string;
  queryCachePolicy: string;
  queryCacheTtlMs: string;
  metadataCacheTtlMs: string;
  dedupeInFlight: string;
}

export interface SharedSqlSecureFieldHelp {
  password: string;
  tlsCaCertificate: string;
  tlsClientCertificate: string;
  tlsClientKey: string;
}

export interface SharedSqlArtifactsOptions {
  providerName: string;
  typeId: string;
  defaultPort: number;
  defaultSchema: string;
  sslModeDefaultValue?: string;
  sslModeOptions?: ConnectionSchemaFieldOption[];
  defaultSqlTableQuery: string;
  timeSeriesExampleSql: string;
  schemaExample: string;
  tableExample: string;
  configFieldHelp?: Partial<SharedSqlFieldHelp>;
  secureFieldHelp?: Partial<SharedSqlSecureFieldHelp>;
  secureFieldIds?: SharedSqlSecureFieldId[];
  publicFieldGuidanceOverrides?: Partial<Record<keyof SharedSqlFieldHelp, Partial<SharedSqlFieldGuidance>>>;
  extraPublicConfigFields?: ConnectionSchemaField[];
  extraPublicFieldGuidance?: SharedSqlFieldGuidance[];
  extraExamplePublicConfig?: Record<string, unknown>;
  physicalDataSource?: ConnectionPhysicalDataSourceMetadata;
  providerApiWarning?: string;
}

export interface SharedSqlArtifacts {
  publicConfigSchema: ConnectionConfigSchema;
  secureConfigSchema: ConnectionConfigSchema;
  queryModels: ConnectionQueryModel[];
  publicFieldGuidance: SharedSqlFieldGuidance[];
  secureFieldGuidance: SharedSqlFieldGuidance[];
  usageGuidance: string;
  examples: Array<{
    title: string;
    publicConfig?: Partial<SharedSqlPublicConfig>;
    query?: Partial<SharedSqlConnectionQuery>;
  }>;
}

export interface SharedSqlConnectionDefinitionOptions extends Omit<SharedSqlArtifactsOptions, "typeId"> {
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
}

export function createSharedSqlConfigFieldHelp({
  defaultPort,
  defaultSchema,
  providerName,
}: {
  defaultPort: number;
  defaultSchema: string;
  providerName: string;
}): SharedSqlFieldHelp {
  return {
    host: `Database hostname or DNS name resolved by the Command Center backend, for example db.example.com.`,
    port: `TCP port for the ${providerName} server. Defaults to ${defaultPort}.`,
    database:
      "Command Center database name sent as publicConfig.database. Do not use physical data-source field database_name here.",
    username:
      "Database user sent as publicConfig.username. Do not use physical data-source field database_user here.",
    sslMode:
      "TLS mode used by the backend database driver. Use an encrypted mode for production connections.",
    defaultSchema: `Schema used when a query or metadata lookup omits an explicit schema. Defaults to ${defaultSchema}.`,
    maxOpenConnections: "Maximum backend pool size for this connection instance. Defaults to 10.",
    connectionMaxLifetimeMs:
      "Maximum backend pooled-connection lifetime in milliseconds before the pool recycles it. Defaults to 1800000.",
    statementTimeoutMs:
      "Per-statement timeout in milliseconds applied by the backend adapter. Defaults to 30000.",
    rowLimit:
      "Default maximum rows the backend adapter should return when a request does not provide a stricter limit. Defaults to 1000.",
    queryCachePolicy:
      "Result-cache policy for safe read queries. Use safe to cache eligible reads or disabled to bypass result caching by default.",
    queryCacheTtlMs:
      "Default result-cache lifetime in milliseconds for safe read queries. Default is 5 minutes. Requests may override this value.",
    metadataCacheTtlMs:
      "Default cache lifetime in milliseconds for schema/table/column metadata lookups.",
    dedupeInFlight:
      "When enabled, the backend should share one running query for identical requests on this data source.",
  };
}

export function createSharedSqlSecureFieldHelp(): SharedSqlSecureFieldHelp {
  return {
    password:
      "Write-only database password. The frontend sends it on create/update and only reads secureFields.password afterward.",
    tlsCaCertificate:
      "Optional write-only PEM CA certificate used by TLS verification modes.",
    tlsClientCertificate: "Optional write-only PEM client certificate used for mutual TLS.",
    tlsClientKey: "Optional write-only PEM private key paired with the TLS client certificate.",
  };
}

function applyGuidanceOverrides(
  guidance: SharedSqlFieldGuidance[],
  overrides: SharedSqlArtifactsOptions["publicFieldGuidanceOverrides"],
) {
  if (!overrides) {
    return guidance;
  }

  return guidance.map((field) => ({
    ...field,
    ...(overrides[field.id as keyof SharedSqlFieldHelp] ?? {}),
  }));
}

function createSharedSqlPublicFieldGuidance({
  configFieldHelp,
  defaultPort,
  defaultSchema,
  providerName,
  publicFieldGuidanceOverrides,
  sslModeOptions,
}: Pick<
  SharedSqlArtifactsOptions,
  | "configFieldHelp"
  | "defaultPort"
  | "defaultSchema"
  | "providerName"
  | "publicFieldGuidanceOverrides"
  | "sslModeOptions"
>) {
  const help = {
    ...createSharedSqlConfigFieldHelp({ defaultPort, defaultSchema, providerName }),
    ...configFieldHelp,
  };
  const guidance: SharedSqlFieldGuidance[] = [
    {
      id: "host",
      label: "Host",
      type: "string",
      required: "yes",
      defaultValue: "none",
      example: "db.example.com",
      usedBy: "frontend form and backend adapter",
      meaning: `Network host for the ${providerName} database.`,
      constraints: "Must be reachable from the backend; do not include a scheme or port.",
      help: help.host,
    },
    {
      id: "port",
      label: "Port",
      type: "number",
      required: "yes",
      defaultValue: String(defaultPort),
      example: String(defaultPort),
      usedBy: "frontend form and backend adapter",
      meaning: "TCP port opened by the database service.",
      constraints: "Must be a valid positive port number.",
      help: help.port,
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
      help: help.database,
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
      help: help.username,
    },
    ...(sslModeOptions
      ? [
          {
            id: "sslMode",
            label: "SSL mode",
            type: "select",
            required: "yes",
            defaultValue: "engine default",
            example: "require",
            usedBy: "frontend form and backend adapter",
            meaning: "TLS verification mode for the backend database driver.",
            constraints: "Must be one of the engine-supported SSL modes.",
            help: help.sslMode,
          } satisfies SharedSqlFieldGuidance,
        ]
      : []),
    {
      id: "defaultSchema",
      label: "Default schema",
      type: "string",
      required: "no",
      defaultValue: defaultSchema,
      example: defaultSchema,
      usedBy: "frontend form and backend adapter",
      meaning: "Schema used by metadata queries and unqualified SQL helpers when no schema is supplied.",
      constraints: "Must be a valid schema name for the configured database.",
      help: help.defaultSchema,
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
      help: help.maxOpenConnections,
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
      help: help.connectionMaxLifetimeMs,
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
      help: help.statementTimeoutMs,
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
      help: help.rowLimit,
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
      help: help.queryCachePolicy,
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
      help: help.queryCacheTtlMs,
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
      help: help.metadataCacheTtlMs,
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
      help: help.dedupeInFlight,
    },
  ];

  return applyGuidanceOverrides(guidance, publicFieldGuidanceOverrides);
}

function createSharedSqlSecureFieldGuidance(
  secureFieldHelp?: Partial<SharedSqlSecureFieldHelp>,
  secureFieldIds: SharedSqlSecureFieldId[] = [
    "password",
    "tlsCaCertificate",
    "tlsClientCertificate",
    "tlsClientKey",
  ],
) {
  const help = {
    ...createSharedSqlSecureFieldHelp(),
    ...secureFieldHelp,
  };

  const guidance = [
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
      help: help.password,
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
      help: help.tlsCaCertificate,
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
      help: help.tlsClientCertificate,
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
      help: help.tlsClientKey,
    },
  ] satisfies SharedSqlFieldGuidance[];

  return guidance.filter((field) => secureFieldIds.includes(field.id as SharedSqlSecureFieldId));
}

export function formatSharedSqlFieldGuidance(fields: SharedSqlFieldGuidance[]) {
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

export function createSharedSqlPublicConfigSchema({
  configFieldHelp,
  defaultPort,
  defaultSchema,
  extraPublicConfigFields = [],
  providerName,
  sslModeDefaultValue,
  sslModeOptions,
}: Pick<
  SharedSqlArtifactsOptions,
  | "configFieldHelp"
  | "defaultPort"
  | "defaultSchema"
  | "extraPublicConfigFields"
  | "providerName"
  | "sslModeDefaultValue"
  | "sslModeOptions"
>): ConnectionConfigSchema {
  const help = {
    ...createSharedSqlConfigFieldHelp({ defaultPort, defaultSchema, providerName }),
    ...configFieldHelp,
  };
  const sslModeField = sslModeOptions
    ? [
        {
          id: "sslMode",
          sectionId: "database",
          label: "SSL mode",
          description: help.sslMode,
          type: "select",
          required: true,
          defaultValue: sslModeDefaultValue,
          options: sslModeOptions,
        } satisfies ConnectionSchemaField,
      ]
    : [];

  return {
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
        description: help.host,
        type: "string",
        required: true,
      },
      {
        id: "port",
        sectionId: "database",
        label: "Port",
        description: help.port,
        type: "number",
        required: true,
        defaultValue: defaultPort,
      },
      {
        id: "database",
        sectionId: "database",
        label: "Database",
        description: help.database,
        type: "string",
        required: true,
      },
      {
        id: "username",
        sectionId: "database",
        label: "Username",
        description: help.username,
        type: "string",
        required: true,
      },
      ...sslModeField,
      {
        id: "defaultSchema",
        sectionId: "database",
        label: "Default schema",
        description: help.defaultSchema,
        type: "string",
        required: false,
        defaultValue: defaultSchema,
      },
      ...extraPublicConfigFields,
      {
        id: "maxOpenConnections",
        sectionId: "pooling",
        label: "Maximum open connections",
        description: help.maxOpenConnections,
        type: "number",
        required: false,
        defaultValue: 10,
      },
      {
        id: "connectionMaxLifetimeMs",
        sectionId: "pooling",
        label: "Connection max lifetime",
        description: help.connectionMaxLifetimeMs,
        type: "number",
        required: false,
        defaultValue: 1800000,
      },
      {
        id: "statementTimeoutMs",
        sectionId: "query-policy",
        label: "Statement timeout",
        description: help.statementTimeoutMs,
        type: "number",
        required: false,
        defaultValue: 30000,
      },
      {
        id: "rowLimit",
        sectionId: "query-policy",
        label: "Default row limit",
        description: help.rowLimit,
        type: "number",
        required: false,
        defaultValue: 1000,
      },
      {
        id: "queryCachePolicy",
        sectionId: "query-policy",
        label: "Query result cache",
        description: help.queryCachePolicy,
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
        description: help.queryCacheTtlMs,
        type: "number",
        required: false,
        defaultValue: 300000,
      },
      {
        id: "metadataCacheTtlMs",
        sectionId: "query-policy",
        label: "Metadata cache TTL",
        description: help.metadataCacheTtlMs,
        type: "number",
        required: false,
        defaultValue: 300000,
      },
      {
        id: "dedupeInFlight",
        sectionId: "query-policy",
        label: "Dedupe in-flight identical queries",
        description: help.dedupeInFlight,
        type: "boolean",
        required: false,
        defaultValue: true,
      },
    ],
  };
}

export function createSharedSqlSecureConfigSchema(
  secureFieldHelp?: Partial<SharedSqlSecureFieldHelp>,
  secureFieldIds: SharedSqlSecureFieldId[] = [
    "password",
    "tlsCaCertificate",
    "tlsClientCertificate",
    "tlsClientKey",
  ],
): ConnectionConfigSchema {
  const help = {
    ...createSharedSqlSecureFieldHelp(),
    ...secureFieldHelp,
  };

  const fields = ([
    {
      id: "password",
      label: "Password",
      description: help.password,
      type: "secret",
      required: false,
    },
    {
      id: "tlsCaCertificate",
      label: "TLS CA certificate",
      description: help.tlsCaCertificate,
      type: "secret",
      required: false,
    },
    {
      id: "tlsClientCertificate",
      label: "TLS client certificate",
      description: help.tlsClientCertificate,
      type: "secret",
      required: false,
    },
    {
      id: "tlsClientKey",
      label: "TLS client key",
      description: help.tlsClientKey,
      type: "secret",
      required: false,
    },
  ] satisfies ConnectionSchemaField[]).filter((field) =>
    secureFieldIds.includes(field.id as SharedSqlSecureFieldId),
  );

  return {
    version: 1,
    fields,
  };
}

export function createSharedSqlConnectionQueryModels({
  defaultSchema,
  defaultSqlTableQuery,
  providerName,
  tableExample,
  timeSeriesExampleSql,
}: Pick<
  SharedSqlArtifactsOptions,
  "defaultSchema" | "defaultSqlTableQuery" | "providerName" | "tableExample" | "timeSeriesExampleSql"
>): ConnectionQueryModel[] {
  return [
    {
      id: "sql-table",
      label: "SQL table",
      description:
        `Executes user-authored ${providerName} SQL through the backend adapter and returns core.tabular_frame@v1.`,
      outputContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
      defaultQuery: {
        kind: "sql-table",
        sql: defaultSqlTableQuery,
      },
      supportsVariables: true,
    },
    {
      id: "sql-time-series",
      label: "SQL time series",
      description:
        `Executes ${providerName} SQL with the top-level timeRange, expands time macros on the backend, and returns core.tabular_frame@v1.`,
      outputContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
      defaultQuery: {
        kind: "sql-time-series",
        sql: timeSeriesExampleSql,
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
        schema: defaultSchema,
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
        schema: defaultSchema,
        table: tableExample,
      },
      supportsMaxRows: false,
    },
  ];
}

export function buildSharedSqlUsageGuidance({
  defaultSqlTableQuery,
  physicalDataSource,
  providerApiWarning,
  providerName,
  publicFieldGuidance,
  schemaExample,
  secureFieldGuidance,
  tableExample,
  timeSeriesExampleSql,
  typeId,
}: {
  defaultSqlTableQuery: string;
  physicalDataSource?: ConnectionPhysicalDataSourceMetadata;
  providerApiWarning?: string;
  providerName: string;
  publicFieldGuidance: SharedSqlFieldGuidance[];
  schemaExample: string;
  secureFieldGuidance: SharedSqlFieldGuidance[];
  tableExample: string;
  timeSeriesExampleSql: string;
  typeId: string;
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
${providerApiWarning ? `- ${providerApiWarning}` : "- Do not use this for provider APIs that are not SQL database connections."}

## configurationFields

${formatSharedSqlFieldGuidance(publicFieldGuidance)}

## secureFields

${formatSharedSqlFieldGuidance(secureFieldGuidance)}

## queryModels

### sql-table

- Payload: { "kind": "sql-table", "sql": "${defaultSqlTableQuery.replace(/\n/g, " ")}" }
- Returns: core.tabular_frame@v1
- Notes: backend applies authorization, statement timeout, row limits, cache policy, variables, and SQL execution. The default authoring seed lists visible tables through information_schema so first-run Explore previews work on more databases.

### sql-time-series

- Payload: { "kind": "sql-time-series", "sql": "${timeSeriesExampleSql.replace(/\n/g, " ")}", "timeField": "time" }
- Returns: core.tabular_frame@v1
- Notes: backend expands time macros using ConnectionQueryRequest.timeRange and can publish time-series hints in frame metadata.

### schema-tables

- Payload: { "kind": "schema-tables", "schema": "${schemaExample}" }
- Returns: core.tabular_frame@v1
- Notes: backend reads safe information_schema table metadata and uses defaultSchema when schema is omitted.

### schema-columns

- Payload: { "kind": "schema-columns", "schema": "${schemaExample}", "table": "${tableExample}" }
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

export function createSharedSqlArtifacts(
  options: SharedSqlArtifactsOptions,
): SharedSqlArtifacts {
  const publicFieldGuidance = [
    ...createSharedSqlPublicFieldGuidance(options),
    ...(options.extraPublicFieldGuidance ?? []),
  ];
  const secureFieldGuidance = createSharedSqlSecureFieldGuidance(
    options.secureFieldHelp,
    options.secureFieldIds,
  );
  const publicConfigSchema = createSharedSqlPublicConfigSchema(options);
  const secureConfigSchema = createSharedSqlSecureConfigSchema(
    options.secureFieldHelp,
    options.secureFieldIds,
  );
  const queryModels = createSharedSqlConnectionQueryModels(options);
  const usageGuidance = buildSharedSqlUsageGuidance({
    ...options,
    publicFieldGuidance,
    secureFieldGuidance,
  });
  const examples = [
    {
      title: `${options.providerName} analytics database`,
      publicConfig: {
        host: "db.example.com",
        port: options.defaultPort,
        database: "my_database",
        username: "my_user",
        ...(options.sslModeDefaultValue ? { sslMode: options.sslModeDefaultValue } : {}),
        defaultSchema: options.defaultSchema,
        maxOpenConnections: 10,
        connectionMaxLifetimeMs: 1800000,
        statementTimeoutMs: 30000,
        rowLimit: 1000,
        queryCachePolicy: "safe",
        queryCacheTtlMs: 300000,
        metadataCacheTtlMs: 300000,
        dedupeInFlight: true,
        ...(options.extraExamplePublicConfig ?? {}),
      },
      query: {
        kind: "sql-table",
        sql: options.defaultSqlTableQuery,
      },
    },
    {
      title: `${options.providerName} schema columns`,
      query: {
        kind: "schema-columns",
        schema: options.schemaExample,
        table: options.tableExample,
      },
    },
  ] satisfies SharedSqlArtifacts["examples"];

  return {
    publicConfigSchema,
    secureConfigSchema,
    queryModels,
    publicFieldGuidance,
    secureFieldGuidance,
    usageGuidance,
    examples,
  };
}

export function createSharedSqlConnectionDefinition({
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
  ...artifactOptions
}: SharedSqlConnectionDefinitionOptions): ConnectionTypeDefinition<
  SharedSqlPublicConfig,
  SharedSqlConnectionQuery
> {
  const artifacts = createSharedSqlArtifacts({
    ...artifactOptions,
    physicalDataSource,
    providerName,
    typeId: id,
  });

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
    publicConfigSchema: artifacts.publicConfigSchema,
    secureConfigSchema: artifacts.secureConfigSchema,
    queryModels: artifacts.queryModels,
    requiredPermissions,
    queryEditor: SharedSqlConnectionQueryEditor,
    authoringContract: createSharedSqlConnectionAuthoringContract({ providerName }),
    physicalDataSource,
    usageGuidance: artifacts.usageGuidance,
    examples: artifacts.examples,
  };
}
