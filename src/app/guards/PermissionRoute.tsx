import type { ReactNode } from "react";

import { Navigate } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";
import { hasAnyPermission } from "@/auth/permissions";

const EMPTY_PERMISSIONS: string[] = [];

export function PermissionRoute({
  children,
  anyOf = [],
}: {
  children: ReactNode;
  anyOf?: string[];
}) {
  const permissions = useAuthStore((state) => state.session?.user.permissions) ?? EMPTY_PERMISSIONS;

  if (!hasAnyPermission(permissions, anyOf)) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
