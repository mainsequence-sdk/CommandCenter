# ADR: AppComponent Response Notification UI Contract

- Status: Proposed
- Date: 2026-04-14
- Related:
  - [ADR: AppComponent as a Binding-Native API Widget](./adr-app-component-binding-native-api-widget.md)
  - [ADR: Shared AppComponent Discovery and Safe-Response Caching](./adr-app-component-caching.md)

## Context

`AppComponent` currently has two response presentation modes:

1. default response rendering
   The widget reads `lastResponseBody`, builds a read-only generated form from the selected
   response ports, and renders that response through the shared generated-form renderer.

2. editable-form response rendering
   When the selected primary success response declares:
   - `x-ui-role: editable-form`
   - `x-ui-widget: definition-v1`

   the widget interprets the response as a stateful editable form session instead of using the
   default response renderer.

That leaves a gap for simpler user-facing response feedback. Some operations do not need a full
editable response surface and also should not fall back to raw JSON or a dense read-only field
grid. They need a small semantic success/warning/error notification that tells the user what just
happened.

The existing response UI extension pattern is already the right foundation. We should extend that
contract instead of adding a widget-local special case.

## Problem

The current default response rendering is too heavy for response payloads that are conceptually just
a notification.

Examples:

- `Release deployed successfully`
- `Validation completed with warnings`
- `Action failed because the request conflicted with an existing resource`

Rendering those payloads as either:

- raw JSON in a test/debug surface, or
- a read-only generated response form on the canvas

is technically correct but visually weak.

## Decision

We will add a response-side notification UI contract for `AppComponent`.

### Response metadata

The first supported notification response metadata is:

```json
{
  "x-ui-role": "notification",
  "x-ui-widget": "banner-v1"
}
```

### Expected response payload

The first supported notification payload shape is:

```json
{
  "title": "Optional short heading",
  "message": "Primary user-facing notification text",
  "tone": "success",
  "details": "Optional secondary explanation"
}
```

Field rules:

- `message`
  required non-empty string
- `tone`
  required and must be one of:
  - `success`
  - `info`
  - `warning`
  - `error`
- `title`
  optional non-empty string
- `details`
  optional non-empty string

### Presentation-only contract

Notification rendering is a response presentation mode only.

It must not change:

- `lastResponseBody`
- `publishedOutputs`
- response port compilation
- binding semantics

This is a strict distinction from `editable-form`, which intentionally changes runtime publication
behavior and output exposure.

## Why This Option

This keeps response UI extensibility in one place:

- response-side OpenAPI metadata selects a response UI contract
- the widget resolves that contract from the selected primary success response
- the renderer chooses the correct UI
- outputs and binding behavior stay stable unless the contract explicitly requires otherwise

That keeps the implementation aligned with the existing `editable-form` response architecture
instead of growing a second response-override path.

## Rejected Alternatives

### Add a widget-only `show notification` flag

Rejected because the response UI should be declared by the API contract, not guessed by the widget
instance.

### Replace the raw response everywhere

Rejected because settings-side test surfaces and developer-focused API tooling still benefit from
raw response inspection.

### Reuse the editable-form contract for notifications

Rejected because notifications are not stateful forms and should not change output publication or
runtime session handling.

## Implementation Guidance

### 1. Generalize the response UI descriptor

Replace the current editable-form-only response UI descriptor handling with a union-based response UI
resolver.

The resolver should support:

- `editable-form / definition-v1`
- `notification / banner-v1`

and return `undefined` for unknown or unsupported combinations.

### 2. Keep notification mode additive

Unlike editable-form mode, notification mode must not suppress response ports or response output
publication.

If the selected response advertises notification UI:

- keep compiling `responsePorts`
- keep publishing outputs from the raw response body
- only switch the rendered response presentation

### 3. Normalize notification payloads centrally

Add a centralized response-notification payload resolver in the AppComponent model layer.

That resolver should:

- validate the payload shape
- normalize strings
- reject unsupported tones
- return `undefined` on invalid payloads

Invalid payloads must fall back to the current renderer instead of leaving the user with a blank
state.

### 4. Add a reusable notification renderer

Create a shared AppComponent response-notification renderer component.

The first visual mode is `banner-v1` and should support:

- tone styling
- optional title
- required message
- optional details

### 5. Use renderer priority order

Canvas widget response rendering should follow this order:

1. editable-form session
2. notification banner
3. default read-only response form
4. nothing

That preserves the stronger stateful response contract when it exists.

### 6. Extend reusable test/debug surfaces without removing raw access

The reusable AppComponent request-test section should gain an optional response-preview slot.

That slot can render the notification preview while keeping the raw response below it for debugging.

This applies to:

- AppComponent widget settings
- Main Sequence resource-release `Test API` tab

The developer-oriented surfaces should keep the raw response visible even when a notification
preview exists.

## Expected Payload Examples

### Minimal

```json
{
  "message": "Deployment completed.",
  "tone": "success"
}
```

### Full

```json
{
  "title": "Release deployed",
  "message": "Resource release 79 is now active.",
  "tone": "success",
  "details": "The new FastAPI image passed startup checks and is receiving traffic."
}
```

## Consequences

### Positive

- response feedback becomes more user-facing without changing bindings
- response UI extensibility stays centralized in the AppComponent response contract
- debug surfaces keep raw response visibility
- fallback behavior stays robust when payloads are malformed or metadata is missing

### Negative

- response UI handling becomes more complex than the current editable-form-only branch
- the widget must maintain a clear distinction between presentation-only response contracts and
  stateful response contracts

## Non-Goals

This ADR does not introduce:

- arbitrary response widget rendering
- custom field mapping metadata for notifications
- response-side output contract changes
- removal of raw response inspection from developer-focused surfaces

The first implementation slice is intentionally narrow.

## Steps To Implement

1. Add a generic `AppComponentResponseUiDescriptor` union in
   `src/widgets/core/app-component/appComponentModel.ts`.
2. Replace the editable-form-only resolver with a generic
   `resolveAppComponentResponseUiDescriptor(...)`.
3. Add a centralized notification payload resolver for the `banner-v1` shape.
4. Add a reusable `AppComponentResponseNotification.tsx` component.
5. Wire notification rendering into `AppComponentWidget.tsx` with the priority order:
   editable-form -> notification -> default response form.
6. Extend `AppComponentRequestTestSection.tsx` with an optional response preview slot.
7. Use that preview slot from:
   - `AppComponentWidgetSettings.tsx`
   - `extensions/main_sequence/extensions/workbench/features/projects/MainSequenceResourceReleaseApiTestTab.tsx`
8. Keep raw response rendering visible in developer-oriented test surfaces.
9. Document the new response UI metadata in
   `src/widgets/core/app-component/README.md`.
10. Verify:
    - normal responses remain unchanged
    - editable-form responses remain unchanged
    - notification responses render the banner
    - invalid notification payloads fall back cleanly
    - published outputs remain unchanged in notification mode
