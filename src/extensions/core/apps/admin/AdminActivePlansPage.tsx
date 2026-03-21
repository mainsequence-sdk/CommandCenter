import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus, Receipt, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { MainSequenceRegistrySearch } from "../../../../../extensions/main_sequence/common/components/MainSequenceRegistrySearch";
import { getRegistryTableCellClassName } from "../../../../../extensions/main_sequence/common/components/registryTable";

import {
  fetchCurrentOrganizationId,
  listOrganizationActivePlans,
  listOrganizationSubscriptionSeats,
  type OrganizationActivePlanAssignment,
  type OrganizationActivePlanItem,
  type OrganizationSubscriptionSeatsPlanRow,
  type OrganizationActivePlanUser,
  submitOrganizationSubscriptionSeatsUpdate,
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

function clampSeatQuantity(nextValue: number, minValue: number) {
  if (!Number.isFinite(nextValue)) {
    return minValue;
  }

  return Math.max(minValue, Math.floor(nextValue));
}

function getDraftSeatQuantity(
  row: OrganizationSubscriptionSeatsPlanRow,
  seatDrafts: Record<string, number>,
) {
  const rawValue = seatDrafts[row.plan_type];

  if (!Number.isFinite(rawValue)) {
    return row.current_qty;
  }

  return clampSeatQuantity(rawValue, row.min_qty);
}

function formatSeatDelta(delta: number) {
  if (delta > 0) {
    return `+${delta}`;
  }

  return String(delta);
}

function getSeatDeltaVariant(delta: number) {
  if (delta > 0) {
    return "success" as const;
  }

  if (delta < 0) {
    return "warning" as const;
  }

  return "neutral" as const;
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
  const [manageSeatsOpen, setManageSeatsOpen] = useState(false);
  const [seatDrafts, setSeatDrafts] = useState<Record<string, number>>({});
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
  const subscriptionSeatsQuery = useQuery({
    queryKey: ["admin", "organization", organizationIdQuery.data, "subscription-seats"],
    queryFn: () => listOrganizationSubscriptionSeats(organizationIdQuery.data!),
    enabled: manageSeatsOpen && typeof organizationIdQuery.data === "number",
  });
  const seatUpdateMutation = useMutation({
    mutationFn: ({
      organizationId,
      seatTotals,
      successUrl,
      cancelUrl,
    }: {
      organizationId: number;
      seatTotals: Record<string, number>;
      successUrl: string;
      cancelUrl: string;
    }) =>
      submitOrganizationSubscriptionSeatsUpdate({
        organizationId,
        seatTotals,
        successUrl,
        cancelUrl,
      }),
    onSuccess: async (result, variables) => {
      if (result.mode === "redirect" && result.redirect_url) {
        window.location.assign(result.redirect_url);
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin", "organization", variables.organizationId, "active-plans"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin", "organization", variables.organizationId, "subscription-seats"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin", "organization-users"],
        }),
      ]);

      setManageSeatsOpen(false);
      toast({
        variant: "success",
        title: result.detail || "Subscription seats updated",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Manage seats failed",
        description: formatAdminError(error),
      });
    },
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
        queryClient.invalidateQueries({
          queryKey: ["admin", "organization", variables.organizationId, "subscription-seats"],
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
  const subscriptionSeats = subscriptionSeatsQuery.data;
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
  const manageSeatsSummary = useMemo(() => {
    const rows = subscriptionSeats?.plan_rows ?? [];
    const currentTotal = rows.reduce((sum, row) => sum + row.current_qty, 0);
    const newTotal = rows.reduce((sum, row) => sum + getDraftSeatQuantity(row, seatDrafts), 0);
    const delta = newTotal - currentTotal;

    return {
      currentTotal,
      newTotal,
      delta,
    };
  }, [seatDrafts, subscriptionSeats]);
  const manageSeatsHasChanges = useMemo(
    () => (subscriptionSeats?.plan_rows ?? []).some((row) => getDraftSeatQuantity(row, seatDrafts) !== row.current_qty),
    [seatDrafts, subscriptionSeats],
  );
  const loading = organizationIdQuery.isLoading || activePlansQuery.isLoading;
  const error = organizationIdQuery.error ?? activePlansQuery.error;
  const manageSeatsError = organizationIdQuery.error ?? subscriptionSeatsQuery.error;

  useEffect(() => {
    if (!manageSeatsOpen || !subscriptionSeats) {
      return;
    }

    setSeatDrafts(
      Object.fromEntries(
        subscriptionSeats.plan_rows.map((row) => [row.plan_type, row.current_qty]),
      ),
    );
  }, [manageSeatsOpen, subscriptionSeats]);

  useEffect(() => {
    if (!manageSeatsOpen) {
      setSeatDrafts({});
    }
  }, [manageSeatsOpen]);

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

  function setSeatDraftValue(row: OrganizationSubscriptionSeatsPlanRow, nextValue: number) {
    setSeatDrafts((current) => ({
      ...current,
      [row.plan_type]: clampSeatQuantity(nextValue, row.min_qty),
    }));
  }

  function buildManageSeatsReturnUrl() {
    if (typeof window === "undefined") {
      return "";
    }

    return new URL(`${window.location.pathname}${window.location.search}`, window.location.origin).toString();
  }

  function handleManageSeatsSubmit() {
    const organizationId = organizationIdQuery.data;

    if (typeof organizationId !== "number" || !subscriptionSeats?.has_subscription) {
      return;
    }

    const seatTotals = Object.fromEntries(
      subscriptionSeats.plan_rows.map((row) => [row.plan_type, getDraftSeatQuantity(row, seatDrafts)]),
    );
    const returnUrl = buildManageSeatsReturnUrl();

    seatUpdateMutation.mutate({
      organizationId,
      seatTotals,
      successUrl: returnUrl,
      cancelUrl: returnUrl,
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
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setManageSeatsOpen(true);
                    }}
                  >
                    Manage seats
                  </Button>
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

      <Dialog
        open={manageSeatsOpen}
        onClose={() => {
          setManageSeatsOpen(false);
        }}
        title="Manage seats"
        description="Adjust seat totals for the current subscription and compare the new totals before checkout."
        className="max-w-[min(980px,calc(100vw-24px))]"
      >
        {organizationIdQuery.isLoading || subscriptionSeatsQuery.isLoading ? (
          <div className="flex min-h-56 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading subscription seats
            </div>
          </div>
        ) : null}

        {!organizationIdQuery.isLoading && !subscriptionSeatsQuery.isLoading && manageSeatsError ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatAdminError(manageSeatsError)}
          </div>
        ) : null}

        {!organizationIdQuery.isLoading &&
        !subscriptionSeatsQuery.isLoading &&
        !manageSeatsError &&
        subscriptionSeats &&
        !subscriptionSeats.has_subscription ? (
          <div className="rounded-[calc(var(--radius)-2px)] border border-warning/40 bg-warning/10 p-5">
            <div className="text-sm font-medium text-foreground">No subscription found</div>
            <p className="mt-2 text-sm text-muted-foreground">
              This organization has no subscription row yet, so seats cannot be managed.
            </p>
          </div>
        ) : null}

        {!organizationIdQuery.isLoading &&
        !subscriptionSeatsQuery.isLoading &&
        !manageSeatsError &&
        subscriptionSeats?.has_subscription ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">
                {subscriptionSeats.subscription?.stripe_subscription_id || "no-stripe"}
              </Badge>
              <Badge variant="success">
                {subscriptionSeats.subscription?.status_display ||
                  subscriptionSeats.subscription?.status ||
                  "Active"}
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <SummaryMetric
                label="Current total"
                value={manageSeatsSummary.currentTotal}
                detail="Seats currently billed across all plans"
              />
              <SummaryMetric
                label="Change"
                value={formatSeatDelta(manageSeatsSummary.delta)}
                detail="Difference between current and edited totals"
              />
              <SummaryMetric
                label="New total"
                value={manageSeatsSummary.newTotal}
                detail="Projected seat total after checkout or immediate update"
              />
            </div>

            <div className="overflow-x-auto">
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
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Current</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">In use</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                      New total
                    </th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptionSeats.plan_rows.map((row) => {
                    const draftValue = getDraftSeatQuantity(row, seatDrafts);
                    const delta = draftValue - row.current_qty;

                    return (
                      <tr key={row.plan_type}>
                        <td className={getRegistryTableCellClassName(false, "left")}>
                          <div className="font-medium text-foreground">{row.label}</div>
                          <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                            {row.plan_type}
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(false)}>
                          <span className="text-foreground">{row.current_qty}</span>
                        </td>
                        <td className={getRegistryTableCellClassName(false)}>
                          <div className="text-foreground">{row.assigned_qty}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            Min allowed {row.min_qty}
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(false)}>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setSeatDraftValue(row, draftValue - 1);
                              }}
                              disabled={seatUpdateMutation.isPending || draftValue <= row.min_qty}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <Input
                              type="number"
                              min={row.min_qty}
                              value={draftValue}
                              onChange={(event) => {
                                setSeatDraftValue(row, Number(event.target.value));
                              }}
                              className="h-9 w-24 text-right"
                              disabled={seatUpdateMutation.isPending}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setSeatDraftValue(row, draftValue + 1);
                              }}
                              disabled={seatUpdateMutation.isPending}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(false, "right")}>
                          <Badge variant={getSeatDeltaVariant(delta)}>
                            {formatSeatDelta(delta)}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4 rounded-[calc(var(--radius)-2px)] border border-border/70 bg-background/35 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                You’ll be redirected to checkout if payment is required. If the change is $0, it
                will apply immediately.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSeatDrafts(
                      Object.fromEntries(
                        subscriptionSeats.plan_rows.map((row) => [row.plan_type, row.current_qty]),
                      ),
                    );
                  }}
                  disabled={seatUpdateMutation.isPending}
                >
                  Reset
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setManageSeatsOpen(false);
                  }}
                  disabled={seatUpdateMutation.isPending}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={handleManageSeatsSubmit}
                  disabled={seatUpdateMutation.isPending || !manageSeatsHasChanges}
                >
                  {seatUpdateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Continue
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Dialog>
    </AdminSurfaceLayout>
  );
}
