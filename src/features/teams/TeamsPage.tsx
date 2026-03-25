import { useDeferredValue, useMemo, useState, type ChangeEvent } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Users2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  listTeams,
  type TeamListRecord,
} from "./api";
import {
  formatTeamError,
  getTeamDetailPath,
  useCanManageTeamCrud,
} from "./shared";
import { MainSequenceRegistrySearch } from "../../../extensions/main_sequence/common/components/MainSequenceRegistrySearch";
import { MainSequenceSelectionCheckbox } from "../../../extensions/main_sequence/common/components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../../extensions/main_sequence/common/components/registryTable";
import { useRegistrySelection } from "../../../extensions/main_sequence/common/hooks/useRegistrySelection";

function formatTeamDeleteLabel(count: number) {
  return count === 1 ? "Delete selected team" : "Delete selected teams";
}

export function TeamsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canManageTeamCrud = useCanManageTeamCrud();
  const [filterValue, setFilterValue] = useState("");
  const deferredFilterValue = useDeferredValue(filterValue);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");

  const teamsQuery = useQuery({
    queryKey: ["teams", "list", deferredFilterValue],
    queryFn: () => listTeams({ search: deferredFilterValue.trim() || undefined }),
  });

  const teams = teamsQuery.data ?? [];
  const teamSelection = useRegistrySelection(teams);
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
      navigate(getTeamDetailPath(team.id));
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Team creation failed",
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
      {!embedded ? (
        <PageHeader
          eyebrow="Users"
          title="Teams"
          description="Browse organization teams and open a dedicated detail page for membership and sharing."
          actions={<Badge variant="neutral">{`${teams.length} teams`}</Badge>}
        />
      ) : null}

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Teams registry</CardTitle>
              <CardDescription>
                Keep this screen focused on the list, then open a team to manage its policies and members.
              </CardDescription>
              {!canManageTeamCrud ? (
                <div className="mt-2 text-xs text-muted-foreground">
                  Only Organization Admin profiles can create, delete, or manage team memberships.
                </div>
              ) : null}
            </div>
            {canManageTeamCrud ? (
              <div className="flex justify-end">
                <Button
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
              </div>
            ) : null}
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
              accessory={<Badge variant="neutral">{`${teams.length} teams`}</Badge>}
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

          {!teamsQuery.isLoading && !teamsQuery.isError && teams.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Users2 className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No teams found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                {canManageTeamCrud
                  ? "Create a team or clear the current filter."
                  : "Clear the current filter to see more teams."}
              </p>
            </div>
          ) : null}

          {!teamsQuery.isLoading && !teamsQuery.isError && teams.length > 0 ? (
            <div className="overflow-x-auto px-4 py-4">
              <table className="w-full min-w-[820px] border-separate border-spacing-y-2 text-sm">
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
                    <th className="px-4 py-[var(--table-standard-header-padding-y)] text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => (
                    <tr key={team.id}>
                      {canManageTeamCrud ? (
                        <td className={getRegistryTableCellClassName(teamSelection.isSelected(team.id), "left")}>
                          <MainSequenceSelectionCheckbox
                            ariaLabel={`Select ${team.name}`}
                            checked={teamSelection.isSelected(team.id)}
                            onChange={() => teamSelection.toggleSelection(team.id)}
                          />
                        </td>
                      ) : null}
                      <td
                        className={getRegistryTableCellClassName(
                          canManageTeamCrud ? teamSelection.isSelected(team.id) : false,
                          canManageTeamCrud ? "middle" : "left",
                        )}
                      >
                        <div className="font-medium text-foreground">{team.name}</div>
                      </td>
                      <td className={getRegistryTableCellClassName(canManageTeamCrud ? teamSelection.isSelected(team.id) : false)}>
                        <span className="text-muted-foreground">
                          {team.description?.trim() || "No description"}
                        </span>
                      </td>
                      <td className={getRegistryTableCellClassName(canManageTeamCrud ? teamSelection.isSelected(team.id) : false)}>
                        {team.member_count}
                      </td>
                      <td className={getRegistryTableCellClassName(canManageTeamCrud ? teamSelection.isSelected(team.id) : false)}>
                        <Badge variant={team.is_active ? "success" : "neutral"}>
                          {team.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td
                        className={getRegistryTableCellClassName(
                          canManageTeamCrud ? teamSelection.isSelected(team.id) : false,
                          "right",
                        )}
                      >
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(getTeamDetailPath(team.id))}
                        >
                          Open
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

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
