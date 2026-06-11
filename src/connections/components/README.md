# Connection Components

Reusable UI components for connection-aware settings and app surfaces.

## Entry Points

- `ConnectionPicker.tsx`: selects a connection instance and returns a stable `ConnectionRef`.
  The picker lists backend-managed instances only. It must not inject synthetic defaults or system
  placeholders such as `prometheus-default`, because widget runtime execution needs a real backend
  connection id. Menu rows render the connection type logo, instance name, type title/id, and
  status badges so connection-aware settings and explorer screens share one picker.
- `ConnectionTypeIcon.tsx`: renders a connection type logo with a safe initials fallback.
- `connection-icons.ts`: resolves icon descriptors for type-level and instance-level connection
  rendering. Adapter From API instances may use sanitized `compiledContract.openapi.logo` metadata
  discovered from OpenAPI `info.x-logo`; other connections continue to use their registered
  type-level icon.
- `ConnectionQueryEditorFields.tsx`: shared form controls for connection-specific query editors.
  These controls keep CodeMirror-backed query code, SQL, JSON-object, string-list, number, boolean,
  and source-summary fields consistent when a connection type renders its own query kwargs inside
  the Connection Query widget. Query code fields render a shared editor surface so connection
  Explore screens and widgets share one query authoring path. String-list fields render committed
  tokens; pressing Enter or comma
  adds the typed value to the parent query immediately, so Save actions do not lose in-progress
  column or identifier edits. They may also render local suggestion tokens and per-connection
  normalization without making resource calls while the user edits a query.

## Maintenance Constraints

- Components must display connection metadata only. Do not render secret values or accept raw
  credentials here.
- Dynamic instance logos are display metadata only. Only absolute HTTP(S) URLs from sanitized
  compiled-contract branding are rendered; unsafe protocols fall back to the connection type icon.
- Widget settings should store `ConnectionRef` values instead of endpoint URLs, tokens, or display
  names.
- Connection-specific query editors should render only payload fields for their selected
  `queryModel`; they receive the selected connection instance so they can show instance public
  config defaults without duplicating connection setup.
- Keep connection selection surfaces on `ConnectionPicker` unless a screen needs a materially
  different interaction model; that keeps logo/type/status rendering consistent across widgets and
  apps.
