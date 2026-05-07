# ADR: Inline Canvas Editing Capability and Rich Text Widget

- Status: Proposed
- Date: 2026-04-16
- Related:
  - [ADR: Use React Grid Layout v2 API in Workspace Studio](./adr-rgl-v2-workspace-studio.md)
  - [ADR: Shared Workspace Content vs Per-User View State](./adr-shared-workspace-state.md)
  - [ADR: Agent-Ready Widget Type Registry Contract](./adr-agent-ready-widget-type-registry-contract.md)

## Context

The current `Markdown` widget is source-authored and settings-driven:

- content is stored as a markdown string in widget props
- users edit that content in the widget settings panel
- the mounted widget runtime only renders the markdown body

That model is fine for markdown-first documentation, but it is not friendly for users who want to
author narrative card content directly on the workspace canvas.

At the same time, the current workspace host blocks inline authoring even if a widget wanted it:

- workspace edit mode globally disables pointer events for widget bodies
- widget runtime components do not currently receive a direct prop-update callback
- there is no shared widget capability that says “this widget may remain interactive in edit mode”

There is also a content-model problem:

- `Markdown` stores raw markdown
- a TipTap-style rich text editor wants HTML or ProseMirror JSON

Trying to bolt TipTap onto the existing `Markdown` widget would create a misleading and fragile
content model. It would pretend the widget is still markdown-first while actually becoming a rich
text editor.

So there are really two separate needs:

1. a general platform capability for widgets that can edit inline on the canvas
2. a new rich text widget for friendly inline authoring

## Decision

We will not turn the existing `Markdown` widget into a TipTap-backed inline editor.

Instead we will:

1. keep `Markdown` as a markdown-first widget
2. add a general inline canvas editing capability to the widget platform
3. create a new core `Rich Text` widget that uses that capability

This keeps content models honest:

- `Markdown` remains source-oriented and markdown-native
- `Rich Text` becomes the friendly WYSIWYG card authoring widget

## Why Markdown Stays Separate

The existing `Markdown` widget should continue to mean:

- markdown is the canonical stored content
- authored content is text/source oriented
- the settings editor remains the primary authoring surface
- the runtime renderer is a markdown viewer, not a rich text editor

The platform should not silently convert a markdown widget into a rich-text widget.

That split matters for:

- predictable persistence
- clear agent/tooling semantics
- honest registry contracts
- lower migration risk for existing workspaces

## Decision Details

### 1. Add a shared inline canvas editing capability

The widget platform will gain a general capability for widgets that may stay interactive while the
workspace is in edit mode.

This should be modeled in the shared widget contract, not hardcoded for one widget family.

Recommended shape:

- widget capability or canvas-editing configuration such as:
  - `canvasEditing.mode = "none" | "inline"`

This capability must be reusable by future widgets, not only rich text.

### 2. Extend the widget runtime contract

Widgets that support inline editing need more than read-only props.

The shared `WidgetComponentProps` contract should be extended so widgets can know:

- whether the host is in editable canvas mode
- whether inline editing is allowed for this instance
- how to push instance prop updates back to the workspace draft

This should be a shared runtime contract change, not a widget-local workaround.

### 3. Make workspace edit mode selective, not global

Current workspace edit mode blocks interaction for all widget bodies.

That behavior will change to:

- non-inline-edit widgets still get the current non-interactive behavior in edit mode
- inline-edit widgets remain interactive inside their body

So the host changes from a blanket pointer-event block to capability-aware gating.

### 4. Introduce a new `Rich Text` widget

We will add a new core widget, recommended as:

- widget id: `rich-text-note`
- title: `Rich Text`

This widget will:

- support inline canvas editing in workspace edit mode
- use a TipTap-based authoring surface
- store rich text natively
- remain local authored content, not an execution widget

### 5. Use a rich-text-native storage model

For v1 the new widget will store HTML as canonical content.

Recommended props:

- `contentHtml?: string`
- `contentWidth?: "compact" | "prose" | "full"`
- `contentVerticalAlign?: "top" | "center" | "bottom"`
- `openLinksInNewTab?: boolean`

Why HTML for v1:

- simpler than round-tripping markdown through TipTap
- easier runtime rendering
- easier persistence
- easier snapshot/debug visibility

### 6. Keep Markdown as a separate authoring path

Users should choose the right widget for the right content model:

- `Markdown` for markdown-first notes, runbooks, and source-authored content
- `Rich Text` for friendly inline card editing and WYSIWYG authoring

There should be no automatic replacement of `Markdown` with `Rich Text`.

Any future conversion flow should be explicit and optional.

## Architecture

### Platform capability

The platform work belongs in the shared widget and workspace host layers:

- shared widget definition contract
- shared widget component props
- workspace canvas host behavior in edit mode

This is not a markdown-only change.

### Widget implementation

The new widget belongs under:

- `src/widgets/core/rich-text-note/`

It must include:

- `README.md`
- `definition.ts`
- `RichTextNoteWidget.tsx`
- `RichTextNoteWidgetSettings.tsx`

### Editor behavior

Recommended v1 behavior:

- normal view mode:
  - render stored HTML
- workspace edit mode:
  - render TipTap inline editor directly on the card
- settings:
  - keep only secondary presentation controls
  - optionally expose a source HTML panel for advanced inspection

### Toolbar scope

The first toolbar should stay practical:

- bold
- italic
- headings
- bullet list
- ordered list
- blockquote
- code
- link
- undo
- redo

Do not expand this into a full page-layout system in v1.

## Consequences

Positive:

- workspace users can author narrative cards directly where they appear
- the platform gains a reusable inline canvas editing capability
- `Markdown` stays honest and predictable
- `Rich Text` can be optimized for usability without distorting markdown semantics

Negative:

- the workspace host gets a more complex interaction model in edit mode
- widget runtime props need a broader host contract
- the new widget introduces a richer editor dependency and a new persistence format

## Guardrails

- Do not add TipTap to the existing `Markdown` widget.
- Do not add widget-specific host hacks for one inline editor.
- Do not keep the current blanket `pointer-events-none` behavior once inline-edit widgets exist.
- Do not claim markdown semantics for HTML-authored content.
- Do not make settings the only authoring path for the new rich text widget.
- Keep the existing `Markdown` widget markdown-first.
- Rich inline editing belongs to the new `Rich Text` widget, not `Markdown`.
- Do not add automatic Markdown-to-Rich-Text conversion in this rollout.

## Open Questions

- Should the platform later support an explicit one-way conversion flow from `Markdown` to `Rich Text`?

## Rollout Checklist

### Phase 1: Shared inline canvas editing capability

- [ ] Add a shared widget-level capability for inline canvas editing to the widget definition contract.
- [ ] Extend `WidgetComponentProps` with edit-mode and prop-update hooks needed by inline-edit widgets.
- [ ] Document the new shared capability in the shared widget docs.
- [ ] Add registry-contract support so agent/admin tooling can see whether a widget supports inline canvas editing.

### Phase 2: Workspace host interaction model

- [ ] Refactor workspace edit mode so widget body interactivity is gated by widget capability, not disabled globally.
- [ ] Keep non-inline-edit widgets non-interactive in workspace edit mode.
- [ ] Allow inline-edit widgets to receive pointer events and remain editable in workspace edit mode.
- [ ] Verify drag, selection, resize, and widget action chrome still behave correctly around interactive widget bodies.

### Phase 3: New Rich Text widget scaffold

- [ ] Create `src/widgets/core/rich-text-note/`.
- [ ] Add `README.md`.
- [ ] Add `definition.ts`.
- [ ] Add runtime component and settings component files.
- [ ] Register the widget in the core extension.
- [ ] Add an explicit widget registry contract and initial `widgetVersion`.

### Phase 4: Rich text content model

- [ ] Store canonical content as `contentHtml`.
- [ ] Add rich-text presentation props such as content width and vertical alignment.
- [ ] Render saved HTML safely in normal viewing mode.
- [ ] Ensure the widget remains local authored content with no execution ownership.

### Phase 5: TipTap inline editor

- [ ] Add TipTap dependencies.
- [ ] Build a minimal inline toolbar for the Rich Text widget.
- [ ] Mount the editor directly in the widget body when the workspace is in edit mode.
- [ ] Persist edits back into workspace draft props through the shared host callback.
- [ ] Preserve normal card rendering in non-edit mode.

### Phase 6: Settings and authoring UX

- [ ] Keep settings for secondary presentation controls.
- [ ] Avoid making settings the primary content-authoring surface for the Rich Text widget.
- [ ] Optionally add an advanced HTML source view for inspection/debugging.
- [ ] Make the widget title, registry hints, and settings copy clearly distinguish Rich Text from Markdown.

### Phase 7: Docs and validation

- [ ] Update local READMEs for the new widget and any changed host/shared modules.
- [ ] Update markdown docs to clarify that rich inline editing belongs to `Rich Text`, not `Markdown`.
- [ ] Update broader docs if the new widget changes authoring guidance for workspace users.
- [ ] Add checks or tests around inline-edit host behavior if feasible.
- [ ] Mark this ADR `Accepted` only after the host capability and new widget are both implemented.
