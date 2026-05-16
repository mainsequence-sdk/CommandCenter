import { useMemo } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getPermissionDefinitions } from "@/auth/permission-catalog";
import { PLATFORM_ADMIN_PERMISSION } from "@/auth/permissions";
import {
  RbacPolicyStudio,
  type RbacPolicyStudioPermissionOption,
} from "@/components/ui/rbac-policy-studio";

import {
  createAccessPolicy,
  deleteAccessPolicy,
  listAccessPolicies,
  updateAccessPolicy,
  type AccessPolicy,
} from "./api";
import { AccessRbacSurfaceLayout } from "./shared";

const nonAssignablePermissionIds = new Set([PLATFORM_ADMIN_PERMISSION]);

function toPermissionOptions(policies: AccessPolicy[]): RbacPolicyStudioPermissionOption[] {
  const options = new Map<string, RbacPolicyStudioPermissionOption>();

  getPermissionDefinitions().forEach((permission) => {
    if (nonAssignablePermissionIds.has(permission.id)) {
      return;
    }

    options.set(permission.id, {
      id: permission.id,
      label: permission.label,
      description: permission.description,
      category: permission.category,
    });
  });

  policies
    .flatMap((policy) => policy.permissions)
    .map((permission) => permission.trim())
    .filter(Boolean)
    .forEach((permissionId) => {
      if (nonAssignablePermissionIds.has(permissionId) || options.has(permissionId)) {
        return;
      }

      options.set(permissionId, {
        id: permissionId,
        label: permissionId,
        description:
          "Permission discovered from an existing backend policy but not defined in the frontend permission catalog yet.",
        category: "Discovered",
      });
    });

  return Array.from(options.values());
}

export function AccessRbacPoliciesPage() {
  const queryClient = useQueryClient();
  const policiesQuery = useQuery({
    queryKey: ["access-rbac", "policies"],
    queryFn: () => listAccessPolicies(),
    staleTime: 60_000,
  });
  const policies = policiesQuery.data ?? [];
  const permissionOptions = useMemo(() => toPermissionOptions(policies), [policies]);
  const createPolicyMutation = useMutation({
    mutationFn: createAccessPolicy,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["access-rbac", "policies"],
      });
    },
  });
  const updatePolicyMutation = useMutation({
    mutationFn: ({
      input,
      policyId,
    }: {
      policyId: number;
      input: Parameters<typeof updateAccessPolicy>[1];
    }) => updateAccessPolicy(policyId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["access-rbac", "policies"],
      });
    },
  });
  const deletePolicyMutation = useMutation({
    mutationFn: (policy: AccessPolicy) => deleteAccessPolicy(policy.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["access-rbac", "policies"],
      });
    },
  });

  return (
    <AccessRbacSurfaceLayout
      title="Policy studio"
      description="Manage reusable Command Center permission bundles. System policies remain backend-owned and read-only here."
    >
      <RbacPolicyStudio
        policies={policies}
        permissionOptions={permissionOptions}
        isLoading={policiesQuery.isLoading}
        error={policiesQuery.error instanceof Error ? policiesQuery.error.message : null}
        onCreatePolicy={(input) => createPolicyMutation.mutateAsync(input)}
        onUpdatePolicy={(policyId, input) =>
          updatePolicyMutation.mutateAsync({
            policyId,
            input,
          })
        }
        onDeletePolicy={(policy) => deletePolicyMutation.mutateAsync(policy)}
      />
    </AccessRbacSurfaceLayout>
  );
}
