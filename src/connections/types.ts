import type { ComponentType } from "react";

import type { WidgetContractId } from "@/widgets/types";

export const CONNECTION_RESPONSE_CONTRACT_IDS = [
  "core.tabular_frame@v1",
  "core.chart_data@v1",
] as const satisfies readonly WidgetContractId[];

export const LEGACY_CONNECTION_TIME_SERIES_FRAME_CONTRACT = "core.time_series_frame@v1" as const;

export type ConnectionResponseContractId =
  (typeof CONNECTION_RESPONSE_CONTRACT_IDS)[number];
export type ConnectionRawFrameContractId =
  | ConnectionResponseContractId
  | typeof LEGACY_CONNECTION_TIME_SERIES_FRAME_CONTRACT;

export function isConnectionResponseContractId(
  value: unknown,
): value is ConnectionResponseContractId {
  return (
    typeof value === "string" &&
    CONNECTION_RESPONSE_CONTRACT_IDS.includes(value as ConnectionResponseContractId)
  );
}

export type ConnectionCapability =
  | "query"
  | "stream"
  | "resource"
  | "mutation"
  | "health-check"
  | "sql-read"
  | "sql-write"
  | "physical-data-source"
  | "timescale-extension";

export type ConnectionAccessMode = "proxy" | "browser" | "server-only";
export type ConnectionPhysicalDataSourceRegistrationMode =
  "auto-when-write-capable";

export interface ConnectionPhysicalDataSourceMetadata {
  eligible: boolean;
  dataSourceClassType: string;
  requiresCapabilities?: ConnectionCapability[];
  defaultRegistrationMode?: ConnectionPhysicalDataSourceRegistrationMode;
  managedLifecycle?: boolean;
}

export type ConnectionStreamMode = "snapshot" | "delta";
export type ConnectionAuthoringMode = "query" | "stream";

export type ConnectionSchemaFieldType =
  | "string"
  | "number"
  | "boolean"
  | "select"
  | "json"
  | "secret";

export interface ConnectionSchemaFieldOption {
  label: string;
  value: string;
}

export interface ConnectionSchemaFieldVisibilityRule {
  fieldId: string;
  equals?: string | number | boolean | Array<string | number | boolean>;
}

export interface ConnectionSchemaField {
  id: string;
  sectionId?: string;
  label: string;
  description?: string;
  type: ConnectionSchemaFieldType;
  required?: boolean;
  options?: ConnectionSchemaFieldOption[];
  defaultValue?: unknown;
  visibleWhen?: ConnectionSchemaFieldVisibilityRule | ConnectionSchemaFieldVisibilityRule[];
}

export interface ConnectionConfigSchema {
  version: number;
  sections?: Array<{ id: string; title: string; description?: string }>;
  fields: ConnectionSchemaField[];
}

export interface ConnectionQueryStreamModel {
  transport: "websocket";
  modes: ConnectionStreamMode[];
  defaultMode?: ConnectionStreamMode;
  supportsResume?: boolean;
  heartbeatMs?: number;
  description?: string;
  defaultMergeKeyFields?: string[];
}

export interface ConnectionQueryGraphPreviewModel {
  xField: string;
  yField: string;
  groupField?: string;
  rowIdentityFields?: string[];
  preferredChartType?: "line" | "area" | "bar";
  maxRetainedRows?: number;
}

export interface ConnectionQueryPreviewModel {
  graph?: ConnectionQueryGraphPreviewModel;
}

export interface ConnectionQueryModel {
  id: string;
  label: string;
  description?: string;
  outputContracts: WidgetContractId[];
  defaultOutputContract?: ConnectionResponseContractId;
  defaultQuery?: Record<string, unknown>;
  controls?: string[];
  timeRangeAware?: boolean;
  supportsVariables?: boolean;
  supportsMaxRows?: boolean;
  stream?: ConnectionQueryStreamModel;
  preview?: ConnectionQueryPreviewModel;
}

export function isConnectionQueryModelStreamable(
  queryModel: ConnectionQueryModel | null | undefined,
): queryModel is ConnectionQueryModel & { stream: ConnectionQueryStreamModel } {
  const stream = queryModel?.stream;

  return (
    stream?.transport === "websocket" &&
    Array.isArray(stream.modes) &&
    stream.modes.length > 0 &&
    stream.modes.every((mode) => mode === "snapshot" || mode === "delta")
  );
}

export function assertConnectionQueryModelStreamable(
  queryModel: ConnectionQueryModel | null | undefined,
): asserts queryModel is ConnectionQueryModel & { stream: ConnectionQueryStreamModel } {
  if (!isConnectionQueryModelStreamable(queryModel)) {
    throw new Error("The selected connection query model does not support WebSocket streaming.");
  }
}

export function formatConnectionQueryModelTransportLabel(
  queryModel: ConnectionQueryModel | null | undefined,
): "HTTP" | "WS" {
  return isConnectionQueryModelStreamable(queryModel) ? "WS" : "HTTP";
}

export function resolveConnectionQueryModelDescription(
  queryModel: ConnectionQueryModel | null | undefined,
  authoringMode: ConnectionAuthoringMode = "query",
) {
  if (!queryModel) {
    return undefined;
  }

  if (authoringMode === "stream" && isConnectionQueryModelStreamable(queryModel)) {
    return queryModel.stream.description?.trim() || queryModel.description?.trim();
  }

  return queryModel.description?.trim();
}

export interface ConnectionConfigEditorProps<
  TPublicConfig extends object = Record<string, unknown>,
> {
  value: TPublicConfig;
  onChange: (value: TPublicConfig) => void;
  disabled?: boolean;
  connectionInstance?: ConnectionInstance;
}

export interface ConnectionQueryEditorProps<
  TQuery extends object = Record<string, unknown>,
> {
  value: TQuery;
  onChange: (value: TQuery) => void;
  editorState?: Record<string, unknown>;
  onEditorStateChange?: (value: Record<string, unknown> | undefined) => void;
  disabled?: boolean;
  connectionInstance?: ConnectionInstance;
  connectionType?: ConnectionTypeDefinition<any, any>;
  queryModel?: ConnectionQueryModel;
  authoringMode?: ConnectionAuthoringMode;
}

export interface ConnectionQueryDraftDefaults {
  queryModelId?: string;
  query?: Record<string, unknown>;
  fixedStartMs?: number;
  fixedEndMs?: number;
  maxRows?: number;
}

export interface ConnectionQueryDraftDefaultsResolverInput {
  connectionInstance: ConnectionInstance;
  connectionType: ConnectionTypeDefinition<any, any>;
  queryModels: ConnectionQueryModel[];
  selectedQueryModel?: ConnectionQueryModel;
  authoringMode?: ConnectionAuthoringMode;
}

export interface ConnectionAuthoringQueryModelsResolverInput {
  connectionInstance: ConnectionInstance;
  connectionType: ConnectionTypeDefinition<any, any>;
  queryModels: ConnectionQueryModel[];
  authoringMode?: ConnectionAuthoringMode;
}

export interface ConnectionAuthoringSummaryProps {
  connectionInstance: ConnectionInstance;
  connectionType: ConnectionTypeDefinition<any, any>;
}

export interface ConnectionAuthoringContract {
  resolveQueryModels?: (
    input: ConnectionAuthoringQueryModelsResolverInput,
  ) => ConnectionQueryModel[];
  resolveDraftDefaults?: (
    input: ConnectionQueryDraftDefaultsResolverInput,
  ) => ConnectionQueryDraftDefaults;
  SummaryComponent?: ComponentType<ConnectionAuthoringSummaryProps>;
  exploreTitle?: string;
  exploreDescription?: string;
  exploreRunButtonLabel?: string;
  exploreResultTitle?: string;
  exploreResultDescription?: string;
  streamRunButtonLabel?: string;
  streamResultTitle?: string;
  streamResultDescription?: string;
}

export interface ConnectionExploreProps {
  connectionInstance: ConnectionInstance;
  connectionType: ConnectionTypeDefinition<any, any>;
}

export interface ConnectionTypeDefinition<
  TPublicConfig extends object = Record<string, unknown>,
  TQuery extends object = Record<string, unknown>,
> {
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
  publicConfigSchema: ConnectionConfigSchema;
  secureConfigSchema?: ConnectionConfigSchema;
  queryModels?: ConnectionQueryModel[];
  requiredPermissions?: string[];
  configEditor?: ComponentType<ConnectionConfigEditorProps<TPublicConfig>>;
  queryEditor?: ComponentType<ConnectionQueryEditorProps<TQuery>>;
  authoringContract?: ConnectionAuthoringContract;
  physicalDataSource?: ConnectionPhysicalDataSourceMetadata;
  usageGuidance?: string;
  registrySync?: "backend" | "local-only";
  examples?: Array<{
    title: string;
    publicConfig?: Partial<TPublicConfig>;
    query?: Partial<TQuery>;
  }>;
}

export type AnyConnectionTypeDefinition = ConnectionTypeDefinition<any, any>;

export type ConnectionStatus = "unknown" | "ok" | "error" | "disabled";
export type ConnectionId = number | string;

export interface ConnectionInstance {
  id: ConnectionId;
  typeId: string;
  typeVersion: number;
  name: string;
  description?: string;
  organizationId?: string;
  workspaceId?: string | null;
  publicConfig: Record<string, unknown>;
  secureFields: Record<string, boolean>;
  status: ConnectionStatus;
  statusMessage?: string;
  lastHealthCheckAt?: string;
  isActive?: boolean;
  isDefault?: boolean;
  isSystem?: boolean;
  tags?: string[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionRef {
  id: ConnectionId;
  typeId: string;
}

export interface ConnectionHealthResult {
  status: Exclude<ConnectionStatus, "disabled">;
  message?: string;
  latencyMs?: number;
  checkedAt?: string;
  traceId?: string;
}

export type ConnectionQueryCacheMode = "default" | "bypass" | "refresh";

export interface ConnectionQueryRequest<TQuery = Record<string, unknown>> {
  connectionId: ConnectionId;
  query: TQuery;
  requestedOutputContract?: ConnectionResponseContractId;
  timeRange?: {
    from: string;
    to: string;
  };
  variables?: Record<string, string | number | boolean>;
  maxRows?: number;
  cacheMode?: ConnectionQueryCacheMode;
  cacheTtlMs?: number;
}

export type CommandCenterFrameFieldType =
  | "time"
  | "number"
  | "string"
  | "boolean"
  | "json";

export interface CommandCenterFrameField {
  name: string;
  type: CommandCenterFrameFieldType;
  values: unknown[];
  labels?: Record<string, string>;
  config?: {
    unit?: string;
    displayName?: string;
    decimals?: number;
  };
}

export interface CommandCenterFrame {
  name?: string;
  contract: ConnectionRawFrameContractId;
  fields: CommandCenterFrameField[];
  meta?: Record<string, unknown>;
}

export interface ConnectionQueryResponse {
  frames: CommandCenterFrame[];
  warnings?: string[];
  traceId?: string;
}

export type ConnectionStreamQueryRequest<TQuery = Record<string, unknown>> = Omit<
  ConnectionQueryRequest<TQuery>,
  "cacheMode" | "cacheTtlMs"
> & {
  resumeToken?: string;
};

export interface ConnectionStreamSubscribeMessage<TQuery = Record<string, unknown>> {
  type: "subscribe";
  request: ConnectionStreamQueryRequest<TQuery>;
}

export interface ConnectionStreamAckMessage {
  type: "ack";
  connectionId: ConnectionId;
  queryKind: string;
  sequence: number;
  acceptedAt: string;
  traceId?: string;
  heartbeatMs?: number;
  resumeToken?: string;
}

export interface ConnectionStreamDataMessage {
  type: "snapshot" | "delta";
  connectionId: ConnectionId;
  queryKind: string;
  sequence: number;
  emittedAt: string;
  response: ConnectionQueryResponse;
  traceId?: string;
  resumeToken?: string;
  warnings?: string[];
}

export interface ConnectionStreamHeartbeatMessage {
  type: "heartbeat";
  sequence: number;
  emittedAt: string;
  traceId?: string;
}

export interface ConnectionStreamErrorMessage {
  type: "error";
  sequence: number;
  emittedAt: string;
  code: string;
  message: string;
  retryable: boolean;
  traceId?: string;
  details?: Record<string, unknown>;
}

export interface ConnectionStreamCompleteMessage {
  type: "complete";
  sequence: number;
  emittedAt: string;
  reason?: string;
  traceId?: string;
}

export type ConnectionStreamServerMessage =
  | ConnectionStreamAckMessage
  | ConnectionStreamDataMessage
  | ConnectionStreamHeartbeatMessage
  | ConnectionStreamErrorMessage
  | ConnectionStreamCompleteMessage;

export interface ConnectionResourceRequest {
  connectionId: ConnectionId;
  resource: string;
  params?: Record<string, unknown>;
}

export interface ConnectionStreamRequest {
  connectionId: ConnectionId;
  channel: string;
  params?: Record<string, unknown>;
}
