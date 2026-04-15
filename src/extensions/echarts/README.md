# ECharts Extension

This extension owns the ECharts integration layer used by live widget registrations.

## Entry Points

- `index.ts`: registers the extension metadata and its live widget catalog entries.

## Current Responsibilities

- The `echarts-spec` widget implementation from `src/widgets/extensions/echarts/`
- ECharts-specific renderer isolation so vendor chart code stays out of core widget folders
- The first widget-level integration of organization-scoped widget type configuration

## Maintenance Notes

- Keep generic ECharts integration concerns here, while widget-specific runtime logic lives in the
  widget module folder.
- If additional ECharts widgets are added later, document them here and keep their implementation
  details in the widget module folder.
