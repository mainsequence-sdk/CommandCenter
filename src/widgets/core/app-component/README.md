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
- Render the generated request inputs directly inside the widget body without exposing the live response there.
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
- `AppComponentWidget.tsx`: runtime widget body that renders only the generated request inputs.
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
- Binding still stays port-to-port. Nested response-field selection is stored on the binding edge
  as a transform, not as a second AppComponent-only wiring model.
- Request execution now also goes through the shared dashboard execution coordinator when it is
  available. Canvas `Submit` and settings `Test request` use the same graph-runner path so
  upstream executable dependencies can run first.
- AppComponent now exposes a saved `refreshOnDashboardRefresh` setting. It defaults to enabled, so
  dashboard refresh will re-run the configured request unless the instance explicitly disables it.
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
- `refreshOnDashboardRefresh` is a persisted widget prop. If backend widget-props validation exists,
  it must continue to allow this boolean field.
- Keep the safe-response cache policy narrow unless product requirements change. Manual submit and
  settings-side test execution intentionally bypass response caching so the user can force a fresh request.
- If product requirements change, update the app-level cache TTLs in `config/command-center.yaml`
  and the configuration docs in the same change so widget behavior and deployment expectations stay aligned.
