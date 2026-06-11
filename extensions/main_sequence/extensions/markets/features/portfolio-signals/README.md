# Portfolio Signals

This feature provides the Main Sequence Markets portfolio signal metadata surface under the Portfolios navigation section.

## Entry Points

- `MainSequencePortfolioSignalsPage.tsx`: list, select/delete, edit, delete-signal-values, and delete signal surface backed by the selected Main Sequence Markets API connection.

## Backend Contract

- `GET /api/v1/portfolio-signal/?search=&limit=25&offset=0`: list signal metadata. The provider-native JSON response exposes `results`, which the UI renders as rows.
- `GET /api/v1/portfolio-signal/{uid}/`: load a signal metadata row.
- `PATCH /api/v1/portfolio-signal/{uid}/`: update `signal_description`. `signal_uid` is immutable and the UI renders it read-only after creation.
- `DELETE /api/v1/portfolio-signal/{uid}/weights/`: delete signal value rows. The UI omits `weights_date`, so the backend deletes all rows for the signal.
- `DELETE /api/v1/portfolio-signal/{uid}/`: delete matching signal value rows first, then delete the signal metadata row.

## Notes

- The surface uses the existing Markets API binding and Adapter From API transport. It does not introduce a new connection type or persisted workspace contract.
- List pagination is URL-backed with `limit` and `offset`; selected detail state uses `msPortfolioSignalUid` and replaces the list view.
- The list uses only standard registry search. Do not add a separate exact signal UID filter unless the Master List pattern changes.
- The list supports row selection. Deleting selected rows calls `DELETE /api/v1/portfolio-signal/{uid}/` for each selected signal because the API exposes single-row delete, not bulk delete.
- The UI intentionally does not expose signal creation because this application is not allowed to call the create endpoint.
