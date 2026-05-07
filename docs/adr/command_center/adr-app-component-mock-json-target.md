# ADR: AppComponent Mock JSON Target for Pipeline Prototyping

- Status: Proposed
- Date: 2026-04-14
- Related:
  - [ADR: AppComponent as a Binding-Native API Widget](./adr-app-component-binding-native-api-widget.md)
  - [ADR: Shared AppComponent Discovery and Safe-Response Caching](./adr-app-component-caching.md)
  - [ADR: AppComponent Response Notification UI Contract](./adr-app-component-response-notification-ui.md)

## Context

`AppComponent` is now the platform's generic API-bound widget. It already owns:

- schema discovery
- request-form compilation
- request execution
- response output publication
- response-side UI metadata such as `editable-form` and `notification`

That makes it the natural place for API-driven composition and pipeline authoring.

The current product problem is feedback speed.

Today, if a user wants to:

- prototype a new API-backed widget
- test how an AppComponent response will render on the card
- test what outputs it will publish
- wire that output into downstream widgets such as Data Node, Table, Statistic, or Graph

they usually need a real deployed API first.

That is too slow and too rigid for iterative workspace authoring. It forces backend work before the
user can validate:

- response shape
- response UI metadata
- bindings
- downstream pipeline composition

We need a way to prototype AppComponent behavior without requiring a live deployed API.

## Problem

If we solve this by creating a separate mock widget, we will split the platform into two competing
composition systems:

- real API widgets
- fake JSON widgets

That would immediately duplicate:

- binding behavior
- response-port compilation
- response rendering
- output publication
- settings UX

It would also force downstream widgets to care about where the data came from rather than simply
consuming the AppComponent output contract.

## Decision

We will extend `AppComponent` with a new target mode:

- `manual`
- `main-sequence-resource-release`
- `mock-json`

The mock mode will behave like an API-shaped target without making any network request.

## Core Model

### 1. Keep one widget

We will not introduce a new mock widget.

`AppComponent` remains the single authoring surface for:

- real API calls
- Main Sequence resource-release API calls
- inline mock API definitions

### 2. Store a mock API definition in widget props

In `mock-json` mode, the widget stores a persisted inline mock API definition in props.

The first implementation slice should support one mocked operation per widget instance with:

- `method`
- `path`
- optional request parameter/body schema
- success response example JSON
- optional explicit response schema
- optional response UI metadata such as:
  - `x-ui-role`
  - `x-ui-widget`

### 3. Build a synthetic OpenAPI document

The mock API definition must be converted into a synthetic OpenAPI document.

That synthetic document then becomes the source of truth for:

- schema explorer
- generated request form
- binding-spec compilation
- response-model preview
- response UI metadata resolution

This is the key architectural choice.

The rest of AppComponent should not care whether the OpenAPI document came from:

- network discovery
- Main Sequence release transport
- inline mock generation

### 4. Execute by returning the configured mock response

In `mock-json` mode, execution must not perform a fetch.

Instead, the AppComponent execution path returns the configured response fixture as if it had been
received from a successful API call.

That means:

- `lastResponseBody` is set from the mock response
- `lastResponseStatus` is set to the configured success status, or `200` by default
- `publishedOutputs` are derived exactly as they are for a real response
- response UI rendering still works through the normal AppComponent path

### 5. Keep bindings generic

Downstream widgets must not need to know whether the source AppComponent is:

- real
- release-backed
- mock-json

They should only consume the published AppComponent outputs through the normal binding model.

## Why This Option

This keeps the system generic and extension-friendly.

New widgets and extensions do not need to implement anything special for mock mode because the
output contract stays in the AppComponent layer.

The platform benefits are:

- one binding system
- one response UI contract system
- one request-form compiler
- one output-publication model
- one user-facing authoring flow

That avoids introducing a second fake-data composition path that would drift immediately.

## Rejected Alternatives

### Create a separate mock API widget

Rejected because it would duplicate AppComponent behavior and produce a parallel composition model.

### Store only a raw response JSON blob

Rejected because that would not be enough to drive:

- request-form generation
- binding-spec compilation
- response-model preview
- UI metadata resolution

The mock target needs an API-shaped definition, not just a random payload.

### Add network mocking outside the widget

Rejected because the user problem is authoring and pipeline prototyping, not transport interception.
External request mocking still requires the user to think in terms of a deployed API surface.

## First Implementation Slice

The first slice will support:

- one mocked operation per widget instance
- one primary success response
- optional request schema
- response example JSON
- optional explicit response schema
- response UI metadata, including notification and editable-form
- normal AppComponent bindings and published outputs

It will not yet support:

- multiple operations in one mock widget instance
- multiple response status variants
- request-to-response templating
- scripted mock logic
- latency simulation beyond a possible later optional delay field

## Saved Prop Shape

The exact final TypeScript shape can still be refined, but the persisted props should follow this
structure:

```ts
type AppComponentApiTargetMode =
  | "manual"
  | "main-sequence-resource-release"
  | "mock-json";

interface AppComponentMockJsonDefinition {
  version: 1;
  operation: {
    method: string;
    path: string;
    summary?: string;
    description?: string;
  };
  request?: {
    bodySchema?: Record<string, unknown>;
    parameterSchema?: Record<string, unknown>;
  };
  response: {
    status?: number;
    contentType?: string;
    body: unknown;
    schema?: Record<string, unknown>;
    ui?: {
      role?: string;
      widget?: string;
    };
  };
}
```

If `response.schema` is omitted, the system should infer a lightweight JSON schema from
`response.body`.

## Implementation Guidance

### 1. Add `mock-json` to the AppComponent target model

Update the AppComponent prop model so target selection is explicit and normalized.

This must remain widget-generic. No downstream widget should need target-specific logic.

### 2. Build synthetic OpenAPI centrally

Create a shared helper in the AppComponent module that turns the inline mock definition into a
synthetic OpenAPI document.

That helper should be the only place that knows how mock mode becomes OpenAPI.

### 3. Make schema explorer source-agnostic

Update the shared AppComponent schema explorer hook so it resolves its OpenAPI document from:

- fetched network OpenAPI for `manual`
- release-backed OpenAPI for `main-sequence-resource-release`
- synthetic OpenAPI for `mock-json`

The explorer must expose one consistent model regardless of target source.

### 4. Make runtime generation source-agnostic

Canvas runtime form generation and binding-spec compilation must also consume the same resolved
document source.

If mock mode can compile in settings, it must compile the same way on the mounted widget.

### 5. Make execution target-aware but output-compatible

The execution layer should decide what action to take based on target mode:

- `manual`: request
- `main-sequence-resource-release`: request through release transport
- `mock-json`: return configured mock response

The returned runtime-state shape must stay compatible across all three modes.

### 6. Keep response UI contracts working

The synthetic response schema must be able to carry:

- `x-ui-role`
- `x-ui-widget`

so notification and editable-form response rendering can be prototyped without a live backend.

### 7. Reuse the existing tester and preview surfaces

Widget settings, the mounted widget, and any other AppComponent-powered testing surfaces should all
work from the same mock definition.

No separate preview-only branch should be introduced.

### 8. Keep fallback behavior robust

If the mock definition is incomplete or invalid:

- schema explorer should explain what is missing
- execution should not publish broken outputs
- binding compilation should degrade cleanly

Robustness matters more than permissiveness here.

## Consequences

### Positive

- users can prototype AppComponent responses without deploying an API
- pipeline authoring becomes much faster
- response UI metadata can be validated before backend implementation exists
- bindings remain generic and reusable
- downstream widgets keep consuming the same contracts

### Negative

- AppComponent target selection becomes more complex
- the module now owns synthetic OpenAPI generation as well as real transport discovery
- invalid mock definitions need strong validation and fallback rules to avoid confusion

## Non-Goals

This ADR does not introduce:

- a full mock server
- a transport interceptor
- a new widget family for fake APIs
- multi-endpoint API simulation inside one widget
- arbitrary scripting of request/response behavior

The goal is pipeline prototyping, not replacing backend development entirely.

## Steps To Implement

1. Add `mock-json` target mode and normalized mock-definition props in the AppComponent model.
2. Add a synthetic OpenAPI builder inside the AppComponent module.
3. Refactor shared schema resolution so explorer/runtime can consume either fetched or synthetic documents.
4. Update AppComponent execution so `mock-json` returns a synthetic successful response instead of fetching.
5. Reuse the normal binding-spec compilation path for mock mode.
6. Add settings UI for editing the mock operation, request schema, response example, and response UI metadata.
7. Verify that notification and editable-form response contracts both work from the mock target.
8. Document the new target mode in the AppComponent README once implementation lands.
