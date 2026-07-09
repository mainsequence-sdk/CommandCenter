# Streamlit Feature

This feature owns the Foundry resource list for published Streamlit resource releases.

## Files

- `MainSequenceStreamlitPage.tsx`: compact resource-list page backed by `GET /resource-release/gallery/?release_kind=streamlit_dashboard`, with search sent to the backend and full metadata shown in a details modal.

## Notes

- The page reads from the shared Main Sequence API layer in `../../../../common/api/`.
- Keep the Streamlit resource list populated from the backend `resource-release/gallery/` endpoint. Do not replace it with client-only filtering over the full release catalog.
- Opening a release first resolves `exchange_launch_url`, then navigates the new tab to the returned launch target.
- Keep Streamlit resource-list specific filtering and presentation here unless another feature needs to reuse it.
