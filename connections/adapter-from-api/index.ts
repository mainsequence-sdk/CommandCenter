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
export type AdapterFromApiTransportMode = "backend" | "direct";
export type AdapterFromApiCompiledContractSource = "backend" | "direct";
export type AdapterFromApiApplicationBindingAppId = "main_sequence_markets";
export type AdapterFromApiApplicationBindingRole = "primary-api";

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
  logo?: AdapterFromApiLogo;
}

export interface AdapterFromApiLogo {
  url: string;
  altText?: string;
  backgroundColor?: string;
  href?: string;
  source?: "openapi.info.x-logo";
}

export interface AdapterFromApiInfo {
  type?: "adapter-from-api";
  id?: string;
  title?: string;
  description?: string;
  logo?: AdapterFromApiLogo;
}

export interface AdapterFromApiOperationParameter extends AdapterFromApiVariableDefinition {
  key: string;
  name?: string;
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
  responseContract?: string;
  responseModel?: string | null;
  cache?: {
    policy?: AdapterFromApiCachePolicy;
    ttlMs?: number;
    dedupeInFlight?: boolean;
  };
}

export interface AdapterFromApiCompiledContract {
  contractVersion: number | string;
  adapter?: AdapterFromApiInfo;
  openapi?: AdapterFromApiOpenApiReference;
  configVariables?: AdapterFromApiVariableDefinition[];
  secretVariables?: AdapterFromApiSecretDefinition[];
  availableOperations?: AdapterFromApiOperationDefinition[];
  health?: Record<string, unknown>;
  apiBaseUrl?: string;
  checksum?: string;
}

export interface AdapterFromApiApplicationBinding {
  appId: AdapterFromApiApplicationBindingAppId;
  role: AdapterFromApiApplicationBindingRole;
}

export interface AdapterFromApiPublicConfig {
  transportMode?: AdapterFromApiTransportMode;
  contractDefinitionUrl?: string;
  openApiUrl?: string;
  apiBaseUrl?: string;
  debugApiBaseUrl?: string;
  contractVersion?: string;
  configValues?: Record<string, unknown>;
  compiledContract?: AdapterFromApiCompiledContract;
  compiledContractSource?: AdapterFromApiCompiledContractSource;
  compiledContractSourceUrl?: string;
  requestTimeoutMs?: number;
  queryCachePolicy?: AdapterFromApiCachePolicy;
  queryCacheTtlMs?: number;
  dedupeInFlight?: boolean;
  applicationBindings?: AdapterFromApiApplicationBinding[];
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

Creates a dynamic connection from a Command Center API adapter contract exposed through /.well-known/command-center/connection-contract. It supports backend proxy mode for shared/production execution and direct debug mode for browser calls to a local API root while keeping the same connection id, query payloads, widget bindings, and ConnectionQueryResponse output contracts.

## whenToUse

- Use when an API exposes a Command Center connection contract through /.well-known/command-center/connection-contract.
- Use backend proxy mode when Command Center should own discovery, private-network policy, secret injection, cache/dedupe, health checks, and provider calls.
- Use direct debug mode when developing against a browser-reachable local API root such as http://127.0.0.1:8021 and the API is callable without Command Center-managed auth.
- Use applicationBindings only when an organization admin flow binds an existing Adapter From API connection to an application role such as Main Sequence Markets primary API.

## whenNotToUse

- Do not use for arbitrary OpenAPI documents with no Command Center adapter contract.
- Do not use direct debug mode for APIs that need backend-stored secrets, bearer tokens, API keys, cookies, runtime credential browser auth, or any other Command Center-managed credential.
- Do not use for mutating API operations unless the contract explicitly marks them safe and the runtime supports that mutation semantics.
- Do not create a separate connection type for application bindings. A Main Sequence Markets binding is metadata on this Adapter From API connection, not a new mainsequence.markets adapter.

## configurationFields

### transportMode

- Label: Transport mode
- Type: select
- Required: no
- Default: backend
- Example: direct
- Used by: frontend and backend adapter
- Meaning: selects backend proxy execution or browser direct debug execution.
- Constraints: missing value means backend for backward compatibility.
- UI help: Choose backend proxy mode for saved/shared connections or direct debug mode for browser calls to a local API root. Direct mode uses the same query contract but no Command Center-managed auth.

### apiBaseUrl

- Label: Backend API root URL
- Type: string
- Required: required when transportMode is backend
- Default: none
- Example: https://api.example.com
- Used by: frontend and backend adapter
- Meaning: upstream API root reachable by the Command Center backend.
- Constraints: must be an absolute http/https root URL; backend private-network and allowlist policy applies.
- UI help: Backend-routed API root URL. The backend fetches the contract, applies private-network policy, stores secrets if configured, and proxies query execution.

### debugApiBaseUrl

- Label: Direct debug API root URL
- Type: string
- Required: required when transportMode is direct
- Default: none
- Example: http://127.0.0.1:8021
- Used by: frontend direct runtime and backend persistence validation
- Meaning: browser-only API root used for direct debug discovery, query execution, and health checks.
- Constraints: must be an absolute http/https root URL with no credentials, query string, or fragment; backend must not fetch it; browser CORS rules apply.
- UI help: Browser-only debug API root such as http://127.0.0.1:8021. Direct mode calls this URL from the browser with credentials omitted and no Command Center-managed auth headers.

### contractDefinitionUrl

- Label: Derived contract definition URL
- Type: string
- Required: no
- Default: derived from the active root URL
- Example: https://api.example.com/.well-known/command-center/connection-contract
- Used by: frontend display, direct discovery diagnostics, and backend mode persistence
- Meaning: well-known Command Center adapter contract endpoint derived from apiBaseUrl or debugApiBaseUrl.
- Constraints: backend mode recomputes it from apiBaseUrl; direct mode recomputes it from debugApiBaseUrl.
- UI help: Derived from the active API root URL as /.well-known/command-center/connection-contract. Backend mode fetches it server-side; direct debug mode fetches it from the browser.

### openApiUrl

- Label: Derived OpenAPI URL
- Type: string
- Required: no
- Default: derived from the active root URL
- Example: https://api.example.com/openapi.json
- Used by: frontend display and backend/direct contract metadata
- Meaning: supporting OpenAPI document URL derived from the active root.
- Constraints: the well-known Command Center contract remains authoritative.
- UI help: Derived from the active API root URL as /openapi.json. It is supporting metadata; the well-known Command Center contract remains authoritative.

### contractVersion

- Label: Contract version pin
- Type: string
- Required: no
- Default: latest compatible
- Example: v1
- Used by: backend adapter and backend direct-mode validation
- Meaning: optional version, tag, or checksum marker used to pin the discovered/submitted contract.
- Constraints: backend mode rejects discovered contracts that do not match; direct mode rejects submitted compiled contracts that do not match.
- UI help: Optional contract version or tag used by the backend to pin discovery.

### configValues

- Label: Config values
- Type: json
- Required: no
- Default: {}
- Example: { "tenantId": "tenant_123" }
- Used by: frontend and backend adapter
- Meaning: dynamic public config values keyed by compiledContract.configVariables.
- Constraints: backend validates before saving; direct execution validates in the browser before dispatch.
- UI help: Dynamic public config values keyed by the compiled contract's configVariables.

### compiledContract

- Label: Compiled contract
- Type: json
- Required: required after discovery before queries can be authored
- Default: none
- Example: { "contractVersion": 1, "availableOperations": [] }
- Used by: frontend and backend adapter
- Meaning: sanitized contract snapshot used to render dynamic config/query forms and execute declared operations.
- Constraints: backend mode overwrites it from server-side discovery; direct mode accepts a browser-discovered snapshot after backend shape validation; it must not contain secret values. Optional compiledContract.openapi.logo metadata may be derived from OpenAPI info.x-logo and used only for display.
- UI help: Sanitized compiled contract snapshot. Backend mode writes it after server-side discovery; direct debug mode writes it after browser discovery.

### compiledContractSource

- Label: Compiled contract source
- Type: string metadata
- Required: no
- Default: backend
- Example: direct
- Used by: frontend diagnostics and backend persistence
- Meaning: records whether the current snapshot came from backend discovery or direct browser discovery.
- Constraints: metadata only; backend mode remains authoritative for backend execution.
- UI help: Internal marker recording whether the stored compiled contract came from backend discovery or direct browser discovery.

### compiledContractSourceUrl

- Label: Compiled contract source URL
- Type: string metadata
- Required: no
- Default: none
- Example: http://127.0.0.1:8021/.well-known/command-center/connection-contract
- Used by: frontend diagnostics and backend persistence
- Meaning: well-known contract URL used to create the current compiled contract snapshot.
- Constraints: diagnostic only; not an execution authority.
- UI help: Internal marker recording the well-known contract URL used to create the current compiled contract snapshot.

### requestTimeoutMs

- Label: Request timeout ms
- Type: number
- Required: no
- Default: 30000
- Example: 15000
- Used by: backend adapter
- Meaning: backend upstream request timeout in milliseconds.
- Constraints: backend clamps to deployment maximum; direct debug mode bypasses this setting.
- UI help: Backend timeout for upstream API calls in milliseconds. Direct debug mode bypasses the backend and does not use this value.

### queryCachePolicy

- Label: Query cache policy
- Type: string
- Required: no
- Default: safe
- Example: safe
- Used by: backend adapter
- Meaning: completed-result cache policy for safe declared operations.
- Constraints: direct debug mode bypasses backend caching.
- UI help: Backend result cache policy for safe declared API operations. Direct debug mode bypasses backend caching.

### queryCacheTtlMs

- Label: Query cache TTL ms
- Type: number
- Required: no
- Default: 300000
- Example: 300000
- Used by: backend adapter
- Meaning: backend TTL for successful cached query responses.
- Constraints: non-negative integer; direct debug mode bypasses backend caching.
- UI help: Backend cache lifetime for successful API operation responses in milliseconds. Direct debug mode bypasses backend caching.

### dedupeInFlight

- Label: Dedupe in-flight identical queries
- Type: boolean
- Required: no
- Default: true
- Example: true
- Used by: backend adapter
- Meaning: whether backend mode may share one running provider request for identical safe operations.
- Constraints: direct debug mode bypasses backend dedupe.
- UI help: When enabled, the backend shares one in-flight request for identical safe API operations. Direct debug mode bypasses backend dedupe.

### applicationBindings

- Label: Application bindings
- Type: json
- Required: no
- Default: []
- Example: [ { "appId": "main_sequence_markets", "role": "primary-api" } ]
- Used by: frontend application resolution and backend persistence
- Meaning: organization-scoped metadata declaring that this Adapter From API connection serves an application role. The Main Sequence Markets admin section uses { "appId": "main_sequence_markets", "role": "primary-api" } to select the API connection for that application.
- Constraints: this is a binding marker only; it does not create a new adapter, connection type, endpoint, credential model, or execution path. Main Sequence Markets should have one primary-api binding per organization; duplicate handling belongs to the app/admin binding flow.
- UI help: Optional app binding metadata. Main Sequence Markets uses [{ "appId": "main_sequence_markets", "role": "primary-api" }] to mark this existing Adapter From API connection as its primary API connection.

### secretValues

- Label: Secret values JSON
- Type: json secure config
- Required: conditional in backend mode
- Default: {}
- Example: { "apiToken": "provider-secret" }
- Used by: backend adapter only
- Meaning: dynamic secret values keyed by compiledContract.secretVariables for backend proxy execution.
- Constraints: write-only secureConfig field; backend redacts values from responses, logs, cache keys, traces, and errors. Direct debug mode rejects submitted secret values and never injects Command Center-managed auth.
- UI help: Write-only JSON object containing secret values required by the API contract. Keys must match secretVariables.

## queryModels

### api-operation

- Payload: { "kind": "api-operation", "operationId": "listOrders", "parameters": { "path": {}, "query": {}, "headers": {} }, "body": null, "responseMappingId": "orders_table" }
- Returns: ConnectionQueryResponse, either by wrapping a native frame when the operation declares responseContract, converting native core.tabular_frame@v1 columns/rows responses, or mapping provider-native JSON through a selected response mapping.
- Time-range-aware: yes, so dynamic operations can receive a top-level timeRange when the selected operation declares it.
- Backend mode: browser calls Command Center /query/ and the backend calls apiBaseUrl.
- Direct mode: browser direct runtime calls debugApiBaseUrl with fetch credentials omitted and maps the response locally.
- Notes: operationId and all parameters must exist in compiledContract. Operations marked kind: "query" or capabilities: ["query"] are query-capable, and read-only GET operations are also query-capable even when classified as resources. For backward compatibility, unclassified operations with neither kind nor capabilities are also treated as query-capable. Explicit mutation operations stay hidden from query authoring. User-configurable Authorization, cookie, API-key, and auth-token headers are rejected.

## resources

Backend mode supports the backend Adapter From API resources: contract-definition, available-operations, operation-schema, and health-target. Direct debug mode should resolve operation metadata from the saved compiledContract and backend resource endpoints reject direct-mode instances.

## backendOwnership

- type_id: command_center.adapter_from_api
- Backend mode owns well-known contract fetching, SSRF/private-network protection, compiled contract storage, public and secure config validation, secret storage, credential injection, operation allowlist enforcement, upstream API calls, cache policy, in-flight dedupe, provider error mapping, health checks, and response normalization.
- Direct mode backend ownership is persistence validation only: validate debugApiBaseUrl syntax, validate submitted compiledContract shape, validate configValues, persist direct-mode public config, and reject backend query/resource/test execution for direct-mode instances.
- Backend connection persistence accepts and returns applicationBindings as public config metadata. The backend does not treat a Main Sequence Markets binding as a new adapter type.
- Backend discovery should sanitize OpenAPI info.x-logo into compiledContract.openapi.logo by resolving relative URLs against openapi.url, accepting only browser-renderable HTTP(S) logo URLs, and never treating logo metadata as an execution authority.
- Browser direct runtime owns direct discovery, a frontend-only sessionStorage discovery cache keyed by connection id, direct query execution, direct health checks, request construction, local parameter validation, and response mapping without Command Center-managed auth. In direct debug mode, the query editor refreshes the well-known contract when opened and a matching refreshed session cache can override the saved compiledContract snapshot so local route additions are available before the connection is resaved.
`;

export const adapterFromApiConnection: ConnectionTypeDefinition<
  AdapterFromApiPublicConfig,
  AdapterFromApiConnectionQuery
> = {
  id: ADAPTER_FROM_API_CONNECTION_TYPE_ID,
  version: 1,
  title: "Adapter From API",
  description:
    "Builds a dynamic connection from an API-owned Command Center contract with backend proxy and direct debug transports.",
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
        description: "API contract discovery and transport selection.",
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
        id: "transportMode",
        sectionId: "discovery",
        label: "Transport mode",
        description:
          "Choose backend proxy mode for saved/shared connections or direct debug mode for browser calls to a local API root. Direct mode uses the same query contract but no Command Center-managed auth.",
        type: "select",
        required: false,
        defaultValue: "backend",
        options: [
          { label: "Backend proxy", value: "backend" },
          { label: "Direct debug", value: "direct" },
        ],
      },
      {
        id: "contractDefinitionUrl",
        sectionId: "discovery",
        label: "Derived contract definition URL",
        description:
          "Derived from the active API root URL as /.well-known/command-center/connection-contract. Backend mode fetches it server-side; direct debug mode fetches it from the browser.",
        type: "string",
        required: false,
      },
      {
        id: "openApiUrl",
        sectionId: "discovery",
        label: "Derived OpenAPI URL",
        description:
          "Derived from the active API root URL as /openapi.json. It is supporting metadata; the well-known Command Center contract remains authoritative.",
        type: "string",
        required: false,
      },
      {
        id: "apiBaseUrl",
        sectionId: "discovery",
        label: "Backend API root URL",
        description:
          "Backend-routed API root URL. The backend fetches the contract, applies private-network policy, stores secrets if configured, and proxies query execution.",
        type: "string",
        required: false,
        visibleWhen: { fieldId: "transportMode", equals: "backend" },
      },
      {
        id: "debugApiBaseUrl",
        sectionId: "discovery",
        label: "Direct debug API root URL",
        description:
          "Browser-only debug API root such as http://127.0.0.1:8021. Direct mode calls this URL from the browser with credentials omitted and no Command Center-managed auth headers.",
        type: "string",
        required: false,
        visibleWhen: { fieldId: "transportMode", equals: "direct" },
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
        id: "applicationBindings",
        sectionId: "runtime",
        label: "Application bindings",
        description:
          'Optional app binding metadata. Main Sequence Markets uses [{ "appId": "main_sequence_markets", "role": "primary-api" }] to mark this existing Adapter From API connection as its primary API connection.',
        type: "json",
        required: false,
        defaultValue: [],
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
          "Sanitized compiled contract snapshot. Backend mode writes it after server-side discovery; direct debug mode writes it after browser discovery.",
        type: "json",
        required: false,
      },
      {
        id: "compiledContractSource",
        sectionId: "dynamic",
        label: "Compiled contract source",
        description:
          "Internal marker recording whether the stored compiled contract came from backend discovery or direct browser discovery.",
        type: "string",
        required: false,
      },
      {
        id: "compiledContractSourceUrl",
        sectionId: "dynamic",
        label: "Compiled contract source URL",
        description:
          "Internal marker recording the well-known contract URL used to create the current compiled contract snapshot.",
        type: "string",
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
          "Write-only JSON object containing secret values required by the API contract in backend mode. Direct debug mode rejects submitted secrets and never injects Command Center-managed auth.",
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
        "Executes one operation declared by the compiled API adapter contract through the selected transport mode.",
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
        transportMode: "backend",
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
    {
      title: "Main Sequence Markets primary API binding",
      publicConfig: {
        transportMode: "backend",
        apiBaseUrl: "https://markets-api.example.com",
        contractDefinitionUrl:
          "https://markets-api.example.com/.well-known/command-center/connection-contract",
        openApiUrl: "https://markets-api.example.com/openapi.json",
        applicationBindings: [
          {
            appId: "main_sequence_markets",
            role: "primary-api",
          },
        ],
      },
      query: {
        kind: ADAPTER_FROM_API_QUERY_KIND,
        operationId: "listAssets",
        parameters: {
          path: {},
          query: {},
          headers: {},
        },
        body: null,
        responseMappingId: "assets_table",
      },
    },
    {
      title: "Local direct debug operation",
      publicConfig: {
        transportMode: "direct",
        debugApiBaseUrl: "http://127.0.0.1:8021",
        contractDefinitionUrl:
          "http://127.0.0.1:8021/.well-known/command-center/connection-contract",
        openApiUrl: "http://127.0.0.1:8021/openapi.json",
        compiledContractSource: "direct",
        compiledContractSourceUrl:
          "http://127.0.0.1:8021/.well-known/command-center/connection-contract",
        configValues: {
          tenantId: "tenant_123",
        },
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
