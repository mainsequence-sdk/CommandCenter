# Demo Features

This folder contains page-level features owned by the Demo extension.

## Modules

- `DemoOverviewPage.tsx`: landing page for the Demo app. It explains the mock application, links to
  the default workspace, and embeds live widget examples around Data Nodes and Main Sequence widget
  composition.
- `SupplyChainControlTowerPage.tsx`: supply-chain scenario page.
- `HealthcareOperationsPage.tsx`: healthcare operations scenario page.
- `market-brief/`: narrative mock market briefing page retained in the extension, but no longer
  registered in the main Demo app navigation.

## Maintenance Notes

- Keep feature pages here when they only exist for the mock application.
- Shared shell features that also serve live apps should stay outside this folder.
