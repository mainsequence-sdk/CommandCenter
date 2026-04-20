---
id: apps-index
title: Apps
slug: /apps
---

This section explains how Command Center is organized as apps and surfaces instead of one flat list
of dashboards and pages.

## Read This Section First

1. [Apps and Surfaces Overview](./overview.md)

## How To Extend Apps

- Add a new app when users should think in terms of one product domain or workflow area.
- Add a new surface when the feature belongs inside an existing app boundary.
- Keep app-specific implementation docs near the owning extension instead of bloating this section.

## Guidelines

- Document the navigation model, permission model, and routing model together.
- Do not document app chrome in one place and surface ownership somewhere else.
- If a page belongs to one extension, its implementation details belong in that extension's
  `README.md`.
