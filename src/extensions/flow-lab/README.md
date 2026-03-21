# Flow Lab Extension

This bundled extension provides the Flow Lab-specific widget and theme assets that can be embedded
into other apps.

## Entry Points

- `index.ts`: registers the Flow Lab extension metadata, widget, and theme.
- `theme.ts`: exports the `neon-mint` theme preset owned by this extension.

## Owned Assets

- the `data-node-table-visualizer` widget under `src/widgets/extensions/data-node-table-visualizer/`
- the `flow-lab` theme preset used by demo surfaces
- the order-book widget modules remain on disk under `src/widgets/extensions/order-book/`, but they are not currently registered

## Dependencies

- The core `Demo / Flow Lab` dashboard composes the assets registered by this extension through the
  shared widget and theme registry.

## Maintenance Notes

- Keep `source: "flow-lab"` aligned across assets defined here.
- This extension no longer registers its own app; app-level navigation stays in the core demo app.
