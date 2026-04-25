# Main Sequence AI Workspace Widget

This folder owns the `main-sequence-ai-workspace` widget, displayed in the catalog as `Workspace`.

## Entry Points

- `definition.ts`: widget registry definition, stable widget id, and published output contract.
- `WorkspaceWidget.tsx`: runtime card that resolves the selected workspace against the accessible
  workspace list and publishes the validated reference through widget runtime state.
- `WorkspaceWidgetSettings.tsx`: settings UI for picking a target workspace and surfacing invalid
  or self-referential selections.
- `WorkspaceReferenceRailSummary.tsx`: compact hover summary rendered from the workspace rail when
  the widget stays in its default sidebar placement.
- `workspaceReference.ts`: shared contract constants, prop normalization, runtime-state helpers,
  and the workspace-summary loading hook used by both runtime and settings.

## Behavior Notes

- The widget stores one authored prop: `workspaceId`.
- The widget publishes one bindable output, `workspace-reference`, with payload shape:
  `{"id": "<workspace-id>"}`.
- The widget is registered in the general Main Sequence AI widget catalog. `Agents Monitor` also
  includes it in that surface's curated allowlist, but the widget is not monitor-exclusive.
- New instances default to `presentation.placementMode = "sidebar"` so the widget behaves like a
  compact source token in the workspace rail instead of opening as a canvas card.
- The current workspace is intentionally excluded from selection.
- If a saved or imported widget points to the current workspace, the widget marks itself invalid and
  publishes no output.
- If the selected workspace disappears from the accessible workspace list, the widget publishes no
  output until the selection is repaired.
- The widget does not publish workspace title, labels, description, or a live snapshot. The
  contract is intentionally minimal.
- In workspace graph mode, the graph page can use the published workspace id to lazily render a
  read-only framed graph projection of the referenced workspace to the left of this widget's graph
  node, including the referenced workspace's internal widget connections. That graph expansion does
  not widen this widget's output payload and does not make referenced workspace nodes editable from
  the parent workspace. Multiple opened references are stacked in a dedicated left-side lane so
  they do not render underneath each other. Selecting the graph node shows an explicit
  `Expand workspace` action when the widget points to another workspace.

## Maintenance Notes

- Keep the published payload minimal. If downstream consumers later need more than the id, add a
  new contract version instead of silently widening `main-sequence-ai.workspace-reference@v1`.
- Keep the sidebar-first presentation aligned with the intended authoring model here. If this widget
  ever needs a meaningful canvas card by default, revisit `defaultPresentation` and the rail
  summary in the same change.
- `WorkspaceWidget.tsx` derives output validity from accessible workspace summaries.
  `workspaceReference.ts` can use the shared studio store when it already has list items, but it
  also fetches workspace summaries directly when the store is empty so direct workspace/detail
  routes still populate the target picker. In backend mode this direct fetch is not gated on
  `session.user.id`; the workspace API adapter attaches the auth token to the configured
  `workspaces.list_url` request and passes `exclude_ids=<current-workspace-id>` so the backend
  can omit the workspace currently being authored.
- `showRawPropsEditor` is intentionally disabled so ordinary authoring cannot bypass the
  self-reference restriction. Runtime validation still exists to guard imported or stale data.
- Bump `widgetVersion` when the authored prop model, published contract, or validation semantics
  change materially.
