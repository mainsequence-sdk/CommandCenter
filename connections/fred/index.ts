import type { ConnectionTypeDefinition } from "@/connections/types";
import fredLogoUrl from "@/connections/assets/fred-economic-data-logo.svg";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";

import { FredConnectionConfigEditor } from "./FredConnectionConfigEditor";
import { FredConnectionExplore } from "./FredConnectionExplore";
import { FredConnectionQueryEditor } from "./FredConnectionQueryEditor";

export const FRED_ECONOMIC_DATA_CONNECTION_TYPE_ID = "finance.fred-economic-data";

export type FredUnits = "lin" | "chg" | "ch1" | "pch" | "pc1" | "pca" | "cch" | "cca" | "log";
export type FredFrequency =
  | "d"
  | "w"
  | "bw"
  | "m"
  | "q"
  | "sa"
  | "a"
  | "wef"
  | "weth"
  | "wew"
  | "wetu"
  | "wem"
  | "wesu"
  | "wesa"
  | "bwew"
  | "bwem";
export type FredAggregationMethod = "avg" | "sum" | "eop";
export type FredQueryCachePolicy = "read" | "disabled";
export type FredSortOrder = "asc" | "desc";

export interface FredPublicConfig {
  baseUrl?: string;
  defaultSeriesId?: string;
  defaultUnits?: FredUnits;
  defaultFrequency?: FredFrequency | null;
  defaultAggregationMethod?: FredAggregationMethod;
  defaultLimit?: number;
  requestTimeoutMs?: number;
  queryCachePolicy?: FredQueryCachePolicy;
  queryCacheTtlMs?: number;
  metadataCacheTtlMs?: number;
  dedupeInFlight?: boolean;
}

export interface FredSecureConfig {
  apiKey?: string;
}

export type FredQueryKind = "fred-series-observations";

export interface FredConnectionQuery {
  kind?: FredQueryKind;
  seriesId?: string;
  units?: FredUnits;
  frequency?: FredFrequency | null;
  aggregationMethod?: FredAggregationMethod;
  realtimeStart?: string;
  realtimeEnd?: string;
  vintageDates?: string;
  limit?: number;
  offset?: number;
  sortOrder?: FredSortOrder;
}

const tabularOutputContracts = [CORE_TABULAR_FRAME_SOURCE_CONTRACT];

const usageGuidance = `## purpose

Connects widgets and Explore flows to Federal Reserve Economic Data through the backend adapter \`finance.fred-economic-data\`.

## whenToUse

- Use when a workspace needs macroeconomic, monetary, labor, inflation, rates, or regional economic time series from FRED.
- Use for backend-proxied FRED API Version 1 series observations and selector resources where the API key must remain encrypted server-side.

## whenNotToUse

- Do not use for exchange tick data, trading workflows, account access, or order execution.
- Do not use for FRED API Version 2 bulk release downloads until a separate adapter contract is added.
- Do not use browser-side provider SDKs or direct client requests that expose the FRED API key.

## configurationFields

### baseUrl

- Label: Base URL
- Type: string
- Required: no
- Default: https://api.stlouisfed.org
- Example: https://api.stlouisfed.org
- Used by: backend adapter
- Meaning: FRED API root used for all provider requests.
- Constraints: must be a URI; production should normally use the default host.
- UI help: FRED API root used by the backend adapter for all provider requests. Production default: https://api.stlouisfed.org.

### defaultSeriesId

- Label: Default series ID
- Type: string
- Required: no
- Default: GDP
- Example: UNRATE
- Used by: frontend and backend adapter
- Meaning: default FRED series id for query editors and backend defaults when query.seriesId is omitted.
- Constraints: backend rejects empty effective series ids before provider calls.
- UI help: Default FRED series id used by query editors and backend defaults when a query omits seriesId. Example: GDP.

### defaultUnits

- Label: Default units
- Type: string
- Required: no
- Default: lin
- Example: pch
- Used by: frontend and backend adapter
- Meaning: default FRED units transformation for observations.
- Constraints: must be one of lin, chg, ch1, pch, pc1, pca, cch, cca, or log.
- UI help: Default FRED units transformation when a query omits units. Use lin for levels.

### defaultFrequency

- Label: Default frequency
- Type: string or null
- Required: no
- Default: null
- Example: q
- Used by: frontend and backend adapter
- Meaning: optional default FRED frequency aggregation.
- Constraints: null keeps native frequency; non-null values must be FRED-supported frequency codes.
- UI help: Optional FRED frequency aggregation for observations when a query omits frequency. Leave blank to use the native provider frequency.

### defaultAggregationMethod

- Label: Default aggregation method
- Type: string
- Required: no
- Default: avg
- Example: eop
- Used by: frontend and backend adapter
- Meaning: default FRED aggregation method when frequency aggregation is requested.
- Constraints: must be avg, sum, or eop.
- UI help: FRED aggregation method used when frequency aggregation is requested and a query omits aggregationMethod.

### defaultLimit

- Label: Default limit
- Type: number
- Required: no
- Default: 1000
- Example: 1000
- Used by: frontend and backend adapter
- Meaning: default FRED observations page size.
- Constraints: integer from 1 to 100000; backend also clamps to request maxRows and provider caps.
- UI help: Default FRED observation page size. Valid range: 1 to 100000. The backend also respects request maxRows and provider caps.

### requestTimeoutMs

- Label: Request timeout ms
- Type: number
- Required: no
- Default: 10000
- Example: 15000
- Used by: backend adapter
- Meaning: HTTP timeout for FRED provider calls.
- Constraints: integer from 1000 to 30000.
- UI help: Backend HTTP timeout for FRED provider calls. Valid range: 1000 to 30000 milliseconds. Default: 10000.

### queryCachePolicy

- Label: Query cache policy
- Type: string
- Required: no
- Default: read
- Example: read
- Used by: backend adapter
- Meaning: successful observation-query caching behavior.
- Constraints: read or disabled; backend must not cache auth, permission, rate-limit, provider, or malformed-response failures.
- UI help: Backend FRED observation query cache policy. Use read for successful provider response caching or disabled to bypass query-result caching.

### queryCacheTtlMs

- Label: Query cache TTL ms
- Type: number
- Required: no
- Default: 900000
- Example: 900000
- Used by: backend adapter
- Meaning: TTL for successful observation query cache entries.
- Constraints: non-negative integer.
- UI help: Backend cache lifetime for successful FRED observation query responses in milliseconds. Default: 900000.

### metadataCacheTtlMs

- Label: Metadata cache TTL ms
- Type: number
- Required: no
- Default: 3600000
- Example: 3600000
- Used by: backend adapter
- Meaning: TTL for selector resources such as series search, series detail, vintage dates, and releases.
- Constraints: non-negative integer.
- UI help: Backend cache lifetime for FRED selector resources such as series search, releases, and vintage dates. Default: 3600000.

### dedupeInFlight

- Label: Dedupe in-flight identical queries
- Type: boolean
- Required: no
- Default: true
- Example: true
- Used by: backend adapter
- Meaning: share one running provider request for identical cacheable FRED requests.
- Constraints: only dedupes identical safe requests.
- UI help: When enabled, the backend shares one in-flight provider request for identical cacheable FRED requests. Default: true.

### apiKey

- Label: API key
- Type: secret
- Required: yes
- Default: none
- Example: provider secret value
- Used by: backend adapter
- Meaning: FRED API key sent as the provider api_key parameter by the backend.
- Constraints: write-only secureConfig field; never serialized back to the frontend, logs, cache keys, validation responses, or trace metadata.
- UI help: Write-only FRED API key. Stored in secure config and sent only by the backend provider adapter as the api_key parameter.

## queryModels

### fred-series-observations

- Payload: { "kind": "fred-series-observations", "seriesId": "UNRATE", "units": "lin", "frequency": null, "aggregationMethod": "avg", "sortOrder": "asc", "limit": 1000, "offset": 0 }
- Returns: exactly one core.tabular_frame@v1 with date, seriesId, value, valueRaw, realtimeStart, and realtimeEnd fields.
- Time-range-aware: yes. The request envelope timeRange maps to FRED observation_start and observation_end dates.
- Notes: value is numeric or null when FRED returns the missing-value marker "."; valueRaw preserves the provider string. The adapter must not set meta.timeSeries.

## resources

### series-search

- Payload: provider series search filters such as search_text, tag_names, limit, offset, and order_by.
- Returns: selector/detail metadata from /fred/series/search.

### series-detail

- Payload: { "series_id": "GDP" } or backend-equivalent series id parameter.
- Returns: provider series metadata from /fred/series.

### series-vintage-dates

- Payload: { "series_id": "GDP" } plus optional date filters.
- Returns: vintage dates from /fred/series/vintagedates.

### releases

- Payload: optional pagination and sorting filters.
- Returns: release metadata from /fred/releases.

### release-dates

- Payload: optional release date filters.
- Returns: release dates from /fred/releases/dates.

## backendOwnership

- Backend owns credential decryption, api_key injection, provider HTTP calls through requests, health checks, permissions, caching, cache keys, in-flight dedupe, pagination metadata, provider error translation, and response normalization.
- Generic routes only: /test/, /query/, and /resources/<resource>/.
- Health check verifies secureConfig.apiKey exists and baseUrl is reachable.
- Successful observation responses may be cached only when queryCachePolicy is read. Authentication failures, permission failures, rate limits, provider errors, and malformed responses must not cache.
- Backend must redact api_key from logs, trace metadata, cache keys, validation responses, and error details.`;

export const fredEconomicDataConnection: ConnectionTypeDefinition<
  FredPublicConfig,
  FredConnectionQuery
> = {
  id: FRED_ECONOMIC_DATA_CONNECTION_TYPE_ID,
  version: 1,
  title: "FRED Economic Data",
  description: "Requests-only FRED macroeconomic and regional time series.",
  source: "finance",
  category: "Economic Data",
  iconUrl: fredLogoUrl,
  tags: ["finance", "economics", "fred", "macro", "time-series"],
  capabilities: ["query", "resource", "health-check"],
  accessMode: "proxy",
  publicConfigSchema: {
    version: 1,
    sections: [
      {
        id: "endpoint",
        title: "Endpoint",
        description: "FRED API root used by the backend adapter.",
      },
      {
        id: "defaults",
        title: "Query defaults",
        description: "Default FRED series observation parameters.",
      },
      {
        id: "policy",
        title: "Runtime policy",
        description: "Timeout, cache, and in-flight de-duplication controls.",
      },
    ],
    fields: [
      {
        id: "baseUrl",
        sectionId: "endpoint",
        label: "Base URL",
        description:
          "FRED API root used by the backend adapter for all provider requests. Production default: https://api.stlouisfed.org.",
        type: "string",
        required: false,
        defaultValue: "https://api.stlouisfed.org",
      },
      {
        id: "defaultSeriesId",
        sectionId: "defaults",
        label: "Default series ID",
        description:
          "Default FRED series id used by query editors and backend defaults when a query omits seriesId. Example: GDP.",
        type: "string",
        required: false,
        defaultValue: "GDP",
      },
      {
        id: "defaultUnits",
        sectionId: "defaults",
        label: "Default units",
        description: "Default FRED units transformation when a query omits units. Use lin for levels.",
        type: "select",
        required: false,
        defaultValue: "lin",
        options: [
          { label: "lin", value: "lin" },
          { label: "chg", value: "chg" },
          { label: "ch1", value: "ch1" },
          { label: "pch", value: "pch" },
          { label: "pc1", value: "pc1" },
          { label: "pca", value: "pca" },
          { label: "cch", value: "cch" },
          { label: "cca", value: "cca" },
          { label: "log", value: "log" },
        ],
      },
      {
        id: "defaultFrequency",
        sectionId: "defaults",
        label: "Default frequency",
        description:
          "Optional FRED frequency aggregation for observations when a query omits frequency. Leave blank to use the native provider frequency.",
        type: "select",
        required: false,
        defaultValue: null,
        options: [
          { label: "Daily", value: "d" },
          { label: "Weekly", value: "w" },
          { label: "Biweekly", value: "bw" },
          { label: "Monthly", value: "m" },
          { label: "Quarterly", value: "q" },
          { label: "Semiannual", value: "sa" },
          { label: "Annual", value: "a" },
          { label: "Weekly, ending Friday", value: "wef" },
          { label: "Weekly, ending Thursday", value: "weth" },
          { label: "Weekly, ending Wednesday", value: "wew" },
          { label: "Weekly, ending Tuesday", value: "wetu" },
          { label: "Weekly, ending Monday", value: "wem" },
          { label: "Weekly, ending Sunday", value: "wesu" },
          { label: "Weekly, ending Saturday", value: "wesa" },
          { label: "Biweekly, ending Wednesday", value: "bwew" },
          { label: "Biweekly, ending Monday", value: "bwem" },
        ],
      },
      {
        id: "defaultAggregationMethod",
        sectionId: "defaults",
        label: "Default aggregation method",
        description:
          "FRED aggregation method used when frequency aggregation is requested and a query omits aggregationMethod.",
        type: "select",
        required: false,
        defaultValue: "avg",
        options: [
          { label: "Average", value: "avg" },
          { label: "Sum", value: "sum" },
          { label: "End of period", value: "eop" },
        ],
      },
      {
        id: "defaultLimit",
        sectionId: "policy",
        label: "Default limit",
        description:
          "Default FRED observation page size. Valid range: 1 to 100000. The backend also respects request maxRows and provider caps.",
        type: "number",
        required: false,
        defaultValue: 1000,
      },
      {
        id: "requestTimeoutMs",
        sectionId: "policy",
        label: "Request timeout ms",
        description:
          "Backend HTTP timeout for FRED provider calls. Valid range: 1000 to 30000 milliseconds. Default: 10000.",
        type: "number",
        required: false,
        defaultValue: 10000,
      },
      {
        id: "queryCachePolicy",
        sectionId: "policy",
        label: "Query cache policy",
        description:
          "Backend FRED observation query cache policy. Use read for successful provider response caching or disabled to bypass query-result caching.",
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
        description:
          "Backend cache lifetime for successful FRED observation query responses in milliseconds. Default: 900000.",
        type: "number",
        required: false,
        defaultValue: 900000,
      },
      {
        id: "metadataCacheTtlMs",
        sectionId: "policy",
        label: "Metadata cache TTL ms",
        description:
          "Backend cache lifetime for FRED selector resources such as series search, releases, and vintage dates. Default: 3600000.",
        type: "number",
        required: false,
        defaultValue: 3600000,
      },
      {
        id: "dedupeInFlight",
        sectionId: "policy",
        label: "Dedupe in-flight identical queries",
        description:
          "When enabled, the backend shares one in-flight provider request for identical cacheable FRED requests. Default: true.",
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
        description:
          "Write-only FRED API key. Stored in secure config and sent only by the backend provider adapter as the api_key parameter.",
        type: "secret",
        required: true,
      },
    ],
  },
  queryModels: [
    {
      id: "fred-series-observations",
      label: "Series Observations",
      description: "Fetch observations from /fred/series/observations.",
      outputContracts: tabularOutputContracts,
      defaultQuery: {
        kind: "fred-series-observations",
        seriesId: "GDP",
        units: "lin",
        sortOrder: "asc",
      },
      controls: [
        "seriesSearch",
        "seriesId",
        "timeRange",
        "units",
        "frequency",
        "aggregationMethod",
        "realtimeRange",
        "vintageDates",
        "limit",
        "offset",
        "sortOrder",
      ],
      timeRangeAware: true,
      supportsMaxRows: true,
    },
  ],
  requiredPermissions: ["connections:query"],
  configEditor: FredConnectionConfigEditor,
  exploreComponent: FredConnectionExplore,
  queryEditor: FredConnectionQueryEditor,
  usageGuidance,
  examples: [
    {
      title: "Unemployment observations",
      publicConfig: {
        baseUrl: "https://api.stlouisfed.org",
        defaultSeriesId: "GDP",
        defaultUnits: "lin",
        defaultFrequency: null,
        defaultAggregationMethod: "avg",
        defaultLimit: 1000,
        requestTimeoutMs: 10000,
        queryCachePolicy: "read",
        queryCacheTtlMs: 900000,
        metadataCacheTtlMs: 3600000,
        dedupeInFlight: true,
      },
      query: {
        kind: "fred-series-observations",
        seriesId: "UNRATE",
        units: "lin",
        frequency: null,
        aggregationMethod: "avg",
        sortOrder: "asc",
        limit: 1000,
        offset: 0,
      },
    },
  ],
};

export default fredEconomicDataConnection;
