import type { ConnectionTypeDefinition } from "@/connections/types";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";
import mainSequenceLogoMarkUrl from "../../../../../config/branding/logo_mark.png";

import { metaTableConnectionAuthoringContract } from "./simpleTableAuthoring";
import { MetaTableConnectionConfigEditor } from "./SimpleTableConnectionConfigEditor";
import { MetaTableConnectionQueryEditor } from "./SimpleTableConnectionQueryEditor";

export const MAIN_SEQUENCE_META_TABLE_CONNECTION_TYPE_ID = "mainsequence.meta-table";
export const DEFAULT_MAIN_SEQUENCE_META_TABLE_CONNECTION_ID = "mainsequence-meta-table-default";
export const DEFAULT_MAIN_SEQUENCE_META_TABLE_QUERY_CACHE_TTL_MS = 5 * 60 * 1000;
export const DEFAULT_MAIN_SEQUENCE_META_TABLE_STATEMENT_TIMEOUT_MS = 30_000;
export const DEFAULT_MAIN_SEQUENCE_META_TABLE_ROW_LIMIT = 1_000;

export type MainSequenceMetaTableQueryCachePolicy = "disabled" | "safe";

export interface MainSequenceMetaTableConnectionPublicConfig {
  metaTableUid?: string;
  metaTableLabel?: string;
  metaTableStorageHash?: string;
  metaTableIdentifier?: string;
  defaultLimit?: number;
  statementTimeoutMs?: number;
  queryCachePolicy?: MainSequenceMetaTableQueryCachePolicy;
  queryCacheTtlMs?: number;
  dedupeInFlight?: boolean;
}

export type MainSequenceMetaTableConnectionQuery = {
  kind: "meta-table-compiled-sql";
  sql: string;
  maxRows?: number;
  parameters?: Record<string, string | number | boolean | null>;
};

export const mainSequenceMetaTableConnection: ConnectionTypeDefinition<
  MainSequenceMetaTableConnectionPublicConfig,
  MainSequenceMetaTableConnectionQuery
> = {
  id: MAIN_SEQUENCE_META_TABLE_CONNECTION_TYPE_ID,
  version: 1,
  title: "Main Sequence Meta Table",
  description:
    "Connects widgets and Explore flows to one Main Sequence Meta Table through backend-scoped compiled SQL execution.",
  source: "main_sequence",
  category: "Data",
  iconUrl: mainSequenceLogoMarkUrl,
  tags: ["main-sequence", "meta-table", "sql", "tabular"],
  capabilities: ["query", "resource", "health-check"],
  accessMode: "proxy",
  publicConfigSchema: {
    version: 1,
    sections: [
      {
        id: "meta-table",
        title: "Meta Table",
        description: "The concrete Main Sequence Meta Table this data source queries.",
      },
      {
        id: "query-policy",
        title: "Query policy",
        description:
          "Backend adapter controls for SQL execution limits, timeouts, caching, and request sharing.",
      },
    ],
    fields: [
      {
        id: "metaTableUid",
        sectionId: "meta-table",
        label: "Meta Table",
        type: "string",
        required: true,
        description:
          "The authoritative Meta Table uid for this connection instance. Queries use this configured table and should not override it.",
      },
      {
        id: "metaTableLabel",
        sectionId: "meta-table",
        label: "Meta Table label",
        type: "string",
        required: false,
        description:
          "Optional cached display label for the selected Meta Table. The picker maintains this for UI summaries.",
      },
      {
        id: "metaTableStorageHash",
        sectionId: "meta-table",
        label: "Storage hash",
        type: "string",
        required: false,
        description:
          "Optional cached storage hash for the selected Meta Table. Used only for display and debugging context.",
      },
      {
        id: "metaTableIdentifier",
        sectionId: "meta-table",
        label: "Identifier",
        type: "string",
        required: false,
        description:
          "Optional cached backend identifier string for the selected Meta Table. Used only for UI context.",
      },
      {
        id: "defaultLimit",
        sectionId: "query-policy",
        label: "Default row limit",
        type: "number",
        required: false,
        defaultValue: DEFAULT_MAIN_SEQUENCE_META_TABLE_ROW_LIMIT,
      },
      {
        id: "statementTimeoutMs",
        sectionId: "query-policy",
        label: "Statement timeout",
        type: "number",
        required: false,
        defaultValue: DEFAULT_MAIN_SEQUENCE_META_TABLE_STATEMENT_TIMEOUT_MS,
      },
      {
        id: "queryCachePolicy",
        sectionId: "query-policy",
        label: "Query result cache",
        description:
          "Controls completed-result caching for safe read-only Meta Table compiled SQL queries.",
        type: "select",
        required: false,
        defaultValue: "safe",
        options: [
          { label: "Safe read queries", value: "safe" },
          { label: "Disabled", value: "disabled" },
        ],
      },
      {
        id: "queryCacheTtlMs",
        sectionId: "query-policy",
        label: "Query cache TTL",
        description:
          "Default completed-result cache lifetime in milliseconds. Default is 5 minutes.",
        type: "number",
        required: false,
        defaultValue: DEFAULT_MAIN_SEQUENCE_META_TABLE_QUERY_CACHE_TTL_MS,
      },
      {
        id: "dedupeInFlight",
        sectionId: "query-policy",
        label: "Dedupe in-flight identical queries",
        description:
          "When enabled, the backend should share one running Meta Table compiled SQL request for identical concurrent cache misses.",
        type: "boolean",
        required: false,
        defaultValue: true,
      },
    ],
  },
  configEditor: MetaTableConnectionConfigEditor,
  queryEditor: MetaTableConnectionQueryEditor,
  authoringContract: metaTableConnectionAuthoringContract,
  queryModels: [
    {
      id: "meta-table-compiled-sql",
      label: "Meta Table compiled SQL",
      description:
        "Executes read-only compiled SQL against the configured Main Sequence Meta Table and returns a core.tabular_frame@v1 result.",
      outputContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
      defaultOutputContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      supportsVariables: true,
    },
  ],
  requiredPermissions: ["main_sequence_foundry:view"],
  usageGuidance:
    "Use this connection when a configured data source should expose one Main Sequence Meta Table through backend-scoped compiled SQL. Select the Meta Table in the connection config, validate column metadata, then use Explore to run read-only SQL with the {{meta_table}} placeholder. The backend adapter owns MetaTable UID resolution, compiled SQL validation, placeholder expansion, permission checks, caching, and response normalization.",
  examples: [
    {
      title: "Meta Table compiled SQL source",
      publicConfig: {
        metaTableUid: "00000000-0000-0000-0000-000000000123",
        metaTableLabel: "Example Meta Table",
        defaultLimit: DEFAULT_MAIN_SEQUENCE_META_TABLE_ROW_LIMIT,
        statementTimeoutMs: DEFAULT_MAIN_SEQUENCE_META_TABLE_STATEMENT_TIMEOUT_MS,
        queryCachePolicy: "safe",
        queryCacheTtlMs: DEFAULT_MAIN_SEQUENCE_META_TABLE_QUERY_CACHE_TTL_MS,
        dedupeInFlight: true,
      },
      query: {
        kind: "meta-table-compiled-sql",
        sql: "select *\nfrom {{meta_table}}\nlimit 100",
        maxRows: 100,
      },
    },
  ],
};
