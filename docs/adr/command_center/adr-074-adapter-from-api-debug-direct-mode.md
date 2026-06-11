# ADR 074: Adapter From API Debug Direct Mode

- Status: Accepted and initially implemented
- Date: 2026-06-10
- Related:
  - [ADR: AdapterFromApi Dynamic OpenAPI Connection](./adr-adapter-from-api-connection.md)
  - [ADR: Connection-First Workspace Dataflow](./adr-connection-first-workspace-dataflow.md)
  - [ADR: Managed Connection Query Sources for Consumer Widgets](./adr-managed-connection-query-widget-sources.md)
  - [ADR: Runtime Credential Browser Auth](./adr-runtime-credential-browser-auth.md)

## Context

`command_center.adapter_from_api` currently assumes one execution path:

```text
Command Center browser -> Command Center backend -> upstream API
```

That is correct for production because the backend owns contract discovery, secret storage,
credential injection, operation allowlists, cache/dedupe, health checks, and response
normalization.

There is a development gap. While building a workspace against a local API, the upstream API root
may be a browser-reachable debug server such as:

```text
http://127.0.0.1:8021
```

The Command Center backend intentionally rejects that host through the Adapter From API
private-network policy. Even when the policy is relaxed, the backend process may not be able to
reach the same loopback address because `127.0.0.1` means the backend host/container, not the
developer's browser machine.

The desired workflow is:

1. A user creates one Adapter From API connection.
2. During development, the connection can execute directly from the browser against a debug API
   root.
3. Workspace widgets reference that same connection instance and keep the same query payloads.
4. When the user switches the connection back to backend/proxy mode, widgets do not need to be
   rebound or reconfigured.

This must not create a new connection type such as `mainsequence.markets`. The connection remains
`command_center.adapter_from_api`.

## Decision

Add a switchable execution transport to `command_center.adapter_from_api`.

The same persisted connection instance supports two modes:

- `backend`: current production behavior. The browser calls Command Center backend connection
  endpoints, and the backend calls the upstream API.
- `direct`: debug behavior. The browser calls the configured debug API root directly for query and
  health execution, and resolves operation metadata from the saved compiled contract instead of
  backend resource execution.

The workspace-facing identity does not change:

- connection type id remains `command_center.adapter_from_api`
- connection instance id remains unchanged
- widget `connectionRef` remains unchanged
- query payloads continue to use `kind = "api-operation"` and `operationId`
- widget-facing responses remain the same `ConnectionQueryResponse` contracts, including
  `core.tabular_frame@v1`

Switching modes is a property of the connection instance, not a widget migration. Direct mode is a
transport switch and debug root override; it must not create a different widget data contract.

## Public Config Additions

Extend `AdapterFromApiPublicConfig` with:

```ts
type AdapterFromApiTransportMode = "backend" | "direct";

interface AdapterFromApiPublicConfig {
  apiBaseUrl?: string;
  debugApiBaseUrl?: string;
  transportMode?: AdapterFromApiTransportMode;
  compiledContract?: AdapterFromApiCompiledContract;
  compiledContractSource?: "backend" | "direct";
  compiledContractSourceUrl?: string;
}
```

Field semantics:

- `transportMode`
  - Label: Execution mode
  - Type: select or segmented control
  - Required: no
  - Default: `backend`
  - Example: `direct`
  - Used by: frontend and backend
  - Meaning: selects whether execution goes through Command Center backend or directly from the
    browser.
  - Constraint: missing value is treated as `backend` for backward compatibility.
  - UI help: Choose Backend Proxy for production execution through Command Center, or Debug Direct
    to call the API root from this browser during development.

- `apiBaseUrl`
  - Label: Backend API root URL
  - Type: string
  - Required: required when `transportMode = "backend"`
  - Default: none
  - Example: `https://markets-api.example.com`
  - Used by: backend adapter
  - Meaning: upstream API root reachable from the Command Center backend.
  - Constraint: backend SSRF/private-network policy applies.
  - UI help: API root used by the backend Adapter From API runtime.

- `debugApiBaseUrl`
  - Label: Debug direct API root
  - Type: string
  - Required: required when `transportMode = "direct"`
  - Default: none
  - Example: `http://127.0.0.1:8021`
  - Used by: frontend direct runtime only
  - Meaning: API root called directly from the browser while debugging.
  - Constraint: never fetched by the Command Center backend; browser CORS rules apply.
  - UI help: Browser-only API root for debug mode. This can be localhost because Command Center
    backend does not call it.

- `compiledContractSource`
  - Label: Contract source
  - Type: string metadata
  - Required: no
  - Default: `backend`
  - Example: `direct`
  - Used by: frontend and backend validation
  - Meaning: records whether the current compiled contract snapshot came from backend discovery or
    browser direct discovery.
  - Constraint: backend mode must recompute and overwrite the contract server-side before backend
    execution.

- `compiledContractSourceUrl`
  - Label: Contract source URL
  - Type: string metadata
  - Required: no
  - Default: none
  - Example: `http://127.0.0.1:8021/.well-known/command-center/connection-contract`
  - Used by: frontend display and diagnostics
  - Meaning: source URL used to create the current compiled contract snapshot.
  - Constraint: diagnostic only; not authoritative for backend execution.

Existing config remains valid. Existing connections with no `transportMode` continue to run through
the backend.

## Runtime Behavior

### Backend Mode

Backend mode keeps the current behavior:

```text
browser -> /connections/{id}/query/ -> backend adapter -> apiBaseUrl
```

Rules:

- backend derives `contractDefinitionUrl` and `openApiUrl` from `apiBaseUrl`
- backend fetches and validates the well-known contract
- backend validates public config and secure config
- backend owns secret injection, operation allowlists, cache, dedupe, health checks, and response
  normalization
- backend stores `compiledContractSource = "backend"`

### Direct Mode

Direct mode bypasses backend execution:

```text
browser -> debugApiBaseUrl
```

Rules:

- browser discovers the contract from
  `{debugApiBaseUrl}/.well-known/command-center/connection-contract`
- browser compiles/sanitizes the contract using the same contract shape as the backend snapshot
- browser stores that snapshot through the normal connection instance save path with
  `compiledContractSource = "direct"`
- query execution uses the saved `compiledContract` and `debugApiBaseUrl`
- the browser builds the HTTP request from the selected operation contract
- path/query/header/body parameters are validated in the frontend before sending
- browser fetch uses `credentials: "omit"`
- response mapping is applied in the frontend so widgets still receive the same connection result
  shape
- for the same raw response and response mapping, direct mode must produce the same
  `ConnectionQueryResponse` as backend mode
- backend-stored `secureConfig.secretValues` are not available to direct mode and must not be
  exposed to the browser
- direct mode does not attach Command Center-managed auth headers, tokens, or credentials

Direct mode supports APIs that are intentionally browser-callable during development:

- local unauthenticated APIs
- APIs with explicit CORS support for the Command Center origin

Direct mode does not support auth. It never injects backend-stored secrets, local-only auth
headers, bearer tokens, API keys, runtime credential browser auth, cookies, or any other Command
Center-managed credential. User-configurable Authorization, cookie, API-key, and auth-token
headers are rejected.

## Example: `/root/get_information`

Assume the discovered Adapter From API contract declares this operation:

```json
{
  "operationId": "getInformation",
  "method": "GET",
  "path": "/root/get_information",
  "kind": "query",
  "responseMappings": [
    {
      "id": "information_table",
      "contract": "core.tabular_frame@v1",
      "rowsPath": "$.results"
    }
  ]
}
```

Widgets and Explore use the same Command Center query payload in both transport modes:

```json
{
  "kind": "api-operation",
  "operationId": "getInformation",
  "parameters": {
    "path": {},
    "query": {},
    "headers": {}
  },
  "body": null,
  "responseMappingId": "information_table"
}
```

### Backend Mode Execution

Connection config:

```json
{
  "transportMode": "backend",
  "apiBaseUrl": "https://markets-api.example.com"
}
```

Execution path:

```text
widget / Explore
  -> POST /connections/{connectionId}/query/
    -> Command Center backend Adapter From API runtime
      -> GET https://markets-api.example.com/root/get_information
        -> backend maps response to core.tabular_frame@v1
          -> widget receives ConnectionQueryResponse
```

Backend mode owns:

- backend reachability to `apiBaseUrl`
- backend private-network policy
- backend secret injection
- backend cache and in-flight dedupe
- backend response mapping

The browser never calls `https://markets-api.example.com/root/get_information` directly.

### Direct Mode Execution

Connection config:

```json
{
  "transportMode": "direct",
  "debugApiBaseUrl": "http://127.0.0.1:8021"
}
```

Execution path:

```text
widget / Explore
  -> frontend Adapter From API direct runtime
    -> GET http://127.0.0.1:8021/root/get_information
      -> frontend maps response to core.tabular_frame@v1
        -> widget receives ConnectionQueryResponse
```

Direct mode owns:

- browser reachability to `debugApiBaseUrl`
- browser CORS behavior
- no Command Center-managed auth headers or credentials
- frontend response mapping

The Command Center backend query endpoint is not called for this query in direct mode. The backend
only stores the connection instance and its direct-mode compiled contract snapshot.

## Response Contract Invariant

Direct mode must preserve the backend-mode widget contract. It is not a second response format.

For example, if `/root/get_information` returns:

```json
{
  "results": [
    { "name": "AAPL", "price": 190.2 },
    { "name": "MSFT", "price": 420.5 }
  ]
}
```

then both backend mode and direct mode must publish:

```json
{
  "frames": [
    {
      "contract": "core.tabular_frame@v1",
      "fields": [
        { "name": "name", "type": "string", "values": ["AAPL", "MSFT"] },
        { "name": "price", "type": "number", "values": [190.2, 420.5] }
      ]
    }
  ]
}
```

Implementation must include parity fixtures for direct and backend response mapping. The fixture
assertion is part of the contract: same raw upstream response plus same `responseMappingId` must
produce the same normalized `ConnectionQueryResponse`.

## Registration And Discovery Flow

The current create/update path always calls backend discovery for Adapter From API. That must
change for direct mode.

### Backend Mode Save

When `transportMode` is missing or `backend`:

1. Backend validates `apiBaseUrl`.
2. Backend fetches the well-known contract.
3. Backend overwrites `compiledContract`, `contractDefinitionUrl`, and `openApiUrl`.
4. Backend validates public and secure config against the backend-compiled contract.
5. Backend persists the connection.

### Direct Mode Save

When `transportMode = "direct"`:

1. Frontend validates `debugApiBaseUrl`.
2. Frontend fetches the well-known contract directly from the browser.
3. Frontend compiles/sanitizes the contract snapshot.
4. Frontend submits `debugApiBaseUrl`, `compiledContract`, `compiledContractSource = "direct"`,
   and public `configValues`.
5. Backend validates the shape of the submitted direct contract and public config values, and
   rejects submitted direct-mode `secureConfig.secretValues`.
6. Backend must not fetch `debugApiBaseUrl`.
7. Backend persists the connection for browser-direct execution.

This is a backend persistence contract change, but not a new backend adapter runtime.

## Frontend Implementation Plan

1. Extend `AdapterFromApiPublicConfig`.
2. Extend the static public config schema with `transportMode` and `debugApiBaseUrl`.
3. Update `AdapterFromApiConnectionConfigEditor`:
   - add a segmented control or select with `Backend Proxy` and `Debug Direct`
   - show `apiBaseUrl` in backend mode
   - show `debugApiBaseUrl` in direct mode
   - add a discovery/test button for the selected mode
   - show a visible `Direct Debug` badge when direct mode is active
4. Add a frontend direct discovery helper:
   - fetch the well-known contract from the browser
   - reject redirects
   - add a client-side response-size limit as a follow-up hardening task
   - validate JSON shape
   - normalize the compiled contract into the existing `AdapterFromApiCompiledContract` shape
5. Add a frontend direct execution helper:
   - resolve operation by `operationId`
   - validate path/query/header/body values
   - build a browser `fetch` request to `debugApiBaseUrl`
   - apply response mapping to produce `ConnectionQueryResponse`
6. Add a frontend connection execution router used by Explore and workspace runtimes:
   - if connection type is `command_center.adapter_from_api` and `transportMode = "direct"`, use
     direct execution
   - otherwise use the existing backend `queryConnection` and `testConnection` APIs
   - keep direct-mode resource metadata local from the saved compiled contract whenever possible
7. Keep widget settings and widget query payloads unchanged.
8. Update Adapter From API `usageGuidance` and README with the new mode and field-level behavior.

## Backend Implementation Plan

1. Extend Adapter From API public config validation to understand `transportMode`.
2. In create/update serialization:
   - keep current `prepare_adapter_from_api_config` path for backend mode
   - add a direct-mode preparation path that validates submitted direct contract shape without
     server-side discovery
3. Persist `debugApiBaseUrl`, `transportMode`, `compiledContractSource`, and
   `compiledContractSourceUrl`.
4. Reject backend query/resource/test execution for direct-mode instances with a clear error such
   as:

   ```text
   This Adapter From API connection is in direct debug mode and must be executed by the browser.
   ```

5. When switching from direct mode to backend mode, backend must recompute `compiledContract` from
   `apiBaseUrl`; it must not trust the direct-mode contract snapshot for backend execution.
6. Keep backend private-network policy unchanged for backend mode.

## Workspace Persistence Impact

Workspace storage should not change.

The persisted workspace already references connection instances by `connectionRef`:

```json
{
  "id": "connection-instance-uid",
  "typeId": "command_center.adapter_from_api"
}
```

Widgets keep the same reference when the connection switches modes. The connection instance
configuration changes, not the workspace graph.

Connection instance storage does change because new public config keys are persisted:

- `transportMode`
- `debugApiBaseUrl`
- `compiledContractSource`
- `compiledContractSourceUrl`

Backward compatibility rule:

- missing `transportMode` means `backend`
- missing `debugApiBaseUrl` is valid in backend mode
- direct mode requires `debugApiBaseUrl`

## Security And Operational Constraints

- Direct mode is for development and debugging.
- Direct mode is not separately permission-gated. Any user who can create or edit the Adapter From
  API connection instance can select `Debug Direct`.
- `debugApiBaseUrl` is persisted on the backend connection instance as shared public config.
- There is no per-user direct-mode override in this design.
- Direct mode cannot use backend-stored secrets, local-only auth headers, bearer tokens, API keys,
  runtime credential browser auth, or any other Command Center-managed auth mechanism.
- Direct mode relies on browser CORS behavior.
- Direct mode may behave differently for different users when `debugApiBaseUrl` is localhost,
  because each browser resolves localhost independently.
- Shared workspaces using direct mode are only reproducible for users who run a compatible local
  API at the same debug root.
- Backend mode remains the production path.
- Backend mode remains the only mode with backend secret injection, backend cache/dedupe, backend
  permission checks around provider calls, and backend SSRF policy.

## Acceptance Criteria

- A user can configure an Adapter From API connection in backend mode exactly as today.
- A user can switch the same connection instance to direct mode and set
  `debugApiBaseUrl = "http://127.0.0.1:8021"`.
- Direct mode discovery fetches the well-known contract from the browser, not from the backend.
- Direct mode query execution calls `debugApiBaseUrl` from the browser, not the backend query
  endpoint.
- Widgets using the connection keep the same `connectionRef` when switching modes.
- Switching back to backend mode does not require widget changes.
- For the same raw response and response mapping, direct mode emits the same
  `ConnectionQueryResponse` as backend mode.
- Backend mode still rejects private-network `apiBaseUrl` unless backend policy allows it.
- Backend never receives or exposes backend-stored secrets for direct browser execution.
- Direct mode does not add any auth-header UI or browser session-storage token flow.
- Backend rejects direct-mode query/test/resource execution if a caller hits backend endpoints
  directly.

## Implementation Tasks

- [Task 001: Backend Direct Mode Persistence Contract](../../implementation_tasks/adapter-from-api-debug-direct/task-001-backend-direct-mode-persistence.md)
- [Task 002: Frontend Config And Direct Discovery](../../implementation_tasks/adapter-from-api-debug-direct/task-002-frontend-config-and-direct-discovery.md)
- [Task 003: Direct Execution Runtime And Workspace Routing](../../implementation_tasks/adapter-from-api-debug-direct/task-003-direct-execution-runtime-and-workspace-routing.md)

## Rejected Alternatives

### Create A New Main Sequence Markets Connection Type

Rejected. It adds backend dispatch complexity and does not solve the core need. The problem is
transport selection on `Adapter From API`, not a new branded connection.

### Allow Backend Private Hosts Globally

Rejected as the primary solution. It weakens backend SSRF protection and still does not solve
container/host loopback ambiguity.

### Store Debug Mode In Widget Settings

Rejected. It would force widget rewiring and would make switching between debug and backend modes a
workspace migration. Transport mode belongs to the connection instance.

## Open Questions

No open questions remain for this ADR.
