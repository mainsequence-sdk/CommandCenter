# Task 001: Main Sequence Markets Adapter

## Goal

Create a new Command Center connection type called `Main Sequence Markets` that is a branded
specialization of the existing `Adapter From API` connection. This task only covers the new
connection/adapter registration and documentation. Refactoring the Main Sequence Markets
application and widgets to use this adapter is a follow-up task.

## Scope

- Add a new frontend connection type for Main Sequence Markets.
- Reuse the Adapter From API config editor, query editor, schemas, query model, and runtime shape.
- Give the connection its own globally unique backend type id.
- Register the connection from the Main Sequence Markets extension.
- Document frontend and backend ownership clearly enough for backend implementation and registry
  sync.

## Proposed Contract

- Connection title: `Main Sequence Markets`
- Proposed type id: `mainsequence.markets`
- Source: `main_sequence_markets`
- Category: `APIs`
- Access mode: `proxy`
- Capabilities: `query`, `resource`, `health-check`
- Required frontend permission: `main_sequence_markets:view`
- Query model: reuse `api-operation`
- Output contract: reuse Adapter From API response behavior, with operation mappings expected to
  return `core.tabular_frame@v1` where the selected operation is tabular.

The final `type_id` must be checked against the backend registered connection-type registry before
implementation. If backend already reserves a different id for Markets API adapter execution, use
the backend id and update this document.

## Frontend Implementation Steps

1. Refactor `connections/adapter-from-api/index.ts` to expose a factory such as
   `createAdapterFromApiConnectionDefinition(...)`.
2. Rebuild the existing `command_center.adapter_from_api` definition through that factory so its
   public behavior remains unchanged.
3. Add a Markets-owned connection definition under:

   ```text
   extensions/main_sequence/extensions/markets/connections/
   ```

4. Register the new connection in `extensions/main_sequence/extensions/markets/index.ts` through
   the extension `connections` array.
5. Add local README documentation for the Markets connection directory.
6. Update `extensions/main_sequence/extensions/markets/README.md` to mention the new connection
   entry point.
7. Add adapter-specific `usageGuidance` that explains:
   - the connection targets the Main Sequence Markets API
   - configuration is still Adapter From API-style contract discovery
   - secrets, execution, health checks, permissions, cache, and response normalization are backend
     owned
   - widgets and Explore should query through Command Center connection APIs, not direct browser
     calls

## Backend Adapter Requirements

This task should not create new backend adapter machinery. The intent is to reuse the existing
Adapter From API backend runtime.

If the backend dispatcher already supports branded Adapter From API connection types from the
frontend registry payload, no backend code change should be required. If the backend has a
hardcoded `type_id` to adapter-class map, add only the minimal alias/registration needed so
`mainsequence.markets` resolves to the existing Adapter From API runtime.

The existing Adapter From API runtime remains responsible for:

- discovery from `/.well-known/command-center/connection-contract`
- optional OpenAPI metadata loading from `/openapi.json`
- URL policy, timeout, redirect, and response-size controls
- sanitized `compiledContract` persistence
- dynamic public config validation
- dynamic secure config validation and secret storage
- operation allowlist enforcement
- upstream API request execution
- permission checks before health checks, resources, query execution, cache reads, and in-flight
  dedupe joins
- cache keys that exclude secrets
- health checks from the compiled contract health strategy
- redacted provider errors and diagnostics

## Out Of Scope

- Refactoring Markets app surfaces to work from the adapter.
- Refactoring Markets widgets to work from the adapter.
- Adding new widget props or migrating saved workspace state.
- Reworking existing Position Detail operation wiring in this task. Position Detail is expected to
  participate in the adapter-backed Markets widget refactor.
- Removing existing direct Main Sequence API helpers.

## Follow-Up Task

After this adapter exists, create a separate implementation task to refactor the Main Sequence
Markets application and widgets to work from the adapter. That follow-up must define the exact
application and widget wiring separately; this task must not decide it.

The follow-up should include:

- how Markets widgets use the configured `Main Sequence Markets` adapter
- how Position Detail keeps its adapter-backed portfolio, account, target allocation, and account
  target allocation behavior
- which Markets app surfaces should move to adapter-backed operations
- which existing direct Main Sequence API helpers remain in place during migration
- the storage and backend-contract impact of any changed widget props, runtime state, bindings, or
  persisted workspace behavior

## Verification

- Run `npm run check` after TypeScript changes.
- Confirm the connection appears in the frontend registry.
- Confirm the connection sync payload includes `mainsequence.markets`.
- Confirm every config schema field inherited by the Markets connection has a `description` for
  configuration help.
- Confirm the Markets connection directory has README documentation.
- Confirm backend registration exists before treating the connection as user-ready.

## Storage And Backend Contract Assessment

This task adds a new backend-synced connection type that should reuse the existing Adapter From API
runtime. It should not require a new backend adapter implementation. A backend change is needed only
if the dispatcher cannot map `mainsequence.markets` to the existing Adapter From API runtime from
the synced registry metadata alone.

This task does not change existing workspace storage, widget props, bindings, runtime state, or
saved dashboard payloads. The follow-up widget/app refactor may change persisted widget
configuration semantics and must assess storage impact separately.
