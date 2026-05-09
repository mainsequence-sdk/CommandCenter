import {
  Bot,
  BookOpenText,
  Cable,
  Command,
  Gauge,
  KeyRound,
  LifeBuoy,
  PanelsTopLeft,
  Rows3,
  Puzzle,
  Sparkles,
  LineChart,
} from "lucide-react";

import { defineSurfaceAssistantContext, type AppDefinition } from "@/apps/types";

import { commandCenterDocsAppId, createDocumentationPage } from "./DocumentationPage";
import { documentationPages } from "./content/docsContent";

const pageIcons = {
  "getting-started": Gauge,
  applications: BookOpenText,
  workspaces: PanelsTopLeft,
  "slide-studio": Rows3,
  "agents-monitor": Bot,
  widgets: Puzzle,
  "main-sequence-foundry": Command,
  "main-sequence-markets": LineChart,
  "main-sequence-ai": Sparkles,
  "connections-app": Cable,
  permissions: KeyRound,
  troubleshooting: LifeBuoy,
} as const;

export const commandCenterDocsApp: AppDefinition = {
  id: commandCenterDocsAppId,
  title: "Documentation",
  description: "User-facing Command Center guides and troubleshooting.",
  source: "command_center_docs",
  icon: BookOpenText,
  navigationOrder: 950,
  topNavigationStyle: "hidden",
  defaultSurfaceId: "getting-started",
  surfaces: documentationPages.map((page) => ({
    id: page.id,
    title: page.title,
    navLabel: page.navLabel,
    description: page.description,
    icon: pageIcons[page.id as keyof typeof pageIcons],
    ...defineSurfaceAssistantContext({
      summary: `User is reading the Command Center documentation page: ${page.title}.`,
      availableActions: [
        "Read product documentation",
        "Move between documentation branches",
        "Use the current page to complete the active workflow",
      ],
    }),
    kind: "page" as const,
    component: createDocumentationPage(page.id),
  })),
};
