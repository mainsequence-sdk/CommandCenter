# AppComponent Widget

This widget turns an OpenAPI operation into a reusable request form that can live on a workspace canvas.

## Purpose

- Discover API routes from a target service's `/openapi.json` document.
- Require the user to enter the target OpenAPI URL, Swagger docs URL, or service root explicitly for each widget instance.
- Let a user bind one widget instance to one API operation.
- Compile the selected operation into a persisted per-instance binding spec so request fields become
  bindable inputs and response fields become bindable outputs.
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
  binding spec into dynamic widget ports.
- `appComponentApi.ts`: authenticated OpenAPI fetch and request submission helpers, including the local mock transport used by explorer and mock mode.
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

## Maintenance Notes

- Keep transport auth aligned with the existing shell JWT flow. If the app-wide auth header behavior changes, update `appComponentApi.ts` in the same change.
- Keep the widget generic. Product-specific API presets should be modeled as preconfigured widget instances or future helper modules, not hardcoded into the core widget itself.
- Keep `bindingSpec.operationKey`, widget `method/path`, and runtime `operationKey` aligned. Dynamic
  outputs must not resolve against stale responses from a different endpoint selection.
- Build future chaining on the shared widget binding system. Do not introduce a second AppComponent-only
  cross-widget composition path.
