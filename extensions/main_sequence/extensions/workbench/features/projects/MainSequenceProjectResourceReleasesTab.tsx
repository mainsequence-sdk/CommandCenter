import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Boxes, FileText, Loader2, Plus, Rocket, Trash2 } from "lucide-react";

import { useAuthStore } from "@/auth/auth-store";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  RbacAssignmentMatrix,
  type RbacAssignableTeam,
  type RbacAssignableUser,
  type RbacAssignmentScope,
  type RbacAssignmentValue,
} from "@/components/ui/rbac-assignment-matrix";
import { useToast } from "@/components/ui/toaster";
import { listTeams } from "@/features/teams/api";

import {
  bulkDeleteResourceReleases,
  createResourceRelease,
  fetchObjectCanEdit,
  fetchObjectCanView,
  fetchProjectImages,
  fetchResourceReleaseSummary,
  formatMainSequenceError,
  listPermissionCandidateUsers,
  listProjectJobs,
  listProjectResources,
  listResourceReleases,
  mainSequenceRegistryPageSize,
  updateShareableObjectPermission,
  type EntitySummaryHeader,
  type PermissionCandidateUserRecord,
  type ProjectImageOption,
  type ProjectResourceRecord,
  type ResourceReleaseRecord,
  type ResourceReleaseReadmeSummary,
  type ShareableAccessLevel,
  type ShareablePrincipalsResponse,
  type ShareablePrincipalType,
  type SummaryField,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { PickerField } from "../../../../common/components/PickerField";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { MainSequenceSelectionCheckbox } from "../../../../common/components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import { useRegistrySelection } from "../../../../common/hooks/useRegistrySelection";

const projectResourceReleaseFetchLimit = 500;
const releaseKindToProjectResourceType = {
  streamlit_dashboard: "dashboard",
  agent: "agent",
} as const;
const emptyPermissionAssignments: RbacAssignmentValue = {
  view: { userIds: [], teamIds: [] },
  edit: { userIds: [], teamIds: [] },
};
const resourceReleasePermissionsObjectUrl = "resource-release";

type ReleaseKind = keyof typeof releaseKindToProjectResourceType;
type ResourceReleaseDetailTabId = "readme" | "permissions";

const resourceReleaseDetailTabs = [
  { id: "readme", label: "README" },
  { id: "permissions", label: "Permissions" },
] as const;
const resourceReleaseAccessScopes: RbacAssignmentScope[] = [
  {
    id: "view",
    title: "Can view",
    userHelperText: "Users on the right can view this release.",
    teamHelperText: "Teams on the right can view this release.",
  },
  {
    id: "edit",
    title: "Can edit",
    userHelperText: "Users on the right can edit this release.",
    teamHelperText: "Teams on the right can edit this release.",
  },
];

function createDefaultReleaseComputeState() {
  return {
    cpuRequest: "100m",
    memoryRequest: "512Mi",
    spot: true,
  };
}

function formatReleaseKind(releaseKind: string) {
  if (releaseKind === "streamlit_dashboard") {
    return "Dashboard";
  }

  if (releaseKind === "agent") {
    return "Agent";
  }

  return releaseKind.replaceAll("_", " ");
}

function getReleaseKindBadgeVariant(releaseKind: string) {
  if (releaseKind === "streamlit_dashboard") {
    return "primary" as const;
  }

  if (releaseKind === "agent") {
    return "secondary" as const;
  }

  return "neutral" as const;
}

function formatProjectImageLabel(image: ProjectImageOption) {
  if (!image.project_repo_hash?.trim()) {
    return `Image ${image.id} - Latest`;
  }

  const shortHash = image.project_repo_hash.slice(0, 7);
  return `Image ${image.id} - ${shortHash}`;
}

function formatReadmeFilesize(filesize?: number | null) {
  if (!filesize || filesize <= 0) {
    return null;
  }

  if (filesize < 1024) {
    return `${filesize} B`;
  }

  if (filesize < 1024 * 1024) {
    return `${(filesize / 1024).toFixed(1)} KB`;
  }

  return `${(filesize / (1024 * 1024)).toFixed(1)} MB`;
}

function toProjectResourceOption(resource: ProjectResourceRecord) {
  return {
    value: String(resource.id),
    label: resource.name,
    description: resource.path,
    keywords: [resource.path, resource.repo_commit_sha ?? "", resource.resource_type],
  };
}

function toProjectImageOption(image: ProjectImageOption) {
  return {
    value: String(image.id),
    label: formatProjectImageLabel(image),
    description: image.base_image?.title ?? "Default base image",
    keywords: [image.project_repo_hash ?? "", image.base_image?.title ?? ""],
  };
}

function getEntityIdFromSummaryHref(href: string | undefined, queryKeys: string[]) {
  if (!href) {
    return null;
  }

  try {
    const url = new URL(href, "https://mainsequence.local");

    for (const queryKey of queryKeys) {
      const rawValue = url.searchParams.get(queryKey);
      const parsedValue = Number(rawValue ?? "");

      if (Number.isFinite(parsedValue) && parsedValue > 0) {
        return parsedValue;
      }
    }

    const pathnameSegments = url.pathname.split("/").filter(Boolean).reverse();

    for (const segment of pathnameSegments) {
      const parsedValue = Number(segment);

      if (Number.isFinite(parsedValue) && parsedValue > 0) {
        return parsedValue;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function getProjectIdFromSummaryHref(href?: string) {
  return getEntityIdFromSummaryHref(href, ["project_id", "projectId"]);
}

function getJobIdFromSummaryHref(href?: string) {
  return getEntityIdFromSummaryHref(href, ["job_id", "jobId"]);
}

function buildFallbackResourceReleaseSummary(release: ResourceReleaseRecord): EntitySummaryHeader {
  return {
    entity: {
      id: release.id,
      type: "resource_release",
      title: release.subdomain,
    },
    badges: [
      {
        key: "release_kind",
        label: formatReleaseKind(release.release_kind),
        tone: getReleaseKindBadgeVariant(release.release_kind),
      },
      {
        key: "readme",
        label: release.readme_resource ? "README linked" : "No README",
        tone: release.readme_resource ? "success" : "warning",
      },
    ],
    inline_fields: [
      {
        key: "resource",
        label: "Resource",
        value: `Resource ${release.resource}`,
        kind: "text",
      },
      {
        key: "job",
        label: "Job",
        value: `Job ${release.related_job}`,
        kind: "text",
      },
      {
        key: "readme_resource",
        label: "README",
        value: release.readme_resource ? `Resource ${release.readme_resource}` : "Not linked",
        kind: "text",
      },
    ],
    highlight_fields: [
      {
        key: "subdomain",
        label: "Subdomain",
        value: release.subdomain,
        kind: "text",
        icon: "globe",
      },
      {
        key: "release_id",
        label: "Release ID",
        value: String(release.id),
        kind: "text",
      },
    ],
    stats: [],
  };
}

function hasResourceReleaseReadme(
  summary: unknown,
): summary is { readme?: ResourceReleaseReadmeSummary } {
  return Boolean(summary && typeof summary === "object" && "readme" in summary);
}

function mergeRbacIds(...lists: Array<Array<string | number>>) {
  const seen = new Set<string>();

  return lists.flat().map(normalizePermissionEntityId).filter((id) => {
    const key = String(id);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function normalizePermissionEntityId(id: string | number) {
  if (typeof id === "number") {
    return id;
  }

  const trimmed = id.trim();

  if (/^-?\d+$/.test(trimmed)) {
    const parsed = Number(trimmed);

    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }

  return trimmed;
}

function formatPermissionUserName(
  user: Pick<PermissionCandidateUserRecord, "email" | "first_name" | "last_name" | "username">,
) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();

  if (fullName) {
    return fullName;
  }

  return user.username || user.email;
}

function normalizePermissionValue(value: RbacAssignmentValue): RbacAssignmentValue {
  const editUserIds = mergeRbacIds(value.edit?.userIds ?? []);
  const editTeamIds = mergeRbacIds(value.edit?.teamIds ?? []);

  return {
    view: {
      userIds: mergeRbacIds(value.view?.userIds ?? [], editUserIds),
      teamIds: mergeRbacIds(value.view?.teamIds ?? [], editTeamIds),
    },
    edit: {
      userIds: editUserIds,
      teamIds: editTeamIds,
    },
  };
}

function buildPermissionValue(
  canView: ShareablePrincipalsResponse | undefined,
  canEdit: ShareablePrincipalsResponse | undefined,
) {
  return normalizePermissionValue({
    view: {
      userIds: canView?.users.map((user) => user.id) ?? [],
      teamIds: canView?.teams.map((team) => team.id) ?? [],
    },
    edit: {
      userIds: canEdit?.users.map((user) => user.id) ?? [],
      teamIds: canEdit?.teams.map((team) => team.id) ?? [],
    },
  });
}

function resolvePermissionLevel(
  value: RbacAssignmentValue,
  principalType: ShareablePrincipalType,
  principalId: string | number,
): ShareableAccessLevel | "none" {
  const normalizedId = String(normalizePermissionEntityId(principalId));
  const editIds =
    principalType === "user" ? value.edit?.userIds ?? [] : value.edit?.teamIds ?? [];
  const viewIds =
    principalType === "user" ? value.view?.userIds ?? [] : value.view?.teamIds ?? [];

  if (editIds.some((id) => String(normalizePermissionEntityId(id)) === normalizedId)) {
    return "edit";
  }

  if (viewIds.some((id) => String(normalizePermissionEntityId(id)) === normalizedId)) {
    return "view";
  }

  return "none";
}

function buildPermissionOperations(
  currentValue: RbacAssignmentValue,
  nextValue: RbacAssignmentValue,
) {
  const operations: Array<{
    principalId: string | number;
    principalType: ShareablePrincipalType;
    accessLevel: ShareableAccessLevel;
    operation: "add" | "remove";
  }> = [];

  for (const principalType of ["user", "team"] as const) {
    const principalIds =
      principalType === "user"
        ? mergeRbacIds(
            currentValue.view.userIds,
            currentValue.edit.userIds,
            nextValue.view.userIds,
            nextValue.edit.userIds,
          )
        : mergeRbacIds(
            currentValue.view.teamIds,
            currentValue.edit.teamIds,
            nextValue.view.teamIds,
            nextValue.edit.teamIds,
          );

    for (const principalId of principalIds) {
      const currentLevel = resolvePermissionLevel(currentValue, principalType, principalId);
      const nextLevel = resolvePermissionLevel(nextValue, principalType, principalId);

      if (currentLevel === nextLevel) {
        continue;
      }

      if (nextLevel === "none") {
        operations.push({
          principalId,
          principalType,
          accessLevel: "view",
          operation: "remove",
        });
        continue;
      }

      if (nextLevel === "edit") {
        operations.push({
          principalId,
          principalType,
          accessLevel: "edit",
          operation: "add",
        });
        continue;
      }

      if (currentLevel === "edit" && nextLevel === "view") {
        operations.push({
          principalId,
          principalType,
          accessLevel: "edit",
          operation: "remove",
        });
        continue;
      }

      operations.push({
        principalId,
        principalType,
        accessLevel: "view",
        operation: "add",
      });
    }
  }

  return operations;
}

export function MainSequenceProjectResourceReleasesTab({
  onCloseResourceReleaseDetail,
  onOpenJobDetail,
  onOpenProjectDetail,
  onOpenResourceReleaseDetail,
  projectId,
  selectedResourceReleaseId,
}: {
  onCloseResourceReleaseDetail: () => void;
  onOpenJobDetail: (jobId: number) => void;
  onOpenProjectDetail: (projectId: number) => void;
  onOpenResourceReleaseDetail: (resourceReleaseId: number) => void;
  projectId: number;
  selectedResourceReleaseId: number | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sessionUser = useAuthStore((state) => state.session?.user ?? null);
  const [filterValue, setFilterValue] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createReleaseKind, setCreateReleaseKind] = useState<ReleaseKind | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [selectedImageId, setSelectedImageId] = useState("");
  const [selectedDetailTabId, setSelectedDetailTabId] = useState<ResourceReleaseDetailTabId>("readme");
  const [computeState, setComputeState] = useState(() => createDefaultReleaseComputeState());
  const [releasesPendingDelete, setReleasesPendingDelete] = useState<ResourceReleaseRecord[]>([]);
  const [permissionsValue, setPermissionsValue] =
    useState<RbacAssignmentValue>(emptyPermissionAssignments);
  const deferredFilterValue = useDeferredValue(filterValue);

  const projectJobsQuery = useQuery({
    queryKey: ["main_sequence", "projects", "resource-releases", "jobs", projectId],
    queryFn: () =>
      listProjectJobs(projectId, {
        limit: projectResourceReleaseFetchLimit,
        offset: 0,
      }),
    enabled: projectId > 0,
    staleTime: 300_000,
  });

  const resourceReleasesQuery = useQuery({
    queryKey: ["main_sequence", "projects", "resource-releases", "list"],
    queryFn: () =>
      listResourceReleases({
        limit: projectResourceReleaseFetchLimit,
        offset: 0,
      }),
    enabled: projectId > 0,
    staleTime: 300_000,
  });

  const resourceReleaseSummaryQuery = useQuery({
    queryKey: ["main_sequence", "projects", "resource-releases", "summary", selectedResourceReleaseId],
    queryFn: () => fetchResourceReleaseSummary(selectedResourceReleaseId ?? 0),
    enabled: Boolean(selectedResourceReleaseId),
  });

  const resourceReleaseCanViewQuery = useQuery({
    queryKey: [
      "main_sequence",
      "permissions",
      resourceReleasePermissionsObjectUrl,
      selectedResourceReleaseId,
      "view",
    ],
    queryFn: () =>
      fetchObjectCanView(
        resourceReleasePermissionsObjectUrl,
        selectedResourceReleaseId ?? 0,
      ),
    enabled: Boolean(selectedResourceReleaseId) && selectedDetailTabId === "permissions",
    staleTime: 60_000,
  });

  const resourceReleaseCanEditQuery = useQuery({
    queryKey: [
      "main_sequence",
      "permissions",
      resourceReleasePermissionsObjectUrl,
      selectedResourceReleaseId,
      "edit",
    ],
    queryFn: () =>
      fetchObjectCanEdit(
        resourceReleasePermissionsObjectUrl,
        selectedResourceReleaseId ?? 0,
      ),
    enabled: Boolean(selectedResourceReleaseId) && selectedDetailTabId === "permissions",
    staleTime: 60_000,
  });

  const permissionCandidateUsersQuery = useQuery({
    queryKey: [
      "main_sequence",
      "permissions",
      resourceReleasePermissionsObjectUrl,
      selectedResourceReleaseId,
      "candidate-users",
    ],
    queryFn: () =>
      listPermissionCandidateUsers(
        resourceReleasePermissionsObjectUrl,
        selectedResourceReleaseId ?? 0,
      ),
    enabled: Boolean(selectedResourceReleaseId) && selectedDetailTabId === "permissions",
    staleTime: 300_000,
  });
  const permissionTeamsQuery = useQuery({
    queryKey: ["main_sequence", "permissions", "teams"],
    queryFn: () => listTeams(),
    enabled: Boolean(selectedResourceReleaseId) && selectedDetailTabId === "permissions",
    staleTime: 300_000,
  });

  const projectImagesQuery = useQuery({
    queryKey: ["main_sequence", "projects", "job-images", projectId],
    queryFn: () => fetchProjectImages(projectId),
    enabled: createDialogOpen && projectId > 0,
    staleTime: 300_000,
  });

  const readyProjectImages = useMemo(
    () =>
      (projectImagesQuery.data ?? []).filter(
        (image) => image.is_ready && Boolean(image.project_repo_hash?.trim()),
      ),
    [projectImagesQuery.data],
  );
  const selectedProjectImage =
    readyProjectImages.find((image) => String(image.id) === selectedImageId) ?? null;

  const releaseResourcesQuery = useQuery({
    queryKey: [
      "main_sequence",
      "projects",
      "resource-releases",
      "resources",
      projectId,
      createReleaseKind,
      selectedProjectImage?.project_repo_hash ?? "",
    ],
    queryFn: () =>
      listProjectResources(projectId, {
        limit: 200,
        repoCommitSha: selectedProjectImage?.project_repo_hash ?? undefined,
        resourceType: createReleaseKind
          ? releaseKindToProjectResourceType[createReleaseKind]
          : undefined,
      }),
    enabled:
      createDialogOpen &&
      projectId > 0 &&
      Boolean(createReleaseKind) &&
      Boolean(selectedProjectImage?.project_repo_hash),
    staleTime: 300_000,
  });

  const projectJobsById = useMemo(
    () => new Map((projectJobsQuery.data?.results ?? []).map((job) => [job.id, job])),
    [projectJobsQuery.data?.results],
  );
  const projectReleases = useMemo(
    () =>
      (resourceReleasesQuery.data?.results ?? []).filter((release) =>
        projectJobsById.has(release.related_job),
      ),
    [projectJobsById, resourceReleasesQuery.data?.results],
  );
  const selectedReleaseFromList = useMemo(
    () => projectReleases.find((release) => release.id === selectedResourceReleaseId) ?? null,
    [projectReleases, selectedResourceReleaseId],
  );
  const filteredReleases = useMemo(() => {
    const needle = deferredFilterValue.trim().toLowerCase();

    return projectReleases.filter((release) => {
      if (!needle) {
        return true;
      }

      const relatedJob = projectJobsById.get(release.related_job);

      return [
        String(release.id),
        release.subdomain,
        release.release_kind,
        String(release.resource),
        String(release.readme_resource ?? ""),
        String(release.related_job),
        relatedJob?.name ?? "",
        relatedJob?.execution_path ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [deferredFilterValue, projectJobsById, projectReleases]);
  const pagedReleases = useMemo(() => {
    const start = pageIndex * mainSequenceRegistryPageSize;
    return filteredReleases.slice(start, start + mainSequenceRegistryPageSize);
  }, [filteredReleases, pageIndex]);
  const releaseSelection = useRegistrySelection(pagedReleases);
  const projectResourceOptions = useMemo(
    () => (releaseResourcesQuery.data?.results ?? []).map(toProjectResourceOption),
    [releaseResourcesQuery.data?.results],
  );
  const projectImageOptions = useMemo(
    () => readyProjectImages.map(toProjectImageOption),
    [readyProjectImages],
  );
  const resourceReleaseSummary =
    resourceReleaseSummaryQuery.data ??
    (selectedReleaseFromList ? buildFallbackResourceReleaseSummary(selectedReleaseFromList) : null);
  const resourceReleaseTitle =
    resourceReleaseSummary?.entity.title ??
    selectedReleaseFromList?.subdomain ??
    (selectedResourceReleaseId ? `Release ${selectedResourceReleaseId}` : "Release");
  const persistedPermissionsValue = useMemo(
    () =>
      buildPermissionValue(
        resourceReleaseCanViewQuery.data,
        resourceReleaseCanEditQuery.data,
      ),
    [resourceReleaseCanEditQuery.data, resourceReleaseCanViewQuery.data],
  );
  const permissionUsers = useMemo<RbacAssignableUser[]>(() => {
    const usersById = new Map<string, RbacAssignableUser>();

    for (const user of permissionCandidateUsersQuery.data ?? []) {
      const normalizedId = normalizePermissionEntityId(user.id);

      usersById.set(String(normalizedId), {
        id: normalizedId,
        email: user.email,
        name: formatPermissionUserName(user),
      });
    }

    for (const user of [
      ...(resourceReleaseCanViewQuery.data?.users ?? []),
      ...(resourceReleaseCanEditQuery.data?.users ?? []),
    ]) {
      const normalizedId = normalizePermissionEntityId(user.id);

      usersById.set(String(normalizedId), {
        id: normalizedId,
        email: user.email,
        name: formatPermissionUserName(user),
      });
    }

    if (sessionUser) {
      const normalizedId = normalizePermissionEntityId(sessionUser.id);
      const existingUser = usersById.get(String(normalizedId));

      usersById.set(String(normalizedId), {
        id: normalizedId,
        email: sessionUser.email,
        name: sessionUser.name || existingUser?.name || sessionUser.email,
      });
    }

    return [...usersById.values()].sort((left, right) => left.email.localeCompare(right.email));
  }, [
    permissionCandidateUsersQuery.data,
    resourceReleaseCanEditQuery.data?.users,
    resourceReleaseCanViewQuery.data?.users,
    sessionUser,
  ]);
  const permissionTeams = useMemo<RbacAssignableTeam[]>(() => {
    const teamsById = new Map<string, RbacAssignableTeam>();

    for (const team of permissionTeamsQuery.data ?? []) {
      teamsById.set(String(team.id), {
        id: team.id,
        name: team.name,
        description: team.description,
        memberCount: team.member_count,
      });
    }

    for (const team of [
      ...(resourceReleaseCanViewQuery.data?.teams ?? []),
      ...(resourceReleaseCanEditQuery.data?.teams ?? []),
    ]) {
      const normalizedId = normalizePermissionEntityId(team.id);

      teamsById.set(String(normalizedId), {
        id: normalizedId,
        name: team.name,
        description: team.description,
        memberCount: team.member_count,
      });
    }

    return [...teamsById.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [
    permissionTeamsQuery.data,
    resourceReleaseCanEditQuery.data?.teams,
    resourceReleaseCanViewQuery.data?.teams,
  ]);
  const permissionsTabLoading =
    permissionCandidateUsersQuery.isLoading ||
    permissionTeamsQuery.isLoading ||
    resourceReleaseCanViewQuery.isLoading ||
    resourceReleaseCanEditQuery.isLoading;
  const permissionsTabError =
    permissionCandidateUsersQuery.error ??
    permissionTeamsQuery.error ??
    resourceReleaseCanViewQuery.error ??
    resourceReleaseCanEditQuery.error ??
    null;
  const releaseBulkActions =
    releaseSelection.selectedCount > 0
      ? [
          {
            id: "delete-releases",
            label:
              releaseSelection.selectedCount === 1
                ? "Delete selected release"
                : "Delete selected releases",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () => {
              deleteResourceReleaseMutation.reset();
              setReleasesPendingDelete(releaseSelection.selectedItems);
            },
          },
        ]
      : [];

  const createResourceReleaseMutation = useMutation({
    mutationFn: createResourceRelease,
    onSuccess: async (release) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "resource-releases"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "jobs", projectId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "summary", projectId],
      });

      toast({
        variant: "success",
        title: `${formatReleaseKind(release.release_kind)} release created`,
        description: `${release.subdomain} is now available in this project.`,
      });

      setCreateDialogOpen(false);
      setCreateReleaseKind(null);
      setSelectedResourceId("");
      setSelectedImageId("");
      setComputeState(createDefaultReleaseComputeState());
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Resource release creation failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const deleteResourceReleaseMutation = useMutation({
    mutationFn: async (releases: ResourceReleaseRecord[]) =>
      bulkDeleteResourceReleases(releases.map((release) => release.id)),
    onSuccess: async (result, releases) => {
      const deletedCount = result.deleted_count ?? releases.length;
      setReleasesPendingDelete([]);
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "resource-releases"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "summary", projectId],
      });

      if (deletedCount > 0) {
        toast({
          variant: "success",
          title: deletedCount === 1 ? "Resource release deleted" : "Resource releases deleted",
          description:
            deletedCount === 1
              ? `${releases[0]?.subdomain ?? "Release"} was deleted.`
              : `${deletedCount} resource releases were deleted.`,
        });
      }

      releaseSelection.clearSelection();
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Resource release deletion failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async (nextValue: RbacAssignmentValue) => {
      if (!selectedResourceReleaseId) {
        return {
          changed: false,
          value: normalizePermissionValue(nextValue),
        };
      }

      const normalizedCurrentValue = normalizePermissionValue(permissionsValue);
      const normalizedNextValue = normalizePermissionValue(nextValue);
      const operations = buildPermissionOperations(
        normalizedCurrentValue,
        normalizedNextValue,
      );

      for (const operation of operations) {
        await updateShareableObjectPermission({
          objectUrl: resourceReleasePermissionsObjectUrl,
          objectId: selectedResourceReleaseId,
          principalType: operation.principalType,
          accessLevel: operation.accessLevel,
          operation: operation.operation,
          principalId: operation.principalId,
        });
      }

      return {
        changed: operations.length > 0,
        value: normalizedNextValue,
      };
    },
    onSuccess: async ({ changed, value }) => {
      setPermissionsValue(value);

      if (!changed || !selectedResourceReleaseId) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            "main_sequence",
            "permissions",
            resourceReleasePermissionsObjectUrl,
            selectedResourceReleaseId,
            "view",
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "main_sequence",
            "permissions",
            resourceReleasePermissionsObjectUrl,
            selectedResourceReleaseId,
            "edit",
          ],
        }),
      ]);

      toast({
        variant: "success",
        title: "Permissions updated",
        description: "Resource release access rules were saved.",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Permissions update failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  useEffect(() => {
    setPageIndex(0);
  }, [deferredFilterValue]);

  useEffect(() => {
    if (!createDialogOpen) {
      setCreateReleaseKind(null);
      setSelectedResourceId("");
      setSelectedImageId("");
      setComputeState(createDefaultReleaseComputeState());
    }
  }, [createDialogOpen]);

  useEffect(() => {
    if (!createDialogOpen) {
      return;
    }

    if (!readyProjectImages.some((image) => String(image.id) === selectedImageId)) {
      setSelectedImageId(readyProjectImages[0] ? String(readyProjectImages[0].id) : "");
    }
  }, [createDialogOpen, readyProjectImages, selectedImageId]);

  useEffect(() => {
    if (!createDialogOpen) {
      return;
    }

    if (!projectResourceOptions.some((option) => option.value === selectedResourceId)) {
      setSelectedResourceId(projectResourceOptions[0]?.value ?? "");
    }
  }, [createDialogOpen, projectResourceOptions, selectedResourceId]);

  useEffect(() => {
    if (!createDialogOpen) {
      return;
    }

    if (!projectImageOptions.some((option) => option.value === selectedImageId)) {
      setSelectedImageId(projectImageOptions[0]?.value ?? "");
    }
  }, [createDialogOpen, projectImageOptions, selectedImageId]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredReleases.length / mainSequenceRegistryPageSize));

    if (pageIndex > totalPages - 1) {
      setPageIndex(totalPages - 1);
    }
  }, [filteredReleases.length, pageIndex]);

  function handleSummaryFieldLink(field: SummaryField) {
    const projectLinkId = getProjectIdFromSummaryHref(field.href);
    if (projectLinkId) {
      onOpenProjectDetail(projectLinkId);
      return;
    }

    const jobLinkId = getJobIdFromSummaryHref(field.href);
    if (jobLinkId) {
      onOpenJobDetail(jobLinkId);
      return;
    }

    if (field.href) {
      window.open(field.href, "_blank", "noopener,noreferrer");
    }
  }

  const createDialogTitle = createReleaseKind
    ? `Create ${formatReleaseKind(createReleaseKind).toLowerCase()} release`
    : "Create resource release";
  const releaseReadme = hasResourceReleaseReadme(resourceReleaseSummary)
    ? resourceReleaseSummary.readme
    : undefined;
  const readmeFilesize = formatReadmeFilesize(releaseReadme?.filesize);

  useEffect(() => {
    setSelectedDetailTabId("readme");
  }, [selectedResourceReleaseId]);

  useEffect(() => {
    setPermissionsValue(emptyPermissionAssignments);
  }, [selectedResourceReleaseId]);

  useEffect(() => {
    if (
      selectedDetailTabId !== "permissions" ||
      !selectedResourceReleaseId ||
      !resourceReleaseCanViewQuery.data ||
      !resourceReleaseCanEditQuery.data
    ) {
      return;
    }

    setPermissionsValue(persistedPermissionsValue);
  }, [
    persistedPermissionsValue,
    resourceReleaseCanEditQuery.data,
    resourceReleaseCanViewQuery.data,
    selectedDetailTabId,
    selectedResourceReleaseId,
  ]);

  return (
    <div className="space-y-4">
      {selectedResourceReleaseId ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <button
                type="button"
                className="transition-colors hover:text-foreground"
                onClick={onCloseResourceReleaseDetail}
              >
                Resource releases
              </button>
              <span>/</span>
              <span className="text-foreground">{resourceReleaseTitle}</span>
            </div>
            <Button variant="outline" size="sm" onClick={onCloseResourceReleaseDetail}>
              <ArrowLeft className="h-4 w-4" />
              Back to releases
            </Button>
          </div>

          {resourceReleaseSummaryQuery.isLoading && !resourceReleaseSummary ? (
            <Card>
              <CardContent className="flex min-h-48 items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading resource release details
                </div>
              </CardContent>
            </Card>
          ) : null}

          {resourceReleaseSummaryQuery.isError ? (
            <Card>
              <CardContent className="p-5">
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatMainSequenceError(resourceReleaseSummaryQuery.error)}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {resourceReleaseSummary ? (
            <>
              <MainSequenceEntitySummaryCard
                summary={resourceReleaseSummary}
                onFieldLinkClick={handleSummaryFieldLink}
              />

              <Card>
                <CardHeader className="border-b border-border/70 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {resourceReleaseDetailTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={
                          tab.id === selectedDetailTabId
                            ? "rounded-[calc(var(--radius)-8px)] border border-primary/35 bg-primary/12 px-3 py-2 text-sm font-medium text-topbar-foreground"
                            : "rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/36 hover:text-foreground"
                        }
                        onClick={() => setSelectedDetailTabId(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="pt-5">
                  {selectedDetailTabId === "readme" ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            README
                          </CardTitle>
                          <CardDescription>
                            {releaseReadme?.path ?? "No README path available."}
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {releaseReadme?.last_modified_display ? (
                            <Badge variant="neutral">{releaseReadme.last_modified_display}</Badge>
                          ) : null}
                          {readmeFilesize ? <Badge variant="neutral">{readmeFilesize}</Badge> : null}
                        </div>
                      </div>

                      {releaseReadme?.notice ? (
                        <div className="rounded-[calc(var(--radius)-6px)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
                          {releaseReadme.notice}
                        </div>
                      ) : null}

                      {releaseReadme?.html ? (
                        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-4">
                          <div
                            className="text-sm leading-6 text-foreground [&_a]:text-primary [&_a]:underline [&_code]:rounded-[calc(var(--radius)-10px)] [&_code]:bg-background/70 [&_code]:px-1.5 [&_code]:py-0.5 [&_li]:ml-5 [&_li]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:mb-4 [&_pre]:overflow-x-auto [&_pre]:rounded-[calc(var(--radius)-8px)] [&_pre]:border [&_pre]:border-border/70 [&_pre]:bg-background/70 [&_pre]:p-3 [&_ul]:ml-5 [&_ul]:list-disc"
                            dangerouslySetInnerHTML={{ __html: releaseReadme.html }}
                          />
                        </div>
                      ) : (
                        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3 text-sm text-muted-foreground">
                          {releaseReadme?.empty_message ?? "No README preview available."}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {permissionsTabLoading ? (
                        <div className="flex min-h-48 items-center justify-center">
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading permissions
                          </div>
                        </div>
                      ) : null}

                      {!permissionsTabLoading && permissionsTabError ? (
                        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                          {formatMainSequenceError(permissionsTabError)}
                        </div>
                      ) : null}

                      {!permissionsTabLoading && !permissionsTabError ? (
                        <div className="space-y-3">
                          {updatePermissionsMutation.isPending ? (
                            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3 text-sm text-muted-foreground">
                              Saving permission changes
                            </div>
                          ) : null}

                          <div
                            className={
                              updatePermissionsMutation.isPending
                                ? "pointer-events-none opacity-70"
                                : undefined
                            }
                          >
                            <RbacAssignmentMatrix
                              scopes={resourceReleaseAccessScopes}
                              users={permissionUsers}
                              teams={permissionTeams}
                              value={permissionsValue}
                              onChange={(nextValue) => {
                                if (updatePermissionsMutation.isPending) {
                                  return;
                                }

                                updatePermissionsMutation.mutate(nextValue);
                              }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">Resource releases</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Dashboard and agent releases linked to jobs in this project.
              </p>
            </div>
            <MainSequenceRegistrySearch
              actionMenuLabel="Release actions"
              accessory={
                <>
                  <Badge variant="neutral">{`${filteredReleases.length} releases`}</Badge>
                  <Button
                    size="sm"
                    onClick={() => {
                      createResourceReleaseMutation.reset();
                      setCreateReleaseKind("streamlit_dashboard");
                      setComputeState(createDefaultReleaseComputeState());
                      setCreateDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Create Dashboard Release
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      createResourceReleaseMutation.reset();
                      setCreateReleaseKind("agent");
                      setComputeState(createDefaultReleaseComputeState());
                      setCreateDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Create Agent Release
                  </Button>
                </>
              }
              bulkActions={releaseBulkActions}
              clearSelectionLabel="Clear releases"
              onClearSelection={releaseSelection.clearSelection}
              renderSelectionSummary={(selectionCount) => `${selectionCount} releases selected`}
              value={filterValue}
              onChange={(event) => setFilterValue(event.target.value)}
              placeholder="Filter by subdomain, kind, release id, job id, or resource id"
              searchClassName="max-w-lg"
              selectionCount={releaseSelection.selectedCount}
            />
          </div>

          {projectJobsQuery.isLoading || resourceReleasesQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading resource releases
              </div>
            </div>
          ) : null}

          {projectJobsQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(projectJobsQuery.error)}
            </div>
          ) : null}

          {!projectJobsQuery.isError && resourceReleasesQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(resourceReleasesQuery.error)}
            </div>
          ) : null}

          {!projectJobsQuery.isLoading &&
          !resourceReleasesQuery.isLoading &&
          !projectJobsQuery.isError &&
          !resourceReleasesQuery.isError &&
          filteredReleases.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Rocket className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No resource releases found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Create a dashboard or agent release to start populating this registry.
              </p>
            </div>
          ) : null}

          {!projectJobsQuery.isLoading &&
          !resourceReleasesQuery.isLoading &&
          !projectJobsQuery.isError &&
          !resourceReleasesQuery.isError &&
          filteredReleases.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="w-12 px-3 pb-2">
                      <MainSequenceSelectionCheckbox
                        ariaLabel="Select all visible resource releases"
                        checked={releaseSelection.allSelected}
                        indeterminate={releaseSelection.someSelected}
                        onChange={releaseSelection.toggleAll}
                      />
                    </th>
                    <th className="px-4 pb-2">Release</th>
                    <th className="px-4 pb-2">Kind</th>
                    <th className="px-4 pb-2">Resource</th>
                    <th className="px-4 pb-2">Readme</th>
                    <th className="px-4 pb-2">Job</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedReleases.map((release) => {
                    const relatedJob = projectJobsById.get(release.related_job);
                    const selected = releaseSelection.isSelected(release.id);

                    return (
                      <tr key={release.id}>
                        <td className={getRegistryTableCellClassName(selected, "left")}>
                          <MainSequenceSelectionCheckbox
                            ariaLabel={`Select ${release.subdomain}`}
                            checked={selected}
                            onChange={() => releaseSelection.toggleSelection(release.id)}
                          />
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <div className="flex items-start gap-2">
                            <Rocket className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div>
                              <button
                                type="button"
                                className="group inline-flex items-center gap-1.5 rounded-sm text-left font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
                                onClick={() => onOpenResourceReleaseDetail(release.id)}
                                title={`Open ${release.subdomain}`}
                              >
                                <span>{release.subdomain}</span>
                                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                              </button>
                              <div className="mt-1 text-xs text-muted-foreground">{`Release ID ${release.id}`}</div>
                            </div>
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <Badge variant={getReleaseKindBadgeVariant(release.release_kind)}>
                            {formatReleaseKind(release.release_kind)}
                          </Badge>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <div className="flex items-start gap-2">
                            <Boxes className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="text-foreground">{`Resource ${release.resource}`}</div>
                              <div className="mt-1 text-xs text-muted-foreground">Primary release resource</div>
                            </div>
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <div className="text-foreground">
                            {release.readme_resource ? `Resource ${release.readme_resource}` : "No readme"}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {release.readme_resource ? "Readme resource linked" : "No readme resource linked"}
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(selected, "right")}>
                          <div className="text-foreground">{relatedJob?.name ?? `Job ${release.related_job}`}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {relatedJob?.execution_path ?? `Job ${release.related_job}`}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {!projectJobsQuery.isLoading &&
          !resourceReleasesQuery.isLoading &&
          !projectJobsQuery.isError &&
          !resourceReleasesQuery.isError &&
          filteredReleases.length > 0 ? (
            <MainSequenceRegistryPagination
              count={filteredReleases.length}
              itemLabel="releases"
              pageIndex={pageIndex}
              pageSize={mainSequenceRegistryPageSize}
              onPageChange={setPageIndex}
            />
          ) : null}
        </>
      )}

      <Dialog
        title={createDialogTitle}
        open={createDialogOpen}
        onClose={() => {
          if (!createResourceReleaseMutation.isPending) {
            setCreateDialogOpen(false);
          }
        }}
        className="max-w-[min(760px,calc(100vw-24px))]"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Image
            </div>
            <PickerField
              value={selectedImageId}
              onChange={setSelectedImageId}
              options={projectImageOptions}
              placeholder="Select an image"
              searchPlaceholder="Search images"
              emptyMessage="No ready commit-based images available."
              loading={projectImagesQuery.isLoading}
            />
          </div>

          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Resource
            </div>
            <PickerField
              value={selectedResourceId}
              onChange={setSelectedResourceId}
              options={projectResourceOptions}
              placeholder="Select a resource"
              searchPlaceholder="Search resources"
              emptyMessage={
                selectedProjectImage
                  ? "No matching resources for this image commit."
                  : "Select an image first."
              }
              disabled={!selectedProjectImage}
              loading={releaseResourcesQuery.isLoading}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                CPU
              </label>
              <Input
                value={computeState.cpuRequest}
                onChange={(event) => {
                  createResourceReleaseMutation.reset();
                  setComputeState((current) => ({
                    ...current,
                    cpuRequest: event.target.value,
                  }));
                }}
                placeholder="100m"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Memory
              </label>
              <Input
                value={computeState.memoryRequest}
                onChange={(event) => {
                  createResourceReleaseMutation.reset();
                  setComputeState((current) => ({
                    ...current,
                    memoryRequest: event.target.value,
                  }));
                }}
                placeholder="512Mi"
              />
            </div>

            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Capacity
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={computeState.spot ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => {
                    createResourceReleaseMutation.reset();
                    setComputeState((current) => ({
                      ...current,
                      spot: true,
                    }));
                  }}
                >
                  Spot
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!computeState.spot ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => {
                    createResourceReleaseMutation.reset();
                    setComputeState((current) => ({
                      ...current,
                      spot: false,
                    }));
                  }}
                >
                  Standard
                </Button>
              </div>
            </div>
          </div>

          {releaseResourcesQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(releaseResourcesQuery.error)}
            </div>
          ) : null}

          {projectImagesQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(projectImagesQuery.error)}
            </div>
          ) : null}

          {createResourceReleaseMutation.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(createResourceReleaseMutation.error)}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={createResourceReleaseMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedResourceId || !selectedImageId || !createReleaseKind) {
                  return;
                }

                createResourceReleaseMutation.mutate({
                  resource: Number(selectedResourceId),
                  related_image: Number(selectedImageId),
                  cpu_request: computeState.cpuRequest.trim() || "100m",
                  memory_request: computeState.memoryRequest.trim() || "512Mi",
                  release_kind: createReleaseKind,
                  spot: computeState.spot,
                });
              }}
              disabled={
                createResourceReleaseMutation.isPending ||
                releaseResourcesQuery.isLoading ||
                projectImagesQuery.isLoading ||
                !selectedResourceId ||
                !selectedImageId
              }
            >
              {createResourceReleaseMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : createReleaseKind === "agent" ? (
                <Rocket className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {createReleaseKind ? `Create ${formatReleaseKind(createReleaseKind)}` : "Create release"}
            </Button>
          </div>
        </div>
      </Dialog>

      <ActionConfirmationDialog
        title={
          releasesPendingDelete.length > 1
            ? "Delete resource releases"
            : "Delete resource release"
        }
        open={releasesPendingDelete.length > 0}
        onClose={() => {
          if (!deleteResourceReleaseMutation.isPending) {
            setReleasesPendingDelete([]);
          }
        }}
        tone="danger"
        actionLabel="delete"
        objectLabel={releasesPendingDelete.length > 1 ? "resource releases" : "resource release"}
        confirmWord={
          releasesPendingDelete.length > 1
            ? "DELETE RELEASES"
            : "DELETE RELEASE"
        }
        confirmButtonLabel={
          releasesPendingDelete.length > 1
            ? "Delete resource releases"
            : "Delete resource release"
        }
        description="This action removes the selected resource releases."
        specialText="This action cannot be undone."
        objectSummary={
          releasesPendingDelete.length === 1 ? (
            <>
              <div className="font-medium">{releasesPendingDelete[0]?.subdomain}</div>
              <div className="mt-1 text-muted-foreground">
                {releasesPendingDelete[0]
                  ? `Release ID ${releasesPendingDelete[0].id}`
                  : null}
              </div>
            </>
          ) : (
            <>
              <div className="font-medium">
                {releasesPendingDelete.length} resource releases selected
              </div>
              <div className="mt-1 text-muted-foreground">
                {releasesPendingDelete
                  .slice(0, 3)
                  .map((release) => release.subdomain)
                  .join(", ")}
                {releasesPendingDelete.length > 3 ? ", ..." : ""}
              </div>
            </>
          )
        }
        error={
          deleteResourceReleaseMutation.isError
            ? formatMainSequenceError(deleteResourceReleaseMutation.error)
            : undefined
        }
        isPending={deleteResourceReleaseMutation.isPending}
        onConfirm={() => {
          if (releasesPendingDelete.length === 0) {
            return;
          }

          return deleteResourceReleaseMutation.mutateAsync(releasesPendingDelete);
        }}
      />
    </div>
  );
}
