# Main Sequence Common API

`index.ts` centralizes the shared Main Sequence frontend API layer used by nested extensions.

## Responsibilities

- Define typed request and response models for Main Sequence endpoints.
- Encapsulate authenticated fetch behavior, error normalization, pagination helpers, and endpoint-specific request functions.
- Provide a single import surface for Main Sequence feature code that lives outside app-specific extension folders.

## Usage

- Feature components should import API functions from this directory instead of calling `fetch` directly.
- Keep endpoint-specific formatting or transport concerns here so page components stay focused on UI and interaction logic.
