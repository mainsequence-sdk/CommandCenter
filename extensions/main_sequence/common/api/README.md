# Main Sequence Common API

`index.ts` centralizes the shared Main Sequence frontend API layer used by nested extensions.

## Responsibilities

- Define typed request and response models for Main Sequence endpoints.
- Normalize the shared `SummaryResponse` contract used by Main Sequence and Markets summary endpoints, including `entity`, `badges`, `inline_fields`, `highlight_fields`, `stats`, optional `label_management`, optional `extensions`, and `summary_warning`.
- Encapsulate authenticated fetch behavior, error normalization, pagination helpers, and endpoint-specific request functions.
- Route `VITE_USE_MOCK_DATA=true` requests through the local JSON-backed mock layer under `/mock_data/mainsequence` for the shared Main Sequence API roots:
  `/orm/api/pods/`, `/orm/api/ts_manager/`, and `/api/v1/`.
- Route Markets API requests (`/api/v1/...`) through `VITE_DEBUG_MAIN_SEQUENCE`
  when it is set, for example `VITE_DEBUG_MAIN_SEQUENCE=http://127.0.0.1:8021`.
  Other Main Sequence roots keep using the normal Command Center API base.
- Provide a single import surface for Main Sequence feature code that lives outside app-specific extension folders.
- Load the Main Sequence mock module lazily only when mock mode is active, so live mode does not eagerly import the JSON mock bundle.

## Usage

- Feature components should import API functions from this directory instead of calling `fetch` directly.
- Keep endpoint-specific formatting or transport concerns here so page components stay focused on UI and interaction logic.
- Keep mock response handling centralized here rather than branching inside page components when adding new Main Sequence surfaces.
- Shared dashboard request tracing also hooks in here. Workspace refresh diagnostics should attach
  trace metadata to these shared API calls so graph/debug surfaces can show the real network path
  without each widget inventing its own endpoint logger.
- `fetchDataNodeDetail(...)` now also owns a small shared in-memory cache/in-flight dedupe layer.
  That lets headless execution and mounted runtime consumers share the same `dynamic_table/{uid}/`
  GET instead of issuing parallel metadata requests for the same data node.
- Summary consumers should read endpoint-specific add-ons from `summary.extensions` instead of legacy keys such as `summary`, `extra`, `extras`, or top-level `readme`.
- Summary label mutations also live here. Summary endpoints that support labels should expose a `label_management` block with `labels`, `add_label_url`, and `remove_label_url`; the shared summary card reads those backend-provided URLs directly instead of inferring label routes from the entity type.
- Link-driven graph surfaces may also fetch backend-provided `summary_url` and `graph_url` values through shared helpers here instead of teaching feature components to build those endpoints by hand.
- Shared quick-search helpers also live here for picker-style settings UIs. Main Sequence widgets
  should resolve selectable backend objects such as projects or data nodes through these helpers
  instead of asking users to type raw identifiers.
- Asset detail helpers use the UID-only `/api/v1/asset/{uid}/` API surface. Detail pages request
  `response_format=frontend_detail`, render `/summary/` through the shared summary card, and load
  `/get_pricing_details/` only for the pricing-details tab.
- `listDataNodes(...)` defaults to the backend light serializer (`light=true`) for picker/list
  surfaces that only need lightweight identity fields. Full registry/detail-style tables that rely
  on richer `dynamic_table` fields must opt out explicitly with `light: false`.
- Foundry registry pages for Meta Tables and Data Nodes now bootstrap namespace options from the
  resource-specific `.../namespaces/` endpoints before issuing the heavier list queries. The shared
  API layer exposes those namespace list helpers and forwards the selected `namespace` query param
  into the registry list endpoints. `listMetaTables(...)`, `listDataNodes(...)`,
  `listProjects(...)`, `listJobs(...)`, `listProjectJobs(...)`, `listJobRuns(...)`,
  `listConstants(...)`, `listSecrets(...)`, `listProjectImages(...)`, `listLocalTimeSeries(...)`,
  and `listProjectLocalTimeSeries(...)` also forward page search strings to backend list
  endpoints so registry search is not limited to the currently loaded page.
- Markets positions helpers also live here. `fetchManagedAccountHoldingsPositionDetails(...)`
  adapts the canonical managed-account holdings collection endpoint
  `/api/v1/account/{uid}/holdings/` into the shared position-detail payload shape used by
  the reusable `Position Detail` widget. It now requests the latest snapshot with
  `order=desc&limit=1` when no exact `holdings_date` filter is provided, preserves
  `include_asset_detail=true`, and normalizes empty responses to an empty positions payload
  instead of pushing collection-handling into widgets. The response is the unified holdings object:
  `holdings_set_uid`, `holdings_date`, and `holdings[]` rows with `asset_identifier`, nested
  `asset.current_snapshot`, `quantity`, `direction`, and `signed_quantity`.
- `fetchManagedAccountHoldingsByFundPositionDetails(...)` adapts
  `/api/v1/account/{uid}/holdings/by-fund/` for the account holdings `By Fund` tab. It always sends
  `limit=1` and defaults `include_asset_detail=true`, uses `holdings_date` when the widget has an
  exact holdings snapshot timestamp, and otherwise requests `order=desc`. Each `funds[]` group is
  normalized into the same position-detail table payload used by account and virtual-fund holdings;
  `residuals[]` and `allocation_warnings[]` remain attached to the grouped response for separate
  rendering.
- `saveManagedAccountHoldings(...)` also lives here. It posts a canonical holdings snapshot to
  `/api/v1/account/{uid}/add-holdings/`, normalizes the unified write response, and adapts it back
  into the same reusable position-detail payload so the holdings widget can stay on one rendering
  contract before and after save. The request sends mandatory `asset_identifier` and `asset_uid`,
  absolute `quantity`, `direction`, `target_trade_time`, and `extra_details`; it does not send
  `asset_id`, `price`, or `missing_price`.
- `fetchManagedAccountTargetPositionsPositionDetails(...)` also lives here. It adapts the canonical
  managed-account target allocation collection endpoint
  `/api/v1/account/{uid}/target-positions/` into the same reusable position-detail payload,
  requests the latest assignment with `order=desc&limit=1` when no exact
  `target_positions_date` filter is provided, preserves `include_asset_detail=true`, and normalizes
  empty collection responses to an empty positions payload. The GET response now treats
  `positions[].asset.uid` and `positions[].asset.unique_identifier` as canonical asset identity;
  it must not depend on numeric asset ids or `figi`, and display labels come from
  `positions[].asset.current_snapshot`. It also preserves row target identity from
  `positions[].target_type`, `positions[].target_uid`, `positions[].asset_uid`, and
  `positions[].portfolio_uid` so downstream widgets can distinguish asset and portfolio targets.
- `listManagedAccountTargetAllocationTargets(...)` calls
  `/api/v1/account/target-allocation/targets/` with `search`, `target_type`, `limit`, and `offset`.
  The Position Detail inline editor uses this endpoint only for target allocation source modes so
  authored target allocations can add either asset targets or portfolio targets without reusing the
  account holdings asset-only search flow.
- `saveManagedAccountTargetPositions(...)` posts the target allocation write contract to
  `/api/v1/account/{uid}/add-target-positions/`: `target_positions_date`, `overwrite`, and
  `positions[]` rows with `target_type`, `target_uid`, `metadata_json`, target-specific `asset_uid`
  or `portfolio_uid`, and exactly one exposure field. It must not send `unique_identifier`,
  unrelated UID fields, or `single_asset_quantity` for portfolio targets.
- Portfolio helpers now use the UID-only `/api/v1/portfolio/` API surface. `listTargetPortfolios(...)`
  forwards `response_format=frontend_list`, `search`, `limit`, and `offset`; summary/detail reads
  use `/portfolio/{uid}/summary/` and `/portfolio/{uid}/`; latest weights use
  `/portfolio/{uid}/weights/?order=desc&limit=1&include_asset_detail=true` and are adapted into
  the shared position-detail table contract.
- `listVirtualFunds(...)` accepts optional `accountUid` and `portfolioUid` filters and forwards
  them as `account_uid` and `portfolio_uid` to
  `/api/v1/virtualfund/?response_format=frontend_list`. Virtual-fund rows are UID-only:
  `uid`, `unique_identifier`, `account_uid`, and `target_portfolio_uid`.
- Virtual-fund detail helpers follow the dedicated API surface:
  `/api/v1/virtualfund/{uid}/`, `/summary/`, and
  `/holdings/?order=desc&limit=1&include_asset_detail=true`. The holdings helper adapts
  `quantity`, `direction`, `signed_quantity`, holdings set UIDs, and nested asset
  snapshot labels into the shared position-detail table contract without treating virtual funds as
  assets, accounts, or portfolios.
- Shareable-object permission helpers also live here. They all use the same suffix-based contract:
  the caller provides an object root plus object uid, and the API layer appends the configured
  `candidate-users`, `can-view`, `can-edit`, and add/remove permission suffixes from
  `main_sequence.permissions`.
- Namespace helpers also live here. The namespace detail surface reads
  `/orm/api/ts_manager/namespace/`, `/namespace/{uid}/`, and `/namespace/{uid}/tables/`, while the
  namespace sharing UI uses `can-view`, `can-edit`, `set-permissions`, and
  `propagate-permissions/` on the namespace resource root.
- `dynamic_table/{uid}/get-tail-observations/`, `dynamic_table/{uid}/get_data_between_dates_from_remote/`, and `dynamic_table/{uid}/get_last_observation/` only use mock payloads that are explicitly keyed to the requested data-node identifier. Unkeyed endpoint dumps are not treated as valid per-node responses because they can mix multiple series and break widget assumptions.
- Shared ts_manager detail helpers resolve resource paths by `uid`. Frontend callers and mock fixtures must provide the backend `uid`; numeric ids are not accepted for these detail-style routes.
- Collection-style Main Sequence mock datasets may be stored either as a raw JSON array or as a paginated object with a `results` array. The mock loader normalizes both shapes for list-backed resources such as `local_time_series`.
- Shared list normalizers also apply client-side `limit` / `offset` slicing when a backend list
  endpoint falls back to returning a raw array or an unsliced `rows` payload. That keeps registry
  pagination controls working even when older endpoints do not emit paginated envelopes yet.
