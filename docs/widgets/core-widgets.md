# Core Widgets

Core widgets are the reusable visual building blocks that ship with the platform out of the box.
They are designed to cover the most common command-surface patterns without forcing a product team
to start from a blank screen.

The current built-in widget set is intentionally opinionated:

- narrative context and note-taking
- API form generation and request submission
- structural workspace composition

All of them are registered by the core extension in `src/extensions/core/index.ts`.

For implementation details and maintenance constraints, use the widget-local `README.md` files:

- `src/widgets/core/app-component/README.md`
- `src/widgets/core/markdown-note/README.md`
- `src/widgets/core/rich-text-note/README.md`
- `src/widgets/core/workspace-row/README.md`

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

## Extending Core Widgets

Extend a core widget only when the behavior should remain reusable across the whole platform.

Build a new widget or move behavior into an extension when:

- the interaction model is product-specific
- the dependencies are optional or vendor-specific
- the configuration model no longer stays clean as a shared primitive
- the maintenance burden would force unrelated teams to carry the cost

## Shipped core widgets

### Markdown

- **Widget id:** `markdown-note`
- **Category:** `Content`
- **Kind:** `custom`
- **Default size:** `6 x 6`
- **Permissions:** `workspaces:view`
- **Example props:** narrative markdown note content
- **Implementation README:** `src/widgets/core/markdown-note/README.md`

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

### Rich Text

- **Widget id:** `rich-text-note`
- **Category:** `Content`
- **Kind:** `custom`
- **Default size:** `6 x 6`
- **Permissions:** `workspaces:view`
- **Example props:** inline-authored narrative content with persisted rich text formatting
- **Implementation README:** `src/widgets/core/rich-text-note/README.md`

What it is:

`Rich Text` is the inline-editing narrative widget for users who need canvas-native authoring
instead of raw markdown.

What it is good for:

- quick workspace annotations
- operator notes with formatting controls
- editable canvas callouts
- WYSIWYG narrative authoring in the workspace studio

Where it is used now:

- workspace authoring flows that need richer in-canvas editing than markdown

Why it matters:

This widget gives the workspace studio an author-friendly text surface without forcing markdown or
turning general content widgets into a full document editor.

### Row

- **Widget id:** `workspace-row`
- **Category:** `Workspace`
- **Kind:** `custom`
- **Default size:** `12 x 1`
- **Permissions:** `workspaces:view`
- **Implementation README:** `src/widgets/core/workspace-row/README.md`

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
- **Permissions:** `workspaces:view`
- **Example props:** explicit OpenAPI URL, Swagger docs URL, or service root plus auth mode; route binding is instance-scoped
- **Implementation README:** `src/widgets/core/app-component/README.md`

What it is:

`AppComponent` reads an OpenAPI schema from the explicit URL the user provides, lets a user bind one
widget instance to one API operation, compiles that operation into bindable request/response ports,
keeps flattened response outputs for simple bindings, also exposes one structured root response
output for nested-field extraction, renders the generated request form directly inside the
widget body, caches OpenAPI discovery globally, and reuses short-lived cached `GET` / `HEAD`
responses during shared refresh-style execution so identical API source widgets do not fan out into
duplicate network calls.

What it is good for:

- operator-facing API tools
- internal submission forms
- authenticated request workflows
- workspace composition around service endpoints
- request/response chaining between API-backed workspace components

Where it is used now:

- available through the widget catalog for user-configurable workspace surfaces

Why it matters:

This widget turns backend route contracts into reusable workspace components instead of forcing
teams to hand-build one-off forms for every internal API action.

## Current platform composition

The core extension currently uses the widget set in three ways:

1. `Markdown` gives the platform a built-in narrative and documentation widget for operator-facing
   dashboards.
2. `AppComponent` gives the platform a generic authenticated API form builder driven by OpenAPI
   instead of custom page-level forms.
3. `Rich Text` gives workspace authors a canvas-native note surface for inline editing.
4. `Row` adds structural workspace composition as a first-class primitive inside the workspace
   studio.

## When to build a new widget instead of reusing core

Build a new widget when:

- the domain needs a new visual pattern
- the existing props model is no longer clean
- the interaction model is product-specific
- the widget belongs in an optional vendor integration

Reuse core widgets when:

- you need markdown-based documentation or notes
- you need a generic OpenAPI-backed request form
- you need structural row grouping in workspaces

## Related docs

- [Platform Architecture](../platform/architecture.md)
- [Apps and Surfaces](../apps/overview.md)
- [Dashboard Layouts](../workspaces/dashboard-layouts.md)
- [Extensions](../extensions/overview.md)
- [Widget Index](./README.md)
