# Applications

In Command Center, an application is a top-level product area in the shell. It appears in
navigation, owns one or more surfaces, and gives users a coherent workflow.

An extension is the package that contributes those applications, along with other things such as
widgets, themes, or connection types.

## Current Shell Applications

| Application | Primary role | Contributed by |
| --- | --- | --- |
| Workspaces | Workspace authoring, slide decks, widget catalog, and saved widgets | Core extension |
| Main Sequence Foundry | Backend resource operations and project-centric workflows | Main Sequence Workbench extension |
| Main Sequence Markets | Market-facing registries and portfolio-related workflows | Main Sequence Markets extension |
| Main Sequence AI | Chat, agents, project agents, and agent monitor workspaces | Main Sequence AI extension |
| Connections | Platform-admin connection setup, registry browsing, and live exploration | Connections extension |
| Organization Admin | Organization-level administration | Core extension |
| Access & RBAC | Access inspection and RBAC workflows | Core extension |
| Documentation | In-app user documentation | Command Center Docs extension |

## Application Vs Extension

- An application is what users open in the shell.
- An extension is what developers ship into the shell.
- One extension can contribute one application or several related capabilities.
- Some product families, such as Main Sequence, are organized as multiple extensions that each
  contribute their own application surfaces.

## How To Read The Rest Of This Documentation

- Use the `Workspace Studio` branch for workspace-based flows such as `Workspaces`, `Slide Studio`,
  `Agents Monitor`, and widget authoring.
- Use the `Applications` branch for application-level overviews such as `Main Sequence Foundry`,
  `Main Sequence Markets`, `Main Sequence AI`, and `Connections`.
