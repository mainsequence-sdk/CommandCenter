# ADR 053: Public View For Workspace And Slide Studio

- Status: Accepted
- Date: 2026-05-02
- Owners: Workspaces frontend

## Context

The current workspace surfaces are all authenticated Command Center experiences.

That is correct for authoring and internal use, but it is not sufficient for public sharing.

Some workspaces need a public URL that can be opened by people who are not logged into Command
Center.

The current runtime surfaces are not appropriate for that:

- the authenticated shell adds top navigation, rails, and workspace controls
- widget menus and workspace chrome are designed for operators, not public viewers
- kiosk mode hides some shell chrome, but it still assumes an authenticated Command Center session
- Slide Studio slideshow is a presentation projection, not a general anonymous share surface

So the problem is not only visual chrome. The product needs a separate public projection contract.

## Decision

`workspace` and `slide-studio` workspaces get a dedicated **Public View** projection mode.

Before anonymous public URLs are enabled, the product must also provide an authenticated
**Public Preview** projection for signed-in authors.

This mode is:

- read-only
- shellless
- available only for supported workspace types
- first available as authenticated preview
- later available through a backend-owned public URL

It must show only the workspace content itself, without Command Center application rails or
operator controls.

It does **not** replace:

- the normal authenticated `Workspaces` surface
- the normal authenticated `Slide Studio` surface
- the Slide Studio slideshow projection

It is a separate projection over the same persisted workspace document.

## Preview First

`Public Preview` must be implemented before anonymous public sharing.

That preview:

- is available to signed-in users
- uses the same rendering contract as final public view
- removes Command Center shell and workspace chrome
- lets authors verify the result before publication exists

So the rollout order is:

1. authenticated shellless public preview
2. backend publication contract
3. anonymous public URL

## Supported Workspace Types

Public View is supported only for:

- `workspace`
- `slide-studio`

It is not supported for:

- `agent-monitor`

`agent-monitor` is session-bound and operator-specific, so it should not be exposed through the
anonymous public projection contract.

## Core Rules

1. Public View must not render the normal Command Center shell.
2. Public View must not require an authenticated user session.
3. Public View must be read-only.
4. Public View must not show workspace controls, widget menus, widget settings, graph editors, or
   any authoring chrome.
5. Public View must reuse the existing runtime rendering contract for the workspace type instead of
   inventing a separate document model.
6. Public View availability must be backend-authoritative.
7. Public View must be addressable by a backend-owned public URL or public identifier, not by a
   frontend-synthesized route over private workspace ids.

## Projection Model

The public projection should follow the workspace type:

```text
Public URL
  -> backend resolves public workspace reference
    -> workspace type
      -> runtime projection
```

For `workspace`:

```text
Public URL
  -> workspace runtime canvas
    -> read-only widget rendering
```

For `slide-studio`:

```text
Public URL
  -> Slide Studio runtime canvas
    -> read-only slide deck layout
```

This ADR does not change slideshow mode.

Slide Studio slideshow remains a separate Slide Studio-specific projection for one-slide-per-screen
presentation. Public View is the shellless anonymous runtime for the shared workspace itself.

## Shell Rules

Public View must not render:

- topbar
- app navigation
- side rails
- workspace toolbar
- edit controls
- widget overflow menus
- settings actions
- kiosk toggles

The public surface should render only:

- loading state
- error state
- the read-only workspace content

If a minimal brand or footer shell is needed later, that should be handled by a separate ADR.

The default decision is:

- no Command Center rails
- no operator chrome

## Routing Rules

Public View should use a dedicated public route space instead of the authenticated workspace studio
routes.

Examples:

- `/public/workspace/<public-id>`
- `/public/slide-studio/<public-id>`

or an equivalent backend-shaped public route.

The important rule is:

- do not expose private workspace ids as the public sharing contract
- do not make anonymous access depend on the authenticated shell router

## Backend Authority

The backend must be authoritative for public access.

That means the backend should own:

- whether a workspace is public
- which public URL or identifier resolves to it
- which workspace types are eligible
- what detail payload is safe to return anonymously

The frontend must not infer public accessibility just because a workspace has a certain type.

## Data And Runtime Constraints

Public View introduces real backend/runtime constraints.

Even if the workspace document itself can be returned anonymously, widgets may still depend on:

- authenticated APIs
- organization-scoped connections
- private runtime tokens
- agent/session state

The product rule should be:

- a workspace can become public only if its widgets, bindings, and data/runtime dependencies are
  public-safe

So the correct contract is a **public-safety validation gate**, not a late placeholder strategy.

That means:

- authors can use Public Preview while signed in
- publication can only be enabled after validation passes
- anonymous public view should not introduce “unsupported widget” placeholders as a normal runtime
  expectation

## Consequences

### Positive

- public sharing becomes a first-class product surface
- `workspace` and `slide-studio` keep their existing authoring surfaces unchanged
- anonymous viewers do not see Command Center operator chrome
- the backend owns access decisions and URL issuance

### Tradeoffs

- the product now has another projection surface to maintain
- backend support is required for a proper public URL contract
- some widgets may need additional runtime/data policy work before they are safe for anonymous use

## Rejected Alternatives

### Reuse kiosk mode as public sharing

Rejected because kiosk mode is still an authenticated shell behavior and does not define anonymous
access, public URL resolution, or safe runtime constraints.

### Reuse slideshow as the generic public surface

Rejected because slideshow is Slide Studio-specific and intentionally changes the composition model
to one-slide-per-screen. Public View should render the shared workspace itself, not force all
public content into slideshow semantics.

### Make every workspace type public-capable by default

Rejected because some workspace types, especially `agent-monitor`, are not appropriate for
anonymous exposure.

## Implementation Tasks

- [x] Add an authenticated shellless Public Preview projection for supported workspace types.
- [x] Reuse the existing read-only runtime canvas for preview instead of inventing a second
      workspace renderer.
- [x] Keep Public Preview available only for `workspace` and `slide-studio`.
- [x] Explicitly reject `agent-monitor` on the preview surface.
- [x] Add a surfaced `Public preview` action in authenticated workspace authoring flows.
- [x] Add a backend-owned public workspace access contract for supported workspace types.
- [x] Define how the backend represents public availability and the public identifier or URL for a
      workspace.
- [x] Add an unauthenticated public workspace detail endpoint or equivalent backend public route.
- [x] Ensure the backend returns the canonical workspace `type` in public responses.
- [x] Restrict Public View eligibility to `workspace` and `slide-studio`.
- [x] Explicitly reject `agent-monitor` on the public surface.
- [x] Add a shellless public frontend route space that does not mount the normal Command Center
      rails.
- [x] Build a shared public-view loader that resolves the backend public payload and dispatches to
      the correct runtime projection by workspace type.
- [x] For `workspace`, render the existing read-only workspace runtime canvas with no operator
      chrome.
- [x] For `slide-studio`, render the existing read-only Slide Studio runtime surface with no
      operator chrome.
- [x] Ensure widget overflow menus, settings actions, edit affordances, graph routes, and other
      authoring controls do not render in Public View.
- [x] Add public-specific loading, not-found, and render-error states.
- [x] Add explicit forbidden and unsupported-type public states.
- [ ] Define the public-safety validation gate for widgets, bindings, connections, and runtime
      dependencies before public publication can be enabled.
- [x] Add a surfaced `Open public view` or `Copy public URL` action only when the backend marks the
      workspace as public.

## Backend Contract Impact

Yes. This ADR implies a backend contract change.

At minimum, the backend needs to define:

- public availability for a workspace
- a public URL or public identifier
- an anonymous read path for supported workspace types
- public response behavior for unsupported or restricted workspaces

The frontend should treat the backend as authoritative for all of those decisions.

## Success Criteria

The implementation is correct when all of the following are true:

1. A public URL can render a `workspace` workspace without requiring login.
2. A public URL can render a `slide-studio` workspace without requiring login.
3. The public surface shows only the workspace content and public-safe runtime output.
4. No Command Center rails, menus, or edit controls appear.
5. Unsupported workspace types such as `agent-monitor` are rejected cleanly.
6. The authenticated authoring surfaces remain unchanged.
