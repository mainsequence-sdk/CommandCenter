# Main Sequence Common API

`index.ts` centralizes the shared Main Sequence frontend API layer used by nested extensions.

## Responsibilities

- Define typed request and response models for Main Sequence endpoints.
- Encapsulate authenticated fetch behavior, error normalization, pagination helpers, and endpoint-specific request functions.
- Route `VITE_USE_MOCK_DATA=true` requests through the local JSON-backed mock layer under `/mock_data/mainsequence` for the shared Main Sequence API roots:
  `/orm/api/pods/`, `/orm/api/ts_manager/`, and `/orm/api/assets/`.
- Provide a single import surface for Main Sequence feature code that lives outside app-specific extension folders.

## Usage

- Feature components should import API functions from this directory instead of calling `fetch` directly.
- Keep endpoint-specific formatting or transport concerns here so page components stay focused on UI and interaction logic.
- Keep mock response handling centralized here rather than branching inside page components when adding new Main Sequence surfaces.
