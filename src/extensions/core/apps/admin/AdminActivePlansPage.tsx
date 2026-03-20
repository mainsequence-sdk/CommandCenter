import { useDeferredValue, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Receipt, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { MainSequenceRegistrySearch } from "../../../../../extensions/main_sequence/common/components/MainSequenceRegistrySearch";
import { getRegistryTableCellClassName } from "../../../../../extensions/main_sequence/common/components/registryTable";

import {
  fetchCurrentOrganizationId,
  listOrganizationActivePlans,
  type OrganizationActivePlanAssignment,
  type OrganizationActivePlanItem,
  type OrganizationActivePlanUser,
  updateOrganizationActivePlanAssignment,
} from "./api";
import { AdminSurfaceLayout } from "./shared";

function formatAdminError(error: unknown) {
  return error instanceof Error ? error.message : "The active plans request failed.";
}

function countAssignedPlans(value: OrganizationActivePlanAssignment[]) {
  return value.length;
}

function renderAssignedPlans(value: OrganizationActivePlanAssignment[]) {
  if (!value.length) {
    return <Badge variant="warning">Unassigned</Badge>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {value.map((plan) => (
        <Badge key={`${plan.item_id}-${plan.label}`} variant="neutral">
          {plan.label}
        </Badge>
      ))}
    </div>
  );
}

type UserPlanDropdownAction =
  | {
      kind: "assign";
      itemId: number;
      label: string;
    }
  | {
      kind: "remove";
      itemId: number;
      label: string;
    };

function buildUserPlanDropdownActions(
  user: OrganizationActivePlanUser,
  items: OrganizationActivePlanItem[],
) {
  const assignedItemIds = new Set(user.assigned.map((assignment) => assignment.item_id));
  const assignActions: UserPlanDropdownAction[] = items
    .filter((item) => !assignedItemIds.has(item.item_id) && item.remaining > 0 && !item.is_full)
    .map((item) => ({
      kind: "assign",
      itemId: item.item_id,
      label: `Assign ${item.plan_label} (${item.remaining} remaining)`,
    }));
  const removeActions: UserPlanDropdownAction[] = user.assigned.map((assignment) => ({
    kind: "remove",
    itemId: assignment.item_id,
    label: `Remove ${assignment.label}`,
  }));

  return [...assignActions, ...removeActions];
}

function parseUserPlanDropdownAction(value: string): UserPlanDropdownAction | null {
  const [kind, rawItemId] = value.split(":");
  const itemId = Number(rawItemId);

  if (!Number.isFinite(itemId) || itemId <= 0) {
    return null;
  }

  if (kind === "assign") {
    return {
      kind: "assign",
      itemId,
      label: "",
    };
  }

  if (kind === "remove") {
    return {
      kind: "remove",
      itemId,
      label: "",
    };
  }

  return null;
}

function SummaryMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
        <div className="mt-2 text-[var(--font-size-card-value)] font-semibold tracking-tight text-foreground">
          {value}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}

export function AdminActivePlansPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchValue, setSearchValue] = useState("");
  const [activeAssignmentUserId, setActiveAssignmentUserId] = useState<number | null>(null);
  const deferredSearchValue = useDeferredValue(searchValue);
  const normalizedSearchValue = deferredSearchValue.trim().toLowerCase();
  const organizationIdQuery = useQuery({
    queryKey: ["admin", "organization", "id"],
    queryFn: fetchCurrentOrganizationId,
    staleTime: 300_000,
  });
  const activePlansQuery = useQuery({
    queryKey: ["admin", "organization", organizationIdQuery.data, "active-plans"],
    queryFn: () => listOrganizationActivePlans(organizationIdQuery.data!),
    enabled: typeof organizationIdQuery.data === "number",
  });
  const assignmentMutation = useMutation({
    mutationFn: ({
      organizationId,
      userId,
      action,
    }: {
      organizationId: number;
      userId: number;
      action: UserPlanDropdownAction;
    }) =>
      updateOrganizationActivePlanAssignment(
        organizationId,
        userId,
        action.kind === "assign"
          ? { assign_item_id: action.itemId }
          : { remove_item_id: action.itemId },
      ),
    onMutate: ({ userId }) => {
      setActiveAssignmentUserId(userId);
    },
    onSuccess: async (result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin", "organization", variables.organizationId, "active-plans"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin", "organization-users"],
        }),
      ]);

      toast({
        variant: "success",
        title: result.detail || "Assignment updated",
        description: `User ${result.user_id}, item ${result.item_id}`,
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Plan assignment failed",
        description: formatAdminError(error),
      });
    },
    onSettled: () => {
      setActiveAssignmentUserId(null);
    },
  });

  const activePlans = activePlansQuery.data;
  const summary = useMemo(() => {
    const items = activePlans?.items ?? [];
    const users = activePlans?.users ?? [];
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAssigned = items.reduce((sum, item) => sum + item.assigned, 0);
    const totalRemaining = items.reduce((sum, item) => sum + item.remaining, 0);
    const unassignedUsers = users.filter((user) => user.assigned.length === 0).length;

    return {
      itemCount: items.length,
      userCount: users.length,
      totalQuantity,
      totalAssigned,
      totalRemaining,
      unassignedUsers,
    };
  }, [activePlans]);
  const filteredUsers = useMemo(() => {
    const users = activePlans?.users ?? [];

    if (!normalizedSearchValue) {
      return users;
    }

    return users.filter((user) => {
      const haystack = [
        user.email,
        user.display_name,
        ...user.assigned.map((assignment) => assignment.label),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearchValue);
    });
  }, [activePlans, normalizedSearchValue]);
  const loading = organizationIdQuery.isLoading || activePlansQuery.isLoading;
  const error = organizationIdQuery.error ?? activePlansQuery.error;

  function handleAssignmentChange(userId: number, value: string) {
    const organizationId = organizationIdQuery.data;
    const action = parseUserPlanDropdownAction(value);

    if (typeof organizationId !== "number" || !action) {
      return;
    }

    assignmentMutation.mutate({
      organizationId,
      userId,
      action,
    });
  }

  return (
    <AdminSurfaceLayout
      title="Active plans"
      description="Review active subscription inventory and plan assignments for the current organization."
    >
      {loading ? (
        <Card>
          <CardContent className="flex min-h-64 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading active plans
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!loading && error ? (
        <Card>
          <CardContent className="p-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatAdminError(error)}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!loading && !error && activePlans ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryMetric
              label="Subscription"
              value={activePlans.has_subscription ? "Active" : "None"}
              detail={
                activePlans.has_subscription
                  ? "The organization has an active subscription."
                  : "No active subscription was returned."
              }
            />
            <SummaryMetric
              label="Plan Items"
              value={summary.itemCount}
              detail={`${summary.totalQuantity} total seats across active plans`}
            />
            <SummaryMetric
              label="Assigned Seats"
              value={summary.totalAssigned}
              detail={`${summary.totalRemaining} seats still available`}
            />
            <SummaryMetric
              label="Users"
              value={summary.userCount}
              detail={`${summary.unassignedUsers} users currently have no plan`}
            />
          </div>

          <Card>
            <CardHeader className="border-b border-border/70">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>Plan inventory</CardTitle>
                  <CardDescription>
                    Seat availability returned by the organization <code>active-plans</code>{" "}
                    endpoint.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={activePlans.has_subscription ? "success" : "warning"}>
                    {activePlans.has_subscription ? "Subscription active" : "No active subscription"}
                  </Badge>
                  <Badge variant="neutral">{`${summary.itemCount} plans`}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {activePlans.items.length > 0 ? (
                <div className="overflow-x-auto px-4 py-4">
                  <table
                    className="w-full min-w-[760px] border-separate text-sm"
                    style={{ borderSpacing: "0 var(--table-row-gap-y)" }}
                  >
                    <thead>
                      <tr
                        className="text-left uppercase tracking-[0.18em] text-muted-foreground"
                        style={{ fontSize: "var(--table-meta-font-size)" }}
                      >
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">Plan</th>
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">Type</th>
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                          Quantity
                        </th>
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                          Assigned
                        </th>
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                          Remaining
                        </th>
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePlans.items.map((item) => (
                        <tr key={item.item_id}>
                          <td className={getRegistryTableCellClassName(false, "left")}>
                            <div className="font-medium text-foreground">{item.plan_label}</div>
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            <span className="font-mono text-xs text-muted-foreground">
                              {item.plan_type}
                            </span>
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>{item.quantity}</td>
                          <td className={getRegistryTableCellClassName(false)}>{item.assigned}</td>
                          <td className={getRegistryTableCellClassName(false)}>
                            {item.remaining}
                          </td>
                          <td className={getRegistryTableCellClassName(false, "right")}>
                            <Badge variant={item.is_full ? "warning" : "success"}>
                              {item.is_full ? "Full" : "Available"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-5 py-14 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                    <Receipt className="h-6 w-6" />
                  </div>
                  <div className="mt-4 text-sm font-medium text-foreground">
                    {activePlans.has_subscription
                      ? "No active plan items found"
                      : "This organization has no active subscription"}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {activePlans.has_subscription
                      ? "The endpoint returned no active plan inventory for this organization."
                      : "User assignments can still be reviewed below even when no plan inventory is active."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/70">
              <div className="space-y-4">
                <div>
                  <CardTitle>User assignments</CardTitle>
                  <CardDescription>
                    Review which organization users are assigned to the active plan inventory.
                  </CardDescription>
                </div>
                <MainSequenceRegistrySearch
                  accessory={
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="neutral">{`${summary.userCount} users`}</Badge>
                      <Badge variant="neutral">{`${summary.unassignedUsers} unassigned`}</Badge>
                    </div>
                  }
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search by email, display name, or plan"
                  searchClassName="max-w-xl"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredUsers.length > 0 ? (
                <div className="overflow-x-auto px-4 py-4">
                  <table
                    className="w-full min-w-[820px] border-separate text-sm"
                    style={{ borderSpacing: "0 var(--table-row-gap-y)" }}
                  >
                    <thead>
                      <tr
                        className="text-left uppercase tracking-[0.18em] text-muted-foreground"
                        style={{ fontSize: "var(--table-meta-font-size)" }}
                      >
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">Email</th>
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                          Display name
                        </th>
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                          Assigned plans
                        </th>
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                          Count
                        </th>
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                          Assignment
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => {
                        const dropdownActions = buildUserPlanDropdownActions(
                          user,
                          activePlans.items,
                        );
                        const rowPending =
                          assignmentMutation.isPending && activeAssignmentUserId === user.user_id;

                        return (
                          <tr key={user.user_id}>
                            <td className={getRegistryTableCellClassName(false, "left")}>
                              <span className="font-mono text-xs text-muted-foreground">
                                {user.email}
                              </span>
                            </td>
                            <td className={getRegistryTableCellClassName(false)}>
                              <span className="text-foreground">
                                {user.display_name || user.email}
                              </span>
                            </td>
                            <td className={getRegistryTableCellClassName(false)}>
                              {renderAssignedPlans(user.assigned)}
                            </td>
                            <td className={getRegistryTableCellClassName(false)}>
                              <Badge variant="neutral">{countAssignedPlans(user.assigned)}</Badge>
                            </td>
                            <td className={getRegistryTableCellClassName(false, "right")}>
                              <Select
                                value=""
                                disabled={assignmentMutation.isPending || dropdownActions.length === 0}
                                onChange={(event) =>
                                  handleAssignmentChange(user.user_id, event.target.value)
                                }
                                className="h-9 min-w-[240px]"
                              >
                                <option value="">
                                  {rowPending
                                    ? "Updating assignment..."
                                    : dropdownActions.length > 0
                                      ? "Manage assignment"
                                      : "No changes available"}
                                </option>
                                {dropdownActions.map((action) => (
                                  <option
                                    key={`${action.kind}-${action.itemId}`}
                                    value={`${action.kind}:${action.itemId}`}
                                  >
                                    {action.label}
                                  </option>
                                ))}
                              </Select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-5 py-14 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="mt-4 text-sm font-medium text-foreground">
                    {summary.userCount > 0 ? "No matching users found" : "No users returned"}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {summary.userCount > 0
                      ? "Clear the current search to review all organization users."
                      : "The active plans endpoint did not return any organization users."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </AdminSurfaceLayout>
  );
}
