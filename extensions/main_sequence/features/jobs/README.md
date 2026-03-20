# Jobs Feature

This feature contains job and run exploration screens for Main Sequence execution workflows.

## Files

- `MainSequenceJobsPage.tsx`: jobs registry and top-level jobs surface.
- `MainSequenceJobRunOverviewExplorer.tsx`: run inspection UI for execution history and run details.
- `jobPresentation.ts`: shared presentation helpers for job and run data.

## Notes

- Keep job-specific formatting and exploration behavior in this folder unless it is reused broadly across the extension.
