# ADR: Agent-Ready Widget Type Registry Contract

- Status: Accepted
- Date: 2026-04-13
- Related:
  - [ADR: AppComponent as a Binding-Native API Widget](./adr-app-component-binding-native-api-widget.md)
  - [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr-executable-widget-graph-runner.md)
  - [ADR: Single Runtime Owner for Workspace Widgets](./adr-single-runtime-owner-workspace-widgets.md)

## Context

The current backend widget-type registry is only a thin catalog projection.

Today the sync manifest is mostly limited to:

- catalog identity fields such as `widgetId`, `title`, `description`, `category`, and `tags`
- static settings schema when a widget exposes `schema`
- static IO plus a `dynamic: true` hint when a widget uses `resolveIo(...)`
- default presentation metadata

That is enough for a basic catalog, but not enough for agentic or backend-driven tooling that needs
to understand how a widget type is configured and how it behaves.

The problem is most obvious for dynamic widgets such as `app-component`:

- it has custom settings instead of only static schema fields
- its concrete inputs and outputs are instance-specific after operation selection
- it has execution semantics, target modes, request/response behavior, and compilation
  requirements that are not represented in the current synced row

The current registry therefore fails at the exact use case we need:

- an admin, backend service, or agent cannot reliably understand how to configure a widget type
- an agent cannot reason about what kind of widget to build from the registry contract alone
- the sync contract does not distinguish clearly between type-level capability metadata and
  instance-level compiled metadata

## Decision

We will replace the current thin widget catalog projection with an explicit, standardized,
backend-visible widget type contract that is rich enough for agentic tooling to reason about how to
build widget instances.

The contract must be descriptive enough that an agent can answer these questions from the registry
alone:

- what this widget is for
- what configuration model it uses
- which inputs it accepts
- which outputs it can publish
- whether the IO is static or instance-derived
- whether the widget executes work or only consumes upstream data
- what modes or capabilities it supports
- what must be configured before the widget is usable

The contract must not pretend to know instance-specific details that only exist after authoring.

## Versioning

The registry needs two different versioning layers.

### 1. Global manifest version

The existing global registry version remains necessary.

It answers:

- did the overall manifest schema change
- did the payload serialization contract change

This stays at the registry-sync layer.

### 2. Per-widget type version

Every widget type must also publish its own internal version.

This answers:

- did this specific widget's type contract change
- did its authoring semantics change
- did its runtime or output behavior change in a way that matters to agents or backend tooling

The per-widget version must be part of the synced widget row so backend services can reason about
widget evolution without diffing the whole manifest.

Recommended field:

- `widgetVersion`

This should be a simple string version owned by the widget definition.

It must be bumped when any of these change materially:

- type-level configuration model
- accepted input contracts
- published output contracts
- execution behavior
- capability modes
- agent-facing authoring requirements

It does not need to bump for purely cosmetic changes that do not affect authoring or behavioral
semantics.

## Scope Boundary

The new registry contract must describe widget-type behavior, not instance snapshots.

### Type-level metadata belongs in the registry

- widget purpose and category
- runtime ownership mode
- configuration model
- static schema fields
- dynamic-configuration summary
- static IO
- dynamic IO semantics
- execution behavior
- supported capability modes
- agent-facing usage notes

### Instance-level metadata does not belong in the registry

- selected upstream binding ids
- selected OpenAPI operation ids for one saved widget instance
- compiled request forms for one saved widget instance
- concrete resolved input ports for one saved widget instance
- concrete resolved output ports for one saved widget instance
- user-entered instance props and runtime state

This distinction is mandatory. The registry must be truthful about what it knows.

## Standard Contract

Every synced widget type will expose the same top-level sections.

### 1. `identity`

Required for every widget:

- `widgetVersion`
- `widgetId`
- `title`
- `description`
- `kind`
- `category`
- `source`
- `tags`
- `requiredPermissions`

### 2. `runtime`

Required for every widget:

- `workspaceRuntimeMode`
  - `execution-owner`
  - `consumer`
  - `local-ui`
- `supportsExecution`
- `refreshPolicy`
- `executionTriggers`
- `executionSummary`

### 3. `configuration`

Required for every widget:

- `mode`
  - `static-schema`
  - `custom-settings`
  - `hybrid`
  - `none`
- `sections`
- `fields`
- `dynamicConfigSummary`
- `configurationNotes`
- `requiredSetupSteps`

Static-schema widgets may derive this mostly from `schema`.
Custom or hybrid widgets must publish explicit type-level configuration metadata instead of leaving
the registry empty.

### 4. `io`

Required for every widget:

- `mode`
  - `none`
  - `static`
  - `dynamic`
  - `consumer`
- `inputs`
- `outputs`
- `dynamicIoSummary`
- `inputContracts`
- `outputContracts`
- `ioNotes`

For dynamic widgets, the contract must explain why ports are dynamic and what they depend on.

### 5. `capabilities`

Required when the widget supports modes, strategies, or typed behaviors that materially affect how
an agent should configure it.

Examples:

- supported source modes for `main-sequence-data-node`
- supported chart providers for `main-sequence-data-node-visualizer`
- supported target modes and auth strategies for `app-component`
- transform support, parser behavior, or aggregation options where relevant

### 6. `agentHints`

Required for every widget:

- `buildPurpose`
- `whenToUse`
- `whenNotToUse`
- `authoringSteps`
- `blockingRequirements`
- `commonPitfalls`

This section must be concise, explicit, and machine-readable enough for agent workflows without
being tied to a specific LLM implementation.

### 7. `examples`

Recommended for every widget, required for dynamic or execution-owner widgets:

- example configuration shapes
- example upstream binding usage
- example output behavior summaries

These remain type-level examples, not live instance payloads.

## Architecture

### 1. Explicit contract over inference

We will stop relying on scraping React-oriented widget definition fields as the primary backend
contract.

The current fields such as:

- `schema`
- `resolveIo(...)`
- `settingsComponent`
- `execution`

remain important runtime implementation hooks, but they are not sufficient as the registry source
of truth.

We will add an explicit backend-visible widget type contract to `WidgetDefinition`.

### 2. Safe derivation remains allowed

Static widgets may still derive parts of the registry contract automatically from:

- `schema`
- `io`
- `workspaceRuntimeMode`
- `execution`

But the sync layer must prefer explicit contract sections whenever a widget provides them.

### 3. Dynamic widgets must not hide behind empty schema

Widgets with custom settings or instance-derived IO must publish an explicit contract describing:

- how configuration works
- what dynamic IO depends on
- what the execution surface does

An empty `schema_payload` is not an acceptable final contract for agent-facing registry use.

### 4. Backend manifest validation becomes strict

The platform must reject publication of incomplete real widgets.

Before a widget type can be published, it must have:

- a runtime classification
- a configuration mode
- an IO mode
- non-empty agent hints
- capability summaries where applicable

## Widget Class Templates

To keep the registry standardized, widgets will follow one of these contract templates.

### A. `local-ui`

For widgets that do not own runtime execution and do not participate in binding-driven dataflow.

Must define:

- `runtime.workspaceRuntimeMode = "local-ui"`
- `configuration`
- `agentHints`

IO and execution sections can be minimal.

### B. `consumer`

For widgets that render upstream typed outputs.

Must define:

- accepted upstream contracts
- field requirements and assumptions
- consumer-only runtime behavior
- any formatting or rendering constraints

### C. `execution-owner`

For widgets that own canonical runtime execution.

Must define:

- refresh behavior
- execution triggers
- output publication summary
- required setup before execution is valid

### D. `dynamic execution-owner`

For widgets like `app-component` where the exact authoring surface is partly instance-derived.

Must additionally define:

- dynamic configuration summary
- dynamic IO explanation
- blocking setup requirements
- examples of valid authored shapes

## AppComponent Standard

`app-component` is the reference case for why this ADR exists.

Its registry contract must explicitly declare:

- runtime ownership as `execution-owner`
- configuration mode as `custom-settings`
- supported target modes
- supported auth modes
- request input categories
  - path
  - query
  - header
  - body
  - form
- response publication model
- dynamic IO explanation
- requirement that a saved widget instance must have a compiled binding spec before runtime

The registry must not claim exact request fields or exact output ports for every future instance.
Those remain instance-level authoring artifacts.

## Consequences

Positive:

- backend tooling can reason about widget types instead of only listing them
- agents can choose and configure widgets from registry data without reverse-engineering React code
- dynamic widgets stop appearing as empty or opaque catalog rows
- admin publication becomes a meaningful contract publish instead of a thin manifest dump
- backend systems can identify per-widget contract changes without reinterpreting the whole
  registry manifest

Negative:

- widget definitions gain one more explicit contract surface to maintain
- the sync manifest becomes larger and more opinionated
- contract validation will force older widgets to be documented more rigorously before publication

## Rollout Tasks

This ADR is not complete until every task below is done.

### Phase 1: Contract types and sync shape

- [x] Add `widgetVersion` to the shared widget definition contract in [src/widgets/types.ts](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/widgets/types.ts)
- [x] Add explicit widget registry contract types to [src/widgets/types.ts](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/widgets/types.ts)
- [x] Add standardized sections for `identity`, `runtime`, `configuration`, `io`, `capabilities`, `agentHints`, and `examples`
- [x] Update [src/app/registry/widget-type-sync.ts](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/app/registry/widget-type-sync.ts) to serialize the explicit registry contract
- [x] Bump `WIDGET_REGISTRY_VERSION` because the backend-visible manifest contract changed
- [x] Keep safe fallback derivation for simple static widgets
- [x] Document when widget authors must bump `widgetVersion`

### Phase 2: Validation and admin visibility

- [x] Add manifest validation so incomplete real widgets cannot be published
- [x] Validate that every published real widget has a non-empty `widgetVersion`
- [x] Surface validation failures in the admin publish UI in [src/app/layout/SettingsDialog.tsx](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/app/layout/SettingsDialog.tsx)
- [x] Expand the admin manifest preview so it shows the richer contract sections, not only checksum and counts
- [x] Show per-widget version in the admin manifest preview
- [x] Add tests or sanity checks covering contract completeness for all published widgets

### Phase 3: Core widgets

- [x] Add explicit contracts for [src/widgets/core/app-component](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/widgets/core/app-component)
- [x] Add explicit contracts for [src/widgets/core/markdown-note](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/widgets/core/markdown-note)
- [x] Add explicit contracts for [src/widgets/core/workspace-row](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/widgets/core/workspace-row)

### Phase 4: Main Sequence execution-owner widgets

- [x] Add explicit contracts for [extensions/main_sequence/extensions/workbench/widgets/data-node-filter](/Users/jose/code/MainSequenceClientSide/CommandCenter/extensions/main_sequence/extensions/workbench/widgets/data-node-filter)
- [x] Add explicit contracts for [extensions/main_sequence/extensions/workbench/widgets/dependency-graph](/Users/jose/code/MainSequenceClientSide/CommandCenter/extensions/main_sequence/extensions/workbench/widgets/dependency-graph)
- [x] Add explicit contracts for [extensions/main_sequence/extensions/markets/widgets/portfolio-weights-table](/Users/jose/code/MainSequenceClientSide/CommandCenter/extensions/main_sequence/extensions/markets/widgets/portfolio-weights-table)

### Phase 5: Main Sequence consumer widgets

- [x] Add explicit contracts for [extensions/main_sequence/extensions/workbench/widgets/data-node-table](/Users/jose/code/MainSequenceClientSide/CommandCenter/extensions/main_sequence/extensions/workbench/widgets/data-node-table)
- [x] Add explicit contracts for [extensions/main_sequence/extensions/workbench/widgets/data-node-visualizer](/Users/jose/code/MainSequenceClientSide/CommandCenter/extensions/main_sequence/extensions/workbench/widgets/data-node-visualizer)
- [x] Add explicit contracts for [extensions/main_sequence/extensions/workbench/widgets/data-node-statistic](/Users/jose/code/MainSequenceClientSide/CommandCenter/extensions/main_sequence/extensions/workbench/widgets/data-node-statistic)
- [x] Add explicit contracts for [extensions/main_sequence/extensions/markets/widgets/curve-plot](/Users/jose/code/MainSequenceClientSide/CommandCenter/extensions/main_sequence/extensions/markets/widgets/curve-plot)
- [x] Add explicit contracts for [extensions/main_sequence/extensions/markets/widgets/zero-curve](/Users/jose/code/MainSequenceClientSide/CommandCenter/extensions/main_sequence/extensions/markets/widgets/zero-curve)

### Phase 6: Remaining local UI widgets in scope

- [x] Add explicit contracts for [extensions/main_sequence/extensions/workbench/widgets/project-infra-graph](/Users/jose/code/MainSequenceClientSide/CommandCenter/extensions/main_sequence/extensions/workbench/widgets/project-infra-graph)

### Phase 7: Documentation and migration completion

- [x] Update [src/app/registry/README.md](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/app/registry/README.md) to describe the new explicit registry contract once implemented
- [x] Update [src/widgets/README.md](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/widgets/README.md) to document the new widget definition contract section
- [x] Update widget-local READMEs as each widget family gains explicit type contracts
- [x] Document backend expectations for the richer manifest shape
- [x] Mark this ADR as `Accepted` once the contract is implemented and enforced for all published real widgets

## Guardrails

- Do not encode instance snapshots into the widget type registry.
- Do not rely on `settingsComponent` or `resolveIo(...)` scraping as the only explanation for
  dynamic widgets.
- Do not publish incomplete real widgets with empty agent-facing contract sections.
- Do not let mock or demo widgets define the standard for real production widgets.
