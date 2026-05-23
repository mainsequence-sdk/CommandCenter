import { describe, expect, it } from "vitest";

import {
  ACCESS_CATALOG_VERSION,
  buildAccessCatalogDraft,
  buildAccessCatalogPayload,
} from "./access-catalog-sync";

describe("access catalog sync metadata", () => {
  it("builds a valid generated access catalog", async () => {
    const draft = await buildAccessCatalogDraft();

    expect(draft.validationIssues).toEqual([]);

    const payload = await buildAccessCatalogPayload();

    expect(payload.registryVersion).toBe(ACCESS_CATALOG_VERSION);
    expect(payload.checksum.startsWith("sha256:")).toBe(true);
    expect(payload.apps.length).toBeGreaterThan(0);
    expect(payload.permissions.length).toBeGreaterThan(0);
    expect(payload.surfaces.length).toBeGreaterThan(0);
  });

  it("includes hidden deep-link surfaces from the registry", async () => {
    const payload = await buildAccessCatalogPayload();
    const scalableServiceSurface = payload.surfaces.find(
      (surface) =>
        surface.appUid === "main_sequence_workbench" &&
        surface.surfaceUid === "scalable-services",
    );

    expect(scalableServiceSurface).toMatchObject({
      appUid: "main_sequence_workbench",
      surfaceUid: "scalable-services",
      title: "Scalable Service",
      kind: "page",
      hidden: true,
      routePath: "/app/main_sequence_workbench/scalable-services",
      requiredPermissions: ["main_sequence_foundry:view"],
      appRequiredPermissions: ["main_sequence_foundry:view"],
      effectiveRequiredPermissions: ["main_sequence_foundry:view"],
    });
  });

  it("includes generated permission catalog entries used by surfaces", async () => {
    const payload = await buildAccessCatalogPayload();

    expect(payload.permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "main_sequence_foundry:view",
          label: "Main Sequence Foundry / view",
        }),
        expect.objectContaining({
          id: "workspaces:view",
          label: "Workspaces / view",
        }),
      ]),
    );
  });
});
