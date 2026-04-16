# Main Sequence AI Settings Features

## Purpose

This directory owns `Main Sequence AI` settings sections contributed into the shared shell settings
dialog.

These are registry-backed settings contributions, not standalone modal implementations. The shell
still owns the dialog chrome and left-nav; this directory only owns the extension-specific content.

## Entry Points

- `AgentSettingsSection.tsx`
  User-facing global Agents settings section that loads deployment/runtime storage usage from
  `/api/storage/usage` and presents the global durable-storage breakdown.
- `ModelProviderSettingsSection.tsx`
  User-facing global provider-auth section that loads provider cards from `/api/model-providers`,
  loads the full model catalog from `/api/models/catalog`, groups models by provider, and drives a
  generic sign-in attempt modal from the backend attempt state machine.

## Dependencies

- `extensions/main_sequence_ai/app.ts`
  Registers these sections through `shellMenuContributions` on the app definition.
- `extensions/main_sequence_ai/runtime/model-catalog-api.ts`
  Supplies the global model catalog used only by the settings screen.
- `extensions/main_sequence_ai/runtime/model-provider-auth-api.ts`
  Supplies global provider auth state, sign-in/sign-off transport, and sign-in attempt polling /
  manual-input / cancel flows.
- `extensions/main_sequence_ai/runtime/storage-usage-api.ts`
  Supplies the global durable-storage usage snapshot for the Agents settings section.
- `src/app/layout/SettingsDialog.tsx`
  Shared shell-owned settings dialog that renders contributed sections.

## Maintenance Notes

- Keep this directory focused on extension-owned settings content only. Do not reimplement shell
  dialog chrome here.
- The Agents settings storage panel is global runtime/deployment state. Do not reinterpret it as
  chat storage, session storage, or model-provider storage.
- The main user-facing headline number should use `consumedBytes / totalBytes`, not
  `filesystemUsedBytes`.
- Provider auth state is the source of truth for sign-in/sign-off controls. Do not infer provider
  authentication only from model presence.
- Provider cards should follow backend workflow flags directly: `authenticated` controls `Sign off`,
  `signInAvailable` controls `Sign in`, and `authSource` stays diagnostic only.
- The model list in this section is informational. It should not mutate chat model selection.
- Per-provider model lists should stay collapsed by default so provider status remains the primary
  view and large catalogs do not dominate the dialog.
- This screen must not use `/api/chat/get_available_models`; that endpoint is for chat runtime
  availability, not global provider setup.
- The sign-in modal must preserve and display `attempt.authUrl` whenever the backend provides it,
  even after the attempt moves into manual-input states.
