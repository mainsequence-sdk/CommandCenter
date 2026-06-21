# Main Sequence AI Components

## Purpose

This directory owns reusable UI components shared across `Main Sequence AI` surfaces and settings
sections.

## Entry Points

- `AutomationButton.tsx`
  Automation call-to-action button with the shared primary-color dither/wave hover treatment.
  It owns the `ditherwave` `DitheredWaves` WebGL2 visual treatment and standard button behavior;
  consumers provide the action handler.
- `RunConfigFields.tsx`
  Shared provider/model/thinking selector for Main Sequence AI surfaces that use the runtime
  run-config resolver. It renders catalog-backed provider, model, and Thinking selectors and keeps
  hydrated current values visible while the runtime catalog refreshes.

## Maintenance Notes

- Keep shared controls here when they are used by more than one Main Sequence AI surface or settings
  section.
- Use `RunConfigFields` instead of reimplementing provider/model/thinking controls in new AI
  surfaces.
- Do not add backend behavior to `AutomationButton`; backend actions belong to the owning feature
  component that knows the required resource context.
- `DitheredWaves` accepts hex colors, so the component reads active theme tokens and falls back to
  the Main Sequence default primary/background colors when tokens are unavailable or non-hex.
