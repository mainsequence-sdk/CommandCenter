# Main Sequence AI Chat Feature Components

## Purpose

This directory owns reusable presentational subcomponents for the shared page-level chat shell UI.

## Entry Points

- `../SessionDetailRail.tsx`
  Chat-page session rail for the selected `AgentSession`. It consumes shared AgentSession detail
  sections and keeps chat-specific presentations like insights and tool rendering nearby.
- `RepoDiffTool.tsx`
  Specialized renderer for the `repo_diff` session tool. It keeps the session rail compact and
  opens the backend-provided diff URL in a dedicated modal with changed-file navigation and a
  unified patch rendered by `react-diff-view`.

## Dependencies

- `extensions/main_sequence_ai/assistant-ui/ChatProvider.tsx`
  Supplies the normalized active session summary and shared session detail state.
- `../repo-diff-api.ts`
  Provides the typed backend diff adapter used by `RepoDiffTool.tsx`.

## Maintenance Notes

- Keep runtime wiring, transport decoding, and persistence logic out of this directory.
- Components here should stay presentational and read from the chat feature/provider boundary.
- Keep the `react-diff-view` CSS scoped under the `ms-repo-diff-view` wrapper so the library
  stylesheet does not leak into unrelated chat surfaces.
