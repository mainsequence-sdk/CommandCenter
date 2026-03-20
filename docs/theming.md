# Theming

## Model

Theming in Command Center is token-driven, but it is not color-only. Themes are defined as
`ThemePreset` objects and registered through the same extension mechanism used for widgets and
dashboards.

Each theme preset contains:

- `id`
- `label`
- `description`
- `source`
- `mode`
- `tightness`
- `surfaceHierarchy`
- `tokens`

`tokens` handle color and radius. `tightness` handles density decisions that should stay consistent
across the product without turning every component into a local spacing snowflake. `surfaceHierarchy`
handles how strongly nested panels separate from their parent surface.

## Theme properties beyond tokens

`tightness` is a top-level theme property with three supported values:

- `relaxed`
- `default`
- `tight`

The semantic baseline is `relaxed`, but each preset can choose its own default. `default` is the
first tighter step, and `tight` is the densest option. `Main Sequence Light` currently ships with
`tight`.

In the current implementation, `tightness` drives table density:

- AG Grid row height
- AG Grid header height
- TanStack table header and row padding
- shared registry tables
- shell log tables
- markdown tables
- role and membership tables in product pages
- Main Sequence data-node registry and column metadata tables
- Main Sequence entity summary stat cards and highlight chips

It also now drives shared typography sizing in the shell:

- page header titles and descriptions
- card titles and card descriptions
- markdown headings and paragraph text
- global body text and semantic heading fallbacks
- Main Sequence registry row text and metadata

This is intentional. Tightness is supposed to control a few high-value layout behaviors, not every
single spacing token in the UI.

`surfaceHierarchy` is another top-level theme property with three supported values:

- `framed`
- `soft`
- `flat`

Use it when a screen has multiple stacked panels and the chrome starts to feel heavy. In the current
implementation, it drives nested card treatment through `Card variant="nested"`:

- `framed`: nested cards keep a visible panel edge
- `soft`: nested cards use lighter separation and no panel shadow
- `flat`: nested cards collapse into the parent surface and rely on spacing instead of borders

`Main Sequence Light` currently ships with `surfaceHierarchy: "flat"` to reduce card-inside-card
fatigue on dense admin and operations views.

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
- resolving the active `tightness`
- resolving the active `surfaceHierarchy`
- applying token overrides in memory
- applying density CSS custom properties for table surfaces
- applying nested surface CSS custom properties for inner cards
- writing resolved CSS custom properties to `document.documentElement`
- toggling dark/light mode classes

This keeps theming runtime-driven without moving theme definitions out of code.

## Theme studio

The theme studio is a developer-facing editing surface that lets users:

- switch between registered themes
- change tightness live
- change surface hierarchy live
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
  tightness: "relaxed",
  surfaceHierarchy: "soft",
  tokens: {
    background: "#0B1017",
    foreground: "#E6EDF7",
    primary: "#4F8CFF",
    accent: "#10B981",
    radius: "16px",
  },
};
```

## Implementation notes

If you want a component to respect `tightness`, prefer consuming the shared density values instead
of inventing new local size switches.

Current references:

- theme types: `src/themes/types.ts`
- density metrics: `src/themes/tightness.ts`
- surface metrics: `src/themes/surface-hierarchy.ts`
- runtime application: `src/themes/ThemeProvider.tsx`

For table-like UIs, use the shared CSS variables already written by the provider:

- `--table-standard-cell-padding-y`
- `--table-standard-header-padding-y`
- `--table-compact-cell-padding-y`
- `--table-compact-header-padding-y`
- `--table-row-gap-y`
- `--table-font-size`
- `--table-meta-font-size`

For shared typography surfaces, use the CSS variables written by the provider instead of fixed
Tailwind font sizes when the element is meant to tighten with the theme:

- `--font-size-page-title`
- `--font-size-section-title`
- `--font-size-body`
- `--font-size-body-sm`
- `--font-size-body-xs`
- `--line-height-body`
- `--font-size-markdown-h1`
- `--font-size-markdown-h2`
- `--font-size-markdown-h3`
- `--font-size-markdown-h4`

Use the standard pair for normal data tables and the compact pair for dense operator views like
logs. TanStack table renderers should consume those CSS variables in their header and cell class
names. AG Grid surfaces should read the numeric metrics from `src/themes/tightness.ts`.

For nested panels, use `Card variant="nested"` instead of hand-writing per-page border overrides.
That keeps the page architecture semantic while letting the theme decide whether inner cards should
stay framed, soften, or go flat.

## Recommendations

- Prefer semantic tokens over widget-local hardcoded colors.
- Use `tightness` for cross-cutting density rules instead of ad hoc `compact` props.
- Use `surfaceHierarchy` for nested-panel chrome instead of one-off `border-none` classes.
- Keep theme presets portable and code-reviewable.
- Use extensions for desk-specific or product-specific visual systems.
- Avoid coupling a theme to a single widget vendor.
