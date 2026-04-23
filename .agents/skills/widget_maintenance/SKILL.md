---
name: widget_maintenance
description: Use when building, modifying, refactoring, reviewing, or documenting Command Center widgets, widget definitions, widget settings, widget IO ports, registry contracts, runtime execution behavior, or DESCRIPTION.md files. Ensures widget maintenance tasks are completed, especially keeping the backend-synced widget DESCRIPTION.md accurate.
---

# Widget Maintenance

Use this skill for any Command Center widget work.

## Required Workflow

1. Read the local context before editing:
   - the widget folder `README.md`
   - the widget folder `DESCRIPTION.md`
   - the widget `definition.ts`
   - nearby model/schema/execution files when the change touches configuration, IO, runtime, or published data

2. Keep `DESCRIPTION.md` current.
   - `DESCRIPTION.md` is the source for `WidgetDefinition.description`.
   - The resolved `WidgetDefinition.description` is what widget-type sync publishes to the backend.
   - `DESCRIPTION.md` is user-facing catalog and usage text. It should explain what the widget does,
     when to use it, what data or bindings it expects, and what it publishes.
   - `README.md` is developer-facing maintenance documentation. It should explain module ownership,
     entry points, implementation details, dependencies, constraints, and internal behavior.
   - Do not hardcode top-level widget descriptions inline in `definition.ts`.
   - New widget folders must include both `README.md` and `DESCRIPTION.md`.

3. Make `DESCRIPTION.md` specific, not vague.
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
   - Import `DESCRIPTION.md` with `?raw`.
   - Use `resolveWidgetDescription(descriptionMarkdown)` for a one-widget folder.
   - If one folder defines multiple widget types, use sections in one `DESCRIPTION.md` named by widget id and call `resolveWidgetDescription(descriptionMarkdown, "<widget-id>")`.
   - Keep `registryContract`, `io`, `schema`, `execution`, `widgetVersion`, `README.md`, and `DESCRIPTION.md` consistent with the updated behavior.
   - Put implementation details in `README.md`; put user-facing usage and contract meaning in
     `DESCRIPTION.md`.

5. Assess storage and backend contract impact.
   - If props, runtime state, bindings, persisted workspace shape, or published output shape changes, explicitly assess whether this changes the backend contract.
   - If the backend sync payload shape changes, update registry docs and bump the global registry version as required.
   - If only `DESCRIPTION.md` text changes, the backend payload shape is unchanged; only the synced description value changes.

6. Verify before finishing:
   - run `npm run check` when TypeScript files changed
   - audit that widget `definition.ts` files use `resolveWidgetDescription`
   - audit that every widget definition folder has a `DESCRIPTION.md`
   - mention any check that could not be run

## DESCRIPTION.md Style

Prefer a precise paragraph over marketing copy. Include concrete contracts when they matter.
Write for widget users, workspace authors, backend catalog readers, and agents choosing a widget.
Do not make it a development changelog or file map; that belongs in `README.md`.

Good:

```md
Publishes a reusable Main Sequence tabular dataset from a direct Data Node, bound Data Node, or manual table, with optional aggregate, pivot, unpivot, and projection transforms. It accepts an optional `sourceData` input with `core.tabular_frame@v1` and publishes a `dataset` output with the same tabular-frame contract for downstream table, chart, and statistic widgets.
```

Too vague:

```md
Stores a reusable dataset node.
```

For multi-widget folders:

```md
## widget-id-a

Description for widget A.

## widget-id-b

Description for widget B.
```
