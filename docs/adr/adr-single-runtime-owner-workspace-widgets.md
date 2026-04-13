# ADR: Single Runtime Owner for Workspace Widgets

- Status: Accepted
- Date: 2026-04-04
- Related:
  - [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr-executable-widget-graph-runner.md)
  - [ADR: Headless Workspace Widget Settings Runtime](./adr-headless-workspace-settings-runtime.md)
  - [Workspace Runtime Performance Remediation](./workspace-runtime-performance-remediation.md)

## Context

Workspace runtime surfaces currently mix two different ownership models for data-backed widgets:

- mounted widget components can fetch their own runtime data through `useQuery(...)`
- the shared dashboard execution layer can also execute the same widget headlessly during refresh

That split ownership is the reason one refresh can hit the same backend path more than once.

The clearest example is the Main Sequence `Data Node` family:

- the source widget now has a headless execution contract
- but mounted runtime surfaces historically still fetched the same detail/data endpoints directly
- some consumer widgets also fetched metadata again even when an upstream published dataset was
  already available

This is not only a `Data Node` issue and not only a graph-mode issue. The underlying problem is
broader:

1. workspace runtime surfaces do not enforce a single canonical fetch owner per widget
2. hidden runtime mounts can still create backend request owners
3. the request debugger currently groups refresh-cycle requests, but it does not yet act as a
   strict ownership regression detector

The result is avoidable duplicate requests, confusing refresh traces, and a runtime model that is
 too easy to violate accidentally.

## Decision

Workspace runtime surfaces will enforce a single runtime-owner model for real data-backed widgets.

Every widget mounted on a workspace runtime surface must be classified as one of these:

### 1. `execution-owner`

The shared dashboard execution layer owns canonical backend/runtime requests.

Rules:

- mounted widget components must render from shared runtime state or published outputs
- mounted components must not independently fetch canonical runtime data on workspace surfaces
- settings/preview flows may still run explicit preview/test requests outside the workspace runtime

Examples in scope:

- `main-sequence-data-node`
- `app-component`

### 2. `consumer`

The widget consumes canonical shared runtime/output from another widget or from the shared runtime
model.

Rules:

- mounted components may resolve bindings and read upstream runtime/output
- mounted components must not become a second owner of the same canonical backend request path
- if extra runtime metadata is required, that metadata should be added to the shared published
  contract instead of fetched independently on the runtime surface

Examples in scope:

- `data-node-table-visualizer`
- `main-sequence-data-node-visualizer`
- `main-sequence-data-node-statistic`

### 3. `local-ui`

The widget is intentionally outside shared refresh/runtime ownership.

Rules:

- the widget may own its own local query lifecycle
- it does not participate in shared execution semantics
- it is out of scope for this runtime unification pass

Examples currently out of scope for this ADR rollout:

- demo/mock/sample widgets such as `price-chart` and similar local examples

## Architecture

### 1. One canonical owner on workspace runtime surfaces

The workspace canvas, graph, rail, hidden runtime mounts, and other mounted runtime surfaces must
never allow both:

- shared execution ownership
- mounted component fetch ownership

for the same canonical request path.

If a widget defines `execution` and is classified as an `execution-owner`, the mounted runtime
component becomes a renderer of shared state, not a second request initiator.

### 2. Hidden mounts are allowed, hidden owners are not

Hidden runtime mounts may still exist to keep runtime consumers and UI shells alive, but they must
not create canonical backend request ownership.

This applies to:

- canvas sidebar-only widget mounts
- graph hidden runtime mounts
- any future offscreen runtime host

### 3. Shared published contracts must carry enough metadata

When consumer widgets still need source metadata at runtime, the preferred fix is to enrich the
shared published contract rather than let each consumer fetch that metadata again.

For the Main Sequence `Data Node` family, this means the published dataset contract is the
preferred place for any runtime metadata needed by downstream table/chart/statistic consumers.

### 4. Request tracing becomes an ownership guardrail

The workspace request debugger should evolve from a refresh-cycle trace into a runtime ownership
tool.

It must be able to distinguish:

- shared execution requests
- mounted component runtime requests
- settings preview/test requests
- manual widget actions

Component-owned runtime requests from `execution-owner` or `consumer` widgets should be treated as
violations, not normal behavior.

## Rollout Plan

### Phase 1: Add explicit runtime ownership metadata

Add a widget-level runtime ownership classification in the shared widget contract and tag real
workspace widgets accordingly.

Initial in-scope tags:

- `main-sequence-data-node` -> `execution-owner`
- `app-component` -> `execution-owner`
- `data-node-table-visualizer` -> `consumer`
- `main-sequence-data-node-visualizer` -> `consumer`
- `main-sequence-data-node-statistic` -> `consumer`

### Phase 2: Finish the Data Node family migration

- keep `main-sequence-data-node` canonical runtime requests in the execution layer only
- remove remaining runtime-surface fallback fetches from Data Node consumers
- enrich the published Data Node bundle if consumers still require metadata at runtime

### Phase 3: Migrate `AppComponent`

`AppComponent` must follow the same pattern:

- execution owns canonical API execution
- mounted runtime widget renders shared runtime/form state
- schema or operation compilation needed for runtime rendering should come from saved compiled
  metadata, not fresh runtime-only discovery fetches

### Phase 4: Tighten hidden runtime mounts

Make hidden runtime mounts safe by design:

- mounted hidden widgets may consume state
- they may not become canonical backend request owners

### Phase 5: Turn the debugger into a regression detector

The request debugger should show full workspace request attribution and call out ownership
violations explicitly.

## Consequences

Positive:

- one refresh cycle produces one canonical runtime request path per widget
- hidden runtime mounts stop doubling backend traffic
- request traces become understandable and trustworthy
- runtime ownership becomes explicit instead of widget-family folklore

Negative:

- widget classification adds one more architectural concept to the platform
- some current runtime consumers will need published-contract changes before their remaining
  fallback queries can be removed cleanly
- `AppComponent` runtime rendering will likely require more aggressive persistence of compiled
  authoring metadata than it uses today

## Guardrails

- Do not let mounted runtime widgets for `execution-owner` widgets fetch canonical runtime data.
- Do not let `consumer` widgets re-query source metadata at runtime when the shared published
  contract can carry it instead.
- Do not treat hidden mounts as permission to create a second runtime owner.
- Do not include demo/mock/sample widgets in this migration until the real runtime widget families
  are clean.
