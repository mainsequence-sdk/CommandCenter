# ADR 061: Usage Documentation App

- Status: Accepted
- Date: 2026-05-12
- Related:
  - [ADR: Extension-Contributed Shell Settings Menus](./adr-extension-contributed-shell-settings-menus.md)

## Context

Command Center now has two different documentation jobs:

- developer documentation for maintainers
- usage documentation for product users

Those jobs should not live in the same runtime surface or the same ownership model.

The repository-level `docs/` tree is already the correct place for:

- architecture notes
- ADRs
- backend/frontend contracts
- implementation guidance
- maintainer-facing module documentation

The new `command_center_docs` extension is the correct place for user-facing usage documentation.

But the first pass of that app exposed two architectural problems:

1. its access model was not stated clearly enough
2. its content model could drift into documentation-specific taxonomy instead of mirroring the real
   product applications

The first problem matters because usage documentation describes signed-in product workflows and
internal application behavior. It should not be treated as a public anonymous documentation site.

The wrong direction would be:

- introducing a public documentation route
- making docs available to non-signed-in users
- building a shellless anonymous documentation surface that duplicates routing and navigation logic

The second problem matters because usage documentation will grow with the product. It must scale by
owning application or extension, not by one-off categories invented only for the docs app.

Usage documentation is also the wrong place for a technical cross-application index such as an
"application map" page. That kind of explainer is useful for maintainers, but it does not belong in
user-facing product guidance.

## Decision

Usage documentation becomes a first-class **authenticated Documentation app** backed by one shared
content registry.

The core rules are:

1. user-facing usage documentation lives in the `command_center_docs` extension, not in the
   repository-level developer docs tree
2. documentation is visible to signed-in users only
3. documentation navigation must be organized by owning application or extension, not by generic
   documentation taxonomy
4. the docs app should use one reusable page registry so content can grow by application without
   reworking the renderer

## Implementation Tasks

- [x] Keep the Documentation app authenticated and visible to signed-in users only.
- [x] Remove public or anonymous documentation routes from the documentation-app design.
- [x] Organize the docs tree by owning application or extension instead of documentation-only
  taxonomy.
- [x] Order pages explicitly inside each owning application section.
- [x] Keep `Workspaces` documentation grouped under the `Workspaces` section with ordered child
  pages such as `Workspaces`, `Slide Studio`, and `Widgets`.
- [x] Keep `Agents Monitor` nested under the `Main Sequence AI` section instead of treating it as a
  top-level cross-application page.
- [x] Remove the technical `Application Map` page from user-facing usage documentation.
- [x] Add proper submenu support for deep documentation navigation instead of relying on a single
  flat left navigation tree.
- [x] Introduce shared navigation item types that can open a right-side submenu sidebar.
- [x] Make the right-side submenu pattern reusable across applications and extensions, not specific
  to the documentation app.
- [x] Support ordered nested documentation content inside each owning application or extension using
  the shared submenu model.
- [x] Keep application and extension ordering explicit so submenu contents render in product-defined
  order.
- [x] Restrict the left documentation navigation to these top-level expandable items only:
  `Getting Started`, `Workspaces`, `Foundry`, `Markets`, `Main Sequence AI`, and
  `Organization Admin`.
- [x] Render each top-level documentation section in the left bar as an expandable menu item rather
  than a flat section label.
- [x] Define the `Workspaces` submenu order as `Workspaces`, `Widgets`, then `Slide Studio`.
- [x] Rename the Foundry-facing documentation section to `Foundry` in user-facing navigation.
- [x] Populate the `Foundry` section with all required Foundry pages and subsections from the
  owning application.
- [x] Rename the Markets-facing documentation section to `Markets` in user-facing navigation.
- [x] Populate the `Markets` section with all required Markets pages from the owning application.
- [x] Keep `Main Sequence AI` as a top-level expandable section and populate it with all required
  Main Sequence AI pages and subsections from the owning application.
- [x] Add `Organization Admin` as a top-level expandable section and keep its nested content marked
  as `TBD` until the application documentation structure is defined.

## Route Model

The product supports one documentation route space:

- authenticated: `/app/command-center-docs/:pageId`

Documentation remains part of the normal signed-in Command Center experience.

There is no anonymous public documentation route.

## Content Ownership Model

Usage documentation must be application-first.

The docs app should mirror the real product ownership model:

- `Getting Started`
- `Workspaces`
- `Foundry`
- `Markets`
- `Main Sequence AI`
- `Organization Admin`

Nested documentation pages belong under the owning application section, for example:

- `Workspaces` -> `Workspaces`, `Widgets`, `Slide Studio`
- `Foundry` -> overview plus ordered Foundry application surfaces
- `Markets` -> overview plus ordered Markets application surfaces
- `Main Sequence AI` -> overview plus ordered AI application surfaces
- `Organization Admin` -> overview plus `TBD`

This is the long-term rule:

- documentation structure follows application ownership
- application pages may have ordered nested child pages
- user-facing docs should not introduce a technical cross-application index page
- generic documentation-only taxonomy should be avoided unless it is truly global

## Registry Model

The docs app should use one reusable content registry that stores:

- stable page id
- title and nav label
- description
- owning application section
- explicit order inside that section
- content source

The same registry drives:

- the authenticated documentation app
- internal previous/next ordering
- application-local documentation trees

The registry should stay composable so future application docs can be contributed without rewriting
the renderer.

## Separation From Developer Docs

This ADR does **not** move developer docs into the usage documentation app.

Developer docs remain in:

- `docs/`
- `docs/adr/`
- nearest module `README.md`

The `command_center_docs` extension is only for product usage documentation.

## Consequences

### Positive

- usage docs stay aligned with signed-in product workflows
- the documentation tree scales with the real application model
- application-specific documentation can grow in ordered nested sections
- one content registry can serve the authenticated documentation app cleanly

### Tradeoffs

- documentation is not available to anonymous readers
- application documentation ownership must stay disciplined as more extensions contribute content

## Implemented Changes

The current implementation changes covered by this ADR are:

- the `command_center_docs` extension owns the signed-in usage-documentation app
- the docs app uses one shared page registry for navigation, ordering, and previous/next links
- the docs app now renders a three-column layout with a top-level section rail and a right-side
  section submenu
- the documentation tree is application-first, with ordered child pages inside each application
- the user docs no longer include a technical `Application Map` page
- the documentation left rail is restricted to `Getting Started`, `Workspaces`, `Foundry`,
  `Markets`, `Main Sequence AI`, and `Organization Admin`
- Foundry, Markets, and Main Sequence AI child pages are aligned to the owning application surface
  inventory
- the docs app does not define any anonymous public route
