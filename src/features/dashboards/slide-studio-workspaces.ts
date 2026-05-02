import { getAppPath } from "@/apps/utils";
import type { DashboardDefinition, DashboardDefinitionType } from "@/dashboards/types";
import { appendCatalogWidget, createBlankDashboard } from "./custom-dashboard-storage";
import type { WorkspaceStudioSurfaceConfig } from "./workspace-studio-surface-config";
import { normalizeDashboardDefinitionType } from "./workspace-definition-type";
import { workspaceSlideWidget } from "@/widgets/core/workspace-slide/definition";

export const SLIDE_STUDIO_WORKSPACE_TYPE: DashboardDefinitionType = "slide-studio";
export const SLIDE_STUDIO_SURFACE_PATH = getAppPath("workspace-studio", "slide-studio");

export function getSlideStudioWorkspacePath(workspaceId: string, view?: "graph" | "settings") {
  const params = new URLSearchParams({
    workspace: workspaceId,
  });

  if (view) {
    params.set("view", view);
  }

  return `${SLIDE_STUDIO_SURFACE_PATH}?${params.toString()}`;
}

export function isSlideStudioWorkspace(workspace: {
  type?: DashboardDefinitionType;
  labels?: string[] | undefined;
}) {
  return normalizeDashboardDefinitionType(workspace.type, workspace.labels) === SLIDE_STUDIO_WORKSPACE_TYPE;
}

export function createSlideStudioWorkspaceDefinition({
  title,
}: {
  title?: string;
} = {}) {
  let dashboard = createBlankDashboard(title?.trim() || "Slide Deck");

  dashboard = {
    ...dashboard,
    type: SLIDE_STUDIO_WORKSPACE_TYPE,
    description: "Presentation-oriented workspace for slide deck authoring.",
  };

  return appendCatalogWidget(dashboard, workspaceSlideWidget);
}

export const slideStudioWorkspaceStudioConfig: WorkspaceStudioSurfaceConfig = {
  deniedWidgetIds: [],
  catalogTitle: "Slide Components",
  catalogDescription:
    "Build slide decks with Slide plus normal workspace widgets inside a curated presentation surface.",
  createWorkspaceDefinition: (defaultTitle) =>
    createSlideStudioWorkspaceDefinition({
      title: defaultTitle,
    }),
  createWorkspaceLabel: "New slide deck",
  workspaceCountLabel: "slide decks",
  workspaceFilter: isSlideStudioWorkspace,
  workspacePageDescription:
    "Open slide-studio workspaces and build presentation decks on top of the shared workspace canvas.",
  workspacePageTitle: "Slide Studio",
  workspaceTypes: [SLIDE_STUDIO_WORKSPACE_TYPE],
  workspaceListPath: SLIDE_STUDIO_SURFACE_PATH,
};
