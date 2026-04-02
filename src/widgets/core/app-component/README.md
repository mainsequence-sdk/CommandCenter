# AppComponent Widget

This widget turns an OpenAPI operation into a reusable request form that can live on a workspace canvas.

## Purpose

- Discover API routes from a target service's `/openapi.json` document.
- Require the user to enter the target OpenAPI URL, Swagger docs URL, or service root explicitly for each widget instance.
- Let a user bind one widget instance to one API operation.
- Render the generated request inputs directly inside the widget body without exposing the live response there.
- Submit requests with the current shell JWT by default so the widget follows the same auth path as the rest of the app.
- Persist per-instance route selection in widget props and round-trip draft inputs plus the latest response through widget runtime state.
- Highlight operations in settings when required OpenAPI responses are missing a response model. Server-error `5xx` responses stay visible in the preview but are optional for endpoint validity.
- Keep configuration in the structured settings flow only. This widget opts out of the shared raw props JSON editor.

## Entry Points

- `definition.ts`: widget metadata and registry definition for the `app-component` widget id.
- `appComponentModel.ts`: OpenAPI types, widget props/runtime contracts, form-generation helpers, and request builders.
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

## Maintenance Notes

- Keep transport auth aligned with the existing shell JWT flow. If the app-wide auth header behavior changes, update `appComponentApi.ts` in the same change.
- Keep the widget generic. Product-specific API presets should be modeled as preconfigured widget instances or future helper modules, not hardcoded into the core widget itself.
- If the widget gains chained-input behavior in later phases, build on the shared dashboard widget registry instead of introducing a second cross-widget binding system.
