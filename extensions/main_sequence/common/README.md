# Main Sequence Common

This directory contains the shared Main Sequence domain layer used by multiple nested extensions.

## Structure

- `api/`: typed REST helpers, request/response models, and transport utilities.
- `components/`: reusable Main Sequence UI building blocks shared across apps.
- `hooks/`: shared UI state helpers that are still specific to Main Sequence workflows.
- `assets/`: shared static assets used by the common components layer.

## Rules

- Put code here only when it is intentionally shared by more than one Main Sequence extension.
- Do not import from `extensions/workbench/` into `extensions/markets/` or the reverse.
- Keep app registration, app-specific pages, and widget registration out of `common/`.
