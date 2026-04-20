---
id: platform-index
title: Platform
slug: /platform
---

This section covers the shell-level foundation that everything else builds on.

## Read This Section First

1. [Architecture](./architecture.md)
2. [Configuration](./configuration.md)
3. [Theming](./theming.md)
4. [Internationalization](./internationalization.md)
5. [Notifications](./notifications.md)

## How To Extend The Platform

- Add new platform behavior here only when it changes the reusable shell contract.
- If the change is product-specific, move it into an extension instead of growing core.
- When a platform change affects configuration, routing, theming, or shell chrome, update this
  section and the nearest implementation `README.md` in code.

## Guidelines

- Keep platform docs focused on shared runtime contracts, not one product's workflow.
- Prefer explaining extension points explicitly instead of only describing current behavior.
- Link from this section into code when ownership matters more than prose.
