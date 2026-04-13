# ADR: Use React Grid Layout v2 API in Workspace Studio

- Status: Accepted
- Date: 2026-04-01

## Context

The workspace studio imports `react-grid-layout` from the package root. In `react-grid-layout`
2.x, that root export is the new v2 API, which expects grouped configuration objects such as:

- `gridConfig`
- `dragConfig`
- `resizeConfig`
- `compactor`

The previous studio code still passed the flat v1 prop surface directly into the root component:

- `cols`
- `rowHeight`
- `margin`
- `containerPadding`
- `isDraggable`
- `isResizable`
- `resizeHandles`
- `draggableHandle`
- `draggableCancel`
- `compactType`

That mismatch was hidden behind a local `ComponentType<any>` cast, so TypeScript could not catch
it. As a result, the live editor could silently fall back to the root v2 defaults instead of using
the intended custom-grid settings.

Those defaults are materially different from the studio's intended custom editor behavior:

- `12` columns
- `150px` row height
- `[10, 10]` margins
- drag threshold `3`
- resize handles `["se"]`

The workspace studio already measures its own width and already stores canonical grid geometry in
the shared dashboard model. We do not need a layout-model rewrite to fix this problem. We need the
studio to drive the installed library through the API it actually exposes.

## Decision

We will keep using the root `react-grid-layout` package entry and migrate the workspace studio to
the real v2 prop surface.

The studio now:

1. Passes layout measurement through `gridConfig`, `dragConfig`, and `resizeConfig`.
2. Uses `verticalCompactor` explicitly instead of `compactType="vertical"`.
3. Uses a single bottom-right `se` resize handle for `custom` edit mode instead of separate edge
   handles, so width and height resize together from one affordance.
4. Keeps the existing dashboard layout model and explicit width measurement logic.
5. Removes the local `ComponentType<any>` cast so TypeScript can validate the real component API.
6. Memoizes grid children so the editor does not hand RGL a fresh child array on every render.
7. Limits the studio `ResizeObserver` loop to width-driven updates so height churn during resize
   does not feed unnecessary grid-metric state back into the editor.

## Why we are doing it this way

### The bug is an API mismatch before it is a density problem

The editor cannot be tuned correctly if the live grid is not actually receiving the grid settings
we think we are passing. Fixing the API surface comes before any density retuning.

### We want the current package surface, not the legacy compatibility wrapper

The `react-grid-layout/legacy` path is valid for old code, but the workspace studio is an actively
maintained feature. We want the latest typed API surface, not a migration shim.

### The existing workspace model is still valid

The stored dashboard geometry, width measurement, and commit-on-stop flow already fit the v2 API.
This change corrects the library integration without forcing another workspace-schema rewrite.

## Consequences

### Positive

- the studio now uses the same API the installed library documents
- TypeScript can catch future RGL prop drift
- live custom-grid sizing uses the intended config instead of silent defaults
- the grid child tree is more stable during editor interaction

### Tradeoffs

- the studio code is slightly more explicit because grouped config objects must be built
- future RGL upgrades still need deliberate review of grouped config semantics
- custom-grid density may still need further tuning after the API mismatch is removed

## Non-decisions

This ADR does not decide:

- the final long-term custom-grid density
- whether the studio should eventually adopt `noCompactor`
- whether widget content should receive live pixel dimensions during resize

## Rejected alternatives

### Keep the root import and continue using flat props with an `any` cast

Rejected because it makes the integration ambiguous and lets the editor drift away from the
installed package API without type errors.

### Switch to `react-grid-layout/legacy`

Rejected because it preserves the old prop surface instead of migrating the editor to the current
typed API that the package recommends for new work.
