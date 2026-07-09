import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

import type { AppDefinition, AppSurfaceDefinition } from "@/apps/types";

import {
  canAccessApp,
  canAccessShellSurfaceKey,
  canAccessSurface,
  getAccessibleSurfaces,
  resolveShellAccessTarget,
} from "./utils";

const TestIcon: ComponentType<{ className?: string }> = () => null;
const TestPage: ComponentType = () => null;

const alphaSection = {
  id: "alpha",
  label: "Alpha",
};

const betaSection = {
  id: "beta",
  label: "Beta",
};

function createSurface(
  surface: Pick<AppSurfaceDefinition, "id" | "title" | "navigationSection" | "hidden">,
): AppSurfaceDefinition {
  return {
    id: surface.id,
    title: surface.title,
    navLabel: surface.title,
    description: `${surface.title} surface`,
    kind: "page",
    navigationSection: surface.navigationSection,
    hidden: surface.hidden,
    component: TestPage,
  };
}

const sectionedApp: AppDefinition = {
  id: "test_app",
  title: "Test App",
  description: "Sectioned test app",
  source: "test",
  icon: TestIcon,
  shellAccess: {
    scopeMode: "navigation-section",
  },
  defaultSurfaceId: "alpha/home",
  surfaces: [
    createSurface({
      id: "alpha",
      title: "Alpha Home",
      navigationSection: alphaSection,
    }),
    createSurface({
      id: "alpha/detail",
      title: "Alpha Detail",
      navigationSection: alphaSection,
    }),
    createSurface({
      id: "beta/report",
      title: "Beta Report",
      navigationSection: betaSection,
    }),
    createSurface({
      id: "alpha/hidden",
      title: "Hidden Alpha",
      navigationSection: alphaSection,
      hidden: true,
    }),
  ],
};

describe("shell access scope resolution", () => {
  it("resolves sectioned app surfaces into canonical dot-delimited keys", () => {
    expect(resolveShellAccessTarget(sectionedApp, sectionedApp.surfaces[0]!).surfaceKey).toBe(
      "test_app.alpha",
    );
    expect(resolveShellAccessTarget(sectionedApp, sectionedApp.surfaces[1]!).surfaceKey).toBe(
      "test_app.alpha.detail",
    );
    expect(resolveShellAccessTarget(sectionedApp, sectionedApp.surfaces[2]!).surfaceKey).toBe(
      "test_app.beta.report",
    );
  });

  it("allows every surface under a broad app grant", () => {
    const shellAccess = {
      accessibleApps: ["test_app"],
    };

    expect(canAccessApp(sectionedApp, shellAccess)).toBe(true);
    expect(canAccessSurface(sectionedApp, sectionedApp.surfaces[0]!, shellAccess)).toBe(true);
    expect(canAccessSurface(sectionedApp, sectionedApp.surfaces[2]!, shellAccess)).toBe(true);
  });

  it("allows only surfaces under a section grant", () => {
    const shellAccess = {
      accessibleApps: ["test_app.alpha"],
    };

    expect(canAccessApp(sectionedApp, shellAccess)).toBe(true);
    expect(canAccessSurface(sectionedApp, sectionedApp.surfaces[0]!, shellAccess)).toBe(true);
    expect(canAccessSurface(sectionedApp, sectionedApp.surfaces[1]!, shellAccess)).toBe(true);
    expect(canAccessSurface(sectionedApp, sectionedApp.surfaces[2]!, shellAccess)).toBe(false);
    expect(getAccessibleSurfaces(sectionedApp, shellAccess).map((surface) => surface.id)).toEqual([
      "alpha",
      "alpha/detail",
    ]);
  });

  it("keeps hidden surfaces out of navigation but allows direct route checks", () => {
    const shellAccess = {
      accessibleApps: ["test_app.alpha"],
    };
    const hiddenSurface = sectionedApp.surfaces[3]!;

    expect(canAccessSurface(sectionedApp, hiddenSurface, shellAccess)).toBe(false);
    expect(canAccessSurface(sectionedApp, hiddenSurface, shellAccess, {
      includeHidden: true,
    })).toBe(true);
  });

  it("normalizes legacy slash-shaped grants before prefix matching", () => {
    expect(canAccessShellSurfaceKey("settings.access-rbac.teams", {
      accessibleApps: ["settings/access-rbac"],
    })).toBe(true);
  });
});
