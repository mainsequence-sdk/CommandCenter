# ADR 063: Rename Portfolio Weights Widget to Position Detail

- Status: Accepted
- Date: 2026-05-19
- Related:
  - [ADR 062: Typed Widget Module Pattern](./adr-062-typed-widget-module-pattern.md)
  - [ADR: Agent-Ready Widget Type Registry Contract](./adr-agent-ready-widget-type-registry-contract.md)
  - [ADR: Organization-Scoped Widget Type Configurations](./adr-organization-widget-type-configurations.md)

## Context

The current Main Sequence Markets widget named `Portfolio Weights` is no longer portfolio-specific.
It already serves three distinct source contracts:

- `portfolio`
- `account`
- `target_position`

The implementation is therefore acting as a general position-detail table with optional inline
editing and account holdings writeback, not as a narrow portfolio-weights visual.

Today that misleading name leaks through several layers:

- user-facing widget title: `Portfolio Weights`
- widget type id: `portfolio-weights-table`
- execution key prefix: `portfolio-weights-table:${instanceId}`
- folder/module names such as `portfolio-weights-table/`, `portfolioWeightsRuntime.ts`, and
  `portfolioWeightsExecution.ts`
- exported symbols such as `portfolioWeightsWidget`
- feature imports in the Markets portfolio and managed-account screens
- local README and usage guidance
- persisted workspace instances and saved-widget records that store the widget type id

That naming now causes two concrete problems:

1. it communicates the wrong domain to users and developers
2. it discourages reuse because a generic position-detail widget appears to belong only to
   portfolio-weight workflows

The repository does not expose a general widget-definition alias or hidden legacy-widget mechanism.
The catalog-facing widget id is therefore also the persisted identity that workspaces and saved
widgets carry.

## Decision

Adopt `Position Detail` as the canonical identity for this widget family.

This decision covers both user-facing and code-facing naming:

- widget title becomes `Position Detail`
- canonical widget id becomes `position-detail`
- canonical folder/module/symbol names use `PositionDetail`
- documentation stops describing this widget as `Portfolio Weights`, except when documenting
  backwards-compatibility migration from legacy workspaces

Because the widget id is persisted, the rename will be implemented as a migration, not as a
cosmetic search-and-replace.

## Non-Goals

This ADR does not change:

- the supported source contracts (`portfolio`, `account`, `target_position`)
- the holdings writeback contract
- the table behavior, columns, or editing semantics
- the backend query endpoints used by the widget

This ADR is only about identity, naming, and migration.

## Migration Strategy

Do not ship two long-lived visible widgets in the catalog.

The repository should not keep both `portfolio-weights-table` and `position-detail` as separate
catalog-visible widget types because that would create duplicate choices for one widget behavior and
split policy/catalog registration.

Instead, compatibility should be handled through normalization and import migration:

1. workspace load normalization rewrites legacy widget ids from `portfolio-weights-table` to
   `position-detail`
2. saved-widget hydration/import rewrites legacy `widgetTypeId` values to `position-detail`
3. any widget-type sync or organization configuration should publish only `position-detail` once
   the migration lands
4. legacy documentation references should remain only in migration notes

This keeps one canonical widget identity after migration while preserving old saved content.

## Implementation Plan

### Phase 1: Canonical Rename in Code

- [x] Rename the widget folder from
      `extensions/main_sequence/extensions/markets/widgets/portfolio-weights-table/` to
      `extensions/main_sequence/extensions/markets/widgets/position-detail/`.
- [x] Rename exported symbols and types:
  - `portfolioWeightsWidget` -> `positionDetailWidget`
  - `PortfolioWeightsWidget` -> `PositionDetailWidget`
  - `PortfolioWeightsWidgetProps` -> `PositionDetailWidgetProps`
  - `portfolioWeightsExecutionDefinition` -> `positionDetailExecutionDefinition`
  - `portfolioWeightsRuntime.ts` -> `positionDetailRuntime.ts`
  - `PortfolioWeightsWidgetSettings.tsx` -> `PositionDetailWidgetSettings.tsx`
  - similar test and helper filenames
- [x] Rename widget-facing copy in `definition.ts`, `README.md`, and `USAGE_GUIDANCE.md` from
      `Portfolio Weights` to `Position Detail`.
- [x] Update Markets feature imports and local README references to the new widget/module names.

### Phase 2: Persisted Widget Identity Migration

- [x] Change the widget definition id from `portfolio-weights-table` to `position-detail`.
- [x] Add workspace normalization that rewrites legacy instance `widgetId` values while loading
      stored dashboards/workspaces.
- [x] Add saved-widget migration that rewrites legacy `widgetTypeId` values when restoring saved
      widgets into the canvas.
- [x] Review any feature code that branches directly on widget id strings and update those call
      sites to accept the new id or migrate before branch logic runs.
- [x] Review widget favorite/recent catalog references that may persist raw widget ids.

### Phase 3: Runtime and Registry Cleanup

- [x] Change the execution key prefix from `portfolio-weights-table:${instanceId}` to
      `position-detail:${instanceId}`.
- [x] Review any persisted or debug-facing runtime metadata that displays the widget id and ensure
      it uses the new canonical id after migration.
- [x] Update widget-type catalog sync expectations so the backend registered widget type becomes
      `position-detail`.
- [x] Review organization-scoped widget availability/configuration records that may reference the
      old widget id.

### Phase 4: Documentation and Verification

- [x] Update:
  - `extensions/main_sequence/extensions/markets/widgets/README.md`
  - `extensions/main_sequence/extensions/markets/README.md`
  - feature READMEs that reference this widget
  - any usage guidance or ADR links that still use the legacy name
- [x] Add migration-focused tests:
  - workspace normalization rewrites legacy widget ids
  - saved-widget restoration rewrites legacy widget ids
  - widget execution still hydrates correctly after rename
- [x] Run `npm run check` and focused widget/dashboard migration tests.

## Storage Contract Impact

This rename is not frontend-only.

Changing the widget type id from `portfolio-weights-table` to `position-detail` changes persisted
frontend storage semantics because workspace instances and saved widgets store the widget id.

That means:

- frontend workspace normalization must migrate legacy ids
- saved-widget import/export paths must migrate legacy ids
- backend widget-type catalog sync will see a new canonical widget type id
- any backend policy/configuration keyed by widget id may need coordinated migration

The widget props contract itself does not need to change. This ADR is about widget identity, not
widget props.

## Consequences

### Positive

- The widget name matches its real scope.
- Future reuse becomes clearer because `Position Detail` is generic.
- Code ownership becomes easier to understand because the implementation no longer encodes a narrow
  portfolio-only meaning.
- Catalog semantics become cleaner for users.

### Tradeoffs

- The rename requires explicit workspace and saved-widget migration.
- Backend widget-type registration and any policy/configuration keyed by widget id must be checked.
- There is short-term churn across filenames, exports, docs, tests, and feature imports.

## Rejected Option

### Keep the old widget id forever and rename only the title

Rejected because it only fixes the user-facing label while leaving the code and persisted identity
wrong. The user request here is broader: the widget should not be called `portfolioWeights` or
`position weights` in code because the implementation has general usage.
