# Streamlit Feature

This feature owns the Forge gallery page for published Streamlit resource releases.

## Files

- `MainSequenceStreamlitPage.tsx`: compact card-gallery page for `/resource-release/gallery/` entries filtered to `streamlit_dashboard` releases, with full metadata shown in a details modal.

## Notes

- The page reads from the shared Main Sequence API layer in `../../../../common/api/`.
- Opening a release first resolves `exchange_launch_url`, then navigates the new tab to the returned launch target.
- Keep Streamlit-gallery specific filtering and presentation here unless another feature needs to reuse it.
