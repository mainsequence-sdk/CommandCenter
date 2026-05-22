# ADR 074: UID-Only Main Sequence Backend Identifier Contracts

- Status: Proposed
- Date: 2026-05-22
- Owners: Main Sequence frontend
- Related:
  - [Main Sequence Namespace](../../../extensions/main_sequence/README.md)
  - [Main Sequence Shared API](../../../extensions/main_sequence/common/api/README.md)
  - [Main Sequence Workbench](../../../extensions/main_sequence/extensions/workbench/README.md)
  - [Main Sequence Markets](../../../extensions/main_sequence/extensions/markets/README.md)

## Context

Main Sequence frontend surfaces still contain a mixed identifier model.

Some backend contracts already use `uid` as the canonical lookup key, while parts of the frontend
still do one or more of the following:

- build detail routes with numeric `id`
- send numeric foreign keys in request bodies
- store entity references in fields still named `...Id`
- keep deep-link query params in `...Id` form even when the value is now a UUID string
- retain compatibility branches that accept either `id` or `uid`

That mixed state is no longer acceptable.

The backend contract direction is now explicit: numeric `id` is deprecated for the Main Sequence
object families covered by this ADR, and lookup must happen through `uid`. This migration is not a
soft preference. It is a contract change.

More importantly, numeric fallback is not a valid compatibility strategy. The backend is not
expected to continue honoring numeric `id` lookup for these contracts, so fallback logic is not
just misleading, it will fail.

Without a clear architectural rule, each feature drifts independently:

- Workbench routes partially migrate but keep numeric query assumptions
- Markets screens migrate detail routes but keep numeric payload fields
- shared widget and connection configs keep storing UID strings under misleading `...Id` names
- helper functions silently introduce fallback logic that preserves broken mental models

The result is fragile code, misleading storage contracts, and recurring regressions whenever a new
screen touches an entity that has already migrated on the backend.

## Decision

For Main Sequence-owned frontend surfaces covered by this ADR, `uid` is the only supported
identifier for backend-facing entity lookup.

This ADR establishes five non-negotiable rules:

1. **No numeric fallback**
   - Shared helpers, feature pages, widgets, connections, and mocks must not fall back to numeric
     `id`.
   - Numeric fallback is explicitly rejected because the deprecated `id` paths are not expected to
     work.
2. **Path parameters are UID-only**
   - Detail, summary, mutation, and related subresource routes must use `<uid>`.
3. **Frontend storage must stop pretending identifiers are numeric**
   - Persisted config, widget props, connection public config, and deep-link query params should
     move to explicit `...Uid` field names instead of storing UUID strings in legacy `...Id`
     fields.
4. **Query/body foreign references must use UID once backend supports it**
   - Payload fields such as `execution_venue`, `account`, `data_node`, or similar references must
     send UID strings once their backend contract has migrated.
5. **Legacy list and bulk contracts are blockers, not hidden bridges**
   - Any backend list or bulk endpoint that still requires numeric foreign keys is treated as
     not-yet-migrated. The frontend should not make that contract look UID-native by hiding a
     numeric bridge inside canonical shared helpers.

## Scope

This ADR governs `extensions/main_sequence/` and the Main Sequence-specific frontend APIs it owns.

It covers:

- shared API helpers in `extensions/main_sequence/common/api/`
- Main Sequence Workbench feature pages, deep links, widgets, and connection types
- Main Sequence Markets feature pages, widgets, and editors
- Main Sequence mock API contracts
- persisted Main Sequence frontend config/state that references backend entities

It does not automatically rewrite unrelated core platform contracts such as:

- `/user/api/...`
- organization/team administration
- other non-Main Sequence application domains

Those should move under separate ADRs when their backend contracts migrate.

## Design

### 1. Canonical identifier rules

For Main Sequence entities covered by this ADR:

- route params: `uid`
- request payload references: `uid`
- selection state: `uid`
- deep-link query params: `...Uid`
- persisted public config / widget props / binding state: `...Uid`
- mock fixtures: `uid`

The frontend should not retain misleading field names like `dataNodeId` or `accountId` once the
entity contract is fully UID-based.

### 2. Shared API helpers are the first migration boundary

The canonical source of truth for this migration is the shared API layer in:

- `extensions/main_sequence/common/api/index.ts`

Feature pages and widgets should not invent their own per-screen identifier translation rules.
Shared helpers must expose the final contract directly.

### 3. Persisted contracts must be renamed, not cosmetically repurposed

When a widget, connection, or deep link stores a backend entity reference, the contract should be
renamed from `...Id` to `...Uid` instead of silently changing the value type.

Examples:

- `dataNodeId` -> `dataNodeUid`
- `simpleTableId` -> `simpleTableUid`
- `accountId` -> `accountUid`
- `msDataNodeId` -> `msDataNodeUid`

This makes the frontend storage model honest and prevents years of type drift where a field called
`...Id` actually holds a UUID string.

### 4. List and bulk endpoints must migrate explicitly

Some backend contracts still appear to require numeric foreign keys or numeric bulk identifiers,
for example patterns such as:

- `remote_table=<id>`
- `project__id=<id>`
- `selected_ids: number[]`

Under this ADR, those are not acceptable as hidden implementation details in the final migrated
frontend contract.

They must be handled in one of two ways:

1. backend migrates the contract to UID, or
2. the frontend surface remains explicitly marked as not yet migrated and is not presented as
   UID-complete

What is rejected is a hidden “UID in the UI, numeric bridge in the shared helper” pattern that
makes the codebase look migrated while the real contract remains split.

What is also rejected is any fallback implementation that continues calling deprecated numeric paths
under the assumption that they might still work. Under this ADR, they should be treated as broken
contracts.

### 5. Migration should happen by endpoint family, not by random screen edits

The migration sequence should move from shared APIs outward:

1. shared API helpers
2. stored config and route/query contracts
3. feature pages
4. widgets and connections
5. mocks, tests, and docs

This keeps the contract coherent while changes roll through the codebase.

## Consequences

### Positive

- Shared contracts become explicit and honest.
- Feature screens stop reimplementing identifier mapping ad hoc.
- Persisted config becomes self-describing.
- Future backend UID migrations become cheaper because the frontend rule is already clear.

### Negative

- This is a real breaking contract change for persisted frontend state.
- Existing links, widget props, connection configs, and query param names that still use `...Id`
  will need migration.
- Endpoint families still requiring numeric foreign keys cannot be papered over anymore; they must
  either migrate on the backend or remain clearly unmigrated.

## Rejected Alternatives

### 1. Keep `...Id` names and store UUID strings in them

Rejected because it preserves a false contract and guarantees more confusion later.

### 2. Keep numeric fallback in shared helpers

Rejected because it hides backend contract drift and turns the migration into an unbounded
compatibility layer. It also fails the stated backend contract because deprecated numeric lookups
are not expected to work.

### 3. Migrate page by page without a shared API rule

Rejected because it recreates the exact drift this ADR is meant to stop.

## Storage Contract Assessment

This ADR implies frontend storage contract changes.

Affected categories include:

- widget props
- connection public config
- deep-link query params
- page selection state persisted in URLs
- any saved Main Sequence feature configuration that currently stores numeric IDs or UID strings in
  `...Id` fields

This is not frontend-only cleanup. Backend and frontend owners must coordinate migrations for any
persisted or shareable state that references these objects.

## Implementation Tasks

- [ ] Build a contract inventory of all Main Sequence backend-facing helpers that still use numeric
      `id` or misleading `...Id` names.
- [ ] Group that inventory by endpoint family:
      - Markets / assets
      - Workbench / `ts_manager`
      - Projects / infra / pods
      - permissions and other shared Main Sequence objects
- [ ] For each migrated backend object family, change shared API helpers in
      `extensions/main_sequence/common/api/index.ts` to accept and emit UID-only contracts.
- [ ] Remove all numeric fallback branches from Main Sequence shared API helpers and mock handlers.
- [ ] Remove any frontend code path that still calls deprecated numeric-ID endpoints for migrated
      Main Sequence object families.
- [ ] Rename persisted frontend identifier fields from `...Id` to `...Uid` across Main Sequence
      widgets, connections, and deep-link query params.
- [ ] Add explicit migration handling for saved frontend state that still uses legacy `...Id`
      fields, or document the required hard break if no automatic migration will be provided.
- [ ] Update Workbench feature pages to navigate and select by UID-only contracts.
- [ ] Update Markets feature pages to navigate and mutate by UID-only contracts.
- [ ] Update shared Main Sequence widgets and connections so their public config and runtime inputs
      no longer expose legacy `...Id` names.
- [ ] Identify every backend list or bulk endpoint that still requires numeric foreign keys and
      either:
      - migrate the backend contract to UID, or
      - mark the frontend surface as not yet migrated and block misleading partial migration
- [ ] Update mock datasets so fixture shape matches the UID-only contracts.
- [ ] Update tests to assert UID-only paths, payloads, and persisted config names.
- [ ] Update the nearest feature READMEs after each endpoint family migration so local
      documentation stays accurate.

## Completion Criteria

This ADR should not be considered complete until all of the following are true:

- no Main Sequence shared API helper still exposes numeric-ID lookup for the object families covered
  by this ADR
- no Main Sequence persisted config stores backend entity references in legacy `...Id` fields
- no Main Sequence deep-link query param uses `...Id` for UID-backed entities
- no Main Sequence mock handler or fixture relies on numeric fallback for migrated object families
- remaining numeric backend contracts are explicitly documented as unmigrated instead of being
  hidden behind frontend translation layers
