import { useMemo } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getPermissionDefinitions } from "@/auth/permission-catalog";
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

function toPermissionOptions(): RbacPolicyStudioPermissionOption[] {
  return getPermissionDefinitions().map((permission) => ({
    id: permission.id,
    label: permission.label,
    description: permission.description,
    category: permission.category,
  }));
}

export function AccessRbacPoliciesPage() {
  const queryClient = useQueryClient();
  const permissionOptions = useMemo(() => toPermissionOptions(), []);
  const policiesQuery = useQuery({
    queryKey: ["access-rbac", "policies"],
    queryFn: () => listAccessPolicies(),
    staleTime: 60_000,
  });
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
      description="Manage reusable Command Center permission bundles. `light-user`, `dev-user`, and `org-admin-user` remain fixed built-ins, while hidden admin-class policies stay backend-enforced and do not appear here."
    >
      <RbacPolicyStudio
        policies={policiesQuery.data ?? []}
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
