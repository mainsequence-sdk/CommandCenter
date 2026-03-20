import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/auth/auth-store";
import { ROLE_LABELS, ROLE_PERMISSIONS } from "@/auth/permissions";
import { getPermissionDefinitions } from "@/auth/permission-catalog";
import { commandCenterConfig } from "@/config/command-center";
import {
  RbacPolicyStudio,
  type RbacPolicyStudioPermissionOption,
  type RbacPolicyStudioPolicy,
} from "@/components/ui/rbac-policy-studio";

import { listAccessRbacGroups } from "./api";
import { AccessRbacSurfaceLayout, accessRbacRoles } from "./shared";

const accessClassDescriptions: Record<(typeof accessRbacRoles)[number], string> = {
  user: "General non-admin shell baseline used for normal users across the platform.",
  admin: "Platform operator shell class with access to administrative views and controls.",
};

function splitConfiguredGroups(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toPermissionOptions(): RbacPolicyStudioPermissionOption[] {
  return getPermissionDefinitions().map((permission) => ({
    id: permission.id,
    label: permission.label,
    description: permission.description,
    category: permission.category,
  }));
}

export function AccessRbacPoliciesPage() {
  const sessionUserId = useAuthStore((state) => state.session?.user.id ?? "shared");
  const groupsQuery = useQuery({
    queryKey: ["access-rbac", "groups"],
    queryFn: () => listAccessRbacGroups(),
    staleTime: 300_000,
  });
  const permissionOptions = useMemo(() => toPermissionOptions(), []);
  const initialPolicies = useMemo<RbacPolicyStudioPolicy[]>(
    () =>
      accessRbacRoles.map((role) => ({
        id: role,
        label: ROLE_LABELS[role],
        description: accessClassDescriptions[role],
        backendGroups: splitConfiguredGroups(
          commandCenterConfig.auth.jwt.userDetails.roleGroups[role],
        ),
        permissions: [...ROLE_PERMISSIONS[role]],
        locked: true,
      })),
    [],
  );

  return (
    <AccessRbacSurfaceLayout
      title="Policy studio"
      description="Define shell policies as permission bundles. App-level permissions appear here only when an app explicitly registers its shell access contract."
    >
      <RbacPolicyStudio
        storageKey={`access-rbac.policy-studio.${sessionUserId}`}
        initialPolicies={initialPolicies}
        permissionOptions={permissionOptions}
        availableGroups={groupsQuery.data ?? []}
        groupsLoading={groupsQuery.isLoading}
        groupsError={groupsQuery.error instanceof Error ? groupsQuery.error.message : null}
        lockedGroupPolicyIds={["admin"]}
      />
    </AccessRbacSurfaceLayout>
  );
}
