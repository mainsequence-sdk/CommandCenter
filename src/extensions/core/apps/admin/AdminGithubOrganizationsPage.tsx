import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Github, GitBranch, Loader2, Plus } from "lucide-react";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { MainSequenceSelectionCheckbox } from "../../../../../extensions/main_sequence/common/components/MainSequenceSelectionCheckbox";
import { MainSequenceRegistryPagination } from "../../../../../extensions/main_sequence/common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../../extensions/main_sequence/common/components/MainSequenceRegistrySearch";
import { getRegistryTableCellClassName } from "../../../../../extensions/main_sequence/common/components/registryTable";
import { useRegistrySelection } from "../../../../../extensions/main_sequence/common/hooks/useRegistrySelection";
import { mainSequenceRegistryPageSize } from "../../../../../extensions/main_sequence/common/api";

import {
  bulkDeleteGithubOrganizations,
  fetchCurrentOrganizationUid,
  importGithubOrganizationRepositories,
  listGithubOrganizationRepositories,
  listGithubOrganizations,
  startGithubOrganizationConnect,
  type GithubOrganizationImportRepositoryResult,
  type GithubOrganizationRecord,
  type GithubOrganizationRepositoryRecord,
} from "./api";
import { AdminSurfaceLayout } from "./shared";

function formatAdminError(error: unknown) {
  return error instanceof Error ? error.message : "The GitHub organization request failed.";
}

type GithubOrganizationBulkAction = "delete";

export function AdminGithubOrganizationsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchValue, setSearchValue] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [activeBulkAction, setActiveBulkAction] = useState<GithubOrganizationBulkAction | null>(null);
  const [selectedOrganizationForRepositories, setSelectedOrganizationForRepositories] =
    useState<GithubOrganizationRecord | null>(null);
  const [projectNamesByRepositoryId, setProjectNamesByRepositoryId] = useState<Record<number, string>>({});
  const [lastImportResults, setLastImportResults] = useState<GithubOrganizationImportRepositoryResult[]>([]);
  const deferredSearchValue = useDeferredValue(searchValue);
  const normalizedSearchValue = deferredSearchValue.trim();
  const organizationUidQuery = useQuery({
    queryKey: ["admin", "organization", "uid"],
    queryFn: fetchCurrentOrganizationUid,
    staleTime: 300_000,
  });
  const connectOrganizationMutation = useMutation({
    mutationFn: startGithubOrganizationConnect,
    onSuccess: (result) => {
      if (typeof result.redirect_url !== "string" || !result.redirect_url.trim()) {
        toast({
          variant: "error",
          title: "Connect organization failed",
          description: "Connect start response did not include a redirect URL.",
        });
        return;
      }

      window.location.assign(result.redirect_url);
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Connect organization failed",
        description: formatAdminError(error),
      });
    },
  });

  const githubOrganizationsQuery = useQuery({
    queryKey: ["admin", "github-organizations", "list", pageIndex, normalizedSearchValue],
    queryFn: () =>
      listGithubOrganizations({
        limit: mainSequenceRegistryPageSize,
        offset: pageIndex * mainSequenceRegistryPageSize,
        search: normalizedSearchValue || undefined,
      }),
  });

  const pageRows = githubOrganizationsQuery.data?.results ?? [];
  const selectableRows = useMemo(
    () =>
      pageRows.map((organization) => ({
        id: organization.uid,
        organization,
      })),
    [pageRows],
  );
  const organizationSelection = useRegistrySelection(selectableRows, (row) => row.id);
  const selectedOrganizations = organizationSelection.selectedItems.map((item) => item.organization);
  const selectedOrganizationUids = organizationSelection.selectedIds;
  const selectedRepositoryOrganizationUid = selectedOrganizationForRepositories?.uid ?? "";
  const totalItems = githubOrganizationsQuery.data?.count ?? 0;
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / mainSequenceRegistryPageSize)),
    [totalItems],
  );
  const importRepositoriesQuery = useQuery({
    queryKey: [
      "admin",
      "github-organizations",
      "repositories",
      selectedRepositoryOrganizationUid || null,
    ],
    queryFn: () => listGithubOrganizationRepositories(selectedRepositoryOrganizationUid),
    enabled: selectedRepositoryOrganizationUid.length > 0,
    retry: false,
  });
  const repositorySelectableRows = useMemo(
    () =>
      (importRepositoriesQuery.data?.repositories ?? []).map((repository) => ({
        id: repository.github_repository_id,
        repository,
      })),
    [importRepositoriesQuery.data?.repositories],
  );
  const repositorySelection = useRegistrySelection(repositorySelectableRows);
  const selectedRepositories = repositorySelection.selectedItems.map((item) => item.repository);
  const importRepositoriesMutation = useMutation({
    mutationFn: ({
      organizationUid,
      repositories,
    }: {
      organizationUid: string;
      repositories: Array<{
        github_repository_id: number;
        full_name: string;
        project_name: string;
      }>;
    }) => importGithubOrganizationRepositories(organizationUid, repositories),
    onSuccess: async (result) => {
      setLastImportResults(result.results);
      const createdCount = result.results.filter((entry) => entry.status === "created").length;
      const failedCount = result.results.filter((entry) => entry.status !== "created").length;
      toast({
        variant: "success",
        title: "Repository import completed",
        description:
          failedCount > 0
            ? `${createdCount} created, ${failedCount} need attention.`
            : createdCount > 0
              ? `${createdCount} projects were created.`
              : "No projects were created.",
      });
      repositorySelection.clearSelection();
      await queryClient.invalidateQueries({
        queryKey: [
          "admin",
          "github-organizations",
          "repositories",
          selectedRepositoryOrganizationUid || null,
        ],
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Repository import failed",
        description: formatAdminError(error),
      });
    },
  });
  const bulkActionConfig =
    activeBulkAction === "delete"
      ? {
          title: "Delete Organization",
          actionLabel: "Delete Organization",
          confirmButtonLabel: "Delete organizations",
            confirmWord: "DELETE",
            tone: "danger" as const,
            onConfirm: () => bulkDeleteGithubOrganizations(selectedOrganizationUids),
          }
      : null;
  const githubOrganizationBulkActions = useMemo(
    () => [
      {
        id: "delete-organizations",
        label: "Delete Organization",
        tone: "danger" as const,
        onSelect: () => setActiveBulkAction("delete"),
      },
    ],
    [],
  );

  useEffect(() => {
    setPageIndex(0);
  }, [normalizedSearchValue]);

  useEffect(() => {
    if (pageIndex > totalPages - 1) {
      setPageIndex(totalPages - 1);
    }
  }, [pageIndex, totalPages]);

  useEffect(() => {
    const repositories = importRepositoriesQuery.data?.repositories ?? [];

    if (repositories.length === 0) {
      return;
    }

    setProjectNamesByRepositoryId((current) => {
      let changed = false;
      const next = { ...current };

      repositories.forEach((repository) => {
        const suggestedName =
          repository.suggested_project_name?.trim() ||
          repository.name?.trim() ||
          repository.full_name?.split("/").at(-1)?.trim() ||
          "";

        if (!next[repository.github_repository_id] && suggestedName) {
          next[repository.github_repository_id] = suggestedName;
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [importRepositoriesQuery.data?.repositories]);

  function renderSelectedOrganizationsSummary() {
    return (
      <div className="space-y-2">
        {selectedOrganizations.map((organization) => (
          <div key={organization.uid} className="flex items-center justify-between gap-3">
            <span className="font-medium text-foreground">{organization.login}</span>
            <span className="text-xs text-muted-foreground">{organization.uid}</span>
          </div>
        ))}
      </div>
    );
  }

  function handleConnectOrganization() {
    const organizationUid = organizationUidQuery.data;

    if (!organizationUid) {
      toast({
        variant: "error",
        title: "Connect organization failed",
        description: organizationUidQuery.isError
          ? formatAdminError(organizationUidQuery.error)
          : "Current organization uid is not available yet.",
      });
      return;
    }

    connectOrganizationMutation.mutate(organizationUid);
  }

  function openOrganizationRepositories(organization: GithubOrganizationRecord) {
    repositorySelection.clearSelection();
    setProjectNamesByRepositoryId({});
    setLastImportResults([]);
    setSelectedOrganizationForRepositories(organization);
  }

  function closeOrganizationRepositories() {
    repositorySelection.clearSelection();
    setProjectNamesByRepositoryId({});
    setLastImportResults([]);
    setSelectedOrganizationForRepositories(null);
  }

  function handleImportSelectedRepositories() {
    if (!selectedOrganizationForRepositories) {
      return;
    }

    const repositories = selectedRepositories
      .map((repository) => ({
        github_repository_id: repository.github_repository_id,
        full_name: repository.full_name || repository.name,
        project_name:
          projectNamesByRepositoryId[repository.github_repository_id]?.trim() ||
          repository.suggested_project_name?.trim() ||
          repository.name,
      }))
      .filter((repository) => repository.project_name.trim().length > 0);

    if (repositories.length === 0) {
      toast({
        variant: "error",
        title: "No repositories selected",
        description: "Select at least one repository.",
      });
      return;
    }

    importRepositoriesMutation.mutate({
      organizationUid: selectedOrganizationForRepositories.uid,
      repositories,
    });
  }

  function getImportResultVariant(status: string) {
    if (status === "created") {
      return "success" as const;
    }

    if (status === "already_exists") {
      return "neutral" as const;
    }

    return "warning" as const;
  }

  return (
    <AdminSurfaceLayout
      title="GitHub organizations"
      description="Browse GitHub organizations from the pod-manager registry."
    >
      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>GitHub organization registry</CardTitle>
              <CardDescription>
                This list uses the pod-manager <code>github-organization</code> endpoint.
              </CardDescription>
            </div>
            <MainSequenceRegistrySearch
              actionMenuLabel="Organization actions"
              bulkActions={githubOrganizationBulkActions}
              accessory={
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">{`${totalItems} organizations`}</Badge>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConnectOrganization}
                    disabled={organizationUidQuery.isLoading || connectOrganizationMutation.isPending}
                  >
                    {organizationUidQuery.isLoading || connectOrganizationMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Connect Organization
                  </Button>
                </div>
              }
              selectionCount={organizationSelection.selectedCount}
              onClearSelection={organizationSelection.clearSelection}
              renderSelectionSummary={(count: number) => (
                <>
                  <span>{count}</span>
                  <span>{count === 1 ? "organization selected" : "organizations selected"}</span>
                </>
              )}
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search by login or display name"
              searchClassName="max-w-xl"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {githubOrganizationsQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading GitHub organizations
              </div>
            </div>
          ) : null}

          {githubOrganizationsQuery.isError ? (
            <div className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatAdminError(githubOrganizationsQuery.error)}
              </div>
            </div>
          ) : null}

          {!githubOrganizationsQuery.isLoading &&
          !githubOrganizationsQuery.isError &&
          totalItems === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Github className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">
                No GitHub organizations found
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Clear the current search or verify the pod-manager organization registry.
              </p>
            </div>
          ) : null}

          {!githubOrganizationsQuery.isLoading &&
          !githubOrganizationsQuery.isError &&
          totalItems > 0 ? (
            <div className="overflow-x-auto px-4 py-4">
              <table
                className="w-full min-w-[720px] border-separate text-sm"
                style={{ borderSpacing: "0 var(--table-row-gap-y)" }}
              >
                <thead>
                  <tr
                    className="text-left uppercase tracking-[0.18em] text-muted-foreground"
                    style={{ fontSize: "var(--table-meta-font-size)" }}
                  >
                    <th className="w-12 px-3 py-[var(--table-standard-header-padding-y)]">
                      <MainSequenceSelectionCheckbox
                        ariaLabel="Select all GitHub organizations"
                        checked={organizationSelection.allSelected}
                        indeterminate={organizationSelection.someSelected}
                        onChange={organizationSelection.toggleAll}
                      />
                    </th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Login</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                      Display name
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((organization) => {
                    const selected = organizationSelection.isSelected(organization.uid);

                    return (
                      <tr
                        key={organization.uid}
                        className="cursor-pointer"
                        onClick={() => openOrganizationRepositories(organization)}
                      >
                        <td
                          className={getRegistryTableCellClassName(selected, "left")}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MainSequenceSelectionCheckbox
                            ariaLabel={`Select ${organization.login}`}
                            checked={selected}
                            onChange={() => organizationSelection.toggleSelection(organization.uid)}
                          />
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <button
                              type="button"
                              className="font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
                              onClick={(event) => {
                                event.stopPropagation();
                                openOrganizationRepositories(organization);
                              }}
                            >
                              {organization.login}
                            </button>
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <button
                            type="button"
                            className="text-left text-muted-foreground transition-colors hover:text-foreground"
                            onClick={(event) => {
                              event.stopPropagation();
                              openOrganizationRepositories(organization);
                            }}
                          >
                            {organization.display_name || "Not available"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {!githubOrganizationsQuery.isLoading &&
          !githubOrganizationsQuery.isError &&
          totalItems > 0 ? (
            <MainSequenceRegistryPagination
              count={totalItems}
              itemLabel="organizations"
              pageIndex={pageIndex}
              pageSize={mainSequenceRegistryPageSize}
              onPageChange={setPageIndex}
            />
          ) : null}
        </CardContent>
      </Card>

      {bulkActionConfig ? (
        <ActionConfirmationDialog
          open
          title={bulkActionConfig.title}
          actionLabel={bulkActionConfig.actionLabel}
          confirmButtonLabel={bulkActionConfig.confirmButtonLabel}
          confirmWord={bulkActionConfig.confirmWord}
          objectLabel={selectedOrganizations.length === 1 ? "organization" : "organizations"}
          objectSummary={renderSelectedOrganizationsSummary()}
          tone={bulkActionConfig.tone}
          onClose={() => setActiveBulkAction(null)}
          onConfirm={bulkActionConfig.onConfirm}
          onSuccess={async () => {
            organizationSelection.clearSelection();
            setActiveBulkAction(null);
            await queryClient.invalidateQueries({
              queryKey: ["admin", "github-organizations"],
            });
          }}
          successToast={{
            title: (result) =>
              typeof result === "object" && result && "detail" in result
                ? String(result.detail)
                : "GitHub organization action completed",
          }}
        />
      ) : null}

      <Dialog
        open={selectedOrganizationForRepositories !== null}
        onClose={closeOrganizationRepositories}
        title={
          selectedOrganizationForRepositories
            ? `${selectedOrganizationForRepositories.login} repositories`
            : "Repositories"
        }
        description="Select repositories to import as projects for this GitHub organization."
        className="max-w-[min(960px,calc(100vw-24px))]"
      >
        <div className="space-y-4">
          {importRepositoriesQuery.isLoading ? (
            <div className="flex min-h-48 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading repositories
              </div>
            </div>
          ) : null}

          {importRepositoriesQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatAdminError(importRepositoriesQuery.error)}
            </div>
          ) : null}

          {!importRepositoriesQuery.isLoading &&
          !importRepositoriesQuery.isError &&
          (importRepositoriesQuery.data?.repositories.length ?? 0) === 0 ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/45 text-primary">
                <GitBranch className="h-5 w-5" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No repositories returned</div>
              <p className="mt-2 text-sm text-muted-foreground">
                The repositories endpoint did not return any repositories for this organization.
              </p>
            </div>
          ) : null}

          {!importRepositoriesQuery.isLoading &&
          !importRepositoriesQuery.isError &&
          (importRepositoriesQuery.data?.repositories.length ?? 0) > 0 ? (
            <div className="space-y-4">
              {lastImportResults.length > 0 ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-4">
                  <div className="mb-3 text-sm font-medium text-foreground">Last import result</div>
                  <div className="space-y-2">
                    {lastImportResults.map((result, index) => (
                      <div
                        key={`${result.full_name}-${result.project_name}-${index}`}
                        className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/45 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{result.full_name}</span>
                          <Badge variant={getImportResultVariant(result.status)}>{result.status}</Badge>
                          {result.project_uid ? (
                            <Badge variant="neutral">{`Project ${result.project_uid}`}</Badge>
                          ) : null}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {result.project_name}
                          {result.detail?.trim() ? ` - ${result.detail.trim()}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="overflow-x-auto">
              <table
                className="w-full min-w-[980px] border-separate text-sm"
                style={{ borderSpacing: "0 var(--table-row-gap-y)" }}
              >
                <thead>
                  <tr
                    className="text-left uppercase tracking-[0.18em] text-muted-foreground"
                    style={{ fontSize: "var(--table-meta-font-size)" }}
                  >
                    <th className="w-12 px-3 py-[var(--table-standard-header-padding-y)]">
                      <MainSequenceSelectionCheckbox
                        ariaLabel="Select all repositories"
                        checked={repositorySelection.allSelected}
                        indeterminate={repositorySelection.someSelected}
                        onChange={repositorySelection.toggleAll}
                      />
                    </th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Repository</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Project name</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Branch</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Visibility</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Linked state</th>
                  </tr>
                </thead>
                <tbody>
                  {importRepositoriesQuery.data?.repositories.map((repository, index) => {
                    const key = repository.github_repository_id || index;
                    const selected = repositorySelection.isSelected(repository.github_repository_id);
                    const projectName =
                      projectNamesByRepositoryId[repository.github_repository_id] ??
                      repository.suggested_project_name ??
                      repository.name;

                    return (
                      <tr key={String(key)}>
                        <td className={getRegistryTableCellClassName(selected, "left")}>
                          <MainSequenceSelectionCheckbox
                            ariaLabel={`Select ${repository.full_name || repository.name}`}
                            checked={selected}
                            onChange={() => repositorySelection.toggleSelection(repository.github_repository_id)}
                          />
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <div className="font-medium text-foreground">
                            {repository.full_name || repository.name}
                          </div>
                          {repository.full_name && repository.full_name !== repository.name ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {repository.name}
                            </div>
                          ) : null}
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <Input
                            value={projectName}
                            disabled={importRepositoriesMutation.isPending}
                            onChange={(event) =>
                              setProjectNamesByRepositoryId((current) => ({
                                ...current,
                                [repository.github_repository_id]: event.target.value,
                              }))
                            }
                            className="h-9"
                          />
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <span className="text-foreground">
                            {repository.default_branch?.trim() || "Not available"}
                          </span>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <Badge variant={repository.is_private ? "warning" : "success"}>
                            {repository.is_private ? "Private" : "Public"}
                          </Badge>
                        </td>
                        <td className={getRegistryTableCellClassName(selected, "right")}>
                          <div className="flex flex-wrap justify-end gap-2">
                            {repository.existing_project_uid ? (
                              <Badge variant="neutral">{`Project ${repository.existing_project_uid}`}</Badge>
                            ) : null}
                            {repository.existing_git_repository_uid ? (
                              <Badge variant="neutral">{`Git repo ${repository.existing_git_repository_uid}`}</Badge>
                            ) : null}
                            {!repository.existing_project_uid && !repository.existing_git_repository_uid ? (
                              <Badge variant="neutral">Not linked</Badge>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>

              <div className="flex justify-end gap-2 border-t border-border/70 pt-4">
                <Button
                  variant="ghost"
                  onClick={closeOrganizationRepositories}
                  disabled={importRepositoriesMutation.isPending}
                >
                  Close
                </Button>
                <Button
                  onClick={handleImportSelectedRepositories}
                  disabled={repositorySelection.selectedCount === 0 || importRepositoriesMutation.isPending}
                >
                  {importRepositoriesMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <GitBranch className="h-4 w-4" />
                  )}
                  Import selected
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Dialog>
    </AdminSurfaceLayout>
  );
}
