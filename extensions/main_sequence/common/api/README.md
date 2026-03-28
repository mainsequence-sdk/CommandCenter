# Main Sequence Common API

`index.ts` centralizes the shared Main Sequence frontend API layer used by nested extensions.

## Responsibilities

- Define typed request and response models for Main Sequence endpoints.
- Encapsulate authenticated fetch behavior, error normalization, pagination helpers, and endpoint-specific request functions.
- Route `VITE_USE_MOCK_DATA=true` requests through the local JSON-backed mock layer under `/mock_data/mainsequence` for the shared Main Sequence API roots:
  `/orm/api/pods/`, `/orm/api/ts_manager/`, and `/orm/api/assets/`.
- Provide a single import surface for Main Sequence feature code that lives outside app-specific extension folders.
- Load the Main Sequence mock module lazily only when mock mode is active, so live mode does not eagerly import the JSON mock bundle.

## Usage

- Feature components should import API functions from this directory instead of calling `fetch` directly.
- Keep endpoint-specific formatting or transport concerns here so page components stay focused on UI and interaction logic.
- Keep mock response handling centralized here rather than branching inside page components when adding new Main Sequence surfaces.
- `dynamic_table/{id}/get_data_between_dates_from_remote/` and `dynamic_table/{id}/get_last_observation/` only use mock payloads that are explicitly keyed to the requested data-node id. Unkeyed endpoint dumps are not treated as valid per-node responses because they can mix multiple series and break widget assumptions.
- Collection-style Main Sequence mock datasets may be stored either as a raw JSON array or as a paginated object with a `results` array. The mock loader normalizes both shapes for list-backed resources such as `local_time_series`.
