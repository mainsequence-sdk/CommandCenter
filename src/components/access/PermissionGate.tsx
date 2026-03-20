import type { ReactNode } from "react";

import { useAuthStore } from "@/auth/auth-store";
import { hasAllPermissions, hasAnyPermission } from "@/auth/permissions";

export function PermissionGate({
  children,
  fallback = null,
  allOf = [],
  anyOf = [],
}: {
  children: ReactNode;
  fallback?: ReactNode;
  allOf?: string[];
  anyOf?: string[];
}) {
  const permissions = useAuthStore((state) => state.session?.user.permissions ?? []);
  const allowed = hasAllPermissions(permissions, allOf) && hasAnyPermission(permissions, anyOf);

  return allowed ? <>{children}</> : <>{fallback}</>;
}
