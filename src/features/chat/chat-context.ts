import { useMemo } from "react";

import { useLocation, useParams } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";

export interface ChatViewContext {
  appId?: string;
  currentPath: string;
  permissionCount: number;
  role?: string;
  surfaceId?: string;
  userEmail?: string;
  userId?: string;
  userName?: string;
}

export function useChatViewContext(): ChatViewContext {
  const location = useLocation();
  const params = useParams();
  const user = useAuthStore((state) => state.session?.user);

  return useMemo(
    () => ({
      appId: params.appId,
      currentPath: `${location.pathname}${location.search}${location.hash}`,
      permissionCount: user?.permissions.length ?? 0,
      role: user?.role,
      surfaceId: params.surfaceId,
      userEmail: user?.email,
      userId: user?.id,
      userName: user?.name,
    }),
    [
      location.hash,
      location.pathname,
      location.search,
      params.appId,
      params.surfaceId,
      user?.email,
      user?.id,
      user?.name,
      user?.permissions.length,
      user?.role,
    ],
  );
}
