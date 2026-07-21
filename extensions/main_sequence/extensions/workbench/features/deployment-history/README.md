# Deployment History Surface

## Purpose

This Foundry surface owns the global deployment-run history and timestamped log viewer across all
deployment target types.

## Entry Point

- `MainSequenceDeploymentHistoryPage.tsx`
  Renders the standard Foundry registry table, opens a URL-backed full-page deployment detail,
  and presents that run's log entries as chronological timestamped lines.

## Dependencies

- Unified deployment-run API helpers and contracts from `../../../../common/api`.
- Shared registry pagination from `../../../../common/components`.
- Foundry route registration in `../../app.ts`.

## Behavior Notes

- Reads `/orm/api/pods/deployment-runs/` with only `limit` and `offset`. Do not add `target_type`
  or `project_uid`; this surface intentionally shows all deployments.
- The current backend contract does not expose started-time ordering. Correct ordering across
  pages must be provided by the backend before the frontend adds an ordering request parameter.
- Paginates deployment runs with the shared registry page size and polls while a visible run is
  active.
- Run detail and logs come from `/orm/api/pods/deployment-runs/{run_uid}/` and
  `/orm/api/pods/deployment-runs/{run_uid}/logs/`. Log pagination follows `next_cursor`.
- The selected run is stored in `msDeploymentRunUid`. The Target text is the list-to-detail
  control; do not add a separate trailing action column or modal detail surface.
- Full detail follows the standard Foundry breadcrumb/back navigation and entity-summary-card
  pattern used by the other object registries.
- The history table must remain one row per deployment run. Do not expand `steps`, phases, or raw
  context into separate rows; phase is only current-progress metadata in the selected run detail.
- Log messages are shown untruncated with millisecond timestamps in chronological order.
