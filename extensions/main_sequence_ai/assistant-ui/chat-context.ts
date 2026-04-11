import { useMemo } from "react";

import { useLocation, useParams } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";
import { resolveChatSurfaceContext } from "./surface-context";

export interface ChatViewContext {
  appId?: string;
  appTitle?: string;
  currentPath: string;
  surfaceId?: string;
  surfaceActions: string[];
  surfaceContextSource: "fallback" | "route" | "surface";
  surfaceDetails: Record<string, string>;
  surfaceSummary: string;
  userId?: string;
  surfaceTitle?: string;
}

export function useChatViewContext(): ChatViewContext {
  const location = useLocation();
  const params = useParams();
  const user = useAuthStore((state) => state.session?.user);
  const currentPath = `${location.pathname}${location.search}${location.hash}`;

  return useMemo(
    () => {
      const resolvedSurfaceContext = resolveChatSurfaceContext({
        currentPath,
        pathname: location.pathname,
        permissionCount: user?.permissions.length ?? 0,
        role: user?.role,
        routeAppId: params.appId,
        routeSurfaceId: params.surfaceId,
        searchParams: new URLSearchParams(location.search),
        userId: user?.id,
      });

      return {
        appId: resolvedSurfaceContext.appId ?? params.appId,
        appTitle: resolvedSurfaceContext.appTitle,
        currentPath,
        surfaceActions: resolvedSurfaceContext.availableActions,
        surfaceContextSource: resolvedSurfaceContext.source,
        surfaceDetails: resolvedSurfaceContext.details,
        surfaceId: resolvedSurfaceContext.surfaceId ?? params.surfaceId,
        surfaceSummary: resolvedSurfaceContext.summary,
        surfaceTitle: resolvedSurfaceContext.surfaceTitle,
        userId: user?.id,
      };
    },
    [
      currentPath,
      location.hash,
      location.pathname,
      location.search,
      params.appId,
      params.surfaceId,
      user?.id,
      user?.permissions.length,
      user?.role,
    ],
  );
}
