import type { AppDefinition, AppSurfaceDefinition } from "@/apps/types";
import { adminApp, workspaceStudioApp } from "@/extensions/core";
import { mainSequenceMarketsApp } from "../../main_sequence/extensions/markets/app";
import { mainSequenceWorkbenchApp } from "../../main_sequence/extensions/workbench/app";
import { mainSequenceAiApp } from "../../main_sequence_ai/app";

import mainSequenceFoundryContent from "./foundry/foundry.md?raw";
import gettingStartedContent from "./getting-started/getting-started.md?raw";
import agentsMonitorContent from "./main-sequence-ai/agents-monitor.md?raw";
import communicationContent from "./main-sequence-ai/communication.md?raw";
import mainSequenceAiContent from "./main-sequence-ai/main-sequence-ai.md?raw";
import projectAgentsContent from "./main-sequence-ai/project-agents.md?raw";
import mainSequenceMarketsContent from "./markets/markets.md?raw";
import organizationAdminContent from "./organization-admin/organization-admin.md?raw";
import rbacContent from "./organization-admin/rbac.md?raw";
import organizationAdminTbdContent from "./organization-admin/tbd.md?raw";
import slideStudioContent from "./workspaces/slide-studio.md?raw";
import widgetsContent from "./workspaces/widgets.md?raw";
import workspacesContent from "./workspaces/workspaces.md?raw";

export interface DocumentationPageContent {
  id: string;
  title: string;
  navLabel: string;
  description: string;
  content: string;
  sectionId: string;
  hiddenInShellNavigation?: boolean;
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
  landingPageId: string;
  items: DocumentationNavItem[];
}

export interface DocumentationPageLocation {
  section: DocumentationNavSection;
  group?: DocumentationNavGroupItem;
}

function getVisibleSurfaces(
  app: AppDefinition,
  options?: {
    excludeSurfaceIds?: string[];
  },
) {
  const excluded = new Set(options?.excludeSurfaceIds ?? []);

  return app.surfaces.filter((surface) => !surface.hidden && !excluded.has(surface.id));
}

function getAssistantSummary(surface: AppSurfaceDefinition) {
  return surface.assistantContext?.summary?.trim();
}

function getAssistantActions(surface: AppSurfaceDefinition) {
  return (surface.assistantContext?.availableActions ?? []).filter((action) => action.trim().length > 0);
}

function createSurfaceDocumentationContent(app: AppDefinition, surface: AppSurfaceDefinition) {
  const lines = [
    `# ${surface.title}`,
    "",
    surface.description,
  ];

  if (surface.navigationSection) {
    lines.push(
      "",
      "## Where This Lives",
      "",
      `This page belongs to the **${app.title}** application inside **${surface.navigationSection.label}**.`,
    );
  } else {
    lines.push(
      "",
      "## Where This Lives",
      "",
      `This page belongs to the **${app.title}** application.`,
    );
  }

  const summary = getAssistantSummary(surface);

  if (summary) {
    lines.push("", "## What This Surface Does", "", summary);
  }

  const availableActions = getAssistantActions(surface);

  if (availableActions.length > 0) {
    lines.push("", "## Common Tasks", "", ...availableActions.map((action) => `- ${action}`));
  }

  lines.push(
    "",
    "## When To Use It",
    "",
    `Open **${surface.navLabel ?? surface.title}** when the current workflow needs ${surface.title.toLowerCase()} inside **${app.title}**.`,
  );

  return lines.join("\n");
}

function createGeneratedSurfacePageId(sectionId: string, surfaceId: string) {
  return `${sectionId}--${surfaceId}`;
}

function createGeneratedSurfacePages(
  sectionId: string,
  app: AppDefinition,
  options?: {
    excludeSurfaceIds?: string[];
    contentOverrides?: Partial<Record<string, string>>;
    pageOverrides?: Partial<
      Record<
        string,
        Partial<Pick<DocumentationPageContent, "title" | "navLabel" | "description">>
      >
    >;
  },
) {
  return getVisibleSurfaces(app, options).map((surface) => {
    const pageOverride = options?.pageOverrides?.[surface.id];

    return {
      id: createGeneratedSurfacePageId(sectionId, surface.id),
      title: pageOverride?.title ?? surface.title,
      navLabel: pageOverride?.navLabel ?? surface.navLabel ?? surface.title,
      description: pageOverride?.description ?? surface.description,
      content:
        options?.contentOverrides?.[surface.id] ?? createSurfaceDocumentationContent(app, surface),
      sectionId,
      hiddenInShellNavigation: true,
    };
  });
}

function buildGeneratedSurfaceItems(
  sectionId: string,
  app: AppDefinition,
  options?: {
    excludeSurfaceIds?: string[];
  },
): DocumentationNavItem[] {
  const visibleSurfaces = getVisibleSurfaces(app, options);
  const groups = new Map<
    string,
    {
      id: string;
      title: string;
      description?: string;
      order: number;
      firstIndex: number;
      items: DocumentationNavPageItem[];
    }
  >();
  const ungroupedItems: DocumentationNavPageItem[] = [];

  visibleSurfaces.forEach((surface, index) => {
    const pageItem = {
      type: "page" as const,
      pageId: createGeneratedSurfacePageId(sectionId, surface.id),
    };

    if (!surface.navigationSection) {
      ungroupedItems.push(pageItem);
      return;
    }

    const existing = groups.get(surface.navigationSection.id);

    if (existing) {
      existing.items.push(pageItem);
      existing.order = Math.min(existing.order, surface.navigationSection.order ?? index);
      existing.firstIndex = Math.min(existing.firstIndex, index);
      return;
    }

    groups.set(surface.navigationSection.id, {
      id: `${sectionId}--${surface.navigationSection.id}`,
      title: surface.navigationSection.label,
      description: surface.navigationSection.description,
      order: surface.navigationSection.order ?? index,
      firstIndex: index,
      items: [pageItem],
    });
  });

  const orderedGroups = Array.from(groups.values())
    .sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order;
      }

      return left.firstIndex - right.firstIndex;
    })
    .map<DocumentationNavGroupItem>((group) => ({
      type: "group",
      id: group.id,
      title: group.title,
      description: group.description,
      items: group.items,
    }));

  return [...ungroupedItems, ...orderedGroups];
}

const staticPages: DocumentationPageContent[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    navLabel: "Getting Started",
    description: "Start here for the product model and the first path through Command Center.",
    content: gettingStartedContent,
    sectionId: "getting-started",
  },
  {
    id: "workspaces",
    title: "Workspaces",
    navLabel: "Workspaces",
    description: "Build and manage general-purpose workspace canvases.",
    content: workspacesContent,
    sectionId: "workspaces",
  },
  {
    id: "widgets",
    title: "Widgets",
    navLabel: "Widgets",
    description: "Use widget catalogs and saved widgets as part of workspace authoring.",
    content: widgetsContent,
    sectionId: "workspaces",
    hiddenInShellNavigation: true,
  },
  {
    id: "slide-studio",
    title: "Slide Studio",
    navLabel: "Slide Studio",
    description: "Create presentation decks on top of the shared workspace model.",
    content: slideStudioContent,
    sectionId: "workspaces",
    hiddenInShellNavigation: true,
  },
  {
    id: "foundry",
    title: "Foundry",
    navLabel: "Foundry",
    description: "Overview of the Foundry application and its main operational areas.",
    content: mainSequenceFoundryContent,
    sectionId: "foundry",
  },
  {
    id: "markets",
    title: "Markets",
    navLabel: "Markets",
    description: "Overview of the Markets application and its major functional areas.",
    content: mainSequenceMarketsContent,
    sectionId: "markets",
  },
  {
    id: "main-sequence-ai",
    title: "Main Sequence AI",
    navLabel: "Main Sequence AI",
    description: "Overview of the AI application and its assistant-driven workflows.",
    content: mainSequenceAiContent,
    sectionId: "main-sequence-ai",
  },
  {
    id: "agents-monitor",
    title: "Agents Monitor",
    navLabel: "Agents Monitor",
    description: "Run session-driven AI monitor workspaces inside Main Sequence AI.",
    content: agentsMonitorContent,
    sectionId: "main-sequence-ai",
    hiddenInShellNavigation: true,
  },
  {
    id: "organization-admin",
    title: "Organization Admin",
    navLabel: "Organization Admin",
    description: "Overview of organization-scoped administration and access governance.",
    content: organizationAdminContent,
    sectionId: "organization-admin",
  },
  {
    id: "rbac",
    title: "RBAC",
    navLabel: "RBAC",
    description: "Understand platform permissions and Main Sequence object-level access.",
    content: rbacContent,
    sectionId: "organization-admin",
    hiddenInShellNavigation: true,
  },
  {
    id: "organization-admin-tbd",
    title: "TBD",
    navLabel: "TBD",
    description: "Detailed Organization Admin usage pages are still being defined.",
    content: organizationAdminTbdContent,
    sectionId: "organization-admin",
    hiddenInShellNavigation: true,
  },
];

const foundrySurfacePages = createGeneratedSurfacePages("foundry", mainSequenceWorkbenchApp);
const marketsSurfacePages = createGeneratedSurfacePages("markets", mainSequenceMarketsApp);
const aiSurfacePages = createGeneratedSurfacePages("main-sequence-ai", mainSequenceAiApp, {
  excludeSurfaceIds: ["monitor"],
  contentOverrides: {
    chat: communicationContent,
    "project-agents": projectAgentsContent,
  },
  pageOverrides: {
    chat: {
      title: "Communication",
      navLabel: "Communication",
      description: "Ways to communicate with agents across the Main Sequence platform.",
    },
  },
});

export const documentationPages = [
  ...staticPages,
  ...foundrySurfacePages,
  ...marketsSurfacePages,
  ...aiSurfacePages,
] satisfies DocumentationPageContent[];

export const documentationPageMap: ReadonlyMap<string, DocumentationPageContent> = new Map(
  documentationPages.map((page) => [page.id, page]),
);

export const documentationPageAliases: ReadonlyMap<string, string> = new Map([
  ["main-sequence-foundry", "foundry"],
  ["main-sequence-markets", "markets"],
  ["organization-admin-overview", "organization-admin"],
]);

export const documentationNavSections: readonly DocumentationNavSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Product model and the first path through the platform.",
    order: 10,
    landingPageId: "getting-started",
    items: [{ type: "page", pageId: "getting-started" }],
  },
  {
    id: "workspaces",
    title: "Workspaces",
    description: "Workspace authoring, reusable widgets, and slide-based presentation workflows.",
    order: 20,
    landingPageId: "workspaces",
    items: [
      { type: "page", pageId: "workspaces" },
      { type: "page", pageId: "widgets" },
      { type: "page", pageId: "slide-studio" },
    ],
  },
  {
    id: "foundry",
    title: "Foundry",
    description: "Main Sequence backend resource operations and project-centric workflows.",
    order: 30,
    landingPageId: "foundry",
    items: [
      { type: "page", pageId: "foundry" },
      ...buildGeneratedSurfaceItems("foundry", mainSequenceWorkbenchApp),
    ],
  },
  {
    id: "markets",
    title: "Markets",
    description: "Market-facing registries, asset workflows, and portfolio structures.",
    order: 40,
    landingPageId: "markets",
    items: [
      { type: "page", pageId: "markets" },
      ...buildGeneratedSurfaceItems("markets", mainSequenceMarketsApp),
    ],
  },
  {
    id: "main-sequence-ai",
    title: "Main Sequence AI",
    description: "Assistant, agent, and session-owned AI workflows.",
    order: 50,
    landingPageId: "main-sequence-ai",
    items: [
      { type: "page", pageId: "main-sequence-ai" },
      ...buildGeneratedSurfaceItems("main-sequence-ai", mainSequenceAiApp, {
        excludeSurfaceIds: ["monitor"],
      }),
      { type: "page", pageId: "agents-monitor" },
    ],
  },
  {
    id: "organization-admin",
    title: "Organization Admin",
    description: "Organization-scoped billing, user, widget, and governance administration.",
    order: 60,
    landingPageId: "organization-admin",
    items: [
      { type: "page", pageId: "organization-admin" },
      { type: "page", pageId: "rbac" },
      { type: "page", pageId: "organization-admin-tbd" },
    ],
  },
] as const;

function flattenDocumentationNavItems(items: readonly DocumentationNavItem[]): string[] {
  return items.flatMap((item) =>
    item.type === "page" ? [item.pageId] : flattenDocumentationNavItems(item.items),
  );
}

export const documentationPageOrder = documentationNavSections.flatMap((section) =>
  flattenDocumentationNavItems(section.items),
);

export const documentationShellPageIds = documentationPages
  .filter((page) => !page.hiddenInShellNavigation)
  .map((page) => page.id);

export function getDocumentationNavSection(sectionId: string) {
  return documentationNavSections.find((section) => section.id === sectionId) ?? null;
}

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

export const documentationSourceApps = {
  workspaces: workspaceStudioApp.id,
  foundry: mainSequenceWorkbenchApp.id,
  markets: mainSequenceMarketsApp.id,
  "main-sequence-ai": mainSequenceAiApp.id,
  "organization-admin": adminApp.id,
} as const;
