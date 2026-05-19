# Main Sequence Common API

`index.ts` centralizes the shared Main Sequence frontend API layer used by nested extensions.

## Responsibilities

- Define typed request and response models for Main Sequence endpoints.
- Normalize the shared `SummaryResponse` contract used by Main Sequence and Markets summary endpoints, including `entity`, `badges`, `inline_fields`, `highlight_fields`, `stats`, optional `label_management`, optional `extensions`, and `summary_warning`.
- Encapsulate authenticated fetch behavior, error normalization, pagination helpers, and endpoint-specific request functions.
- Route `VITE_USE_MOCK_DATA=true` requests through the local JSON-backed mock layer under `/mock_data/mainsequence` for the shared Main Sequence API roots:
  `/orm/api/pods/`, `/orm/api/ts_manager/`, and `/orm/api/assets/`.
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
  That lets headless execution and mounted runtime consumers share the same `dynamic_table/{id}/`
  GET instead of issuing parallel metadata requests for the same data node.
- Summary consumers should read endpoint-specific add-ons from `summary.extensions` instead of legacy keys such as `summary`, `extra`, `extras`, or top-level `readme`.
- Summary label mutations also live here. Summary endpoints that support labels should expose a `label_management` block with `labels`, `add_label_url`, and `remove_label_url`; the shared summary card reads those backend-provided URLs directly instead of inferring label routes from the entity type.
- Link-driven graph surfaces may also fetch backend-provided `summary_url` and `graph_url` values through shared helpers here instead of teaching feature components to build those endpoints by hand.
- Shared quick-search helpers also live here for picker-style settings UIs. Main Sequence widgets
  should resolve selectable backend objects such as projects or data nodes through these helpers
  instead of asking users to type raw ids.
- `listDataNodes(...)` defaults to the backend light serializer (`light=true`) for picker/list
  surfaces that only need lightweight identity fields. Full registry/detail-style tables that rely
  on richer `dynamic_table` fields must opt out explicitly with `light: false`.
- Markets positions helpers also live here. `fetchManagedAccountHoldingsPositionDetails(...)`
  adapts the canonical managed-account holdings snapshot endpoint
  `/orm/api/assets/account/{uid}/holdings/` into the shared portfolio-weights position-details
  payload shape used by the reusable positions widget. The backend may legally return `{}` with
  `200 OK` when no holdings snapshot exists; the API layer normalizes that to an empty positions
  payload instead of pushing the empty-object special case into widgets.
- `saveManagedAccountHoldings(...)` also lives here. It posts a canonical holdings snapshot to
  `/orm/api/assets/account/{uid}/add-holdings/`, normalizes the write response, and adapts it back
  into the same reusable portfolio-weights position-details payload so the holdings widget can stay
  on one rendering contract before and after save.
- Execution venue helpers also live here. Execution venue list/detail/mutation calls are now UID-based on the detail routes, and managed-account create calls must pass `execution_venue` as the venue UID returned by the execution venue list.
- Shareable-object permission helpers also live here. They all use the same suffix-based contract:
  the caller provides an object root plus object id, and the API layer appends the configured
  `candidate-users`, `can-view`, `can-edit`, and add/remove permission suffixes from
  `main_sequence.permissions`.
- `dynamic_table/{id}/get_data_between_dates_from_remote/` and `dynamic_table/{id}/get_last_observation/` only use mock payloads that are explicitly keyed to the requested data-node id. Unkeyed endpoint dumps are not treated as valid per-node responses because they can mix multiple series and break widget assumptions.
- Collection-style Main Sequence mock datasets may be stored either as a raw JSON array or as a paginated object with a `results` array. The mock loader normalizes both shapes for list-backed resources such as `local_time_series`.
