# Command Center Preferences

This module owns optional backend persistence for shell-level user preferences.

## Purpose

- Load authenticated user preferences from a configured backend endpoint.
- Sync durable shell preferences back to that endpoint when the user changes them.
- Preserve the current browser-local workflow when no backend preferences endpoint is configured.

## Main entry points

- `api.ts`: authenticated GET/PUT helpers for the configured preferences endpoint.
- `CommandCenterPreferencesProvider.tsx`: bootstrap and synchronization layer between backend preferences, i18n, and the shell store.

## Backend contract

The configured backend contract is:

- `preferences.url`
  - `GET`: return the current user preference snapshot
  - `PUT`: replace the current user preference snapshot and return the normalized saved snapshot
- `preferences.favorites_create_url`
  - `POST`: create one favorite entry
- `preferences.favorites_reorder_url`
  - `POST`: reorder favorites of a given kind
- `preferences.favorites_delete_url`
  - `DELETE`: delete one favorite entry, usually with `{kind}` and `{target_key}` path placeholders

Expected payload shape:

```json
{
  "language": "en",
  "favoriteSurfaceIds": ["access-rbac.overview"],
  "favoriteWorkspaceIds": ["workspace-studio::workspace::abc123"]
}
```

## Current scope

- Persisted remotely when configured:
  - `language`
  - `favoriteSurfaceIds`
  - `favoriteWorkspaceIds`
- Kept local-only:
  - transient shell UI state such as kiosk mode, sidebar visibility, app-panel visibility, command input, and live connection status

## Runtime behavior

- When `preferences.url` is configured, the provider waits for an authenticated user, loads the preference snapshot, hydrates i18n and the shell store, and pushes later language/favorite changes back with `PUT`.
- The dedicated favorites endpoints are also available in config so the frontend can move to per-favorite mutations later without changing the runtime config shape again.
- When `preferences.url` is blank or omitted, the app keeps the pre-existing browser-local behavior:
  - language persists through `localStorage`
  - shell favorites persist through the existing persisted Zustand store
- Auth session state is intentionally separate from this module. This module does not own JWT/session persistence.

## Maintenance notes

- The backend integration is optional by design. If `preferences.url` is blank or omitted in `config/command-center.yaml`, the app falls back to local browser persistence.
- Keep the backend payload aligned with the frontend shell state contract so hydration stays straightforward.
- If the backend later splits preferences across multiple endpoints, keep this module as the single frontend integration boundary and hide that split behind `api.ts`.
