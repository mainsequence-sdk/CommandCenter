import { describe, expect, it } from "vitest";

import {
  ALL_PERMISSIONS,
  CORE_PERMISSION_DEFINITIONS,
  ROLE_PERMISSIONS,
  filterDeprecatedPermissions,
  getPermissionsForRole,
} from "./permissions";

const removedNewsPermission = "news:read";

describe("permissions", () => {
  it("keeps removed news permissions out of active RBAC grants", () => {
    expect(CORE_PERMISSION_DEFINITIONS.map((definition) => definition.id)).not.toContain(
      removedNewsPermission,
    );
    expect(ALL_PERMISSIONS).not.toContain(removedNewsPermission);

    Object.values(ROLE_PERMISSIONS).forEach((permissions) => {
      expect(permissions).not.toContain(removedNewsPermission);
    });
    expect(getPermissionsForRole("user")).not.toContain(removedNewsPermission);
    expect(filterDeprecatedPermissions(["workspaces:view", removedNewsPermission])).toEqual([
      "workspaces:view",
    ]);
  });
});
