import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitBranch, Loader2 } from "lucide-react";

import { useAuthStore } from "@/auth/auth-store";
import {
  RbacAssignmentMatrix,
  type RbacAssignableTeam,
  type RbacAssignableUser,
  type RbacAssignmentScope,
  type RbacAssignmentValue,
} from "@/components/ui/rbac-assignment-matrix";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { listTeams } from "@/features/teams/api";

import {
  fetchObjectCanEdit,
  fetchObjectCanView,
  formatMainSequenceError,
  listPermissionCandidateUsers,
  propagateNamespacePermissions,
  setNamespacePermissions,
  type PermissionCandidateUserRecord,
  type ShareablePrincipalsResponse,
} from "../../../../common/api";
import {
  mergePermissionEntityIds,
  resolvePermissionEntityId,
} from "../../../../common/components/permissionEntityId";

const namespacePermissionsObjectUrl = "/orm/api/ts_manager/namespace";

const permissionScopes: RbacAssignmentScope[] = [
  {
    id: "view",
    title: "Can view",
    userHelperText: "Users on the right can view this namespace.",
    teamHelperText: "Teams on the right can view this namespace.",
  },
  {
    id: "edit",
    title: "Can edit",
    userHelperText: "Users on the right can edit this namespace.",
    teamHelperText: "Teams on the right can edit this namespace.",
  },
];

const emptyPermissionAssignments: RbacAssignmentValue = {
  view: { userIds: [], teamIds: [] },
  edit: { userIds: [], teamIds: [] },
};

function mergeRbacIds(...lists: Array<Array<string | number>>) {
  return mergePermissionEntityIds(...lists);
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

function buildNamespacePermissionAssignments(value: RbacAssignmentValue) {
  return {
    view: {
      userIds: value.view?.userIds ?? [],
      teamIds: value.view?.teamIds ?? [],
    },
    edit: {
      userIds: value.edit?.userIds ?? [],
      teamIds: value.edit?.teamIds ?? [],
    },
  };
}

function buildPermissionValue(
  canView: ShareablePrincipalsResponse | undefined,
  canEdit: ShareablePrincipalsResponse | undefined,
) {
  return normalizePermissionValue({
    view: {
      userIds: mergePermissionEntityIds(canView?.users ?? []),
      teamIds: mergePermissionEntityIds(canView?.teams ?? []),
    },
    edit: {
      userIds: mergePermissionEntityIds(canEdit?.users ?? []),
      teamIds: mergePermissionEntityIds(canEdit?.teams ?? []),
    },
  });
}

export function MainSequenceNamespacePermissionsCard({
  namespaceUid,
  enabled = true,
}: {
  namespaceUid: string;
  enabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sessionUser = useAuthStore((state) => state.session?.user ?? null);
  const [permissionsValue, setPermissionsValue] =
    useState<RbacAssignmentValue>(emptyPermissionAssignments);

  const canViewQuery = useQuery({
    queryKey: ["main_sequence", "namespaces", "permissions", namespaceUid, "view"],
    queryFn: () => fetchObjectCanView(namespacePermissionsObjectUrl, namespaceUid),
    enabled: enabled && namespaceUid.trim().length > 0,
    staleTime: 60_000,
  });

  const canEditQuery = useQuery({
    queryKey: ["main_sequence", "namespaces", "permissions", namespaceUid, "edit"],
    queryFn: () => fetchObjectCanEdit(namespacePermissionsObjectUrl, namespaceUid),
    enabled: enabled && namespaceUid.trim().length > 0,
    staleTime: 60_000,
  });

  const permissionCandidateUsersQuery = useQuery({
    queryKey: ["main_sequence", "namespaces", "permissions", namespaceUid, "candidate-users"],
    queryFn: () => listPermissionCandidateUsers(namespacePermissionsObjectUrl, namespaceUid),
    enabled: enabled && namespaceUid.trim().length > 0,
    staleTime: 300_000,
    retry: false,
  });

  const permissionTeamsQuery = useQuery({
    queryKey: ["main_sequence", "namespaces", "permissions", "teams"],
    queryFn: () => listTeams(),
    enabled: enabled && namespaceUid.trim().length > 0,
    staleTime: 300_000,
  });

  const persistedPermissionsValue = useMemo(
    () => buildPermissionValue(canViewQuery.data, canEditQuery.data),
    [canEditQuery.data, canViewQuery.data],
  );

  const permissionUsers = useMemo<RbacAssignableUser[]>(() => {
    const usersById = new Map<string, RbacAssignableUser>();

    for (const user of permissionCandidateUsersQuery.data ?? []) {
      const normalizedId = resolvePermissionEntityId(user);

      if (normalizedId === null) {
        continue;
      }

      usersById.set(String(normalizedId), {
        id: normalizedId,
        email: user.email,
        name: formatPermissionUserName(user),
      });
    }

    for (const user of [...(canViewQuery.data?.users ?? []), ...(canEditQuery.data?.users ?? [])]) {
      const normalizedId = resolvePermissionEntityId(user);

      if (normalizedId === null) {
        continue;
      }

      usersById.set(String(normalizedId), {
        id: normalizedId,
        email: user.email,
        name: formatPermissionUserName(user),
      });
    }

    if (sessionUser) {
      const normalizedId = resolvePermissionEntityId(sessionUser);

      if (normalizedId !== null) {
        const existingUser = usersById.get(String(normalizedId));

        usersById.set(String(normalizedId), {
          id: normalizedId,
          email: sessionUser.email,
          name: sessionUser.name || existingUser?.name || sessionUser.email,
        });
      }
    }

    return [...usersById.values()].sort((left, right) => left.email.localeCompare(right.email));
  }, [canEditQuery.data?.users, canViewQuery.data?.users, permissionCandidateUsersQuery.data, sessionUser]);

  const permissionTeams = useMemo<RbacAssignableTeam[]>(() => {
    const teamsById = new Map<string, RbacAssignableTeam>();

    for (const team of permissionTeamsQuery.data ?? []) {
      const normalizedId = resolvePermissionEntityId(team);

      if (normalizedId === null) {
        continue;
      }

      teamsById.set(String(normalizedId), {
        id: normalizedId,
        name: team.name,
        description: team.description,
        memberCount: team.member_count,
      });
    }

    for (const team of [...(canViewQuery.data?.teams ?? []), ...(canEditQuery.data?.teams ?? [])]) {
      const normalizedId = resolvePermissionEntityId(team);

      if (normalizedId === null) {
        continue;
      }

      teamsById.set(String(normalizedId), {
        id: normalizedId,
        name: team.name,
        description: team.description,
        memberCount: team.member_count,
      });
    }

    return [...teamsById.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [canEditQuery.data?.teams, canViewQuery.data?.teams, permissionTeamsQuery.data]);

  const permissionsLoading =
    canViewQuery.isLoading ||
    canEditQuery.isLoading ||
    permissionTeamsQuery.isLoading;
  const permissionsError =
    canViewQuery.error ??
    canEditQuery.error ??
    permissionTeamsQuery.error ??
    null;

  const updatePermissionsMutation = useMutation({
    mutationFn: async (nextValue: RbacAssignmentValue) => {
      const normalizedNextValue = normalizePermissionValue(nextValue);

      await setNamespacePermissions(
        namespaceUid,
        buildNamespacePermissionAssignments(normalizedNextValue),
      );

      return normalizedNextValue;
    },
    onSuccess: async (value) => {
      setPermissionsValue(value);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "namespaces", "permissions", namespaceUid, "view"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "namespaces", "permissions", namespaceUid, "edit"],
        }),
      ]);

      toast({
        variant: "success",
        title: "Permissions updated",
        description: "Namespace access rules were saved.",
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

  const propagatePermissionsMutation = useMutation({
    mutationFn: () => propagateNamespacePermissions(namespaceUid),
    onSuccess: () => {
      toast({
        variant: "success",
        title: "Permissions propagated",
        description: "Namespace permissions were propagated to related tables.",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Permission propagation failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  useEffect(() => {
    setPermissionsValue(emptyPermissionAssignments);
  }, [namespaceUid]);

  useEffect(() => {
    if (!enabled || !canViewQuery.data || !canEditQuery.data) {
      return;
    }

    setPermissionsValue(persistedPermissionsValue);
  }, [canEditQuery.data, canViewQuery.data, enabled, persistedPermissionsValue]);

  if (!enabled || !namespaceUid.trim()) {
    return null;
  }

  if (permissionsLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading permissions
        </div>
      </div>
    );
  }

  if (permissionsError) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {formatMainSequenceError(permissionsError)}
      </div>
    );
  }

  const namespaceCandidateUsersUnavailable = permissionCandidateUsersQuery.isError;
  const busy = updatePermissionsMutation.isPending || propagatePermissionsMutation.isPending;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Save applies the current namespace assignments. Propagate pushes those assignments to the
          related tables.
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => propagatePermissionsMutation.mutate()}
        >
          {propagatePermissionsMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GitBranch className="h-4 w-4" />
          )}
          Propagate Permissions
        </Button>
      </div>

      {updatePermissionsMutation.isPending ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3 text-sm text-muted-foreground">
          Saving permission changes
        </div>
      ) : null}

      {namespaceCandidateUsersUnavailable ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          Namespace candidate users could not be loaded. The matrix still includes currently
          assigned users and teams.
        </div>
      ) : null}

      <div className={busy ? "pointer-events-none opacity-70" : undefined}>
        <RbacAssignmentMatrix
          scopes={permissionScopes}
          users={permissionUsers}
          teams={permissionTeams}
          value={permissionsValue}
          onChange={(nextValue) => {
            if (busy) {
              return;
            }

            updatePermissionsMutation.mutate(nextValue);
          }}
        />
      </div>
    </div>
  );
}
