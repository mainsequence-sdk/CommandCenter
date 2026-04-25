# Connection Components

Reusable UI components for connection-aware settings and app surfaces.

## Entry Points

- `ConnectionPicker.tsx`: selects a backend-owned connection instance and returns a stable
  `ConnectionRef`. Menu rows render the connection type logo, instance name, type title/id, and
  status badges so connection-aware widget settings and explorer screens share one picker.
- `ConnectionTypeIcon.tsx`: renders a connection type logo with a safe initials fallback.

## Maintenance Constraints

- Components must display connection metadata only. Do not render secret values or accept raw
  credentials here.
- Widget settings should store `ConnectionRef` values instead of endpoint URLs, tokens, or display
  names.
- Keep connection selection surfaces on `ConnectionPicker` unless a screen needs a materially
  different interaction model; that keeps logo/type/status rendering consistent across widgets and
  apps.
