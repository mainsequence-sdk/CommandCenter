/** @vitest-environment jsdom */
/** @vitest-environment-options {"url":"http://localhost:5173/login"} */

import { afterEach, describe, expect, it, vi } from "vitest";

import { listSocialLoginProviders } from "@/auth/api";
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
      tokenExchangeUrl: "http://localhost:8000/auth/social/token/",
      createdAt: Date.now(),
    });

    expect(readPendingSocialAuthSession()).toEqual({
      providerId: "google",
      state: "state-123",
      codeVerifier: "verifier-123",
      redirectUri: "http://localhost:5173/auth/callback",
      redirectTarget: "/app/connections/explore",
      tokenExchangeUrl: "http://localhost:8000/auth/social/token/",
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
      tokenExchangeUrl: "http://localhost:8000/auth/social/token/",
      createdAt: Date.now() - 16 * 60_000,
    });

    expect(readPendingSocialAuthSession()).toBeNull();
  });

  it("creates a PKCE start request and persists its pending state", async () => {
    const result = await createSocialAuthStartRequest({
      providerId: "google",
      providerStartUrl: "http://127.0.0.1:8000/auth/social/google/start/",
      redirectTarget: "/app/settings/access-rbac/inspector",
      tokenExchangeUrl: "http://127.0.0.1:8000/auth/social/token/",
    });

    const startUrl = new URL(result.startUrl);
    expect(startUrl.pathname).toMatch(/\/__command_center_auth__\/auth\/social\/google\/start\/$/);
    expect(startUrl.searchParams.get("redirect_uri")).toBe(
      "http://localhost:5173/auth/callback",
    );
    expect(startUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(startUrl.searchParams.get("state")).toBe(result.pending.state);
    expect(startUrl.searchParams.get("code_challenge")).toBeTruthy();
    expect(result.pending.tokenExchangeUrl).toBe("http://127.0.0.1:8000/auth/social/token/");
    expect(readPendingSocialAuthSession()).toEqual(result.pending);
  });
});

describe("social auth provider discovery", () => {
  const fetchMock = vi.fn<typeof fetch>();

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("uses backend action URLs from the provider discovery workflow", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          providers: ["github"],
          provider_details: [
            {
              id: "github",
              name: "GitHub",
              start_url: "http://localhost:8000/legacy/start/",
              oauth_callback_url: "http://localhost:8000/auth/social/github/callback/",
              start_action: {
                method: "GET",
                url: "http://localhost:8000/auth/social/github/start/",
                query_parameters: [
                  { name: "redirect_uri", required: true, source: "frontend_callback_url" },
                  { name: "state", required: true, source: "frontend_generated_state" },
                  { name: "code_challenge", required: true, source: "frontend_generated_pkce_challenge" },
                  { name: "code_challenge_method", required: true, source: "constant" },
                ],
              },
            },
          ],
          flow: {
            type: "oauth2_authorization_code_pkce",
            token_exchange_action: {
              method: "POST",
              url: "http://localhost:8000/auth/social/token/",
              content_type: "application/json",
            },
            legacy_allauth: {
              allowed_for_frontend_social_login: false,
              avoid_url_prefix: "/user/allauth/",
            },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(listSocialLoginProviders()).resolves.toEqual([
      {
        id: "github",
        name: "GitHub",
        startUrl: "http://localhost:8000/auth/social/github/start/",
        oauthCallbackUrl: "http://localhost:8000/auth/social/github/callback/",
        startAction: {
          method: "GET",
          url: "http://localhost:8000/auth/social/github/start/",
          query_parameters: [
            { name: "redirect_uri", required: true, source: "frontend_callback_url" },
            { name: "state", required: true, source: "frontend_generated_state" },
            { name: "code_challenge", required: true, source: "frontend_generated_pkce_challenge" },
            { name: "code_challenge_method", required: true, source: "constant" },
          ],
        },
        tokenExchangeUrl: "http://localhost:8000/auth/social/token/",
      },
    ]);
  });
});

describe("social auth callback parsing", () => {
  it("prioritizes waitlist callbacks over provider error fields", () => {
    expect(
      parseSocialAuthCallback(
        new URLSearchParams(
          "?signup_status=waitlisted&signup_code=signup_waitlisted&waitlist_status=waiting&waitlist_entry_id=42&email=user@example.com&message=Thank%20you&error=social_auth_failed&error_code=unknown&state=waitlist-state",
        ),
      ),
    ).toEqual({
      type: "waitlisted",
      state: "waitlist-state",
      signupCode: "signup_waitlisted",
      waitlistStatus: "waiting",
      waitlistEntryId: "42",
      email: "user@example.com",
      detail: "Thank you",
    });
  });

  it("hides synthetic provider emails from waitlist callbacks", () => {
    expect(
      parseSocialAuthCallback(
        new URLSearchParams(
          "?signup_status=waitlisted&signup_code=signup_waitlisted&waitlist_status=waiting&waitlist_entry_id=42&email=github_123%40no-email.main-sequence.io&message=Thank%20you&state=waitlist-state",
        ),
      ),
    ).toEqual({
      type: "waitlisted",
      state: "waitlist-state",
      signupCode: "signup_waitlisted",
      waitlistStatus: "waiting",
      waitlistEntryId: "42",
      email: undefined,
      detail: "Thank you",
    });
  });

  it("prioritizes MFA callbacks over provider error fields", () => {
    expect(
      parseSocialAuthCallback(
        new URLSearchParams(
          "?mfa_required=true&mfa_verify_url=http://localhost:8000/auth/browser/mfa/verify/&error=social_auth_failed&error_code=unknown&state=mfa-state",
        ),
      ),
    ).toEqual({
      type: "mfa_required",
      state: "mfa-state",
      mfaVerifyUrl: "http://localhost:8000/auth/browser/mfa/verify/",
    });
  });

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
      error: "social_auth_failed",
      errorCode: "access_denied",
      errorDescription: undefined,
      detail: "Social sign-in failed: access_denied (social_auth_failed).",
    });
  });

  it("includes provider error detail when the callback provides it", () => {
    expect(
      parseSocialAuthCallback(
        new URLSearchParams(
          "?error=social_auth_failed&error_code=unknown&error_description=Provider%20rejected%20the%20request&state=error-state",
        ),
      ),
    ).toEqual({
      type: "error",
      state: "error-state",
      error: "social_auth_failed",
      errorCode: "unknown",
      errorDescription: "Provider rejected the request",
      detail: "Social sign-in failed: unknown (social_auth_failed). Provider rejected the request",
    });
  });

  it("parses a waitlist callback", () => {
    expect(
      parseSocialAuthCallback(
        new URLSearchParams(
          "?signup_status=waitlisted&signup_code=signup_waitlisted&waitlist_status=waiting&waitlist_entry_id=42&email=user@example.com&message=Thank%20you...&state=waitlist-state",
        ),
      ),
    ).toEqual({
      type: "waitlisted",
      state: "waitlist-state",
      signupCode: "signup_waitlisted",
      waitlistStatus: "waiting",
      waitlistEntryId: "42",
      email: "user@example.com",
      detail: "Thank you...",
    });
  });
});
