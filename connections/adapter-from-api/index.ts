import type { ConnectionTypeDefinition } from "@/connections/types";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";

import { AdapterFromApiConnectionConfigEditor } from "./AdapterFromApiConnectionConfigEditor";
import { AdapterFromApiConnectionQueryEditor } from "./AdapterFromApiConnectionQueryEditor";

export const ADAPTER_FROM_API_CONNECTION_TYPE_ID = "command_center.adapter_from_api";
export const ADAPTER_FROM_API_QUERY_KIND = "api-operation";

export type AdapterFromApiFieldType =
  | "string"
  | "number"
  | "boolean"
  | "select"
  | "json"
  | "secret";

export type AdapterFromApiParameterLocation = "path" | "query" | "headers";
export type AdapterFromApiCachePolicy = "safe" | "disabled";

export interface AdapterFromApiFieldOption {
  label: string;
  value: string;
}

export interface AdapterFromApiValidationRule {
  pattern?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
}

export interface AdapterFromApiVariableDefinition {
  key: string;
  label: string;
  description?: string;
  type: AdapterFromApiFieldType;
  required?: boolean;
  defaultValue?: unknown;
  example?: unknown;
  renderAs?: string;
  options?: AdapterFromApiFieldOption[];
  validation?: AdapterFromApiValidationRule;
}

export interface AdapterFromApiSecretDefinition extends AdapterFromApiVariableDefinition {
  type: "secret";
  injection?: {
    type: "header" | "query" | "basic" | "bearer";
    name?: string;
    template?: string;
  };
}

export interface AdapterFromApiOpenApiReference {
  url?: string;
  version?: string;
  checksum?: string;
}

export interface AdapterFromApiInfo {
  type?: "adapter-from-api";
  id?: string;
  title?: string;
  description?: string;
}

export interface AdapterFromApiOperationParameter extends AdapterFromApiVariableDefinition {
  key: string;
}

export interface AdapterFromApiResponseMapping {
  id: string;
  label?: string;
  contract: string;
  statusCode?: string;
  contentType?: string;
  rowsPath?: string;
  fieldTypes?: Record<string, "time" | "number" | "boolean" | "string" | "json">;
  timeSeries?: Record<string, unknown>;
}

export interface AdapterFromApiOperationDefinition {
  operationId: string;
  label?: string;
  description?: string;
  method: string;
  path: string;
  kind?: "query" | "resource" | "mutation";
  capabilities?: Array<"query" | "resource" | "mutation">;
  requiresTimeRange?: boolean;
  supportsVariables?: boolean;
  supportsMaxRows?: boolean;
  parameters?: Partial<Record<AdapterFromApiParameterLocation, AdapterFromApiOperationParameter[]>>;
  requestBody?: {
    required?: boolean;
    contentType?: string;
    schema?: unknown;
    description?: string;
  } | null;
  responseMappings?: AdapterFromApiResponseMapping[];
  cache?: {
    policy?: AdapterFromApiCachePolicy;
    ttlMs?: number;
    dedupeInFlight?: boolean;
  };
}

export interface AdapterFromApiCompiledContract {
  contractVersion: number;
  adapter?: AdapterFromApiInfo;
  openapi?: AdapterFromApiOpenApiReference;
  configVariables?: AdapterFromApiVariableDefinition[];
  secretVariables?: AdapterFromApiSecretDefinition[];
  availableOperations?: AdapterFromApiOperationDefinition[];
  health?: Record<string, unknown>;
}

export interface AdapterFromApiPublicConfig {
  contractDefinitionUrl?: string;
  openApiUrl?: string;
  apiBaseUrl?: string;
  contractVersion?: string;
  configValues?: Record<string, unknown>;
  compiledContract?: AdapterFromApiCompiledContract;
  requestTimeoutMs?: number;
  queryCachePolicy?: AdapterFromApiCachePolicy;
  queryCacheTtlMs?: number;
  dedupeInFlight?: boolean;
}

export interface AdapterFromApiSecureConfig {
  secretValues?: Record<string, unknown>;
}

export interface AdapterFromApiConnectionQuery {
  kind?: typeof ADAPTER_FROM_API_QUERY_KIND;
  operationId?: string;
  parameters?: Partial<Record<AdapterFromApiParameterLocation, Record<string, unknown>>>;
  body?: unknown;
  responseMappingId?: string;
}

const usageGuidance = `## purpose

Creates a backend-routed dynamic connection from a Command Center API adapter contract exposed through /.well-known/command-center/connection-contract. The backend adapter discovers the contract, stores configured public variables and secret variables, mirrors query execution to the upstream API, and returns the upstream response through the Command Center connection route.

## whenToUse

- Use when an API exposes a Command Center connection contract through /.well-known/command-center/connection-contract.
- Use when the data source should be configured once as a backend-owned connection and queried by Explore or workspace source widgets.
- Use when credentials must be stored by the backend and injected into upstream API calls by the backend adapter.

## whenNotToUse

- Do not use for arbitrary OpenAPI documents with no Command Center adapter contract.
- Do not use when browser-direct API calls are required; this connection is proxy/server-routed.
- Do not use for mutating API operations unless the contract explicitly marks them safe and the backend adapter supports mutation semantics.

## configurationFields

### contractDefinitionUrl

- Label: Derived contract definition URL
- Type: string
- Required: yes
- Default: none
- Example: https://api.example.com/.well-known/command-center/connection-contract
- Used by: frontend and backend adapter
- Meaning: API-owned Command Center connection contract endpoint derived from the configured API root.
- Constraints: backend must fetch this URL with SSRF protection, timeout, size limits, and allowlist policy.
- UI help: Derived from the API root URL as /.well-known/command-center/connection-contract. The backend fetches and validates this document; the browser must not call the upstream API directly.

### openApiUrl

- Label: Derived OpenAPI URL
- Type: string
- Required: no
- Default: none
- Example: https://api.example.com/openapi.json
- Used by: backend adapter
- Meaning: direct OpenAPI document URL derived from the configured API root for optional supporting metadata.
- Constraints: backend may fetch it only after loading a valid well-known contract and must still apply the same URL policy.
- UI help: Derived from the API root URL as /openapi.json. The backend may use it as supporting metadata, but the well-known Command Center contract remains authoritative.

### apiBaseUrl

- Label: API root URL
- Type: string
- Required: yes
- Default: none
- Example: https://api.example.com
- Used by: frontend and backend adapter
- Meaning: authoritative API root entered by the user. The frontend derives openApiUrl and contractDefinitionUrl from this root using opinionated conventional paths.
- Constraints: must be the API root, not a specific OpenAPI or well-known contract document URL. The backend must reject hosts not allowed by the compiled contract.
- UI help: Root URL for the upstream API. This editor derives the OpenAPI URL as /openapi.json and the Command Center contract URL as /.well-known/command-center/connection-contract.

### contractVersion

- Label: Contract version pin
- Type: string
- Required: no
- Default: latest compatible
- Example: 2026-04-26
- Used by: backend adapter
- Meaning: optional version marker used to pin contract discovery.
- Constraints: backend rejects unsupported or changed incompatible contracts.
- UI help: Optional contract version or tag used by the backend to pin discovery.

### configValues

- Label: Config values
- Type: json
- Required: no
- Default: {}
- Example: { "tenantId": "tenant_123" }
- Used by: frontend and backend adapter
- Meaning: dynamic public config values keyed by the discovered contract's configVariables.
- Constraints: backend validates keys and values against the compiled contract.
- UI help: Dynamic public config values generated from the API contract. The backend validates these values before saving and before execution.

### compiledContract

- Label: Compiled contract
- Type: json
- Required: no
- Default: none
- Example: { "contractVersion": 1, "availableOperations": [] }
- Used by: frontend and backend adapter
- Meaning: sanitized compiled contract snapshot returned by the backend after discovery.
- Constraints: frontend treats it as untrusted display metadata; backend remains authoritative.
- UI help: Sanitized compiled contract snapshot. Usually written by the backend after contract discovery.

### requestTimeoutMs

- Label: Request timeout ms
- Type: number
- Required: no
- Default: 30000
- Example: 15000
- Used by: backend adapter
- Meaning: upstream request timeout for API calls.
- Constraints: backend clamps to deployment maximum.
- UI help: Backend timeout for upstream API calls in milliseconds.

### queryCachePolicy

- Label: Query cache policy
- Type: string
- Required: no
- Default: safe
- Example: safe
- Used by: backend adapter
- Meaning: completed-result cache policy for safe declared operations.
- Constraints: only successful permission-checked responses may cache.
- UI help: Backend result cache policy for safe declared API operations.

### queryCacheTtlMs

- Label: Query cache TTL ms
- Type: number
- Required: no
- Default: 300000
- Example: 300000
- Used by: backend adapter
- Meaning: default TTL for successful cached query responses.
- Constraints: non-negative integer.
- UI help: Backend cache lifetime for successful API operation responses in milliseconds.

### dedupeInFlight

- Label: Dedupe in-flight identical queries
- Type: boolean
- Required: no
- Default: true
- Example: true
- Used by: backend adapter
- Meaning: share one running provider request for identical permission-checked requests.
- Constraints: key must include auth scope, connection id, operation, effective config, and request payload.
- UI help: When enabled, the backend shares one in-flight request for identical safe API operations.

### secretValues

- Label: Secret values JSON
- Type: json secure config
- Required: conditional
- Default: {}
- Example: { "apiToken": "provider-secret" }
- Used by: backend adapter
- Meaning: dynamic secret values keyed by the discovered contract's secretVariables.
- Constraints: write-only secureConfig field; backend must redact values from responses, logs, cache keys, traces, and errors.
- UI help: Write-only JSON object containing secret values required by the API contract. Keys must match secretVariables.

## queryModels

### api-operation

- Payload: { "kind": "api-operation", "operationId": "listOrders", "parameters": { "path": {}, "query": {}, "headers": {} }, "body": null, "responseMappingId": "orders_table" }
- Returns: the upstream API response routed through the backend connection endpoint.
- Time-range-aware: yes in the first frontend slice so dynamic operations can receive a top-level timeRange. The backend should ignore it unless the selected operation declares it.
- Notes: operationId must exist in the backend-compiled contract. The backend rejects undeclared paths, methods, headers, hosts, and credential injection points. \`responseMappingId\` is optional frontend metadata and must not force hot-path backend response validation.

## resources

### contract-definition

- Payload: { "apiBaseUrl": "https://api.example.com", "contractVersion": "optional-pin" }
- Returns: sanitized compiled contract used by the frontend to render dynamic config and query forms.

### available-operations

- Payload: optional filters.
- Returns: operation summaries from the compiled contract.

### operation-schema

- Payload: { "operationId": "listOrders" }
- Returns: one operation's parameters, request body metadata, and optional response-mapping metadata.

## backendOwnership

- type_id: command_center.adapter_from_api
- Backend owns well-known contract fetching, SSRF protection, compiled contract storage, public and secure config validation, secret storage, credential injection, operation allowlist enforcement, upstream API calls, cache policy, in-flight dedupe, provider error mapping, health checks, and pass-through response handling.
- Browser code must not call the upstream API directly and must not receive decrypted secret values.
`;

export const adapterFromApiConnection: ConnectionTypeDefinition<
  AdapterFromApiPublicConfig,
  AdapterFromApiConnectionQuery
> = {
  id: ADAPTER_FROM_API_CONNECTION_TYPE_ID,
  version: 1,
  title: "Adapter From API",
  description:
    "Builds a backend-routed dynamic connection from an API-owned Command Center OpenAPI contract.",
  source: "command_center",
  category: "APIs",
  tags: ["api", "openapi", "dynamic", "adapter"],
  capabilities: ["query", "resource", "health-check"],
  accessMode: "proxy",
  publicConfigSchema: {
    version: 1,
    sections: [
      {
        id: "discovery",
        title: "Discovery",
        description: "Backend-routed API contract discovery.",
      },
      {
        id: "runtime",
        title: "Runtime policy",
        description: "Backend request timeout, cache, and in-flight de-duplication settings.",
      },
      {
        id: "dynamic",
        title: "Dynamic contract state",
        description: "Sanitized backend-compiled contract and public variable values.",
      },
    ],
    fields: [
      {
        id: "contractDefinitionUrl",
        sectionId: "discovery",
        label: "Derived contract definition URL",
        description:
          "Derived from the API root URL as /.well-known/command-center/connection-contract. The backend fetches and validates this document; the browser must not call the upstream API directly.",
        type: "string",
        required: true,
      },
      {
        id: "openApiUrl",
        sectionId: "discovery",
        label: "Derived OpenAPI URL",
        description:
          "Derived from the API root URL as /openapi.json. The backend validates it against the contract and URL policy.",
        type: "string",
        required: false,
      },
      {
        id: "apiBaseUrl",
        sectionId: "discovery",
        label: "API root URL",
        description:
          "Root URL for the upstream API. This editor derives the OpenAPI URL as /openapi.json and the Command Center contract URL as /.well-known/command-center/connection-contract.",
        type: "string",
        required: true,
      },
      {
        id: "contractVersion",
        sectionId: "discovery",
        label: "Contract version pin",
        description:
          "Optional contract version or tag used by the backend to pin discovery.",
        type: "string",
        required: false,
      },
      {
        id: "requestTimeoutMs",
        sectionId: "runtime",
        label: "Request timeout ms",
        description: "Backend timeout for upstream API calls in milliseconds.",
        type: "number",
        required: false,
        defaultValue: 30000,
      },
      {
        id: "queryCachePolicy",
        sectionId: "runtime",
        label: "Query cache policy",
        description: "Backend result cache policy for safe declared API operations.",
        type: "select",
        required: false,
        defaultValue: "safe",
        options: [
          { label: "Safe declared operations", value: "safe" },
          { label: "Disabled", value: "disabled" },
        ],
      },
      {
        id: "queryCacheTtlMs",
        sectionId: "runtime",
        label: "Query cache TTL ms",
        description:
          "Backend cache lifetime for successful API operation responses in milliseconds.",
        type: "number",
        required: false,
        defaultValue: 300000,
      },
      {
        id: "dedupeInFlight",
        sectionId: "runtime",
        label: "Dedupe in-flight identical queries",
        description:
          "When enabled, the backend shares one in-flight request for identical safe API operations.",
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      {
        id: "configValues",
        sectionId: "dynamic",
        label: "Config values",
        description:
          "Dynamic public config values generated from the API contract. The backend validates these values before saving and before execution.",
        type: "json",
        required: false,
        defaultValue: {},
      },
      {
        id: "compiledContract",
        sectionId: "dynamic",
        label: "Compiled contract",
        description:
          "Sanitized compiled contract snapshot. Usually written by the backend after contract discovery.",
        type: "json",
        required: false,
      },
    ],
  },
  secureConfigSchema: {
    version: 1,
    fields: [
      {
        id: "secretValues",
        label: "Secret values JSON",
        description:
          "Write-only JSON object containing secret values required by the API contract. Keys must match secretVariables.",
        type: "json",
        required: false,
      },
    ],
  },
  queryModels: [
    {
      id: ADAPTER_FROM_API_QUERY_KIND,
      label: "API operation",
      description:
        "Executes one operation declared by the backend-compiled API adapter contract.",
      outputContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
      defaultOutputContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      defaultQuery: {
        kind: ADAPTER_FROM_API_QUERY_KIND,
        parameters: { path: {}, query: {}, headers: {} },
        body: null,
      },
      controls: [
        "operation",
        "pathParameters",
        "queryParameters",
        "headers",
        "body",
        "responseMapping",
      ],
      timeRangeAware: true,
      supportsVariables: true,
      supportsMaxRows: true,
    },
  ],
  requiredPermissions: ["connections:query"],
  configEditor: AdapterFromApiConnectionConfigEditor,
  queryEditor: AdapterFromApiConnectionQueryEditor,
  usageGuidance,
  examples: [
    {
      title: "Orders API operation",
      publicConfig: {
        apiBaseUrl: "https://api.example.com",
        contractDefinitionUrl:
          "https://api.example.com/.well-known/command-center/connection-contract",
        openApiUrl: "https://api.example.com/openapi.json",
        configValues: {
          tenantId: "tenant_123",
        },
        requestTimeoutMs: 30000,
        queryCachePolicy: "safe",
        queryCacheTtlMs: 300000,
        dedupeInFlight: true,
      },
      query: {
        kind: ADAPTER_FROM_API_QUERY_KIND,
        operationId: "listOrders",
        parameters: {
          path: {},
          query: { status: "open" },
          headers: {},
        },
        body: null,
        responseMappingId: "orders_table",
      },
    },
  ],
};

export default adapterFromApiConnection;
