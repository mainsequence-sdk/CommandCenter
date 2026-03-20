# Notifications

Notifications are aggregated per app. Each app registers one or more notification sources, and the
topbar refresh joins the results from every registered source into a single feed.

## Contract

Backend payloads must match the visible notification serializer contract used by the UI:

```python
class VisibleNotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.BooleanField(read_only=True)

    class Meta:
        model = Notification
        fields = [
            "id",
            "type",
            "created_at",
            "title",
            "description",
            "meta_data",
            "is_global",
            "target_user",
            "target_distribution_list",
            "include_email",
            "is_read",
        ]
```

Frontend payload type: `src/notifications/types.ts`

## App Registration

Apps opt into notifications by adding `notificationSources` to their `AppDefinition` in
`src/apps/types.ts`.

Each source registers its own endpoints:

- `listPath`
- `detailPath` optional
- `markReadPath` optional
- `dismissPath` optional
- `markAllReadPath` optional
- `dismissAllPath` optional
- `baseUrl` optional
- `listQuery` optional

Example:

```ts
notificationSources: [
  {
    id: "main-sequence-notifications",
    title: "Main Sequence",
    listPath: "/user/api/notifications/",
    detailPath: "/user/api/notifications/{id}/",
    markReadPath: "/user/api/notifications/{id}/mark-read/",
    dismissPath: "/user/api/notifications/{id}/dismiss/",
    markAllReadPath: "/user/api/notifications/mark-all-read/",
    dismissAllPath: "/user/api/notifications/dismiss-all/",
    listQuery: { limit: 50 },
  },
],
```

Current Main Sequence registration: `extensions/main_sequence/index.ts`

## Aggregation

On refresh, the client:

1. collects notification sources from accessible apps
2. fetches each source in parallel
3. normalizes every item with its app/source metadata
4. merges and sorts the final list by `created_at`

Aggregation code: `src/notifications/api.ts`

Normalization helpers: `src/notifications/registry.ts`

## Rendering

The bell menu renders the merged feed and routes per-item actions back to the source that produced
that notification.

Menu UI: `src/app/layout/NotificationsMenu.tsx`
