import { useDeferredValue, useEffect, useEffectEvent, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown, ChevronDown, ChevronUp, Loader2, Plus, Users } from "lucide-react";

import { useAuthStore } from "@/auth/auth-store";
import type { AppUser } from "@/auth/types";
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
  AdminRequestError,
  bulkDeleteUsers,
  createOrganizationUser,
  fetchCurrentOrganizationUid,
  listOrganizationUsers,
  makeSelectedUsersAdministrators,
  type OrganizationUserCreateResponse,
  removeSelectedUsersAsAdministrators,
} from "./api";
import { AdminSurfaceLayout } from "./shared";

function formatOrganizationTeams(value?: Array<{ id: number; name: string }>) {
  if (!value?.length) {
    return "No teams";
  }

  return value.map((team) => team.name).join(", ");
}

function getUserUid(user: AppUser) {
  return typeof user.uid === "string" && user.uid.trim() ? user.uid.trim() : "";
}

function formatAdminError(error: unknown) {
  return error instanceof Error ? error.message : "The user request failed.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePlan(value: unknown): AppUser["plan"] {
  if (typeof value === "string" && value.trim()) {
    const name = value.trim();

    return {
      name,
      plan_type: name,
    };
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const planType = readTrimmedString(value.plan_type ?? value.planType ?? value.type);
  const name =
    readTrimmedString(value.name) ||
    readTrimmedString(value.plan_name ?? value.planName) ||
    planType;
  const price =
    typeof value.price === "number" && Number.isFinite(value.price)
      ? value.price
      : undefined;
  const description = readTrimmedString(value.description);

  if (!name && price === undefined && !description && !planType) {
    return undefined;
  }

  const plan: NonNullable<AppUser["plan"]> = {
    name: name || "Plan",
  };

  if (price !== undefined) {
    plan.price = price;
  }

  if (description) {
    plan.description = description;
  }

  if (planType) {
    plan.plan_type = planType;
  }

  return plan;
}

function formatPlanName(plan?: AppUser["plan"]) {
  return plan?.name?.trim() || "Not available";
}

function readPayloadMessage(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .join(", ");
}

function readPayloadFieldMessage(payload: unknown, field: string) {
  if (!isRecord(payload)) {
    return "";
  }

  return readPayloadMessage(payload[field]);
}

function readPayloadUpgradeMessage(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.upgrade)) {
    return "";
  }

  return readTrimmedString(payload.upgrade.message);
}

function normalizeCreatedOrganizationUser(payload: OrganizationUserCreateResponse): AppUser {
  const organizationTeams = (Array.isArray(payload.teams) ? payload.teams : []).flatMap((team) => {
    if (!isRecord(team)) {
      return [];
    }

    const id = Number(team.id);
    const name = readTrimmedString(team.name);

    if (!Number.isFinite(id) || id <= 0 || !name) {
      return [];
    }

    return [{
      id,
      name,
      description: "",
      is_active: true,
    }];
  });
  const email = readTrimmedString(payload.email);
  const firstName = readTrimmedString(payload.first_name);
  const lastName = readTrimmedString(payload.last_name);
  const name = [firstName, lastName].filter(Boolean).join(" ").trim() || email || `User ${payload.id}`;

  return {
    id: String(payload.id),
    name,
    email,
    first_name: firstName || undefined,
    last_name: lastName || undefined,
    avatarUrl: readTrimmedString(payload.profile_picture) || undefined,
    plan: normalizePlan(payload.plan),
    team: organizationTeams[0]?.name ?? "Unknown",
    role: "user",
    permissions: [],
    organizationTeams,
  };
}

function createdUserMatchesSearch(user: AppUser, normalizedSearchValue: string) {
  if (!normalizedSearchValue) {
    return true;
  }

  const haystack = [
    user.email,
    user.name,
    user.first_name,
    user.last_name,
    formatPlanName(user.plan),
    ...(user.organizationTeams ?? []).map((team) => team.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedSearchValue.toLowerCase());
}

function formatCreatedUserSummary(user: AppUser) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();

  if (fullName && user.email) {
    return `${fullName} (${user.email})`;
  }

  return user.email || user.name || `User ${user.id}`;
}

function describeCreateUserError(error: unknown) {
  if (!error) {
    return {
      email: "",
      title: "",
      detail: "",
    };
  }

  if (!(error instanceof AdminRequestError)) {
    return {
      email: "",
      title: "User creation failed",
      detail: formatAdminError(error),
    };
  }

  if (error.status === 400) {
    const emailError = readPayloadFieldMessage(error.payload, "email");

    if (emailError) {
      return {
        email: emailError,
        title: "",
        detail: "",
      };
    }

    return {
      email: "",
      title: "Organization validation failed",
      detail:
        "The organization could not add this user because the request became invalid while it was being processed.",
    };
  }

  if (error.status === 403) {
    const code = readPayloadFieldMessage(error.payload, "code");
    const title = readPayloadFieldMessage(error.payload, "title");
    const detail = readPayloadFieldMessage(error.payload, "detail");
    const upgradeMessage = readPayloadUpgradeMessage(error.payload);

    if (code === "organization_membership_upgrade_required") {
      return {
        email: "",
        title: title || "Upgrade required",
        detail: [detail, upgradeMessage || "Upgrade your organization plan to add team members."]
          .filter((value, index, values) => value && values.indexOf(value) === index)
          .join("\n"),
      };
    }

    if (
      detail.toLowerCase().includes("organization admin") ||
      detail.toLowerCase().includes("org admin")
    ) {
      return {
        email: "",
        title: title || "Organization admin required",
        detail: "Only organization admins can add users.",
      };
    }

    return {
      email: "",
      title: title || (upgradeMessage ? "Upgrade required" : "Access denied"),
      detail: [
        detail || "You do not have access to add users for this organization.",
        upgradeMessage,
      ]
        .filter((value, index, values) => value && values.indexOf(value) === index)
        .join("\n"),
    };
  }

  if (error.status === 404) {
    return {
      email: "",
      title: "Access denied",
      detail: "You do not have access to add users for this organization.",
    };
  }

  return {
    email: "",
    title: "User creation failed",
    detail: formatAdminError(error),
  };
}

type OrganizationUserBulkAction = "delete" | "make-admins" | "remove-admins";
type OrganizationUserSortKey =
  | "email"
  | "first_name"
  | "last_name"
  | "plan"
  | "teams";
type OrganizationUserSortDirection = "asc" | "desc";

const organizationUsersSortCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function normalizeSortValue(value?: string) {
  return value?.trim() ?? "";
}

function getOrganizationUserSortValue(user: AppUser, key: OrganizationUserSortKey) {
  switch (key) {
    case "email":
      return normalizeSortValue(user.email);
    case "first_name":
      return normalizeSortValue(user.first_name);
    case "last_name":
      return normalizeSortValue(user.last_name);
    case "plan":
      return normalizeSortValue(formatPlanName(user.plan));
    case "teams":
      return normalizeSortValue(user.organizationTeams?.map((team) => team.name).join(", "));
  }
}

function compareOrganizationUsers(
  left: AppUser,
  right: AppUser,
  key: OrganizationUserSortKey,
  direction: OrganizationUserSortDirection,
) {
  const leftValue = getOrganizationUserSortValue(left, key);
  const rightValue = getOrganizationUserSortValue(right, key);
  const leftMissing = !leftValue;
  const rightMissing = !rightValue;

  if (leftMissing && rightMissing) {
    return organizationUsersSortCollator.compare(left.email, right.email);
  }

  if (leftMissing) {
    return 1;
  }

  if (rightMissing) {
    return -1;
  }

  const comparison =
    direction === "asc"
      ? organizationUsersSortCollator.compare(leftValue, rightValue)
      : organizationUsersSortCollator.compare(rightValue, leftValue);

  if (comparison !== 0) {
    return comparison;
  }

  return organizationUsersSortCollator.compare(left.email, right.email);
}

export function AdminOrganizationUsersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchValue, setSearchValue] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [sortState, setSortState] = useState<{
    direction: OrganizationUserSortDirection;
    key: OrganizationUserSortKey | null;
  }>({
    direction: "asc",
    key: null,
  });
  const [activeBulkAction, setActiveBulkAction] = useState<OrganizationUserBulkAction | null>(null);
  const deferredSearchValue = useDeferredValue(searchValue);
  const normalizedSearchValue = deferredSearchValue.trim();
  const normalizedCreateEmail = createEmail.trim().toLowerCase();
  const normalizedCreateFirstName = createFirstName.trim();
  const normalizedCreateLastName = createLastName.trim();
  const usersQueryKey = ["admin", "organization-users", "list", pageIndex, normalizedSearchValue] as const;
  const organizationUidQuery = useQuery({
    queryKey: ["admin", "organization", "uid"],
    queryFn: fetchCurrentOrganizationUid,
    staleTime: 300_000,
  });

  const usersQuery = useQuery({
    queryKey: usersQueryKey,
    queryFn: () =>
      listOrganizationUsers({
        limit: mainSequenceRegistryPageSize,
        offset: pageIndex * mainSequenceRegistryPageSize,
        search: normalizedSearchValue || undefined,
      }),
  });
  const createUserMutation = useMutation({
    mutationFn: async (payload: { email: string; first_name?: string; last_name?: string }) => {
      const organizationUid = organizationUidQuery.data ?? (await fetchCurrentOrganizationUid());

      return createOrganizationUser(organizationUid, payload);
    },
    onSuccess: async (result, payload) => {
      const createdUser = normalizeCreatedOrganizationUser(result);

      if (pageIndex === 0 && createdUserMatchesSearch(createdUser, normalizedSearchValue)) {
        queryClient.setQueryData<Awaited<ReturnType<typeof listOrganizationUsers>>>(
          usersQueryKey,
          (current) => {
            if (!current) {
              return current;
            }

            const alreadyPresent = current.results.some(
              (existingUser) => String(existingUser.id) === String(createdUser.id),
            );
            const remainingUsers = current.results.filter(
              (existingUser) => String(existingUser.id) !== String(createdUser.id),
            );

            return {
              ...current,
              count: alreadyPresent ? current.count : current.count + 1,
              results: [createdUser, ...remainingUsers].slice(
                0,
                Math.max(current.results.length, 1),
              ),
            };
          },
        );
      }

      await queryClient.invalidateQueries({
        queryKey: ["admin", "organization-users"],
      });

      setCreateDialogOpen(false);
      setCreateEmail("");
      setCreateFirstName("");
      setCreateLastName("");

      toast({
        variant: "success",
        title: "User created",
        description: formatCreatedUserSummary(createdUser) || payload.email,
      });
    },
    onError: (error) => {
      if (error instanceof AdminRequestError && error.status === 401) {
        useAuthStore.getState().logout();
        return;
      }

      if (
        error instanceof AdminRequestError &&
        (error.status === 400 || error.status === 403 || error.status === 404)
      ) {
        return;
      }

      toast({
        variant: "error",
        title: "User creation failed",
        description: formatAdminError(error),
      });
    },
  });
  const createUserErrorState = useMemo(
    () => describeCreateUserError(createUserMutation.error),
    [createUserMutation.error],
  );
  const createUserErrorSummary = useMemo(
    () =>
      [createUserErrorState.title, createUserErrorState.detail]
        .filter((value) => value.trim().length > 0)
        .join("\n"),
    [createUserErrorState.detail, createUserErrorState.title],
  );

  const pageRows = usersQuery.data?.results ?? [];
  const sortedPageRows = useMemo(() => {
    if (!sortState.key) {
      return pageRows;
    }

    return [...pageRows].sort((left, right) =>
      compareOrganizationUsers(left, right, sortState.key!, sortState.direction),
    );
  }, [pageRows, sortState.direction, sortState.key]);
  const selectableRows = useMemo(
    () =>
      sortedPageRows.flatMap((user) => {
        const userUid = getUserUid(user);

        if (!userUid) {
          return [];
        }

        return [
          {
            id: userUid,
            user,
          },
        ];
      }),
    [sortedPageRows],
  );
  const userSelection = useRegistrySelection(selectableRows, (row) => row.id);
  const selectedUsers = userSelection.selectedItems.map((item) => item.user);
  const selectedUserUids = userSelection.selectedIds;
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
          onConfirm: () => bulkDeleteUsers(selectedUserUids),
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
            onConfirm: () => makeSelectedUsersAdministrators(selectedUserUids),
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
              onConfirm: () => removeSelectedUsersAsAdministrators(selectedUserUids),
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
  const closeCreateUserDialog = useEffectEvent(() => {
    if (createUserMutation.isPending) {
      return;
    }

    setCreateDialogOpen(false);
    setCreateEmail("");
    setCreateFirstName("");
    setCreateLastName("");
    createUserMutation.reset();
  });
  const toggleSort = useEffectEvent((key: OrganizationUserSortKey) => {
    setSortState((current) => {
      if (current.key !== key) {
        return {
          key,
          direction: "asc",
        };
      }

      if (current.direction === "asc") {
        return {
          key,
          direction: "desc",
        };
      }

      return {
        key: null,
        direction: "asc",
      };
    });
  });

  useEffect(() => {
    setPageIndex(0);
  }, [normalizedSearchValue]);

  useEffect(() => {
    if (pageIndex > totalPages - 1) {
      setPageIndex(totalPages - 1);
    }
  }, [pageIndex, totalPages]);

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

  function renderSortableHeader(label: string, key: OrganizationUserSortKey) {
    const isActive = sortState.key === key;

    return (
      <button
        type="button"
        className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
        onClick={() => toggleSort(key)}
      >
        <span>{label}</span>
        {isActive ? (
          sortState.direction === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-70" />
        )}
      </button>
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
                    Add new user to organization
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
              placeholder="Search by email or user UID"
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
                className="w-full min-w-[920px] border-separate text-sm"
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
                    <th
                      className="px-4 py-[var(--table-standard-header-padding-y)]"
                      aria-sort={
                        sortState.key === "email"
                          ? sortState.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      {renderSortableHeader("Email", "email")}
                    </th>
                    <th
                      className="px-4 py-[var(--table-standard-header-padding-y)]"
                      aria-sort={
                        sortState.key === "first_name"
                          ? sortState.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      {renderSortableHeader("First name", "first_name")}
                    </th>
                    <th
                      className="px-4 py-[var(--table-standard-header-padding-y)]"
                      aria-sort={
                        sortState.key === "last_name"
                          ? sortState.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      {renderSortableHeader("Last name", "last_name")}
                    </th>
                    <th
                      className="px-4 py-[var(--table-standard-header-padding-y)]"
                      aria-sort={
                        sortState.key === "plan"
                          ? sortState.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      {renderSortableHeader("Plan", "plan")}
                    </th>
                    <th
                      className="px-4 py-[var(--table-standard-header-padding-y)]"
                      aria-sort={
                        sortState.key === "teams"
                          ? sortState.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      {renderSortableHeader("Teams", "teams")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPageRows.map((user) => {
                    const userUid = getUserUid(user);
                    const selectable = Boolean(userUid);
                    const selected = selectable ? userSelection.isSelected(userUid) : false;

                    return (
                      <tr key={user.id}>
                        <td className={getRegistryTableCellClassName(selected, "left")}>
                          {selectable ? (
                            <MainSequenceSelectionCheckbox
                              ariaLabel={`Select ${user.email || `user ${user.id}`}`}
                              checked={selected}
                              onChange={() => userSelection.toggleSelection(userUid)}
                            />
                          ) : null}
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <div className="font-mono text-xs text-muted-foreground">
                            {user.email || "Not available"}
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <span className="text-muted-foreground">
                            {user.first_name || "Not provided"}
                          </span>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <span className="text-muted-foreground">
                            {user.last_name || "Not provided"}
                          </span>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <Badge variant="neutral">{formatPlanName(user.plan)}</Badge>
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
        onClose={closeCreateUserDialog}
        title="Add new user to organization"
        description="Enter an email address and optional first and last name to create a new organization user."
        className="max-w-[min(560px,calc(100vw-24px))]"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();

            if (!normalizedCreateEmail) {
              return;
            }

            createUserMutation.mutate({
              email: normalizedCreateEmail,
              first_name: normalizedCreateFirstName || undefined,
              last_name: normalizedCreateLastName || undefined,
            });
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
              onChange={(event) => {
                if (createUserMutation.isError) {
                  createUserMutation.reset();
                }

                setCreateEmail(event.target.value);
              }}
              placeholder="name@company.com"
              autoComplete="email"
              autoFocus
              disabled={createUserMutation.isPending}
              aria-invalid={createUserErrorState.email.length > 0}
            />
            {createUserErrorState.email ? (
              <div className="text-sm text-danger">{createUserErrorState.email}</div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="admin-create-user-first-name"
                className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
              >
                First name
              </label>
              <Input
                id="admin-create-user-first-name"
                value={createFirstName}
                onChange={(event) => {
                  if (createUserMutation.isError) {
                    createUserMutation.reset();
                  }

                  setCreateFirstName(event.target.value);
                }}
                placeholder="Ada"
                autoComplete="given-name"
                disabled={createUserMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="admin-create-user-last-name"
                className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
              >
                Last name
              </label>
              <Input
                id="admin-create-user-last-name"
                value={createLastName}
                onChange={(event) => {
                  if (createUserMutation.isError) {
                    createUserMutation.reset();
                  }

                  setCreateLastName(event.target.value);
                }}
                placeholder="Lovelace"
                autoComplete="family-name"
                disabled={createUserMutation.isPending}
              />
            </div>
          </div>

          {createUserErrorSummary ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              <div className="whitespace-pre-line">{createUserErrorSummary}</div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={closeCreateUserDialog}
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
