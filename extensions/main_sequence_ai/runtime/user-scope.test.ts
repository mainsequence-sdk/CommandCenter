import { describe, expect, it } from "vitest";

import { appendCreatedByUserUidSearchParam } from "./user-scope";

describe("runtime user scope helpers", () => {
  it("uses created_by_user_uid and removes legacy created_by_user", () => {
    expect(
      appendCreatedByUserUidSearchParam(
        "/api/model-providers?created_by_user=4&provider=openai",
        "user-uid-123",
      ),
    ).toBe("/api/model-providers?provider=openai&created_by_user_uid=user-uid-123");
  });

  it("does not add a user scope when no uid is available", () => {
    expect(appendCreatedByUserUidSearchParam("/api/model-providers", null)).toBe(
      "/api/model-providers",
    );
  });
});
