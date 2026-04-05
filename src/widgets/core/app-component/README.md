# AppComponent Widget

This widget turns an OpenAPI operation into a reusable request form that can live on a workspace canvas.

## Purpose

- Discover API routes from a target service's `/openapi.json` document.
- Require the user to enter the target OpenAPI URL, Swagger docs URL, or service root explicitly for each widget instance.
- Let a user bind one widget instance to one API operation.
- Compile the selected operation into a persisted per-instance binding spec so request fields become
  bindable inputs and response fields become bindable outputs.
- Keep flattened response leaf ports for simple bindings, while also publishing a structured root
  response output so binding edges can optionally extract nested fields without changing graph
  topology.
- Render the generated request inputs directly inside the widget body and optionally expose the latest response there as a read-only generated form.
- Submit requests with the current shell JWT by default so the widget follows the same auth path as the rest of the app.
- Persist per-instance route selection and binding metadata in widget props, and round-trip draft
  inputs plus the latest response through widget runtime state.
- Highlight operations in settings when required OpenAPI responses are missing a response model. Server-error `5xx` responses stay visible in the preview but are optional for endpoint validity.
- Keep configuration in the structured settings flow only. This widget opts out of the shared raw props JSON editor.

## Entry Points

- `definition.ts`: widget metadata and registry definition for the `app-component` widget id.
- `appComponentModel.ts`: OpenAPI types, widget props/runtime contracts, binding-spec compilation,
  form-generation helpers, bound-input overlay, and request builders.
- `appComponentContracts.ts`: shared scalar/json contracts used by AppComponent request and
  response ports.
- `appComponentDynamicIo.ts`: per-instance `resolveIo(...)` implementation that turns the compiled
  binding spec into dynamic widget ports, including the structured response output descriptor used
  by the shared binding transform UI.
- `appComponentApi.ts`: authenticated OpenAPI fetch and request submission helpers, including the local mock transport used by explorer and mock mode.
- `appComponentExecution.ts`: pure executable-widget adapter for `AppComponent`. It resolves bound
  inputs, builds the request, submits it, and returns a runtime-state patch for the shared
  dashboard graph runner.
- `AppComponentWidget.tsx`: runtime widget body that prefers a live OpenAPI-backed generated form
  when the configured endpoint is reachable, then falls back to the saved compiled request form or
  the legacy binding-spec synthesis path.
- `AppComponentWidgetSettings.tsx`: settings experience for API discovery, operation selection, response-model inspection, and live request testing.
- `AppComponentFormSections.tsx`: shared generated-input renderer reused by both the canvas widget and the settings-side test harness.

## Phase 1 Scope

- One widget instance maps to one selected OpenAPI operation.
- If the user pastes an explicit `/openapi.json` URL, schema discovery uses that exact endpoint.
- The widget supports path, query, and header parameters plus generated JSON request bodies.
- Complex or unsupported body schemas fall back to a raw request-body editor instead of blocking the user completely.
- Response inspection and request testing happen in widget settings; the mounted widget itself stays input-focused.
- Dynamic bindings are compiled from the selected endpoint in settings and resolved synchronously
  from saved widget props at graph/binding time.
- Settings still own endpoint selection and binding compilation, but runtime and shared execution
  now prefer a live OpenAPI-backed generated form when the configured endpoint is reachable. That
  is the upgrade path for stale saved compiled forms that predate newer field-render metadata. If
  live discovery is unavailable, runtime and execution still fall back to `bindingSpec.requestForm`
  or the legacy binding-port synthesis path.
- Binding still stays port-to-port. Nested response-field selection is stored on the binding edge
  as a transform, not as a second AppComponent-only wiring model.
- Request execution now also goes through the shared dashboard execution coordinator when it is
  available. Canvas `Submit` now uses the source-driven flow path so upstream executable
  dependencies run first and downstream executable dependents can rerun after the AppComponent
  publishes fresh runtime state. Settings `Test request` stays target-scoped and isolated to the
  selected widget graph.
- In a linear AppComponent chain like `A -> B -> C`, clicking `Submit` on `A` should execute the
  whole chain in order when every required request field on `B` and `C` is satisfiable through
  bindings, defaults, prefills, or current draft values.
- If an intermediate AppComponent in that chain is still missing a required request field, the
  chain stops there for that run. Example: if `A -> B -> C` and `B` cannot build its request
  because one required field is empty, `A` runs, `B` errors, `B` clears its response-derived
  outputs for that failed run, and `C` does not execute.
- The stop is branch-local, not workspace-global. Example: if `A` fans out to both `B` and `C`,
  and only `B` is missing a required request field, `C` can still execute as long as its own
  inputs are satisfiable.
- AppComponent now exposes a saved `refreshOnDashboardRefresh` setting. It defaults to enabled, so
  dashboard refresh will re-run the configured request unless the instance explicitly disables it.
- AppComponent also exposes a saved `showResponse` setting. It defaults to disabled, and when
  enabled the canvas card reuses the generated-form renderer to show the latest response body in a
  read-only layout.
- AppComponent also exposes a saved `hideRequestButton` setting. It defaults to disabled, and when
  enabled the canvas card hides manual submit so the widget runs only through graph execution,
  upstream dependency execution, or dashboard refresh.
- AppComponent now also persists a per-operation `requestInputMap` overlay. It is additive to the
  generated OpenAPI request form and lets users hide selected request fields from the canvas card,
  rename their labels, and prefill values without changing stable field keys or the compiled
  binding spec. Request execution still uses the full mapped submission form, while the canvas card
  renders the mapped visible subset.
- AppComponent now supports widget-specific OpenAPI form rendering metadata. Standard generated
  controls remain the default for every parameter and body field. The renderer only switches to a
  widget-specific control when `x-ui-widget` is present and matches a supported widget contract.
- AppComponent now also supports response-side editable form sessions. When the selected operation's
  primary success response advertises `x-ui-role: editable-form` and `x-ui-widget: definition-v1`,
  a successful response is normalized into a generic server-driven form session instead of being
  rendered as raw response JSON fields.
- OpenAPI discovery is cached globally in-memory for five minutes, and safe request responses
  (`GET` / `HEAD`) are cached in-memory for thirty seconds during shared refresh-style execution
  (`dashboard-refresh` / `manual-recalculate`) so identical AppComponent sources do not fan out into
  repeated network calls across widgets. Both TTLs are configured at the app level in
  `config/command-center.yaml`, not hardcoded in the widget.

## Maintenance Notes

- Keep transport auth aligned with the existing shell JWT flow. If the app-wide auth header behavior changes, update `appComponentApi.ts` in the same change.
- Keep the widget generic. Product-specific API presets should be modeled as preconfigured widget instances or future helper modules, not hardcoded into the core widget itself.
- Keep `bindingSpec.operationKey`, widget `method/path`, and runtime `operationKey` aligned. Dynamic
  outputs must not resolve against stale responses from a different endpoint selection.
- Keep the structured response descriptor and the flattened response ports aligned. The flat ports
  are convenience outputs; the structured root output is the fallback for nested extraction.
- Build future chaining on the shared widget binding system. Do not introduce a second AppComponent-only
  cross-widget composition path.
- Keep request execution in `appComponentExecution.ts` and the dashboard execution layer. Do not
  reintroduce separate inline submit orchestration in the widget body or settings page.
- Keep that split explicit:
  canvas submit should use source-driven flow execution because it is a live workspace action,
  while settings-side test execution should stay target-scoped so exploratory requests do not fan
  out into downstream widgets.
- Keep the branch-stop semantics explicit too. AppComponent execution failures that happen before a
  usable response is produced must clear response-derived outputs for that run so deeper widgets in
  the same chain do not keep executing from stale data.
- Runtime may now re-resolve OpenAPI metadata to upgrade stale saved forms and apply widget-specific
  render metadata. Keep that behavior narrow: prefer live OpenAPI only to enrich generated-form
  metadata and fall back cleanly when the endpoint is unavailable.
- `refreshOnDashboardRefresh` is a persisted widget prop. If backend widget-props validation exists,
  it must continue to allow this boolean field.
- `showResponse` is also a persisted widget prop. Runtime surfaces should keep using the existing
  generated-form renderer for response display instead of introducing a second response-only UI
  system.
- `hideRequestButton` is also a persisted widget prop. If backend widget-props validation exists,
  it must continue to allow this boolean field, and runtime submit handlers must treat it as a real
  behavior change rather than a cosmetic-only flag.
- `requestInputMap` is also a persisted widget prop. Keep it scoped by `operationKey`, and treat it
  as a UI/execution overlay only. Do not mutate `bindingSpec.requestForm`, request port ids, or
  binding field keys when applying label, visibility, or prefill customizations.
- Form-render resolution is widget-first:
  if the selected OpenAPI operation does not expose `x-ui-widget`, AppComponent always falls back
  to the standard generated renderer. If the selected operation exposes `x-ui-widget`, AppComponent
  attempts to build a supported widget-specific field model from the operation extension data. If
  the widget id is unknown, or the required widget config is incomplete, AppComponent falls back to
  the standard generated renderer instead of partially applying widget behavior.
- Runtime and execution both apply that same widget-first policy. Live OpenAPI metadata wins when
  available; the persisted compiled form is the fallback.
- That widget-first policy now exists on both sides:
  request-side metadata can replace generated request inputs, and response-side metadata can replace
  the generic response viewer with a stateful editable form session.
- The first supported widget-specific contract is `x-ui-widget: select2` with
  `x-ui-role: async-select-search` on the selected OpenAPI operation. This currently targets
  query-parameter search helpers on that operation.
- Required keys for `select2` + `async-select-search`:
  `x-ui-widget`, `x-ui-role`, `x-search-param`, `x-items-path`,
  `x-item-value-field`, `x-item-label-field`.
- Optional keys for `select2` + `async-select-search`:
  `x-ui-selection-type` (defaults to `single`, and only `single` is supported today),
  `x-search-param-aliases`, `x-pagination-path`, `x-pagination-more-field`.
- The current first-pass `select2` behavior treats `x-search-param` plus its aliases as the
  request-side search text transport, hides those helper fields from the rendered form, and
  replaces them with one async search control. If `page` and `limit` query parameters exist on the
  same operation, they are also treated as helper params and hidden from the rendered form.
- The current `select2` renderer queries the current AppComponent operation itself, using the
  generated request builder and current draft values. Selecting a result currently writes the
  selected option label back into the configured search params so normal request execution remains
  compatible with the existing transport model. If later product requirements need a distinct
  selected-id transport, extend the field model and widget-specific renderer instead of bolting
  more special cases onto the standard field editor.
- The first supported response-side editable-form contract is
  `x-ui-role: editable-form` with `x-ui-widget: definition-v1` on the selected operation's primary
  success response. The response body must match the generic `EditableFormDefinition` shape:
  `form_id`, `title`, `description`, `sections`, and optional `meta`.
- For `definition-v1`, `title` and `description` render as the form header, not as editable fields.
  Each section renders its own editable/read-only fields, and each field must expose a stable
  `token` so AppComponent can persist local edits and publish downstream outputs by token.
- When an editable form session is active, AppComponent publishes dynamic outputs from the current
  edited draft rather than from the generic response schema ports. It exposes one root
  `editable-form:$` output plus one field output per token under
  `editable-form:field:<token>`.
- Successful refreshes of the same `form_id` preserve local draft values for matching tokens. A
  new `form_id` resets the editable form session to the backend-provided values.
- Keep the safe-response cache policy narrow unless product requirements change. Manual submit and
  settings-side test execution intentionally bypass response caching so the user can force a fresh request.
- If product requirements change, update the app-level cache TTLs in `config/command-center.yaml`
  and the configuration docs in the same change so widget behavior and deployment expectations stay aligned.
