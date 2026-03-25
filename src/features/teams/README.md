# Teams Feature

This folder contains the shared team-management feature used by the Access & RBAC app.

Main entry points:

- `TeamsPage.tsx`: registry-first teams list with search, create, bulk delete, and explicit open actions.
- `TeamDetailPage.tsx`: focused team detail screen with separate `Team members` and `Team policies` tabs.
- `api.ts`: authenticated team API client for listing, detail fetches, membership management, and CRUD.
- `shared.ts`: route helpers, access checks, and common formatting helpers shared by the list and detail screens.

Notable behavior:

- The registry route stays list-only so users are not forced to manage memberships and sharing on the same screen.
- Team detail is routed separately under `/app/access-rbac/teams/:teamId`.
- Team policies reuse the shared Main Sequence permissions matrix, including searchable transfer lists for view and edit assignments.
- Team members and candidate users are managed from the detail view and invalidate both detail and registry queries after updates.
