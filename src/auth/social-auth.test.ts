/** @vitest-environment jsdom */
/** @vitest-environment-options {"url":"http://localhost:5173/login"} */

import { afterEach, describe, expect, it } from "vitest";

import {
  clearPendingSocialAuthSession,
  createSocialAuthStartRequest,
  parseSocialAuthCallback,
  readPendingSocialAuthSession,
  storePendingSocialAuthSession,
} from "@/auth/social-auth";

afterEach(() => {
  clearPendingSocialAuthSession();
});

describe("social auth pending session", () => {
  it("stores and restores pending social auth state", () => {
    storePendingSocialAuthSession({
      providerId: "google",
      state: "state-123",
      codeVerifier: "verifier-123",
      redirectUri: "http://localhost:5173/auth/callback",
      redirectTarget: "/app/connections/explore",
      createdAt: Date.now(),
    });

    expect(readPendingSocialAuthSession()).toEqual({
      providerId: "google",
      state: "state-123",
      codeVerifier: "verifier-123",
      redirectUri: "http://localhost:5173/auth/callback",
      redirectTarget: "/app/connections/explore",
      createdAt: expect.any(Number),
    });
  });

  it("drops stale pending social auth state", () => {
    storePendingSocialAuthSession({
      providerId: "github",
      state: "stale-state",
      codeVerifier: "stale-verifier",
      redirectUri: "http://localhost:5173/auth/callback",
      redirectTarget: "/app",
      createdAt: Date.now() - 16 * 60_000,
    });

    expect(readPendingSocialAuthSession()).toBeNull();
  });

  it("creates a PKCE start request and persists its pending state", async () => {
    const result = await createSocialAuthStartRequest({
      providerId: "google",
      providerStartUrl: "http://127.0.0.1:8000/auth/social/google/start/",
      redirectTarget: "/app/access-rbac/overview",
    });

    const startUrl = new URL(result.startUrl);
    expect(startUrl.pathname).toMatch(/\/__command_center_auth__\/auth\/social\/google\/start\/$/);
    expect(startUrl.searchParams.get("redirect_uri")).toBe(
      "http://localhost:5173/auth/callback",
    );
    expect(startUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(startUrl.searchParams.get("state")).toBe(result.pending.state);
    expect(startUrl.searchParams.get("code_challenge")).toBeTruthy();
    expect(readPendingSocialAuthSession()).toEqual(result.pending);
  });
});

describe("social auth callback parsing", () => {
  it("parses a successful code callback", () => {
    expect(
      parseSocialAuthCallback(new URLSearchParams("?code=abc123&state=state-social")),
    ).toEqual({
      type: "code",
      code: "abc123",
      state: "state-social",
    });
  });

  it("parses an MFA verify callback", () => {
    expect(
      parseSocialAuthCallback(
        new URLSearchParams(
          "?mfa_required=true&mfa_verify_url=http://localhost:8000/auth/browser/mfa/verify/&state=mfa-state",
        ),
      ),
    ).toEqual({
      type: "mfa_required",
      state: "mfa-state",
      mfaVerifyUrl: "http://localhost:8000/auth/browser/mfa/verify/",
    });
  });

  it("parses an MFA setup callback", () => {
    expect(
      parseSocialAuthCallback(
        new URLSearchParams(
          "?mfa_setup_required=true&setup_token=token-123&setup_url=http://localhost:8000/user/api/user/mfa/setup/?setup_token=token-123&setup_verify_url=http://localhost:8000/user/api/user/mfa/setup/verify/&state=setup-state",
        ),
      ),
    ).toEqual({
      type: "mfa_setup_required",
      state: "setup-state",
      setupToken: "token-123",
      setupUrl: "http://localhost:8000/user/api/user/mfa/setup/?setup_token=token-123",
      setupVerifyUrl: "http://localhost:8000/user/api/user/mfa/setup/verify/",
    });
  });

  it("parses a provider error callback", () => {
    expect(
      parseSocialAuthCallback(
        new URLSearchParams(
          "?error=social_auth_failed&error_code=access_denied&state=error-state",
        ),
      ),
    ).toEqual({
      type: "error",
      state: "error-state",
      errorCode: "access_denied",
      detail: "Social sign-in failed: access_denied.",
    });
  });
});
