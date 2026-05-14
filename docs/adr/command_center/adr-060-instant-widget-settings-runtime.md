# ADR 060: Instant Widget Settings Runtime

- Status: Proposed
- Date: 2026-05-12
- Related:
  - [ADR: Headless Workspace Widget Settings Runtime](./adr-headless-workspace-settings-runtime.md)
  - [ADR: Preview-Only Demo Drafts for Widget Settings](./adr-widget-settings-demo-preview-draft.md)
  - [ADR 038: Progressive Workspace Initial Rendering and Per-Widget Hydration](./adr-038-progressive-workspace-widget-hydration.md)
  - [ADR 040: Dashboard Surface Return Hydration](./adr-040-dashboard-surface-return-hydration.md)
  - [ADR 046: WebSocket Stream Survivability And Reconnect Supervision](./adr-046-websocket-stream-survivability-and-reconnect-supervision.md)
  - [ADR: Single Runtime Owner for Workspace Widgets](./adr-single-runtime-owner-workspace-widgets.md)

## Context

Opening widget settings currently feels slow, especially in workspaces with live WebSocket-backed
source widgets.

The prior headless-settings ADR fixed one major issue: settings no longer hidden-mount the entire
workspace widget tree just to keep upstream runtime state available. The current problem is a
different version of the same UX failure:

- the settings overlay can still perform whole-workspace dependency work before the settings body is
  usable
- the settings panel renders preview, controller context, schema controls, and widget-specific
  settings synchronously on the open path
- WebSocket source widgets amplify that cost because their current runtime state and output
  resolution can be large and continuously changing
- opening settings appears to freeze, unmount, or remount the workspace even when the canvas subtree
  remains mounted behind the overlay
- stream connection authoring currently treats "test this stream" as a separate settings concern
  even when the same workspace already has an active healthy stream for that exact connection/query
- the current stream-runtime duplicate guard is not a real workspace connection store; it prevents
  some duplicate sessions, but it does not give settings, widgets, charts, and rails one shared
  source of truth for active connection status

The product requirement is stricter than "do not hidden-mount widgets":

1. opening widget settings must show the shell immediately
2. opening widget settings must not recreate workspace runtime providers
3. opening widget settings must not close and reopen existing WebSocket sessions
4. heavy dependency, preview, controller, and widget-specific settings work must hydrate after the
   shell is visible
5. if a connection/query stream is already active in the workspace, settings must reuse that active
   connection state instead of opening a "test" stream to prove that it works

## Decision

Widget settings will become an instant overlay over the already-mounted workspace runtime.

The initial settings-open path must do only cheap work:

- route/query state update
- identify the selected widget instance and widget definition
- render the overlay shell, header, tabs, and basic actions
- keep the existing canvas/runtime subtree mounted and non-interactive underneath the overlay

All expensive settings work must be deferred or scoped:

- dependency resolution for the whole workspace must not run on initial settings open
- draft dependency models are created only for the bindings tab or when draft bindings differ from
  the persisted workspace graph
- panel preview mounts after the shell first paints
- widget controller context and widget-specific settings mount behind localized placeholders
- explicit test panels and request/stream probes mount only when the user opens or runs them

The workspace runtime remains owned by the existing `WorkspaceStudioCanvasHost` provider stack. The
settings overlay reads from that runtime; it does not create an independent runtime owner for the
same workspace.

The implementation will introduce a workspace-scoped connection runtime store. The store is the
single browser-side source of truth for active connection/query sessions, including WebSocket
streams. Widgets, charts, rails, settings, managed-connection editors, and stream summaries read
from the same store entry for the same effective connection request.

When a matching store entry is active and healthy, settings must not show "run a test" as the next
step. It should show the active session status, last message time, row count, and any current error
from the shared store. Manual test actions are only for draft requests that do not match any active
store entry, or for explicit user-driven diagnostics.

## Runtime Ownership

### Existing Workspace Runtime Owns

The mounted workspace runtime owns:

- `DashboardControlsProvider`
- `DashboardWidgetRegistryProvider`
- `DashboardWidgetExecutionProvider`
- the canonical `RuntimeDataStore`
- the canonical workspace `ConnectionRuntimeStore`
- mounted source widgets that own browser-side runtime sessions
- WebSocket lifecycle and reconnect supervision
- active connection/query session status
- committed widget runtime state

### Settings Overlay Owns

The settings overlay owns:

- local widget draft title, props, bindings, and presentation
- local demo draft state
- local preview state for explicitly previewed settings flows
- deferred settings body hydration
- binding-tab draft dependency models when needed
- draft-only connection/query request previews that are not yet active in the workspace

The settings overlay must not own:

- canonical WebSocket sessions
- canonical connection/query session state
- workspace-wide runtime execution providers
- full-workspace hidden component mounts
- initial dashboard hydration or surface-return hydration

## Architecture

### 1. Keep `dashboard` and `widget-settings` in one mounted host

`dashboard` and `widget-settings` remain the same workspace runtime surface.

Opening settings renders an overlay above the existing studio. It must not cause a provider-stack
remount, and it must not change the runtime surface in a way that triggers surface-return hydration.

The error-boundary reset key, provider keys, and surface identifiers must treat settings as an
overlay state, not a separate workspace runtime.

The studio host owns an optimistic local widget-settings target. Clicking widget settings sets this
local target synchronously so the overlay shell can paint from the already-known widget id, title,
and type. Normal in-workspace settings opens do not write URL params. `view=widget-settings` URLs
remain accepted for direct entry and reload, but they are not the authority for first paint or for
returning to the dashboard.

The open signal must not require the full dashboard host to rerender. A small overlay store owns the
active widget-settings target, and only the overlay layer subscribes to that target. Dashboard
selection updates, settings body hydration, controller context resolution, and connection settings
mounts happen after the frosted overlay shell has painted.

### 2. Split settings shell from settings body

`CustomWidgetSettingsPage` should have two layers:

- a cheap shell that renders immediately
- a deferred body that hydrates expensive sections

The shell includes:

- back/return action
- workspace save status
- widget title, id, kind, source
- tab controls
- widget details link
- save workspace action

The body includes:

- shared `WidgetSettingsPanel`
- binding editor
- managed connection editor
- preview
- widget-specific settings
- raw props editor

The body may show localized skeletons while deferred work loads. The full overlay must not be
blocked by body hydration.

### 3. Stop rebuilding the full dependency graph on settings open

The embedded settings page must not wrap the whole page in a fresh
`DashboardWidgetDependenciesProvider` just to support draft bindings.

Instead:

- use the parent provider for persisted/live inputs on the default settings tab
- create a scoped draft dependency model only for the bindings tab
- create a scoped draft dependency model only when the draft graph actually differs from the live
  graph
- avoid eager graph construction when the caller only needs one widget's IO or inputs

`createDashboardWidgetDependencyModel(...)` may need a lazy mode or a separate scoped resolver so
callers can resolve one instance without building every node and edge immediately.

### 4. Defer preview and custom settings

The shared settings panel must not synchronously mount all expensive sections during the first
settings render.

Preview and advanced settings become independently deferred regions:

- panel preview mounts after first paint or after an explicit preview enablement policy
- controller context resolves inside the advanced-settings region, not before the panel appears
- widget-specific settings render behind a localized loading state
- demo preview continues to use widget-defined mock props, mock inputs, and mock runtime state

Preview remains scoped to the edited widget only. Settings preview must not mount sibling widgets.

### 5. Add a workspace-scoped connection runtime store

The runtime must provide a `ConnectionRuntimeStore` beside the existing `RuntimeDataStore`.

The store owns active connection/query sessions for one workspace runtime. It must be scoped by the
workspace runtime id, not by the settings page and not by a widget settings component.

The store key must represent the effective request, not the surface that asked for it. For WebSocket
streams, the key should include:

- execution surface, such as private workspace vs public workspace
- connection ref type id
- connection ref id when private execution uses a backend-owned connection instance
- public stream URL or public execution capability id when public execution is used
- query model id
- normalized query payload
- normalized dashboard time range when the query is dashboard-time-range aware
- normalized variables
- stream mode and merge-key/retention policy only when those values change the actual subscription
  or retained publication semantics

The key must not include:

- settings route state
- panel preview instance id
- arbitrary render timestamps
- widget title
- draft-only local UI state

If two widgets intentionally point at the same effective connection/query request, they must share
the same store session instead of opening two browser WebSockets.

The store entry should expose:

- `status`: idle, connecting, live, reconnecting, closed, or error
- active subscriber count
- last message timestamp
- last heartbeat timestamp
- reconnect attempt metadata
- current error and error code
- latest normalized runtime frame ref or summary
- owner widget ids that currently reference the entry
- whether the entry is backed by a live session, a retained completed state, or a draft preview

The store must support subscribe/unsubscribe semantics:

- source widgets acquire the session when they mount as runtime owners
- charts and passive widgets subscribe to published data or status but do not acquire sockets
- settings subscribes read-only to existing entries by default
- the store closes a WebSocket only when the final runtime-owner subscription releases it
- closing settings never releases the runtime-owner subscription

This replaces module-local "active session" guards as the canonical lifecycle mechanism. A
module-local guard can remain as a defensive fallback, but it must not be the only source of truth.

### 6. Active connection status replaces unnecessary settings tests

If the `ConnectionRuntimeStore` has a matching active or recently retained entry for the current
draft connection request, settings must show that entry instead of prompting the user to run a test.

For an active healthy stream, the settings UI should show:

- live/reconnecting/error status
- selected connection and query path
- last message and heartbeat timestamps
- latest row count and schema summary
- reconnect/error details when degraded

For a matching active entry, the primary action is not "Test request". The connection is already
proven active by the shared runtime. A manual test action can be available only as an advanced
diagnostic action, and it must be clearly separate from the canonical runtime session.

For a draft request that does not match any active entry, settings may offer an explicit test, but
that test must:

- use a preview/session key that cannot steal ownership from the live runtime entry
- close itself when the diagnostic panel closes
- never write canonical runtime state unless the user applies the draft to the workspace
- never cause charts or widgets to swap away from the live store entry

### 7. WebSocket source widgets are runtime-owned, not preview-owned

WebSocket source widgets such as `connection-stream-query` are browser runtime owners. Opening their
settings must not start a second stream session or close the existing session.

Rules:

- the live canvas/sidebar-mounted source acquires the WebSocket session through
  `ConnectionRuntimeStore`
- settings reads the active store entry and the last published runtime state from the workspace
  runtime
- charts and passive widgets consume the same published runtime output or store status; they do not
  open their own stream sessions
- settings preview for stream source widgets should default to a lightweight read-only summary or
  mock demo state
- explicit stream test panels mount only when requested by the user and only when the draft request
  is not already represented by an active store entry
- unmounting settings must not affect the live stream

### 8. Bindings and managed connections stay accurate

Bindings still need draft-aware validation, but that work should be paid only when the bindings or
managed-connection tab is active.

The default settings tab should not build a draft dependency graph unless a field displayed on that
tab explicitly needs draft binding resolution.

Managed connection preview runtime state remains local to the settings page until the user applies
connection changes.

When a managed connection draft matches an existing hidden source widget and active store entry, the
Connection tab should show the active store status for that hidden source. It should not require a
separate test to prove that the hidden source works.

## Implementation Compliance Snapshot

As of 2026-05-13, the implementation is only partially compliant with this ADR.

Legend:

- `Compliant`: implemented in current code and aligned with this ADR
- `Partial`: implemented in shape, but missing behavior, hardening, or tests
- `Non-compliant`: current behavior contradicts this ADR
- `Unverified`: not proven by code inspection or regression tests yet

### Current Compliant Areas

- `dashboard` and `widget-settings` are treated as the same runtime surface in
  `WorkspaceStudioCanvasHost`; route-backed `widget-settings` maps to dashboard runtime ownership
  instead of creating a separate workspace runtime.
- Embedded widget settings no longer creates its own `DashboardWidgetExecutionProvider`,
  `DashboardControlsProvider`, or full-page `DashboardWidgetDependenciesProvider`.
- A workspace-scoped `ConnectionRuntimeStore` exists beside `RuntimeDataStore`, and
  `connection-stream-query` can acquire live WebSocket sessions through that store.
- `WidgetSettingsPanel` has a deferred region mechanism for preview and advanced settings work
  after the initial panel render.
- Same-widget settings reopens now use a fresh overlay generation id, so stale body hydration state
  cannot skip the instant shell for the next open.
- `connection-stream-query` settings now keeps stream diagnostics/test controls opt-in and uses a
  lightweight runtime summary on the default settings path.
- `connection-stream-query` uses demo-only shared panel preview so settings preview cannot acquire a
  live WebSocket runtime owner for the real draft request.

### Current Partial Areas

- The connection runtime store exposes active status and owner metadata, but stream runtime state is
  still written back through workspace widget runtime-state updates, so active streams can keep the
  dashboard tree busy while the user clicks settings.
- `ConnectionStreamQueryTestPanel` shows active store status when a matching active entry exists,
  and it is now opt-in from settings, but no regression test proves it cannot affect canonical
  runtime ownership.
- Binding-tab draft dependency work is scoped better than before, but no lazy/scoped dependency
  resolver exists for one-widget reads.

### Current Non-Compliant Areas

- Opening settings can still occur while live stream runtime-state writes are flushing into
  workspace state, which violates the requirement that settings open must not scale with every live
  runtime payload.

### Current Unverified Areas

- No regression test proves canvas widgets stay mounted when `view=widget-settings` opens.
- No regression test proves opening settings for a stream-backed workspace does not close the
  existing stream session and does not create a second session.
- No regression test proves two widgets with the same effective stream request share one WebSocket.
- No regression test proves charts/passive widgets do not open WebSockets when bound to an active
  stream source.
- No regression test proves settings subscribes read-only to an active stream store entry.
- No regression test proves closing settings does not decrement or release the runtime-owner
  subscription.
- No timing instrumentation currently proves overlay shell paint is independent from dependency
  model creation, preview mount, controller context resolution, and widget-specific settings mount.

## Implementation Tasks

- [ ] Add instrumentation around widget settings open. Status: not implemented.
  - route state update to overlay shell paint
  - dependency model creation
  - preview mount
  - controller context resolution
  - widget-specific settings mount
- [ ] Add a regression test proving canvas widgets stay mounted when `view=widget-settings` opens.
  Status: not implemented.
- [ ] Add a WebSocket regression test proving opening settings for a stream-backed workspace does
  not close the existing stream session and does not create a second session. Status: not
  implemented.
- [x] Add a shared `ConnectionRuntimeStore` provider under the workspace runtime provider stack.
  Status: implemented.
- [x] Move `connection-stream-query` session acquisition into the shared connection runtime store.
  Status: partially implemented; the widget acquires through the store when a provider exists, but
  fallback direct session creation remains.
- [ ] Replace module-local active-session ownership with store-backed acquire/release semantics,
  leaving any module-level guard as defensive-only. Status: partial; ownership is store-backed in
  normal workspace runtime, but the fallback path and tests still need hardening.
- [x] Define a stable connection runtime key builder for private and public stream requests. Status:
  partially implemented; the key builder exists, but its sharing guarantees are not covered by
  regression tests.
- [ ] Add tests proving two widgets with the same effective stream request share one WebSocket.
  Status: not implemented.
- [ ] Add tests proving charts/passive widgets do not open WebSockets when bound to an active stream
  source. Status: not implemented.
- [ ] Add tests proving settings subscribes read-only to an active stream store entry. Status: not
  implemented.
- [ ] Add tests proving closing settings does not decrement or release the runtime-owner
  subscription. Status: not implemented.
- [ ] Add tests proving a draft diagnostic stream uses a separate preview key and cannot replace the
  canonical active entry. Status: not implemented.
- [ ] Split `CustomWidgetSettingsPage` into immediate shell and deferred body components. Status:
  partial; an external instant shell exists and same-widget reopen no longer bypasses it, but the
  page body remains monolithic.
- [x] Remove the embedded settings page's fresh full-page `DashboardWidgetDependenciesProvider`.
  Status: implemented for the embedded overlay path.
- [x] Use the parent dependency provider for persisted settings-tab reads. Status: implemented for
  the embedded overlay path.
- [x] Create draft dependency providers only inside the bindings/managed-connection paths that need
  draft graph validation. Status: partially implemented; the bindings path is scoped to the active
  bindings tab, but the lazy one-widget resolver is still missing.
- [ ] Add a lazy or scoped dependency-resolution API so one-widget settings reads do not eagerly
  build the full workspace graph. Status: not implemented.
- [x] Defer `WidgetSettingsPanel` preview mount until after first paint. Status: implemented in the
  shared panel; stream widgets can now opt into demo-only preview policy.
- [x] Defer `WidgetSettingsAdvancedSections` controller and custom settings work behind localized
  placeholders. Status: implemented in the shared panel; same-widget overlay reopen no longer
  bypasses the outer shell.
- [x] Make widget-specific test panels opt-in where they perform network, stream, discovery, or
  large schema work. Status: implemented for `connection-stream-query`; other widgets are
  unverified.
- [x] Update `connection-stream-query` settings so opening the settings page reads live runtime
  state without owning the WebSocket lifecycle. Status: implemented for the default settings path;
  diagnostics remain explicit and opt-in.
- [x] Update `ConnectionStreamQueryTestPanel` so it is hidden or secondary when a matching active
  store entry already exists. Status: implemented for settings open; the panel now mounts only after
  the user opens diagnostics and observes active runtime through a throttled store read.
- [ ] Update managed connection settings so an active hidden source shows live store status instead
  of requiring a test. Status: unverified.
- [ ] Ensure `dashboard` and `widget-settings` do not change provider keys or error-boundary reset
  keys in a way that remounts the workspace runtime. Status: implemented by runtime surface mapping,
  but missing regression tests.
- [ ] Add tests for returning from widget settings to dashboard without surface-return hydration.
  Status: not implemented.
- [ ] Add timing assertions or debug traces that make accidental whole-workspace settings work
  visible in development. Status: not implemented.
- [ ] Update [src/features/dashboards/README.md](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/features/dashboards/README.md) with the finalized implementation rules.
  Status: partial; overlay generation and runtime ownership rules are documented, but remaining
  runtime-state flush work is not finalized.
- [ ] Update [src/widgets/shared/README.md](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/widgets/shared/README.md) if shared settings panel ownership or preview behavior changes.
  Status: implemented for `settingsPreviewMode`; pending further updates if shared panel ownership
  changes again.

## Guardrails

- Do not reintroduce hidden full-workspace component mounts in widget settings.
- Do not create a second dashboard execution provider for embedded widget settings.
- Do not let settings preview own canonical source-widget runtime.
- Do not let charts or passive widgets open WebSockets for a stream already owned by a source
  widget.
- Do not present "Test request" as the normal next step when a matching connection runtime entry is
  already active.
- Do not run full dependency graph construction on the initial settings-open path.
- Do not let WebSocket widgets treat settings preview as a live stream mount.
- Do not block overlay shell paint on schema discovery, connection instance reads, OpenAPI reads,
  stream tests, or controller context hydration.

## Backend Contract Impact

This ADR is frontend-only if implemented as described.

It does not change:

- persisted workspace shape
- widget props shape
- widget binding shape
- widget runtime-state shape
- backend widget registry payload shape
- backend connection or stream endpoint contracts

The new `ConnectionRuntimeStore` is an in-browser runtime ownership and status store. It does not
persist to workspace storage and does not require a backend schema change.

Backend work is required only if implementation discovers that the frontend cannot cheaply read
existing user/workspace/widget runtime state without additional backend support. That would be a
separate contract change and must be documented before implementation.

## Success Criteria

- settings shell appears immediately for a selected widget
- opening settings does not unmount the canvas subtree
- opening settings does not close or recreate live WebSocket sessions
- widgets and charts that observe the same effective stream request reuse one active store entry
  and one WebSocket session
- settings for an already-active connection shows live status instead of requiring a test run
- opening settings in a WebSocket-heavy workspace does not scale with every widget's live runtime
  payload
- returning from settings to dashboard is immediate
- dependency and preview work is visible as localized loading inside the settings body, not as a
  full-page freeze
