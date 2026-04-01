# Projects Feature

This feature owns the Main Sequence project registry and project detail experience.

## Files

- `MainSequenceProjectsPage.tsx`: project registry page and project detail shell.
- `MainSequenceProjectCodeTab.tsx`: repository browser and code preview tab.
- `MainSequenceCreateJobDialog.tsx`: dialog for creating a job from a repository file.
- `MainSequenceProjectImagesTab.tsx`: project image listing and related image state.
- `MainSequenceProjectJobsTab.tsx`: project-scoped jobs tab.
- `MainSequenceProjectResourceReleasesTab.tsx`: resource release tab for projects.
- `MainSequenceProjectSettingsTab.tsx`: project settings tab with the data source/base image pickers used by project creation plus project-secret assignment controls.
- `MainSequenceJobRunsTab.tsx`: run listing within the project context.
- `MainSequenceJobRunLogsTab.tsx`: logs tab for selected job runs.
- `MainSequenceJobRunResourceUsageSection.tsx`: run resource-usage display block.

## Notes

- Project-only tabs and dialogs should remain here even when they are large.
- Shared registry controls should stay in `../../components`.
- The settings tab reuses the shared project form-options query and writes through the project detail `PATCH` endpoint.
- Project permissions use the shared `MainSequencePermissionsTab` against the standard shareable-object project endpoints.
- The resource releases tab supports project resource release creation flows for dashboard, agent, and fastapi release kinds.
- The project registry polls every 60 seconds only while the current page still contains an uninitialized project, and those rows render a spinner instead of a warning pill.
- The project images tab polls every 60 seconds only while the current page still contains a building image, and those rows render a spinner instead of a warning pill.
- The create-project dialog auto-selects the first available data source and default base image once form options load.
