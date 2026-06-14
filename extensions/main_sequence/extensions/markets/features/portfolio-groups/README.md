# Portfolio Groups

This feature owns the Main Sequence Markets portfolio-group registry and the dedicated detail page for each portfolio group. Portfolio groups are classification metadata with many-to-many portfolio memberships; they do not own portfolio construction, weights, values, or signals.

## Entry Points

- `MainSequencePortfolioGroupsPage.tsx`: URL-driven portfolio-group list with shared search, create action, fixed pagination, row selection, and bulk delete.
- `MainSequencePortfolioGroupDetailPage.tsx`: dedicated portfolio-group detail route with edit/delete actions, a `Settings` tab for adding and removing portfolio memberships, and an `Overview` tab for the raw detail payload.
- `portfolioGroupShared.tsx`: local path helpers, value formatting, create/edit dialog helpers, metadata JSON parsing, and delete summary rendering.

## API Dependencies

- `GET /api/v1/portfolio-group/?response_format=frontend_list` for the list flow using the standard DRF `limit` and `offset` contract.
- `POST /api/v1/portfolio-group/` for create/upsert by `unique_identifier`.
- `PATCH /api/v1/portfolio-group/{uid}/` for mutable group metadata updates.
- `DELETE /api/v1/portfolio-group/{uid}/` for deleting one group. Membership rows cascade and portfolios remain.
- `POST /api/v1/portfolio-group/bulk-delete/` for selected-row deletion from the list screen.
- `GET /api/v1/portfolio-group/{uid}/` for the direct detail payload.
- `GET /api/v1/portfolio-group/{uid}/portfolios/` to list current portfolio memberships.
- `POST /api/v1/portfolio-group/{uid}/portfolios/` to add one portfolio membership by `portfolio_uid`.
- `DELETE /api/v1/portfolio-group/{uid}/portfolios/{portfolio_uid}/` to remove one membership row.
- `GET /api/v1/portfolio-group/by-portfolio/{portfolio_uid}/` and `POST /api/v1/portfolio-group/membership/bulk-delete/` are available in the common API layer for related views and bulk membership maintenance.
- `GET /api/v1/portfolio/?response_format=frontend_list&search=...` to search portfolios from the settings tab by identifier.

## Rules

- Keep the list aligned with the shared Main Sequence registry pattern: shared search, fixed pagination, selection checkboxes, and no row-level delete buttons.
- Keep detail as a dedicated route instead of a modal.
- Use `metadata_json` as an object payload. The dialog validates JSON before POST/PATCH.
- The `Settings` tab is the primary membership-management UI for portfolio groups. Add portfolios through the portfolio search and remove them from the current-members list.
- Membership display comes from `GET /api/v1/portfolio-group/{uid}/portfolios/`, not from embedded portfolio ids on the group detail payload.
- Keep transport logic in `extensions/main_sequence/common/api/index.ts`.
