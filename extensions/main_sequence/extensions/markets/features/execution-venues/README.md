# Main Sequence Markets Execution Venues

This feature owns the Main Sequence Markets execution venue registry and the dedicated detail page for each venue.

## Entry Points

- `MainSequenceExecutionVenuesPage.tsx`: URL-driven execution venue list with search, fixed pagination, create, and row navigation.
- `MainSequenceExecutionVenueDetailPage.tsx`: dedicated execution venue detail route with edit and delete actions.
- `executionVenueShared.tsx`: local path helpers, value formatting, delete summary rendering, and the shared create/edit dialog.

## API Dependencies

- `GET /orm/api/assets/execution_venue/` for the list flow using the standard DRF `limit` and `offset` contract.
- `POST /orm/api/assets/execution_venue/` for venue creation from the list screen.
- `GET /orm/api/assets/execution_venue/{uid}/` for the minimal detail payload.
- `PATCH /orm/api/assets/execution_venue/{uid}/` for symbol and name updates.
- `DELETE /orm/api/assets/execution_venue/{uid}/` for detail-screen deletion.

## Contract Notes

- Execution venue records now expose `uid`, `symbol`, and `name`. The frontend should never rely on numeric venue ids for navigation or mutation.
- Managed-account create flows must send `execution_venue` as that venue UID, not a database pk.

## Rules

- Keep the list aligned with the shared Main Sequence registry pattern: shared search, fixed pagination, and no list-level edit/delete buttons.
- Keep detail as a dedicated route instead of a modal.
- Keep transport logic in `extensions/main_sequence/common/api/index.ts`.
