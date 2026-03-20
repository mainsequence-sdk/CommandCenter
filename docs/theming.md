# Theming

## Model

Theming in Command Center is token-driven. Themes are defined as `ThemePreset` objects and registered through the same extension mechanism used for widgets and dashboards.

Each theme preset contains:

- `id`
- `label`
- `description`
- `source`
- `mode`
- `tokens`

## Token categories

The current token system includes:

- surfaces: `background`, `card`, `popover`
- navigation: `sidebar`, `topbar`
- neutral UI tokens: `muted`, `border`, `input`
- brand tokens: `primary`, `secondary`, `accent`
- status tokens: `danger`, `success`, `warning`, `positive`, `negative`
- layout tokens: `radius`

The full token key list is defined in `src/themes/types.ts`.

## Runtime behavior

`ThemeProvider` is responsible for:

- loading available themes from the app registry
- tracking the active theme id
- applying token overrides in memory
- writing resolved CSS custom properties to `document.documentElement`
- toggling dark/light mode classes

This keeps theming runtime-driven without moving theme definitions out of code.

## Theme studio

The theme studio is a developer-facing editing surface that lets users:

- switch between registered themes
- override tokens live
- preview the result in the app shell
- export a TypeScript preset back into the codebase

Overrides are intentionally not persisted yet.

## Adding a theme

1. Create a `ThemePreset`.
2. Export it from an extension.
3. Confirm the preset appears in the theme studio.

Example:

```ts
export const graphiteTheme: ThemePreset = {
  id: "graphite",
  label: "Graphite",
  description: "Dark default terminal theme.",
  source: "core",
  mode: "dark",
  tokens: {
    background: "#0B1017",
    foreground: "#E6EDF7",
    primary: "#4F8CFF",
    accent: "#10B981",
    radius: "16px",
  },
};
```

## Recommendations

- Prefer semantic tokens over widget-local hardcoded colors.
- Keep theme presets portable and code-reviewable.
- Use extensions for desk-specific or product-specific visual systems.
- Avoid coupling a theme to a single widget vendor.
