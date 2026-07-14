# Secrets Feature

This feature contains Main Sequence secret-management screens.

## Files

- `MainSequenceSecretsPage.tsx`: page component for managing and browsing secrets.

## Notes

- Keep secret-specific forms and tables in this folder unless they become shared with other features.
- The secrets registry uses backend search on the paginated list endpoint. The page should render
  `query.data.results` directly instead of filtering only the currently loaded page in the browser.
- Root secret deletion is a detail-level destructive action. It calls
  `DELETE /orm/api/pods/secret/{uid}/`, invalidates the secrets registry, and returns to the list
  after success.
