# Workspace Backend Model

## Purpose

This page proposes a Django persistence model for shared `Workspaces` in production.

It is intentionally not a 1:1 copy of the browser-local frontend stores. The backend should store:

- shared workspace content
- object-level access grants
- per-user view state that should not overwrite collaborators
- revision snapshots for copy/import/history

## Frontend-to-backend mapping

| Frontend model | Backend model | Why |
| --- | --- | --- |
| `UserDashboardCollection` | no dedicated table | this is a browser container, not the shared business object |
| `selectedDashboardId` | user preference | which workspace a user last had open is personal state |
| `DashboardDefinition` | `Workspace` | this is the real shared workspace entity |
| `DashboardWidgetInstance` | nested inside `Workspace.widgets` JSON | widget instances are part of the workspace document |
| selected controls state | `WorkspaceUserState.selected_controls` | time range / refresh selection is personal view state |
| widget `runtimeState` | `WorkspaceUserState.widget_runtime_state` | zoom, pan, selected node, minimap visibility are personal view state |
| `WorkspaceSnapshot` | `WorkspaceRevision.snapshot` and import/export payload | snapshot is revision/export transport, not the primary row |

## Important frontend contract detail

The current frontend does not translate workspace field names for the backend. The API layer sends
and expects the same dashboard-shaped document used in the browser:

- top-level fields such as `layoutKind`, `autoGrid`, `controls`, and `companions`
- widget-instance fields such as `widgetId`, `presentation`, `bindings`, `row`, and `position`

That means Django model field names such as `layout_kind`, `auto_grid`, and `controls_config` are
fine as internal storage, but your serializer layer must map them explicitly. A plain
`ModelSerializer` that exposes the snake_case fields directly is not enough.

Also note that the current frontend backend adapter expects a split list/detail contract:

- `GET workspaces.list_url`: lightweight workspace summaries only
- `GET workspaces.detail_url`: shared workspace content only
- `GET workspaces.user_state_list_url?workspace=<id>`: current user control/runtime state
- `PUT/DELETE workspaces.detail_url`: shared workspace content only

The frontend now merges the current-user payload into the shared workspace locally after both
requests resolve. That means:

- `controls.selectedRange`, `controls.customStartMs`, `controls.customEndMs`
- `controls.refresh.selectedIntervalMs`
- widget-instance `runtimeState`

must not be embedded in the shared workspace serializer anymore. Those fields belong to
`WorkspaceUserState`.

## Recommended Django models

The example below assumes you already have:

- a Django user model in `settings.AUTH_USER_MODEL`
- a team model such as `teams.Team`

```python
import uuid

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone

# Replace this import with your real team model.
from teams.models import Team


class WorkspaceAccessLevel(models.TextChoices):
    VIEW = "view", "Can view"
    EDIT = "edit", "Can edit"


class WorkspaceLayoutKind(models.TextChoices):
    CUSTOM = "custom", "Custom"
    AUTO_GRID = "auto-grid", "Auto Grid"


class Workspace(models.Model):
    """
    Shared workspace content.

    This is the object collaborators view, edit, copy, export, and import.
    Store only structural/shared content here.

    Do NOT store per-user zoom/pan/date-range choices in this model because
    those interactions would overwrite each other across collaborators.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    labels = models.JSONField(default=list, blank=True)
    category = models.CharField(max_length=64, blank=True, default="Custom")
    source = models.CharField(max_length=64, default="user")
    schema_version = models.PositiveIntegerField(default=1)
    layout_kind = models.CharField(
        max_length=16,
        choices=WorkspaceLayoutKind.choices,
        default=WorkspaceLayoutKind.CUSTOM,
    )
    auto_grid = models.JSONField(default=dict, blank=True)
    companions = models.JSONField(default=list, blank=True)

    # Shared layout metadata.
    grid = models.JSONField(default=dict, blank=True)

    # Shared control definition, not per-user selected values.
    # Example: enabled flags, default ranges, allowed intervals, action visibility.
    controls_config = models.JSONField(default=dict, blank=True)

    # Full widget list. Each item is effectively a DashboardWidgetInstance document:
    # widgetId, title, props, layout, position, presentation, bindings, row, etc.
    widgets = models.JSONField(default=list, blank=True)

    # Copy lineage helps with audit/history and "duplicate workspace" UX.
    copied_from = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="copies",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_workspaces",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="updated_workspaces",
    )

    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["title", "id"]
        indexes = [
            models.Index(fields=["is_archived", "updated_at"]),
            models.Index(fields=["created_by", "updated_at"]),
        ]

    def __str__(self) -> str:
        return f"Workspace<{self.id}> {self.title}"


class WorkspaceUserGrant(models.Model):
    """
    Direct user-level object access.

    EDIT implies VIEW at the application layer.
    Keep grants explicit rather than packing ACLs into one JSON column so they are
    queryable, enforceable, and easy to audit.
    """

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="user_grants",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="workspace_grants",
    )
    level = models.CharField(max_length=8, choices=WorkspaceAccessLevel.choices)
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="granted_workspace_user_access",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "user"],
                name="uniq_workspace_user_grant",
            )
        ]
        indexes = [
            models.Index(fields=["user", "level"]),
            models.Index(fields=["workspace", "level"]),
        ]


class WorkspaceTeamGrant(models.Model):
    """
    Team-level object access.

    This is the RBAC bridge for shared workspaces. Effective access is the union of:
    - direct user grants
    - grants inherited through team membership
    """

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="team_grants",
    )
    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name="workspace_grants",
    )
    level = models.CharField(max_length=8, choices=WorkspaceAccessLevel.choices)
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="granted_workspace_team_access",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "team"],
                name="uniq_workspace_team_grant",
            )
        ]
        indexes = [
            models.Index(fields=["team", "level"]),
            models.Index(fields=["workspace", "level"]),
        ]


class WorkspaceUserState(models.Model):
    """
    Personal view state for a shared workspace.

    This is deliberately separate from Workspace because the same shared workspace
    should not force every user to share temporary interactions such as:
    - selected date range
    - selected refresh interval
    - chart zoom/pan
    - selected graph node
    - minimap visibility
    - last-opened workspace view
    """

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="user_states",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="workspace_states",
    )

    # Store the current selected control values, not the shared control definition.
    # Example payload:
    # {
    #   "timeRangeKey": "24h",
    #   "rangeStartMs": 1710800000000,
    #   "rangeEndMs": 1710886400000,
    #   "refreshIntervalMs": 60000
    # }
    selected_controls = models.JSONField(default=dict, blank=True)

    # Map widget instance id -> runtimeState payload.
    # Example:
    # {
    #   "widget-1": {"zoom": 1.2, "panX": 30, "panY": -12},
    #   "widget-9": {"selectedNodeId": "abc", "minimapVisible": true}
    # }
    widget_runtime_state = models.JSONField(default=dict, blank=True)

    last_view = models.CharField(max_length=32, blank=True, default="")
    last_opened_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "user"],
                name="uniq_workspace_user_state",
            )
        ]


class WorkspaceRevisionReason(models.TextChoices):
    SAVE = "save", "Saved workspace"
    COPY = "copy", "Workspace copy"
    IMPORT = "import", "Imported snapshot"
    MIGRATION = "migration", "Schema migration"


class WorkspaceRevision(models.Model):
    """
    Immutable revision snapshot of the shared workspace content.

    Use this for:
    - copy/duplicate
    - import/export
    - rollback/recovery
    - audit/history
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="revisions",
    )
    revision_number = models.PositiveIntegerField()

    # Snapshot of shared content only.
    snapshot = models.JSONField(default=dict)

    reason = models.CharField(
        max_length=16,
        choices=WorkspaceRevisionReason.choices,
        default=WorkspaceRevisionReason.SAVE,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="workspace_revisions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["workspace_id", "-revision_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "revision_number"],
                name="uniq_workspace_revision_number",
            )
        ]
```

## Widget catalog

The workspace document stores widget instances, not widget type definitions.

Today the frontend runtime registry already knows much more about each widget than the workspace row
contains, including:

- `title`, `description`, `category`, `kind`, `source`, and `tags`
- typed settings `schema`
- input/output `io` metadata for bindings and dependency graphs
- default presentation and permission metadata

If the backend stores only `Workspace.widgets`, it only knows that a workspace references a
`widgetId`; it does not know what that widget is, how to explain it, how to validate it, or how to
help a CLI create one.

For production, add a separate widget-catalog concept on the backend. Keep it type-level, not
instance-level.

Recommended fields for a `WidgetType` / `RegisteredWidget` model:

- stable `widget_id`
- `title`
- `description`
- `category`
- `kind`
- `source`
- `tags`
- `required_permissions`
- `schema_json`
- `io_json`
- `default_presentation`
- `is_active`
- `registry_version` or `checksum`
- `last_synced_at`

Implemented frontend behavior:

- build a JSON-safe widget-type manifest from the live frontend runtime registry
- POST that manifest to `/api/v1/command_center/widget-types/sync/`
- include `registryVersion` plus a checksum of the full projected registry
- run the sync once per authenticated browser session before normal workspace editing needs backend
  validation

Recommended backend behavior:

- validate `widgetId` against the catalog on workspace save, with an escape hatch for legacy ids
- expose a read API so CLIs and other backends can discover available widgets and their contracts
- keep `Workspace.widgets` as nested JSON because that is instance state, not reusable type state

This split is what enables richer widget explanations, backend-side validation, and code-driven
workspace/widget creation without coupling the backend to React components.

## Copy service example

Copy should duplicate the shared workspace content, seed the new workspace with an initial
revision, and grant the actor edit access to the new copy.

```python
def build_workspace_snapshot(workspace: Workspace) -> dict:
    """
    Shared-content snapshot only.
    Per-user view state is intentionally excluded.
    """

    return {
        "schema": "mainsequence.workspace",
        "version": workspace.schema_version,
        "exportedAt": timezone.now().isoformat(),
        "workspace": {
            "id": str(workspace.id),
            "title": workspace.title,
            "description": workspace.description,
            "labels": workspace.labels,
            "category": workspace.category,
            "source": workspace.source,
            "layoutKind": workspace.layout_kind,
            "autoGrid": workspace.auto_grid,
            "grid": workspace.grid,
            "controls": workspace.controls_config,
            "widgets": workspace.widgets,
            "companions": workspace.companions,
        },
    }


@transaction.atomic
def copy_workspace(*, source: Workspace, actor, title: str | None = None) -> Workspace:
    copy_title = title or f"{source.title} (Copy)"

    workspace = Workspace.objects.create(
        title=copy_title,
        description=source.description,
        labels=list(source.labels),
        category=source.category,
        source=source.source,
        schema_version=source.schema_version,
        layout_kind=source.layout_kind,
        auto_grid=source.auto_grid,
        grid=source.grid,
        controls_config=source.controls_config,
        widgets=source.widgets,
        companions=source.companions,
        copied_from=source,
        created_by=actor,
        updated_by=actor,
    )

    WorkspaceUserGrant.objects.create(
        workspace=workspace,
        user=actor,
        level=WorkspaceAccessLevel.EDIT,
        granted_by=actor,
    )

    WorkspaceRevision.objects.create(
        workspace=workspace,
        revision_number=1,
        snapshot=build_workspace_snapshot(workspace),
        reason=WorkspaceRevisionReason.COPY,
        created_by=actor,
    )

    return workspace
```

## Why JSON for grid, controls, and widgets

We keep `grid`, `controls_config`, `widgets`, `selected_controls`, and `widget_runtime_state`
as JSON because:

- widget props differ by widget type
- widget runtime state differs by widget type
- the frontend already treats the workspace as one document
- import/export wants a document-shaped snapshot
- the shared workspace should be easy to copy/version as one unit

The relational columns are still useful for:

- searching by title and creator
- filtering archived workspaces
- access control
- revision history

## Important modeling rule

For shared workspaces:

- `Workspace` is collaborative content
- `WorkspaceUserState` is personal viewing state

That split is the reason users do not overwrite each other's:

- zoom / pan
- selected date range
- selected refresh interval
- currently selected graph node

At the same time, collaborators still share edits to:

- widget configuration
- layout
- labels
- workspace metadata
- shared control defaults/configuration
