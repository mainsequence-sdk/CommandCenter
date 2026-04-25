import type { ComponentType } from "react";

import type { WidgetContractId } from "@/widgets/types";

export type ConnectionCapability =
  | "query"
  | "stream"
  | "resource"
  | "mutation"
  | "health-check";

export type ConnectionAccessMode = "proxy" | "browser" | "server-only";

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

export interface ConnectionSchemaField {
  id: string;
  sectionId?: string;
  label: string;
  description?: string;
  type: ConnectionSchemaFieldType;
  required?: boolean;
  options?: ConnectionSchemaFieldOption[];
  defaultValue?: unknown;
}

export interface ConnectionConfigSchema {
  version: number;
  sections?: Array<{ id: string; title: string; description?: string }>;
  fields: ConnectionSchemaField[];
}

export interface ConnectionQueryModel {
  id: string;
  label: string;
  description?: string;
  outputContracts: WidgetContractId[];
  timeRangeAware?: boolean;
  supportsVariables?: boolean;
}

export interface ConnectionConfigEditorProps<
  TPublicConfig extends object = Record<string, unknown>,
> {
  value: TPublicConfig;
  onChange: (value: TPublicConfig) => void;
  disabled?: boolean;
}

export interface ConnectionQueryEditorProps<
  TQuery extends object = Record<string, unknown>,
> {
  value: TQuery;
  onChange: (value: TQuery) => void;
  disabled?: boolean;
  queryModel?: ConnectionQueryModel;
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
  exploreComponent?: ComponentType<ConnectionExploreProps>;
  usageGuidance?: string;
  examples?: Array<{
    title: string;
    publicConfig?: Partial<TPublicConfig>;
    query?: Partial<TQuery>;
  }>;
}

export type AnyConnectionTypeDefinition = ConnectionTypeDefinition<any, any>;

export type ConnectionStatus = "unknown" | "ok" | "error" | "disabled";

export interface ConnectionInstance {
  id: string;
  uid: string;
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
  isDefault?: boolean;
  isSystem?: boolean;
  tags?: string[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionRef {
  uid: string;
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
  connectionUid: string;
  query: TQuery;
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
  contract: WidgetContractId;
  fields: CommandCenterFrameField[];
  meta?: Record<string, unknown>;
}

export interface ConnectionQueryResponse {
  frames: CommandCenterFrame[];
  warnings?: string[];
  traceId?: string;
}

export interface ConnectionResourceRequest {
  connectionUid: string;
  resource: string;
  params?: Record<string, unknown>;
}

export interface ConnectionStreamRequest {
  connectionUid: string;
  channel: string;
  params?: Record<string, unknown>;
}
