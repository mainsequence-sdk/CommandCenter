# ADR: Extension-Contributed Shell Settings Menus

- Status: Proposed
- Date: 2026-04-15
- Related:
  - [ADR: Headless Workspace Settings Runtime](./adr-headless-workspace-settings-runtime.md)
  - [ADR: Agent-Ready Widget Type Registry Contract](./adr-agent-ready-widget-type-registry-contract.md)

## Context

The Command Center shell already has two settings/menu surfaces that matter here:

- the user menu in the global sidebar
- the settings dialog opened in `user` or `platform` mode

Today both are shell-owned and largely hardcoded:

- [src/app/layout/Sidebar.tsx](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/app/layout/Sidebar.tsx)
  assembles sidebar menu actions inline
- [src/app/layout/UserMenu.tsx](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/app/layout/UserMenu.tsx)
  renders a generic menu shell but receives a static action list from callers
- [src/app/layout/SettingsDialog.tsx](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/app/layout/SettingsDialog.tsx)
  owns a fixed set of sections such as `general`, `account`, `configuration`, and `registry`

The app registry currently supports:

- app-level navigation
- surface registration
- permission-aware visibility
- assistant-facing surface metadata

It does **not** support extension-contributed settings/menu entries.

That means extension apps such as `main_sequence_forge` or `main_sequence_markets` cannot add:

- user-facing settings/menu pages
- admin-facing settings/menu pages
- app-scoped settings groups inside the shared shell dialog

without directly editing the shell.

This is the wrong ownership model. These entries should be extension-defined and registry-driven,
but still rendered by one shell-owned UI.

## Decision

We will add a registry-backed contribution model for shell settings menus.

The model must let any extension app contribute entries to:

- user settings/menu
- admin settings/menu

without requiring direct shell edits for each new app.

The shell remains the single renderer. Extensions contribute structured metadata and page content.

## Scope

This ADR covers:

- contribution contract
- registry ownership
- shell rendering ownership
- permission and audience rules
- ordering/grouping model

It does **not** require implementing every extension page immediately.

## Design

### 1. Contribution ownership

The contribution should be declared on the app definition layer, not in a separate parallel
extension registry.

Reason:

- the app registry is already the runtime source of truth for extension-owned shell-visible objects
- permission gating already exists there
- extension apps already have identity, title, icon, and source metadata there

So the contribution contract belongs in [src/apps/types.ts](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/apps/types.ts)
as part of `AppDefinition`.

### 2. New app-level contract

Add an optional top-level property:

- `shellMenuContributions?: AppShellMenuContribution[]`

Recommended shape:

```ts
export type AppShellMenuAudience = "user" | "admin";

export interface AppShellMenuContribution {
  id: string;
  audience: AppShellMenuAudience;
  label: string;
  description?: string;
  icon?: AppIcon;
  order?: number;
  requiredPermissions?: string[];
  group?: {
    id: string;
    label: string;
    order?: number;
  };
  component: ComponentType;
}
```

Important rules:

- `audience="user"` means it can appear in user settings/menu flows
- `audience="admin"` means it can appear in admin settings/menu flows
- `requiredPermissions` is evaluated in addition to app-level permissions
- `component` is the shell-rendered content panel for that entry
- `group` is optional but gives us a stable section model for future scale

### 3. Registry assembly

The flattened app registry should also assemble shell-menu contributions.

Add a derived collection on the runtime registry:

- `shellMenuContributions: AppShellMenuEntry[]`

where `AppShellMenuEntry` extends the contribution with app metadata:

- `appId`
- `appTitle`
- `appIcon`
- `appSource`

This mirrors how surfaces are already flattened into `AppSurfaceEntry`.

### 4. Rendering ownership

The shell continues to own rendering:

- `Sidebar.tsx` decides where user/admin triggers live
- `UserMenu.tsx` remains the generic menu shell
- `SettingsDialog.tsx` remains the generic content shell

But the dialog/nav entries are no longer fixed-only.

Instead:

- built-in core sections stay supported
- extension-contributed sections are appended into the same section model
- the left rail/nav of the settings dialog becomes data-driven

### 5. Menu model

There are two distinct but related surfaces:

#### A. User menu shortcuts

These are quick actions in the avatar/user menu.

Not every contributed settings section needs to appear here.

So the contract should **not** automatically imply a user-menu action.

If we need that behavior, add a separate optional flag later:

- `showInUserMenu?: boolean`

Default:

- contributed sections render in the dialog nav
- only selected entries opt into direct user-menu shortcuts

#### B. Settings dialog sections

This is the primary target.

Contributed entries should appear as additional left-nav items inside:

- `mode="user"`
- `mode="platform"` or admin mode

depending on `audience`.

### 6. Routing vs inline section rendering

For this feature, use inline section rendering inside the existing `SettingsDialog`.

Do **not** create separate routes for the first pass.

Reason:

- the UI in the screenshot is clearly a modal/sheet-style settings surface
- this is already how `SettingsDialog.tsx` works
- the shell should remain the owner of that experience

If some contributed pages later become too heavy, we can add a route-backed escape hatch, but that
should be a second-step decision.

### 7. Ordering

Ordering should be explicit and deterministic.

Rules:

- built-in core sections keep existing stable ordering
- extension-contributed sections sort by:
  1. group order
  2. section order
  3. app title
  4. label

This prevents random movement as more extensions contribute content.

### 8. Permissions

Visibility rule:

- app-level required permissions must pass
- contribution-level required permissions must pass

This keeps the model consistent with the rest of the registry.

Example:

- `main_sequence_markets` can contribute a user settings panel visible to all markets users
- `main_sequence_forge` can contribute an admin panel visible only to org/platform admins with its
  own explicit permissions

### 9. Empty-state behavior

If no extension contributes to a given audience:

- the shell behaves exactly as it does now

So this is a pure extension point, not a required migration.

## Consequences

### Positive

- extension apps can add settings/admin pages without shell forks
- the shell keeps one visual system and one interaction model
- permissions stay registry-driven
- future apps scale without another hardcoded sidebar/menu pass

### Tradeoffs

- `SettingsDialog.tsx` becomes more data-driven and slightly more complex
- the app registry grows another flattened entry type
- extension authors now own lifecycle/documentation for shell-contributed settings sections

## Implementation Plan

### Phase 1: registry contract

1. Extend [src/apps/types.ts](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/apps/types.ts)
   with shell-menu contribution types.
2. Extend [src/app/registry/types.ts](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/app/registry/types.ts)
   with flattened shell-menu entry types.
3. Extend [src/app/registry/index.ts](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/app/registry/index.ts)
   to flatten and export those entries.
4. Add helper selectors in `apps/utils.ts` for audience/permission-filtered menu sections.

### Phase 2: shell rendering

1. Refactor [src/app/layout/SettingsDialog.tsx](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/app/layout/SettingsDialog.tsx)
   so its nav/content model can merge:
   - built-in sections
   - extension-contributed sections
2. Keep current core sections as built-in entries in the same internal section list.
3. Render contributed components inside the same content pane.

### Phase 3: user-menu integration

1. Extend [src/app/layout/UserMenu.tsx](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/app/layout/UserMenu.tsx)
   caller data so selected contributions can also appear as quick actions if needed.
2. Keep this opt-in, not automatic.

### Phase 4: first extension adopters

1. Add one user contribution from a non-core extension.
2. Add one admin contribution from a non-core extension.
3. Validate ordering, permission gating, and empty states.

## Rejected Alternatives

### Separate shell-settings registry outside the app registry

Rejected because it duplicates extension identity and permission ownership that the app registry
already has.

### Hardcode more app-specific sections in `SettingsDialog.tsx`

Rejected because it does not scale and keeps shell code coupled to individual extensions.

### Route every settings page separately

Rejected for the first pass because the current UX target is a shared modal/sidebar shell, not a
full-page app handoff.

## Resulting Mental Model

- extension app owns contributed settings/admin content
- app registry owns discovery and permission filtering
- shell owns rendering and interaction chrome

That is the correct split.
