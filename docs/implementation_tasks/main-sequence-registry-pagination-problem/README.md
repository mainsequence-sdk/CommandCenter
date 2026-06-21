# Main Sequence Registry Pagination Problem Tasks

Implementation tasks for fixing the shared Main Sequence list pagination failure where page
navigation snaps back to page 1 or appears to do nothing.

## Current Status

Planning documentation only. Implementation has not started.

## Problem

Multiple Main Sequence registry/list screens use `MainSequenceRegistryPagination`, but many of
those screens keep pagination state locally and run page reset or clamp effects while React Query
is between responses. During a page transition, query data can temporarily be `undefined`; local
effects then read that as `count = 0`, `next = null`, and `previous = null`, and reset the current
page back to page 1.

This makes pagination clicks look broken even when the pagination component itself calls
`onPageChange` correctly.

The issue is systemic and should be fixed through a shared list-pagination pattern instead of
patching individual pages one at a time.

## Root Causes

- Registry pages duplicate pagination state handling instead of using one shared pagination owner.
- Page-index clamp effects run during loading or fetching transitions.
- Some list queries do not preserve previous page metadata while fetching the next page.
- Some pages store pagination in component state while related filters and selected details live in
  URL search params.
- The shared API normalizer still accepts raw arrays for backend list endpoints, which can hide
  backend pagination contract mistakes and can double-slice already-paginated results.

## Target Direction

All Main Sequence registry/list screens should use one shared pagination state and query pattern:

- page and offset are derived from one owner
- page navigation is URL-backed for top-level registry screens
- page resets happen only when filters actually change
- clamping happens only after a successful backend response proves the requested page is out of range
- list queries keep previous pagination metadata while fetching
- backend list endpoints use the standard paginated envelope: `count`, `next`, `previous`, `results`

## Implementation Tasks

### Task 001: Add Shared Registry Pagination State

- [ ] Add a shared hook under `extensions/main_sequence/common/hooks/`.
- [ ] The hook should expose `pageIndex`, `pageSize`, `offset`, `setPageIndex`, `resetPage`, and
  a response-aware clamp helper.
- [ ] Support URL-backed mode for top-level registry pages.
- [ ] Support local-state mode only for nested/detail tabs where URL pagination is intentionally
  not part of the route contract.
- [ ] Ensure filter changes reset to page 1 through the hook, not through ad hoc `useEffect`
  patterns.

### Task 002: Add Shared Query Placeholder Behavior

- [ ] Add a small shared helper for list queries that preserves previous paginated data during
  fetch transitions.
- [ ] Use React Query placeholder/previous-data behavior so pagination controls do not see
  `count = 0` while the next page is loading.
- [ ] Standardize how loading states render when previous data is present: keep the table and
  pagination visible, and show loading only as a secondary state.

### Task 003: Remove Unsafe Page Clamp Effects

- [ ] Remove effects that clamp page index from temporarily empty query data.
- [ ] Replace them with the shared response-aware clamp helper.
- [ ] Clamp only when:
  - [ ] the query has succeeded
  - [ ] the response has reliable `count` or `pagination.total_pages`
  - [ ] the requested page is beyond the known last page
- [ ] Do not clamp while `isLoading`, `isFetching`, or query data is undefined.

### Task 004: Standardize Backend Pagination Normalization

- [ ] Review `normalizeOffsetPaginatedResponse`.
- [ ] Keep raw-array pagination only for mock or explicitly local collections.
- [ ] For real backend list endpoints, require a paginated envelope or fail loudly with a useful
  error.
- [ ] Confirm all Main Sequence backend list helpers return `OffsetPaginatedList` from the same
  contract shape.
- [ ] Document the expected backend list contract in `extensions/main_sequence/common/api/README.md`.

### Task 005: Migrate Workbench Top-Level Registry Pages

Apply the shared pagination hook and query behavior to:

- [ ] `features/simple-tables/MainSequenceSimpleTablesPage.tsx` for Meta Tables.
- [ ] `features/data-nodes/MainSequenceDataNodesPage.tsx`.
- [ ] `features/jobs/MainSequenceJobsPage.tsx`.
- [ ] `features/buckets/MainSequenceBucketsPage.tsx`.
- [ ] `features/constants/MainSequenceConstantsPage.tsx`.
- [ ] `features/secrets/MainSequenceSecretsPage.tsx`.
- [ ] `features/projects/MainSequenceProjectsPage.tsx`.
- [ ] `features/project-data-sources/MainSequenceProjectDataSourcesPage.tsx`.
- [ ] `features/physical-data-sources/MainSequencePhysicalDataSourcesPage.tsx`.
- [ ] `features/clusters/MainSequenceClustersPage.tsx`.
- [ ] `features/timescaledb-services/MainSequenceTimeScaleDbServicesPage.tsx`.
- [ ] `features/streamlit/MainSequenceStreamlitPage.tsx`.
- [ ] `features/namespaces/MainSequenceNamespacesPage.tsx`.

### Task 006: Migrate Workbench Nested Registry Tabs

Apply local-mode shared pagination to nested/detail tabs where pagination should not become a
top-level route concern:

- [ ] `features/data-nodes/MainSequenceDataNodeLocalTimeSeriesTab.tsx`.
- [ ] `features/projects/MainSequenceProjectDataNodeUpdatesTab.tsx`.
- [ ] `features/projects/MainSequenceProjectJobsTab.tsx`.
- [ ] `features/projects/MainSequenceJobRunsTab.tsx`.
- [ ] `features/projects/MainSequenceProjectImagesTab.tsx`.
- [ ] `features/projects/MainSequenceProjectResourceReleasesTab.tsx`.
- [ ] `features/timescaledb-services/MainSequenceTimeScaleDbServiceDetail.tsx`.
- [ ] `features/asset-categories/MainSequenceAssetCategoryDetailPage.tsx` if nested asset
  pagination continues to use shared Main Sequence pagination.

### Task 007: Align Markets Registry Pages

Many Markets pages already use URL-backed pagination. Align them with the shared helper so the
behavior is uniform:

- [ ] `features/assets/MainSequenceAssetsPage.tsx`.
- [ ] `features/funds/MainSequenceFundsPage.tsx`.
- [ ] `features/indices/MainSequenceIndicesPage.tsx`.
- [ ] `features/managed-accounts/MainSequenceManagedAccountsPage.tsx`.
- [ ] `features/portfolio-groups/MainSequencePortfolioGroupsPage.tsx`.
- [ ] `features/portfolio-signals/MainSequencePortfolioSignalsPage.tsx`.
- [ ] `features/portfolios/MainSequenceTargetPortfoliosPage.tsx`.
- [ ] `features/pricing-curves/MainSequencePricingCurvesPage.tsx`.
- [ ] `features/pricing-market-data/MainSequencePricingMarketDataPage.tsx`.
- [ ] `features/asset-categories/MainSequenceAssetCategoriesPage.tsx`.

### Task 008: Audit `MainSequenceRegistryPagination`

- [ ] Keep the component dumb: it should render page controls and call `onPageChange`.
- [ ] Do not move query response interpretation into the component.
- [ ] Ensure `hasNextPage` and `hasPreviousPage` are handled consistently for known-total and
  open-ended pagination.
- [ ] Add small component-level tests if the project already has a suitable test pattern.

### Task 009: Verification Matrix

Verify the following on at least Meta Tables, DataNodes, and one Markets page:

- [ ] Clicking `Next` fetches the next page and does not snap back to page 1.
- [ ] Clicking a numbered page fetches that page and marks it active.
- [ ] Search/filter changes reset to page 1 exactly once.
- [ ] Pagination remains visible while the next page is fetching.
- [ ] Empty results from a valid filter do not corrupt future pagination.
- [ ] Deleting records from the last page clamps only after the delete response and list refetch
  prove the page is out of range.
- [ ] Browser refresh preserves top-level registry page and filter state where URL-backed pagination
  is used.

### Task 010: Documentation Cleanup

- [ ] Update `extensions/main_sequence/common/components/README.md` with the pagination component
  responsibility boundary.
- [ ] Update `extensions/main_sequence/common/api/README.md` with the backend pagination envelope.
- [ ] Update affected feature READMEs only where the local behavior changes.

## Non-Goals

- Do not redesign table/list visuals.
- Do not change row selection semantics except where page reset behavior was accidentally clearing
  selection.
- Do not add client-side pagination for backend-paginated endpoints.
- Do not silently support broken backend pagination contracts for production endpoints.
- Do not change persisted workspace, widget, or backend storage contracts.

## Acceptance Criteria

- All `MainSequenceRegistryPagination` consumers use the shared pagination state pattern or have a
  documented exception.
- No list page clamps local page index from undefined query data.
- Top-level registry pagination is refresh-safe and linkable through URL params.
- `npm run check` passes.
- Manual verification passes for Meta Tables, DataNodes, and one Markets registry page.
