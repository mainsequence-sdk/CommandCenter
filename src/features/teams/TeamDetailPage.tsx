import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Search, Shield, Users2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { MainSequencePermissionsTab } from "../../../extensions/main_sequence/common/components/MainSequencePermissionsTab";
import { MainSequenceSelectionCheckbox } from "../../../extensions/main_sequence/common/components/MainSequenceSelectionCheckbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

import {
  fetchTeam,
  fetchTeamCandidateMembers,
  fetchTeamMembers,
  manageTeamMembers,
} from "./api";
import {
  formatTeamError,
  getTeamMemberName,
  teamBehaviorHighlights,
  teamPermissionsObjectUrl,
  teamsRegistryPath,
  toggleId,
  useCanManageTeamCrud,
} from "./shared";

type TeamDetailTab = "members" | "policies";

function matchesMemberSearch(
  query: string,
  member: {
    email: string;
    first_name?: string;
    last_name?: string;
    username?: string;
  },
) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    member.email,
    member.first_name,
    member.last_name,
    member.username,
    getTeamMemberName(member),
  ]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(normalizedQuery));
}

export function TeamDetailPage({
  teamId,
}: {
  teamId: number;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canManageTeamCrud = useCanManageTeamCrud();
  const [activeTab, setActiveTab] = useState<TeamDetailTab>("members");
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [memberSearchValue, setMemberSearchValue] = useState("");
  const [candidateSearchValue, setCandidateSearchValue] = useState("");

  const teamDetailQuery = useQuery({
    queryKey: ["teams", "detail", teamId],
    queryFn: () => fetchTeam(teamId),
    enabled: teamId > 0,
  });
  const teamMembersQuery = useQuery({
    queryKey: ["teams", "members", teamId],
    queryFn: () => fetchTeamMembers(teamId),
    enabled: teamId > 0,
  });
  const teamCandidateMembersQuery = useQuery({
    queryKey: ["teams", "candidate-members", teamId],
    queryFn: () => fetchTeamCandidateMembers(teamId),
    enabled: canManageTeamCrud && teamId > 0,
  });

  const manageMembersMutation = useMutation({
    mutationFn: ({
      action,
      userIds,
    }: {
      action: "add" | "remove";
      userIds: number[];
    }) => manageTeamMembers(teamId, { action, user_ids: userIds }),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["teams", "detail", teamId] }),
        queryClient.invalidateQueries({ queryKey: ["teams", "members", teamId] }),
        queryClient.invalidateQueries({ queryKey: ["teams", "candidate-members", teamId] }),
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

  const selectedTeam = teamDetailQuery.data ?? null;
  const filteredMembers = useMemo(
    () => (teamMembersQuery.data ?? []).filter((member) => matchesMemberSearch(memberSearchValue, member)),
    [memberSearchValue, teamMembersQuery.data],
  );
  const filteredCandidateMembers = useMemo(
    () =>
      (teamCandidateMembersQuery.data ?? []).filter((member) =>
        matchesMemberSearch(candidateSearchValue, member),
      ),
    [candidateSearchValue, teamCandidateMembersQuery.data],
  );
  const teamDetailError =
    teamDetailQuery.error ?? teamMembersQuery.error ?? teamCandidateMembersQuery.error ?? null;

  useEffect(() => {
    setActiveTab("members");
    setSelectedCandidateIds([]);
    setSelectedMemberIds([]);
    setMemberSearchValue("");
    setCandidateSearchValue("");
  }, [teamId]);

  if (teamId <= 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            navigate(teamsRegistryPath);
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to teams
        </Button>
        {selectedTeam ? (
          <Badge variant={selectedTeam.is_active ? "success" : "neutral"}>
            {selectedTeam.is_active ? "Active team" : "Inactive team"}
          </Badge>
        ) : null}
      </div>

      {teamDetailError && !selectedTeam ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatTeamError(teamDetailError)}
        </div>
      ) : null}

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{selectedTeam?.name ?? `Team ${teamId}`}</CardTitle>
              <CardDescription>
                {selectedTeam?.description?.trim() || "No description"}
              </CardDescription>
            </div>
            {selectedTeam ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral">{`${selectedTeam.member_count} members`}</Badge>
                <Badge variant="neutral">{`#${selectedTeam.id}`}</Badge>
              </div>
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

          {selectedTeam ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Created by
                </div>
                <div className="mt-1 text-sm text-foreground">
                  {selectedTeam.created_by?.email ?? "Unknown"}
                </div>
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
                  Organization
                </div>
                <div className="mt-1 text-sm text-foreground">
                  {selectedTeam.organization?.name ?? "Not available"}
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {!canManageTeamCrud ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Only Organization Administrators can change team members or team policies.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-[calc(var(--radius)-4px)] border px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "members"
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border bg-card/80 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
          onClick={() => setActiveTab("members")}
        >
          <Users2 className="h-4 w-4" />
          Team members
        </button>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-[calc(var(--radius)-4px)] border px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "policies"
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border bg-card/80 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
          onClick={() => setActiveTab("policies")}
        >
          <Shield className="h-4 w-4" />
          Team policies
        </button>
      </div>

      {activeTab === "policies" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b border-border/70">
              <CardTitle>How team policies work</CardTitle>
              <CardDescription>
                Team sharing controls who can view or edit the team object itself. Membership is managed separately.
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

          <Card>
            <CardHeader className="border-b border-border/70">
              <CardTitle>Team sharing</CardTitle>
              <CardDescription>
                Use view and edit assignments to control who can access this team record.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              {selectedTeam && canManageTeamCrud ? (
                <MainSequencePermissionsTab
                  objectId={selectedTeam.id}
                  objectUrl={teamPermissionsObjectUrl}
                  entityLabel="Team"
                />
              ) : (
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/28 px-4 py-3 text-sm text-muted-foreground">
                  Only Organization Administrators can change team sharing from this page.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b border-border/70">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Current members</CardTitle>
                  <CardDescription>
                    {canManageTeamCrud ? "Search and remove users from this team." : "Users assigned to this team."}
                  </CardDescription>
                </div>
                {canManageTeamCrud ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={selectedMemberIds.length === 0 || manageMembersMutation.isPending}
                    onClick={() => {
                      if (selectedMemberIds.length === 0) {
                        return;
                      }

                      manageMembersMutation.mutate({
                        action: "remove",
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
            <CardContent className="space-y-4 p-4">
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={memberSearchValue}
                  onChange={(event) => setMemberSearchValue(event.target.value)}
                  placeholder="Search current members"
                  className="pl-9"
                />
              </div>

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
                      {filteredMembers.map((member) => (
                        <tr key={member.id}>
                          {canManageTeamCrud ? (
                            <td className="rounded-l-[calc(var(--radius)-2px)] border border-border/70 bg-background/24 px-3 py-[var(--table-standard-cell-padding-y)]">
                              <MainSequenceSelectionCheckbox
                                ariaLabel={`Select ${getTeamMemberName(member)}`}
                                checked={selectedMemberIds.includes(member.id)}
                                onChange={() =>
                                  setSelectedMemberIds((current) => toggleId(current, member.id))
                                }
                              />
                            </td>
                          ) : null}
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

              {!teamMembersQuery.isLoading && !teamMembersQuery.isError && (teamMembersQuery.data?.length ?? 0) === 0 ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3 text-sm text-muted-foreground">
                  No members are assigned to this team.
                </div>
              ) : null}

              {!teamMembersQuery.isLoading &&
              !teamMembersQuery.isError &&
              (teamMembersQuery.data?.length ?? 0) > 0 &&
              filteredMembers.length === 0 ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3 text-sm text-muted-foreground">
                  No current members match this search.
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
                      if (selectedCandidateIds.length === 0) {
                        return;
                      }

                      manageMembersMutation.mutate({
                        action: "add",
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
              <CardContent className="space-y-4 p-4">
                <div className="relative max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={candidateSearchValue}
                    onChange={(event) => setCandidateSearchValue(event.target.value)}
                    placeholder="Search available users"
                    className="pl-9"
                  />
                </div>

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
                        {filteredCandidateMembers.map((member) => (
                          <tr key={member.id}>
                            <td className="rounded-l-[calc(var(--radius)-2px)] border border-border/70 bg-background/24 px-3 py-[var(--table-standard-cell-padding-y)]">
                              <MainSequenceSelectionCheckbox
                                ariaLabel={`Select ${getTeamMemberName(member)}`}
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

                {!teamCandidateMembersQuery.isLoading &&
                !teamCandidateMembersQuery.isError &&
                (teamCandidateMembersQuery.data?.length ?? 0) > 0 &&
                filteredCandidateMembers.length === 0 ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3 text-sm text-muted-foreground">
                    No available users match this search.
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
