import type { ConnectionTypeDefinition } from "@/connections/types";

import { MockApiConnectionQueryEditor } from "./MockApiConnectionQueryEditor";
import {
  DEFAULT_MOCK_API_RESPONSE_BODY,
  MOCK_API_CONNECTION_TYPE_ID,
  MOCK_API_CONNECTION_TYPE_VERSION,
  MOCK_API_QUERY_KIND,
  type MockApiConnectionQuery,
  type MockApiPublicConfig,
} from "./mock-api-contract";

export {
  MOCK_API_CONNECTION_TYPE_ID,
  MOCK_API_CONNECTION_TYPE_VERSION,
  MOCK_API_LOCAL_INSTANCE_ID,
  MOCK_API_QUERY_KIND,
  buildMockApiConnectionInstance,
  executeMockApiConnectionQuery,
  isMockApiConnectionId,
  isMockApiConnectionInstance,
  isMockApiConnectionRef,
  testMockApiConnection,
  withMockApiConnectionInstance,
  type MockApiConnectionQuery,
  type MockApiPublicConfig,
  type MockApiResponseMode,
} from "./mock-api-contract";

const usageGuidance = `## purpose

Provides a local-only Mock API connection for prototyping connection-query widgets, bindings, and Explore flows with user-authored JSON responses. It is always available in the frontend workspace and does not publish to the backend connection-type registry.

## whenToUse

- Use when building a widget or binding flow before a real backend adapter exists.
- Use when a user needs to paste sample JSON and see how the connection-query runtime consumes it.
- Use when testing error, latency, or response-shape handling without creating a production data source.

## whenNotToUse

- Do not use as a production data source.
- Do not use to verify backend adapter authorization, cache, in-flight dedupe, SSRF protection, or provider credentials.
- Do not use when the query must exercise the backend \`/connections/{id}/query/\` route.

## configurationFields

### defaultResponseBody

- Label: Default response JSON
- Type: json
- Required: no
- Default: a small three-row array with x, y, and label fields
- Example: [{ "x": 0, "y": 2, "label": "alpha" }]
- Used by: frontend mock executor
- Meaning: fallback response body used when a query does not provide its own response JSON.
- Constraints: must be valid JSON. The local executor never sends this value to the backend.
- UI help: Default JSON response used by the local mock executor when the query payload does not override it.

### defaultResponseStatus

- Label: Default response status
- Type: number
- Required: no
- Default: 200
- Example: 200
- Used by: frontend mock executor
- Meaning: fallback HTTP-like status code. Non-2xx statuses make the local mock query fail.
- Constraints: clamped to 100-599 by the local executor.
- UI help: HTTP-like status to simulate. 2xx returns a response; non-2xx throws a mock query error.

### defaultResponseMode

- Label: Default response mode
- Type: select
- Required: no
- Default: auto
- Example: auto
- Used by: frontend mock executor
- Meaning: controls how pasted JSON is interpreted.
- Constraints: one of auto, rows, tabular-frame, or connection-query-response.
- UI help: How the local mock executor interprets response JSON.

### latencyMs

- Label: Latency ms
- Type: number
- Required: no
- Default: 0
- Example: 250
- Used by: frontend mock executor
- Meaning: optional local delay before the mock response resolves.
- Constraints: clamped to a finite non-negative delay by the local executor.
- UI help: Optional local delay before the mock response resolves.

## queryModels

### mock-api-response

- Payload: { "kind": "mock-api-response", "responseMode": "auto", "responseStatus": 200, "responseBody": [{ "x": 0, "y": 2 }] }
- Returns: \`core.tabular_frame@v1\` by converting arrays or objects into rows. Full \`ConnectionQueryResponse\` payloads can also pass through when responseMode is \`connection-query-response\` or auto-detected.
- Time-range-aware: no.
- Notes: This query runs entirely in the browser. The query editor commits valid response JSON into the widget draft as the user types so normal widget dirty/save behavior works before blur; invalid JSON stays local with a parse error. It intentionally bypasses backend connection instance creation, registry sync, credentials, cache, and network IO.

## backendOwnership

- type_id: command_center.mock_api
- Backend ownership: none for this local-only connection type.
- The frontend owns the sentinel local instance, health check, query execution, response normalization, simulated errors, and simulated latency.
- This connection type is marked \`registrySync: "local-only"\` so it is excluded from backend connection-type publishing.
`;

export const mockApiConnection: ConnectionTypeDefinition<
  MockApiPublicConfig,
  MockApiConnectionQuery
> = {
  id: MOCK_API_CONNECTION_TYPE_ID,
  version: MOCK_API_CONNECTION_TYPE_VERSION,
  title: "Mock API",
  description:
    "Local-only JSON-backed mock connection for prototyping connection queries and widget bindings.",
  source: "command_center",
  category: "Developer Tools",
  tags: ["mock", "api", "json", "local", "test"],
  capabilities: ["query", "health-check"],
  accessMode: "browser",
  registrySync: "local-only",
  publicConfigSchema: {
    version: 1,
    sections: [
      {
        id: "response",
        title: "Response",
        description: "Default local mock response behavior.",
      },
    ],
    fields: [
      {
        id: "defaultResponseBody",
        sectionId: "response",
        label: "Default response JSON",
        description:
          "Default JSON response used by the local mock executor when the query payload does not override it.",
        type: "json",
        required: false,
        defaultValue: DEFAULT_MOCK_API_RESPONSE_BODY,
      },
      {
        id: "defaultResponseStatus",
        sectionId: "response",
        label: "Default response status",
        description:
          "HTTP-like status to simulate. 2xx returns a response; non-2xx throws a mock query error.",
        type: "number",
        required: false,
        defaultValue: 200,
      },
      {
        id: "defaultResponseMode",
        sectionId: "response",
        label: "Default response mode",
        description: "How the local mock executor interprets response JSON.",
        type: "select",
        required: false,
        defaultValue: "auto",
        options: [
          { label: "Auto detect", value: "auto" },
          { label: "Rows JSON", value: "rows" },
          { label: "Command Center frame", value: "tabular-frame" },
          { label: "Connection query response", value: "connection-query-response" },
        ],
      },
      {
        id: "latencyMs",
        sectionId: "response",
        label: "Latency ms",
        description: "Optional local delay before the mock response resolves.",
        type: "number",
        required: false,
        defaultValue: 0,
      },
    ],
  },
  queryModels: [
    {
      id: MOCK_API_QUERY_KIND,
      label: "Mock API response",
      description:
        "Returns user-authored JSON through the local Mock API connection executor.",
      outputContracts: ["core.tabular_frame@v1"],
      defaultOutputContract: "core.tabular_frame@v1",
      defaultQuery: {
        kind: MOCK_API_QUERY_KIND,
        responseMode: "auto",
        responseStatus: 200,
        latencyMs: 0,
        responseBody: DEFAULT_MOCK_API_RESPONSE_BODY,
      },
      controls: ["responseMode", "responseStatus", "latencyMs", "responseBody"],
      timeRangeAware: false,
      supportsVariables: false,
      supportsMaxRows: false,
    },
  ],
  requiredPermissions: [],
  queryEditor: MockApiConnectionQueryEditor,
  usageGuidance,
  examples: [
    {
      title: "Rows JSON",
      publicConfig: {
        defaultResponseBody: DEFAULT_MOCK_API_RESPONSE_BODY,
        defaultResponseStatus: 200,
        defaultResponseMode: "auto",
        latencyMs: 0,
      },
      query: {
        kind: MOCK_API_QUERY_KIND,
        responseMode: "auto",
        responseStatus: 200,
        responseBody: DEFAULT_MOCK_API_RESPONSE_BODY,
      },
    },
  ],
};

export function withMockApiConnectionType<T extends ConnectionTypeDefinition>(
  connectionTypes: T[],
): Array<T | typeof mockApiConnection> {
  if (connectionTypes.some((connectionType) => connectionType.id === MOCK_API_CONNECTION_TYPE_ID)) {
    return connectionTypes;
  }

  return [mockApiConnection, ...connectionTypes];
}

export default mockApiConnection;
