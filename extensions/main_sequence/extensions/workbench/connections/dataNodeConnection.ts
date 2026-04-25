import { fetchConnectionResource, getDefaultConnectionRefForType, queryConnection } from "@/connections/api";
import type {
  ConnectionQueryResponse,
  ConnectionRef,
  ConnectionTypeDefinition,
} from "@/connections/types";
import type { DashboardRequestTraceMeta } from "@/dashboards/dashboard-request-trace";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";
import {
  type DataNodeDetail,
  type DataNodeLastObservation,
  type DataNodeRemoteDataRequest,
  type DataNodeRemoteDataRow,
  fetchDataNodeDataBetweenDatesFromRemote,
  fetchDataNodeDetail,
  fetchDataNodeLastObservation,
} from "../../../common/api";
import mainSequenceLogoMarkUrl from "../../../../../config/branding/logo_mark.png";

import { DataNodeConnectionConfigEditor } from "./DataNodeConnectionConfigEditor";
import { DataNodeConnectionExplore } from "./DataNodeConnectionExplore";
import { DataNodeConnectionQueryEditor } from "./DataNodeConnectionQueryEditor";

export const MAIN_SEQUENCE_DATA_NODE_CONNECTION_TYPE_ID = "mainsequence.data-node";
export const DEFAULT_MAIN_SEQUENCE_DATA_NODE_CONNECTION_UID = "mainsequence-data-node-default";
export const DEFAULT_MAIN_SEQUENCE_DATA_NODE_QUERY_CACHE_TTL_MS = 15 * 60 * 1000;
export const DEFAULT_MAIN_SEQUENCE_DATA_NODE_ROW_LIMIT = 1_000;

export const DEFAULT_MAIN_SEQUENCE_DATA_NODE_CONNECTION_REF: ConnectionRef = {
  uid: DEFAULT_MAIN_SEQUENCE_DATA_NODE_CONNECTION_UID,
  typeId: MAIN_SEQUENCE_DATA_NODE_CONNECTION_TYPE_ID,
};

export type MainSequenceDataNodeQueryCachePolicy = "disabled" | "read";
export type MainSequenceDataNodeRowsBetweenDatesQuery = Partial<
  Pick<
    DataNodeRemoteDataRequest,
    | "columns"
    | "unique_identifier_list"
    | "unique_identifier_range_map"
    | "great_or_equal"
    | "less_or_equal"
    | "limit"
  >
> & {
  kind: "data-node-rows-between-dates";
  dataNodeId?: number;
};

export type MainSequenceDataNodeConnectionQuery =
  | MainSequenceDataNodeRowsBetweenDatesQuery
  | {
      kind: "data-node-last-observation";
      dataNodeId?: number;
    };

export interface MainSequenceDataNodeConnectionPublicConfig {
  dataNodeId?: number;
  dataNodeLabel?: string;
  dataNodeStorageHash?: string;
  defaultLimit?: number;
  queryCachePolicy?: MainSequenceDataNodeQueryCachePolicy;
  queryCacheTtlMs?: number;
  dedupeInFlight?: boolean;
}

function normalizePositiveInteger(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
}

function resolveDataNodeConnectionRef(connectionRef?: ConnectionRef) {
  return (
    connectionRef ??
    getDefaultConnectionRefForType(MAIN_SEQUENCE_DATA_NODE_CONNECTION_TYPE_ID) ??
    DEFAULT_MAIN_SEQUENCE_DATA_NODE_CONNECTION_REF
  );
}

function isDefaultDataNodeConnection(connectionRef?: ConnectionRef) {
  const resolvedRef = resolveDataNodeConnectionRef(connectionRef);

  return (
    resolvedRef.typeId === MAIN_SEQUENCE_DATA_NODE_CONNECTION_TYPE_ID &&
    resolvedRef.uid === DEFAULT_MAIN_SEQUENCE_DATA_NODE_CONNECTION_UID
  );
}

function frameToRows(response: ConnectionQueryResponse): DataNodeRemoteDataRow[] {
  const frame = response.frames[0];

  if (!frame) {
    return [];
  }

  const rowCount = Math.max(0, ...frame.fields.map((field) => field.values.length));

  return Array.from({ length: rowCount }, (_entry, index) =>
    Object.fromEntries(frame.fields.map((field) => [field.name, field.values[index] ?? null])),
  );
}

export function buildMainSequenceDataNodeDetailQueryKey(
  dataNodeId?: number,
  connectionRef?: ConnectionRef,
) {
  const resolvedRef = resolveDataNodeConnectionRef(connectionRef);

  return [
    "main_sequence",
    "connections",
    MAIN_SEQUENCE_DATA_NODE_CONNECTION_TYPE_ID,
    resolvedRef.uid,
    "data-node-detail",
    dataNodeId ?? 0,
  ] as const;
}

export function buildMainSequenceDataNodeLastObservationQueryKey(
  dataNodeId?: number,
  connectionRef?: ConnectionRef,
) {
  const resolvedRef = resolveDataNodeConnectionRef(connectionRef);

  return [
    "main_sequence",
    "connections",
    MAIN_SEQUENCE_DATA_NODE_CONNECTION_TYPE_ID,
    resolvedRef.uid,
    "data-node-last-observation",
    dataNodeId ?? 0,
  ] as const;
}

export async function queryMainSequenceDataNodeDetail(
  dataNodeId?: number,
  connectionRef?: ConnectionRef,
  traceMeta?: DashboardRequestTraceMeta,
) {
  const resolvedDataNodeId = normalizePositiveInteger(dataNodeId);

  if (!resolvedDataNodeId) {
    throw new Error("Select a Data Node before loading detail.");
  }

  if (isDefaultDataNodeConnection(connectionRef)) {
    return fetchDataNodeDetail(resolvedDataNodeId, traceMeta);
  }

  const resolvedRef = resolveDataNodeConnectionRef(connectionRef);

  return fetchConnectionResource<DataNodeDetail>({
    connectionUid: resolvedRef.uid,
    resource: "data-node-detail",
    params: { dataNodeId: resolvedDataNodeId },
  });
}

export async function queryMainSequenceDataNodeRowsBetweenDates(
  dataNodeId: number | undefined,
  input: DataNodeRemoteDataRequest,
  connectionRef?: ConnectionRef,
  traceMeta?: DashboardRequestTraceMeta,
) {
  const resolvedDataNodeId = normalizePositiveInteger(dataNodeId);

  if (!resolvedDataNodeId) {
    throw new Error("Select a Data Node before loading rows.");
  }

  if (isDefaultDataNodeConnection(connectionRef)) {
    return fetchDataNodeDataBetweenDatesFromRemote(resolvedDataNodeId, input, traceMeta);
  }

  const resolvedRef = resolveDataNodeConnectionRef(connectionRef);
  const response = await queryConnection<MainSequenceDataNodeConnectionQuery>({
    connectionUid: resolvedRef.uid,
    query: {
      ...input,
      kind: "data-node-rows-between-dates",
      dataNodeId: resolvedDataNodeId,
    },
    requestedOutputContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    maxRows: input.limit,
  });

  return frameToRows(response);
}

export async function queryMainSequenceDataNodeLastObservation(
  dataNodeId?: number,
  connectionRef?: ConnectionRef,
) {
  const resolvedDataNodeId = normalizePositiveInteger(dataNodeId);

  if (!resolvedDataNodeId) {
    throw new Error("Select a Data Node before loading the latest observation.");
  }

  if (isDefaultDataNodeConnection(connectionRef)) {
    return fetchDataNodeLastObservation(resolvedDataNodeId);
  }

  const resolvedRef = resolveDataNodeConnectionRef(connectionRef);
  const response = await queryConnection<MainSequenceDataNodeConnectionQuery>({
    connectionUid: resolvedRef.uid,
    query: {
      kind: "data-node-last-observation",
      dataNodeId: resolvedDataNodeId,
    },
    requestedOutputContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  });

  return (frameToRows(response)[0] ?? null) satisfies DataNodeLastObservation;
}

export const mainSequenceDataNodeConnection: ConnectionTypeDefinition<
  MainSequenceDataNodeConnectionPublicConfig,
  MainSequenceDataNodeConnectionQuery
> = {
  id: MAIN_SEQUENCE_DATA_NODE_CONNECTION_TYPE_ID,
  version: 1,
  title: "Main Sequence Data Node",
  description:
    "Connects query widgets and Explore flows to one Main Sequence Data Node through backend-owned connection execution.",
  source: "main_sequence",
  category: "Data",
  iconUrl: mainSequenceLogoMarkUrl,
  tags: ["main-sequence", "data-node", "dynamic-table", "tabular", "time-series"],
  capabilities: ["query", "resource", "health-check"],
  accessMode: "proxy",
  publicConfigSchema: {
    version: 1,
    sections: [
      {
        id: "data-node",
        title: "Data Node",
        description: "The concrete Main Sequence Data Node this data source queries.",
      },
      {
        id: "query-policy",
        title: "Query policy",
        description:
          "Backend adapter controls for row limits, caching, and identical request sharing.",
      },
    ],
    fields: [
      {
        id: "dataNodeId",
        sectionId: "data-node",
        label: "Data Node",
        type: "number",
        required: true,
      },
      {
        id: "dataNodeLabel",
        sectionId: "data-node",
        label: "Data Node label",
        type: "string",
        required: false,
      },
      {
        id: "dataNodeStorageHash",
        sectionId: "data-node",
        label: "Storage hash",
        type: "string",
        required: false,
      },
      {
        id: "defaultLimit",
        sectionId: "query-policy",
        label: "Default row limit",
        type: "number",
        required: false,
        defaultValue: DEFAULT_MAIN_SEQUENCE_DATA_NODE_ROW_LIMIT,
      },
      {
        id: "queryCachePolicy",
        sectionId: "query-policy",
        label: "Query result cache",
        description: "Controls completed-result caching for Data Node read queries.",
        type: "select",
        required: false,
        defaultValue: "read",
        options: [
          { label: "Read queries", value: "read" },
          { label: "Disabled", value: "disabled" },
        ],
      },
      {
        id: "queryCacheTtlMs",
        sectionId: "query-policy",
        label: "Query cache TTL",
        description:
          "Default completed-result cache lifetime in milliseconds. Default is 15 minutes.",
        type: "number",
        required: false,
        defaultValue: DEFAULT_MAIN_SEQUENCE_DATA_NODE_QUERY_CACHE_TTL_MS,
      },
      {
        id: "dedupeInFlight",
        sectionId: "query-policy",
        label: "Dedupe in-flight identical queries",
        description:
          "When enabled, the backend should share one running Data Node request for identical concurrent cache misses.",
        type: "boolean",
        required: false,
        defaultValue: true,
      },
    ],
  },
  configEditor: DataNodeConnectionConfigEditor,
  exploreComponent: DataNodeConnectionExplore,
  queryEditor: DataNodeConnectionQueryEditor,
  queryModels: [
    {
      id: "data-node-rows-between-dates",
      label: "Rows between dates",
      description:
        "Fetches rows for the configured Data Node across a time range and returns one canonical tabular frame with optional time-series hints.",
      outputContracts: ["core.tabular_frame@v1"],
      defaultOutputContract: "core.tabular_frame@v1",
      timeRangeAware: true,
    },
    {
      id: "data-node-last-observation",
      label: "Last observation",
      description:
        "Fetches the latest available row snapshot for the configured Data Node as a tabular frame.",
      outputContracts: ["core.tabular_frame@v1"],
      defaultOutputContract: "core.tabular_frame@v1",
    },
  ],
  requiredPermissions: ["main_sequence_foundry:view"],
  usageGuidance:
    "Use this connection when a configured source should expose one Main Sequence Data Node to Connection Query. Bind Table, Graph, Statistic, or Transform widgets downstream instead of using the removed Data Node widget.",
  examples: [
    {
      title: "Data Node row source",
      publicConfig: {
        dataNodeId: 714,
        dataNodeLabel: "Example Data Node",
        defaultLimit: DEFAULT_MAIN_SEQUENCE_DATA_NODE_ROW_LIMIT,
        queryCachePolicy: "read",
        queryCacheTtlMs: DEFAULT_MAIN_SEQUENCE_DATA_NODE_QUERY_CACHE_TTL_MS,
        dedupeInFlight: true,
      },
      query: {
        kind: "data-node-rows-between-dates",
        columns: ["unique_identifier", "value", "asof"],
        limit: 500,
      },
    },
  ],
};
