import { describe, expect, it } from "vitest";

import { resolveSessionUserId } from "@/auth/jwt-auth";

describe("resolveSessionUserId", () => {
  it("prefers the token claim user id over user-details ids", () => {
    expect(
      resolveSessionUserId({
        claimUserId: "user-claim-123",
        userDetailsUserId: "42",
        uid: "11111111-1111-4111-8111-111111111111",
        email: "user@example.com",
        name: "User Example",
      }),
    ).toBe("user-claim-123");
  });

  it("falls back to uid when user-details omit a user id", () => {
    expect(
      resolveSessionUserId({
        claimUserId: "",
        userDetailsUserId: "",
        uid: "11111111-1111-4111-8111-111111111111",
        email: "user@example.com",
        name: "User Example",
      }),
    ).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("uses user-details user id only when explicitly mapped and no claim id exists", () => {
    expect(
      resolveSessionUserId({
        claimUserId: "",
        userDetailsUserId: "mapped-user-id",
        uid: "",
        email: "user@example.com",
        name: "User Example",
      }),
    ).toBe("mapped-user-id");
  });
});
