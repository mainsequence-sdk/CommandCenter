import { Navigate, createBrowserRouter } from "react-router-dom";

import { PermissionRoute } from "@/app/guards/PermissionRoute";
import { ProtectedRoute } from "@/app/guards/ProtectedRoute";
import { AppShell } from "@/app/layout/AppShell";
import { AppPage } from "@/features/apps/AppPage";
import { AppRedirect } from "@/features/apps/AppRedirect";
import { LegacyDashboardRedirect } from "@/features/apps/LegacyDashboardRedirect";
import { LegacyDemoRedirect } from "@/features/apps/LegacyDemoRedirect";
import { LegacyMainSequenceWorkbenchRedirect } from "@/features/apps/LegacyMainSequenceWorkbenchRedirect";
import { LegacyWorkspaceRedirect } from "@/features/apps/LegacyWorkspaceRedirect";
import { LoginPage } from "@/features/auth/LoginPage";
import { LoginPageV2 } from "@/features/auth/LoginPageV2";
import { ExtensionsGalleryPage } from "@/features/extensions/ExtensionsGalleryPage";
import { NotFoundPage } from "@/features/misc/NotFoundPage";
import { ThemeStudioPage } from "@/features/themes/ThemeStudioPage";
import { WidgetCatalogPage } from "@/features/widgets/WidgetCatalogPage";
import { MainSequenceAssetCategoryDetailPage } from "../../extensions/main_sequence/extensions/markets/features/asset-categories/MainSequenceAssetCategoryDetailPage";
import { MainSequenceAssetTranslationTableDetailPage } from "../../extensions/main_sequence/extensions/markets/features/asset-translation-tables/MainSequenceAssetTranslationTableDetailPage";
import { MainSequenceExecutionVenueDetailPage } from "../../extensions/main_sequence/extensions/markets/features/execution-venues/MainSequenceExecutionVenueDetailPage";
import { MainSequenceClusterDetailPage } from "../../extensions/main_sequence/extensions/workbench/features/clusters/MainSequenceClusterDetailPage";

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
            <WidgetCatalogPage />
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
          <PermissionRoute anyOf={["rbac:view"]}>
            <Navigate to="/app/access-rbac/overview" replace />
          </PermissionRoute>
        ),
      },
      {
        path: "admin-panel",
        element: (
          <PermissionRoute anyOf={["rbac:view"]}>
            <Navigate to="/app/admin/event-stream" replace />
          </PermissionRoute>
        ),
      },
      {
        path: "admin-panel/:surfaceId",
        element: (
          <PermissionRoute anyOf={["rbac:view"]}>
            <Navigate to="/app/admin/event-stream" replace />
          </PermissionRoute>
        ),
      },
      {
        path: "teams",
        element: (
          <PermissionRoute anyOf={["rbac:view"]}>
            <Navigate to="/app/access-rbac/teams" replace />
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
          <PermissionRoute anyOf={["marketdata:read"]}>
            <MainSequenceAssetCategoryDetailPage />
          </PermissionRoute>
        ),
      },
      {
        path: "main_sequence_markets/asset-translation-tables/:tableId",
        element: (
          <PermissionRoute anyOf={["marketdata:read"]}>
            <MainSequenceAssetTranslationTableDetailPage />
          </PermissionRoute>
        ),
      },
      {
        path: "main_sequence_markets/execution-venues/:venueId",
        element: (
          <PermissionRoute anyOf={["marketdata:read"]}>
            <MainSequenceExecutionVenueDetailPage />
          </PermissionRoute>
        ),
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
          <PermissionRoute anyOf={["main_sequence.operations:view"]}>
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
