# Architecture

## Overview

Main Sequence Command Center is organized around a small core runtime and an extension registry. The runtime is responsible for routing, state providers, theming, authentication, app rendering, and surface rendering. Features such as vendor-specific widgets are added through extensions rather than hard-coded into the shell.

## Runtime layers

### Application shell

The shell is defined under `src/app/` and is responsible for:

- route definitions
- protected and permission-gated screens
- the topbar and sidebar layout
- extension registry assembly
- top-level providers

Relevant files:

- `src/app/router.tsx`
- `src/app/layout/AppShell.tsx`
- `src/app/providers/AppProviders.tsx`
- `src/app/registry/index.ts`
- `src/dashboards/layout.ts`
- `src/preferences/CommandCenterPreferencesProvider.tsx`
- `src/features/dashboards/custom-workspace-studio-store.ts`

### Registry model

The registry auto-loads every extension from:

```text
src/extensions/*/index.ts
extensions/*/index.ts
```

Each extension contributes some combination of:

- widgets
- apps
- themes

Those are flattened into a single runtime registry and de-duplicated by `id`. Apps also project their surfaces into a derived registry so search, routing, and RBAC can reason about them consistently.

### App model

The shell is organized around apps first.

An app is:

- the primary left-rail navigation unit
- a product domain or workflow area
- the owner of one or more surfaces

Each app has a default home surface. Visiting `/app/:appId` redirects to that surface so the left rail always lands users in a meaningful starting point.

Surface switching and app metadata are exposed from the topbar:

- the app name opens an app details modal
- a topbar selector switches between the app's accessible surfaces
- an on-demand contextual app panel can list the clicked app's surfaces
- the content area is reserved for the active surface itself

### Surface model

A surface is an app-local screen.

Surface kinds are:

- `dashboard`
- `page`
- `tool`

This lets extensions ship richer product surfaces without forcing everything into widget tiles, while still keeping them under one app context.

### Dashboard model

Dashboards are code-defined TypeScript objects. A dashboard is a list of widget instances plus permissions, presentation metadata, and grid layout intent.

This means:

- dashboards are versionable
- composition stays explicit
- review is code review, not JSON diff review
- extensions can ship monitoring surfaces without owning the shell

Dashboard instances now pass through a layout resolver before rendering. Authors describe panel size and can optionally provide placement hints, while the runtime computes a collision-free grid.

### Widget model

Widgets are definitions plus React components. A widget definition contains:

- `id`
- `title`
- `description`
- `category`
- `kind`
- `source`
- `defaultSize`
- permission metadata
- example props

The component receives typed props and renders inside a shared widget frame.

## Core vs optional integrations

The architectural rule in this repo is:

- core should define the shell, registry model, themes, permissions, and reusable product primitives
- optional libraries should live in extensions

That is why `AG Grid` and `Lightweight Charts` now live in:

- `src/extensions/ag-grid/`
- `src/extensions/lightweight-charts/`

The core extension remains library-agnostic and uses only core widgets.

## Routing and permissions

Routes are declared in `src/app/router.tsx` and wrapped by:

- `ProtectedRoute` for authenticated access
- `PermissionRoute` for feature-level permission checks

Apps, surfaces, and widgets all declare required permissions. This allows the UI to:

- filter navigation
- hide restricted pages
- lock widgets
- explain missing access

The frontend uses permissions for presentation and navigation. The backend should still enforce authorization as the source of truth.

## State and data flow

The app currently uses:

- `TanStack Query` for async server-style data
- `Zustand` for local session and shell state
- mock REST and WebSocket adapters for development

Shell-level durable preferences now have two runtime modes:

- backend-backed when `preferences.url` is configured
- browser-local when that config entry is blank or omitted

That split is intentionally isolated behind `src/preferences/` so the rest of the shell reads one state model regardless of the persistence mode.

Workspaces now follow the same pattern:

- backend-backed when both `workspaces.list_url` and `workspaces.detail_url` are configured
- browser-local when either config entry is blank, `null`, or `None`

That split is isolated behind `src/features/dashboards/workspace-persistence.ts` so the workspace editor still consumes one draft/saved state model regardless of persistence target.

The mock adapters live in `src/data/` and are intentionally replaceable.

## Directory guide

```text
extensions/    repo-root product extensions
src/
  app/           app shell, routing, providers, registry
  auth/          roles, permissions, auth state
  components/    shared UI and brand components
  data/          API adapters and live transports
  extensions/    bundled extension entrypoints
  features/      page-level features
  preferences/   optional backend persistence for shell-level user preferences
  features/dashboards/ optional backend persistence for workspace documents
  themes/        theme types, presets, provider, snippet generation
  widgets/       widget implementations
```

## Design intent

The project is meant to evolve as a frontend platform. The architecture favors:

- clear extension boundaries
- code-first composition
- theming without forking the app shell
- low coupling between the main library and third-party UI vendors
