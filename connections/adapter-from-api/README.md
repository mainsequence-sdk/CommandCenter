# Adapter From API Connection

This directory owns the frontend runtime definition for the generic
`command_center.adapter_from_api` connection. The connection lets an administrator configure a
backend-owned data source from an API-owned Command Center contract exposed through a required
well-known endpoint.

## Entry Points

- `index.ts`: exports the `ConnectionTypeDefinition`, TypeScript config/query/contract types,
  examples, schemas, query model, and usage guidance.
- `AdapterFromApiConnectionConfigEditor.tsx`: renders bootstrap discovery fields, runtime policy
  fields, and dynamic public config fields from a backend-compiled contract snapshot.
- `AdapterFromApiConnectionQueryEditor.tsx`: renders operation selection, parameters, request body,
  and optional response-mapping metadata controls from the compiled contract on a configured
  connection instance.

## Backend Adapter Contract

The backend adapter must use:

```text
type_id = "command_center.adapter_from_api"
```

The backend owns:

- server-side derivation of `contractDefinitionUrl` and `openApiUrl` from `apiBaseUrl`
- contract discovery from `/.well-known/command-center/connection-contract`
- optional `openapi.json` fetch only as supporting metadata after the well-known contract is valid
- SSRF protection, host allowlisting, redirect controls, timeouts, and response-size limits
- sanitized `compiledContract` generation and persistence back into
  `publicConfig.compiledContract`
- dynamic public config validation against `compiledContract.configVariables`
- dynamic secure config storage and validation against `compiledContract.secretVariables`
- credential injection into upstream API calls only through declared injection rules
- operation, parameter, header, method, and path allowlist enforcement
- health checks from the stored compiled-contract health strategy
- query/resource dispatch from the stored compiled contract, not by refetching discovery documents
- cache and in-flight dedupe policy keyed by connection `id`, contract checksum/version, auth
  scope, effective public config, and sanitized payload while excluding secrets
- mirror/proxy execution: querying Command Center means the backend performs the upstream API
  request and passes the upstream response back through the connection route without hot-path
  response-contract validation

The browser must not call the upstream API directly and must not receive decrypted secret values.

## Public Config

- `apiBaseUrl`: required API root URL entered by the user.
- `openApiUrl`: derived by the frontend as `${apiBaseUrl}/openapi.json` for backend discovery.
- `contractDefinitionUrl`: derived by the frontend as
  `${apiBaseUrl}/.well-known/command-center/connection-contract` for backend discovery.
- `contractVersion`: optional version pin used by backend discovery.
- `configValues`: dynamic public config values keyed by `compiledContract.configVariables`.
- `compiledContract`: sanitized backend-generated contract snapshot.
- `requestTimeoutMs`: upstream provider timeout.
- `queryCachePolicy`: `safe` or `disabled`.
- `queryCacheTtlMs`: successful result cache TTL.
- `dedupeInFlight`: whether the backend may share identical in-flight operations.

## Secure Config

- `secretValues`: write-only JSON object keyed by `compiledContract.secretVariables`.

The current shared connection create/edit page renders secure config from static schemas, so dynamic
secrets are represented as one secure JSON object in this first frontend slice. The backend still
validates each key against the compiled contract.

On create and update, backend discovery is authoritative. If the browser submits
`publicConfig.compiledContract`, `contractDefinitionUrl`, or `openApiUrl`, the backend must treat
them as untrusted and recompute the authoritative values from `apiBaseUrl` and `contractVersion`
before persisting the instance.

## Query Contract

The first frontend slice exposes one static query model:

```json
{
  "kind": "api-operation",
  "operationId": "listOrders",
  "parameters": {
    "path": {},
    "query": {},
    "headers": {}
  },
  "body": null,
  "responseMappingId": "orders_table"
}
```

The backend must reject undeclared `operationId`, parameter keys, headers, methods, paths, hosts,
or credential injection points. It should then perform the upstream API request and pass the
upstream response back through the connection route without validating the response body against
`responseMappings` on the hot path.

## Maintenance Constraints

- Keep API contract parsing and upstream execution out of browser code.
- Keep the config editor opinionated: the user should provide only the API root URL, while the
  frontend derives the conventional OpenAPI and well-known Command Center contract URLs.
- Do not use this connection with APIs that do not expose the well-known Command Center contract
  route.
- Keep `compiledContract` sanitized. It may describe fields and operations, but it must not contain
  secret values.
- If the connection workbench later supports instance-scoped query models, migrate away from the
  single static `api-operation` model without changing persisted query payload semantics.
