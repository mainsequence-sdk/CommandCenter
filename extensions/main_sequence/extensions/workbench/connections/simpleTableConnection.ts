import type { ConnectionTypeDefinition } from "@/connections/types";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";
import mainSequenceLogoMarkUrl from "../../../../../config/branding/logo_mark.png";

import { SimpleTableConnectionConfigEditor } from "./SimpleTableConnectionConfigEditor";
import { SimpleTableConnectionExplore } from "./SimpleTableConnectionExplore";
import { SimpleTableConnectionQueryEditor } from "./SimpleTableConnectionQueryEditor";

export const MAIN_SEQUENCE_SIMPLE_TABLE_CONNECTION_TYPE_ID = "mainsequence.simple-table";
export const DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_CONNECTION_ID = "mainsequence-simple-table-default";
export const DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_QUERY_CACHE_TTL_MS = 5 * 60 * 1000;
export const DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_STATEMENT_TIMEOUT_MS = 30_000;
export const DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_ROW_LIMIT = 1_000;

export type MainSequenceSimpleTableQueryCachePolicy = "disabled" | "safe";

export interface MainSequenceSimpleTableConnectionPublicConfig {
  simpleTableId?: number;
  simpleTableLabel?: string;
  simpleTableStorageHash?: string;
  simpleTableIdentifier?: string;
  defaultLimit?: number;
  statementTimeoutMs?: number;
  queryCachePolicy?: MainSequenceSimpleTableQueryCachePolicy;
  queryCacheTtlMs?: number;
  dedupeInFlight?: boolean;
}

export type MainSequenceSimpleTableConnectionQuery = {
  kind: "simple-table-sql";
  sql: string;
  maxRows?: number;
  parameters?: Record<string, string | number | boolean | null>;
};

export const mainSequenceSimpleTableConnection: ConnectionTypeDefinition<
  MainSequenceSimpleTableConnectionPublicConfig,
  MainSequenceSimpleTableConnectionQuery
> = {
  id: MAIN_SEQUENCE_SIMPLE_TABLE_CONNECTION_TYPE_ID,
  version: 1,
  title: "Main Sequence Simple Table",
  description:
    "Connects widgets and Explore flows to one Main Sequence Simple Table through backend-scoped SQL execution.",
  source: "main_sequence",
  category: "Data",
  iconUrl: mainSequenceLogoMarkUrl,
  tags: ["main-sequence", "simple-table", "sql", "tabular"],
  capabilities: ["query", "resource", "health-check"],
  accessMode: "proxy",
  publicConfigSchema: {
    version: 1,
    sections: [
      {
        id: "simple-table",
        title: "Simple Table",
        description: "The concrete Main Sequence Simple Table this data source queries.",
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
        id: "simpleTableId",
        sectionId: "simple-table",
        label: "Simple Table",
        type: "number",
        required: true,
      },
      {
        id: "simpleTableLabel",
        sectionId: "simple-table",
        label: "Simple Table label",
        type: "string",
        required: false,
      },
      {
        id: "simpleTableStorageHash",
        sectionId: "simple-table",
        label: "Storage hash",
        type: "string",
        required: false,
      },
      {
        id: "simpleTableIdentifier",
        sectionId: "simple-table",
        label: "Identifier",
        type: "string",
        required: false,
      },
      {
        id: "defaultLimit",
        sectionId: "query-policy",
        label: "Default row limit",
        type: "number",
        required: false,
        defaultValue: DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_ROW_LIMIT,
      },
      {
        id: "statementTimeoutMs",
        sectionId: "query-policy",
        label: "Statement timeout",
        type: "number",
        required: false,
        defaultValue: DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_STATEMENT_TIMEOUT_MS,
      },
      {
        id: "queryCachePolicy",
        sectionId: "query-policy",
        label: "Query result cache",
        description:
          "Controls completed-result caching for safe read-only Simple Table SQL queries.",
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
        defaultValue: DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_QUERY_CACHE_TTL_MS,
      },
      {
        id: "dedupeInFlight",
        sectionId: "query-policy",
        label: "Dedupe in-flight identical queries",
        description:
          "When enabled, the backend should share one running Simple Table SQL request for identical concurrent cache misses.",
        type: "boolean",
        required: false,
        defaultValue: true,
      },
    ],
  },
  configEditor: SimpleTableConnectionConfigEditor,
  exploreComponent: SimpleTableConnectionExplore,
  queryEditor: SimpleTableConnectionQueryEditor,
  queryModels: [
    {
      id: "simple-table-sql",
      label: "Simple Table SQL",
      description:
        "Executes read-only SQL against the configured Main Sequence Simple Table and returns a core.tabular_frame@v1 result.",
      outputContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
      defaultOutputContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      supportsVariables: true,
    },
  ],
  requiredPermissions: ["main_sequence_foundry:view"],
  usageGuidance:
    "Use this connection when a configured data source should expose one Main Sequence Simple Table through backend-scoped SQL. Select the Simple Table in the connection config, validate column metadata, then use Explore to run read-only SQL with the {{simple_table}} placeholder.",
  examples: [
    {
      title: "Simple Table SQL source",
      publicConfig: {
        simpleTableId: 123,
        simpleTableLabel: "Example Simple Table",
        defaultLimit: DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_ROW_LIMIT,
        statementTimeoutMs: DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_STATEMENT_TIMEOUT_MS,
        queryCachePolicy: "safe",
        queryCacheTtlMs: DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_QUERY_CACHE_TTL_MS,
        dedupeInFlight: true,
      },
      query: {
        kind: "simple-table-sql",
        sql: "select *\nfrom {{simple_table}}\nlimit 100",
        maxRows: 100,
      },
    },
  ],
};
