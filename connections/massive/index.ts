import type { ConnectionTypeDefinition } from "@/connections/types";
import massiveIconUrl from "@/connections/assets/massive-icon-logo.svg";

import { MassiveConnectionConfigEditor } from "./MassiveConnectionConfigEditor";
import { MassiveConnectionExplore } from "./MassiveConnectionExplore";
import { MassiveConnectionQueryEditor } from "./MassiveConnectionQueryEditor";
import {
  DEFAULT_MASSIVE_ASSET_CLASSES,
  MASSIVE_ASSET_CLASS_OPTIONS,
  MASSIVE_CONFIG_FIELD_HELP,
  MASSIVE_MARKET_DATA_CONNECTION_TYPE_ID,
  buildMassiveCatalogUsageMarkdown,
  massiveQueryModels,
  type MassiveConnectionQuery,
  type MassivePublicConfig,
} from "./massiveShared";

export * from "./massiveShared";

const usageGuidance = `## purpose

Connects widgets and Explore flows to Massive REST market data, reference data, news, filings, fundamentals, macroeconomic data, partner datasets, and alternative data through the backend adapter \`${MASSIVE_MARKET_DATA_CONNECTION_TYPE_ID}\`.

## whenToUse

- Use when a workspace needs backend-proxied Massive REST data across stocks, options, crypto, forex, indices, economy, alternative, partner, or beta futures endpoint families.
- Use when the Massive API key must stay encrypted server-side and provider calls must flow through generic Command Center connection routes.
- Use when each widget-bound query should return one \`core.tabular_frame@v1\` frame.

## whenNotToUse

- Do not use for Massive WebSocket streams or flat files; those need separate runtime and storage contracts.
- Do not use for arbitrary URL pass-through. The backend adapter only allows cataloged Massive provider paths.
- Do not use for browser-side SDK calls or provider SDK workflows.

## configurationFields

### baseUrl

- Label: Base URL
- Type: string
- Required: no
- Default: https://api.massive.com
- Example: https://api.massive.com
- Used by: backend adapter
- Meaning: Massive REST API root used for all provider requests.
- Constraints: must be a URI; production instances should normally keep the default host.
- UI help: ${MASSIVE_CONFIG_FIELD_HELP.baseUrl}

### enabledAssetClasses

- Label: Enabled asset classes
- Type: string array
- Required: yes
- Default: ${JSON.stringify(DEFAULT_MASSIVE_ASSET_CLASSES)}
- Example: ["stocks", "options", "crypto", "forex", "indices"]
- Used by: frontend and backend adapter
- Meaning: asset classes this connection may query.
- Constraints: entries must be one of ${MASSIVE_ASSET_CLASS_OPTIONS.map((option) => option.value).join(", ")}; futures endpoints also require \`enableBetaEndpoints=true\`.
- UI help: ${MASSIVE_CONFIG_FIELD_HELP.enabledAssetClasses}

### enableBetaEndpoints

- Label: Enable beta endpoints
- Type: boolean
- Required: no
- Default: false
- Example: true
- Used by: frontend and backend adapter
- Meaning: allows catalog entries marked beta, currently the futures REST family.
- Constraints: beta endpoints are hidden from Explore unless enabled and remain backend-validated.
- UI help: ${MASSIVE_CONFIG_FIELD_HELP.enableBetaEndpoints}

### enableDeprecatedEndpoints

- Label: Enable deprecated endpoints
- Type: boolean
- Required: no
- Default: false
- Example: true
- Used by: frontend and backend adapter
- Meaning: allows catalog entries marked deprecated.
- Constraints: deprecated entries are hidden from Explore unless enabled and remain backend-validated.
- UI help: ${MASSIVE_CONFIG_FIELD_HELP.enableDeprecatedEndpoints}

### defaultLimit

- Label: Default limit
- Type: number
- Required: no
- Default: 1000
- Example: 5000
- Used by: backend adapter
- Meaning: default provider page size when a query payload omits \`params.limit\`.
- Constraints: integer from 1 to 50000.
- UI help: ${MASSIVE_CONFIG_FIELD_HELP.defaultLimit}

### maxRows

- Label: Maximum rows
- Type: number
- Required: no
- Default: 50000
- Example: 10000
- Used by: backend adapter
- Meaning: maximum normalized rows returned after provider pagination.
- Constraints: integer from 1 to 50000; backend truncates and warns when reached.
- UI help: ${MASSIVE_CONFIG_FIELD_HELP.maxRows}

### requestTimeoutMs

- Label: Request timeout ms
- Type: number
- Required: no
- Default: 10000
- Example: 15000
- Used by: backend adapter
- Meaning: HTTP timeout for Massive provider calls.
- Constraints: integer from 1000 to 30000.
- UI help: ${MASSIVE_CONFIG_FIELD_HELP.requestTimeoutMs}

### queryCachePolicy

- Label: Query cache policy
- Type: string
- Required: no
- Default: read
- Example: read
- Used by: backend adapter
- Meaning: successful Massive query caching behavior.
- Constraints: \`read\` or \`disabled\`; backend must not cache provider auth, entitlement, rate-limit, malformed JSON, or partial failures.
- UI help: ${MASSIVE_CONFIG_FIELD_HELP.queryCachePolicy}

### queryCacheTtlMs

- Label: Query cache TTL ms
- Type: number
- Required: no
- Default: 30000
- Example: 30000
- Used by: backend adapter
- Meaning: TTL for successful query cache entries.
- Constraints: non-negative integer.
- UI help: ${MASSIVE_CONFIG_FIELD_HELP.queryCacheTtlMs}

### metadataCacheTtlMs

- Label: Metadata cache TTL ms
- Type: number
- Required: no
- Default: 300000
- Example: 300000
- Used by: backend adapter
- Meaning: TTL for selector resources and sanitized endpoint-catalog metadata.
- Constraints: non-negative integer.
- UI help: ${MASSIVE_CONFIG_FIELD_HELP.metadataCacheTtlMs}

### dedupeInFlight

- Label: Dedupe in-flight queries
- Type: boolean
- Required: no
- Default: true
- Example: true
- Used by: backend adapter
- Meaning: share one running provider request for identical cacheable Massive requests.
- Constraints: only dedupes identical safe requests.
- UI help: ${MASSIVE_CONFIG_FIELD_HELP.dedupeInFlight}

### apiKey

- Label: API key
- Type: secret
- Required: yes
- Default: none
- Example: provider secret value
- Used by: backend adapter
- Meaning: Massive API key sent as \`Authorization: Bearer <apiKey>\` by the backend.
- Constraints: write-only secureConfig field; never serialized back to the frontend, logs, cache keys, trace metadata, exceptions, or sanitized pagination URLs.
- UI help: ${MASSIVE_CONFIG_FIELD_HELP.apiKey}

## queryShape

- Request envelope: \`{ "requestedOutputContract": "core.tabular_frame@v1", "query": { "kind": "...", "pathParams": {}, "params": {} }, "maxRows": 5000, "cacheMode": "default" }\`
- \`query.kind\` must match one cataloged Massive query model.
- \`query.pathParams\` substitutes only catalog-declared path parameters.
- \`query.params\` contains provider query parameters allowed by the backend catalog for that endpoint.
- \`query.followPages=true\` lets the backend follow safe Massive pagination while the row budget remains.
- The adapter must never expose an arbitrary provider URL input.

## queryModels

The frontend manifest publishes one query model per catalog entry. All models return \`core.tabular_frame@v1\`, do not support variables, support request \`maxRows\`, and keep chart semantics out of \`meta.timeSeries\`.

${buildMassiveCatalogUsageMarkdown()}

## resources

### endpoint-catalog

- Payload: optional backend-owned filters derived from the connection config.
- Returns: sanitized backend endpoint catalog after enabled asset class, beta, and deprecated filters.

### query-models

- Payload: current connection config.
- Returns: backend-generated frontend query models for the current adapter catalog.

### asset-classes

- Payload: none.
- Returns: supported asset-class list.

### auth-status

- Payload: none.
- Returns: credential and entitlement status without exposing the API key.

## backendOwnership

- Backend owns credential decryption, bearer auth, requests-only provider HTTP calls, endpoint allowlisting, path and query parameter validation, pagination host validation, health checks, permissions, cache policy, cache-key dimensions, in-flight dedupe, entitlement errors, response normalization, and secret redaction.
- Backend implementation module: \`timeseries_orm/command_center/adapters/connections/massive_market_data.py\`.
- Generic routes only: \`/test/\`, \`/query/\`, and \`/resources/<resource>/\`.
- Query responses must contain exactly one \`core.tabular_frame@v1\` frame for widget-bound queries and must not set \`meta.timeSeries\`.
- Unsafe operations rejected by the backend include unknown kinds, unknown path params, unknown provider params, malformed dates, disabled asset classes, disabled beta/deprecated entries, arbitrary URL pass-through, unsafe \`next_url\` hosts, and credential leakage through logs or metadata.`;

export const massiveMarketDataConnection: ConnectionTypeDefinition<
  MassivePublicConfig,
  MassiveConnectionQuery
> = {
  id: MASSIVE_MARKET_DATA_CONNECTION_TYPE_ID,
  version: 1,
  title: "Massive Market Data",
  description:
    "Requests-only Massive REST market, reference, news, economic, partner, and alternative data.",
  iconUrl: massiveIconUrl,
  source: "finance",
  category: "Market Data",
  tags: [
    "finance",
    "massive",
    "stocks",
    "options",
    "crypto",
    "forex",
    "indices",
    "news",
    "economy",
  ],
  capabilities: ["query", "resource", "health-check"],
  accessMode: "proxy",
  publicConfigSchema: {
    version: 1,
    sections: [
      {
        id: "endpoint",
        title: "Endpoint",
        description: "Massive API host used by the backend adapter.",
      },
      {
        id: "catalog",
        title: "Catalog",
        description: "Enabled asset classes and endpoint-family gates.",
      },
      {
        id: "policy",
        title: "Runtime policy",
        description: "Timeout, row limit, cache, and in-flight de-duplication controls.",
      },
    ],
    fields: [
      {
        id: "baseUrl",
        sectionId: "endpoint",
        label: "Base URL",
        description: MASSIVE_CONFIG_FIELD_HELP.baseUrl,
        type: "string",
        required: false,
        defaultValue: "https://api.massive.com",
      },
      {
        id: "enabledAssetClasses",
        sectionId: "catalog",
        label: "Enabled asset classes",
        description: MASSIVE_CONFIG_FIELD_HELP.enabledAssetClasses,
        type: "json",
        required: true,
        defaultValue: [...DEFAULT_MASSIVE_ASSET_CLASSES],
      },
      {
        id: "enableBetaEndpoints",
        sectionId: "catalog",
        label: "Enable beta endpoints",
        description: MASSIVE_CONFIG_FIELD_HELP.enableBetaEndpoints,
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      {
        id: "enableDeprecatedEndpoints",
        sectionId: "catalog",
        label: "Enable deprecated endpoints",
        description: MASSIVE_CONFIG_FIELD_HELP.enableDeprecatedEndpoints,
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      {
        id: "defaultLimit",
        sectionId: "policy",
        label: "Default limit",
        description: MASSIVE_CONFIG_FIELD_HELP.defaultLimit,
        type: "number",
        required: false,
        defaultValue: 1000,
      },
      {
        id: "maxRows",
        sectionId: "policy",
        label: "Maximum rows",
        description: MASSIVE_CONFIG_FIELD_HELP.maxRows,
        type: "number",
        required: false,
        defaultValue: 50000,
      },
      {
        id: "requestTimeoutMs",
        sectionId: "policy",
        label: "Request timeout ms",
        description: MASSIVE_CONFIG_FIELD_HELP.requestTimeoutMs,
        type: "number",
        required: false,
        defaultValue: 10000,
      },
      {
        id: "queryCachePolicy",
        sectionId: "policy",
        label: "Query cache policy",
        description: MASSIVE_CONFIG_FIELD_HELP.queryCachePolicy,
        type: "select",
        required: false,
        defaultValue: "read",
        options: [
          { label: "Read", value: "read" },
          { label: "Disabled", value: "disabled" },
        ],
      },
      {
        id: "queryCacheTtlMs",
        sectionId: "policy",
        label: "Query cache TTL ms",
        description: MASSIVE_CONFIG_FIELD_HELP.queryCacheTtlMs,
        type: "number",
        required: false,
        defaultValue: 30000,
      },
      {
        id: "metadataCacheTtlMs",
        sectionId: "policy",
        label: "Metadata cache TTL ms",
        description: MASSIVE_CONFIG_FIELD_HELP.metadataCacheTtlMs,
        type: "number",
        required: false,
        defaultValue: 300000,
      },
      {
        id: "dedupeInFlight",
        sectionId: "policy",
        label: "Dedupe in-flight queries",
        description: MASSIVE_CONFIG_FIELD_HELP.dedupeInFlight,
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
        id: "apiKey",
        label: "API key",
        description: MASSIVE_CONFIG_FIELD_HELP.apiKey,
        type: "secret",
        required: true,
      },
    ],
  },
  queryModels: massiveQueryModels,
  requiredPermissions: ["connections:query"],
  configEditor: MassiveConnectionConfigEditor,
  exploreComponent: MassiveConnectionExplore,
  queryEditor: MassiveConnectionQueryEditor,
  usageGuidance,
  examples: [
    {
      title: "AAPL daily bars",
      publicConfig: {
        baseUrl: "https://api.massive.com",
        enabledAssetClasses: ["stocks"],
        enableBetaEndpoints: false,
        enableDeprecatedEndpoints: false,
        defaultLimit: 1000,
        maxRows: 50000,
        requestTimeoutMs: 10000,
        queryCachePolicy: "read",
        queryCacheTtlMs: 30000,
        metadataCacheTtlMs: 300000,
        dedupeInFlight: true,
      },
      query: {
        kind: "massive-stocks-custom-bars",
        pathParams: {
          stocksTicker: "AAPL",
          multiplier: 1,
          timespan: "day",
          from: "2026-01-01",
          to: "2026-04-26",
        },
        params: {
          adjusted: true,
          sort: "asc",
          limit: 5000,
        },
      },
    },
    {
      title: "Treasury yields",
      publicConfig: {
        enabledAssetClasses: ["economy"],
        queryCachePolicy: "read",
      },
      query: {
        kind: "massive-economy-treasury-yields",
        params: {
          limit: 1000,
        },
      },
    },
    {
      title: "Option chain snapshot",
      publicConfig: {
        enabledAssetClasses: ["options"],
      },
      query: {
        kind: "massive-options-chain-snapshot",
        pathParams: {
          underlyingAsset: "AAPL",
        },
      },
    },
  ],
};

export default massiveMarketDataConnection;
