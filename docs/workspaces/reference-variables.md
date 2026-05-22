# Reference Variables

Reference variables let a workspace setting read a live value from another widget instance. They are
used for cases such as a table selection driving a connection query symbol, a selected row field
driving a chart title, or a widget setting reading one scalar value from an upstream widget.

They are not a second graph model. Reference variables compile into the same canonical
`DashboardWidgetInstance.bindings` payload used by widget composition, with platform-owned targets
for widget titles and saved prop paths.

## Authoring Contract

Reference expressions use the whole-value syntax handled by
`src/dashboards/widget-reference-language.ts`, for example:

```text
$(table-1).activeRow.Symbol
```

The settings layer resolves that expression against discovered widget outputs and emits canonical
bindings for the target title or prop path. The raw authored expression may remain in the saved
prop or title, but the binding edge is the authoritative dependency contract used by the graph,
variable registry, and execution scheduler.

The important entry points are:

- `src/dashboards/widget-reference-language.ts`: parses expressions and reconciles generated
  bindings.
- `src/widgets/shared/widget-variable-reference-input.tsx`: user-facing authoring control for
  fields that support references.
- `src/dashboards/widget-instance-references.ts`: exposes platform-owned title, props, and runtime
  state sources/targets.
- `src/dashboards/widget-variable-registry.ts`: derives active variable consumers from canonical
  bindings at runtime.
- `src/features/dashboards/CustomWidgetSettingsPage.tsx`: commits reference-backed title,
  settings, and managed connection configuration changes.

## Persistence Contract

Persisted workspace documents store widget instances and their bindings. Reference variables should
not introduce a separate persisted variable store.

The saved contract is:

- The target widget owns the setting value or title text.
- The target widget also owns generated bindings for reference-backed title and prop targets.
- The source widget publishes runtime output through normal widget runtime state.
- The variable registry is derived in memory from the current widget bindings and current source
  runtime values.

When changing authoring behavior, reconcile both the raw prop/title value and the generated
bindings. A prop-only save can leave stale binding edges behind, and a binding-only save can leave
the UI unable to detect that the setting is dirty.

## Runtime Refresh Path

Reference variables update after a source widget publishes new runtime state. A common example is a
table writing a new `activeCellValue` or `activeRow` after the user clicks a row.

The runtime path is:

1. A source widget writes runtime state through the workspace runtime-state callback.
2. `CustomDashboardStudioPage.tsx` batches the runtime-state write so mounted consumers can read the
   latest source value without marking the workspace as authored/dirty.
3. The same page queues a revisioned variable refresh for the changed source widget id.
4. `WorkspaceRuntimeVariableRefreshCoordinator` drains that queue using the active
   `DashboardWidgetExecutionProvider`.
5. `executeVariableDrivenWidgetCommit(...)` uses the runtime fast path: it reads only variable
   registry entries owned by the changed source widget, compares cached transformed effective
   signatures, and skips full before/after topology planning.
6. Passive consumers rerender from dependency resolution.
7. Affected executable consumers, including managed connection-query sources, are scheduled through
   the normal graph execution path.
8. Downstream widgets refresh from the updated executable source runtime state.

This means a table click can update a connection query prop such as `query.symbols`, execute that
query, and then refresh downstream charts or tables.

## Provider Boundary

`WorkspaceStudioCanvasHost` embeds `CustomDashboardStudioPage` with `withRuntimeProviders={false}`
because the host owns the shared dashboard dependency and execution providers for workspace reuse.
The runtime variable refresh coordinator must still be mounted inside `CustomDashboardStudioPage`
in that mode so queued source-widget changes can be dispatched through the parent execution
context.

Do not mount the queue producer in one provider branch and the coordinator only in another. That
creates a silent failure mode where runtime state writes are queued, but no consumer drains the
queue, so reference-backed connection queries never re-execute.

## Managed Connection Notes

Managed connection configuration can be reference-backed like any other saved setting. The frontend
continues resolving variable references before sending connection query requests, so this path does
not require a backend contract change when the persisted binding shape remains unchanged.

The frontend must keep these pieces aligned:

- Managed connection draft dirty state must consider both props and generated bindings.
- Applying a managed connection draft must persist the updated props and the reconciled bindings.
- Hidden managed source widgets must read the same effective reference-backed state used by the
  visible settings editor.
- Downstream execution must be scheduled from the changed effective source state, not from stale
  raw props.

## Guardrails

- Do not treat reference variables as owner props only. They are graph edges plus a target setting.
- Do not mutate saved widget instances while resolving dependencies for render-only reads.
- Do not mark background runtime-state publication as an authored workspace change.
- Do not add a second persisted variable graph.
- Keep `withRuntimeProviders=false` workspace hosts covered whenever runtime variable refresh logic
  changes.
