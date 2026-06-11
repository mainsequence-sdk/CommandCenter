# Task 001: Backend Direct Mode Persistence Contract

## Objective

Allow `command_center.adapter_from_api` connection instances to persist direct debug mode config
without the backend fetching the debug API root.

## Scope

- Backend validation and persistence only.
- No new backend adapter runtime.
- No new connection type id.
- No frontend direct execution in this task.

## Implementation Checklist

- [x] Add `transportMode` handling to Adapter From API backend validation.
- [x] Treat missing `transportMode` as `backend`.
- [x] Keep the existing `prepare_adapter_from_api_config(...)` path unchanged for backend mode.
- [x] Add a direct-mode preparation path for `transportMode = "direct"`.
- [x] In direct mode, validate `debugApiBaseUrl` is an absolute HTTP/HTTPS URL.
- [x] In direct mode, do not fetch `debugApiBaseUrl` from the backend.
- [x] In direct mode, require a submitted `compiledContract`.
- [x] Validate direct-mode `compiledContract` shape using the same normalized contract rules as
  backend discovery, but without upstream fetch.
- [x] Validate `configValues` against the submitted direct-mode compiled contract.
- [x] Reject submitted `secureConfig.secretValues` in direct mode; direct mode does not use or
  require Command Center-managed secrets.
- [x] Persist `transportMode`, `debugApiBaseUrl`, `compiledContract`,
  `compiledContractSource = "direct"`, and `compiledContractSourceUrl`.
- [x] When switching to backend mode, recompute `compiledContract` from `apiBaseUrl` and overwrite
  any direct-mode snapshot.
- [x] Reject backend query/resource/test execution for direct-mode instances with a clear error.
- [x] Keep backend private-network policy unchanged for backend mode.

## Acceptance Criteria

- [x] Existing Adapter From API backend-mode create/update still works.
- [x] A direct-mode instance can be saved with `debugApiBaseUrl = "http://127.0.0.1:8021"` without
  backend private-network rejection.
- [x] Backend logs/tests prove it does not fetch `debugApiBaseUrl` in direct mode.
- [x] Backend query/resource/test endpoints reject direct-mode instances explicitly.
- [x] Switching from direct mode to backend mode recomputes the backend contract from `apiBaseUrl`.

## Verification

- [x] Add backend unit tests for backend-mode compatibility.
- [x] Add backend unit tests for direct-mode save without upstream fetch.
- [x] Add backend unit tests for direct-mode backend query rejection.
- [x] Add backend unit tests for direct-mode backend resource rejection.
- [x] Run the backend Adapter From API connection test suite.

## Storage And Backend Contract Assessment

This task changes connection instance `public_config` for `command_center.adapter_from_api`.

New persisted public config keys:

- `transportMode`
- `debugApiBaseUrl`
- `compiledContractSource`
- `compiledContractSourceUrl`

Workspace storage is unchanged.
