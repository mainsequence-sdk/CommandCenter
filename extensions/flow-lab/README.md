# Flow Lab Extension

This bundled extension provides the Flow Lab-specific widget assets that can be embedded into
other apps.

## Entry Points

- `index.ts`: registers the Flow Lab extension metadata.
- `widgets/`: Flow Lab-owned widget modules that stay outside the main `src/` tree.

## Owned Assets

- the order-book widget modules registered from `widgets/order-book/`

## Dependencies

- The `demo` extension composes the assets registered by this extension through the shared widget
  registry.

## Maintenance Notes

- This extension no longer registers its own app; app-level navigation stays in the demo
  extension.
- This extension is also marked `mockOnly` in its `AppExtension` definition because its widgets
  are only used by demo/mock surfaces. When `VITE_USE_MOCK_DATA=false`, the registry removes
  Flow Lab entirely so its widgets do not appear in the live workspace catalog.
