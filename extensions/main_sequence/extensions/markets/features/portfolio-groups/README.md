# Portfolio Groups

This feature owns the Main Sequence Markets portfolio-group registry and the dedicated detail page for each portfolio group.

## Entry Points

- `MainSequencePortfolioGroupsPage.tsx`: URL-driven portfolio-group list with shared search, create action, fixed pagination, row selection, and bulk delete.
- `MainSequencePortfolioGroupDetailPage.tsx`: dedicated portfolio-group detail route with a `Settings` tab for adding and removing portfolios plus an `Overview` tab for the raw detail payload.
- `portfolioGroupShared.tsx`: local path helpers, value formatting, create-dialog helpers, and delete summary rendering.

## API Dependencies

- `GET /orm/api/assets/portfolio_group/?response_format=frontend_list` for the list flow using the standard DRF `limit` and `offset` contract.
- `POST /orm/api/assets/portfolio_group/get_or_create/` for the create action from the list screen.
- `POST /orm/api/assets/portfolio_group/bulk-delete/` for selected-row deletion from the list screen.
- `GET /orm/api/assets/portfolio_group/{id}/` for the direct detail payload.
- `POST /orm/api/assets/portfolio_group/{id}/append-portfolios/` to add selected portfolios to the current group.
- `POST /orm/api/assets/portfolio_group/{id}/remove-portfolios/` to remove selected portfolios from the current group.
- `GET /orm/api/assets/target_portfolio/?response_format=frontend_list&index_asset__current_snapshot__name=...` to search portfolios from the settings tab by name.
- `GET /orm/api/assets/target_portfolio/{id}/summary/` to resolve portfolio ids from the group detail payload into linked portfolio names.

## Rules

- Keep the list aligned with the shared Main Sequence registry pattern: shared search, fixed pagination, selection checkboxes, and no row-level delete buttons.
- Keep detail as a dedicated route instead of a modal.
- When the detail payload returns `portfolios` or `portfolio_ids`, resolve those ids through the portfolio summary endpoint and render the portfolio name as the link label.
- The `Settings` tab is the primary membership-management UI for portfolio groups. Add portfolios through the portfolio search and remove them from the current-members list.
- Keep transport logic in `extensions/main_sequence/common/api/index.ts`.
