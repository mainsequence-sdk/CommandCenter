# TimeScaleDB Services Feature

This feature owns the read-only TimeScaleDB deployment service registry in Main Sequence Foundry.

## Entry Points

- `MainSequenceTimeScaleDbServicesPage.tsx`: registry page with search, pagination, and URL-backed detail routing.
- `MainSequenceTimeScaleDbServiceDetail.tsx`: summary-backed detail view with `Details` and `Databases` tabs.

## API Dependencies

- `GET /orm/api/connections/timescaledb-service/` for the read-only list view.
- `GET /orm/api/connections/timescaledb-service/{id}/` for the detail payload.
- `GET /orm/api/connections/timescaledb-service/{id}/summary/` for the standardized summary header.
- `GET /orm/api/connections/timescaledb-service/{id}/data-sources/` for the nested physical-database registry.
- `GET /orm/api/connections/timescaledb-service/{id}/runtime-config/` for runtime configuration details.
- `GET /orm/api/connections/timescaledb-service/{id}/changes/` for service change history.
- `POST /orm/api/connections/timescaledb-service/{id}/request-storage-increase/` for storage increase requests.

## Notes

- This feature is intentionally read-only because the backend viewset blocks create, update, and delete operations.
- Detail routing is URL-backed with `msTimeScaleDbServiceId` and `msTimeScaleDbServiceTab` so selected services and tabs are linkable and refresh-safe.
- The `Details` tab owns the `Create Timescale DB` entry action and deep-links into the physical data source create editor at `physical-data-sources?msPhysicalDataSourceView=create-timescale-db`.
- The `Databases` tab deep-links each row into the physical data source detail route in Main Sequence Foundry.
