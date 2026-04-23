# ADR: Live Workspace Agent Snapshot Archive

- Status: Accepted
- Date: 2026-04-14
- Related:
  - [Workspaces](../workspaces/overview.md)
  - [ADR: Shared Workspace Content vs Per-User View State](./adr-shared-workspace-state.md)
  - [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr-executable-widget-graph-runner.md)
  - [ADR: Single Runtime Owner for Workspace Widgets](./adr-single-runtime-owner-workspace-widgets.md)
  - [ADR: Agent-Ready Widget Type Registry Contract](./adr-agent-ready-widget-type-registry-contract.md)

## Context

The current workspace JSON export is a persistence and recovery artifact.

It is produced from the saved workspace document in
[`src/features/dashboards/custom-dashboard-storage.ts`](../../src/features/dashboards/custom-dashboard-storage.ts)
and intentionally captures the workspace model:

- workspace metadata
- controls
- layout
- widget props
- bindings
- widget runtime state when persisted by the widget

That export is useful for:

- backup and restore
- import/export
- revision-like transport
- workspace migration and debugging

It is not enough for an agent that needs to understand what the user is actually seeing right now.

The missing pieces are:

- live widget output and rendered state
- visible table rows and chart series
- hidden/sidebar/collapsed widget content that is still part of the workspace state
- the current widget relationship graph as a first-class artifact

This cannot be solved by a plain HTTP request to the static SPA route. A request client such as
Python `requests` can download the app shell, but it cannot execute the React runtime, mount the
workspace, or inspect the live widget tree.

We therefore need a separate live-runtime artifact designed for agent consumption.

## Decision

We will introduce a new live workspace capture flow called the **workspace agent snapshot archive**.

This archive is intentionally separate from the existing JSON workspace export.

### The existing JSON export stays unchanged

The current JSON export remains the canonical workspace document export/import format.

It must not be repurposed into:

- a widget data dump
- a graph capture archive
- a general agent-facing runtime artifact

### The new archive is a live runtime artifact

The new workspace agent snapshot archive will:

- run inside the real mounted client runtime
- capture what the workspace is displaying now
- include structured per-widget summaries for agents
- include JSON relationship, live-state, and widget-output artifacts
- bundle everything into one zip file

The client will generate the archive locally and return it to the caller. It will not upload the
archive to the backend by default.

## Implementation Status

Implemented on the client:

- route-level snapshot mode with `?snapshot=true`
- profile selection with `snapshotProfile=evidence|full-data`
- client-side zip assembly
- dependency graph JSON export
- per-widget structured snapshot files
- browser completion contract through `window.__COMMAND_CENTER_SNAPSHOT__` and
  `command-center:snapshot-ready`

Explicitly not implemented in this repository:

- Python/browser runner orchestration
- backend snapshot upload or storage

## Goals

- Give agents a truthful view of the current workspace state.
- Keep the persistence/export model separate from the live inspection model.
- Avoid adding backend snapshot storage for artifacts that are only needed by the caller.
- Reuse the real workspace runtime instead of duplicating widget semantics in Python.
- Make the output portable as a single zip archive.

## Non-Goals

- Replacing the existing workspace JSON export/import flow
- Turning the static SPA route into an authenticated API endpoint
- Reimplementing widget rendering in Python
- Requiring backend snapshot persistence

## Architecture

### 1. Snapshot mode is a route-level runtime mode

The workspace route will gain a snapshot mode:

- `/app/workspace-studio/workspaces?workspace=<id>&snapshot=true`

This route remains a normal SPA route. It is not an API endpoint.

When snapshot mode is active, the client should:

- suppress nonessential shell chrome
- load the requested workspace and current-user runtime state
- mount the normal dashboard runtime providers
- expand collapsed workspace rows in the mounted snapshot runtime so row-owned widgets are visible
  to automation without persisting that expansion
- rely on the shared dashboard execution provider for normal initial refresh and refresh-cycle
  orchestration
- wait for active refresh/execution work to settle or timeout
- collect structured widget snapshots
- collect the widget relationship graph
- assemble the zip archive
- expose the result to the external runner

Snapshot mode does not force a separate manual dashboard refresh. It captures the current mounted
runtime state after the normal execution layer reports no active refresh cycle and no running widget
executions.

### 2. Authentication is bootstrapped into the client runtime

The caller may have either:

- canonical interactive JWT auth material: access JWT plus refresh JWT
- runtime credential auth material: `MAINSEQUENCE_ACCESS_TOKEN`

The client already restores authenticated session state from browser local storage through
[`src/auth/jwt-auth.ts`](../../src/auth/jwt-auth.ts) and
[`src/auth/auth-store.ts`](../../src/auth/auth-store.ts).

The runner should therefore authenticate the SPA by writing:

- localStorage key: `command-center.jwt-auth`

with one of the stored token shapes the client already understands.

For normal human-equivalent sessions, use the canonical JWT+refresh payload shape. For
machine-run browser automation, prefer the runtime credential shape:

```json
{
  "authMode": "runtime_credential",
  "MAINSEQUENCE_ACCESS_TOKEN": "<runtime access JWT>"
}
```

The runtime credential is still sent as `Authorization: Bearer <runtime access JWT>`, but the
client treats it as a scoped machine/runtime identity with no refresh token and no interactive
logout call.

This keeps auth aligned with the existing runtime and avoids inventing a special snapshot-only auth
path.

### 3. A real browser runtime is required

The archive must be generated by the real client runtime in a browser engine.

That may be:

- an interactive browser
- a hidden browser window
- a browser automation runner launched from Python

It must not rely on a plain HTTP request client alone.

### 4. The archive is returned to the caller, not uploaded by default

The archive should be exposed directly from the page runtime to the caller.

Recommended completion mechanism:

- the client writes a completion payload to `window`
- the client dispatches a completion event
- the runner reads the zip bytes or a generated Blob URL through the browser automation API

The backend is not part of the normal archive transport.

## Archive Structure

The artifact will be a zip file with a stable manifest plus per-widget files.

Recommended shape:

```text
workspace-agent-snapshot-<workspaceId>-<timestamp>.zip
  manifest.json
  workspace-definition.json
  workspace-live-state.json
  controls.json
  relationships/widget-graph.json
  widgets/<instanceId>/snapshot.json
  widgets/<instanceId>/data.json
  widgets/<instanceId>/chart-data.json
  widgets/<instanceId>/response.json
```

Not every widget will emit every file type. The manifest is the source of truth for which files
exist.

## Snapshot Layers

The archive intentionally combines multiple layers.

### 1. Workspace definition

This is the saved workspace model:

- metadata
- layout
- bindings
- widget props
- persisted runtime state

This should reuse the same underlying definition already exported by the JSON workspace snapshot.

### 2. Live workspace state

This is the live runtime view:

- current view (`canvas`, `graph`, future `presentation`)
- current controls state
- selected widget or graph focus when present
- visible widget order and visibility state
- current widget execution/loading/error state

### 3. Widget relationship graph

The archive will include the current workspace relationship graph derived from the shared dependency
model in [`src/dashboards/widget-dependencies.ts`](../../src/dashboards/widget-dependencies.ts).

The archive should include:

- graph JSON

### 4. Structured Evidence

The archive intentionally does not generate screenshots, rendered graph images, hidden-widget
report images, or CSV/text exports. Hidden/sidebar/collapsed widgets remain visible to agents
through the structured widget records in `workspace-live-state.json` and per-widget JSON files.

## Widget Snapshot Contract

Each widget family should contribute a structured live snapshot.

Minimum contract:

- widget identity
- title
- visibility
- layout
- runtime status
- short summary
- structured display payload
- optional raw export files

Examples:

- Data Node table widgets:
  visible columns, row count, visible rows, sort/filter state, optional raw export
- Data Node chart widgets:
  chart type, visible series, x/y/group fields, visible range, chart data
- AppComponent widgets:
  current form values, selected target, last response summary, response preview
- Markdown/note widgets:
  raw content, rendered text summary

## Data Volume Policy

Some widgets, especially Data Node families, may produce large data.

The archive therefore needs capture profiles.

### Default profile: `evidence`

Includes:

- workspace definition
- live state
- graph JSON
- visible rows/series and compact structured summaries

### Optional profile: `full-data`

Includes everything in `evidence`, plus raw widget exports where supported.

This keeps the default capture operationally safe while still allowing deeper investigation when
needed.

## Separation From JSON Export

The current JSON workspace export and the new archive must remain separate in code, UX, and docs.

### JSON workspace export remains:

- deterministic
- document-oriented
- importable
- persistence-friendly

### Agent snapshot archive becomes:

- live-runtime-oriented
- JSON- and data-bearing
- not importable as a workspace document
- intended for agent inspection and debugging

Do not merge these two flows into one UI action or one serializer.

## Runner Contract

The expected caller is an external runner, for example Python controlling a real browser runtime.

Expected flow:

1. open a browser context
2. write `command-center.jwt-auth` into local storage with canonical JWT+refresh tokens or with
   `authMode: "runtime_credential"` plus `MAINSEQUENCE_ACCESS_TOKEN`
3. navigate to `/app/workspace-studio/workspaces?workspace=<id>&snapshot=true`
4. wait for the page-level snapshot completion event and require `status: "ready"` in the event
   detail or `window.__COMMAND_CENTER_SNAPSHOT__`
5. read the archive bytes and persist them locally

This keeps the archive generation inside the client while keeping orchestration outside it.

## Completion Criteria

This work is only complete when all of the following are true.

### Phase 1: Core contract and route

- A new snapshot mode exists for the workspace route.
- Snapshot mode is separate from the current JSON export/import flow.
- Snapshot mode can authenticate from the shared local-storage auth session shape.
- The page exposes a machine-readable completion signal for automation.

### Phase 2: Workspace-level archive assembly

- The client can assemble a zip archive in the browser runtime.
- The archive includes `manifest.json`.
- The archive includes `workspace-definition.json`.
- The archive includes `workspace-live-state.json`.
- The archive includes `controls.json`.

### Phase 3: Relationship graph capture

- The archive includes `relationships/widget-graph.json`.
- The graph export reuses the shared dependency model instead of a second graph implementation.

### Phase 4: JSON-only evidence

- The archive does not include generated images or screenshots.
- Hidden/sidebar/collapsed widgets are represented through structured JSON records.

### Phase 5: Widget-family live snapshots

- Main Sequence Data Node source widgets emit structured live snapshots.
- Table widgets emit visible-table snapshots.
- Graph/chart widgets emit structured chart snapshots.
- AppComponent emits structured request/response snapshots.
- Markdown/note widgets emit content snapshots.

### Phase 6: Volume controls

- Capture profiles exist for `evidence` and `full-data`.
- The default path is safe for large workspaces.
- Large data exports are optional and clearly represented in the manifest.

### Phase 7: Runner integration

- A browser automation runner can bootstrap auth using canonical JWT+refresh tokens or the runtime
  credential `MAINSEQUENCE_ACCESS_TOKEN`.
- The runner can trigger snapshot mode with only workspace id plus profile inputs.
- The runner can persist the generated zip without backend upload.

## Missing Tasks

### Route and runtime

- [x] Add route-level snapshot mode parsing in `useCustomWorkspaceStudio.ts`.
- [x] Add a snapshot runtime shell in `WorkspaceStudioCanvasHost.tsx`.
- [x] Add a dedicated snapshot capture module under `src/features/dashboards/`.
- [x] Add a machine-readable page completion contract for automation.
- [x] Expose snapshot completion through `window` plus a `CustomEvent`.

### Auth bootstrap

- [x] Support snapshot runner auth bootstrap through the existing `command-center.jwt-auth`
      local-storage contract.
- [x] Document the bootstrap payload shape for canonical access/refresh JWTs and runtime
      credentials.
- [ ] Validate that snapshot mode can restore canonical JWT and runtime credential sessions without
      a manual login flow in a real machine-run browser.

### Archive contract

- [x] Define `WorkspaceAgentSnapshot`.
- [x] Define `WidgetAgentSnapshot`.
- [x] Define the archive manifest contract.
- [x] Define capture-profile contracts for `evidence` and `full-data`.
- [x] Reuse the existing workspace document serializer for `workspace-definition.json` instead of
      inventing a second workspace export format.
- [x] Add `workspace-live-state.json`.
- [x] Add `controls.json`.

### Relationship graph

- [x] Reuse `src/dashboards/widget-dependencies.ts` to export
      `relationships/widget-graph.json`.
- [x] Ensure graph export uses the same dependency model as the normal workspace graph view.

### JSON-only evidence

- [x] Keep generated images and screenshots out of the archive.
- [x] Represent hidden/sidebar/collapsed widget state through structured JSON.

### Widget-family snapshots

- [x] Implement live snapshot support for Main Sequence Data Node source widgets.
- [x] Implement live snapshot support for table widgets.
- [x] Implement live snapshot support for chart/graph widgets.
- [x] Implement live snapshot support for AppComponent widgets.
- [x] Implement live snapshot support for Markdown/note widgets.

### Data export and volume control

- [x] Add optional raw data export support for widgets that can safely emit it.
- [x] Add size guards so large DataNode exports are opt-in.
- [x] Mark skipped or truncated payloads explicitly in the manifest.
- [x] Add per-widget timeout and capture-failure reporting to the manifest.

### Zip assembly and runner integration

- [x] Add zip assembly in the client runtime.
- [x] Expose the generated archive to the browser automation runner without backend upload.
- [ ] Document the Python/browser runner lifecycle.
- [ ] Add one end-to-end runner flow for automated verification.

### Documentation and regression coverage

- [x] Keep the JSON workspace export/import docs explicitly separate from the live agent archive
      docs.
- [ ] Add a sample archive fixture or golden manifest for regression testing.
- [ ] Add verification criteria for archive completeness, large-data safety, and auth bootstrap.

## Guardrails

- Do not change the current JSON workspace export into an agent archive.
- Do not require backend snapshot storage for the normal archive flow.
- Do not pass raw JWTs in query params.
- Do not treat a plain HTTP request client as sufficient to generate a live archive.
- Do not duplicate the workspace graph model just for archive generation.
- Do not silently export full raw data by default for large widgets.
