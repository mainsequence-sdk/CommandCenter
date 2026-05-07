# ADR 040: Dashboard Surface Return Hydration

- Status: Accepted
- Date: 2026-04-28
- Related:
  - [ADR 039: Unified Upstream Consumer State Contract](./adr-039-unified-upstream-consumer-state-contract.md)
  - [ADR 038: Progressive Workspace Initial Rendering and Per-Widget Hydration](./adr-038-progressive-workspace-widget-hydration.md)
  - [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr-executable-widget-graph-runner.md)
  - [ADR: Single Runtime Owner for Workspace Widgets](./adr-single-runtime-owner-workspace-widgets.md)

## Context

Switching from workspace graph view back to workspace dashboard view can freeze the canvas even
though the selected workspace document does not change.

The current runtime shape explains why:

1. `WorkspaceStudioCanvasHost` keeps one shared dashboard execution provider alive across
   `dashboard` and `graph` surfaces.
2. `DashboardWidgetExecutionProvider` only models hydration for the first dashboard entry in that
   provider lifecycle.
3. When the dashboard canvas remounts after graph view, passive consumers mount again and call
   `useResolveWidgetUpstream(...)`.
4. Hidden `sidebarOnlyWidgets` also mount in a hidden container and can join the same resolution
   wave.

So the freeze is not a workspace-definition reload. It is a dashboard-surface remount that behaves
enough like a fresh load that passive consumers replay upstream resolution without any surface-level
hydration guard.

## Measurement

We ran a short instrumentation pass against a synthetic repro workspace in bypass-auth mock mode.

Repro shape:

- one hidden `connection-query` source-owner widget
- three visible dashboard consumers bound to that source
  - one graph
  - one statistic
  - one table
- one hidden sidebar-only graph consumer bound to the same source

### Initial dashboard entry

Initial dashboard entry produced `3` passive upstream-resolution requests:

- visible consumers: `2`
  - `graph-visible-1`
  - `table-visible-1`
- hidden sidebar-only consumers: `1`
  - `graph-hidden-1`

The visible statistic did not emit a passive resolution request in the captured trace because it had
already fallen out of `awaiting-upstream` by the time the shared source publication settled.

### Graph -> dashboard return

Returning from graph view to dashboard view produced `5` passive upstream-resolution requests:

- visible consumers: `4`
  - `graph-visible-1` requested twice
  - `table-visible-1` requested twice
- hidden sidebar-only consumers: `1`
  - `graph-hidden-1` requested once

## Interpretation

The freeze is dominated by passive upstream-resolution replay on visible dashboard consumers.

Hidden sidebar-only mounts are also contributing avoidable work, but they are not the primary cost
in the measured repro. The visible dashboard surface is doing the larger amount of redundant work,
and some of that work is duplicated inside the same return transition.

So the right fix is not to reset the provider or add a parallel fallback path. The right fix is to
teach the shared execution layer about dashboard-surface returns and to keep hidden consumers out of
the first wave.

## Decision

We will treat `graph -> dashboard` as a dashboard-surface hydration boundary inside the shared
execution provider.

This ADR intentionally rejects a provider-remount fallback.

The correct runtime model is:

- one shared execution provider across workspace surfaces
- explicit surface lifecycle in that provider
- explicit dashboard re-entry hydration on `graph -> dashboard`
- passive upstream auto-resolution suppressed during dashboard re-entry hydration
- hidden sidebar-only consumer mounts deferred until dashboard re-entry hydration settles

## Architecture

### 1. Model surface lifecycle explicitly

The shared execution provider should understand:

- active workspace surface: `dashboard` or `graph`
- hydration reason:
  - `initial-entry`
  - `surface-return`
- whether dashboard-surface hydration is currently active

This should be explicit provider state, not inferred ad hoc from mount timing.

### 2. Add dashboard re-entry hydration for `graph -> dashboard`

When the active surface changes from `graph` to `dashboard`, the provider should open a short
dashboard re-entry hydration window.

During that window:

- the dashboard canvas still mounts immediately
- widgets still render in place
- passive consumer widgets render their shared upstream consumer state
- passive consumers do not start their own upstream-resolution wave

This reuses the same ownership principle as first-load hydration without treating the transition as
an actual workspace reload.

### 3. Reuse shared consumer-state rendering, suppress passive execution

`ADR 039` already normalized mounted consumer states such as:

- `awaiting-upstream`
- `loading`
- `ready`
- `empty`
- `error`

Dashboard re-entry should use those mounted states instead of allowing passive consumers to compete
with the shared execution provider.

In practice:

- `useResolveWidgetUpstream(...)` should suppress passive requests while dashboard return hydration
  is active
- once dashboard return hydration settles, passive upstream resolution can resume normal behavior

### 4. Defer hidden sidebar-only consumers until dashboard settles

Hidden `sidebarOnlyWidgets` should not mount during the critical dashboard re-entry wave.

They do not provide immediate user value on the canvas, and the measurement shows they add real
work. Their mounting should be delayed until:

- dashboard return hydration is complete, or
- the visible dashboard surface is otherwise marked settled

### 5. Make the transition debuggable

The runtime should expose enough trace context to answer:

- which surface initiated the execution
- whether execution happened during `initial-entry` or `surface-return`
- whether a consumer request was suppressed because hydration owned the transition
- when hidden sidebar-only widgets were allowed to mount

This should land in the shared request/debug surfaces, not as long-lived console-only
instrumentation.

## Consequences

Positive:

- graph-to-dashboard return stops behaving like an uncontrolled workspace reload
- visible dashboard widgets can mount progressively without triggering a resolution storm
- hidden sidebar-only consumers stop competing with the visible canvas during the critical
  transition
- one execution model stays in place across surfaces

Negative:

- the execution provider gets a more explicit surface lifecycle
- dashboard surfaces need one more notion of "hydration complete" beyond first provider entry
- hidden managed mounts become slightly more stateful because they are no longer mounted
  immediately in every dashboard render path

## Tasks

- [x] Extend `DashboardWidgetExecutionProvider` with explicit surface lifecycle state.
- [x] Add `dashboardSurfaceHydrationActive` and `dashboardSurfaceHydrationReason` to the execution
      context.
- [x] Detect `graph -> dashboard` transitions in `WorkspaceStudioCanvasHost` and signal dashboard
      return hydration to the execution provider.
- [x] Update `useResolveWidgetUpstream(...)` so passive consumer auto-resolution is suppressed
      during dashboard return hydration, not only initial provider hydration.
- [x] Audit request-key and effect ordering so visible consumer widgets do not double-request during
      the same dashboard return transition.
- [x] Gate hidden `sidebarOnlyWidgets` mounting until dashboard return hydration settles.
- [x] Expose surface-return hydration metadata in request-debug tooling through labeled refresh
      cycles instead of leaving it as ad hoc console-only instrumentation.
- [x] Add regression coverage for the shared dashboard surface-hydration policy helpers.
- [x] Add component-level regression coverage for actual `graph -> dashboard` provider/page
      transitions:
  - [x] passive visible consumers do not start duplicate upstream-resolution waves during return
        hydration
  - [x] hidden sidebar-only consumers do not mount before dashboard return hydration settles
  - [x] dashboard canvas still renders immediately during the return transition
- [ ] Run a manual verification pass on a representative real workspace with visible and hidden
      managed widgets.
