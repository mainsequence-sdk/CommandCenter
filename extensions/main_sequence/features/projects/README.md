# Projects Feature

This feature owns the Main Sequence project registry and project detail experience.

## Files

- `MainSequenceProjectsPage.tsx`: project registry page and project detail shell.
- `MainSequenceProjectCodeTab.tsx`: repository browser and code preview tab.
- `MainSequenceCreateJobDialog.tsx`: dialog for creating a job from a repository file.
- `MainSequenceProjectImagesTab.tsx`: project image listing and related image state.
- `MainSequenceProjectJobsTab.tsx`: project-scoped jobs tab.
- `MainSequenceProjectResourceReleasesTab.tsx`: resource release tab for projects.
- `MainSequenceJobRunsTab.tsx`: run listing within the project context.
- `MainSequenceJobRunLogsTab.tsx`: logs tab for selected job runs.
- `MainSequenceJobRunResourceUsageSection.tsx`: run resource-usage display block.

## Notes

- Project-only tabs and dialogs should remain here even when they are large.
- Shared registry controls should stay in `../../components`.
