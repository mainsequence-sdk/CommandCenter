import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  resolveSessionUserId,
  restoreStoredJwtSession,
} from "@/auth/jwt-auth";
import { commandCenterConfig } from "@/config/command-center";

const authStorageKey = "command-center.jwt-auth";

function encodeJwtSegment(value: Record<string, unknown>) {
  return globalThis
    .btoa(JSON.stringify(value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function createJwt(payload: Record<string, unknown>) {
  return `${encodeJwtSegment({ alg: "none", typ: "JWT" })}.${encodeJwtSegment(payload)}.signature`;
}

function installLocalStorageMock() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage },
  });

  return localStorage;
}

describe("resolveSessionUserId", () => {
  const previousWindow = globalThis.window;

  beforeEach(() => {
    installLocalStorageMock();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
  });

  it("maps the JWT user id claim to user_uid", () => {
    expect(commandCenterConfig.auth.jwt.claimMapping.userId).toBe("user_uid");
  });

  it("restores session identity from the JWT user_uid claim", () => {
    const userUid = "00000000-0000-4000-8000-000000000004";
    const accessToken = createJwt({
      sub: "4",
      user_uid: userUid,
      email: "user@example.com",
      name: "User Example",
      role: "user",
    });

    window.localStorage.setItem(
      authStorageKey,
      JSON.stringify({
        tokens: {
          accessToken,
          refreshToken: null,
          tokenType: "Bearer",
          authMode: "jwt",
        },
      }),
    );

    const restoredSession = restoreStoredJwtSession();

    expect(restoredSession?.session.user.uid).toBe(userUid);
    expect(restoredSession?.session.user.id).toBe(userUid);
  });

  it("prefers uid over the token claim user id", () => {
    expect(
      resolveSessionUserId({
        claimUserId: "user-claim-123",
        userDetailsUserId: "42",
        uid: "11111111-1111-4111-8111-111111111111",
        email: "user@example.com",
        name: "User Example",
      }),
    ).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("does not fall back to the token claim when uid is missing", () => {
    expect(
      resolveSessionUserId({
        claimUserId: "4",
        userDetailsUserId: "",
        uid: "",
        email: "user@example.com",
        name: "User Example",
      }),
    ).toBe("user@example.com");
  });

  it("does not use user-details user id when uid is missing", () => {
    expect(
      resolveSessionUserId({
        claimUserId: "",
        userDetailsUserId: "mapped-user-id",
        uid: "",
        email: "user@example.com",
        name: "User Example",
      }),
    ).toBe("user@example.com");
  });
});
