import { useDeferredValue, useEffect, useMemo, useState, type ChangeEvent } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Users2 } from "lucide-react";

import { useAuthStore } from "@/auth/auth-store";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";

import {
  createTeam,
  deleteTeam,
  fetchTeam,
  fetchTeamCandidateMembers,
  fetchTeamMembers,
  listTeams,
  type TeamListRecord,
  manageTeamMembers,
  type TeamMemberRecord,
} from "./api";
import { MainSequencePermissionsTab } from "../../../extensions/main_sequence/common/components/MainSequencePermissionsTab";
import { MainSequenceRegistrySearch } from "../../../extensions/main_sequence/common/components/MainSequenceRegistrySearch";
import { MainSequenceSelectionCheckbox } from "../../../extensions/main_sequence/common/components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../../extensions/main_sequence/common/components/registryTable";
import { useRegistrySelection } from "../../../extensions/main_sequence/common/hooks/useRegistrySelection";

function formatTeamError(error: unknown) {
  return error instanceof Error ? error.message : "The team request failed.";
}

function getTeamMemberName(member: Pick<TeamMemberRecord, "first_name" | "last_name" | "username" | "email">) {
  const fullName = [member.first_name, member.last_name].filter(Boolean).join(" ").trim();

  if (fullName) {
    return fullName;
  }

  return member.username || member.email;
}

function toggleId(current: number[], id: number) {
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}

const organizationAdminGroup = "Organization Admin";
const teamPermissionsObjectUrl = "/user/api/team/";
const teamBehaviorHighlights = [
  "Sharing an object to a team gives that team's members access to the object.",
  "Being a member of a team does not automatically grant access to the team object itself.",
  "Sharing a team object controls who can list, view, or edit the team record.",
  "Only Organization Administrators can add or remove team members from a team.",
];

function formatTeamDeleteLabel(count: number) {
  return count === 1 ? "Delete selected team" : "Delete selected teams";
}

export function TeamsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sessionGroups = useAuthStore((state) => state.session?.user.groups ?? []);
  const sessionRole = useAuthStore((state) => state.session?.user.role ?? "");
  const canManageTeamCrud =
    sessionGroups.includes(organizationAdminGroup) ||
    sessionRole === organizationAdminGroup ||
    sessionRole === "org_admin" ||
    sessionRole === "admin";
  const [filterValue, setFilterValue] = useState("");
  const deferredFilterValue = useDeferredValue(filterValue);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);

  const teamsQuery = useQuery({
    queryKey: ["teams", "list", deferredFilterValue],
    queryFn: () => listTeams({ search: deferredFilterValue.trim() || undefined }),
  });

  const teams = teamsQuery.data ?? [];
  const teamSelection = useRegistrySelection(teams);

  const teamDetailQuery = useQuery({
    queryKey: ["teams", "detail", selectedTeamId],
    queryFn: () => fetchTeam(selectedTeamId ?? 0),
    enabled: Boolean(selectedTeamId),
  });

  const teamMembersQuery = useQuery({
    queryKey: ["teams", "members", selectedTeamId],
    queryFn: () => fetchTeamMembers(selectedTeamId ?? 0),
    enabled: Boolean(selectedTeamId),
  });

  const teamCandidateMembersQuery = useQuery({
    queryKey: ["teams", "candidate-members", selectedTeamId],
    queryFn: () => fetchTeamCandidateMembers(selectedTeamId ?? 0),
    enabled: canManageTeamCrud && Boolean(selectedTeamId),
  });

  useEffect(() => {
    const visibleIds = new Set((teamsQuery.data ?? []).map((team) => team.id));

    if (!visibleIds.size) {
      setSelectedTeamId(null);
      return;
    }

    if (!selectedTeamId || !visibleIds.has(selectedTeamId)) {
      setSelectedTeamId(teamsQuery.data?.[0]?.id ?? null);
    }
  }, [selectedTeamId, teamsQuery.data]);

  useEffect(() => {
    setSelectedCandidateIds([]);
    setSelectedMemberIds([]);
  }, [selectedTeamId]);

  useEffect(() => {
    if (!canManageTeamCrud && createDialogOpen) {
      setCreateDialogOpen(false);
    }
    if (!canManageTeamCrud && deleteDialogOpen) {
      setDeleteDialogOpen(false);
    }
  }, [canManageTeamCrud, createDialogOpen, deleteDialogOpen]);

  useEffect(() => {
    if (!canManageTeamCrud) {
      teamSelection.clearSelection();
      setSelectedCandidateIds([]);
      setSelectedMemberIds([]);
    }
  }, [canManageTeamCrud, teamSelection]);

  const createTeamMutation = useMutation({
    mutationFn: createTeam,
    onSuccess: async (team) => {
      await queryClient.invalidateQueries({ queryKey: ["teams"] });

      toast({
        variant: "success",
        title: "Team created",
        description: `${team.name} is now available.`,
      });

      setCreateDialogOpen(false);
      setTeamName("");
      setTeamDescription("");
      setSelectedTeamId(team.id);
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Team creation failed",
        description: formatTeamError(error),
      });
    },
  });

  const manageMembersMutation = useMutation({
    mutationFn: ({
      action,
      teamId,
      userIds,
    }: {
      action: "add" | "remove";
      teamId: number;
      userIds: number[];
    }) => manageTeamMembers(teamId, { action, user_ids: userIds }),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["teams", "detail", variables.teamId] }),
        queryClient.invalidateQueries({ queryKey: ["teams", "members", variables.teamId] }),
        queryClient.invalidateQueries({ queryKey: ["teams", "candidate-members", variables.teamId] }),
        queryClient.invalidateQueries({ queryKey: ["teams", "list"] }),
      ]);

      if (variables.action === "add") {
        setSelectedCandidateIds([]);
        toast({
          variant: "success",
          title: "Users added",
          description: "The selected users were added to the team.",
        });
      } else {
        setSelectedMemberIds([]);
        toast({
          variant: "success",
          title: "Users removed",
          description: "The selected users were removed from the team.",
        });
      }
    },
    onError: (error, variables) => {
      toast({
        variant: "error",
        title: variables.action === "add" ? "Add users failed" : "Remove users failed",
        description: formatTeamError(error),
      });
    },
  });

  const deleteTeamsMutation = useMutation({
    mutationFn: async (teamIds: number[]) => {
      for (const teamId of teamIds) {
        await deleteTeam(teamId);
      }
    },
    onSuccess: async (_result, teamIds) => {
      const deletedTeamIds = new Set(teamIds);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["teams", "list"] }),
        ...teamIds.flatMap((teamId) => [
          queryClient.invalidateQueries({ queryKey: ["teams", "detail", teamId] }),
          queryClient.invalidateQueries({ queryKey: ["teams", "members", teamId] }),
          queryClient.invalidateQueries({ queryKey: ["teams", "candidate-members", teamId] }),
        ]),
      ]);

      teamSelection.clearSelection();
      setDeleteDialogOpen(false);

      if (selectedTeamId && deletedTeamIds.has(selectedTeamId)) {
        setSelectedTeamId(null);
      }

      toast({
        variant: "success",
        title: teamIds.length === 1 ? "Team deleted" : "Teams deleted",
        description:
          teamIds.length === 1
            ? "The selected team was deleted."
            : `${teamIds.length} teams were deleted.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Team delete failed",
        description: formatTeamError(error),
      });
    },
  });

  const selectedTeam = teamDetailQuery.data ?? null;
  const selectedTeamsForDeletion = useMemo(
    () => teams.filter((team) => teamSelection.selectedIds.includes(team.id)),
    [teamSelection.selectedIds, teams],
  );
  const deleteConfirmationWord =
    selectedTeamsForDeletion.length === 1 ? "DELETE TEAM" : "DELETE TEAMS";
  const teamBulkActions = useMemo(
    () => [
      {
        id: "delete-teams",
        label: formatTeamDeleteLabel(teamSelection.selectedCount),
        icon: Trash2,
        tone: "danger" as const,
        onSelect: () => {
          setDeleteDialogOpen(true);
        },
      },
    ],
    [teamSelection.selectedCount],
  );

  function renderDeleteSummary(teamsToDelete: TeamListRecord[]) {
    return (
      <div className="space-y-2">
        {teamsToDelete.map((team) => (
          <div key={team.id} className="flex items-center justify-between gap-3">
            <span className="font-medium text-foreground">{team.name}</span>
            <span className="text-xs text-muted-foreground">#{team.id}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Users"
        title="Teams"
        description="Create teams and manage team membership for your organization."
        actions={<Badge variant="neutral">{`${teamsQuery.data?.length ?? 0} teams`}</Badge>}
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>How teams work</CardTitle>
          <CardDescription>
            Teams are reusable principals for sharing. Team membership and access to the team object are separate permission paths.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 p-5 md:grid-cols-2">
          {teamBehaviorHighlights.map((highlight) => (
            <div
              key={highlight}
              className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/28 px-4 py-3 text-sm text-foreground"
            >
              {highlight}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card>
          <CardHeader className="border-b border-border/70">
            <div className="space-y-4">
              <div>
                <CardTitle>Teams registry</CardTitle>
                <CardDescription>Browse organization teams, open one, or delete selected teams.</CardDescription>
                {!canManageTeamCrud ? (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Only Organization Admin profiles can create, delete, or manage team memberships.
                  </div>
                ) : null}
              </div>
              <MainSequenceRegistrySearch
                value={filterValue}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setFilterValue(event.target.value)}
                placeholder="Search teams"
                selectionCount={canManageTeamCrud ? teamSelection.selectedCount : 0}
                bulkActions={canManageTeamCrud ? teamBulkActions : []}
                onClearSelection={canManageTeamCrud ? teamSelection.clearSelection : undefined}
                renderSelectionSummary={(count: number) => (
                  <>
                    <span>{count}</span>
                    <span>{count === 1 ? "team selected" : "teams selected"}</span>
                  </>
                )}
                accessory={
                  canManageTeamCrud ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        createTeamMutation.reset();
                        setTeamName("");
                        setTeamDescription("");
                        setCreateDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Create team
                    </Button>
                  ) : null
                }
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {teamsQuery.isLoading ? (
              <div className="flex min-h-72 items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading teams
                </div>
              </div>
            ) : null}

            {teamsQuery.isError ? (
              <div className="p-5">
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatTeamError(teamsQuery.error)}
                </div>
              </div>
            ) : null}

            {!teamsQuery.isLoading && !teamsQuery.isError && (teamsQuery.data?.length ?? 0) === 0 ? (
              <div className="px-5 py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                  <Users2 className="h-6 w-6" />
                </div>
                <div className="mt-4 text-sm font-medium text-foreground">No teams found</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {canManageTeamCrud ? "Create a team or clear the current filter." : "Clear the current filter to see more teams."}
                </p>
              </div>
            ) : null}

            {!teamsQuery.isLoading && !teamsQuery.isError && (teamsQuery.data?.length ?? 0) > 0 ? (
              <div className="overflow-x-auto px-4 py-4">
                <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {canManageTeamCrud ? (
                        <th className="w-12 px-3 py-[var(--table-standard-header-padding-y)]">
                          <MainSequenceSelectionCheckbox
                            ariaLabel="Select all teams"
                            checked={teamSelection.allSelected}
                            indeterminate={teamSelection.someSelected}
                            onChange={teamSelection.toggleAll}
                          />
                        </th>
                      ) : null}
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">Team</th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">Description</th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">Members</th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((team) => {
                      const active = selectedTeamId === team.id;

                      return (
                        <tr
                          key={team.id}
                          className={active ? "text-foreground" : undefined}
                        >
                          {canManageTeamCrud ? (
                            <td className={getRegistryTableCellClassName(active, "left")}>
                              <MainSequenceSelectionCheckbox
                                ariaLabel={`Select ${team.name}`}
                                checked={teamSelection.isSelected(team.id)}
                                onChange={() => teamSelection.toggleSelection(team.id)}
                              />
                            </td>
                          ) : null}
                          <td className={getRegistryTableCellClassName(active, canManageTeamCrud ? "middle" : "left")}>
                            <button
                              type="button"
                              className="font-medium text-foreground transition-colors hover:text-primary"
                              onClick={() => setSelectedTeamId(team.id)}
                            >
                              {team.name}
                            </button>
                          </td>
                          <td className={getRegistryTableCellClassName(active)}>
                            <span className="text-muted-foreground">
                              {team.description?.trim() || "No description"}
                            </span>
                          </td>
                          <td className={getRegistryTableCellClassName(active)}>
                            {team.member_count}
                          </td>
                          <td className={getRegistryTableCellClassName(active, "right")}>
                            <Badge variant={team.is_active ? "success" : "neutral"}>
                              {team.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {selectedTeamId ? (
            <>
              <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                Only Organization Administrators can manage team membership.
              </div>
              <Card>
                <CardHeader className="border-b border-border/70">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{selectedTeam?.name ?? `Team ${selectedTeamId}`}</CardTitle>
                      <CardDescription>
                        {selectedTeam?.description?.trim() || "No description"}
                      </CardDescription>
                    </div>
                    {selectedTeam ? (
                      <Badge variant={selectedTeam.is_active ? "success" : "neutral"}>
                        {selectedTeam.member_count} members
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  {teamDetailQuery.isLoading ? (
                    <div className="flex min-h-24 items-center justify-center">
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading team details
                      </div>
                    </div>
                  ) : null}

                  {teamDetailQuery.isError ? (
                    <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                      {formatTeamError(teamDetailQuery.error)}
                    </div>
                  ) : null}

                  {selectedTeam ? (
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          Team ID
                        </div>
                        <div className="mt-1 text-sm text-foreground">{selectedTeam.id}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          Status
                        </div>
                        <div className="mt-1 text-sm text-foreground">
                          {selectedTeam.is_active ? "Active" : "Inactive"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          Created by
                        </div>
                        <div className="mt-1 text-sm text-foreground">
                          {selectedTeam.created_by?.email ?? "Unknown"}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b border-border/70">
                  <CardTitle>Team sharing</CardTitle>
                  <CardDescription>
                    Share this team object with users or other teams. This controls access to the team record itself, not membership.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5">
                  {canManageTeamCrud ? (
                    <MainSequencePermissionsTab
                      objectId={selectedTeamId}
                      objectUrl={teamPermissionsObjectUrl}
                      entityLabel="Team"
                    />
                  ) : (
                    <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/28 px-4 py-3 text-sm text-muted-foreground">
                      Only Organization Administrators can change team sharing from this page. Sharing the team object controls who can view or edit the team record; it does not change membership.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b border-border/70">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>Current members</CardTitle>
                      <CardDescription>
                        {canManageTeamCrud ? "Remove users from this team." : "Members assigned to this team."}
                      </CardDescription>
                    </div>
                    {canManageTeamCrud ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={selectedMemberIds.length === 0 || manageMembersMutation.isPending}
                        onClick={() => {
                          if (!selectedTeamId || selectedMemberIds.length === 0) {
                            return;
                          }

                          manageMembersMutation.mutate({
                            action: "remove",
                            teamId: selectedTeamId,
                            userIds: selectedMemberIds,
                          });
                        }}
                      >
                        {manageMembersMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        Remove selected
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {teamMembersQuery.isLoading ? (
                    <div className="flex min-h-32 items-center justify-center">
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading members
                      </div>
                    </div>
                  ) : null}

                  {teamMembersQuery.isError ? (
                    <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                      {formatTeamError(teamMembersQuery.error)}
                    </div>
                  ) : null}

                  {!teamMembersQuery.isLoading && !teamMembersQuery.isError && (teamMembersQuery.data?.length ?? 0) > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[680px] border-separate border-spacing-y-2 text-sm">
                          <thead>
                            <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                              {canManageTeamCrud ? (
                                <th className="w-12 px-3 py-[var(--table-standard-header-padding-y)]" />
                              ) : null}
                              <th className="px-4 py-[var(--table-standard-header-padding-y)]">Name</th>
                              <th className="px-4 py-[var(--table-standard-header-padding-y)]">Email</th>
                              <th className="px-4 py-[var(--table-standard-header-padding-y)]">Username</th>
                            </tr>
                          </thead>
                          <tbody>
                            {teamMembersQuery.data?.map((member) => (
                              <tr key={member.id}>
                              {canManageTeamCrud ? (
                                <td className="rounded-l-[calc(var(--radius)-2px)] border border-border/70 bg-background/24 px-3 py-[var(--table-standard-cell-padding-y)]">
                                  <input
                                    type="checkbox"
                                    checked={selectedMemberIds.includes(member.id)}
                                    onChange={() =>
                                      setSelectedMemberIds((current) => toggleId(current, member.id))
                                    }
                                  />
                                </td>
                              ) : null}
                              <td className={`${canManageTeamCrud ? "border-r-0" : "rounded-l-[calc(var(--radius)-2px)]"} border border-border/70 bg-background/24 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground`}>
                                {getTeamMemberName(member)}
                              </td>
                              <td className="border border-border/70 bg-background/24 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                {member.email}
                              </td>
                              <td className="rounded-r-[calc(var(--radius)-2px)] border border-border/70 bg-background/24 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                {member.username || "Not set"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  {!teamMembersQuery.isLoading && !teamMembersQuery.isError && (teamMembersQuery.data?.length ?? 0) === 0 ? (
                    <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3 text-sm text-muted-foreground">
                      No members are assigned to this team.
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {canManageTeamCrud ? (
                <Card>
                  <CardHeader className="border-b border-border/70">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <CardTitle>Available users</CardTitle>
                        <CardDescription>Add users to this team.</CardDescription>
                      </div>
                      <Button
                        size="sm"
                        disabled={selectedCandidateIds.length === 0 || manageMembersMutation.isPending}
                        onClick={() => {
                          if (!selectedTeamId || selectedCandidateIds.length === 0) {
                            return;
                          }

                          manageMembersMutation.mutate({
                            action: "add",
                            teamId: selectedTeamId,
                            userIds: selectedCandidateIds,
                          });
                        }}
                      >
                        {manageMembersMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        Add selected
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    {teamCandidateMembersQuery.isLoading ? (
                      <div className="flex min-h-32 items-center justify-center">
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading available users
                        </div>
                      </div>
                    ) : null}

                    {teamCandidateMembersQuery.isError ? (
                      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                        {formatTeamError(teamCandidateMembersQuery.error)}
                      </div>
                    ) : null}

                    {!teamCandidateMembersQuery.isLoading &&
                    !teamCandidateMembersQuery.isError &&
                    (teamCandidateMembersQuery.data?.length ?? 0) > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[680px] border-separate border-spacing-y-2 text-sm">
                          <thead>
                            <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                              <th className="w-12 px-3 py-[var(--table-standard-header-padding-y)]" />
                              <th className="px-4 py-[var(--table-standard-header-padding-y)]">Name</th>
                              <th className="px-4 py-[var(--table-standard-header-padding-y)]">Email</th>
                              <th className="px-4 py-[var(--table-standard-header-padding-y)]">Username</th>
                            </tr>
                          </thead>
                          <tbody>
                            {teamCandidateMembersQuery.data?.map((member) => (
                              <tr key={member.id}>
                                <td className="rounded-l-[calc(var(--radius)-2px)] border border-border/70 bg-background/24 px-3 py-[var(--table-standard-cell-padding-y)]">
                                  <input
                                    type="checkbox"
                                    checked={selectedCandidateIds.includes(member.id)}
                                    onChange={() =>
                                      setSelectedCandidateIds((current) => toggleId(current, member.id))
                                    }
                                  />
                                </td>
                                <td className="border border-border/70 bg-background/24 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                  {getTeamMemberName(member)}
                                </td>
                                <td className="border border-border/70 bg-background/24 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                  {member.email}
                                </td>
                                <td className="rounded-r-[calc(var(--radius)-2px)] border border-border/70 bg-background/24 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                  {member.username || "Not set"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}

                    {!teamCandidateMembersQuery.isLoading &&
                    !teamCandidateMembersQuery.isError &&
                    (teamCandidateMembersQuery.data?.length ?? 0) === 0 ? (
                      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3 text-sm text-muted-foreground">
                        No candidate users are available for this team.
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}
            </>
          ) : (
            <Card>
              <CardContent className="flex min-h-80 items-center justify-center">
                <div className="text-center">
                  <div className="text-sm font-medium text-foreground">Select a team</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Pick a team from the registry to manage its members.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog
        title="Create team"
        open={createDialogOpen}
        onClose={() => {
          if (!createTeamMutation.isPending) {
            setCreateDialogOpen(false);
          }
        }}
        className="max-w-[min(720px,calc(100vw-24px))]"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Name
            </label>
            <Input
              autoFocus
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="Platform"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Description
            </label>
            <Textarea
              value={teamDescription}
              onChange={(event) => setTeamDescription(event.target.value)}
              placeholder="What this team is responsible for."
              className="min-h-32"
            />
          </div>

          {createTeamMutation.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatTeamError(createTeamMutation.error)}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateDialogOpen(false)}
              disabled={createTeamMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!canManageTeamCrud) {
                  toast({
                    variant: "error",
                    title: "Team creation failed",
                    description: "Only Organization Admin profiles can create teams.",
                  });
                  return;
                }

                if (!teamName.trim()) {
                  toast({
                    variant: "error",
                    title: "Team creation failed",
                    description: "Name is required.",
                  });
                  return;
                }

                createTeamMutation.mutate({
                  name: teamName.trim(),
                  description: teamDescription.trim(),
                  is_active: true,
                });
              }}
              disabled={createTeamMutation.isPending || !teamName.trim()}
            >
              {createTeamMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create team
            </Button>
          </div>
        </div>
      </Dialog>

      <ActionConfirmationDialog
        open={deleteDialogOpen}
        onClose={() => {
          if (!deleteTeamsMutation.isPending) {
            setDeleteDialogOpen(false);
          }
        }}
        title={selectedTeamsForDeletion.length === 1 ? "Delete team" : "Delete teams"}
        tone="danger"
        actionLabel={selectedTeamsForDeletion.length === 1 ? "delete team" : "delete teams"}
        confirmButtonLabel={selectedTeamsForDeletion.length === 1 ? "Delete team" : "Delete teams"}
        confirmWord={deleteConfirmationWord}
        objectLabel={selectedTeamsForDeletion.length === 1 ? "team" : "teams"}
        objectSummary={renderDeleteSummary(selectedTeamsForDeletion)}
        specialText="Deleting a team permanently removes the team object. This action cannot be undone."
        isPending={deleteTeamsMutation.isPending}
        error={deleteTeamsMutation.isError ? formatTeamError(deleteTeamsMutation.error) : undefined}
        onConfirm={async () => {
          if (!canManageTeamCrud) {
            throw new Error("Only Organization Admin profiles can delete teams.");
          }

          await deleteTeamsMutation.mutateAsync(selectedTeamsForDeletion.map((team) => team.id));
        }}
      />
    </div>
  );
}
