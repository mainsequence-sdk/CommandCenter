# Namespaces Feature

This feature owns the Main Sequence Foundry namespace registry surface.

## Entry Points

- `MainSequenceNamespacesPage.tsx`: namespace registry plus a dedicated URL-backed detail view.
  Clicking a namespace opens `msNamespaceUid=<uid>`, and the detail surface uses
  `msNamespaceTab=overview|tables|permissions`.
- `MainSequenceNamespacePermissionsCard.tsx`: namespace-specific permissions adapter that reuses the
  RBAC assignment matrix UI while persisting through the namespace `set-permissions` and
  `propagate-permissions` endpoints.

## API Dependencies

- `GET /orm/api/ts_manager/namespace/` for the namespace registry rows.
- `GET /orm/api/ts_manager/namespace/<uid>/` for namespace-level details.
- `GET /orm/api/ts_manager/namespace/<uid>/tables/` for the combined Meta Table and
  DynamicTableMetaData inventory shown in the detail panel.
- `POST /orm/api/ts_manager/namespace/bulk-delete/` for multi-select registry delete.
- `GET /orm/api/ts_manager/namespace/<uid>/can-view/` and
  `GET /orm/api/ts_manager/namespace/<uid>/can-edit/` for the current share assignments.
- `POST /orm/api/ts_manager/namespace/<uid>/set-permissions/` to persist the full namespace
  assignment matrix.
- `POST /orm/api/ts_manager/namespace/<uid>/propagate-permissions/` to push the namespace rules to
  related tables.

## Notes

- The top-level registry uses client-side search and pagination because the namespace endpoint is a
  simple collection response.
- The registry owns namespace bulk delete from the list surface. It posts the selected namespace
  UID list to `/orm/api/ts_manager/namespace/bulk-delete/` and then refreshes the namespace query.
- The namespace detail is a dedicated view, not an in-page expansion. The list hides completely
  while a namespace detail is open.
- Namespace table rows deep-link into the existing Foundry Meta Table and Data Node detail routes.
- Namespace permissions do not use the generic add/remove shareable-object mutation flow because
  the backend exposes a namespace-specific full-assignment save endpoint instead.
