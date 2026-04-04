# Saved Widgets Implementation Checklist

Date: 2026-04-03

## Goal

Allow users to save reusable widget instances and widget groups, share them with RBAC, browse them in a dedicated library, and import them into workspaces without changing the current live workspace runtime model.

## Core decision

- Keep `Workspace.widgets` JSON as the live runtime model.
- Do not make `Workspace` depend on live saved-widget foreign keys.
- Saved widgets are a reusable library/import layer.
- Use many-to-many between `SavedWidgetGroup` and `SavedWidgetInstance`, not between `Workspace` and saved widgets.
- Import always copies saved widgets/groups into normal workspace JSON with fresh ids.
- V1 group members are created as dedicated copies, not implicit reuse of an existing saved widget instance id.
- `SavedWidgetGroupBinding` is the canonical source for internal group edges.
- Atomic saved widget instances must not embed `row.children`; multi-widget row structures belong in saved widget groups.

## Backend checklist

1. Add `SavedWidgetInstance` as a shareable object.
2. Add `SavedWidgetGroup` as a shareable object.
3. Add `SavedWidgetGroupMember` as the through model between groups and widget instances.
4. Add `SavedWidgetGroupBinding` for widget-to-widget bindings inside a group.
5. `SavedWidgetInstance` fields:
   - `title`
   - `description`
   - `labels`
   - `category`
   - `source`
   - `schema_version`
   - `widget_id`
   - `instance_title`
   - `props`
   - `presentation`
   - `bindings` for standalone atomic widgets only
   - shallow `row` metadata only
   - `layout`
   - `companions`
   - `required_permissions`
   - `copied_from`
   - `updated_by`
   - `is_archived`
   - `updated_at`
6. `SavedWidgetGroup` fields:
   - `title`
   - `description`
   - `labels`
   - `category`
   - `source`
   - `schema_version`
   - `required_permissions`
   - `copied_from`
   - `updated_by`
   - `is_archived`
   - `updated_at`
7. `SavedWidgetGroupMember` fields:
   - `group`
   - `widget_instance`
   - `member_key`
   - `sort_order`
   - optional `layout_override`
8. `SavedWidgetGroupBinding` fields:
   - `group`
   - `source_member`
   - `target_member`
   - `input_id`
   - `binding_payload`
9. Add list/detail/create/update/archive endpoints for saved widget instances.
10. Add list/detail/create/update/archive endpoints for saved widget groups.
11. Reuse standard shareable-object RBAC endpoints for both object types.

## Frontend checklist

### API and config

1. Add frontend types for:
   - saved widget instance
   - saved widget group
   - saved widget group member
   - saved widget group binding
2. Add frontend API client methods for:
   - list saved widgets
   - fetch saved widget detail
   - create saved widget
   - update saved widget
   - archive saved widget
   - list saved groups
   - fetch saved group detail
   - create saved group
   - update saved group
   - archive saved group
3. Add config entries for saved widget list/detail endpoints.

### Save flow

4. Extend the widget action menu in `CustomDashboardStudioPage.tsx`.
5. Add `Save widget` action.
6. Open a save dialog/page with:
   - title
   - description
   - labels
   - save mode: `Widget` or `Widget group`
7. Build a widget snapshot helper that persists:
   - `widgetId`
   - instance `title`
   - `props`
   - `presentation`
   - `bindings`
   - `layout`
   - `requiredPermissions`
   - owned companions
8. Exclude from saved payload:
   - `runtimeState`
   - transient UI state
   - draft layout/edit state

### Dependency handling

9. Build a dependency-closure helper from widget bindings.
10. If widget bindings or row-owned child widgets exist, require `Save as group`.
11. Save widget groups with stable `member_key` values.
12. Save internal widget-to-widget links in `SavedWidgetGroupBinding`, not in member widget snapshots.

### Library and import flow

13. Add new route: `/app/workspace-studio/widgets`
14. Build saved widget library screen with:
   - tabs for `Widgets` and `Groups`
   - search
   - labels
   - widget type/source filters
15. Add `Add saved widget` button to workspace canvas navigation.
16. Open a library picker from the workspace toolbar.
17. Import single widget by cloning it into the workspace with fresh ids.
18. Import group by:
   - cloning all member widgets
   - remapping internal bindings
   - remapping companions
   - preserving relative placement

### Detail/settings surfaces

19. Add saved widget detail/settings page with tabs:
   - Overview
   - JSON
   - Usage
   - Permissions
20. Add saved widget group detail/settings page with tabs:
   - Overview
   - Members
   - Bindings
   - JSON
   - Permissions
21. Reuse `MainSequencePermissionsTab` for both saved widget instances and saved widget groups.

## Implementation order

1. Frontend types and API client
2. Snapshot/import helpers
3. `Save widget` action in widget menu
4. Saved widget library list/detail screens
5. `Add saved widget` import flow in workspace toolbar
6. Group save/import with binding remap
7. Permissions tabs

## v1 rule

- Save a single widget only when it is self-contained.
- Save a single widget only when it is atomic and has no widget-to-widget bindings.
- Save a widget group when widget bindings are involved.
- Save a widget group when row-owned child widgets are involved.
- Keep workspaces JSON-based at runtime.
