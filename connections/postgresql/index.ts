import type { ConnectionTypeDefinition } from "@/connections/types";
import postgreSqlLogoUrl from "@/connections/assets/postgresql-logo.svg";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";

import { PostgreSqlConnectionExplore } from "./PostgreSqlConnectionExplore";
import { PostgreSqlConnectionQueryEditor } from "./PostgreSqlConnectionQueryEditor";

export const POSTGRESQL_CONNECTION_TYPE_ID = "postgresql.database";

export type PostgreSqlQueryCachePolicy = "disabled" | "safe";

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

export type PostgreSqlConnectionQuery =
  {
    kind: "sql";
    sql: string;
  };

export const postgreSqlConnection: ConnectionTypeDefinition<
  PostgreSqlPublicConfig,
  PostgreSqlConnectionQuery
> = {
  id: POSTGRESQL_CONNECTION_TYPE_ID,
  version: 3,
  title: "PostgreSQL",
  description:
    "Connects Command Center data sources to backend-managed live PostgreSQL query execution.",
  source: "postgresql",
  category: "Databases",
  iconUrl: postgreSqlLogoUrl,
  tags: ["sql", "database", "table"],
  capabilities: ["query", "resource", "health-check"],
  accessMode: "proxy",
  publicConfigSchema: {
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
        type: "string",
        required: true,
      },
      {
        id: "port",
        sectionId: "database",
        label: "Port",
        type: "number",
        required: true,
        defaultValue: 5432,
      },
      {
        id: "database",
        sectionId: "database",
        label: "Database",
        type: "string",
        required: true,
      },
      {
        id: "username",
        sectionId: "database",
        label: "Username",
        type: "string",
        required: true,
      },
      {
        id: "sslMode",
        sectionId: "database",
        label: "SSL mode",
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
        type: "string",
        required: false,
        defaultValue: "public",
      },
      {
        id: "maxOpenConnections",
        sectionId: "pooling",
        label: "Maximum open connections",
        type: "number",
        required: false,
        defaultValue: 10,
      },
      {
        id: "connectionMaxLifetimeMs",
        sectionId: "pooling",
        label: "Connection max lifetime",
        type: "number",
        required: false,
        defaultValue: 1800000,
      },
      {
        id: "statementTimeoutMs",
        sectionId: "query-policy",
        label: "Statement timeout",
        type: "number",
        required: false,
        defaultValue: 30000,
      },
      {
        id: "rowLimit",
        sectionId: "query-policy",
        label: "Default row limit",
        type: "number",
        required: false,
        defaultValue: 1000,
      },
      {
        id: "queryCachePolicy",
        sectionId: "query-policy",
        label: "Query result cache",
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
        description:
          "Default result-cache lifetime in milliseconds for safe read queries. Default is 5 minutes. Requests may override this value.",
        type: "number",
        required: false,
        defaultValue: 300000,
      },
      {
        id: "metadataCacheTtlMs",
        sectionId: "query-policy",
        label: "Metadata cache TTL",
        description:
          "Default cache lifetime in milliseconds for schema/table/column metadata lookups.",
        type: "number",
        required: false,
        defaultValue: 300000,
      },
      {
        id: "dedupeInFlight",
        sectionId: "query-policy",
        label: "Dedupe in-flight identical queries",
        description:
          "When enabled, the backend should share one running query for identical requests on this data source.",
        type: "boolean",
        required: false,
        defaultValue: true,
      },
    ],
  },
  secureConfigSchema: {
    version: 1,
    fields: [
      {
        id: "password",
        label: "Password",
        type: "secret",
        required: false,
      },
      {
        id: "tlsCaCertificate",
        label: "TLS CA certificate",
        type: "secret",
        required: false,
      },
      {
        id: "tlsClientCertificate",
        label: "TLS client certificate",
        type: "secret",
        required: false,
      },
      {
        id: "tlsClientKey",
        label: "TLS client key",
        type: "secret",
        required: false,
      },
    ],
  },
  queryModels: [
    {
      id: "sql",
      label: "SQL",
      description:
        "Backend adapter executes query.kind='sql' and returns one canonical tabular frame. When chart semantics are known, they should be published in frame metadata.",
      outputContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
      supportsMaxRows: false,
    },
  ],
  requiredPermissions: ["postgresql:query"],
  exploreComponent: PostgreSqlConnectionExplore,
  queryEditor: PostgreSqlConnectionQueryEditor,
  usageGuidance:
    "Use this connection type for backend-managed live PostgreSQL query access. Configure the database user, set data-source-level row limits, timeouts, cache defaults, and in-flight de-duplication, validate SQL in Connections > Explore, and return normalized frames to widgets through the shared connection runtime.",
  examples: [
    {
      title: "Application database",
      publicConfig: {
        host: "postgres.example.com",
        port: 5432,
        database: "analytics",
        username: "command_center_reader",
        sslMode: "require",
        defaultSchema: "public",
        rowLimit: 1000,
        statementTimeoutMs: 30000,
        queryCachePolicy: "safe",
        queryCacheTtlMs: 300000,
        metadataCacheTtlMs: 300000,
        dedupeInFlight: true,
      },
      query: {
        kind: "sql",
        sql: "select * from public.orders limit 100",
      },
    },
  ],
};

export default postgreSqlConnection;
