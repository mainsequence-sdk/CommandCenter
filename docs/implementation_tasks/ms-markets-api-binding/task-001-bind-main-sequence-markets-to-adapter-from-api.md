# Task 001: Bind Main Sequence Markets To Adapter From API Connection

## Objective

Make the `main_sequence_markets` application resolve its API through an organization-selected
`command_center.adapter_from_api` connection instead of a fixed URL, while preserving existing
application behavior.

## Scope

- Add Adapter From API application binding metadata.
- Add an organization admin `Main Sequence Markets` section for selecting the bound connection.
- Add a Main Sequence Markets connection resolver.
- Route Main Sequence Markets API helper calls through the bound Adapter From API connection.
- Preserve existing raw JSON response shapes for Main Sequence Markets callers.

## Out Of Scope

- Creating a new `mainsequence.markets` connection type.
- Creating a wrapper adapter around Adapter From API.
- Adding user-specific connection persistence.
- Refactoring widget storage or widget `connectionRef` contracts.
- Changing the Main Sequence Markets backend API payload contract.

## Implementation Checklist

- [x] Add `applicationBindings` typing to Adapter From API public config.
- [x] Document the `main_sequence_markets` / `primary-api` binding in
  `connections/adapter-from-api/README.md`.
- [x] Update Adapter From API connection usage guidance so agents know this is an app binding
  marker, not a new connection type.
- [x] Confirm backend connection config validation accepts and returns `applicationBindings`.
- [x] Decide uniqueness ownership: backend does not enforce one `main_sequence_markets` /
  `primary-api` binding per organization; the frontend admin/app resolver detects duplicates and
  blocks execution with an explicit configuration error.
- [x] Add a resolver in the Main Sequence common layer:
  `isMainSequenceMarketsApiConnection(connection)`.
- [x] Add deterministic resolution states for no binding, exactly one binding, and duplicate
  bindings.
- [x] Add an organization admin section named `Main Sequence Markets`.
- [x] In that section, list only `command_center.adapter_from_api` connections.
- [x] In that section, show selected connection name, status, transport mode, and compiled contract
  presence.
- [x] Save the selected connection by adding the binding marker to its public config.
- [x] Remove the same binding marker from any previously bound Adapter From API connection in the
  organization.
- [x] Add a shared Main Sequence Markets API transport that executes requests through the selected
  Adapter From API connection.
- [x] Add frontend session caching for the selected Main Sequence Markets Adapter From API
  connection so `requestMarketsJson(...)` does not fetch/list connections on every API request.
- [x] In direct debug mode, auto-discover the browser-side Adapter From API contract when the
  bound connection has no stored `compiledContract`, then cache the hydrated connection snapshot in
  session storage.
- [x] Invalidate the session cache when the admin binding is saved, when the selected data source
  is edited, or when execution proves the cached connection id is stale.
- [x] Preserve the existing `requestJson<T>` caller contract by unwrapping Adapter From API
  execution responses back to raw JSON.
- [x] Support backend proxy mode and debug direct mode through the same selected connection for
  operations the selected Adapter From API runtime accepts.
- [x] Audit all Main Sequence Markets API calls for required HTTP methods.
- [ ] Extend backend Adapter From API operation validation/execution for `PUT`, `PATCH`, and
  `DELETE`. The frontend direct runtime now accepts those methods, but the existing backend
  adapter source still validates operations as GET/POST only.
- [ ] Verify the selected API contract exposes every operation used by Main Sequence Markets.
- [x] Keep existing widget behavior unchanged unless a widget already calls the shared Main
  Sequence Markets API helper.
- [x] Add explicit unconfigured and duplicate-binding UI errors.
- [x] Add tests for binding resolution.
- [ ] Add tests for admin save behavior.
- [x] Add tests for raw JSON unwrap behavior.
- [ ] Add at least one integration-level test that proves a Markets page executes through the
  selected connection.

## Acceptance Criteria

- Organization admin can select the Adapter From API connection for `Main Sequence Markets`.
- The selected connection stores this marker:

```json
{
  "appId": "main_sequence_markets",
  "role": "primary-api"
}
```

- Main Sequence Markets resolves the selected connection with
  `connection.filter(isMainSequenceMarketsApiConnection)` or the equivalent registry query.
- Main Sequence Markets API requests execute through the selected Adapter From API connection.
- Switching the selected connection between backend proxy mode and debug direct mode does not
  require changing Main Sequence Markets pages, widgets, or workspace bindings.
- Existing Main Sequence Markets pages and widgets receive the same application-level response
  shapes as before.
- Missing binding and duplicate binding states are visible and actionable.
- No `mainsequence.markets` connection type is registered.

## Verification

- [x] Run typecheck.
- [x] Run relevant connection tests.
- [x] Run relevant Main Sequence Markets tests.
- [ ] Manually verify admin selection, missing binding state, and duplicate binding state.
- [ ] Manually verify one representative read endpoint and one representative mutation endpoint.
- [ ] Manually verify the same bound connection works in backend proxy mode and debug direct mode.

## Storage And Backend Contract Assessment

This task changes connection instance `publicConfig` for `command_center.adapter_from_api`.

New persisted public config key:

- `applicationBindings`

Workspace storage, widget storage, widget binding storage, and runtime-state storage are unchanged.

The backend does not need a new Main Sequence Markets app-configuration table. It accepts,
preserves, and returns the new Adapter From API public config key as metadata. Server-side
uniqueness validation is not part of this implementation; duplicate binding detection belongs to
the frontend admin/app resolver.

Backend confirmation on 2026-06-10: connection instance validation uses the synced
`publicConfigSchema`, so adding `applicationBindings` to the Adapter From API schema makes the field
valid. The Adapter From API backend preparation path copies the submitted public config before
normalizing transport fields, and connection response serialization returns stored public config
without stripping this key.
