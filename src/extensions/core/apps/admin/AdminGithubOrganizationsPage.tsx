import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Github, Loader2, Plus } from "lucide-react";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toaster";
import { MainSequenceSelectionCheckbox } from "../../../../../extensions/main_sequence/common/components/MainSequenceSelectionCheckbox";
import { MainSequenceRegistryPagination } from "../../../../../extensions/main_sequence/common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../../extensions/main_sequence/common/components/MainSequenceRegistrySearch";
import { getRegistryTableCellClassName } from "../../../../../extensions/main_sequence/common/components/registryTable";
import { useRegistrySelection } from "../../../../../extensions/main_sequence/common/hooks/useRegistrySelection";
import { mainSequenceRegistryPageSize } from "../../../../../extensions/main_sequence/common/api";

import {
  bulkDeleteGithubOrganizations,
  fetchCurrentOrganizationId,
  importGithubOrganizationProjects,
  listGithubOrganizations,
  startGithubOrganizationConnect,
} from "./api";
import { AdminSurfaceLayout } from "./shared";

function formatAdminError(error: unknown) {
  return error instanceof Error ? error.message : "The GitHub organization request failed.";
}

type GithubOrganizationBulkAction = "delete" | "import-projects";

export function AdminGithubOrganizationsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchValue, setSearchValue] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [activeBulkAction, setActiveBulkAction] = useState<GithubOrganizationBulkAction | null>(
    null,
  );
  const deferredSearchValue = useDeferredValue(searchValue);
  const normalizedSearchValue = deferredSearchValue.trim();
  const organizationIdQuery = useQuery({
    queryKey: ["admin", "organization", "id"],
    queryFn: fetchCurrentOrganizationId,
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
        id: organization.id,
        organization,
      })),
    [pageRows],
  );
  const organizationSelection = useRegistrySelection(selectableRows);
  const selectedOrganizations = organizationSelection.selectedItems.map((item) => item.organization);
  const selectedOrganizationIds = organizationSelection.selectedIds;
  const totalItems = githubOrganizationsQuery.data?.count ?? 0;
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / mainSequenceRegistryPageSize)),
    [totalItems],
  );
  const bulkActionConfig =
    activeBulkAction === "delete"
      ? {
          title: "Delete Organization",
          actionLabel: "Delete Organization",
          confirmButtonLabel: "Delete organizations",
          confirmWord: "DELETE",
          tone: "danger" as const,
          onConfirm: () => bulkDeleteGithubOrganizations(selectedOrganizationIds),
        }
      : activeBulkAction === "import-projects"
        ? {
            title: "Import repositories in this organization as projects",
            actionLabel: "Import repositories in this organization as projects",
            confirmButtonLabel: "Import projects",
            confirmWord: "IMPORT",
            tone: "primary" as const,
            onConfirm: () => importGithubOrganizationProjects(selectedOrganizationIds),
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
      {
        id: "import-organization-projects",
        label: "Import repositories in this organization as projects",
        tone: "primary" as const,
        onSelect: () => setActiveBulkAction("import-projects"),
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

  function renderSelectedOrganizationsSummary() {
    return (
      <div className="space-y-2">
        {selectedOrganizations.map((organization) => (
          <div key={organization.id} className="flex items-center justify-between gap-3">
            <span className="font-medium text-foreground">{organization.login}</span>
            <span className="text-xs text-muted-foreground">#{organization.id}</span>
          </div>
        ))}
      </div>
    );
  }

  function handleConnectOrganization() {
    const organizationId = organizationIdQuery.data;

    if (!organizationId) {
      toast({
        variant: "error",
        title: "Connect organization failed",
        description: organizationIdQuery.isError
          ? formatAdminError(organizationIdQuery.error)
          : "Current organization id is not available yet.",
      });
      return;
    }

    connectOrganizationMutation.mutate(organizationId);
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
                    disabled={organizationIdQuery.isLoading || connectOrganizationMutation.isPending}
                  >
                    {organizationIdQuery.isLoading || connectOrganizationMutation.isPending ? (
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
                    const selected = organizationSelection.isSelected(organization.id);

                    return (
                      <tr key={organization.id}>
                        <td className={getRegistryTableCellClassName(selected, "left")}>
                          <MainSequenceSelectionCheckbox
                            ariaLabel={`Select ${organization.login}`}
                            checked={selected}
                            onChange={() => organizationSelection.toggleSelection(organization.id)}
                          />
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <span className="font-medium text-foreground">
                              {organization.login}
                            </span>
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <span className="text-muted-foreground">
                            {organization.display_name || "Not available"}
                          </span>
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
    </AdminSurfaceLayout>
  );
}
