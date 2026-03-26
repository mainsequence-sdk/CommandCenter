# Demo Market Brief

This feature owns the narrative page surface used by the Demo extension.

Main entry point:

- `MarketBriefPage.tsx`: mock-data briefing surface that combines KPI cards, market catalysts, and operator notes into a non-dashboard page.

Dependencies:

- `@/data/api` for mock-or-live data selection.
- Shared card, badge, and separator UI primitives from the shell component library.

Maintenance notes:

- Keep this page inside the Demo extension because it only exists for the shipped mock application.
- If the Demo app is retired or replaced, remove this feature with the extension instead of re-homing it under generic `src/features/`.
