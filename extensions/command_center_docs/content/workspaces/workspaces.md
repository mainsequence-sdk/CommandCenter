# Workspaces

Workspaces are user-facing canvases for composing operational views. A workspace can hold widgets,
layout sections, notes, data sources, charts, and app panels.

This page documents the `Workspaces` surface inside the `Workspaces` application.

## When To Use A Workspace

Use a workspace when the view needs to be assembled, tuned, copied, or evolved by users. A workspace
is a good fit for analysis decks, monitoring views, operational control rooms, and repeatable
investigation flows.

Use a dedicated app surface instead when the workflow needs strict navigation, custom forms, or a
single fixed product experience.

## What You Do Here

1. Open the Workspaces app.
2. Create a workspace or copy an existing one.
3. Add widgets from the catalog.
4. Configure each widget.
5. Arrange the layout.
6. Save the workspace.
7. Reopen it from the workspace list or a linked app surface.

## Main Views

- The workspace list is where you create, reopen, favorite, and organize workspaces.
- The canvas is where you place and operate widgets.
- The graph view is where you inspect or change bindings between widgets.
- The settings view is where you manage metadata, labels, import/export, and sharing behavior.

## Widget Bindings

Widgets can pass data to each other. A source widget produces output, and a downstream widget reads
that output through a binding. This is how one query can drive a chart, table, statistic, or
transformation without duplicating the query configuration.

Reference variables are the setting-level version of this idea. They let a live value from one
widget, such as the selected row in a table, drive a specific field or title in another widget.
Use the `Reference Variables` page when a workspace needs click-to-filter behavior or one widget
selection should update another widget's query.

## Workspace Settings

Workspace settings are used for metadata, layout controls, labels, import/export flows, sharing, and
other workspace-level behavior. If a workspace behaves unexpectedly, check its settings before
changing individual widgets.

## Good Practice

- Keep names descriptive. Workspaces are easier to find and copy when the title describes the job.
- Prefer one clear source widget for a dataset, then bind downstream widgets to it.
- Use notes to explain the operating procedure for a workspace.
- Copy a workspace before making experimental layout or data-flow changes.
