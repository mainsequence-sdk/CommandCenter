# Constants Feature

This feature contains the Main Sequence constants/configuration explorer screen.

## Files

- `MainSequenceConstantsPage.tsx`: page component that renders constant payloads returned by the backend.

## Notes

- Keep this folder focused on constant inspection and related read-only UI.
- The constants registry now forwards search text to the backend paginated endpoint. The rendered
  rows are already the filtered page and should not be filtered again client-side.
