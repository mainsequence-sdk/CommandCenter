# Calendars

This feature owns the `Calendars` surface under the Main Sequence Markets `Platform` navigation section.

## Entry Points

- `MainSequenceCalendarsPage.tsx`: renders the calendar registry list, detail view, summary card, and relationship tabs.
- `extensions/main_sequence/common/api/index.ts`: provides the calendar list/detail/summary and relationship API helpers.

## Backend Contract

- Calendar identity uses `/api/v1/calendar/`.
- Calendar list responses are normalized before rendering. The expected contract is a plain array, but the frontend defensively accepts the shared paginated envelope too.
- Detail pages use `GET /api/v1/calendar/{uid}/summary/` for page chrome and `GET /api/v1/calendar/{uid}/?response_format=frontend_detail` for the editable source-of-truth payload.
- Relationship tabs prefer `summary.extensions.relationships` URLs for `/dates/`, `/sessions/`, and `/events/`, then fall back to UID-derived paths with a default `T-360d` to `T+360d` date window.
- Root-relative relationship URLs such as `/api/v1/calendar/{uid}/dates/` must be routed through the Markets API root, not the Command Center API base.
- Relationship date filters are visible in the UI and persisted through `msCalendarStartDate` and `msCalendarEndDate` URL parameters.
- All calendar navigation and child loading is UID-based. Do not introduce numeric ID paths for this surface.

## Maintenance Notes

- Keep summary label controls delegated to the shared `MainSequenceEntitySummaryCard`; the backend owns `label_management`.
- When adding edit flows, use `PATCH` only for mutable fields and delete/create for natural-key changes as defined by the calendar API handoff.
