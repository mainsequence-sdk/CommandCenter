import agentsMonitorContent from "./agents-monitor.md?raw";
import applicationsContent from "./applications.md?raw";
import connectionsAppContent from "./connections-app.md?raw";
import gettingStartedContent from "./getting-started.md?raw";
import mainSequenceAiContent from "./main-sequence-ai.md?raw";
import mainSequenceFoundryContent from "./main-sequence-foundry.md?raw";
import mainSequenceMarketsContent from "./main-sequence-markets.md?raw";
import permissionsContent from "./permissions.md?raw";
import slideStudioContent from "./slide-studio.md?raw";
import troubleshootingContent from "./troubleshooting.md?raw";
import widgetsContent from "./widgets.md?raw";
import workspacesContent from "./workspaces.md?raw";

export interface DocumentationPageContent {
  id: string;
  title: string;
  navLabel: string;
  description: string;
  content: string;
}

export interface DocumentationNavPageItem {
  type: "page";
  pageId: string;
}

export interface DocumentationNavGroupItem {
  type: "group";
  id: string;
  title: string;
  description?: string;
  items: DocumentationNavItem[];
}

export type DocumentationNavItem = DocumentationNavPageItem | DocumentationNavGroupItem;

export interface DocumentationNavSection {
  id: string;
  title: string;
  description: string;
  order: number;
  items: DocumentationNavItem[];
}

export interface DocumentationPageLocation {
  section: DocumentationNavSection;
  group?: DocumentationNavGroupItem;
}

export const documentationPages = [
  {
    id: "getting-started",
    title: "Getting Started",
    navLabel: "Getting Started",
    description: "Start here for the product model and the first path through Command Center.",
    content: gettingStartedContent,
  },
  {
    id: "applications",
    title: "Applications",
    navLabel: "Applications",
    description: "See the current shell applications and how they relate to extensions.",
    content: applicationsContent,
  },
  {
    id: "workspaces",
    title: "Workspaces",
    navLabel: "Workspaces",
    description: "Build and manage general-purpose workspace canvases.",
    content: workspacesContent,
  },
  {
    id: "slide-studio",
    title: "Slide Studio",
    navLabel: "Slide Studio",
    description: "Create presentation decks on top of the shared workspace model.",
    content: slideStudioContent,
  },
  {
    id: "agents-monitor",
    title: "Agents Monitor",
    navLabel: "Agents Monitor",
    description: "Run session-driven AI monitor workspaces inside Main Sequence AI.",
    content: agentsMonitorContent,
  },
  {
    id: "widgets",
    title: "Widgets",
    navLabel: "Widgets",
    description: "Use the widget catalog and saved widgets as part of workspace authoring.",
    content: widgetsContent,
  },
  {
    id: "main-sequence-foundry",
    title: "Main Sequence Foundry",
    navLabel: "Main Sequence Foundry",
    description: "Overview of the Foundry application and its main operational areas.",
    content: mainSequenceFoundryContent,
  },
  {
    id: "main-sequence-markets",
    title: "Main Sequence Markets",
    navLabel: "Main Sequence Markets",
    description: "Overview of the Markets application and its major functional areas.",
    content: mainSequenceMarketsContent,
  },
  {
    id: "main-sequence-ai",
    title: "Main Sequence AI",
    navLabel: "Main Sequence AI",
    description: "Overview of the AI application and its assistant-driven workflows.",
    content: mainSequenceAiContent,
  },
  {
    id: "connections-app",
    title: "Connections",
    navLabel: "Connections",
    description: "Overview of the platform-admin connections application.",
    content: connectionsAppContent,
  },
  {
    id: "permissions",
    title: "Permissions",
    navLabel: "Permissions",
    description: "Diagnose missing apps, surfaces, widgets, connections, and actions.",
    content: permissionsContent,
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    navLabel: "Troubleshooting",
    description: "Work through common visibility, registry, data, and layout issues.",
    content: troubleshootingContent,
  },
] as const satisfies DocumentationPageContent[];

export const documentationPageMap: ReadonlyMap<string, DocumentationPageContent> = new Map(
  documentationPages.map((page) => [page.id, page]),
);

export const documentationNavSections = [
  {
    id: "overview",
    title: "Overview",
    description: "Start with the product model and the shell application map.",
    order: 10,
    items: [
      { type: "page", pageId: "getting-started" },
      { type: "page", pageId: "applications" },
    ],
  },
  {
    id: "workspace-studio",
    title: "Workspace Studio",
    description: "Workspace-based authoring, presentation, AI monitors, and reusable widgets.",
    order: 20,
    items: [
      { type: "page", pageId: "workspaces" },
      { type: "page", pageId: "slide-studio" },
      { type: "page", pageId: "agents-monitor" },
      { type: "page", pageId: "widgets" },
    ],
  },
  {
    id: "applications",
    title: "Applications",
    description: "Current application areas in the Command Center shell.",
    order: 30,
    items: [
      {
        type: "group",
        id: "current-applications",
        title: "Current Applications",
        description: "Each page here documents one shell application.",
        items: [
          { type: "page", pageId: "main-sequence-foundry" },
          { type: "page", pageId: "main-sequence-markets" },
          { type: "page", pageId: "main-sequence-ai" },
          { type: "page", pageId: "connections-app" },
        ],
      },
    ],
  },
  {
    id: "support",
    title: "Support",
    description: "Access model and common recovery paths.",
    order: 40,
    items: [
      { type: "page", pageId: "permissions" },
      { type: "page", pageId: "troubleshooting" },
    ],
  },
] as const satisfies DocumentationNavSection[];

function flattenDocumentationNavItems(items: readonly DocumentationNavItem[]): string[] {
  return items.flatMap((item) =>
    item.type === "page" ? [item.pageId] : flattenDocumentationNavItems(item.items),
  );
}

export const documentationPageOrder = documentationNavSections.flatMap((section) =>
  flattenDocumentationNavItems(section.items),
);

export function getAdjacentDocumentationPages(pageId: string) {
  const pageIndex = documentationPageOrder.findIndex((candidate) => candidate === pageId);

  return {
    previousPage:
      pageIndex > 0 ? documentationPageMap.get(documentationPageOrder[pageIndex - 1]) : undefined,
    nextPage:
      pageIndex >= 0 && pageIndex < documentationPageOrder.length - 1
        ? documentationPageMap.get(documentationPageOrder[pageIndex + 1])
        : undefined,
  };
}

export function getDocumentationPageLocation(pageId: string): DocumentationPageLocation | null {
  for (const section of documentationNavSections) {
    for (const item of section.items) {
      if (item.type === "page" && item.pageId === pageId) {
        return { section };
      }

      if (item.type === "group") {
        const foundInGroup = flattenDocumentationNavItems(item.items).includes(pageId);

        if (foundInGroup) {
          return { section, group: item };
        }
      }
    }
  }

  return null;
}
