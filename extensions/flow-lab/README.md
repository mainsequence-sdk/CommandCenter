# Flow Lab Extension

This bundled extension provides the Flow Lab-specific widget and theme assets that can be embedded
into other apps.

## Entry Points

- `index.ts`: registers the Flow Lab extension metadata and theme.
- `theme.ts`: exports the `neon-mint` theme preset owned by this extension.
- `widgets/`: Flow Lab-owned widget modules that stay outside the main `src/` tree.

## Owned Assets

- the `flow-lab` theme preset used by demo surfaces
- the order-book widget modules registered from `widgets/order-book/`

## Dependencies

- The `demo` extension composes the assets registered by this extension through the shared widget
  and theme registry.

## Maintenance Notes

- Keep `source: "flow-lab"` aligned across Flow Lab-owned assets defined here.
- This extension no longer registers its own app; app-level navigation stays in the demo
  extension.
- This extension is also marked `mockOnly` in its `AppExtension` definition because its widgets
  and theme are only used by demo/mock surfaces. When `VITE_USE_MOCK_DATA=false`, the registry
  removes Flow Lab entirely so its widgets do not appear in the live workspace catalog.
