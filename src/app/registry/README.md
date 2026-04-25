# App Registry

This directory owns runtime registry assembly for apps, dashboards, themes, widgets, and connection
types.

## Entry Points

- `index.ts`: eagerly loads extension entrypoints and root-level custom connection entrypoints,
  filters extensions by runtime flags, de-duplicates ids, and exposes the flattened `appRegistry`.
- `connection-runtime.ts`: loads root-level custom connection runtime definitions without importing
  app surfaces, plus connection definition files under extension `connections/` folders. Connection
  management pages use it to reattach non-serializable runtime pieces such as icons and Explore
  components to backend-synced connection type records.
- `types.ts`: shared `AppExtension` / `AppRegistry` contracts used by extensions and shell code.
  This now includes flattened shell-settings contribution entries derived from app definitions.
- `widget-type-sync.ts`: builds the explicit backend widget-type manifest, validates contract completeness, and exposes the explicit publish request used by platform-admin settings.
- `connection-type-sync.ts`: builds the backend connection-type manifest from
  `appRegistry.connections` and exposes the explicit publish request used by platform-admin
  settings.

## Notable Behavior

- The registry is the single runtime source of truth for available widgets. Workspace persistence stores widget instances only; widget type metadata still comes from this registry.
- Custom connection implementations are loaded from `connections/*/index.ts`. They contribute
  connection type metadata only; they must not register sidebar apps or widgets.
- Extension-owned connection implementations are also discovered from `connections/*.ts` files
  inside extension folders, so backend-synced type records can still resolve local icons and
  connection-specific runtime components.
- Backend connection types remain the availability gate. When a local connection definition is a
  newer version than the backend-synced record, connection create/edit screens may show the newer
  local schema for review but must warn that the backend registry needs publication before saving.
- App surfaces can now also carry assistant-facing context metadata through `AppSurfaceDefinition.assistantContext`. Chat and other AI-facing features should read surface context from the registry instead of maintaining a second per-route metadata map for normal app surfaces.
- App definitions can now also contribute shell settings sections through
  `shellMenuContributions`. The registry flattens those into audience- and permission-filtered
  shell menu entries for the shared settings dialog.
- App definitions can also set `navigationOrder` to make shell app ordering explicit instead of
  relying on extension discovery order. Lower numbers render earlier within the same navigation
  placement.
- Widget-type sync intentionally does not send raw `WidgetDefinition` objects. It projects an explicit JSON-safe contract instead, including the resolved `description`, per-widget `widgetVersion`, runtime ownership, configuration summary, IO summary, capabilities, usage guidance, and examples.
- Widget usage guidance is authored in colocated widget `USAGE_GUIDANCE.md` files and imported by
  the widget definitions before sync. `buildPurpose` becomes the plain backend `description` field,
  and the full structured guidance becomes `usageGuidance`.
- Widget-type sync now also projects optional organization-configuration capability metadata when a
  widget definition declares `organizationConfiguration`. That metadata is type-level only:
  schema, defaults, and version.
- When the backend widget-types list endpoint is configured, user-facing widget catalogs should
  treat backend registration as an availability gate. A widget that exists in the local frontend
  build but does not have an active backend `RegisteredWidgetType` row must stay hidden from normal
  widget-picking surfaces.
- Backend widget-type publication is now an explicit platform-admin action. Normal sign-in and app bootstrap must not write widget registry state to the backend.
- Backend connection-type publication is also an explicit platform-admin action. The shared
  Connections app treats active backend connection types as the user-facing availability gate.
- Publish requests are still deduplicated while the same checksum is already in flight, but identical manifests may be published again intentionally from the admin UI and should no-op server-side through checksum handling.
- The admin manifest preview now shows validation issues plus a contract preview so registry publication can be reviewed before it is sent to the backend.
- The standardized contract and remaining rollout checklist live in [docs/adr/adr-agent-ready-widget-type-registry-contract.md](/Users/jose/code/MainSequenceClientSide/CommandCenter/docs/adr/adr-agent-ready-widget-type-registry-contract.md).

## Maintenance Notes

- Keep widget-type sync aligned with backend catalog expectations whenever `WidgetDefinition` metadata changes materially.
- Keep connection-type sync aligned with backend catalog expectations whenever
  `ConnectionTypeDefinition` metadata changes materially.
- Keep widget `USAGE_GUIDANCE.md` files aligned with the catalog meaning of each widget type; that
  Markdown content is the source for the backend-synced description and usage guidance.
- Widget authors must bump `widgetVersion` when configuration model, IO contract, execution behavior, or other agent-relevant authoring semantics change materially.
- If a widget starts supporting organization-scoped configuration, keep the synced widget-type
  metadata aligned with the widget definition's declared schema, defaults, and version.
- When adding a new app surface, provide `assistantContext.summary` plus a concise action list so assistant features can describe what the user is seeing without route-specific hardcoding.
- When an extension needs user/admin settings pages inside the shared shell dialog, declare them on
  the app definition through `shellMenuContributions` instead of patching shell layout files
  directly.
- If a sync manifest contract changes in a backend-visible way, bump the relevant registry version
  in `widget-type-sync.ts` or `connection-type-sync.ts`.
