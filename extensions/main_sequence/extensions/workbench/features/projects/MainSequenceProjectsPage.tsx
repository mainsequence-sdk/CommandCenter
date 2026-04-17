import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Database,
  FolderKanban,
  GitBranch,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  bulkDeleteProjects,
  createProject,
  type EntitySummaryHeader,
  fetchProjectSummary,
  fetchProjectFormOptions,
  formatMainSequenceError,
  listProjects,
  mainSequenceRegistryPageSize,
  type ProjectSummary,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceProjectCodeTab } from "./MainSequenceProjectCodeTab";
import { MainSequenceProjectDataNodeUpdatesTab } from "./MainSequenceProjectDataNodeUpdatesTab";
import { MainSequenceProjectInfraGraphTab } from "./MainSequenceProjectInfraGraphTab";
import { MainSequenceProjectImagesTab } from "./MainSequenceProjectImagesTab";
import { MainSequenceProjectJobsTab } from "./MainSequenceProjectJobsTab";
import { MainSequenceProjectResourceReleasesTab } from "./MainSequenceProjectResourceReleasesTab";
import { MainSequenceProjectSettingsTab } from "./MainSequenceProjectSettingsTab";
import { MainSequencePermissionsTab } from "../../../../common/components/MainSequencePermissionsTab";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { PickerField, type PickerOption } from "../../../../common/components/PickerField";
import { MainSequenceSelectionCheckbox } from "../../../../common/components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import { useRegistrySelection } from "../../../../common/hooks/useRegistrySelection";

const defaultFormState = {
  projectName: "",
  repositoryBranch: "main",
  dataSourceId: "",
  defaultBaseImageId: "",
  githubOrgId: "",
};

const mainSequenceProjectIdParam = "msProjectId";
const legacyProjectIdParam = "projectId";
const mainSequenceTabParam = "msTab";
const legacyTabParam = "tab";
const mainSequenceJobIdParam = "msJobId";
const mainSequenceJobRunIdParam = "msJobRunId";
const mainSequenceResourceReleaseIdParam = "msResourceReleaseId";
const mainSequenceLocalUpdateIdParam = "msLocalUpdateId";
const mainSequenceLocalUpdateTabParam = "msLocalUpdateTab";

type ProjectDeleteRequest = {
  projects: ProjectSummary[];
  deleteRepositories: boolean;
};

const projectDetailTabs = [
  {
    id: "code",
    label: "Code",
    title: "Code",
    body: "Coming soon.",
  },
  {
    id: "infra-graph",
    label: "Infra Graph",
    title: "Infra Graph",
    body: "Coming soon.",
  },
  {
    id: "jobs",
    label: "Jobs",
    title: "Jobs",
    body: "Coming soon.",
  },
  {
    id: "images",
    label: "Images",
    title: "Images",
    body: "Coming soon.",
  },
  {
    id: "resource-releases",
    label: "Resource Releases",
    title: "Resource Releases",
    body: "Coming soon.",
  },
  {
    id: "data-node-updates",
    label: "Data Nodes Updates",
    title: "Data Nodes Updates",
    body: "Coming soon.",
  },
  {
    id: "settings",
    label: "Settings",
    title: "Settings",
    body: "Coming soon.",
  },
  {
    id: "permissions",
    label: "Permissions",
    title: "Permissions",
    body: "Coming soon.",
  },
] as const;

const defaultProjectDetailTabId = "code";

function toOptionalNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function projectDataSourceLabel(project: ProjectSummary) {
  if (!project.data_source?.related_resource) {
    return "No data source";
  }

  return (
    project.data_source.related_resource.display_name?.trim() ||
    project.data_source.related_resource.name?.trim() ||
    "No data source"
  );
}

function projectStatusLabel(project: { is_initialized: boolean }) {
  return project.is_initialized ? "Initialized" : "Initializing";
}

function hasUninitializedProjects(projects: ProjectSummary[] | undefined) {
  return (projects ?? []).some((project) => !project.is_initialized);
}

function truncateMiddle(value: string, maxLength = 56) {
  if (value.length <= maxLength) {
    return value;
  }

  const head = value.slice(0, Math.ceil(maxLength / 2) - 2);
  const tail = value.slice(-Math.floor(maxLength / 2) + 1);
  return `${head}...${tail}`;
}

function getProjectIdFromSummaryHref(href?: string) {
  if (!href) {
    return null;
  }

  try {
    const url = new URL(href, "https://mainsequence.local");
    const rawProjectId = url.searchParams.get("project_id") ?? url.searchParams.get("projectId");
    const projectId = Number(rawProjectId ?? "");

    return Number.isFinite(projectId) && projectId > 0 ? projectId : null;
  } catch {
    return null;
  }
}

function buildFallbackProjectSummary(project: ProjectSummary): EntitySummaryHeader {
  return {
    entity: {
      id: project.id,
      type: "project",
      title: project.project_name,
    },
    badges: [
      {
        key: "status",
        label: projectStatusLabel(project),
        tone: project.is_initialized ? "success" : "warning",
      },
    ],
    inline_fields: [
      {
        key: "created_by",
        label: "By",
        value: project.created_by || "Unknown",
        kind: "text",
      },
      {
        key: "data_source",
        label: "Data source",
        value: projectDataSourceLabel(project),
        kind: "text",
      },
      {
        key: "repository",
        label: "Repo",
        value: project.git_ssh_url ?? "Not available yet",
        kind: "code",
      },
    ],
    highlight_fields: [],
    stats: [],
  };
}

export function MainSequenceProjectsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [formState, setFormState] = useState(defaultFormState);
  const [filterValue, setFilterValue] = useState("");
  const [projectsPageIndex, setProjectsPageIndex] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [projectDeleteRequest, setProjectDeleteRequest] = useState<ProjectDeleteRequest | null>(null);
  const deferredFilterValue = useDeferredValue(filterValue);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedProjectId = Number(
    searchParams.get(mainSequenceProjectIdParam) ?? searchParams.get(legacyProjectIdParam) ?? "",
  );
  const selectedJobId = Number(searchParams.get(mainSequenceJobIdParam) ?? "");
  const selectedJobRunId = Number(searchParams.get(mainSequenceJobRunIdParam) ?? "");
  const selectedResourceReleaseId = Number(
    searchParams.get(mainSequenceResourceReleaseIdParam) ?? "",
  );
  const selectedLocalUpdateId = Number(searchParams.get(mainSequenceLocalUpdateIdParam) ?? "");
  const selectedLocalUpdateTabId = searchParams.get(mainSequenceLocalUpdateTabParam);
  const activeTabId =
    searchParams.get(mainSequenceTabParam) ??
    searchParams.get(legacyTabParam) ??
    defaultProjectDetailTabId;
  const isProjectDetailOpen = Number.isFinite(selectedProjectId) && selectedProjectId > 0;
  const isJobDetailOpen = Number.isFinite(selectedJobId) && selectedJobId > 0;
  const isJobRunDetailOpen = Number.isFinite(selectedJobRunId) && selectedJobRunId > 0;
  const isResourceReleaseDetailOpen =
    Number.isFinite(selectedResourceReleaseId) && selectedResourceReleaseId > 0;
  const isLocalUpdateDetailOpen =
    Number.isFinite(selectedLocalUpdateId) && selectedLocalUpdateId > 0;
  const activeTab =
    projectDetailTabs.find((tab) => tab.id === (isLocalUpdateDetailOpen ? "data-node-updates" : activeTabId)) ??
    projectDetailTabs.find((tab) => tab.id === defaultProjectDetailTabId) ??
    projectDetailTabs[0];

  const projectsQuery = useQuery({
    queryKey: ["main_sequence", "projects", "list", projectsPageIndex],
    queryFn: () =>
      listProjects({
        limit: mainSequenceRegistryPageSize,
        offset: projectsPageIndex * mainSequenceRegistryPageSize,
      }),
    refetchInterval: (query) =>
      hasUninitializedProjects(query.state.data?.results) ? 60_000 : false,
    refetchIntervalInBackground: true,
  });

  const projectSummaryQuery = useQuery({
    queryKey: ["main_sequence", "projects", "summary", selectedProjectId],
    queryFn: () => fetchProjectSummary(selectedProjectId),
    enabled: isProjectDetailOpen,
  });

  const formOptionsQuery = useQuery({
    queryKey: ["main_sequence", "projects", "form-options"],
    queryFn: fetchProjectFormOptions,
    enabled: createDialogOpen,
    staleTime: 300_000,
  });

  useEffect(() => {
    if (!createDialogOpen) {
      return;
    }

    const firstDataSourceId = formOptionsQuery.data?.dataSources?.[0]?.id;
    const firstBaseImageId = formOptionsQuery.data?.projectBaseImages?.[0]?.id;

    if (!firstDataSourceId && !firstBaseImageId) {
      return;
    }

    setFormState((current) => {
      const nextDataSourceId =
        current.dataSourceId || (firstDataSourceId ? String(firstDataSourceId) : "");
      const nextDefaultBaseImageId =
        current.defaultBaseImageId || (firstBaseImageId ? String(firstBaseImageId) : "");

      if (
        nextDataSourceId === current.dataSourceId &&
        nextDefaultBaseImageId === current.defaultBaseImageId
      ) {
        return current;
      }

      return {
        ...current,
        dataSourceId: nextDataSourceId,
        defaultBaseImageId: nextDefaultBaseImageId,
      };
    });
  }, [
    createDialogOpen,
    formOptionsQuery.data?.dataSources,
    formOptionsQuery.data?.projectBaseImages,
  ]);

  const createProjectMutation = useMutation({
    mutationFn: createProject,
    onSuccess: async () => {
      setFormState(defaultFormState);
      setCreateDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["main_sequence", "projects", "list"] });
    },
  });

  useEffect(() => {
    setProjectsPageIndex(0);
  }, [deferredFilterValue]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil((projectsQuery.data?.count ?? 0) / mainSequenceRegistryPageSize),
    );

    if (projectsPageIndex > totalPages - 1) {
      setProjectsPageIndex(totalPages - 1);
    }
  }, [projectsPageIndex, projectsQuery.data?.count]);

  const filteredProjects = useMemo(() => {
    const needle = deferredFilterValue.trim().toLowerCase();

    return (projectsQuery.data?.results ?? []).filter((project) => {
      if (!needle) {
        return true;
      }

      return [
        project.project_name,
        String(project.id),
        project.git_ssh_url ?? "",
        projectDataSourceLabel(project),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [deferredFilterValue, projectsQuery.data?.results]);
  const projectSelection = useRegistrySelection(filteredProjects);
  const deleteProjectMutation = useMutation({
    mutationFn: async ({ deleteRepositories, projects }: ProjectDeleteRequest) =>
      bulkDeleteProjects(
        projects.map((project) => project.id),
        { deleteRepositories },
      ),
    onSuccess: async (result, request) => {
      const deletedCount = result.deleted_count ?? request.projects.length;
      setProjectDeleteRequest(null);
      await queryClient.invalidateQueries({ queryKey: ["main_sequence", "projects", "list"] });

      if (deletedCount > 0) {
        toast({
          variant: "success",
          title: deletedCount === 1 ? "Project deleted" : "Projects deleted",
          description: request.deleteRepositories
            ? deletedCount === 1
              ? "The project and its repositories were deleted."
              : `${deletedCount} projects and their repositories were deleted.`
            : deletedCount === 1
              ? "The project was deleted."
              : `${deletedCount} projects were deleted.`,
        });
      }

      projectSelection.clearSelection();
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Project deletion failed",
        description: formatMainSequenceError(error),
      });
    },
  });
  const projectBulkActions =
    projectSelection.selectedCount > 0
      ? [
          {
            id: "delete-projects",
            label: "Delete Projects",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () => {
              deleteProjectMutation.reset();
              setProjectDeleteRequest({
                projects: projectSelection.selectedItems,
                deleteRepositories: false,
              });
            },
          },
          {
            id: "delete-projects-with-repositories",
            label: "Delete Projects with Repositories",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () => {
              deleteProjectMutation.reset();
              setProjectDeleteRequest({
                projects: projectSelection.selectedItems,
                deleteRepositories: true,
              });
            },
          },
        ]
      : [];
  const selectedProjectSummary = (projectsQuery.data?.results ?? []).find(
    (project) => project.id === selectedProjectId,
  );
  const projectHeader = projectSummaryQuery.data ?? (selectedProjectSummary
    ? buildFallbackProjectSummary(selectedProjectSummary)
    : null);
  const projectTitle =
    projectHeader?.entity.title ??
    selectedProjectSummary?.project_name ??
    (selectedProjectId > 0 ? `Project ${selectedProjectId}` : "Project");

  const dataSourceOptions: PickerOption[] = [
    {
      value: "",
      label: "Choose a data source",
      description: "Select a data source.",
    },
    ...((formOptionsQuery.data?.dataSources ?? []).map((option) => ({
      value: String(option.id),
      label: option.related_resource?.display_name ?? `Data source ${option.id}`,
      description: option.related_resource
        ? `${option.related_resource_class_type} · ${option.related_resource.status}`
        : option.related_resource_class_type,
      keywords: [
        option.related_resource?.display_name ?? "",
        option.related_resource_class_type,
        option.related_resource?.status ?? "",
      ],
    })) satisfies PickerOption[]),
  ];

  const projectBaseImageOptions: PickerOption[] = [
    {
      value: "",
      label: "Optional",
      description: "Use the standard image.",
    },
    ...((formOptionsQuery.data?.projectBaseImages ?? []).map((option) => ({
      value: String(option.id),
      label: option.title,
      description: option.description || option.latest_digest,
      keywords: [option.title, option.description, option.latest_digest],
    })) satisfies PickerOption[]),
  ];

  const githubOrganizationOptions: PickerOption[] = [
    {
      value: "",
      label: "Optional",
      description: "Use the default organization.",
    },
    ...((formOptionsQuery.data?.githubOrganizations ?? []).map((option) => ({
      value: String(option.id),
      label: option.display_name || option.login,
      description: option.display_name && option.display_name !== option.login ? option.login : "",
      keywords: [option.display_name, option.login],
    })) satisfies PickerOption[]),
  ];

  const handleCreateProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createProjectMutation.reset();

    await createProjectMutation.mutateAsync({
      project_name: formState.projectName.trim(),
      repository_branch: formState.repositoryBranch.trim() || "main",
      data_source_id: toOptionalNumber(formState.dataSourceId),
      default_base_image_id: toOptionalNumber(formState.defaultBaseImageId),
      github_org_id: toOptionalNumber(formState.githubOrgId),
    });
  };

  function navigateWithProjectSearch(
    update: (searchParams: URLSearchParams) => void,
  ) {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);
    const nextSearch = nextParams.toString();

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: false },
    );
  }

  function openProjectDetail(projectId: number) {
    navigateWithProjectSearch((nextParams) => {
      nextParams.delete(legacyProjectIdParam);
      nextParams.delete(legacyTabParam);
      nextParams.delete(mainSequenceJobIdParam);
      nextParams.delete(mainSequenceJobRunIdParam);
      nextParams.delete(mainSequenceResourceReleaseIdParam);
      nextParams.delete(mainSequenceLocalUpdateIdParam);
      nextParams.delete(mainSequenceLocalUpdateTabParam);
      nextParams.set(mainSequenceProjectIdParam, String(projectId));
      nextParams.set(mainSequenceTabParam, defaultProjectDetailTabId);
    });
  }

  function closeProjectDetail() {
    navigateWithProjectSearch((nextParams) => {
      nextParams.delete(mainSequenceProjectIdParam);
      nextParams.delete(mainSequenceTabParam);
      nextParams.delete(mainSequenceJobIdParam);
      nextParams.delete(mainSequenceJobRunIdParam);
      nextParams.delete(mainSequenceResourceReleaseIdParam);
      nextParams.delete(mainSequenceLocalUpdateIdParam);
      nextParams.delete(mainSequenceLocalUpdateTabParam);
      nextParams.delete(legacyProjectIdParam);
      nextParams.delete(legacyTabParam);
    });
  }

  function selectProjectDetailTab(tabId: (typeof projectDetailTabs)[number]["id"]) {
    navigateWithProjectSearch((nextParams) => {
      nextParams.delete(legacyProjectIdParam);
      nextParams.delete(legacyTabParam);
      nextParams.set(mainSequenceProjectIdParam, String(selectedProjectId));
      nextParams.set(mainSequenceTabParam, tabId);

      if (tabId !== "jobs") {
        nextParams.delete(mainSequenceJobIdParam);
        nextParams.delete(mainSequenceJobRunIdParam);
      }

      if (tabId !== "resource-releases") {
        nextParams.delete(mainSequenceResourceReleaseIdParam);
      }

      if (tabId !== "data-node-updates") {
        nextParams.delete(mainSequenceLocalUpdateIdParam);
        nextParams.delete(mainSequenceLocalUpdateTabParam);
      }
    });
  }

  function openJobDetail(jobId: number) {
    navigateWithProjectSearch((nextParams) => {
      nextParams.delete(legacyProjectIdParam);
      nextParams.delete(legacyTabParam);
      nextParams.set(mainSequenceProjectIdParam, String(selectedProjectId));
      nextParams.set(mainSequenceTabParam, "jobs");
      nextParams.set(mainSequenceJobIdParam, String(jobId));
      nextParams.delete(mainSequenceJobRunIdParam);
      nextParams.delete(mainSequenceResourceReleaseIdParam);
      nextParams.delete(mainSequenceLocalUpdateIdParam);
      nextParams.delete(mainSequenceLocalUpdateTabParam);
    });
  }

  function closeJobDetail() {
    navigateWithProjectSearch((nextParams) => {
      nextParams.delete(mainSequenceJobIdParam);
      nextParams.delete(mainSequenceJobRunIdParam);
    });
  }

  function openJobRunDetail(jobRunId: number) {
    navigateWithProjectSearch((nextParams) => {
      nextParams.delete(legacyProjectIdParam);
      nextParams.delete(legacyTabParam);
      nextParams.set(mainSequenceProjectIdParam, String(selectedProjectId));
      nextParams.set(mainSequenceTabParam, "jobs");
      nextParams.set(mainSequenceJobIdParam, String(selectedJobId));
      nextParams.set(mainSequenceJobRunIdParam, String(jobRunId));
      nextParams.delete(mainSequenceResourceReleaseIdParam);
      nextParams.delete(mainSequenceLocalUpdateIdParam);
      nextParams.delete(mainSequenceLocalUpdateTabParam);
    });
  }

  function closeJobRunDetail() {
    navigateWithProjectSearch((nextParams) => {
      nextParams.delete(mainSequenceJobRunIdParam);
    });
  }

  function openResourceReleaseDetail(resourceReleaseId: number) {
    navigateWithProjectSearch((nextParams) => {
      nextParams.delete(legacyProjectIdParam);
      nextParams.delete(legacyTabParam);
      nextParams.set(mainSequenceProjectIdParam, String(selectedProjectId));
      nextParams.set(mainSequenceTabParam, "resource-releases");
      nextParams.delete(mainSequenceJobIdParam);
      nextParams.delete(mainSequenceJobRunIdParam);
      nextParams.set(mainSequenceResourceReleaseIdParam, String(resourceReleaseId));
      nextParams.delete(mainSequenceLocalUpdateIdParam);
      nextParams.delete(mainSequenceLocalUpdateTabParam);
    });
  }

  function closeResourceReleaseDetail() {
    navigateWithProjectSearch((nextParams) => {
      nextParams.delete(mainSequenceResourceReleaseIdParam);
    });
  }

  function openProjectLocalUpdateDetail(localUpdateId: number) {
    navigateWithProjectSearch((nextParams) => {
      nextParams.delete(legacyProjectIdParam);
      nextParams.delete(legacyTabParam);
      nextParams.set(mainSequenceProjectIdParam, String(selectedProjectId));
      nextParams.set(mainSequenceTabParam, "data-node-updates");
      nextParams.delete(mainSequenceJobIdParam);
      nextParams.delete(mainSequenceJobRunIdParam);
      nextParams.delete(mainSequenceResourceReleaseIdParam);
      nextParams.set(mainSequenceLocalUpdateIdParam, String(localUpdateId));
      nextParams.delete(mainSequenceLocalUpdateTabParam);
    });
  }

  function closeProjectLocalUpdateDetail() {
    navigateWithProjectSearch((nextParams) => {
      nextParams.delete(mainSequenceLocalUpdateIdParam);
      nextParams.delete(mainSequenceLocalUpdateTabParam);
    });
  }

  function selectProjectLocalUpdateTab(tabId: string) {
    navigateWithProjectSearch((nextParams) => {
      nextParams.set(mainSequenceLocalUpdateTabParam, tabId);
    });
  }

  function openDataNodeDetailFromProject(dataNodeId: number) {
    const nextParams = new URLSearchParams();
    nextParams.set("msDataNodeId", String(dataNodeId));
    nextParams.set("msDataNodeTab", "details");
    navigate(`/app/main_sequence_workbench/data-nodes?${nextParams.toString()}`);
  }

  return (
    <div className="space-y-6">
      {isProjectDetailOpen ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <button
                type="button"
                className="transition-colors hover:text-foreground"
                onClick={closeProjectDetail}
              >
                Projects
              </button>
              <span>/</span>
              <span className="text-foreground">{projectTitle}</span>
            </div>
            <Button variant="outline" size="sm" onClick={closeProjectDetail}>
                <ArrowLeft className="h-4 w-4" />
                Back to projects
            </Button>
          </div>

          {projectSummaryQuery.isLoading && !projectHeader ? (
            <Card>
              <CardContent className="flex min-h-64 items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading project details
                </div>
              </CardContent>
            </Card>
          ) : null}

          {projectSummaryQuery.isError ? (
            <Card>
              <CardContent className="p-5">
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatMainSequenceError(projectSummaryQuery.error)}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {projectHeader ? (
            <>
              <MainSequenceEntitySummaryCard
                summary={projectHeader}
                onFieldLinkClick={(field) => {
                  const linkedProjectId = getProjectIdFromSummaryHref(field.href);

                  if (linkedProjectId) {
                    openProjectDetail(linkedProjectId);
                  }
                }}
                onSummaryUpdated={async () => {
                  await queryClient.invalidateQueries({
                    queryKey: ["main_sequence", "projects", "summary", selectedProjectId],
                  });
                  await queryClient.invalidateQueries({
                    queryKey: ["main_sequence", "projects", "list"],
                  });
                }}
              />

              <Card>
                <CardHeader className="border-b border-border/70 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {projectDetailTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={
                          tab.id === activeTab.id
                            ? "rounded-[calc(var(--radius)-8px)] border border-primary/35 bg-primary/12 px-3 py-2 text-sm font-medium text-topbar-foreground"
                            : "rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/36 hover:text-foreground"
                        }
                        onClick={() => selectProjectDetailTab(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="pt-5">
                  {activeTab.id === "code" && selectedProjectId > 0 ? (
                    <MainSequenceProjectCodeTab
                      projectId={selectedProjectId}
                      onJobCreated={() => selectProjectDetailTab("jobs")}
                    />
                  ) : activeTab.id === "infra-graph" && selectedProjectId > 0 ? (
                    <MainSequenceProjectInfraGraphTab projectId={selectedProjectId} />
                  ) : activeTab.id === "jobs" && selectedProjectId > 0 ? (
                    <MainSequenceProjectJobsTab
                      onCloseJobDetail={closeJobDetail}
                      onCloseJobRunDetail={closeJobRunDetail}
                      onOpenProjectDetail={openProjectDetail}
                      onOpenJobDetail={openJobDetail}
                      onOpenJobRunDetail={openJobRunDetail}
                      projectId={selectedProjectId}
                      projectTitle={projectTitle}
                      selectedJobId={isJobDetailOpen ? selectedJobId : null}
                      selectedJobRunId={isJobRunDetailOpen ? selectedJobRunId : null}
                    />
                  ) : activeTab.id === "images" && selectedProjectId > 0 ? (
                    <MainSequenceProjectImagesTab projectId={selectedProjectId} />
                  ) : activeTab.id === "resource-releases" && selectedProjectId > 0 ? (
                    <MainSequenceProjectResourceReleasesTab
                      onCloseResourceReleaseDetail={closeResourceReleaseDetail}
                      onOpenJobDetail={openJobDetail}
                      onOpenProjectDetail={openProjectDetail}
                      onOpenResourceReleaseDetail={openResourceReleaseDetail}
                      projectId={selectedProjectId}
                      selectedResourceReleaseId={
                        isResourceReleaseDetailOpen ? selectedResourceReleaseId : null
                      }
                    />
                  ) : activeTab.id === "data-node-updates" && selectedProjectId > 0 ? (
                    <MainSequenceProjectDataNodeUpdatesTab
                      onCloseLocalUpdateDetail={closeProjectLocalUpdateDetail}
                      onOpenDataNodeDetail={openDataNodeDetailFromProject}
                      onOpenLocalUpdateDetail={openProjectLocalUpdateDetail}
                      onSelectLocalUpdateTab={selectProjectLocalUpdateTab}
                      projectId={selectedProjectId}
                      selectedLocalUpdateId={isLocalUpdateDetailOpen ? selectedLocalUpdateId : null}
                      selectedLocalUpdateTabId={selectedLocalUpdateTabId}
                    />
                  ) : activeTab.id === "settings" && selectedProjectId > 0 ? (
                    <MainSequenceProjectSettingsTab
                      key={selectedProjectId}
                      projectId={selectedProjectId}
                      projectSummary={projectHeader}
                    />
                  ) : activeTab.id === "permissions" && selectedProjectId > 0 ? (
                    <MainSequencePermissionsTab
                      objectUrl="projects"
                      objectId={selectedProjectId}
                      entityLabel="Project"
                      enabled={activeTab.id === "permissions"}
                    />
                  ) : (
                    <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/18 px-5 py-12">
                      <div className="text-sm font-medium text-foreground">{activeTab.title}</div>
                      <p className="mt-2 text-sm text-muted-foreground">{activeTab.body}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </>
      ) : (
        <>
          <PageHeader
            eyebrow="Main Sequence"
            title="Projects"
            description="Create and manage projects."
            actions={
              <>
                <Badge variant="neutral">{`${projectsQuery.data?.count ?? 0} projects`}</Badge>
                <Button
                  onClick={() => {
                    createProjectMutation.reset();
                    setCreateDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Create project
                </Button>
              </>
            }
          />

              <Card>
                <CardHeader className="border-b border-border/70">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <CardTitle>Project registry</CardTitle>
                      <CardDescription>Browse, filter, and manage projects.</CardDescription>
                    </div>
                    <MainSequenceRegistrySearch
                      actionMenuLabel="Project actions"
                      accessory={
                        <Badge variant="neutral">{`${projectsQuery.data?.count ?? 0} projects`}</Badge>
                      }
                      bulkActions={projectBulkActions}
                      clearSelectionLabel="Clear projects"
                      onClearSelection={projectSelection.clearSelection}
                      renderSelectionSummary={(selectionCount) => `${selectionCount} projects selected`}
                      value={filterValue}
                      onChange={(event) => setFilterValue(event.target.value)}
                      placeholder="Filter by name, id, git url, or data source"
                      selectionCount={projectSelection.selectedCount}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {projectsQuery.isLoading ? (
                    <div className="flex min-h-64 items-center justify-center">
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading projects
                      </div>
                    </div>
                  ) : null}

                  {projectsQuery.isError ? (
                    <div className="p-5">
                      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                        {formatMainSequenceError(projectsQuery.error)}
                      </div>
                    </div>
                  ) : null}

                  {!projectsQuery.isLoading && !projectsQuery.isError && filteredProjects.length === 0 ? (
                    <div className="px-5 py-14 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                        <FolderKanban className="h-6 w-6" />
                      </div>
                      <div className="mt-4 text-sm font-medium text-foreground">No projects found</div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Create a project from the header, or clear the current filter.
                      </p>
                    </div>
                  ) : null}

                  {!projectsQuery.isLoading && !projectsQuery.isError && filteredProjects.length > 0 ? (
                    <div className="overflow-x-auto px-4 py-4">
                      <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-sm">
                        <thead>
                          <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                            <th className="w-12 px-3 pb-2">
                              <MainSequenceSelectionCheckbox
                                ariaLabel="Select all visible projects"
                                checked={projectSelection.allSelected}
                                indeterminate={projectSelection.someSelected}
                                onChange={projectSelection.toggleAll}
                              />
                            </th>
                            <th className="px-4 pb-2">Project</th>
                            <th className="px-4 pb-2">Created by</th>
                            <th className="px-4 pb-2">Data source</th>
                            <th className="px-4 pb-2">Git repository</th>
                            <th className="px-4 pb-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredProjects.map((project) => {
                            const selected = projectSelection.isSelected(project.id);

                            return (
                              <tr key={project.id}>
                                <td className={getRegistryTableCellClassName(selected, "left")}>
                                  <MainSequenceSelectionCheckbox
                                    ariaLabel={`Select ${project.project_name}`}
                                    checked={selected}
                                    onChange={() => projectSelection.toggleSelection(project.id)}
                                  />
                                </td>
                                <td className={getRegistryTableCellClassName(selected)}>
                                  <button
                                    type="button"
                                    className="group inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-left outline-none transition-colors hover:text-primary focus-visible:text-primary"
                                    onClick={() => openProjectDetail(project.id)}
                                    title={`Open ${project.project_name}`}
                                  >
                                    <span className="font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors group-hover:decoration-primary group-focus-visible:decoration-primary">
                                      {project.project_name}
                                    </span>
                                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary group-focus-visible:text-primary" />
                                  </button>
                                </td>
                                <td className={getRegistryTableCellClassName(selected)}>
                                  <div className="text-sm text-foreground">{project.created_by || "Unknown"}</div>
                                  <div className="mt-1 text-xs text-muted-foreground">Creator</div>
                                </td>
                                <td className={getRegistryTableCellClassName(selected)}>
                                  <div className="flex items-start gap-2">
                                    <Database className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                    <div>
                                      <div className="text-foreground">{projectDataSourceLabel(project)}</div>
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        {project.data_source?.related_resource_class_type ?? "No linked source"}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className={getRegistryTableCellClassName(selected)}>
                                  <div className="flex items-start gap-2">
                                    <GitBranch className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                    <div
                                      className="font-mono text-xs text-foreground"
                                      title={project.git_ssh_url || "Not available yet"}
                                    >
                                      {project.git_ssh_url
                                        ? truncateMiddle(project.git_ssh_url)
                                        : "Not available yet"}
                                    </div>
                                  </div>
                                </td>
                                <td className={getRegistryTableCellClassName(selected, "right")}>
                                  {project.is_initialized ? (
                                    <Badge variant="success">{projectStatusLabel(project)}</Badge>
                                  ) : (
                                    <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/35 px-3 py-1 text-xs font-medium text-muted-foreground">
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      <span>Initializing</span>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {!projectsQuery.isLoading &&
                  !projectsQuery.isError &&
                  (projectsQuery.data?.count ?? 0) > 0 ? (
                    <MainSequenceRegistryPagination
                      count={projectsQuery.data?.count ?? 0}
                      itemLabel="projects"
                      pageIndex={projectsPageIndex}
                      pageSize={mainSequenceRegistryPageSize}
                      onPageChange={setProjectsPageIndex}
                    />
                  ) : null}
                </CardContent>
              </Card>
        </>
      )}

      <Dialog
        title="Create project"
        open={createDialogOpen}
        onClose={() => {
          if (createProjectMutation.isPending) {
            return;
          }

          createProjectMutation.reset();
          setFormState(defaultFormState);
          setCreateDialogOpen(false);
        }}
        className="max-w-[min(1080px,calc(100vw-24px))]"
      >
        <form className="space-y-6" onSubmit={handleCreateProject}>
          <div className="space-y-5">
            <div className="rounded-[24px] border border-border/70 bg-background/18 p-5">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1.25fr)_minmax(220px,0.75fr)]">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Project name
                  </label>
                  <Input
                    value={formState.projectName}
                    onChange={(event) => {
                      createProjectMutation.reset();
                      setFormState((current) => ({
                        ...current,
                        projectName: event.target.value,
                      }));
                    }}
                    placeholder="Alpha Research"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Repository branch
                  </label>
                  <Input
                    value={formState.repositoryBranch}
                    onChange={(event) => {
                      createProjectMutation.reset();
                      setFormState((current) => ({
                        ...current,
                        repositoryBranch: event.target.value,
                      }));
                    }}
                    placeholder="main"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-background/18 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Data source
                  </label>
                  <PickerField
                    value={formState.dataSourceId}
                    onChange={(value) => {
                      createProjectMutation.reset();
                      setFormState((current) => ({
                        ...current,
                        dataSourceId: value,
                      }));
                    }}
                    options={dataSourceOptions}
                    placeholder="Choose a data source"
                    searchPlaceholder="Search data sources"
                    emptyMessage="No matching data sources."
                    loading={formOptionsQuery.isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Default base image
                  </label>
                  <PickerField
                    value={formState.defaultBaseImageId}
                    onChange={(value) => {
                      createProjectMutation.reset();
                      setFormState((current) => ({
                        ...current,
                        defaultBaseImageId: value,
                      }));
                    }}
                    options={projectBaseImageOptions}
                    placeholder="Optional"
                    searchPlaceholder="Search base images"
                    emptyMessage="No matching base images."
                    loading={formOptionsQuery.isLoading}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    GitHub organization
                  </label>
                  <PickerField
                    value={formState.githubOrgId}
                    onChange={(value) => {
                      createProjectMutation.reset();
                      setFormState((current) => ({
                        ...current,
                        githubOrgId: value,
                      }));
                    }}
                    options={githubOrganizationOptions}
                    placeholder="Optional"
                    searchPlaceholder="Search organizations"
                    emptyMessage="No matching GitHub organizations."
                    loading={formOptionsQuery.isLoading}
                  />
                </div>
              </div>
            </div>

            {formOptionsQuery.isError ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(formOptionsQuery.error)}
              </div>
            ) : null}

            {createProjectMutation.isError ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(createProjectMutation.error)}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-white/8 pt-4">
            <div />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  createProjectMutation.reset();
                  setFormState(defaultFormState);
                  setCreateDialogOpen(false);
                }}
                disabled={createProjectMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                disabled={createProjectMutation.isPending || !formState.projectName.trim()}
                type="submit"
              >
                {createProjectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Create project
              </Button>
            </div>
          </div>
        </form>
      </Dialog>

      <ActionConfirmationDialog
        title={
          projectDeleteRequest?.deleteRepositories
            ? "Delete Projects with Repositories"
            : "Delete Projects"
        }
        open={projectDeleteRequest !== null}
        onClose={() => {
          if (!deleteProjectMutation.isPending) {
            setProjectDeleteRequest(null);
          }
        }}
        tone={projectDeleteRequest?.deleteRepositories ? "danger" : "warning"}
        actionLabel={
          projectDeleteRequest?.deleteRepositories
            ? "delete with repositories"
            : "delete"
        }
        objectLabel={
          (projectDeleteRequest?.projects.length ?? 0) > 1 ? "projects" : "project"
        }
        confirmWord={
          projectDeleteRequest?.deleteRepositories
            ? "DELETE REPOSITORIES"
            : (projectDeleteRequest?.projects.length ?? 0) > 1
              ? "DELETE PROJECTS"
              : "DELETE PROJECT"
        }
        confirmButtonLabel={
          projectDeleteRequest?.deleteRepositories
            ? "Delete Projects with Repositories"
            : "Delete Projects"
        }
        description={
          projectDeleteRequest?.deleteRepositories
            ? "This action removes the selected projects and their linked repositories."
            : "This action removes the selected projects."
        }
        specialText={
          projectDeleteRequest?.deleteRepositories
            ? "Repository deletion is permanent and cannot be undone."
            : "This action cannot be undone."
        }
        objectSummary={
          projectDeleteRequest?.projects.length === 1 ? (
            <>
              <div className="font-medium">{projectDeleteRequest.projects[0]?.project_name}</div>
              <div className="mt-1 text-muted-foreground">
                {projectDeleteRequest.deleteRepositories
                  ? "The project and its repositories will be deleted."
                  : "The project will be deleted."}
              </div>
            </>
          ) : (
            <>
              <div className="font-medium">
                {projectDeleteRequest?.projects.length ?? 0} projects selected
              </div>
              <div className="mt-1 text-muted-foreground">
                {projectDeleteRequest?.projects
                  .slice(0, 3)
                  .map((project) => project.project_name)
                  .join(", ")}
                {(projectDeleteRequest?.projects.length ?? 0) > 3 ? ", ..." : ""}
              </div>
            </>
          )
        }
        error={
          deleteProjectMutation.isError
            ? formatMainSequenceError(deleteProjectMutation.error)
            : undefined
        }
        isPending={deleteProjectMutation.isPending}
        onConfirm={() => {
          if (!projectDeleteRequest || projectDeleteRequest.projects.length === 0) {
            return;
          }

          void deleteProjectMutation.mutateAsync(projectDeleteRequest);
        }}
      />
    </div>
  );
}
