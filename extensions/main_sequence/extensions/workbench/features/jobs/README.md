# Jobs Feature

This feature contains job and run exploration screens for Main Sequence execution workflows.

## Files

- `MainSequenceJobsPage.tsx`: jobs registry and top-level jobs surface.
- `MainSequenceJobRunOverviewExplorer.tsx`: run inspection UI for execution history and run details.
- `jobPresentation.ts`: shared presentation helpers for job and run data.

## Notes

- Keep job-specific formatting and exploration behavior in this folder unless it is reused broadly across the extension.
- Job detail summaries keep capacity, CPU, memory, and GPU fields together in the editable resource
  stats group. Runtime stays with the execution metadata instead of being treated as a resource.
- The jobs registry and nested run list now rely on backend search for paginated queries. These
  surfaces should treat `query.data.results` as the already-filtered current page instead of
  re-filtering only the loaded page in the browser.
