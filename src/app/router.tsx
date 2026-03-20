import { Navigate, createBrowserRouter } from "react-router-dom";

import { PermissionRoute } from "@/app/guards/PermissionRoute";
import { ProtectedRoute } from "@/app/guards/ProtectedRoute";
import { AppShell } from "@/app/layout/AppShell";
import { AccessPage } from "@/features/access/AccessPage";
import { AppPage } from "@/features/apps/AppPage";
import { AppRedirect } from "@/features/apps/AppRedirect";
import { LegacyDashboardRedirect } from "@/features/apps/LegacyDashboardRedirect";
import { LegacyWorkspaceRedirect } from "@/features/apps/LegacyWorkspaceRedirect";
import { LoginPage } from "@/features/auth/LoginPage";
import { LoginPageV2 } from "@/features/auth/LoginPageV2";
import { ExtensionsGalleryPage } from "@/features/extensions/ExtensionsGalleryPage";
import { NotFoundPage } from "@/features/misc/NotFoundPage";
import { TeamsPage } from "@/features/teams/TeamsPage";
import { ThemeStudioPage } from "@/features/themes/ThemeStudioPage";
import { WidgetCatalogPage } from "@/features/widgets/WidgetCatalogPage";

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
            <AccessPage />
          </PermissionRoute>
        ),
      },
      {
        path: "teams",
        element: <TeamsPage />,
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
    path: "*",
    element: <NotFoundPage />,
  },
]);
