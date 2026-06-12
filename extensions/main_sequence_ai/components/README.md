# Main Sequence AI Components

## Purpose

This directory owns reusable UI components shared across `Main Sequence AI` surfaces and settings
sections.

## Entry Points

- `AutomationButton.tsx`
  Automation call-to-action button with the shared primary-color dither/wave hover treatment.
  It owns the `ditherwave` `DitheredWaves` WebGL2 visual treatment and standard button behavior;
  consumers provide the action handler.

## Maintenance Notes

- Keep shared controls here when they are used by more than one Main Sequence AI surface or settings
  section.
- Do not add backend behavior to `AutomationButton`; backend actions belong to the owning feature
  component that knows the required resource context.
- `DitheredWaves` accepts hex colors, so the component reads active theme tokens and falls back to
  the Main Sequence default primary/background colors when tokens are unavailable or non-hex.
