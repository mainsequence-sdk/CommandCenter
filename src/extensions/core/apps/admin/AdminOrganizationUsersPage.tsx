import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Users } from "lucide-react";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { MainSequenceSelectionCheckbox } from "../../../../../extensions/main_sequence/common/components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../../../../extensions/main_sequence/common/components/registryTable";
import { MainSequenceRegistryPagination } from "../../../../../extensions/main_sequence/common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../../extensions/main_sequence/common/components/MainSequenceRegistrySearch";
import { useRegistrySelection } from "../../../../../extensions/main_sequence/common/hooks/useRegistrySelection";
import { mainSequenceRegistryPageSize } from "../../../../../extensions/main_sequence/common/api";

import {
  bulkDeleteUsers,
  createOrganizationUser,
  listOrganizationUsers,
  makeSelectedUsersAdministrators,
  removeSelectedUsersAsAdministrators,
} from "./api";
import { AdminSurfaceLayout } from "./shared";

function formatOrganizationTeams(value?: Array<{ id: number; name: string }>) {
  if (!value?.length) {
    return "No teams";
  }

  return value.map((team) => team.name).join(", ");
}

function formatGroups(value?: string[]) {
  if (!value?.length) {
    return "No groups";
  }

  return value.join(", ");
}

function formatAdminError(error: unknown) {
  return error instanceof Error ? error.message : "The user request failed.";
}

type OrganizationUserBulkAction = "delete" | "make-admins" | "remove-admins";

export function AdminOrganizationUsersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchValue, setSearchValue] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [activeBulkAction, setActiveBulkAction] = useState<OrganizationUserBulkAction | null>(null);
  const deferredSearchValue = useDeferredValue(searchValue);
  const normalizedSearchValue = deferredSearchValue.trim();
  const normalizedCreateEmail = createEmail.trim().toLowerCase();

  const usersQuery = useQuery({
    queryKey: ["admin", "organization-users", "list", pageIndex, normalizedSearchValue],
    queryFn: () =>
      listOrganizationUsers({
        limit: mainSequenceRegistryPageSize,
        offset: pageIndex * mainSequenceRegistryPageSize,
        search: normalizedSearchValue || undefined,
      }),
  });
  const createUserMutation = useMutation({
    mutationFn: createOrganizationUser,
    onSuccess: async (result, email) => {
      await queryClient.invalidateQueries({
        queryKey: ["admin", "organization-users"],
      });

      setCreateDialogOpen(false);
      setCreateEmail("");

      toast({
        variant: "success",
        title:
          typeof result.detail === "string" && result.detail.trim()
            ? result.detail
            : "User created",
        description: email,
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "User creation failed",
        description: formatAdminError(error),
      });
    },
  });

  const pageRows = usersQuery.data?.results ?? [];
  const selectableRows = useMemo(
    () =>
      pageRows.flatMap((user) => {
        const numericId = Number(user.id);

        if (!Number.isFinite(numericId) || numericId <= 0) {
          return [];
        }

        return [
          {
            id: numericId,
            user,
          },
        ];
      }),
    [pageRows],
  );
  const userSelection = useRegistrySelection(selectableRows);
  const selectedUsers = userSelection.selectedItems.map((item) => item.user);
  const selectedUserIds = userSelection.selectedIds;
  const totalItems = usersQuery.data?.count ?? 0;
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / mainSequenceRegistryPageSize)),
    [totalItems],
  );
  const bulkActionConfig =
    activeBulkAction === "delete"
      ? {
          title: "Delete selected users",
          actionLabel: "Delete Selected Users",
          confirmButtonLabel: "Delete selected users",
          confirmWord: "DELETE",
          tone: "danger" as const,
          specialText:
            "The following command will delete the selected users. However their subscriptions will remain active until the next billing cycle",
          onConfirm: () => bulkDeleteUsers(selectedUserIds),
        }
      : activeBulkAction === "make-admins"
        ? {
            title: "Make selected users administrators",
            actionLabel: "Make Selected Users Administrators",
            confirmButtonLabel: "Make administrators",
            confirmWord: "CONFIRM",
            tone: "warning" as const,
            specialText:
              "The following command will give admin rights to the selected users. Allowing them to manage subscriptions and add or delete users.",
            onConfirm: () => makeSelectedUsersAdministrators(selectedUserIds),
          }
        : activeBulkAction === "remove-admins"
          ? {
              title: "Remove selected users as administrators",
              actionLabel: "Remove Selected Users as Administrators",
              confirmButtonLabel: "Remove administrators",
              confirmWord: "CONFIRM",
              tone: "warning" as const,
              specialText:
                "The following command will remove admin rights to the selected users.",
              onConfirm: () => removeSelectedUsersAsAdministrators(selectedUserIds),
            }
          : null;
  const userBulkActions = useMemo(
    () => [
      {
        id: "delete-users",
        label: "Delete Selected Users",
        tone: "danger" as const,
        onSelect: () => setActiveBulkAction("delete"),
      },
      {
        id: "make-users-admins",
        label: "Make Selected Users Administrators",
        tone: "warning" as const,
        onSelect: () => setActiveBulkAction("make-admins"),
      },
      {
        id: "remove-users-admins",
        label: "Remove Selected Users as Administrators",
        tone: "warning" as const,
        onSelect: () => setActiveBulkAction("remove-admins"),
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
    if (!createDialogOpen) {
      setCreateEmail("");
      createUserMutation.reset();
    }
  }, [createDialogOpen, createUserMutation]);

  function renderSelectedUsersSummary() {
    return (
      <div className="space-y-2">
        {selectedUsers.map((user) => (
          <div key={user.id} className="flex items-center justify-between gap-3">
            <span className="font-medium text-foreground">{user.email || `User ${user.id}`}</span>
            <span className="text-xs text-muted-foreground">#{user.id}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <AdminSurfaceLayout
      title="Organization users"
      description="Browse and manage organization users."
    >
      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Organization user registry</CardTitle>
              <CardDescription>
                Review users, manage access, and add new members.
              </CardDescription>
            </div>
            <MainSequenceRegistrySearch
              actionMenuLabel="User actions"
              bulkActions={userBulkActions}
              accessory={
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">{`${totalItems} users`}</Badge>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setCreateDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Add new user
                  </Button>
                </div>
              }
              selectionCount={userSelection.selectedCount}
              onClearSelection={userSelection.clearSelection}
              renderSelectionSummary={(count: number) => (
                <>
                  <span>{count}</span>
                  <span>{count === 1 ? "user selected" : "users selected"}</span>
                </>
              )}
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search by email or user id"
              searchClassName="max-w-xl"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {usersQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading organization users
              </div>
            </div>
          ) : null}

          {usersQuery.isError ? (
            <div className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatAdminError(usersQuery.error)}
              </div>
            </div>
          ) : null}

          {!usersQuery.isLoading && !usersQuery.isError && totalItems === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Users className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No users found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Clear the current search to review all users.
              </p>
            </div>
          ) : null}

          {!usersQuery.isLoading && !usersQuery.isError && totalItems > 0 ? (
            <div className="overflow-x-auto px-4 py-4">
              <table
                className="w-full min-w-[960px] border-separate text-sm"
                style={{ borderSpacing: "0 var(--table-row-gap-y)" }}
              >
                <thead>
                  <tr
                    className="text-left uppercase tracking-[0.18em] text-muted-foreground"
                    style={{ fontSize: "var(--table-meta-font-size)" }}
                  >
                    <th className="w-12 px-3 py-[var(--table-standard-header-padding-y)]">
                      <MainSequenceSelectionCheckbox
                        ariaLabel="Select all users"
                        checked={userSelection.allSelected}
                        indeterminate={userSelection.someSelected}
                        onChange={userSelection.toggleAll}
                      />
                    </th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Email</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Groups</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Plan</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Teams</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((user) => {
                    const numericId = Number(user.id);
                    const selectable = Number.isFinite(numericId) && numericId > 0;
                    const selected = selectable ? userSelection.isSelected(numericId) : false;

                    return (
                      <tr key={user.id}>
                        <td className={getRegistryTableCellClassName(selected, "left")}>
                          {selectable ? (
                            <MainSequenceSelectionCheckbox
                              ariaLabel={`Select ${user.email || `user ${user.id}`}`}
                              checked={selected}
                              onChange={() => userSelection.toggleSelection(numericId)}
                            />
                          ) : null}
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <div className="font-mono text-xs text-muted-foreground">
                            {user.email || "Not available"}
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <span className="text-muted-foreground">{formatGroups(user.groups)}</span>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <Badge variant="neutral">{user.plan || "Not available"}</Badge>
                        </td>
                        <td className={getRegistryTableCellClassName(selected, "right")}>
                          <span className="text-muted-foreground">
                            {formatOrganizationTeams(user.organizationTeams)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {!usersQuery.isLoading && !usersQuery.isError && totalItems > 0 ? (
            <MainSequenceRegistryPagination
              count={totalItems}
              itemLabel="users"
              pageIndex={pageIndex}
              pageSize={mainSequenceRegistryPageSize}
              onPageChange={setPageIndex}
            />
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={createDialogOpen}
        onClose={() => {
          if (!createUserMutation.isPending) {
            setCreateDialogOpen(false);
          }
        }}
        title="Add new user"
        description="Enter an email address to create a new user."
        className="max-w-[min(560px,calc(100vw-24px))]"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();

            if (!normalizedCreateEmail) {
              return;
            }

            createUserMutation.mutate(normalizedCreateEmail);
          }}
        >
          <div className="space-y-2">
            <label
              htmlFor="admin-create-user-email"
              className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
            >
              Email
            </label>
            <Input
              id="admin-create-user-email"
              type="email"
              value={createEmail}
              onChange={(event) => setCreateEmail(event.target.value)}
              placeholder="name@company.com"
              autoComplete="email"
              autoFocus
              disabled={createUserMutation.isPending}
            />
          </div>

          {createUserMutation.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatAdminError(createUserMutation.error)}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCreateDialogOpen(false);
              }}
              disabled={createUserMutation.isPending}
            >
              Close
            </Button>
            <Button type="submit" disabled={createUserMutation.isPending || !normalizedCreateEmail}>
              {createUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create user
            </Button>
          </div>
        </form>
      </Dialog>

      {bulkActionConfig ? (
        <ActionConfirmationDialog
          open
          title={bulkActionConfig.title}
          actionLabel={bulkActionConfig.actionLabel}
          confirmButtonLabel={bulkActionConfig.confirmButtonLabel}
          confirmWord={bulkActionConfig.confirmWord}
          objectLabel={selectedUsers.length === 1 ? "user" : "users"}
          objectSummary={renderSelectedUsersSummary()}
          specialText={bulkActionConfig.specialText}
          tone={bulkActionConfig.tone}
          onClose={() => setActiveBulkAction(null)}
          onConfirm={bulkActionConfig.onConfirm}
          onSuccess={async () => {
            userSelection.clearSelection();
            setActiveBulkAction(null);
            await queryClient.invalidateQueries({
              queryKey: ["admin", "organization-users"],
            });
          }}
          successToast={{
            title: (result) =>
              typeof result === "object" && result && "detail" in result
                ? String(result.detail)
                : "User action completed",
          }}
        />
      ) : null}
    </AdminSurfaceLayout>
  );
}
