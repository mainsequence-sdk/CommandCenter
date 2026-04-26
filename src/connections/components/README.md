# Connection Components

Reusable UI components for connection-aware settings and app surfaces.

## Entry Points

- `ConnectionPicker.tsx`: selects a backend-owned connection instance and returns a stable
  `ConnectionRef`. Menu rows render the connection type logo, instance name, type title/id, and
  status badges so connection-aware widget settings and explorer screens share one picker.
- `ConnectionTypeIcon.tsx`: renders a connection type logo with a safe initials fallback.
- `ConnectionQueryEditorFields.tsx`: shared form controls for connection-specific query editors.
  These controls keep SQL, JSON-object, string-list, number, boolean, and source-summary fields
  consistent when a connection type renders its own query kwargs inside the Connection Query widget.
  SQL fields render a shared editor surface so connection Explore screens and widgets share one
  query authoring path. String-list fields render committed tokens; pressing Enter or comma
  adds the typed value to the parent query immediately, so Save actions do not lose in-progress
  column or identifier edits. They may also render local suggestion tokens and per-connection
  normalization without making resource calls while the user edits a query.

## Maintenance Constraints

- Components must display connection metadata only. Do not render secret values or accept raw
  credentials here.
- Widget settings should store `ConnectionRef` values instead of endpoint URLs, tokens, or display
  names.
- Connection-specific query editors should render only payload fields for their selected
  `queryModel`; they receive the selected connection instance so they can show instance public
  config defaults without duplicating connection setup.
- Keep connection selection surfaces on `ConnectionPicker` unless a screen needs a materially
  different interaction model; that keeps logo/type/status rendering consistent across widgets and
  apps.
