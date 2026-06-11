# ADR 075: MS Markets API Binding

- Status: Proposed
- Date: 2026-06-10
- Related:
  - [ADR 074: Adapter From API Debug Direct Mode](../command_center/adr-074-adapter-from-api-debug-direct-mode.md)
  - [ADR: AdapterFromApi Dynamic OpenAPI Connection](../command_center/adr-adapter-from-api-connection.md)
  - [ADR: First-Class Connection Model](../command_center/adr-first-class-connection-model.md)
  - [ADR: Connection-First Workspace Dataflow](../command_center/adr-connection-first-workspace-dataflow.md)
  - [MS Markets API Binding Tasks](../../implementation_tasks/ms-markets-api-binding/README.md)

## Context

`main_sequence_markets` currently resolves its API root from the Main Sequence frontend environment
and the shared Main Sequence API helper. That makes the application depend on a URL-level
configuration path instead of a Command Center connection instance.

The desired behavior is:

1. An organization admin creates or selects an existing `command_center.adapter_from_api`
   connection for Main Sequence Markets.
2. The Main Sequence Markets application resolves that connection at runtime.
3. All Main Sequence Markets API requests pass through the selected connection adapter.
4. Existing application functionality, route behavior, query keys, payload shapes, and widgets stay
   the same.
5. Changing the connection between debug direct mode and backend proxy mode does not require
   changing Main Sequence Markets pages or widgets.

This must not reintroduce a dedicated `mainsequence.markets` connection type or wrapper adapter.
The binding is metadata on an Adapter From API connection.

## Decision

Bind Main Sequence Markets to a `command_center.adapter_from_api` connection by storing an
application binding marker in the connection public config.

Use the existing Main Sequence Markets application id:

```ts
const MAIN_SEQUENCE_MARKETS_APP_ID = "main_sequence_markets";
```

Extend Adapter From API public config with generic application binding metadata:

```ts
interface AdapterFromApiApplicationBinding {
  appId: "main_sequence_markets";
  role: "primary-api";
}

interface AdapterFromApiPublicConfig {
  applicationBindings?: AdapterFromApiApplicationBinding[];
}
```

Field semantics:

- `applicationBindings`
  - Type: array of binding markers.
  - Required: no.
  - Default: empty.
  - Used by: frontend application resolution and organization admin configuration.
  - Meaning: declares that this connection serves a specific application role.
  - Constraint: Main Sequence Markets should have one `primary-api` binding per organization.

The generic array leaves room for future app bindings without creating new connection types. The
only binding introduced by this ADR is:

```json
{
  "appId": "main_sequence_markets",
  "role": "primary-api"
}
```

## Organization Admin UI

Add an organization admin section named `Main Sequence Markets`.

This section must let an organization admin select the Adapter From API connection that is bound to
Main Sequence Markets. The picker is scoped to `command_center.adapter_from_api` connections.

The section should show:

- selected connection name
- selected connection status
- selected connection transport mode, if present
- whether the selected connection has a compiled contract
- a clear unconfigured state when no connection is bound

Saving the section writes the `applicationBindings` marker to the selected connection public
config. It also removes the same `main_sequence_markets` / `primary-api` marker from any previously
bound Adapter From API connection in the same organization.

The backend does not enforce uniqueness for this binding. If duplicate bindings exist, the
frontend admin/app resolver must detect the duplicate state and block Main Sequence Markets
execution with an explicit admin configuration error.

No separate user-persisted configuration is introduced. The binding belongs to the organization
because connection instances are already persisted by the backend.

## Runtime Resolution

Main Sequence Markets resolves its API connection through the connection registry:

```ts
function isMainSequenceMarketsApiConnection(connection: ConnectionInstance): boolean {
  return (
    connection.typeId === "command_center.adapter_from_api" &&
    connection.publicConfig?.applicationBindings?.some(
      (binding) =>
        binding.appId === "main_sequence_markets" &&
        binding.role === "primary-api",
    ) === true
  );
}
```

Resolution rules:

1. If no bound connection exists, Main Sequence Markets shows an unconfigured state that links to
   the organization admin `Main Sequence Markets` section.
2. If exactly one bound connection exists, the app uses it.
3. If multiple bound connections exist, the app treats that as an admin configuration error and
   does not pick one silently.

The resolver should live in the Main Sequence common layer so all Markets pages and widgets use the
same binding logic.

Resolution must be cheap on the request hot path. The shared Markets API transport must not list or
fetch connections before every `requestMarketsJson(...)` call. It resolves the selected Adapter
From API connection once per browser session, persists the selected connection snapshot in
frontend session storage, and reuses that snapshot for subsequent Markets API requests.

The session cache is invalidated when:

- the organization admin `Main Sequence Markets` binding is saved
- the selected connection is edited in the data source editor
- the cached connection is missing, malformed, inactive, or no longer has the
  `main_sequence_markets` / `primary-api` marker
- execution fails because the cached connection id no longer exists

After invalidation, the next Markets API request may perform one connection resolution request and
then repopulate the session cache. Per-request backend connection resolution is not allowed.

## API Execution

Main Sequence Markets keeps its current request/response shapes. This ADR changes transport, not
application contracts.

The shared Main Sequence API helper should translate current application calls into Adapter From
API connection execution:

```text
Main Sequence Markets page/widget
  -> shared Main Sequence API helper
  -> bound Adapter From API connection
  -> backend proxy mode or debug direct mode
  -> Main Sequence Markets API
```

The helper maps the existing request information to the Adapter From API operation contract:

- HTTP method
- path
- query parameters
- path parameters
- JSON body

The Adapter From API response is unwrapped back into the raw JSON payload expected by existing Main
Sequence Markets callers. This preserves existing examples such as:

```ts
const settings = await fetchMarketsSettings();
```

where callers continue receiving the same `MarketsSettingsResponse` shape.

For table-oriented widgets that already use Adapter From API query contracts directly, no widget
source migration is part of this ADR. Position Detail and the other Main Sequence Markets widgets
remain widget-owned consumers of their existing contracts unless a later widget-specific ADR changes
that.

## Transport Modes

The binding is independent of Adapter From API transport mode:

- In backend mode, the browser calls Command Center backend connection execution endpoints and the
  backend calls the Main Sequence Markets API root.
- In debug direct mode, the browser calls the configured debug API root directly.

Switching `transportMode` on the selected connection must not change the Main Sequence Markets
binding. The same connection instance remains the selected `primary-api` connection.

## Contract Requirements

The selected Adapter From API connection contract must cover every Main Sequence Markets API
operation currently called by the application.

The implementation must audit:

- all `GET` reads
- all create/update/delete mutations
- any `PUT`, `PATCH`, or `DELETE` methods
- file or export endpoints, if any
- settings and metadata endpoints

If Adapter From API currently supports only a subset of the methods needed by Main Sequence
Markets, Adapter From API must be extended before the application is switched over.

Implementation audit on 2026-06-10 found Main Sequence Markets API helpers use `GET`, `POST`,
`PATCH`, and `DELETE`. The frontend direct Adapter From API runtime supports those methods for
this app transport. The existing backend Adapter From API source still validates compiled
operations as `GET`/`POST` only, so backend proxy execution for `PATCH` and `DELETE` requires
widening that existing adapter method allowlist. This is not a new Main Sequence Markets backend
adapter or wrapper.

## Backend And Storage Contract Assessment

This ADR changes connection instance public config for `command_center.adapter_from_api` by adding
`applicationBindings`.

It does not change:

- workspace storage
- widget storage
- widget binding storage
- runtime-state storage
- the connection type id

It does not require a new backend app-configuration table.

Backend support is limited to accepting, preserving, and returning the connection config metadata.
Backend uniqueness enforcement is not part of this ADR. The frontend must detect multiple
`main_sequence_markets` / `primary-api` bindings and show an admin configuration error.

No new backend adapter execution machinery is introduced by this ADR.

## Consequences

Benefits:

- Main Sequence Markets becomes organization-configurable through a connection.
- Debug direct mode and backend proxy mode use the same selected connection.
- The app no longer depends on a hardcoded frontend API root as its primary production route.
- No `mainsequence.markets` wrapper connection type is created.

Costs:

- Adapter From API public config gains application binding metadata.
- Organization admin UI must update connection config safely.
- Main Sequence Markets API helpers need a raw JSON connection-execution path.
- The app needs a clear unconfigured and ambiguous-binding state.

## Non-Goals

- Do not create a `mainsequence.markets` connection type.
- Do not create a Main Sequence Markets wrapper adapter.
- Do not introduce user-persisted connection selection.
- Do not create a separate Main Sequence Markets app configuration table for this binding.
- Do not migrate widget `connectionRef` storage.
- Do not change Main Sequence Markets response payload contracts.

## Acceptance Criteria

- Organization admin has a `Main Sequence Markets` section with a connection picker.
- Selecting a connection persists the `main_sequence_markets` / `primary-api` binding marker on an
  Adapter From API connection.
- Main Sequence Markets resolves the bound connection from connection config.
- Main Sequence Markets API calls execute through the bound Adapter From API connection.
- Existing Main Sequence Markets pages and widgets keep their current application-level response
  shapes.
- Missing and duplicate bindings produce explicit admin-facing errors.
- No new connection type is registered for Main Sequence Markets.
