# ADR: Widget Agent Context Bindings for Agent Terminal Consumers

- Status: Accepted
- Date: 2026-04-14
- Related:
  - [Workspaces](../workspaces/overview.md)
  - [ADR: First-Class Widget Bindings and Dependency Graph](./adr-widget-bindings-and-dependency-graph.md)
  - [ADR: Binding-Level Output Transforms for Structured Widget Outputs](./adr-binding-output-transforms.md)
  - [ADR: Agent-Ready Widget Type Registry Contract](./adr-agent-ready-widget-type-registry-contract.md)
  - [ADR: Live Workspace Agent Snapshot Archive](./adr-live-workspace-agent-snapshot-archive.md)

## Context

The `Agent Terminal` widget currently exposes one bindable input:

- `Prompt on refresh`
- contract: `core.value.string@v1`

and one bindable output:

- `Latest assistant markdown`
- contract: `core.value.string@v1`

That model is too narrow for the actual authoring goal.

The workflow we want is:

- a saved terminal instruction such as:
  `Analyze the data from the table and the graph and tell me what to do.`
- plus several upstream widget contexts
- composed into one automated refresh request to the bound agent session

The current prompt-binding model is the wrong abstraction for that use case:

- it lets another widget override the terminal's saved prompt entirely
- it only accepts plain strings
- it does not let the terminal reason over what a bound widget is currently showing

At the same time, the platform now already has the right semantic source of truth:

- widgets can implement `buildAgentSnapshot(...)`
- that snapshot explains what a mounted widget is currently showing
- the workspace snapshot archive already uses that contract for live agent-facing capture

We should reuse that work instead of inventing a second parallel "AI context" serialization path.

## Decision

We will introduce a standard bindable widget context contract derived from the existing live widget
snapshot contract, and use it as the upstream context source for `Agent Terminal`.

### 1. Prompt text stays a saved widget setting

`Agent Terminal` will keep a saved `promptOnRefresh` setting, but that prompt will no longer be a
bindable widget input.

This means:

- the terminal's refresh prompt is authored in widget settings
- upstream widgets cannot override it directly
- manual terminal input remains independent from refresh automation

### 2. Widgets will expose a standard agent-context binding contract

We will add a standard contract id:

- `core.widget-agent-context@v1`

This contract is for agent-facing upstream context, not for user-facing chart/table rendering.

It is the binding contract the terminal will consume when it wants to reason over other widgets.

### 3. The agent-context value is derived from `buildAgentSnapshot(...)`

We will not hand-maintain a second widget-specific context serializer.

Instead, the platform will derive agent context from the widget's existing
`buildAgentSnapshot(...)` hook using the compact `evidence` profile.

Recommended logical shape:

```ts
interface WidgetAgentContextValue {
  contractVersion: "v1";
  widgetId: string;
  instanceId: string;
  title: string;
  snapshot: WidgetAgentSnapshot;
}
```

Where `snapshot` is the same semantic object already used by the live workspace archive:

- `displayKind`
- `state`
- `summary`
- optional structured `data`

### 4. The agent-context output is platform-generated

The standard `agent-context` output should be synthesized by the widget platform for widgets that
already implement `buildAgentSnapshot(...)`.

This is the preferred design because it keeps the contract aligned with snapshot capture without
requiring every widget definition to manually duplicate one more output port.

Implications:

- widgets that implement `buildAgentSnapshot(...)` can publish one synthetic output:
  - output id: `agent-context`
  - contract: `core.widget-agent-context@v1`
- widgets without `buildAgentSnapshot(...)` do not publish that output yet

### 5. Agent Terminal will consume many upstream contexts

`Agent Terminal` will replace the bindable prompt input with a new input similar to:

- `Upstream widget context`
- contract: `core.widget-agent-context@v1`
- `cardinality: "many"`

This lets one terminal bind to several widgets at once.

### 6. Automated refresh composes saved prompt plus upstream context

On refresh, the terminal will construct the actual agent request input from:

1. the saved `promptOnRefresh`
2. the bound upstream widget contexts

The runtime will format those contexts into one composed request payload such as:

```md
Analyze the data from the bound widgets and tell me what to do.

## Widget: Rates Table
Type: table
Summary: 250 rows across 8 visible columns.
Data:
...

## Widget: Exposure Graph
Type: chart
Summary: 4 series rendered from 1,200 rows.
Data:
...
```

Manual terminal typing must remain unchanged. This composition rule applies only to automated
refresh behavior.

### 7. Existing latest-assistant output stays

`Latest assistant markdown` remains a published string output.

That output is still useful for:

- chaining one terminal into another terminal
- piping assistant output into `Upstream Inspector`
- debugging agent-monitor workspaces

### 8. Agents Monitor remains a separate surface concern

The `Agent Terminal` contract change is platform-wide. It is not limited to
`/app/main_sequence_ai/monitor`.

However, the current `Agents Monitor` surface only allows:

- `Agent Terminal`
- `Upstream Inspector`

If the desired workflow is specifically "table + graph -> terminal" inside Agents Monitor, that
surface allowlist must be widened separately. This ADR does not force that policy decision, but it
does make the terminal capable of consuming those contexts anywhere the widgets are available.

## Goals

- Keep terminal refresh prompts authored by the user, not overridden by upstream widgets.
- Reuse the existing widget live-snapshot contract instead of inventing a parallel agent-context
  serializer.
- Let one terminal consume several upstream widgets.
- Make agent reasoning depend on what source widgets are currently showing, not on brittle raw DOM
  scraping or ad hoc string ports.
- Keep manual terminal input behavior unchanged.

## Non-Goals

- Binding `agentSessionId`
- Binding the live terminal stdin prompt
- Binding full transcripts or tool call streams directly
- Replacing the existing `Latest assistant markdown` output
- Requiring every widget to manually define a custom AI output port
- Forcing `Agents Monitor` to include non-AI widgets in this same change

## Architecture

### 1. One standard contract, one synthetic output id

The platform should standardize:

- contract: `core.widget-agent-context@v1`
- output id: `agent-context`

This output should appear automatically for widgets whose definitions implement
`buildAgentSnapshot(...)`.

### 2. Evidence-profile snapshots are the binding source

The context output should be derived from `buildAgentSnapshot(...)` using the compact
`snapshotProfile: "evidence"` path.

This keeps binding payloads smaller and more stable than full archive exports.

If a widget later needs a more specialized compact context, we may add a dedicated
`buildAgentContext(...)` hook in the future, but the first slice should not introduce that extra
surface area.

### 3. Terminal input composition belongs in the terminal runtime

The binding engine should resolve the upstream agent-context inputs.

The terminal widget runtime should then:

- read the saved prompt
- read the resolved upstream contexts
- format them into one agent-facing request string
- submit that request on automated refresh

This keeps:

- binding resolution in the shared platform
- terminal-specific prompt composition in the terminal widget

### 4. Multi-binding authoring must become first-class in settings

The shared binding model already supports `cardinality: "many"` in storage and dependency
resolution.

The shared widget binding settings UI must catch up so users can:

- add several upstream sources to one input
- remove one source without clearing the rest
- preserve source order when order matters for prompt composition
- preview each bound upstream context clearly

## Implementation Status

Implemented on the client, with automated verification coverage still pending.

Current behavior is now:

- `Agent Terminal` keeps `promptOnRefresh` as a saved widget setting only
- `Agent Terminal` consumes many upstream `agent-context` bindings
- widgets with `buildAgentSnapshot(...)` publish a synthetic `agent-context` output
- the generic bindings panel can author `cardinality: "many"` inputs directly

## Tasks To Implement

- [x] Add a standard widget contract id for agent context, `core.widget-agent-context@v1`, in the shared widget contract/value-contract area.
- [x] Add a shared runtime type for the agent-context binding payload, wrapping widget identity plus `WidgetAgentSnapshot`.
- [x] Add a shared helper that builds one compact agent-context value from `buildAgentSnapshot(...)` using `snapshotProfile: "evidence"`.
- [x] Teach the widget dependency/output resolution layer to synthesize one `agent-context` output for widgets that implement `buildAgentSnapshot(...)`.
- [x] Make the resolved IO/output layer expose that synthetic output so it appears in graph diagnostics and the bindings UI.
- [x] Decide whether registry/type-sync output metadata should also advertise the synthetic `agent-context` capability for widgets that support `buildAgentSnapshot(...)`.
- [x] Remove the bindable `Prompt on refresh` input from `Agent Terminal`.
- [x] Keep `promptOnRefresh` as a saved widget setting in `AgentTerminalWidgetSettings.tsx`.
- [x] Add a new `Agent Terminal` input such as `Upstream widget context` that accepts `core.widget-agent-context@v1`.
- [x] Mark that new terminal input with `cardinality: "many"`.
- [x] Add terminal-side formatting helpers that combine the saved prompt with a stable ordered list of upstream widget contexts.
- [x] Update the terminal refresh path so automated refresh submits `saved prompt + bound widget context`, while manual typing remains unchanged.
- [x] Keep `Latest assistant markdown` as a published output and document that it remains independent from the new agent-context input model.
- [x] Upgrade the shared widget bindings panel so `cardinality: "many"` inputs can add, list, edit, remove, and preserve multiple bindings.
- [x] Show clearer previews for multi-bound agent-context inputs so users can see which widget summaries will be sent to the terminal.
- [x] Decide whether multi-binding order should be user-reorderable in the generic bindings UI or simply preserve insertion order in the first slice.
- [x] Update `Agent Terminal` docs and registry/usage guidance to explain that the saved prompt is no longer bindable and upstream widget context is the bindable input.
- [x] Update platform widget docs so `buildAgentSnapshot(...)` is documented as the source for both archive capture and bindable agent context.
- [x] If the intended workflow must work inside `/app/main_sequence_ai/monitor`, widen that surface allowlist beyond `Agent Terminal` and `Upstream Inspector`, or document explicitly that richer agent-context authoring belongs in general workspaces.
- [ ] Add verification coverage for:
  - one terminal bound to several upstream contexts
  - refresh composition using saved prompt plus context
  - no prompt override via bindings
  - unchanged manual terminal input behavior
  - stable downstream latest-assistant publication

## Completion Criteria

This ADR is complete when all of the following are true:

- `Agent Terminal` no longer exposes a bindable prompt input.
- Widgets with `buildAgentSnapshot(...)` can publish a synthetic `agent-context` binding output.
- `Agent Terminal` can bind to several upstream widget contexts.
- Automated refresh sends one composed request built from the saved prompt plus upstream widget context.
- Manual terminal typing remains direct and unchanged.
- The bindings UI can author `many` inputs without raw JSON editing.
- Documentation and local READMEs describe the new model accurately.
