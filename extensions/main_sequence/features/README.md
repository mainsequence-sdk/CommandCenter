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

## Rules

- Keep feature-specific components close to the page or workflow that owns them.
- Extract shared UI into `../components` only after it is reused or clearly intended to be reused.
- Add a local `README.md` when creating a new feature folder.
