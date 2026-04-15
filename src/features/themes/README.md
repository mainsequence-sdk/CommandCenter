# Theme Studio

This feature directory owns the `/app/themes` editor surface for inspecting and exporting Command Center themes.

## Main entry points

- `ThemeStudioPage.tsx`: live theme editor, palette preview surface, and preset export page.

## Responsibilities

- List the registered theme presets from the app registry.
- Let operators switch the active theme and adjust token overrides in-memory.
- Preview surface hierarchy, tightness, and shell typography changes against live UI examples.
- Show the resolved data-viz palette contract for the active theme:
  - categorical
  - sequential
  - diverging
- Export a theme preset snippet that includes the resolved palette families so palette-driven charts
  stay stable when the theme changes.

## Maintenance notes

- Keep this page aligned with the runtime theme contract exposed by `src/themes/ThemeProvider.tsx`.
- If the resolved data-viz palette model changes, update both the preview surface and the generated
  preset export so the UI and exported code stay consistent.
