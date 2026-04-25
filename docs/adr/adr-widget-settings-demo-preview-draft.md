# ADR: Preview-Only Demo Drafts for Widget Settings

- Status: Proposed
- Date: 2026-04-24
- Related:
  - [ADR: Headless Workspace Widget Settings Runtime](./adr-headless-workspace-settings-runtime.md)
  - [ADR: AppComponent Mock JSON Target for Pipeline Prototyping](./adr-app-component-mock-json-target.md)
  - [ADR: Single Runtime Owner for Workspace Widgets](./adr-single-runtime-owner-workspace-widgets.md)

## Context

Widget settings now include a shared panel preview at the top of the settings surface. That solved
the duplication problem where individual widgets were shipping their own inconsistent preview
sections below the canonical preview.

The current preview contract is still too shallow.

Today, the shared settings surface can toggle `Demo data for preview`, but that toggle only changes
what the preview component renders. The rest of the settings surface still reads and edits the real
widget draft.

That creates a broken authoring model:

- the preview can show demo output
- the settings controls still describe the real widget instance
- data-bound widgets still depend on missing live source contracts
- some widgets render empty-state placeholders even though demo mode is enabled

The `Statistic` widget is the clearest example. It can receive demo props, but if the demo preview
does not also provide a compatible source bundle and resolved settings state, the preview still
lands in:

- `Select a value field`
- `No rows available`
- similar binding-driven empty states

This is not a `Statistic`-only bug. It is a contract mismatch between:

- preview rendering
- settings editing
- data/binding resolution
- widget-local runtime state

## Problem

If demo mode only swaps render props, the preview is not coherent.

The user expectation is stronger:

- when demo mode is on, the whole settings experience should temporarily behave like a demo widget
- the preview should look like a real configured widget panel
- settings controls should reflect demo values instead of the persisted widget draft
- changes made while demo mode is on must not mutate the real workspace draft

Without that separation, the product has two persistent failure modes:

1. visually broken previews for data-bound widgets
2. confusing settings UIs where the preview and the form describe different widget states

## Decision

We will introduce a preview-only demo draft layer for widget settings.

When demo mode is enabled:

- the settings form reads from a temporary in-memory demo draft
- widget-specific settings edit that temporary draft
- the shared panel preview renders from that temporary draft
- preview-only bindings, resolved inputs, and runtime state may also come from widget-defined mock
  contracts
- no real widget draft changes are persisted or emitted upward

When demo mode is disabled:

- the settings form reverts to the real widget draft
- the preview reverts to live draft values
- the demo draft is discarded unless explicitly preserved for the current open settings session

## Scope Boundary

This ADR is frontend-only.

It does not change:

- workspace persistence contracts
- backend widget storage shape
- saved dashboard schema
- runtime execution contracts on workspace surfaces

The preview-only draft exists only inside the settings UI state for the open editor session.

## Core Model

### 1. Two drafts, one persisted source of truth

The settings surface must maintain two independent draft layers:

- `real draft`
  - the actual widget title, props, presentation, and bindings being edited
- `demo draft`
  - a temporary preview-only draft derived from widget-defined demo contracts

Only the real draft may call:

- `onDraftPropsChange(...)`
- `onDraftPresentationChange(...)`
- `onDraftTitleChange(...)`
- binding mutation handlers
- save/persist flows

### 2. Demo mode switches the full settings reader/writer

Demo mode must not be render-only.

When enabled:

- shared settings controls read from the demo draft
- widget-specific settings components read from the demo draft
- widget-specific settings handlers write only to the demo draft
- the shared top preview renders only from the demo draft

This is the key architectural change.

### 3. Expand the demo contract beyond props

Widgets need more than `mockProps`.

The shared preview contract should support all of these where needed:

- `mockProps`
- `mockPresentation`
- `mockResolvedInputs`
- `mockRuntimeState`
- `mockTitle` where title materially affects the preview

For data-bound widgets, `mockResolvedInputs` is the critical missing piece because a realistic demo
often depends on:

- field metadata
- rows
- source labels
- upstream contract-specific bundle structure

### 4. Data widgets must provide canonical demo bundles

Widgets that consume structured upstream contracts must define demo payloads that match the real
contract shape closely enough for the widget to render meaningfully without live bindings.

For the Main Sequence Data Node family, this means the demo contract must be able to represent:

- source schema
- fields
- rows
- relevant source metadata

### 5. Demo edits are sandboxed

Changes made while demo mode is enabled must never leak into the real widget configuration unless
we later add an explicit `Apply demo to widget` action.

That action is out of scope for this ADR.

### 6. The UI must state that demo mode is isolated

While demo mode is active, the settings surface should show explicit copy such as:

- `Editing demo configuration only`

The user should never have to infer whether they are editing the real widget.

## Why This Option

This matches the mental model the settings surface is trying to create.

The user is not asking for a fake screenshot. They are asking for a temporary but coherent widget
instance they can inspect and manipulate safely.

This option keeps the preview system honest:

- preview and controls describe the same temporary state
- data widgets can render complete examples
- the real draft stays untouched
- the contract scales across widget families instead of solving `Statistic` with widget-local hacks

## Rejected Alternatives

### Keep demo mode render-only

Rejected because it preserves the current mismatch between preview output and settings controls.

### Fix each widget locally with bespoke preview logic

Rejected because that recreates the old fragmented preview system and guarantees drift across
widgets.

### Persist demo configuration into widget storage

Rejected for the first rollout because demo mode is a settings-surface authoring aid, not part of
the saved workspace contract.

### Add a completely separate demo settings screen

Rejected because it duplicates the same fields, validation, and layout already owned by the shared
settings system.

## Architecture

### 1. Shared settings surface owns preview draft orchestration

`src/widgets/shared/widget-settings.tsx` becomes the orchestration point for:

- demo-mode state
- demo draft initialization
- demo draft mutation
- preview contract resolution
- switching widget settings children between real draft and demo draft

### 2. Widget definitions provide preview fixtures, not ad hoc render branches

Widget definitions remain the canonical place to declare preview fixtures.

The shared settings surface should resolve demo contracts from the widget definition rather than
requiring widget components to guess whether they are in demo mode.

### 3. Widget settings components stay mostly unchanged

Widget-specific settings components should continue to receive the normal
`WidgetSettingsComponentProps<TProps>` shape.

The shared surface should swap the active draft and the active change handlers before those props
reach the widget settings component.

That minimizes per-widget migration cost.

### 4. Demo inputs must mirror real widget dependency contracts

Shared preview plumbing must be able to inject preview-only resolved inputs in the same shape used
by normal runtime/widget dependency resolution.

Otherwise data widgets will continue to fall back to empty-state logic.

## Rollout Phases

### Phase 1: Shared preview-draft infrastructure

Goal:

- make demo mode switch the full settings surface to a preview-only draft

Tasks:

- [ ] Add preview-only draft state to `src/widgets/shared/widget-settings.tsx`
- [ ] Keep real draft and demo draft isolated in memory
- [ ] Route shared title, presentation, and schema controls through the active draft
- [ ] Ensure demo-mode edits never call real draft mutation callbacks
- [ ] Add explicit UI copy that demo mode is preview-only

### Phase 2: Expand the shared widget demo contract

Goal:

- support demo data that is richer than props-only mocks

Tasks:

- [ ] Extend widget definition preview helpers to support `mockPresentation`
- [ ] Extend widget definition preview helpers to support `mockResolvedInputs`
- [ ] Extend widget definition preview helpers to support `mockRuntimeState`
- [ ] Add `mockTitle` support where needed for realistic preview headers
- [ ] Document the full preview contract in `src/widgets/shared/README.md`
- [ ] Update the widget maintenance skill to require the expanded contract instead of props-only
      mocks

### Phase 3: Fix the Main Sequence Data Node family first

Goal:

- make data-bound widgets render meaningful demos without live bindings

Tasks:

- [ ] Implement canonical demo bundles for `main-sequence-data-node-statistic`
- [ ] Implement canonical demo bundles for `main-sequence-data-node-visualizer`
- [ ] Implement canonical demo bundles for `main-sequence-data-node-filter`
- [ ] Audit `data-node-table` and related consumers for the same preview dependency gap
- [ ] Ensure these widgets no longer render empty-state placeholders in demo mode when fixtures
      are present

### Phase 4: Normalize all remaining widgets to the contract

Goal:

- make the shared preview contract authoritative across the widget catalog

Tasks:

- [ ] Audit every widget definition for explicit demo fixtures
- [ ] Replace fallback-only `exampleProps` usage with authoritative `mockProps` where needed
- [ ] Add `mockRuntimeState` for widgets that require local state to preview meaningfully
- [ ] Add richer demo inputs for widgets that depend on upstream contracts
- [ ] Remove any remaining widget-local legacy preview sections that duplicate the shared preview

### Phase 5: Verification and regression guardrails

Goal:

- keep preview quality from drifting over time

Tasks:

- [ ] Add an audit script or test helper that flags widget definitions missing required demo
      fixtures
- [ ] Add targeted verification coverage for shared preview draft isolation
- [ ] Add targeted verification coverage for demo-mode settings writes not mutating the real draft
- [ ] Add targeted verification coverage for data-widget demo rendering
- [ ] Document expected authoring behavior in widget maintenance docs and shared widget docs

## Consequences

Positive:

- preview and settings form will describe the same state
- demo mode becomes credible for data-bound widgets
- the real widget draft stays protected from exploratory demo edits
- the preview system becomes a shared platform contract rather than widget-specific folklore

Negative:

- shared settings orchestration becomes more complex
- widget definitions need richer preview fixtures
- some widget families will require contract-shaped demo bundles rather than trivial props mocks

## Guardrails

- Do not let demo mode mutate the real widget draft.
- Do not let widget-local preview code bypass the shared preview contract.
- Do not treat `exampleProps` as a complete demo contract for complex widgets.
- Do not persist preview-only draft state into workspace storage.
- Do not require live bindings or backend data for a meaningful demo preview when a widget declares
  demo fixtures.

## Implementation Notes

- Start with `Statistic` as the reference migration because it exposes the current contract gap
  clearly.
- Keep the first implementation slice focused on preview coherence, not on adding a demo-to-real
  apply workflow.
- Any later feature that copies demo settings into the real widget should be captured in a separate
  ADR because it would change the authoring workflow materially.
