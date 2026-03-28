# Dashboard Layouts

## Overview

Dashboards are one kind of app surface in the shell, and they now go through a layout resolver before they are rendered.

The important change is:

- dashboard authors describe panel size
- optional placement hints guide alignment
- the runtime packs panels into a collision-free grid

This keeps dashboards code-defined and reviewable without forcing every author to hand-manage `y` coordinates.

## Authoring model

At the dashboard level you can optionally configure the grid:

```ts
export const exampleDashboard: DashboardDefinition = {
  id: "example",
  title: "Example",
  description: "Auto-packed dashboard.",
  source: "core",
  grid: {
    columns: 12,
    rowHeight: 78,
    gap: 16,
  },
  widgets: [],
};
```

Defaults:

- `columns: 12`
- `rowHeight: 78`
- `gap: 16`
- dashboard controls enabled

Each widget instance now has two layout concepts:

- `layout`: required size in grid columns and rows
- `position`: optional placement hint

Example:

```ts
{
  id: "overview-news",
  widgetId: "news-feed",
  title: "Market News",
  props: { limit: 5 },
  layout: { cols: 4, rows: 5 },
  position: { x: 4 }
}
```

### How placement works

- If `position` is omitted, the panel is auto-placed in the first slot that fits.
- If `position.x` is provided, the panel stays anchored to that column and is pushed downward until it fits.
- If `position.y` is provided, it acts as the earliest row the panel may occupy.
- Full-width panels automatically start after the tallest occupied row they intersect.

This means panels fit by default, even when the authored order changes or a panel above grows taller than its neighbors.

## Why this model exists

The old model exposed raw `x/y/w/h` coordinates directly to dashboard authors. That was flexible, but brittle:

- overlaps were easy to introduce
- a full-width panel could start too early
- authors had to reason about row math across the whole dashboard

The resolver keeps the expressive part of the grid while removing the most common failure mode.

## Legacy support

Legacy widget instances that still use:

```ts
layout: { x: 0, y: 0, w: 4, h: 4 }
```

are still accepted.

Those coordinates are treated as placement hints and normalized through the same resolver, so invalid overlaps are pushed downward instead of painting on top of each other.

## Recommendations

- Prefer `layout: { cols, rows }` for new dashboards.
- Use `position.x` to align panels into columns.
- Omit `position.y` unless you need a panel to start after a specific section.
- Reserve legacy `x/y/w/h` for compatibility with older dashboards.
- Keep widget sizes semantic and stable so dashboards remain readable in code review.

## Dashboard controls

Dashboards can also render a shared control strip for time range selection and refresh.

By default, dashboards render:

- a shared time range menu
- a manual refresh button with auto-refresh interval menu
- a share button that copies the current dashboard state
- a view menu with kiosk mode and open-in-new-tab actions
- relative preset labels, with explicit dates only for custom ranges

You can configure or disable it per dashboard:

```ts
export const exampleDashboard: DashboardDefinition = {
  id: "example",
  title: "Example",
  description: "Auto-packed dashboard.",
  source: "core",
  controls: {
    timeRange: {
      defaultRange: "30d",
      options: ["24h", "7d", "30d", "90d"],
    },
    refresh: {
      defaultIntervalMs: null,
      intervals: [null, 5000, 15000, 30000, 60000],
    },
    actions: {
      share: true,
      view: true,
    },
  },
  widgets: [],
};
```

Widgets that want to react to the selected range can read the shared dashboard state through `useDashboardControls()` from `src/dashboards/DashboardControls.tsx`.

The shared state now exposes both:

- the selected preset key, when applicable
- concrete `from` and `to` dates for the active range

That means dashboards can keep quick relative presets while still driving widgets with actual date boundaries.

## Dashboard links and kiosk mode

The shared dashboard toolbar now understands a few query parameters:

- `range=15m|1h|6h|24h|7d|30d|90d`
- `from=<unix-ms>&to=<unix-ms>` for custom ranges
- `refresh=<ms>` or omit it for refresh off
- `kiosk=1` to open the dashboard with shell chrome hidden

The share button copies the current dashboard URL with the active range, refresh interval, and kiosk state embedded so the same view can be reopened later.
