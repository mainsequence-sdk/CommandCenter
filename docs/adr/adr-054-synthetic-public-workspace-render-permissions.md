# ADR 054: Synthetic Public Workspace Render Permissions

- Status: Accepted
- Date: 2026-05-02
- Owners: Workspaces frontend

## Context

ADR 053 introduced `Public Preview` and `Public View` for `workspace` and `slide-studio`.

That solves the routing and shell problem, but it does not by itself solve widget access semantics.

Today, most workspace widgets declare:

- `requiredPermissions: ["workspaces:view"]`

That is correct for authenticated workspace usage because a normal signed-in workspace viewer has
that baseline permission.

The current anonymous public route does not.

It renders with an empty permission set, which means the shared widget host treats nearly every
normal workspace widget as inaccessible and replaces it with:

- `Missing permissions: workspaces:view`

At the same time, authenticated `Public Preview` can still work because it currently renders with
the signed-in user's real permission set.

That produces two bad outcomes:

1. `Public Preview` and `Public View` do not actually model the same access contract.
2. `Public View` incorrectly blocks baseline workspace widgets that should be visible in a public
   workspace.

The deeper issue is that `workspaces:view` is currently serving two roles:

- access to the authenticated Workspaces shell surfaces
- baseline read access for normal workspace widget rendering

Those are not the same thing for public sharing.

## Decision

`Public Preview` and `Public View` must render workspace content with a **synthetic public
read-only permission profile**, not with:

- the signed-in user's full permission set
- or an empty anonymous permission set

That synthetic public permission profile must satisfy the baseline workspace content contract,
starting with:

- `workspaces:view`

It must not inherit elevated or private capabilities such as:

- organization administration permissions
- platform administration permissions
- connection authoring permissions
- any other permission that would expose authenticated-only controls or protected runtime features

The public renderer therefore becomes:

- read-only
- shellless
- baseline workspace-readable
- not operator-capable

## Public Execution Contract

Permissions are only one half of the public-rendering contract.

Public routes also need a different execution contract than authenticated workspace authoring.

What must not happen in public mode:

- `GET /api/v1/command_center/connections/`
- `POST /api/v1/command_center/connections/<id>/query/`
- `WS /api/v1/command_center/connections/<id>/stream-query/`
- any client-owned execution routing keyed by `connectionId`

Instead, public rendering must execute widgets through backend-owned public workspace endpoints.

Minimum target contract:

- `GET /api/v1/command_center/public/workspaces/<token>/`
- `POST /api/v1/command_center/public/workspaces/<token>/widgets/<widget_id>/query/`
- `WS /api/v1/command_center/public/workspaces/<token>/stream-query/`

To support that, the public workspace payload must provide a widget-scoped public execution
contract, for example:

- `widget.publicExecution.queryUrl`
- `widget.publicExecution.streamUrl`
- `widget.publicExecution.capability`
- `widget.publicExecution.allowedInputs`

The frontend must treat that contract as authoritative in public mode.

## Core Rules

1. Public routes must not use raw empty permissions when rendering workspace widgets.
2. Public Preview must simulate the same effective permission profile as Public View.
3. Public rendering must satisfy baseline workspace widget visibility requirements.
4. Public rendering must not inherit signed-in operator or admin capabilities just because the
   viewer is authenticated.
5. Unsupported or unsafe widgets must be blocked by publication validation, not by runtime locked
   cards in the public renderer.
6. Public Preview and anonymous Public View must use the same public execution engine.
7. Public widget execution must use only backend-owned public execution endpoints.

## Synthetic Public Permission Profile

The product now needs a dedicated permission constant for public workspace rendering.

Minimum baseline:

- `workspaces:view`

This profile is intentionally narrow.

It exists only so public-safe workspace widgets can render under the same shared widget host
without being mistaken for unauthorized authenticated users.

It is not:

- a general anonymous user role
- an admin-lite role
- a replacement for authenticated RBAC

It is a rendering contract for public-safe workspace content.

## Preview And Public Must Match

`Public Preview` exists so a signed-in author can see what the public experience will actually look
like.

That means preview cannot keep using the author's real permission set for widget gating.

Instead:

- preview access to the route is authenticated
- widget rendering inside preview uses the synthetic public permission profile

So the route access model and the render access model are intentionally different:

- route access: signed-in author
- render access: public synthetic read-only permissions

That is required for fidelity.

## Publication Validation

The product rule is not "public view may show unsupported widgets."

The product rule is:

- a workspace can only be made public if every widget and every relevant runtime dependency is
  public-safe

So the public-link enablement flow must validate at least:

- widget required permissions beyond the synthetic public baseline
- instance-level required permissions beyond the synthetic public baseline
- connection/runtime dependencies that require authenticated or private capabilities
- workspace types that are not eligible for public sharing

If validation fails:

- publication is blocked
- the author gets actionable errors

If validation passes:

- public rendering should not degrade into a page full of locked widget frames

## Consequences

### Positive

- Public Preview becomes accurate instead of optimistic.
- Public View renders normal workspace widgets correctly.
- Shell access control stays separate from public content rendering.
- Widget permission gates remain meaningful without breaking public sharing.

### Tradeoffs

- public rendering now has a dedicated permission model to maintain
- publication flow must include validation logic instead of assuming runtime fallback behavior
- some widgets or runtime dependencies may need explicit public-safety metadata or checks

## Rejected Alternatives

### Use empty permissions for public rendering

Rejected because the shared widget host will correctly lock most workspace widgets, which makes
public workspaces unusable.

### Use the signed-in user's real permissions for Public Preview

Rejected because preview would no longer match actual public rendering. Authors could see widgets in
preview that anonymous viewers cannot see.

### Treat locked widget frames as the normal public fallback

Rejected because public publication should fail before enablement when the workspace is not
public-safe.

## Implementation Tasks

- [x] Add a shared synthetic public workspace render permission constant.
- [x] Use that synthetic permission profile in authenticated Public Preview widget rendering.
- [x] Use that synthetic permission profile in anonymous Public View widget rendering.
- [x] Stop using raw empty permission arrays for public workspace widget gating.
- [x] Keep shell/app access control separate from public widget rendering permissions.
- [x] Extend the public workspace detail payload with widget-scoped `publicExecution` metadata.
- [x] Add an explicit public execution surface/context in the widget runtime layer.
- [x] Route `connection-query` execution through `widget.publicExecution.queryUrl` in public mode.
- [x] Route `connection-stream-query` execution through `widget.publicExecution.streamUrl` in
      public mode.
- [x] Stop using `connectionId` as the client execution key in public mode.
- [ ] Ensure authenticated Public Preview uses the same public execution engine as anonymous
      Public View.
- [ ] Add publication validation that rejects widgets or instances requiring permissions outside the
      synthetic public baseline.
- [ ] Add publication validation for runtime or connection dependencies that are not public-safe.
- [ ] Ensure the public-link enable flow returns actionable validation errors instead of enabling a
      broken public page.
- [ ] Ensure Public Preview surfaces the same locked or validation outcomes that final Public View
      would produce.
