import { Navigate, createBrowserRouter, useParams } from "react-router-dom";

import { PermissionRoute } from "@/app/guards/PermissionRoute";
import { ProtectedRoute } from "@/app/guards/ProtectedRoute";
import { AppShell } from "@/app/layout/AppShell";
import { env } from "@/config/env";
import { AppPage } from "@/features/apps/AppPage";
import { AppRedirect } from "@/features/apps/AppRedirect";
import { LegacyDashboardRedirect } from "@/features/apps/LegacyDashboardRedirect";
import { LegacyMainSequenceWorkbenchRedirect } from "@/features/apps/LegacyMainSequenceWorkbenchRedirect";
import { LegacyWorkspaceRedirect } from "@/features/apps/LegacyWorkspaceRedirect";
import { LoginPage } from "@/features/auth/LoginPage";
import { LoginPageV2 } from "@/features/auth/LoginPageV2";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { ExtensionsGalleryPage } from "@/features/extensions/ExtensionsGalleryPage";
import { NotFoundPage } from "@/features/misc/NotFoundPage";
import { ThemeStudioPage } from "@/features/themes/ThemeStudioPage";
import { WidgetExplorerPage } from "@/features/widgets/WidgetExplorerPage";
import { AccessRbacTeamDetailPage } from "@/extensions/core/apps/access-rbac/AccessRbacTeamDetailPage";
import { LegacyDemoRedirect } from "../../extensions/demo/LegacyDemoRedirect";
import { MainSequenceAssetCategoryDetailPage } from "../../extensions/main_sequence/extensions/markets/features/asset-categories/MainSequenceAssetCategoryDetailPage";
import { MainSequenceAssetTranslationTableDetailPage } from "../../extensions/main_sequence/extensions/markets/features/asset-translation-tables/MainSequenceAssetTranslationTableDetailPage";
import { MainSequenceExecutionVenueDetailPage } from "../../extensions/main_sequence/extensions/markets/features/execution-venues/MainSequenceExecutionVenueDetailPage";
import { MainSequencePortfolioGroupDetailPage } from "../../extensions/main_sequence/extensions/markets/features/portfolio-groups/MainSequencePortfolioGroupDetailPage";
import { MainSequenceClusterDetailPage } from "../../extensions/main_sequence/extensions/workbench/features/clusters/MainSequenceClusterDetailPage";
import { CHAT_PAGE_PATH } from "../../extensions/main_sequence_ai/assistant-ui/chat-ui-store";

function LegacyWidgetDetailsRedirect() {
  const { widgetId = "" } = useParams();

  return (
    <Navigate
      to={`/app/workspace-studio/widget-catalog/${encodeURIComponent(widgetId)}`}
      replace
    />
  );
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/login-v2",
    element: <LoginPageV2 />,
  },
  {
    path: "/reset-password",
    element: <ResetPasswordPage />,
  },
  {
    path: "/extensions",
    element: <ExtensionsGalleryPage />,
  },
  {
    path: "/",
    element: <Navigate to="/app" replace />,
  },
  {
    path: "/app",
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <AppRedirect />,
      },
      {
        path: "widgets",
        element: (
          <PermissionRoute anyOf={["widget.catalog:view"]}>
            <Navigate to="/app/workspace-studio/widget-catalog" replace />
          </PermissionRoute>
        ),
      },
      {
        path: "widgets/:widgetId",
        element: (
          <PermissionRoute anyOf={["widget.catalog:view"]}>
            <LegacyWidgetDetailsRedirect />
          </PermissionRoute>
        ),
      },
      {
        path: "workspace-studio/widget-catalog/:widgetId",
        element: (
          <PermissionRoute anyOf={["widget.catalog:view"]}>
            <WidgetExplorerPage />
          </PermissionRoute>
        ),
      },
      {
        path: "themes",
        element: (
          <PermissionRoute anyOf={["theme:manage"]}>
            <ThemeStudioPage />
          </PermissionRoute>
        ),
      },
      {
        path: "access",
        element: (
          <PermissionRoute anyOf={["org_admin:view"]}>
            <Navigate to="/app/access-rbac/overview" replace />
          </PermissionRoute>
        ),
      },
      {
        path: "admin-panel",
        element: (
          <PermissionRoute anyOf={["org_admin:view"]}>
            <Navigate to="/app/admin/organization-users" replace />
          </PermissionRoute>
        ),
      },
      {
        path: "admin-panel/:surfaceId",
        element: (
          <PermissionRoute anyOf={["org_admin:view"]}>
            <Navigate to="/app/admin/organization-users" replace />
          </PermissionRoute>
        ),
      },
      {
        path: "teams",
        element: (
          <PermissionRoute anyOf={["org_admin:view"]}>
            <Navigate to="/app/access-rbac/teams" replace />
          </PermissionRoute>
        ),
      },
      {
        path: "access-rbac/teams/:teamId",
        element: (
          <PermissionRoute anyOf={["org_admin:view"]}>
            <AccessRbacTeamDetailPage />
          </PermissionRoute>
        ),
      },
      {
        path: "dashboard/:dashboardId",
        element: <LegacyDashboardRedirect />,
      },
      {
        path: "workspace/:workspaceId",
        element: <LegacyWorkspaceRedirect />,
      },
      {
        path: "main_sequence",
        element: <LegacyMainSequenceWorkbenchRedirect />,
      },
      {
        path: "main_sequence/:surfaceId",
        element: <LegacyMainSequenceWorkbenchRedirect />,
      },
      {
        path: "markets",
        element: <LegacyDemoRedirect />,
      },
      {
        path: "markets/:surfaceId",
        element: <LegacyDemoRedirect />,
      },
      {
        path: "main_sequence_markets/asset-categories/:categoryId",
        element: (
          <PermissionRoute anyOf={["main_sequence_markets:view"]}>
            <MainSequenceAssetCategoryDetailPage />
          </PermissionRoute>
        ),
      },
      {
        path: "main_sequence_markets/asset-translation-tables/:tableId",
        element: (
          <PermissionRoute anyOf={["main_sequence_markets:view"]}>
            <MainSequenceAssetTranslationTableDetailPage />
          </PermissionRoute>
        ),
      },
      {
        path: "main_sequence_markets/execution-venues/:venueId",
        element: (
          <PermissionRoute anyOf={["main_sequence_markets:view"]}>
            <MainSequenceExecutionVenueDetailPage />
          </PermissionRoute>
        ),
      },
      {
        path: "main_sequence_markets/portfolio-groups/:groupId",
        element: (
          <PermissionRoute anyOf={["main_sequence_markets:view"]}>
            <MainSequencePortfolioGroupDetailPage />
          </PermissionRoute>
        ),
      },
      {
        path: "chat",
        element: env.includeAui ? <Navigate to={CHAT_PAGE_PATH} replace /> : <Navigate to="/app" replace />,
      },
      {
        path: ":appId",
        element: <AppPage />,
      },
      {
        path: ":appId/:surfaceId",
        element: <AppPage />,
      },
    ],
  },
  {
    path: "/clusters/:clusterId",
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <PermissionRoute anyOf={["main_sequence_foundry:view"]}>
            <MainSequenceClusterDetailPage />
          </PermissionRoute>
        ),
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
