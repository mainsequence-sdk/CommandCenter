# Widgets

Widgets are reusable building blocks that can be placed in workspaces or embedded inside
workspace-backed product views. They handle focused jobs such as querying data, rendering charts,
showing tables, collecting notes, or embedding app functionality.

This page covers the widget-related workflow around the `Widget Catalog` and `Saved Widgets`
surfaces in the `Workspaces` application.

## Widget Catalog

The widget catalog is the main place to discover what is available. Use it when you need to find a
widget by job, compare options, or inspect what a widget expects as input.

## Choosing A Widget

Start with the job the widget must perform:

- Use a query widget when the workspace needs to fetch or stream data.
- Use a table widget when users need to inspect rows.
- Use a chart widget when trends, distributions, or relationships matter.
- Use a statistic widget when the workspace needs a compact metric.
- Use a note widget when the workspace needs instructions, commentary, or context.
- Use an app component widget when a product screen needs to appear inside the workspace.

## Saved Widgets

Saved widgets let you reuse a proven widget configuration instead of rebuilding it from scratch.
They are useful when a team wants a standard chart, table, query, or small widget bundle ready to
drop into new workspaces.

## Widget Settings And Bindings

Every widget type owns its own settings. Settings usually control the input source, display mode,
formatting, and optional behavior such as pagination or refresh.

If a widget reads from another widget, check both the widget settings and the binding graph. Display
problems often come from the upstream data shape rather than the downstream visualization.

## Working With Outputs

Many widgets produce output that other widgets can consume. For example, a query widget can produce
a table-like result, then a chart widget can bind to that result and select fields for the x-axis,
y-axis, and grouping.

## Good Practice

- Give important widgets clear titles.
- Keep source widgets easy to identify.
- Avoid duplicating expensive queries when a binding can reuse the same output.
- Use note widgets to document assumptions, filter choices, and operating steps.
- Check the widget catalog when you are not sure which widget type fits the task.
