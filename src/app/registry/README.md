# App Registry

This directory owns runtime registry assembly for apps, dashboards, themes, and widgets.

## Entry Points

- `index.ts`: eagerly loads extension entrypoints, filters them by runtime flags, de-duplicates ids, and exposes the flattened `appRegistry`.
- `types.ts`: shared `AppExtension` / `AppRegistry` contracts used by extensions and shell code.
- `widget-type-sync.ts`: builds the explicit backend widget-type manifest, validates contract completeness, and exposes the explicit publish request used by platform-admin settings.

## Notable Behavior

- The registry is the single runtime source of truth for available widgets. Workspace persistence stores widget instances only; widget type metadata still comes from this registry.
- App surfaces can now also carry assistant-facing context metadata through `AppSurfaceDefinition.assistantContext`. Chat and other AI-facing features should read surface context from the registry instead of maintaining a second per-route metadata map for normal app surfaces.
- Widget-type sync intentionally does not send raw `WidgetDefinition` objects. It projects an explicit JSON-safe contract instead, including per-widget `widgetVersion`, runtime ownership, configuration summary, IO summary, capabilities, agent hints, and examples.
- Backend widget-type publication is now an explicit platform-admin action. Normal sign-in and app bootstrap must not write widget registry state to the backend.
- Publish requests are still deduplicated while the same checksum is already in flight, but identical manifests may be published again intentionally from the admin UI and should no-op server-side through checksum handling.
- The admin manifest preview now shows validation issues plus a contract preview so registry publication can be reviewed before it is sent to the backend.
- The standardized contract and remaining rollout checklist live in [docs/adr/adr-agent-ready-widget-type-registry-contract.md](/Users/jose/code/MainSequenceClientSide/CommandCenter/docs/adr/adr-agent-ready-widget-type-registry-contract.md).

## Maintenance Notes

- Keep widget-type sync aligned with backend catalog expectations whenever `WidgetDefinition` metadata changes materially.
- Widget authors must bump `widgetVersion` when configuration model, IO contract, execution behavior, or other agent-relevant authoring semantics change materially.
- When adding a new app surface, provide `assistantContext.summary` plus a concise action list so assistant features can describe what the user is seeing without route-specific hardcoding.
- If the sync manifest contract changes in a backend-visible way, bump `WIDGET_REGISTRY_VERSION` in `widget-type-sync.ts`.
