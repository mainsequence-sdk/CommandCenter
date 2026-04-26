# ADR: AdapterFromApi Dynamic OpenAPI Connection

- Status: Proposed
- Date: 2026-04-26
- Related:
  - [ADR: First-Class Connection Model](./adr-first-class-connection-model.md)
  - [ADR: Standardized Connection Result Contracts](./adr-standardized-connection-result-contracts.md)
  - [ADR: Connection-First Workspace Dataflow](./adr-connection-first-workspace-dataflow.md)
  - [ADR: AppComponent as a Binding-Native API Widget](./adr-app-component-binding-native-api-widget.md)
  - [ADR: Shared AppComponent Discovery and Safe-Response Caching](./adr-app-component-caching.md)

## Context

Command Center now has two relevant systems:

- `AppComponent` can discover OpenAPI operations and render dynamic request forms from API
  definitions.
- Connections model backend-owned data access, secrets, health checks, query execution, resources,
  caching, and normalized widget-bound responses.

The missing piece is a generic connection that can be configured from an API definition without
writing a bespoke adapter for every provider. The user should be able to provide one API root URL,
let Command Center inspect a contract derived from OpenAPI, configure required public and secret
variables, then use the resulting connection from Explore and workspace source widgets.

This must not turn the browser into the provider client. Connection queries still go through the
Command Center backend. The backend stores secret values, injects credentials, enforces operation
allowlists, applies cache/dedupe policy, calls the upstream API, and passes the upstream response
back through the connection route.

## Decision

We will plan a new generic connection called `AdapterFromApi`.

The final connection type id must be chosen only after reviewing backend registered connection
types and adapter ids. The working id for this ADR is:

```text
command_center.adapter_from_api
```

The connection is a backend-routed dynamic adapter:

- a single static frontend `ConnectionTypeDefinition` provides the catalog entry and setup shell
- a custom config editor discovers and renders API-provided config and secret fields
- the backend fetches and validates the API contract
- the backend stores public config and secure config for each configured instance
- query execution always routes through the backend adapter
- the adapter calls only operations declared in the API contract
- operation responses are passed back through the backend mirror/proxy route

The design intentionally borrows from `AppComponent` OpenAPI compilation, but the runtime ownership
is different. `AppComponent` is a widget-level API UI. `AdapterFromApi` is a connection-level,
backend-owned data access adapter.

## 1. Command Center Implementation Plan

### 1.1 Frontend Connection Type

Add one generic connection definition after backend id review.

Initial metadata:

```ts
{
  id: "command_center.adapter_from_api",
  title: "Adapter From API",
  source: "command_center",
  category: "APIs",
  capabilities: ["query", "resource", "health-check"],
  accessMode: "proxy",
}
```

The static schema should include only bootstrap fields that are needed before contract discovery:

- required `apiBaseUrl`
- derived `contractDefinitionUrl` and `openApiUrl` for observability and compatibility
- optional `contractVersion` pin
- backend timeout/cache/dedupe policy fields

Provider-specific public variables and secrets are not statically known. They are rendered by a
custom config editor from the discovered contract and then saved through the normal backend
connection create/update path.

### 1.2 Dynamic Contract Discovery

The config editor should not fetch arbitrary API URLs directly from the browser. The backend must
own discovery.

Discovery flow:

1. user enters `apiBaseUrl`
2. frontend may derive `{apiBaseUrl}/openapi.json` and
   `{apiBaseUrl}/.well-known/command-center/connection-contract` for display, but the backend must
   derive these URLs again server-side and must not trust browser-provided discovery URLs
3. create/update or an optional preview helper asks the backend to discover the contract
4. backend validates that `apiBaseUrl` is an absolute `http` or `https` URL, rejects query strings
   and fragments, normalizes trailing slashes, and may allow a path prefix when the API root is not
   the origin root
5. backend applies SSRF, scheme, host, timeout, redirect, and response-size controls
6. backend fetches `/.well-known/command-center/connection-contract`; if that endpoint is
   unavailable or invalid, discovery fails
7. backend may fetch `/openapi.json` only as supporting metadata when the well-known contract points
   to it or when backend compilation needs schema details, but OpenAPI is not the discovery
   contract in the first slice
8. backend normalizes the source document into one sanitized compiled contract
9. backend writes the sanitized compiled contract back to `publicConfig.compiledContract`, writes
   the derived `contractDefinitionUrl` and `openApiUrl`, and persists public/secure values after
   validating them against the compiled contract
10. frontend renders public config fields and secure-config instructions from the stored compiled
   contract snapshot

The backend must treat any browser-supplied `compiledContract` JSON as untrusted preview data. On
create and update, the backend must recompute the authoritative compiled contract from
`apiBaseUrl`/`contractVersion` and overwrite any stale or user-edited client copy before
persistence.

The backend must keep a compiled contract snapshot with the instance so query rendering and runtime
execution do not depend on refetching the upstream OpenAPI document on every screen load. The first
slice should store that sanitized snapshot in `publicConfig.compiledContract` because the frontend
already treats that field as the source of dynamic config and query UI.

### 1.3 Instance-Scoped Query Models

`AdapterFromApi` needs query models derived from a configured API contract. Static
`ConnectionTypeDefinition.queryModels` is not enough by itself because each configured API exposes
different operations.

Plan:

- first slice may expose one static query model, `api-operation`, and let the custom `queryEditor`
  render operation selection and operation-specific inputs from the instance contract
- target architecture should add instance-scoped query model resolution to the connection workbench,
  similar to AppComponent's instance-scoped resolved IO
- resolved query models must be pure and derived from the sanitized compiled contract already
  present on the selected `ConnectionInstance` or loaded through a backend resource endpoint
- graph/workbench code must not fetch upstream OpenAPI documents directly

Potential target frontend hook:

```ts
resolveQueryModels?: (args: {
  connectionInstance: ConnectionInstance;
  connectionType: ConnectionTypeDefinition;
}) => ConnectionQueryModel[];
```

If this resolver is added, `ConnectionQueryWorkbench` should prefer resolved instance models and
fall back to static `queryModels`.

### 1.4 Query Editor

The `AdapterFromApi` query editor should render from the compiled operation contract:

- operation selector
- path parameters
- query parameters
- header parameters that are safe/user-configurable
- request body fields
- variables supported by the operation
- max rows when the operation supports result limits
- response contract selection when multiple mappings are available

The query payload should not contain raw URLs or credentials.

Example query payload:

```ts
{
  "kind": "api-operation",
  "operationId": "listOrders",
  "parameters": {
    "path": {},
    "query": { "status": "open" },
    "headers": {}
  },
  "body": null,
  "responseMappingId": "orders_table"
}
```

### 1.5 Backend Adapter

The backend adapter is the runtime owner.

The backend behavior must be explicit and deterministic. The adapter implementation should follow
the rules below rather than treating the contract as advisory text.

#### 1.5.1 Discovery Input And Derivation

- The authoritative discovery input is `publicConfig.apiBaseUrl`.
- `publicConfig.contractDefinitionUrl` and `publicConfig.openApiUrl` are derived values. The
  backend must recompute them from `apiBaseUrl` and ignore client overrides.
- `apiBaseUrl` must be an absolute `http` or `https` URL. Reject opaque URLs, relative URLs, query
  strings, and fragments. A path prefix is allowed only when the backend supports a non-root API
  base.
- Normalize `apiBaseUrl` before use by trimming whitespace and removing trailing slashes, except
  for a bare scheme while the user is still typing in the frontend.
- Derive:
  - `contractDefinitionUrl = {apiBaseUrl}/.well-known/command-center/connection-contract`
  - `openApiUrl = {apiBaseUrl}/openapi.json`

#### 1.5.2 Discovery Fetch And Compilation

- Fetch the well-known contract from `contractDefinitionUrl`.
- If the well-known contract is unavailable or invalid, reject the create/update request with a
  clear validation error. Do not persist the instance with an empty or partial compiled contract.
- Apply SSRF controls to both fetches:
  - allow only approved schemes and hosts
  - disallow private-network hops unless explicitly allowlisted
  - do not follow redirects to a host that would fail the same allowlist check
  - enforce timeout and response-size limits
- `openApiUrl` is supplementary metadata only. The backend may fetch it after a valid well-known
  contract is loaded, but it must not treat `openapi.json` as an alternative source of truth for
  adapter discovery in the first slice.
- Normalize the discovery source into one sanitized compiled contract with at least:
  - `contractVersion`
  - `adapter`
  - `openapi`
  - `configVariables`
  - `secretVariables`
  - `availableOperations`
  - optional `health`
- Compute a stable checksum for the compiled contract or the normalized discovery source and keep it
  with the stored snapshot for cache invalidation and auditability.

#### 1.5.3 Create And Update Persistence

- On `POST` and `PATCH`, the backend must validate `configValues` against
  `compiledContract.configVariables`.
- Unknown keys must be rejected.
- Missing required public values must be rejected unless the compiled contract provides a default.
- Type validation must use the compiled contract semantic type (`string`, `number`, `boolean`,
  `select`, `json`, `secret`) and any declared validation constraints such as `pattern`, enum
  options, or numeric bounds.
- Dynamic secrets must be validated against `compiledContract.secretVariables`.
- On `POST`, all required secrets must be present.
- On `PATCH`, omitted secrets keep the existing stored value. Explicit clearing of a required secret
  must be rejected.
- Raw secret values must be written only to the backend secret store. They must not be returned in
  the connection instance payload, logs, traces, cache keys, or error bodies.
- The persisted connection instance returned to the frontend must include:
  - normalized `apiBaseUrl`
  - derived `contractDefinitionUrl`
  - derived `openApiUrl`
  - sanitized `compiledContract`
  - public `configValues`
  - `secureFields` metadata only, never decrypted secret values

#### 1.5.4 Query Validation

- Query execution must load the stored connection instance by backend `id`, not `uid`.
- The backend must read the stored compiled contract snapshot attached to that instance. Query
  execution must not refetch upstream discovery documents.
- `query.kind` must equal `api-operation`.
- `operationId` must exist in `compiledContract.availableOperations`.
- The selected operation must advertise query capability (`kind: "query"` or
  `capabilities` containing `query`).
- `responseMappingId`, when provided, must exist on the selected operation. If it is omitted and
  the operation exposes mappings, the backend may default to the first declared mapping.
- The frontend must not be allowed to override method, path, host, auth injection point, or raw
  request URL. Those come only from the compiled contract.
- `parameters.path`, `parameters.query`, and `parameters.headers` may contain only keys declared for
  the selected operation and location.
- Header parameters must be limited to fields explicitly declared as user-configurable. Credential
  headers must never be accepted from query payloads.
- `body` must validate against the operation request-body schema when one exists; if the operation
  has no request body contract, a non-null body must be rejected.
- `maxRows`, if supported, must be clamped to the smaller of:
  - the operation contract limit
  - the connection runtime policy
  - any global deployment maximum
- Top-level `timeRange` may influence execution only when the selected operation explicitly declares
  that it requires or supports time-range inputs. Otherwise the backend should ignore it rather than
  inventing provider parameters.

#### 1.5.5 Upstream Request Construction

- Start from the compiled contract's declared method, path, and server/base URL.
- Substitute validated path parameters.
- Append validated query parameters.
- Add validated user-configurable headers.
- Serialize the validated request body using the declared content type.
- Inject credentials only through the declared secret-variable injection rules after payload
  validation succeeds.
- Provider requests must use the effective timeout from the connection instance, clamped to a
  deployment maximum.
- If the compiled contract declares a host or server set that differs from `apiBaseUrl`, the
  backend must reject the request unless that alternate host also passes the allowlist policy.

#### 1.5.6 Mirror / Pass-Through Response Handling

- The backend should act as a mirror/proxy between Command Center and the upstream API.
- After the backend validates the selected operation and builds the upstream request, query
  execution should mean one thing: the backend performs that API request and returns the upstream
  response back through the Command Center connection route.
- The backend must not perform hot-path response-contract validation against `responseMappings`,
  `outputContracts`, JSONPath row extraction, or schema coercion before returning the response.
- `responseMappings` and `responseMappingId` are optional metadata for frontend tooling and future
  transforms. They are not runtime guarantees that the backend must validate against every
  response.
- The backend may wrap the response in the platform's normal `ConnectionQueryResponse` envelope, but
  the response body itself should pass through without expensive contract validation or reshaping.
- Redacted diagnostic metadata may include operation id, status code, content type, and contract
  checksum. It must not include secrets or credential-bearing headers.

#### 1.5.7 Cache And In-Flight Dedupe

- Discovery caching and query-result caching are separate concerns.
- Discovery-cache keys should include at least:
  - organization
  - auth scope
  - normalized `apiBaseUrl`
  - `contractVersion` pin
  - discovery-source checksum when available
- Query-result cache keys should include at least:
  - organization
  - auth scope
  - connection `id`
  - connection `type_id`
  - compiled-contract checksum or version
  - `operationId`
  - `responseMappingId`
  - sanitized path/query/header/body payload
  - effective public config values
  - time range
  - max rows
- Query caches and in-flight joins must exclude raw secret values.
- In-flight dedupe must happen only after permission checks succeed.
- Cache only successful pass-through responses for operations whose effective cache policy is `safe`.
- Never cache permission denials, auth failures, contract-validation failures, rate-limit responses,
  timeouts, or malformed upstream responses.

#### 1.5.8 Health Checks

- `testConnection(id)` must use the stored compiled contract's health strategy.
- If the contract declares `health.operationId`, execute that operation with its static/default
  parameters using the same validation and credential-injection rules as normal execution.
- If the health strategy declares an expected status, enforce it.
- If no health strategy is declared, return an explicit unsupported/unknown result instead of
  inventing a provider probe that the contract did not authorize.

Query execution path:

```text
widget/explore -> Command Center backend /connections/{id}/query/
  -> AdapterFromApi backend adapter
  -> upstream API operation declared by contract
  -> upstream response passed back through Command Center
```

The browser never calls the upstream API directly for connection queries.

### 1.6 Backend Resources

When the adapter exposes helper resources, the payloads and semantics should be concrete:

- `contract-definition`
  - purpose: preview discovery without saving, or re-run discovery for an existing instance
  - input: `{ "apiBaseUrl": "https://api.example.com", "contractVersion": "optional-pin" }`
  - output:
    ```json
    {
      "apiBaseUrl": "https://api.example.com",
      "contractDefinitionUrl": "https://api.example.com/.well-known/command-center/connection-contract",
      "openApiUrl": "https://api.example.com/openapi.json",
      "compiledContract": {}
    }
    ```
  - notes: output must be sanitized and must match the same discovery algorithm used by
    create/update persistence
- `available-operations`
  - purpose: list operations for an already configured instance
  - input: optional filters such as `{ "capability": "query" }`
  - output: operation summaries derived from the stored `compiledContract`
  - notes: this resource must not refetch upstream discovery documents
- `operation-schema`
  - purpose: return one operation's effective parameters, request-body metadata, and response
    mappings for an already configured instance
  - input: `{ "operationId": "listOrders" }`
  - output: one operation definition taken from the stored `compiledContract`
- `health-target`
  - purpose: expose the compiled-contract health strategy and any static metadata useful to the UI
  - input: `{}`
  - output: `{ "health": { ... } }` or `{ "health": null }`

Instance-scoped resources must apply normal permission checks, use the stored compiled contract, and
never expose decrypted secrets. Preview/discovery helpers must apply the same SSRF and allowlist
rules as instance persistence.

### 1.7 Response Handling

The first slice should keep response handling simple:

- the contract may describe `responseMappings` for frontend/editor metadata
- the backend may preserve the selected `responseMappingId` in request/trace context
- the backend must not validate the upstream body against the declared mapping on every request
- the upstream response payload should pass through as returned by the API
- any future table extraction or contract-specific shaping should be an explicit later feature, not
  hidden hot-path backend work

### 1.8 Security

The backend must treat API-provided contracts as untrusted input.

Required controls:

- SSRF protection for contract fetch and upstream calls
- allowed scheme and host policy
- request timeout and response size limits
- operation allowlist from compiled contract
- method allowlist; mutating methods require explicit contract opt-in
- header allowlist; reject arbitrary credential-bearing headers from query payloads
- secret redaction in logs, warnings, metadata, cache keys, and errors
- no frontend-readable decrypted secrets
- permission checks before cache reads, in-flight joins, contract resources, and upstream calls
- cache keys include auth scope and effective public config

## 2. Expected OpenAPI And API Contract

`AdapterFromApi` should not accept arbitrary OpenAPI and guess everything. The API must provide a
Command Center adapter contract through a companion well-known endpoint.

### 2.1 Discovery Endpoints

Preferred endpoint:

```http
GET /.well-known/command-center/connection-contract
```

Response:

```json
{
  "contractVersion": 1,
  "adapter": {
    "type": "adapter-from-api",
    "id": "example.orders",
    "title": "Orders API",
    "description": "Order read APIs exposed for Command Center connections"
  },
  "openapi": {
    "url": "https://api.example.com/openapi.json",
    "version": "3.1.0",
    "checksum": "sha256:..."
  },
  "configVariables": [],
  "secretVariables": [],
  "availableOperations": []
}
```

FastAPI or any equivalent backend can and should expose this route. In the first slice, the
well-known route is the only adapter discovery contract.

### 2.2 Contract Definition

The contract definition must include:

- contract version
- API identity and human-readable labels
- OpenAPI document URL or embedded OpenAPI document reference
- public config variables
- secret variables
- auth injection rules
- available operations
- optional response metadata
- cache and dedupe hints
- health-check operation

Public config variable shape:

```json
{
  "key": "tenantId",
  "label": "Tenant ID",
  "description": "Tenant scope used in upstream requests.",
  "type": "string",
  "required": true,
  "defaultValue": null,
  "example": "tenant_123",
  "renderAs": "text",
  "validation": {
    "pattern": "^[a-zA-Z0-9_-]+$"
  }
}
```

Secret variable shape:

```json
{
  "key": "apiToken",
  "label": "API token",
  "description": "Bearer token injected by the backend.",
  "type": "secret",
  "required": true,
  "renderAs": "password",
  "injection": {
    "type": "header",
    "name": "Authorization",
    "template": "Bearer {{secret.apiToken}}"
  }
}
```

Supported dynamic field types should align with Command Center connection schemas:

- `string`
- `number`
- `boolean`
- `select`
- `json`
- `secret`

Additional UI hints may be allowed, but the backend must validate the semantic type rather than
trust UI-only hints.

### 2.3 Available Operations

Operations may be derived from OpenAPI `paths`, but the Command Center contract must identify which
operations are safe and useful as connection queries or resources.

Operation shape:

```json
{
  "operationId": "listOrders",
  "label": "List orders",
  "description": "Returns orders visible to the configured tenant.",
  "method": "GET",
  "path": "/v1/orders",
  "kind": "query",
  "capabilities": ["query"],
  "requiresTimeRange": false,
  "supportsVariables": true,
  "supportsMaxRows": true,
  "parameters": {
    "path": [],
    "query": [
      {
        "key": "status",
        "label": "Status",
        "type": "select",
        "required": false,
        "options": [
          { "label": "Open", "value": "open" },
          { "label": "Closed", "value": "closed" }
        ]
      }
    ],
    "headers": []
  },
  "requestBody": null,
  "responseMappings": [
    {
      "id": "orders_table",
      "label": "Orders table",
      "contract": "core.tabular_frame@v1",
      "statusCode": "200",
      "contentType": "application/json",
      "rowsPath": "$.data.orders",
      "fieldTypes": {
        "created_at": "time",
        "amount": "number",
        "status": "string"
      }
    }
  ],
  "cache": {
    "policy": "safe",
    "ttlMs": 300000,
    "dedupeInFlight": true
  }
}
```

The adapter must reject operations that are not present in the compiled `availableOperations`
contract.

### 2.4 OpenAPI Requirements

If the contract references an OpenAPI document, that document should provide:

- stable `operationId` for each exposed operation
- schemas for parameters and request bodies
- security schemes for credential injection
- server definitions or a base URL compatible with backend allowlist policy
- optional response examples when the API owner wants better human-readable docs, not runtime
  validation

The well-known Command Center contract remains the adapter discovery source of truth.

### 2.5 Health Contract

The contract should identify one health-check strategy:

- dedicated health endpoint
- declared operation with static safe parameters
- OpenAPI document reachability plus optional provider status call

Example:

```json
{
  "health": {
    "operationId": "getStatus",
    "expectedStatus": 200,
    "timeoutMs": 5000
  }
}
```

### 2.6 Credential Handling

The contract must describe where credentials are injected. Users enter secrets in Command Center.
The backend stores them. Query payloads never contain secret values.

Supported first-slice injection targets:

- header
- query parameter
- basic auth
- bearer token

OAuth flows, token refresh, mTLS, and signed requests should be explicit later extensions, not
implicit guesses from OpenAPI alone.

## Implementation Phases

### Phase 1: ADR And Contract Documentation

- finalize this ADR
- document the API contract under `docs/connections/adapters/`
- document frontend extension expectations under `docs/connections/`
- choose final globally unique type id after backend registry review

### Phase 2: Frontend Shell

- add static `AdapterFromApi` connection type
- add custom config editor for backend-routed contract discovery
- add custom query editor for operation selection and dynamic inputs
- add Explore flow using `ConnectionQueryWorkbench` where possible
- add usage guidance and local README

### Phase 3: Backend Adapter

- implement backend adapter registration for the final `type_id`
- implement contract fetch, validation, redaction, and compiled snapshot storage
- implement dynamic public/secure config persistence
- implement health check
- implement query operation dispatch
- implement pass-through response handling
- implement resources for contract and operation metadata

### Phase 4: Instance-Scoped Query Models

- decide whether one static `api-operation` query model is enough
- if not, add instance-scoped query model resolution to the connection workbench
- keep resolution pure and based on sanitized compiled contract state

### Phase 5: Hardening

- SSRF tests
- secret redaction tests
- operation allowlist tests
- cache/dedupe key tests
- pass-through response tests
- contract version migration tests
- provider error mapping tests

## Implementation Checklist

### Implemented In This Repo

- [x] Draft the `AdapterFromApi` ADR and define the backend-routed dynamic adapter direction.
- [x] Add the ADR to the ADR index.
- [x] Add developer documentation under `docs/connections/` for connection models, extension
  contracts, and backend ownership.
- [x] Add adapter documentation under `docs/connections/adapters/`.
- [x] Add Python adapter documentation under `docs/connections/adapters/python/`.
- [x] Document that every `ConnectionTypeDefinition.id` must be globally unique and must be
  checked against backend registered type ids before finalizing.
- [x] Check the current client and referenced backend adapter directories for an existing
  `command_center.adapter_from_api` id collision.
- [x] Add the static frontend `AdapterFromApi` connection type using the working type id
  `command_center.adapter_from_api`.
- [x] Add bootstrap public config fields for API root, derived discovery URLs, contract version,
  request timeout, cache policy, and compiled contract JSON.
- [x] Add a secure config placeholder for dynamic secret values.
- [x] Add schema descriptions for every static config field so the shared connection form can show
  `(i)` help.
- [x] Add a custom config editor that renders bootstrap fields and dynamic public variables from
  the compiled contract.
- [x] Add a custom query editor that renders operation selection, path/query/header parameters,
  request body JSON, max rows, and response mapping selection from the compiled contract.
- [x] Add the first static query model, `api-operation`, for dynamic operation execution.
- [x] Add config and query examples that match the current TypeScript payloads.
- [x] Add connection usage guidance describing when to use the adapter, when not to use it,
  configuration fields, query model, backend resources, and backend ownership.
- [x] Add a local README for `connections/adapter-from-api/`.
- [x] Register the connection in the frontend connection registry.
- [x] Bump the connection type sync registry version.
- [x] Add a FastAPI/Pydantic mock provider under `mock_data/adapters/example/` with the
  well-known contract endpoint and example query operations.
- [x] Run `npm run check`.
- [x] Run `git diff --check`.

### Still Needed

- [ ] Finalize and reserve the globally unique backend type id after reviewing the authoritative
  backend adapter registry.
- [ ] Implement backend adapter registration for the final `type_id`.
- [ ] Implement the `contract-definition` backend resource.
- [ ] Apply SSRF protection, scheme/host allowlists, timeouts, and response size limits when
  fetching contract definitions and OpenAPI documents.
- [ ] Parse the companion `/.well-known/command-center/connection-contract` endpoint.
- [ ] Normalize the well-known contract into one sanitized compiled contract, optionally enriched
  with supplementary OpenAPI metadata.
- [ ] Write the sanitized compiled contract snapshot to `publicConfig.compiledContract` for each
  connection instance and keep any extra backend-only metadata needed for cache invalidation.
- [ ] Validate dynamic public config values against `configVariables`.
- [ ] Store and validate dynamic secure config values against `secretVariables`.
- [ ] Decide whether the first backend slice keeps dynamic secrets in one secure JSON object or
  expands them into generated secure fields.
- [ ] Implement the `available-operations` backend resource.
- [ ] Implement the `operation-schema` backend resource.
- [ ] Implement backend health checks from the compiled contract health strategy.
- [ ] Implement backend execution for the `api-operation` query payload.
- [ ] Inject credentials only through declared contract injection rules.
- [ ] Reject undeclared operations, paths, methods, hosts, headers, credential injection points, and
  parameter keys.
- [ ] Pass upstream API responses through the connection route without hot-path response-contract
  validation.
- [ ] Define provider error mapping, trace ids, warnings, and redacted diagnostic metadata.
- [ ] Define cache and in-flight dedupe behavior for contract discovery and query execution.
- [ ] Ensure cache keys include organization, user/auth scope, connection id, type id, contract
  version/checksum, operation id, sanitized query payload, time range, variables, max rows, and
  public config values, while excluding secrets.
- [ ] Add backend permission checks for contract resources, operation resources, health checks,
  query execution, cache reads, and in-flight dedupe joins.
- [ ] Decide whether instance-scoped query model resolution should become a core connection API or
  remain local to this adapter's query editor.
- [ ] Decide whether mutating operations are out of scope for the first slice or require explicit
  contract opt-in.
- [ ] Add frontend tests for config editor rendering and query editor payload generation.
- [ ] Add backend tests for SSRF controls, contract validation, secret redaction, operation
  allowlists, cache keys, pass-through response behavior, health checks, and provider error mapping.
- [ ] Verify the full flow end to end: create connection, save secrets, test health, use Explore,
  and run the Connection Query widget through the backend adapter.

## Open Questions

- Should dynamic query models become a first-class core connection API or remain local to the
  `AdapterFromApi` query editor?
- Should mutating operations be supported at all in the first slice, or should this connection be
  read/query-only until mutation semantics are designed?
- What backend allowlist policy is required before users can enter arbitrary API roots?

## Rejected Alternatives

### Browser Executes The API Directly

Rejected. It would expose credentials, bypass backend permission checks, make caching/dedupe
inconsistent, and violate the connection model.

### Generate A New Frontend Connection Type Per API

Rejected for the first design. It would require registry sync churn for every API and would still
need a generic backend adapter. A single generic type with instance-level compiled contracts better
matches the dynamic OpenAPI use case.

### Accept Arbitrary OpenAPI Without Command Center Contract Metadata

Rejected. OpenAPI alone is not enough to safely infer secrets, config variables, credential
injection, operation allowlists, response frame mappings, cache policy, and mutation safety.

## Storage And Backend Contract Assessment

This ADR proposes a new connection type and backend adapter. It changes backend contract
requirements by adding:

- dynamic contract discovery resources
- dynamic public/secure config handling
- compiled contract storage or snapshot references
- operation allowlist enforcement
- dynamic query payload execution
- backend mirror/proxy pass-through of upstream API responses

Workspace storage should still store only stable `ConnectionRef` values and query payloads. Secrets
remain backend-only.
