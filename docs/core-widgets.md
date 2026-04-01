# Core Widgets

Core widgets are the reusable visual building blocks that ship with the platform out of the box.
They are designed to cover the most common command-surface patterns without forcing a product team
to start from a blank screen.

The current built-in widget set is intentionally opinionated:

- feed-based situational awareness
- narrative context and note-taking
- API form generation and request submission
- structural workspace composition

All of them are registered by the core extension in `src/extensions/core/index.ts`.

## Widget contract

Every widget is registered as a `WidgetDefinition` with:

- `id`
- `title`
- `description`
- `category`
- `kind`
- `source`
- `defaultSize`
- `requiredPermissions`
- optional `tags`
- optional `exampleProps`

That means each widget can be:

- discovered in the registry
- permissioned consistently
- reused across multiple dashboards
- documented once and composed many times

## Shipped core widgets

### News Feed

- **Widget id:** `news-feed`
- **Category:** `Feeds`
- **Kind:** `feed`
- **Default size:** `4 x 5`
- **Permissions:** `news:read`
- **Example props:** `{ limit: 6 }`

What it is:

`News Feed` is the compact event tape for market-moving headlines and narrative context.

What it is good for:

- catalyst monitoring
- macro pulse sidebars
- event-driven desks
- pre-open briefing surfaces

Where it is used now:

- `Demo / Overview`
- `Demo / Cross-Asset`
- `Admin / Admin Console`

Why it matters:

Strong operational dashboards are rarely just numbers. The news feed gives the platform a reusable
context layer so users understand why a surface is moving, not only that it moved.

### Markdown

- **Widget id:** `markdown-note`
- **Category:** `Content`
- **Kind:** `custom`
- **Default size:** `6 x 6`
- **Permissions:** `dashboard:view`
- **Example props:** narrative markdown note content

What it is:

`Markdown` renders structured narrative content inside a widget using regular markdown.

What it is good for:

- runbooks
- operator notes
- dashboard context
- embedded documentation

Where it is used now:

- available through the widget catalog for narrative and documentation-heavy surfaces

Why it matters:

Not every useful dashboard panel is a chart or a feed. This widget gives the platform a reusable
way to mix explanation, instructions, and lightweight tables into operational surfaces.

### Row

- **Widget id:** `workspace-row`
- **Category:** `Workspace`
- **Kind:** `custom`
- **Default size:** `12 x 1`
- **Permissions:** `dashboard:view`

What it is:

`Row` is a structural workspace widget used to divide a workspace into horizontal sections.

What it is good for:

- grouping widgets into bands
- separating dashboard sections
- organizing large workspace canvases
- creating optional visible or hidden row boundaries

Where it is used now:

- workspace composition and layout structuring in the workspace studio

Why it matters:

This widget extends the platform beyond pure content panels. It gives the workspace builder a
first-class structural primitive instead of forcing layout grouping to be inferred from arbitrary
widget positions.

### AppComponent

- **Widget id:** `app-component`
- **Category:** `API`
- **Kind:** `custom`
- **Default size:** `8 x 8`
- **Permissions:** `dashboard:view`
- **Example props:** API base URL plus auth mode; route binding is instance-scoped

What it is:

`AppComponent` reads an OpenAPI schema from `/openapi.json`, lets a user bind one widget instance
to one API operation, and renders the generated request form directly inside the widget body.

What it is good for:

- operator-facing API tools
- internal submission forms
- authenticated request workflows
- workspace composition around service endpoints

Where it is used now:

- available through the widget catalog for user-configurable workspace surfaces

Why it matters:

This widget turns backend route contracts into reusable workspace components instead of forcing
teams to hand-build one-off forms for every internal API action.

## Current platform composition

The core extension currently uses the widget set in three ways:

1. `News Feed` provides a reusable narrative/event context pattern for shipped surfaces.
2. `Markdown` gives the platform a built-in narrative and documentation widget for operator-facing
   dashboards.
3. `AppComponent` gives the platform a generic authenticated API form builder driven by OpenAPI
   instead of custom page-level forms.
4. `Row` adds structural workspace composition as a first-class primitive inside the workspace
   studio.

## When to build a new widget instead of reusing core

Build a new widget when:

- the domain needs a new visual pattern
- the existing props model is no longer clean
- the interaction model is product-specific
- the widget belongs in an optional vendor integration

Reuse core widgets when:

- you need a narrative or event feed
- you need markdown-based documentation or notes
- you need a generic OpenAPI-backed request form
- you need structural row grouping in workspaces

## Related docs

- [Architecture](./architecture.md)
- [Apps and Surfaces](./apps-and-surfaces.md)
- [Dashboard Layouts](./dashboard-layouts.md)
- [Extensions](./extensions.md)
