# Mock Adapter Data

This directory contains runnable mock provider APIs used to exercise Command Center connection
adapter contracts. These examples are not production backend adapters. They are upstream APIs that
the `command_center.adapter_from_api` backend adapter can discover, validate, and query through the
normal backend-routed connection path.

## Examples

- `example/`: FastAPI and Pydantic implementation of an `AdapterFromApi` provider contract with
  two graph operations.

## Maintenance Constraints

- Keep examples small and explicit so they can be used as contract fixtures.
- Do not put real credentials in mock data.
- When the `AdapterFromApi` contract changes, update these examples and the docs in
  `docs/connections/adapters/` together.
