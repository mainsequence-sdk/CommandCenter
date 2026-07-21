import { describe, expect, it } from "vitest";

import {
  mergePermissionEntityIds,
  normalizePermissionEntityId,
  resolvePermissionEntityId,
} from "./permissionEntityId";

describe("permission entity ids", () => {
  it("normalizes scalar ids without calling string methods on missing values", () => {
    expect(normalizePermissionEntityId(42)).toBe(42);
    expect(normalizePermissionEntityId(" 42 ")).toBe(42);
    expect(normalizePermissionEntityId(" user-public-uid ")).toBe("user-public-uid");
    expect(normalizePermissionEntityId(undefined)).toBeNull();
    expect(normalizePermissionEntityId(null)).toBeNull();
    expect(normalizePermissionEntityId("   ")).toBeNull();
  });

  it("accepts uid-shaped principal records when the legacy id field is absent", () => {
    expect(resolvePermissionEntityId({ uid: " user-public-uid " })).toBe("user-public-uid");
    expect(resolvePermissionEntityId({ user_uid: "user-2" })).toBe("user-2");
    expect(resolvePermissionEntityId({ teamUid: "team-3" })).toBe("team-3");
    expect(resolvePermissionEntityId({ id: undefined })).toBeNull();
  });

  it("drops unusable ids and de-duplicates equivalent numeric values", () => {
    expect(
      mergePermissionEntityIds(
        [undefined, null, "", " 7 ", "user-public-uid"],
        [7, { uid: "user-public-uid" }, { id: "team-public-uid" }],
      ),
    ).toEqual([7, "user-public-uid", "team-public-uid"]);
  });
});
