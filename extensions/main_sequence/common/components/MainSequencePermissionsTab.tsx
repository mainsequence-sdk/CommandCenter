import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { useAuthStore } from "@/auth/auth-store";
import {
  RbacAssignmentMatrix,
  type RbacAssignableTeam,
  type RbacAssignableUser,
  type RbacAssignmentScope,
  type RbacAssignmentValue,
} from "@/components/ui/rbac-assignment-matrix";
import { useToast } from "@/components/ui/toaster";

import {
  fetchObjectCanEdit,
  fetchObjectCanView,
  formatMainSequenceError,
  listPermissionCandidateUsers,
  updateShareableObjectPermission,
  type PermissionCandidateUserRecord,
  type ShareableAccessLevel,
  type ShareablePrincipalsResponse,
  type ShareablePrincipalType,
} from "../api";
import { listTeams } from "@/features/teams/api";

const defaultPermissionScopes: RbacAssignmentScope[] = [
  {
    id: "view",
    title: "Can view",
    userHelperText: "Users on the right can view this object.",
    teamHelperText: "Teams on the right can view this object.",
  },
  {
    id: "edit",
    title: "Can edit",
    userHelperText: "Users on the right can edit this object.",
    teamHelperText: "Teams on the right can edit this object.",
  },
];

const emptyPermissionAssignments: RbacAssignmentValue = {
  view: { userIds: [], teamIds: [] },
  edit: { userIds: [], teamIds: [] },
};

function normalizePermissionEntityId(id: string | number) {
  if (typeof id === "number") {
    return id;
  }

  const trimmed = id.trim();

  if (/^-?\d+$/.test(trimmed)) {
    const parsed = Number(trimmed);

    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }

  return trimmed;
}

function mergeRbacIds(...lists: Array<Array<string | number>>) {
  const seen = new Set<string>();

  return lists.flat().map(normalizePermissionEntityId).filter((id) => {
    const key = String(id);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
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

function buildPermissionValue(
  canView: ShareablePrincipalsResponse | undefined,
  canEdit: ShareablePrincipalsResponse | undefined,
) {
  return normalizePermissionValue({
    view: {
      userIds: canView?.users.map((user) => user.id) ?? [],
      teamIds: canView?.teams.map((team) => team.id) ?? [],
    },
    edit: {
      userIds: canEdit?.users.map((user) => user.id) ?? [],
      teamIds: canEdit?.teams.map((team) => team.id) ?? [],
    },
  });
}

function resolvePermissionLevel(
  value: RbacAssignmentValue,
  principalType: ShareablePrincipalType,
  principalId: string | number,
): ShareableAccessLevel | "none" {
  const normalizedId = String(normalizePermissionEntityId(principalId));
  const editIds =
    principalType === "user" ? value.edit?.userIds ?? [] : value.edit?.teamIds ?? [];
  const viewIds =
    principalType === "user" ? value.view?.userIds ?? [] : value.view?.teamIds ?? [];

  if (editIds.some((id) => String(normalizePermissionEntityId(id)) === normalizedId)) {
    return "edit";
  }

  if (viewIds.some((id) => String(normalizePermissionEntityId(id)) === normalizedId)) {
    return "view";
  }

  return "none";
}

function buildPermissionOperations(
  currentValue: RbacAssignmentValue,
  nextValue: RbacAssignmentValue,
) {
  const operations: Array<{
    principalId: string | number;
    principalType: ShareablePrincipalType;
    accessLevel: ShareableAccessLevel;
    operation: "add" | "remove";
  }> = [];

  for (const principalType of ["user", "team"] as const) {
    const principalIds =
      principalType === "user"
        ? mergeRbacIds(
            currentValue.view.userIds,
            currentValue.edit.userIds,
            nextValue.view.userIds,
            nextValue.edit.userIds,
          )
        : mergeRbacIds(
            currentValue.view.teamIds,
            currentValue.edit.teamIds,
            nextValue.view.teamIds,
            nextValue.edit.teamIds,
          );

    for (const principalId of principalIds) {
      const currentLevel = resolvePermissionLevel(currentValue, principalType, principalId);
      const nextLevel = resolvePermissionLevel(nextValue, principalType, principalId);

      if (currentLevel === nextLevel) {
        continue;
      }

      if (nextLevel === "none") {
        operations.push({
          principalId,
          principalType,
          accessLevel: "view",
          operation: "remove",
        });
        continue;
      }

      if (nextLevel === "edit") {
        operations.push({
          principalId,
          principalType,
          accessLevel: "edit",
          operation: "add",
        });
        continue;
      }

      if (currentLevel === "edit" && nextLevel === "view") {
        operations.push({
          principalId,
          principalType,
          accessLevel: "edit",
          operation: "remove",
        });
        continue;
      }

      operations.push({
        principalId,
        principalType,
        accessLevel: "view",
        operation: "add",
      });
    }
  }

  return operations;
}

export function MainSequencePermissionsTab({
  objectId,
  objectUrl,
  entityLabel,
  enabled = true,
}: {
  objectId: number;
  objectUrl: string;
  entityLabel: string;
  enabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sessionUser = useAuthStore((state) => state.session?.user ?? null);
  const [permissionsValue, setPermissionsValue] =
    useState<RbacAssignmentValue>(emptyPermissionAssignments);

  const canViewQuery = useQuery({
    queryKey: ["main_sequence", "permissions", objectUrl, objectId, "view"],
    queryFn: () => fetchObjectCanView(objectUrl, objectId),
    enabled: enabled && objectId > 0,
    staleTime: 60_000,
  });

  const canEditQuery = useQuery({
    queryKey: ["main_sequence", "permissions", objectUrl, objectId, "edit"],
    queryFn: () => fetchObjectCanEdit(objectUrl, objectId),
    enabled: enabled && objectId > 0,
    staleTime: 60_000,
  });

  const permissionCandidateUsersQuery = useQuery({
    queryKey: ["main_sequence", "permissions", objectUrl, objectId, "candidate-users"],
    queryFn: () => listPermissionCandidateUsers(objectUrl, objectId),
    enabled: enabled && objectId > 0,
    staleTime: 300_000,
  });
  const permissionTeamsQuery = useQuery({
    queryKey: ["main_sequence", "permissions", "teams"],
    queryFn: () => listTeams(),
    enabled: enabled && objectId > 0,
    staleTime: 300_000,
  });

  const persistedPermissionsValue = useMemo(
    () => buildPermissionValue(canViewQuery.data, canEditQuery.data),
    [canEditQuery.data, canViewQuery.data],
  );

  const permissionUsers = useMemo<RbacAssignableUser[]>(() => {
    const usersById = new Map<string, RbacAssignableUser>();

    for (const user of permissionCandidateUsersQuery.data ?? []) {
      const normalizedId = normalizePermissionEntityId(user.id);

      usersById.set(String(normalizedId), {
        id: normalizedId,
        email: user.email,
        name: formatPermissionUserName(user),
      });
    }

    for (const user of [...(canViewQuery.data?.users ?? []), ...(canEditQuery.data?.users ?? [])]) {
      const normalizedId = normalizePermissionEntityId(user.id);

      usersById.set(String(normalizedId), {
        id: normalizedId,
        email: user.email,
        name: formatPermissionUserName(user),
      });
    }

    if (sessionUser) {
      const normalizedId = normalizePermissionEntityId(sessionUser.id);
      const existingUser = usersById.get(String(normalizedId));

      usersById.set(String(normalizedId), {
        id: normalizedId,
        email: sessionUser.email,
        name: sessionUser.name || existingUser?.name || sessionUser.email,
      });
    }

    return [...usersById.values()].sort((left, right) => left.email.localeCompare(right.email));
  }, [canEditQuery.data?.users, canViewQuery.data?.users, permissionCandidateUsersQuery.data, sessionUser]);

  const permissionTeams = useMemo<RbacAssignableTeam[]>(() => {
    const teamsById = new Map<string, RbacAssignableTeam>();

    for (const team of permissionTeamsQuery.data ?? []) {
      teamsById.set(String(team.id), {
        id: team.id,
        name: team.name,
        description: team.description,
        memberCount: team.member_count,
      });
    }

    for (const team of [...(canViewQuery.data?.teams ?? []), ...(canEditQuery.data?.teams ?? [])]) {
      const normalizedId = normalizePermissionEntityId(team.id);

      teamsById.set(String(normalizedId), {
        id: normalizedId,
        name: team.name,
        description: team.description,
        memberCount: team.member_count,
      });
    }

    return [...teamsById.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [canEditQuery.data?.teams, canViewQuery.data?.teams, permissionTeamsQuery.data]);

  const permissionsTabLoading =
    permissionCandidateUsersQuery.isLoading ||
    permissionTeamsQuery.isLoading ||
    canViewQuery.isLoading ||
    canEditQuery.isLoading;
  const permissionsTabError =
    permissionCandidateUsersQuery.error ??
    permissionTeamsQuery.error ??
    canViewQuery.error ??
    canEditQuery.error ??
    null;

  const updatePermissionsMutation = useMutation({
    mutationFn: async (nextValue: RbacAssignmentValue) => {
      const normalizedCurrentValue = normalizePermissionValue(permissionsValue);
      const normalizedNextValue = normalizePermissionValue(nextValue);
      const operations = buildPermissionOperations(normalizedCurrentValue, normalizedNextValue);

      for (const operation of operations) {
        await updateShareableObjectPermission({
          objectUrl,
          objectId,
          principalType: operation.principalType,
          accessLevel: operation.accessLevel,
          operation: operation.operation,
          principalId: operation.principalId,
        });
      }

      return {
        changed: operations.length > 0,
        value: normalizedNextValue,
      };
    },
    onSuccess: async ({ changed, value }) => {
      setPermissionsValue(value);

      if (!changed) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "permissions", objectUrl, objectId, "view"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "permissions", objectUrl, objectId, "edit"],
        }),
      ]);

      toast({
        variant: "success",
        title: "Permissions updated",
        description: `${entityLabel} access rules were saved.`,
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

  useEffect(() => {
    setPermissionsValue(emptyPermissionAssignments);
  }, [objectId]);

  useEffect(() => {
    if (!enabled || !objectId || !canViewQuery.data || !canEditQuery.data) {
      return;
    }

    setPermissionsValue(persistedPermissionsValue);
  }, [canEditQuery.data, canViewQuery.data, enabled, objectId, persistedPermissionsValue]);

  if (!enabled || objectId <= 0) {
    return null;
  }

  if (permissionsTabLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading permissions
        </div>
      </div>
    );
  }

  if (permissionsTabError) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {formatMainSequenceError(permissionsTabError)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {updatePermissionsMutation.isPending ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3 text-sm text-muted-foreground">
          Saving permission changes
        </div>
      ) : null}

      <div className={updatePermissionsMutation.isPending ? "pointer-events-none opacity-70" : undefined}>
        <RbacAssignmentMatrix
          scopes={defaultPermissionScopes}
          users={permissionUsers}
          teams={permissionTeams}
          value={permissionsValue}
          onChange={(nextValue) => {
            if (updatePermissionsMutation.isPending) {
              return;
            }

            updatePermissionsMutation.mutate(nextValue);
          }}
        />
      </div>
    </div>
  );
}
