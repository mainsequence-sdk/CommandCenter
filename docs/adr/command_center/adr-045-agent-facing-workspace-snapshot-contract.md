# ADR-045: Agent-Facing Workspace Snapshot Contract

- Status: Accepted
- Date: 2026-04-29
- Related:
  - [Workspaces](../../workspaces/overview.md)
  - [ADR: Live Workspace Agent Snapshot Archive](./adr-live-workspace-agent-snapshot-archive.md)

## Context

The current live workspace snapshot archive was designed as a broad runtime export.

That made it easy to capture data, but it also produced multiple overlapping representations of the
same workspace:

- `workspace-definition.json` repeated the persisted workspace document
- `relationships/widget-graph.json` described structure the current agent flow does not consume
- `controls.json` duplicated runtime context that was not central to "what is the agent seeing"
- `manifest.json` described files that the archive structure already makes discoverable
- `workspace-live-state.json` duplicated per-widget snapshot content that also existed in
  `widgets/.../snapshot.json`

For an agent consumer, this creates a worse contract:

- more files to inspect before reaching the useful content
- duplicated facts with no clear source of truth
- document-oriented workspace persistence mixed into a runtime-observation artifact

The snapshot contract should optimize for one job only: capture the actual widget state and data an
agent needs in order to understand what the mounted workspace is currently showing.

## Decision

The live workspace snapshot archive is an agent-facing observation artifact.

It keeps only the files that help an agent understand the mounted workspace runtime, and it must
avoid repeating the same information in more than one place.

### Source of truth

- `widgets/.../snapshot.json` is the source of truth for per-widget state and interpretation

### Exact archive contents

The archive contains only these files:

- `widgets/<widget-directory>/snapshot.json`

No other files are part of the contract.

The produced archive folder structure is:

```text
workspace-live-snapshot-<timestamp>.zip
  widgets/
    <widget-directory>/
      snapshot.json
```

### Exact file contents

`widgets/<widget-directory>/snapshot.json` contains the actual widget-level dump. It includes:

- `instanceId`
- `widgetName`
- `widgetType`
- `source`
- `connectionTypeName`
- `placementMode`
- `hidden`
- `hiddenReason`
- `layout`
- `parentRowId`
- `snapshot`

`widgets/<widget-directory>/snapshot.json.snapshot` is the structured `WidgetAgentSnapshot`
payload returned by `buildAgentSnapshot(...)`.

### Snapshot objective

The archive should capture state and information, not broad metadata dumps.

At the widget level, the archive should prioritize:

- widget name
- connection type name when applicable
- widget source
- the actual state and data shown by the widget

### Files to remove

The archive will not include:

- `workspace-live-state.json`
- `workspace-definition.json`
- `relationships/widget-graph.json`
- `controls.json`
- `manifest.json`

### Widget-level file responsibilities

Each widget directory is responsible for the actual widget state dump:

- `snapshot.json` for the structured widget dump

Every widget should expose a strict `buildAgentSnapshot(...)` function.

That function is the canonical authoring point for agent-facing runtime capture. It should emit the
widget's state and data payload rather than generic UI metadata.

Connection-source widgets and transformer widgets are passthrough infrastructure. Their dumps
should stay metadata-only and must not embed transported datasets or transformed payload bodies as
agent-interpretable content.

## Rationale

This split gives the archive one clear navigation model:

1. Read `widgets/.../snapshot.json` to understand each widget.

That keeps the archive small, avoids duplicated interpretations, and preserves a clear source of
truth for agent consumers.

## Consequences

### Positive

- fewer irrelevant files for the agent to inspect
- no mixing of persistence/export concerns into runtime observation
- one clear source of truth per layer
- easier future evolution of the widget snapshot contract without rewriting workspace persistence

### Negative

- generic archive explorers lose a manifest file
- consumers that previously read relationship or controls artifacts must now use other runtime
  contracts if they still need that information

## Implementation Notes

- the persisted JSON workspace export remains separate and unchanged
- there is one agent-facing snapshot contract only; widget dumps should stay bounded and
  serialization-friendly by default
- if relationship or control context becomes necessary for agent reasoning later, it should return
  only when it has a direct interpretation use case, not as a general dump

## Tasks

- [x] Remove `workspace-definition.json` from the live snapshot archive.
- [x] Remove `relationships/widget-graph.json` from the live snapshot archive.
- [x] Remove `controls.json` from the live snapshot archive.
- [x] Remove `manifest.json` from the live snapshot archive.
- [x] Keep `widgets/.../snapshot.json` as the single per-widget source of truth.
- [x] Remove `workspace-live-state.json` because it did not add unique agent value.
- [x] Stop repeating widget identity metadata across top-level and per-widget files.
- [x] Remove redundant widget sidecar files such as `data.json`, `chart-data.json`, and
  `response.json`.
- [ ] Define a stricter agent-facing `buildAgentSnapshot(...)` schema so widget authors produce
  consistent state-and-data payloads.
- [x] Make `buildAgentSnapshot(...)` the strict required contract for widgets that participate in
  agent-facing snapshot capture.
- [x] Document that connection-source and transformer widgets are passthrough infrastructure and
  must not dump transported datasets as agent-interpretable payloads.
- [ ] Decide whether hidden widgets should stay in the archive by default or move behind an
  explicit capture option.
- [ ] Document authoring guidance for `buildAgentSnapshot(...)` implementations so new widgets emit
  agent-readable state dumps by default.
