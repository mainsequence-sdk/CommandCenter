import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import { fetchProjectSummary, formatMainSequenceError } from "../../../../common/api";
import {
  normalizeProjectInfraGraphProjectId,
  type MainSequenceProjectInfraGraphWidgetProps,
} from "./projectInfraGraphRuntime";
import { ProjectQuickSearchPicker } from "./ProjectQuickSearchPicker";

export function MainSequenceProjectInfraGraphWidgetSettings({
  draftProps,
  editable,
  onDraftPropsChange,
}: WidgetSettingsComponentProps<MainSequenceProjectInfraGraphWidgetProps>) {
  const projectId = normalizeProjectInfraGraphProjectId(draftProps.projectId);
  const projectSummaryQuery = useQuery({
    queryKey: [
      "main_sequence",
      "widgets",
      "project_infra_graph",
      "project_summary",
      projectId ?? null,
    ],
    queryFn: () => fetchProjectSummary(projectId ?? 0),
    enabled: Number.isFinite(projectId) && (projectId ?? 0) > 0,
    staleTime: 300_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">Project Infra Graph</Badge>
        <span className="text-sm text-muted-foreground">
          Configure a project-scoped infrastructure graph. The widget lazily fetches node summaries
          and follows backend-provided `graph_url` links for drill-down.
        </span>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-medium text-topbar-foreground">Project</span>
        <ProjectQuickSearchPicker
          value={projectId}
          onChange={(nextProjectId) => {
            onDraftPropsChange({
              ...draftProps,
              projectId: nextProjectId,
            });
          }}
          editable={editable}
          queryScope="project_infra_graph_widget"
          selectedProject={
            projectSummaryQuery.data
              ? {
                  id: projectSummaryQuery.data.entity.id,
                  project_name: projectSummaryQuery.data.entity.title,
                  repository_branch: "",
                }
              : null
          }
          detailError={projectSummaryQuery.error}
          placeholder="Select a project"
          searchPlaceholder="Search projects"
          selectionHelpText="Choose the project whose infrastructure graph you want to inspect."
        />
        <p className="text-sm text-muted-foreground">
          Required. Search by project name or numeric id, then select the project from the backend
          quick-search results.
        </p>
      </label>

      {projectSummaryQuery.isLoading && projectId ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3 text-sm text-muted-foreground">
          Loading project summary
        </div>
      ) : null}

      {projectSummaryQuery.isError && !projectId ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(projectSummaryQuery.error)}
        </div>
      ) : null}

      {projectSummaryQuery.data ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3">
          <div className="text-sm font-medium text-foreground">
            {projectSummaryQuery.data.entity.title}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            The widget will open the infrastructure graph for project {projectSummaryQuery.data.entity.id}.
          </div>
        </div>
      ) : null}
    </div>
  );
}
