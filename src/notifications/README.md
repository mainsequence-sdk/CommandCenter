# Notifications

This module owns the shared shell notifications client and normalization layer.

## Purpose

- Collect notification source definitions from registered apps.
- Fetch, normalize, and merge visible notifications into one shell feed.
- Provide detail, mark-read, dismiss, and batch mutation helpers for the topbar notifications menu.
- Expose the newer notification read model, including `source = organization | system`, so the
  topbar menu can split the merged feed into source tabs without changing the backend fetch path.

## Main entry points

- `api.ts`: runtime client for list/detail/mutation requests, including mock-mode handling.
- `registry.ts`: source registration and notification normalization helpers.
- `types.ts`: shared source and visible-notification contracts.

## Runtime behavior

- Apps contribute notification sources through the shared `notificationSources` app contract.
- The shell queries those sources through `fetchVisibleNotifications()` and merges them into one sorted feed.
- The topbar notification menu now groups that merged feed into local `Organization` and `System`
  tabs using the backend read-model `source` field.
- The topbar bell indicator now uses unread severity precedence across the merged feed:
  `Urgent` first, then `Important`, then `Info`.
- In mock mode, notification requests are resolved from `/mock_data/command_center/notifications.json`.
- In mock mode, configured notification requests must stay inside the mock handler. If a request cannot be resolved there, the client raises a notifications error instead of silently falling through to the live backend.

## Maintenance notes

- Keep notification source definitions relative to the configured base URL unless a source genuinely needs its own host.
- Preserve the `VisibleAppNotification` contract shape when extending source metadata; the topbar menu depends on it.
- If new notification endpoints are added, extend the mock request handler in `api.ts` at the same time so mock mode remains self-contained.
