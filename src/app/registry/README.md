# App Registry

This directory owns runtime registry assembly for apps, dashboards, themes, and widgets.

## Entry Points

- `index.ts`: eagerly loads extension entrypoints, filters them by runtime flags, de-duplicates ids, and exposes the flattened `appRegistry`.
- `types.ts`: shared `AppExtension` / `AppRegistry` contracts used by extensions and shell code.
- `widget-type-sync.ts`: projects the live widget registry into a JSON-safe backend manifest and synchronizes it to the configured widget-type catalog endpoint once per authenticated browser session.

## Notable Behavior

- The registry is the single runtime source of truth for available widgets. Workspace persistence stores widget instances only; widget type metadata still comes from this registry.
- App surfaces can now also carry assistant-facing context metadata through `AppSurfaceDefinition.assistantContext`. Chat and other AI-facing features should read surface context from the registry instead of maintaining a second per-route metadata map for normal app surfaces.
- Widget-type sync intentionally does not send raw `WidgetDefinition` objects. It projects JSON-safe metadata for `schema`, `io`, and `defaultPresentation` because runtime widget definitions include React components and functions.
- The sync is session-scoped and deduplicated by `userId + registryVersion + checksum`, so login/session restore can safely trigger it without spamming the backend.

## Maintenance Notes

- Keep widget-type sync aligned with backend catalog expectations whenever `WidgetDefinition` metadata changes materially.
- When adding a new app surface, provide `assistantContext.summary` plus a concise action list so assistant features can describe what the user is seeing without route-specific hardcoding.
- If the sync manifest contract changes in a backend-visible way, bump `WIDGET_REGISTRY_VERSION` in `widget-type-sync.ts`.
