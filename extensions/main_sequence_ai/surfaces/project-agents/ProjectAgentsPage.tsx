import { useDeferredValue, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import {
  fetchProjectSummary,
  formatMainSequenceError,
  quickSearchProjects,
  type ProjectQuickSearchRecord,
  type ProjectSummaryHeader,
} from "../../../main_sequence/common/api";
import { PickerField, type PickerOption } from "../../../main_sequence/common/components/PickerField";
import { ProjectAgentConfigurator } from "../../features/project-agents/ProjectAgentConfigurator";

const mainSequenceProjectIdParam = "msProjectId";
const projectAgentSearchLimit = 50;

function normalizeSelectedProjectId(rawValue: string | null) {
  const parsed = Number(rawValue ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatProjectLabel(project: Pick<ProjectQuickSearchRecord, "id" | "project_name">) {
  return project.project_name?.trim() || `Project ${project.id}`;
}

function projectHasAgentCapabilities(summary: ProjectSummaryHeader | null | undefined) {
  const summaryRecord = summary as Record<string, unknown> | null | undefined;

  if (typeof summaryRecord?.agent_capabilities === "boolean") {
    return summaryRecord.agent_capabilities;
  }

  if (typeof summary?.extensions?.agent_capabilities === "boolean") {
    return summary.extensions.agent_capabilities;
  }

  return null;
}

function toProjectPickerOption(project: Pick<ProjectQuickSearchRecord, "id" | "project_name" | "repository_branch">): PickerOption {
  return {
    value: String(project.id),
    label: formatProjectLabel(project),
    description: project.repository_branch?.trim()
      ? `Branch: ${project.repository_branch.trim()}`
      : undefined,
    keywords: [String(project.id), project.project_name ?? "", project.repository_branch ?? ""],
  };
}

export function ProjectAgentsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedProjectId = normalizeSelectedProjectId(searchParams.get(mainSequenceProjectIdParam));
  const [projectSearchValue, setProjectSearchValue] = useState("");
  const deferredProjectSearchValue = useDeferredValue(projectSearchValue);
  const normalizedProjectSearchValue = deferredProjectSearchValue.trim();

  const selectedProjectSummaryQuery = useQuery({
    queryKey: ["main_sequence", "projects", "summary", selectedProjectId],
    queryFn: () => fetchProjectSummary(selectedProjectId!),
    enabled: selectedProjectId !== null,
  });
  const projectQuickSearchQuery = useQuery({
    queryKey: ["main_sequence_ai", "project-agents", "project-search", normalizedProjectSearchValue],
    queryFn: () =>
      quickSearchProjects({
        limit: projectAgentSearchLimit,
        q: normalizedProjectSearchValue,
      }),
    enabled: normalizedProjectSearchValue.length >= 3,
    staleTime: 300_000,
  });

  const selectedProjectSummary = selectedProjectSummaryQuery.data ?? null;
  const hasAgentCapabilities = projectHasAgentCapabilities(selectedProjectSummary);
  const selectedProjectRecord = useMemo<Pick<ProjectQuickSearchRecord, "id" | "project_name" | "repository_branch"> | null>(
    () =>
      selectedProjectId !== null && selectedProjectSummary
        ? {
            id: selectedProjectId,
            project_name: selectedProjectSummary.entity.title?.trim() || `Project ${selectedProjectId}`,
            repository_branch: "",
          }
        : null,
    [selectedProjectId, selectedProjectSummary],
  );
  const projectPickerOptions = useMemo(() => {
    const searchResults = normalizedProjectSearchValue.length >= 3 ? (projectQuickSearchQuery.data ?? []) : [];

    if (
      selectedProjectRecord &&
      !searchResults.some((project) => project.id === selectedProjectRecord.id)
    ) {
      return [selectedProjectRecord, ...searchResults];
    }

    return searchResults;
  }, [normalizedProjectSearchValue.length, projectQuickSearchQuery.data, selectedProjectRecord]);
  const pickerOptions = useMemo(
    () => projectPickerOptions.map(toProjectPickerOption),
    [projectPickerOptions],
  );

  function updateProjectSelection(nextProjectId?: number) {
    const nextSearchParams = new URLSearchParams(location.search);

    if (nextProjectId && nextProjectId > 0) {
      nextSearchParams.set(mainSequenceProjectIdParam, String(nextProjectId));
    } else {
      nextSearchParams.delete(mainSequenceProjectIdParam);
    }

    navigate({
      pathname: location.pathname,
      search: nextSearchParams.toString() ? `?${nextSearchParams.toString()}` : "",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence AI"
        title="Project Agents"
        description="Build and deploy project execution agents from one AI-owned workflow."
        actions={
          selectedProjectId !== null && hasAgentCapabilities === true ? (
            <Badge variant="success">Agent capable</Badge>
          ) : null
        }
      />

      <Card className="max-w-6xl">
        <CardHeader>
          <CardTitle>Project selection</CardTitle>
          <CardDescription>
            Select a project first. The project-agent workflow only appears for projects that
            advertise agent capabilities.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Project
            </div>
            <PickerField
              value={selectedProjectId ? String(selectedProjectId) : ""}
              onChange={(nextValue) => {
                const nextProjectId = Number(nextValue);
                updateProjectSelection(Number.isFinite(nextProjectId) && nextProjectId > 0 ? nextProjectId : undefined);
              }}
              options={pickerOptions}
              placeholder="Select a project"
              searchPlaceholder="Search projects"
              emptyMessage={
                normalizedProjectSearchValue.length >= 3
                  ? "No matching projects."
                  : normalizedProjectSearchValue.length > 0
                    ? "Type at least 3 characters."
                    : "Type to search projects."
              }
              searchable
              searchValue={projectSearchValue}
              onSearchValueChange={setProjectSearchValue}
              loading={normalizedProjectSearchValue.length >= 3 && projectQuickSearchQuery.isFetching}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Select the project whose agent runtime you want to configure.</span>
            {normalizedProjectSearchValue.length === 0 ? <span>Type to search.</span> : null}
            {normalizedProjectSearchValue.length > 0 && normalizedProjectSearchValue.length < 3 ? (
              <span>Use at least 3 characters.</span>
            ) : null}
          </div>

          {projectQuickSearchQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(projectQuickSearchQuery.error)}
            </div>
          ) : null}

          {selectedProjectId === null ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/18 px-5 py-10 text-sm text-muted-foreground">
              Select a project to continue.
            </div>
          ) : null}

          {selectedProjectId !== null && selectedProjectSummaryQuery.isLoading ? (
            <div className="flex items-center gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/18 px-5 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading project capability summary
            </div>
          ) : null}

          {selectedProjectId !== null && selectedProjectSummaryQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(selectedProjectSummaryQuery.error)}
            </div>
          ) : null}

          {selectedProjectId !== null &&
          !selectedProjectSummaryQuery.isLoading &&
          !selectedProjectSummaryQuery.isError &&
          hasAgentCapabilities !== true ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/18 px-5 py-10">
              <div className="text-sm font-medium text-foreground">Project agent unavailable</div>
              <p className="mt-2 text-sm text-muted-foreground">
                The selected project does not advertise agent capabilities, so the project-agent
                form stays hidden.
              </p>
            </div>
          ) : null}

          {selectedProjectId !== null && hasAgentCapabilities === true ? (
            <ProjectAgentConfigurator
              projectId={selectedProjectId}
              hasAgentCapabilities={true}
              onOpenImagesTab={() => {
                navigate(
                  `/app/main_sequence_workbench/projects?msProjectId=${selectedProjectId}&msTab=images`,
                );
              }}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
