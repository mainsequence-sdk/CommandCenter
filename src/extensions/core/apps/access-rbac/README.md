# Access & RBAC

This app is owned by the core extension.

Keep the full app implementation in this folder:

- page surfaces
- shared RBAC surface layout
- user directory adapter for the inspector

Registration stays in:

- `src/extensions/core/index.ts`

This follows the platform extension rule: extension-owned apps should live under their owning
extension tree instead of generic feature folders.
