# Main Sequence Features

Feature folders group screens and supporting components by domain instead of by technical type.

## Feature Areas

- `buckets/`: bucket registry and object-browser flows.
- `clusters/`: read-only cluster registry and UUID-based detail routing.
- `constants/`: read-only constant and configuration explorer surfaces.
- `data-nodes/`: dynamic-table and local-update flows.
- `jobs/`: jobs, runs, and execution summaries.
- `physical-data-sources/`: physical data source registry and editor workflows.
- `project-data-sources/`: project data source registry and editor workflows.
- `projects/`: project registry, repository browsing, images, jobs, and related tabs.
- `secrets/`: secret-management surfaces.
- `simple-tables/`: `ts_manager/simple_table` registry, detail routing, and SimpleTableUpdate workflows.
- `streamlit/`: gallery view for published Streamlit resource releases.
- `timescaledb-services/`: read-only deployment service registry and summary-backed detail view.

## Rules

- Keep feature-specific components close to the page or workflow that owns them.
- Extract shared Main Sequence UI into `extensions/main_sequence/common/components/` only after it is reused or clearly intended to be reused across nested extensions.
- Add a local `README.md` when creating a new feature folder.
