# Core Widgets

Core widgets are the reusable visual building blocks that ship with the platform out of the box.
They are designed to cover the most common command-surface patterns without forcing a product team
to start from a blank screen.

The current built-in widget set is intentionally opinionated:

- fast summary surfaces for operators
- feed-based situational awareness
- quantitative showcase widgets for richer analytical experiences

All of them are registered by the core extension in `src/extensions/core/index.ts`.

## Widget contract

Every widget is registered as a `WidgetDefinition` with:

- `id`
- `title`
- `description`
- `category`
- `kind`
- `source`
- `defaultSize`
- `requiredPermissions`
- optional `tags`
- optional `exampleProps`

That means each widget can be:

- discovered in the registry
- permissioned consistently
- reused across multiple dashboards
- documented once and composed many times

## Shipped core widgets

### Market KPIs

- **Widget id:** `market-kpis`
- **Category:** `Market`
- **Kind:** `kpi`
- **Default size:** `4 x 4`
- **Permissions:** `dashboard:view`
- **Example props:** `{ symbol: "AAPL" }`

What it is:

`Market KPIs` is the platform's compact summary-card widget. It is the fastest way to anchor a
dashboard with numbers that operators can parse in seconds.

What it is good for:

- desk metrics
- exposure snapshots
- top-line alert counts
- cross-asset summary bands

Where it is used now:

- `Demo / Overview`
- `Demo / Cross-Asset`
- `Admin / Admin Console`

Why it matters:

Most command surfaces need a strong numerical header. This widget gives teams a reusable summary
language before they add more domain-specific panels.

### News Feed

- **Widget id:** `news-feed`
- **Category:** `Feeds`
- **Kind:** `feed`
- **Default size:** `4 x 5`
- **Permissions:** `news:read`
- **Example props:** `{ limit: 6 }`

What it is:

`News Feed` is the compact event tape for market-moving headlines and narrative context.

What it is good for:

- catalyst monitoring
- macro pulse sidebars
- event-driven desks
- pre-open briefing surfaces

Where it is used now:

- `Demo / Overview`
- `Demo / Cross-Asset`
- `Admin / Admin Console`

Why it matters:

Strong operational dashboards are rarely just numbers. The news feed gives the platform a reusable
context layer so users understand why a surface is moving, not only that it moved.

### Activity Feed

- **Widget id:** `activity-feed`
- **Category:** `Feeds`
- **Kind:** `feed`
- **Default size:** `4 x 5`
- **Permissions:** `dashboard:view`
- **Example props:** `{ limit: 6 }`

What it is:

`Activity Feed` is the operational event stream for warnings, operator actions, workflow state, and
platform events.

What it is good for:

- desk actions
- incident or warning streams
- workflow progress
- platform operations surfaces

Where it is used now:

- `Demo / Overview`
- `Demo / Cross-Asset`
- `Demo / Flow Lab`
- `Admin / Admin Console`

Why it matters:

This is the widget that makes a dashboard feel alive. It gives teams a reusable event timeline
pattern without forcing every product to invent its own feed design.

### Causal Graph

- **Widget id:** `causal-graph`
- **Category:** `Quant`
- **Kind:** `custom`
- **Default size:** `7 x 8`
- **Permissions:** `dashboard:view`

What it is:

`Causal Graph` is the hero analytical widget for regime transmission and factor propagation.

What it is good for:

- quant showcase dashboards
- factor interaction storytelling
- lead-lag exploration
- strategy or research demonstrations

Where it is used now:

- Not currently mounted in a shipped dashboard.

Why it matters:

This widget shows that the platform is not limited to plain cards and lists. It remains available
through the widget registry for richer analytical surfaces even when it is not mounted by default.

### Factor Heatmap

- **Widget id:** `factor-heatmap`
- **Category:** `Quant`
- **Kind:** `custom`
- **Default size:** `5 x 8`
- **Permissions:** `dashboard:view`

What it is:

`Factor Heatmap` is a dense cross-impact grid for reinforcing and opposing factor pressure.

What it is good for:

- quant scanning
- cross-impact analysis
- correlation storytelling
- compact high-density research views

Where it is used now:

- Not currently mounted in a shipped dashboard.

Why it matters:

It gives the platform a high-information surface that complements narrative dashboards and summary
cards. Teams can still use it as a template for other dense grid-based analytical widgets.

### Distribution Lab

- **Widget id:** `distribution-lab`
- **Category:** `Quant`
- **Kind:** `custom`
- **Default size:** `6 x 6`
- **Permissions:** `dashboard:view`

What it is:

`Distribution Lab` visualizes baseline, live, and stress distributions in one compact panel.

What it is good for:

- scenario comparison
- stress diagnostics
- regime-shift storytelling
- research dashboards

Where it is used now:

- Not currently mounted in a shipped dashboard.

Why it matters:

This widget brings a more research-heavy visual language into the platform and remains available
for future demo or product-specific dashboards without changing the core dashboard model.

### Scenario Cones

- **Widget id:** `scenario-cones`
- **Category:** `Quant`
- **Kind:** `custom`
- **Default size:** `6 x 6`
- **Permissions:** `dashboard:view`

What it is:

`Scenario Cones` renders competing market paths as probability cones.

What it is good for:

- regime path communication
- risk narrative overlays
- research and planning surfaces
- visually strong showcase dashboards

Where it is used now:

- Not currently mounted in a shipped dashboard.

Why it matters:

It gives the platform a reusable forward-looking visual pattern, not just historical and current
state panels, even when it is not mounted in the default demo app.

## Current platform composition

The core extension currently uses the widget set in four ways:

1. `Market KPIs`, `News Feed`, and `Activity Feed` establish the default operating language for
   demo and admin dashboards.
2. `Activity Feed` also appears inside `Demo / Flow Lab`, proving extension widgets and core
   widgets can coexist in the same app.
3. `Causal Graph`, `Factor Heatmap`, `Distribution Lab`, and `Scenario Cones` remain available in
   the widget registry even though they are not mounted in a shipped dashboard right now.
4. Repetition across dashboards proves widgets are meant to be reused, not handcrafted per screen.

## When to build a new widget instead of reusing core

Build a new widget when:

- the domain needs a new visual pattern
- the existing props model is no longer clean
- the interaction model is product-specific
- the widget belongs in an optional vendor integration

Reuse core widgets when:

- you need summary cards
- you need a narrative or event feed
- you need a high-density quant showcase pattern close to what already ships

## Related docs

- [Architecture](./architecture.md)
- [Apps and Surfaces](./apps-and-surfaces.md)
- [Dashboard Layouts](./dashboard-layouts.md)
- [Extensions](./extensions.md)
