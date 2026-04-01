# AppComponent Widget

This widget turns an OpenAPI operation into a reusable request form that can live on a workspace canvas.

## Purpose

- Discover API routes from a target service's `/openapi.json` document.
- Let a user bind one widget instance to one API operation.
- Render a generated request form for that operation directly inside the widget body.
- Submit requests with the current shell JWT by default so the widget follows the same auth path as the rest of the app.
- Persist per-instance route selection in widget props and round-trip draft inputs plus the latest response through widget runtime state.

## Entry Points

- `definition.ts`: widget metadata and registry definition for the `app-component` widget id.
- `appComponentModel.ts`: OpenAPI types, widget props/runtime contracts, form-generation helpers, and request builders.
- `appComponentApi.ts`: authenticated OpenAPI fetch and request submission helpers, including the local mock transport used by explorer and mock mode.
- `AppComponentWidget.tsx`: runtime widget body that renders the generated request form and response preview.
- `AppComponentWidgetSettings.tsx`: settings experience for API discovery, operation selection, and request-body content-type selection.

## Phase 1 Scope

- One widget instance maps to one selected OpenAPI operation.
- The widget supports path, query, and header parameters plus generated JSON request bodies.
- Complex or unsupported body schemas fall back to a raw request-body editor instead of blocking the user completely.
- The widget publishes a normalized response payload into runtime state so later phases can wire one widget's output into another widget's input.

## Maintenance Notes

- Keep transport auth aligned with the existing shell JWT flow. If the app-wide auth header behavior changes, update `appComponentApi.ts` in the same change.
- Keep the widget generic. Product-specific API presets should be modeled as preconfigured widget instances or future helper modules, not hardcoded into the core widget itself.
- If the widget gains chained-input behavior in later phases, build on the shared dashboard widget registry instead of introducing a second cross-widget binding system.
