---
name: widget_maintenance
description: Use when building, modifying, refactoring, reviewing, or documenting Command Center widgets, widget definitions, widget settings, widget IO ports, registry contracts, runtime execution behavior, or USAGE_GUIDANCE.md files. Ensures widget maintenance tasks are completed, especially keeping the backend-synced widget usage guidance accurate.
---

# Widget Maintenance

Use this skill for any Command Center widget work.

## Required Workflow

1. Read the local context before editing:
   - the widget folder `README.md`
   - the widget folder `USAGE_GUIDANCE.md`
   - the widget `definition.ts`
   - nearby model/schema/execution files when the change touches configuration, IO, runtime, or published data

2. Keep `USAGE_GUIDANCE.md` current.
   - `USAGE_GUIDANCE.md` is the source for both `WidgetDefinition.description` and
     `registryContract.usageGuidance`.
   - `resolveWidgetDescription(...)` resolves the catalog/backend description from the
     `buildPurpose` section.
   - `resolveWidgetUsageGuidance(...)` resolves the full structured usage guidance synced to the
     backend widget registry contract.
   - `USAGE_GUIDANCE.md` is user-facing catalog and usage text. It should explain what the widget
     does, when to use it, when not to use it, what data or bindings it expects, and what it
     publishes.
   - `README.md` is developer-facing maintenance documentation. It should explain module ownership,
     entry points, implementation details, dependencies, constraints, and internal behavior.
   - Do not hardcode top-level widget descriptions or `usageGuidance` inline in `definition.ts`.
   - New widget folders must include both `README.md` and `USAGE_GUIDANCE.md`.

3. Make `USAGE_GUIDANCE.md` specific, not vague.
   It should describe the widget's real current behavior, including the relevant items below when they apply:
   - primary purpose and intent
   - when to use the widget
   - when not to use the widget, if there are common alternatives
   - data examples or expected input shapes
   - important configuration/source modes
   - inbound ports: ids, labels, accepted contracts, cardinality, and what the value drives
   - outbound ports: ids, labels, published contracts, and payload shape
   - runtime ownership: execution-owner, consumer, or local-ui
   - refresh/execution behavior
   - backend endpoints or persisted props involved
   - constraints, pitfalls, or maintenance rules that affect correct use

4. Keep the code wiring aligned.
   - Import `USAGE_GUIDANCE.md` with `?raw`.
   - Use `resolveWidgetDescription(usageGuidanceMarkdown)` and
     `resolveWidgetUsageGuidance(usageGuidanceMarkdown)` for a one-widget folder.
   - If one folder defines multiple widget types, use top-level sections in one
     `USAGE_GUIDANCE.md` named by widget id and pass that id to both resolver calls.
   - Keep `registryContract`, `io`, `schema`, `execution`, `widgetVersion`, `README.md`, and
     `USAGE_GUIDANCE.md` consistent with the updated behavior.
   - Every widget must provide a demoable JSON configuration for settings preview mode through
     `mockProps` or `exampleProps`. The shared widget settings preview uses that payload when the
     demo-data toggle is enabled, so widget authors must keep the demo configuration valid,
     representative, and safe to render without live workspace bindings.
   - If the widget depends on local preview runtime state, also provide `mockRuntimeState` so the
     shared demo preview can render a complete representative panel.
   - Put implementation details in `README.md`; put user-facing usage and contract meaning in
     `USAGE_GUIDANCE.md`.
   - Widget settings and input forms should expose concise `(i)` help tooltips for non-obvious
     fields. Reuse shared widget settings tooltip components instead of creating local one-off
     tooltip implementations. Tooltip text should explain what the field controls, when it matters,
     and any constraints that affect valid input.

5. Assess storage and backend contract impact.
   - If props, runtime state, bindings, persisted workspace shape, or published output shape changes, explicitly assess whether this changes the backend contract.
   - If the backend sync payload shape changes, update registry docs and bump the global registry version as required.
   - If only `USAGE_GUIDANCE.md` text changes, the backend payload shape is unchanged; only the
     synced description and usage-guidance values change.

6. Verify before finishing:
   - run `npm run check` when TypeScript files changed
   - audit that widget `definition.ts` files use `resolveWidgetDescription` and
     `resolveWidgetUsageGuidance`
   - audit that every widget definition folder has a `USAGE_GUIDANCE.md`
   - audit that every widget definition exposes a usable demo preview payload through `mockProps`
     or `exampleProps`, plus `mockRuntimeState` when needed for representative preview rendering
   - mention any check that could not be run

## USAGE_GUIDANCE.md Style

Use stable Markdown sections matching the backend usage-guidance fields. Include concrete contracts
when they matter. Write for widget users, workspace authors, backend catalog readers, and agents
choosing a widget. Do not make it a development changelog or file map; that belongs in `README.md`.

Good:

```md
## buildPurpose

Publishes a reusable Main Sequence tabular dataset from a direct Data Node, bound Data Node, or manual table.

## whenToUse

- Use when several downstream widgets should consume one shared dataset.

## whenNotToUse

- Do not use when a downstream visualization only needs to render an already-bound dataset.

## authoringSteps

- Select the source mode and source dataset.

## blockingRequirements

- Direct mode requires a valid data node id.

## commonPitfalls

- Pivot and unpivot modes require the relevant key/value fields.
```

For multi-widget folders:

```md
## widget-id-a

### buildPurpose

Purpose for widget A.

## widget-id-b

### buildPurpose

Purpose for widget B.
```
