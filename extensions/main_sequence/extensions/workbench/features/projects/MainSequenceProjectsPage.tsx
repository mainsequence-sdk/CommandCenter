import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  Database,
  EllipsisVertical,
  FolderKanban,
  GitBranch,
  Loader2,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { AdminMenu } from "@/app/layout/AdminMenu";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";

import {
  bulkDeleteProjects,
  createProject,
  type EntitySummaryHeader,
  fetchProjectExecutorAgentServiceByProject,
  fetchProjectSummary,
  fetchProjectFormOptions,
  formatMainSequenceError,
  listProjects,
  mainSequenceRegistryPageSize,
  type ProjectSummary,
  updateProjectSdk,
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
import { useProjectAgentRailStore } from "../../../../../main_sequence_ai/assistant-ui/project-agent-rail-store";
import { AutomationDitherWaveLayer } from "../../../../../main_sequence_ai/components/AutomationButton";
import { ProjectAgentConfigurator } from "../../../../../main_sequence_ai/features/project-agents/ProjectAgentConfigurator";

const defaultFormState = {
  projectName: "",
  dataSourceUid: "",
  defaultBaseImageUid: "",
  githubOrgId: "",
};

const mainSequenceProjectUidParam = "msProjectUid";
const mainSequenceTabParam = "msTab";
const legacyTabParam = "tab";
const mainSequenceJobUidParam = "msJobUid";
const mainSequenceJobRunUidParam = "msJobRunUid";
const mainSequenceResourceReleaseUidParam = "msResourceReleaseUid";
const mainSequenceLocalUpdateIdParam = "msLocalUpdateUid";
const mainSequenceLocalUpdateTabParam = "msLocalUpdateTab";
const mainSequenceCreateReleaseIntentParam = "msCreateReleaseIntent";

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

function getProjectUidFromSummaryHref(href?: string) {
  if (!href) {
    return null;
  }

  try {
    const url = new URL(href, "https://mainsequence.local");
    const projectUid = url.searchParams.get("project_uid") ?? url.searchParams.get("msProjectUid");

    return projectUid?.trim() || null;
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

function projectHasAgentCapabilities(
  summary: EntitySummaryHeader | null | undefined,
  project: ProjectSummary | null | undefined,
): boolean | null {
  const summaryRecord = summary as Record<string, unknown> | null | undefined;

  if (typeof summaryRecord?.agent_capabilities === "boolean") {
    return summaryRecord.agent_capabilities;
  }

  if (typeof summary?.extensions?.agent_capabilities === "boolean") {
    return summary.extensions.agent_capabilities;
  }

  if (typeof project?.agent_capabilities === "boolean") {
    return project.agent_capabilities;
  }

  return null;
}

function removeProjectAgentCapabilitiesBadge(
  summary: EntitySummaryHeader | null,
): EntitySummaryHeader | null {
  if (!summary) {
    return null;
  }

  return {
    ...summary,
    badges: summary.badges.filter((badge) => badge.key !== "agent_capabilities"),
  };
}

export function MainSequenceProjectsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const openProjectAgentRail = useProjectAgentRailStore((state) => state.openRail);
  const [formState, setFormState] = useState(defaultFormState);
  const [filterValue, setFilterValue] = useState("");
  const [projectsPageIndex, setProjectsPageIndex] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [projectAgentConfiguratorOpen, setProjectAgentConfiguratorOpen] = useState(false);
  const [projectAgentAutomationHeaderActive, setProjectAgentAutomationHeaderActive] = useState(false);
  const [projectDeleteRequest, setProjectDeleteRequest] = useState<ProjectDeleteRequest | null>(null);
  const [projectRepositoryDeleteFinalRequest, setProjectRepositoryDeleteFinalRequest] =
    useState<ProjectDeleteRequest | null>(null);
  const deferredFilterValue = useDeferredValue(filterValue);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedProjectUid = searchParams.get(mainSequenceProjectUidParam)?.trim() || null;
  const selectedJobUid = searchParams.get(mainSequenceJobUidParam)?.trim() || null;
  const selectedJobRunUid = searchParams.get(mainSequenceJobRunUidParam)?.trim() || null;
  const selectedResourceReleaseUid =
    searchParams.get(mainSequenceResourceReleaseUidParam)?.trim() || null;
  const selectedLocalUpdateId = searchParams.get(mainSequenceLocalUpdateIdParam)?.trim() || null;
  const selectedLocalUpdateTabId = searchParams.get(mainSequenceLocalUpdateTabParam);
  const activeTabId =
    searchParams.get(mainSequenceTabParam) ??
    searchParams.get(legacyTabParam) ??
    defaultProjectDetailTabId;
  const isProjectDetailOpen = Boolean(selectedProjectUid);
  const isJobDetailOpen = Boolean(selectedJobUid);
  const isJobRunDetailOpen = Boolean(selectedJobRunUid);
  const isResourceReleaseDetailOpen = Boolean(selectedResourceReleaseUid);
  const isLocalUpdateDetailOpen = Boolean(selectedLocalUpdateId);
  const activeTab =
    projectDetailTabs.find((tab) => tab.id === (isLocalUpdateDetailOpen ? "data-node-updates" : activeTabId)) ??
    projectDetailTabs.find((tab) => tab.id === defaultProjectDetailTabId) ??
    projectDetailTabs[0];

  const projectsQuery = useQuery({
    queryKey: ["main_sequence", "projects", "list", projectsPageIndex, deferredFilterValue.trim()],
    queryFn: () =>
      listProjects({
        limit: mainSequenceRegistryPageSize,
        offset: projectsPageIndex * mainSequenceRegistryPageSize,
        search: deferredFilterValue.trim() || undefined,
      }),
    refetchInterval: (query) =>
      hasUninitializedProjects(query.state.data?.results) ? 60_000 : false,
    refetchIntervalInBackground: true,
  });

  const projectSummaryQuery = useQuery({
    queryKey: ["main_sequence", "projects", "summary", selectedProjectUid],
    queryFn: () => fetchProjectSummary(selectedProjectUid ?? ""),
    enabled: isProjectDetailOpen,
  });

  const formOptionsQuery = useQuery({
    queryKey: ["main_sequence", "projects", "form-options"],
    queryFn: fetchProjectFormOptions,
    enabled: createDialogOpen,
    staleTime: 300_000,
  });

  const dataSourceOptions: PickerOption[] = (formOptionsQuery.data?.dataSources ?? []).map(
    (option) => {
      const label =
        option.related_resource?.display_name?.trim() ||
        option.related_resource?.name?.trim() ||
        `Data source ${option.id}`;
      const description = [
        option.related_resource_class_type?.trim(),
        option.related_resource?.status?.trim(),
      ]
        .filter(Boolean)
        .join(" · ");

      return {
        value: option.uid,
        label,
        description,
        keywords: [
          option.uid,
          label,
          option.related_resource?.display_name ?? "",
          option.related_resource?.name ?? "",
          option.related_resource_class_type,
          option.related_resource?.status ?? "",
        ],
      };
    },
  ) satisfies PickerOption[];

  const projectBaseImageOptions: PickerOption[] = (
    formOptionsQuery.data?.projectBaseImages ?? []
  ).map((option) => ({
    value: option.uid,
    label: option.title,
    description: option.description || option.latest_digest,
    keywords: [option.uid, option.title, option.description, option.latest_digest],
  })) satisfies PickerOption[];

  useEffect(() => {
    if (!createDialogOpen) {
      return;
    }

    if (!formOptionsQuery.isSuccess) {
      return;
    }

    const firstDataSourceUid = dataSourceOptions[0]?.value;
    const firstBaseImageUid = projectBaseImageOptions[0]?.value;

    if (!firstDataSourceUid && !firstBaseImageUid) {
      return;
    }

    setFormState((current) => {
      const hasSelectedDataSource = dataSourceOptions.some(
        (option) => option.value === current.dataSourceUid,
      );
      const hasSelectedBaseImage = projectBaseImageOptions.some(
        (option) => option.value === current.defaultBaseImageUid,
      );
      const nextDataSourceUid = hasSelectedDataSource ? current.dataSourceUid : firstDataSourceUid;
      const nextDefaultBaseImageUid = hasSelectedBaseImage
        ? current.defaultBaseImageUid
        : (firstBaseImageUid ?? "");

      if (
        nextDataSourceUid === current.dataSourceUid &&
        nextDefaultBaseImageUid === current.defaultBaseImageUid
      ) {
        return current;
      }

      return {
        ...current,
        dataSourceUid: nextDataSourceUid,
        defaultBaseImageUid: nextDefaultBaseImageUid,
      };
    });
  }, [
    createDialogOpen,
    dataSourceOptions,
    projectBaseImageOptions,
    formOptionsQuery.isSuccess,
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
    if (!selectedProjectUid) {
      setProjectAgentConfiguratorOpen(false);
      setProjectAgentAutomationHeaderActive(false);
    }
  }, [selectedProjectUid]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil((projectsQuery.data?.count ?? 0) / mainSequenceRegistryPageSize),
    );

    if (projectsPageIndex > totalPages - 1) {
      setProjectsPageIndex(totalPages - 1);
    }
  }, [projectsPageIndex, projectsQuery.data?.count]);

  const filteredProjects = projectsQuery.data?.results ?? [];
  const projectSelection = useRegistrySelection(filteredProjects, (project) => project.uid);
  const deleteProjectMutation = useMutation({
    mutationFn: async ({ deleteRepositories, projects }: ProjectDeleteRequest) =>
      bulkDeleteProjects(
        projects.map((project) => project.uid),
        { deleteRepositories },
      ),
    onSuccess: async (result, request) => {
      const deletedCount = result.deleted_count ?? request.projects.length;
      setProjectDeleteRequest(null);
      setProjectRepositoryDeleteFinalRequest(null);
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
  const updateProjectSdkMutation = useMutation({
    mutationFn: updateProjectSdk,
    onSuccess: async (result) => {
      toast({
        variant: "success",
        title: "SDK update started",
        description: result.message,
      });
      await queryClient.invalidateQueries({ queryKey: ["main_sequence", "projects", "list"] });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "summary", selectedProjectUid],
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "SDK update failed",
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
    (project) => project.uid === selectedProjectUid,
  );
  const projectHeaderBase = projectSummaryQuery.data ?? (selectedProjectSummary
    ? buildFallbackProjectSummary(selectedProjectSummary)
    : null);
  const hasProjectAgentCapabilities = projectHasAgentCapabilities(
    projectSummaryQuery.data,
    selectedProjectSummary,
  );
  const projectAgentServiceQuery = useQuery({
    queryKey: ["main_sequence", "projects", "project-agent", "service", selectedProjectUid],
    queryFn: () => fetchProjectExecutorAgentServiceByProject(selectedProjectUid ?? ""),
    enabled: isProjectDetailOpen && Boolean(selectedProjectUid),
    staleTime: 60_000,
  });
  const projectHeader = removeProjectAgentCapabilitiesBadge(projectHeaderBase);
  const projectTitle =
    projectHeader?.entity.title ??
    selectedProjectSummary?.project_name ??
    (selectedProjectUid ? `Project ${selectedProjectUid}` : "Project");
  const readyProjectAgentUid = projectAgentServiceQuery.data?.agent_uid?.trim() || null;
  const showProjectAgentActionsMenu =
    Boolean(readyProjectAgentUid) || hasProjectAgentCapabilities === true;
  const projectAgentSummaryActions =
    selectedProjectUid ? (
      <AdminMenu
        actions={[
          ...(showProjectAgentActionsMenu
            ? [
                {
                  icon: Bot,
                  label: "Project agent",
                  children: [
                    {
                      icon: Bot,
                      label: "Chat with project agent",
                      disabled: !readyProjectAgentUid,
                      onSelect: () => {
                        if (!readyProjectAgentUid) {
                          toast({
                            variant: "error",
                            title: "Project agent unavailable",
                            description:
                              "This project agent service does not expose a ready agent session.",
                          });
                          return;
                        }

                        openProjectAgentRail({
                          agentId: readyProjectAgentUid,
                          label:
                            projectAgentServiceQuery.data?.subdomain?.trim() || "Project Agent",
                        });
                      },
                    },
                    {
                      icon: FolderKanban,
                      label: "Configure project agent",
                      onSelect: () => {
                        setProjectAgentAutomationHeaderActive(false);
                        setProjectAgentConfiguratorOpen(true);
                      },
                    },
                  ],
                },
              ]
            : []),
          {
            icon: RefreshCcw,
            label: updateProjectSdkMutation.isPending ? "Updating SDK..." : "Update SDK",
            disabled: updateProjectSdkMutation.isPending,
            onSelect: () => {
              void updateProjectSdkMutation.mutateAsync(selectedProjectUid);
            },
          },
        ]}
        menuClassName="w-56"
        placement="left"
        triggerLabel="Project actions"
        triggerClassName="inline-flex h-9 w-9 items-center justify-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/70 text-muted-foreground shadow-sm transition-colors hover:bg-muted/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
        triggerContent={<EllipsisVertical className="h-4 w-4" />}
      />
    ) : null;

  const handleCreateProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createProjectMutation.reset();

    if (!formState.dataSourceUid.trim()) {
      toast({
        variant: "error",
        title: "Data source required",
        description: "Select a data source before creating the project.",
      });
      return;
    }

    if (!formState.defaultBaseImageUid.trim()) {
      toast({
        variant: "error",
        title: "Base image required",
        description: "Select a base image before creating the project.",
      });
      return;
    }

    await createProjectMutation.mutateAsync({
      project_name: formState.projectName.trim(),
      data_source_uid: formState.dataSourceUid.trim(),
      default_base_image: formState.defaultBaseImageUid.trim(),
      github_org_uid: formState.githubOrgId.trim() || undefined,
    });
  };

  function navigateWithProjectSearch(
    update: (searchParams: URLSearchParams) => void,
    options?: { replace?: boolean },
  ) {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);
    const nextSearch = nextParams.toString();

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: options?.replace ?? false },
    );
  }

  function openProjectDetail(projectUid: string) {
    navigateWithProjectSearch((nextParams) => {
      nextParams.delete(legacyTabParam);
      nextParams.delete(mainSequenceJobUidParam);
      nextParams.delete(mainSequenceJobRunUidParam);
      nextParams.delete(mainSequenceResourceReleaseUidParam);
      nextParams.delete(mainSequenceLocalUpdateIdParam);
      nextParams.delete(mainSequenceLocalUpdateTabParam);
      nextParams.set(mainSequenceProjectUidParam, projectUid);
      nextParams.set(mainSequenceTabParam, defaultProjectDetailTabId);
    });
  }

  function closeProjectDetail() {
    navigateWithProjectSearch((nextParams) => {
      nextParams.delete(mainSequenceProjectUidParam);
      nextParams.delete(mainSequenceTabParam);
      nextParams.delete(mainSequenceJobUidParam);
      nextParams.delete(mainSequenceJobRunUidParam);
      nextParams.delete(mainSequenceResourceReleaseUidParam);
      nextParams.delete(mainSequenceLocalUpdateIdParam);
      nextParams.delete(mainSequenceLocalUpdateTabParam);
      nextParams.delete(legacyTabParam);
    });
  }

  function selectProjectDetailTab(tabId: (typeof projectDetailTabs)[number]["id"]) {
    navigateWithProjectSearch((nextParams) => {
      nextParams.delete(legacyTabParam);
      if (selectedProjectUid) {
        nextParams.set(mainSequenceProjectUidParam, selectedProjectUid);
      }
      nextParams.set(mainSequenceTabParam, tabId);

      if (tabId !== "jobs") {
        nextParams.delete(mainSequenceJobUidParam);
        nextParams.delete(mainSequenceJobRunUidParam);
      }

      if (tabId !== "resource-releases") {
        nextParams.delete(mainSequenceResourceReleaseUidParam);
        nextParams.delete(mainSequenceCreateReleaseIntentParam);
      }

      if (tabId !== "data-node-updates") {
        nextParams.delete(mainSequenceLocalUpdateIdParam);
        nextParams.delete(mainSequenceLocalUpdateTabParam);
      }
    });
  }

  function openJobDetail(jobUid: string) {
    navigateWithProjectSearch((nextParams) => {
      nextParams.delete(legacyTabParam);
      if (selectedProjectUid) {
        nextParams.set(mainSequenceProjectUidParam, selectedProjectUid);
      }
      nextParams.set(mainSequenceTabParam, "jobs");
      nextParams.set(mainSequenceJobUidParam, jobUid);
      nextParams.delete(mainSequenceJobRunUidParam);
      nextParams.delete(mainSequenceResourceReleaseUidParam);
      nextParams.delete(mainSequenceLocalUpdateIdParam);
      nextParams.delete(mainSequenceLocalUpdateTabParam);
    });
  }

  function closeJobDetail() {
    navigateWithProjectSearch((nextParams) => {
      nextParams.delete(mainSequenceJobUidParam);
      nextParams.delete(mainSequenceJobRunUidParam);
    });
  }

  function openJobRunDetail(jobRunUid: string) {
    navigateWithProjectSearch((nextParams) => {
      nextParams.delete(legacyTabParam);
      if (selectedProjectUid) {
        nextParams.set(mainSequenceProjectUidParam, selectedProjectUid);
      }
      nextParams.set(mainSequenceTabParam, "jobs");
      if (selectedJobUid) {
        nextParams.set(mainSequenceJobUidParam, selectedJobUid);
      }
      nextParams.set(mainSequenceJobRunUidParam, jobRunUid);
      nextParams.delete(mainSequenceResourceReleaseUidParam);
      nextParams.delete(mainSequenceLocalUpdateIdParam);
      nextParams.delete(mainSequenceLocalUpdateTabParam);
    });
  }

  function closeJobRunDetail() {
    navigateWithProjectSearch((nextParams) => {
      nextParams.delete(mainSequenceJobRunUidParam);
    });
  }

  function openResourceReleaseDetail(resourceReleaseUid: string) {
    navigateWithProjectSearch((nextParams) => {
      nextParams.delete(legacyTabParam);
      if (selectedProjectUid) {
        nextParams.set(mainSequenceProjectUidParam, selectedProjectUid);
      }
      nextParams.set(mainSequenceTabParam, "resource-releases");
      nextParams.delete(mainSequenceJobUidParam);
      nextParams.delete(mainSequenceJobRunUidParam);
      nextParams.set(mainSequenceResourceReleaseUidParam, resourceReleaseUid);
      nextParams.delete(mainSequenceCreateReleaseIntentParam);
      nextParams.delete(mainSequenceLocalUpdateIdParam);
      nextParams.delete(mainSequenceLocalUpdateTabParam);
    });
  }

  function closeResourceReleaseDetail() {
    navigateWithProjectSearch((nextParams) => {
      nextParams.delete(mainSequenceResourceReleaseUidParam);
    });
  }

  function clearPendingCreateReleaseKind() {
    navigateWithProjectSearch((nextParams) => {
      nextParams.delete(mainSequenceCreateReleaseIntentParam);
    }, { replace: true });
  }

  function openProjectLocalUpdateDetail(localUpdateId: string) {
    navigateWithProjectSearch((nextParams) => {
      nextParams.delete(legacyTabParam);
      if (selectedProjectUid) {
        nextParams.set(mainSequenceProjectUidParam, selectedProjectUid);
      }
      nextParams.set(mainSequenceTabParam, "data-node-updates");
      nextParams.delete(mainSequenceJobUidParam);
      nextParams.delete(mainSequenceJobRunUidParam);
      nextParams.delete(mainSequenceResourceReleaseUidParam);
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

  function openDataNodeDetailFromProject(dataNodeId: string) {
    const nextParams = new URLSearchParams();
    nextParams.set("msDataNodeUid", String(dataNodeId));
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
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={closeProjectDetail}>
                <ArrowLeft className="h-4 w-4" />
                Back to projects
              </Button>
            </div>
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
                actions={projectAgentSummaryActions}
                onFieldLinkClick={(field) => {
                  const linkedProjectUid = getProjectUidFromSummaryHref(field.href);

                  if (linkedProjectUid) {
                    openProjectDetail(linkedProjectUid);
                  }
                }}
                onSummaryUpdated={async () => {
                  await queryClient.invalidateQueries({
                    queryKey: ["main_sequence", "projects", "summary", selectedProjectUid],
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
                  {activeTab.id === "code" && selectedProjectUid ? (
                    <MainSequenceProjectCodeTab
                      projectUid={selectedProjectUid}
                      onJobCreated={() => selectProjectDetailTab("jobs")}
                    />
                  ) : activeTab.id === "infra-graph" && selectedProjectUid ? (
                    <MainSequenceProjectInfraGraphTab projectUid={selectedProjectUid} />
                  ) : activeTab.id === "jobs" && selectedProjectUid ? (
                    <MainSequenceProjectJobsTab
                      onCloseJobDetail={closeJobDetail}
                      onCloseJobRunDetail={closeJobRunDetail}
                      onOpenProjectDetail={openProjectDetail}
                      onOpenJobDetail={openJobDetail}
                      onOpenJobRunDetail={openJobRunDetail}
                      projectUid={selectedProjectUid}
                      projectTitle={projectTitle}
                      selectedJobUid={isJobDetailOpen ? selectedJobUid : null}
                      selectedJobRunUid={isJobRunDetailOpen ? selectedJobRunUid : null}
                    />
                  ) : activeTab.id === "images" && selectedProjectUid ? (
                    <MainSequenceProjectImagesTab projectUid={selectedProjectUid} />
                  ) : activeTab.id === "resource-releases" && selectedProjectUid ? (
                    <MainSequenceProjectResourceReleasesTab
                      onConsumeCreateReleaseIntent={clearPendingCreateReleaseKind}
                      onCloseResourceReleaseDetail={closeResourceReleaseDetail}
                      onOpenJobDetail={openJobDetail}
                      onOpenProjectDetail={openProjectDetail}
                      onOpenResourceReleaseDetail={openResourceReleaseDetail}
                      projectUid={selectedProjectUid}
                      requestedCreateReleaseIntent={
                        searchParams.get(mainSequenceCreateReleaseIntentParam) === "project-agent"
                          ? "project-agent"
                          : null
                      }
                      selectedResourceReleaseUid={
                        isResourceReleaseDetailOpen ? selectedResourceReleaseUid : null
                      }
                    />
                  ) : activeTab.id === "data-node-updates" && selectedProjectUid ? (
                    <MainSequenceProjectDataNodeUpdatesTab
                      onCloseLocalUpdateDetail={closeProjectLocalUpdateDetail}
                      onOpenDataNodeDetail={openDataNodeDetailFromProject}
                      onOpenLocalUpdateDetail={openProjectLocalUpdateDetail}
                      onSelectLocalUpdateTab={selectProjectLocalUpdateTab}
                      projectUid={selectedProjectUid}
                      selectedLocalUpdateId={isLocalUpdateDetailOpen ? selectedLocalUpdateId : null}
                      selectedLocalUpdateTabId={selectedLocalUpdateTabId}
                    />
                  ) : activeTab.id === "settings" && selectedProjectUid ? (
                    <MainSequenceProjectSettingsTab
                      key={selectedProjectUid}
                      projectUid={selectedProjectUid}
                      projectSummary={projectHeader}
                    />
                  ) : activeTab.id === "permissions" && selectedProjectUid ? (
                    <MainSequencePermissionsTab
                      objectUrl="projects"
                      objectId={selectedProjectUid}
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
                      placeholder="Filter by name, UID, git URL, or data source"
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
                            const selected = projectSelection.isSelected(project.uid);

                            return (
                              <tr key={project.id}>
                                <td className={getRegistryTableCellClassName(selected, "left")}>
                                  <MainSequenceSelectionCheckbox
                                    ariaLabel={`Select ${project.project_name}`}
                                    checked={selected}
                                    onChange={() => projectSelection.toggleSelection(project.uid)}
                                  />
                                </td>
                                <td className={getRegistryTableCellClassName(selected)}>
                                  <div className="min-w-0">
                                    <button
                                      type="button"
                                      className="group inline-flex max-w-[280px] cursor-pointer items-center gap-1.5 rounded-sm text-left outline-none transition-colors hover:text-primary focus-visible:text-primary"
                                      onClick={() => openProjectDetail(project.uid)}
                                      title={`Open ${project.project_name}`}
                                    >
                                      <span className="truncate font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors group-hover:decoration-primary group-focus-visible:decoration-primary">
                                        {project.project_name}
                                      </span>
                                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary group-focus-visible:text-primary" />
                                    </button>
                                    <div
                                      className="mt-1 max-w-[280px] truncate font-mono text-xs text-muted-foreground"
                                      title={project.uid}
                                    >
                                      {project.uid}
                                    </div>
                                  </div>
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
        className="max-w-[min(1080px,calc(100vw-24px))] overflow-visible"
        contentClassName="max-h-[min(88vh,920px)] overflow-visible px-5 py-5 md:px-6 md:py-6"
      >
        <form className="space-y-6" onSubmit={handleCreateProject}>
          <div className="space-y-5">
            <div className="rounded-[24px] border border-border/70 bg-background/18 p-5">
              <div className="grid gap-4">
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
              </div>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-background/18 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Data source
                  </label>
                  <PickerField
                    value={formState.dataSourceUid}
                    onChange={(value) => {
                      createProjectMutation.reset();
                      setFormState((current) => ({
                        ...current,
                        dataSourceUid: value,
                      }));
                    }}
                    options={dataSourceOptions}
                    placeholder={
                      formOptionsQuery.isLoading
                        ? "Loading data sources..."
                        : dataSourceOptions.length === 0
                          ? "No data sources available"
                          : "Choose a data source"
                    }
                    searchPlaceholder="Search data sources"
                    emptyMessage="No matching data sources."
                    disabled={formOptionsQuery.isLoading || dataSourceOptions.length === 0}
                    loading={formOptionsQuery.isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Default base image
                  </label>
                  <PickerField
                    value={formState.defaultBaseImageUid}
                    onChange={(value) => {
                      createProjectMutation.reset();
                      setFormState((current) => ({
                        ...current,
                        defaultBaseImageUid: value,
                      }));
                    }}
                    options={projectBaseImageOptions}
                    placeholder={
                      formOptionsQuery.isLoading
                        ? "Loading base images..."
                        : projectBaseImageOptions.length === 0
                          ? "No base images available"
                          : "Choose a base image"
                    }
                    searchPlaceholder="Search base images"
                    emptyMessage="No matching base images."
                    disabled={formOptionsQuery.isLoading || projectBaseImageOptions.length === 0}
                    loading={formOptionsQuery.isLoading}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    GitHub organization
                  </label>
                  <Select
                    aria-label="GitHub organization"
                    className="h-11 w-full bg-card/70"
                    listboxPlacement="top"
                    value={formState.githubOrgId}
                    disabled={formOptionsQuery.isLoading}
                    onChange={(event) => {
                      createProjectMutation.reset();
                      setFormState((current) => ({
                        ...current,
                        githubOrgId: event.target.value,
                      }));
                    }}
                  >
                    <option value="" data-description="Use the default organization.">
                      Optional
                    </option>
                    {(formOptionsQuery.data?.githubOrganizations ?? []).map((option) => (
                      <option
                        key={option.uid}
                        value={option.uid}
                        data-description={
                          option.display_name && option.display_name !== option.login
                            ? option.login
                            : undefined
                        }
                      >
                        {option.display_name || option.login}
                      </option>
                    ))}
                  </Select>
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
                disabled={
                  createProjectMutation.isPending ||
                  formOptionsQuery.isLoading ||
                  !formState.projectName.trim() ||
                  !formState.dataSourceUid.trim() ||
                  !formState.defaultBaseImageUid.trim()
                }
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

          if (projectDeleteRequest.deleteRepositories) {
            setProjectRepositoryDeleteFinalRequest(projectDeleteRequest);
            setProjectDeleteRequest(null);
            return;
          }

          return deleteProjectMutation.mutateAsync(projectDeleteRequest);
        }}
      />

      <ActionConfirmationDialog
        title="Final Confirmation: Delete Repositories"
        open={projectRepositoryDeleteFinalRequest !== null}
        onClose={() => {
          if (!deleteProjectMutation.isPending) {
            setProjectRepositoryDeleteFinalRequest(null);
          }
        }}
        tone="danger"
        actionLabel="permanently delete projects and repositories"
        objectLabel={
          (projectRepositoryDeleteFinalRequest?.projects.length ?? 0) > 1 ? "projects" : "project"
        }
        confirmWord="DELETE PROJECT REPOSITORIES"
        confirmButtonLabel="Permanently Delete Repositories"
        description="This is the second and final confirmation for repository deletion."
        specialText="This deletes the selected project records and their linked repositories. Repository deletion is permanent and cannot be undone."
        objectSummary={
          projectRepositoryDeleteFinalRequest?.projects.length === 1 ? (
            <>
              <div className="font-medium">
                {projectRepositoryDeleteFinalRequest.projects[0]?.project_name}
              </div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">
                {projectRepositoryDeleteFinalRequest.projects[0]?.uid}
              </div>
            </>
          ) : (
            <>
              <div className="font-medium">
                {projectRepositoryDeleteFinalRequest?.projects.length ?? 0} projects selected
              </div>
              <div className="mt-1 text-muted-foreground">
                {projectRepositoryDeleteFinalRequest?.projects
                  .slice(0, 3)
                  .map((project) => project.project_name)
                  .join(", ")}
                {(projectRepositoryDeleteFinalRequest?.projects.length ?? 0) > 3 ? ", ..." : ""}
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
          if (
            !projectRepositoryDeleteFinalRequest ||
            projectRepositoryDeleteFinalRequest.projects.length === 0
          ) {
            return;
          }

          return deleteProjectMutation.mutateAsync(projectRepositoryDeleteFinalRequest);
        }}
      />

      <Dialog
        open={projectAgentConfiguratorOpen}
        onClose={() => {
          setProjectAgentConfiguratorOpen(false);
          setProjectAgentAutomationHeaderActive(false);
        }}
        closeOnBackdropClick
        title="Configure Project Agent"
        description={projectTitle}
        className="max-w-[min(1180px,calc(100vw-24px))]"
        contentClassName="px-4 py-4 md:px-5 md:py-5"
        headerClassName={
          projectAgentAutomationHeaderActive
            ? "main-sequence-ai-automation-dialog-header"
            : undefined
        }
        headerDecor={
          projectAgentAutomationHeaderActive ? <AutomationDitherWaveLayer /> : null
        }
      >
        {selectedProjectUid ? (
          <ProjectAgentConfigurator
            projectUid={selectedProjectUid}
            hasAgentCapabilities={true}
            onAutomaticDeploymentStateChange={setProjectAgentAutomationHeaderActive}
          />
        ) : (
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/18 px-5 py-8 text-sm text-muted-foreground">
            Select a project before configuring its agent.
          </div>
        )}
      </Dialog>
    </div>
  );
}
