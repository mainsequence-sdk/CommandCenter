import { buildSocialLoginStartUrl } from "@/auth/api";

const socialAuthStorageKey = "command-center.social-auth";
const pendingSocialAuthMaxAgeMs = 15 * 60_000;

export interface PendingSocialAuthSession {
  providerId: string;
  state: string;
  codeVerifier: string;
  redirectUri: string;
  redirectTarget: string;
  tokenExchangeUrl: string;
  createdAt: number;
}

export type SocialAuthCallbackPayload =
  | {
      type: "code";
      code: string;
      state: string;
    }
  | {
      type: "mfa_required";
      state: string;
      mfaVerifyUrl: string;
    }
  | {
      type: "mfa_setup_required";
      state: string;
      setupToken: string;
      setupUrl: string;
      setupVerifyUrl: string;
    }
  | {
      type: "error";
      state: string;
      errorCode: string;
      detail: string;
    }
  | {
      type: "waitlisted";
      state: string;
      signupCode: string;
      waitlistStatus: string;
      waitlistEntryId: string;
      email?: string;
      detail: string;
    }
  | {
      type: "invalid";
      detail: string;
    };

function base64UrlEncode(bytes: Uint8Array) {
  let value = "";

  for (const byte of bytes) {
    value += String.fromCharCode(byte);
  }

  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function readBooleanQueryFlag(value: string | null) {
  if (!value) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toPendingSocialAuthSession(value: unknown): PendingSocialAuthSession | null {
  if (!isRecord(value)) {
    return null;
  }

  const providerId = readString(value.providerId);
  const state = readString(value.state);
  const codeVerifier = readString(value.codeVerifier);
  const redirectUri = readString(value.redirectUri);
  const redirectTarget = readString(value.redirectTarget) || "/app";
  const tokenExchangeUrl = readString(value.tokenExchangeUrl) || "/auth/social/token/";
  const createdAt =
    typeof value.createdAt === "number" && Number.isFinite(value.createdAt)
      ? value.createdAt
      : Number.NaN;

  if (!providerId || !state || !codeVerifier || !redirectUri || !Number.isFinite(createdAt)) {
    return null;
  }

  return {
    providerId,
    state,
    codeVerifier,
    redirectUri,
    redirectTarget,
    tokenExchangeUrl,
    createdAt,
  };
}

function randomBase64Url(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function buildPkceCodeChallenge(codeVerifier: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier),
  );
  return base64UrlEncode(new Uint8Array(digest));
}

export function buildSocialAuthCallbackUrl() {
  if (typeof window === "undefined") {
    return "http://localhost/auth/callback";
  }

  return new URL("/auth/callback", window.location.origin).toString();
}

export function storePendingSocialAuthSession(pending: PendingSocialAuthSession) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(socialAuthStorageKey, JSON.stringify(pending));
}

export function clearPendingSocialAuthSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(socialAuthStorageKey);
}

export function readPendingSocialAuthSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(socialAuthStorageKey);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    const pending = toPendingSocialAuthSession(parsed);

    if (!pending) {
      clearPendingSocialAuthSession();
      return null;
    }

    if (Date.now() - pending.createdAt > pendingSocialAuthMaxAgeMs) {
      clearPendingSocialAuthSession();
      return null;
    }

    return pending;
  } catch {
    clearPendingSocialAuthSession();
    return null;
  }
}

export async function createSocialAuthStartRequest(input: {
  providerId: string;
  providerStartUrl: string;
  redirectTarget: string;
  tokenExchangeUrl?: string;
}) {
  const redirectUri = buildSocialAuthCallbackUrl();
  const state = randomBase64Url(24);
  const codeVerifier = randomBase64Url(48);
  const codeChallenge = await buildPkceCodeChallenge(codeVerifier);
  const pending: PendingSocialAuthSession = {
    providerId: input.providerId.trim(),
    state,
    codeVerifier,
    redirectUri,
    redirectTarget: input.redirectTarget || "/app",
    tokenExchangeUrl: input.tokenExchangeUrl?.trim() || "/auth/social/token/",
    createdAt: Date.now(),
  };

  storePendingSocialAuthSession(pending);

  return {
    pending,
    startUrl: buildSocialLoginStartUrl(input.providerStartUrl, {
      redirectUri: pending.redirectUri,
      state: pending.state,
      codeChallenge,
    }),
  };
}

export function parseSocialAuthCallback(searchParams: URLSearchParams): SocialAuthCallbackPayload {
  const state = readString(searchParams.get("state"));

  const error = readString(searchParams.get("error"));
  if (error) {
    const errorCode = readString(searchParams.get("error_code")) || error;
    return {
      type: "error",
      state,
      errorCode,
      detail: `Social sign-in failed: ${errorCode}.`,
    };
  }

  const signupStatus = readString(searchParams.get("signup_status"));
  if (signupStatus === "waitlisted") {
    const signupCode = readString(searchParams.get("signup_code"));
    const waitlistStatus = readString(searchParams.get("waitlist_status"));
    const waitlistEntryId = readString(searchParams.get("waitlist_entry_id"));
    const email = readString(searchParams.get("email"));
    const detail = readString(searchParams.get("message"));

    if (!state || !detail) {
      return {
        type: "invalid",
        detail: "Social signup waitlist callback was missing required fields.",
      };
    }

    return {
      type: "waitlisted",
      state,
      signupCode: signupCode || "signup_waitlisted",
      waitlistStatus: waitlistStatus || "waiting",
      waitlistEntryId,
      email: email || undefined,
      detail,
    };
  }

  const code = readString(searchParams.get("code"));
  if (code) {
    if (!state) {
      return {
        type: "invalid",
        detail: "Social sign-in returned a code without the required state value.",
      };
    }

    return {
      type: "code",
      code,
      state,
    };
  }

  if (readBooleanQueryFlag(searchParams.get("mfa_required"))) {
    const mfaVerifyUrl = readString(searchParams.get("mfa_verify_url"));

    if (!state || !mfaVerifyUrl) {
      return {
        type: "invalid",
        detail: "Social sign-in returned an incomplete MFA verification callback.",
      };
    }

    return {
      type: "mfa_required",
      state,
      mfaVerifyUrl,
    };
  }

  if (readBooleanQueryFlag(searchParams.get("mfa_setup_required"))) {
    const setupToken = readString(searchParams.get("setup_token"));
    const setupUrl = readString(searchParams.get("setup_url"));
    const setupVerifyUrl = readString(searchParams.get("setup_verify_url"));

    if (!state || !setupToken || !setupUrl || !setupVerifyUrl) {
      return {
        type: "invalid",
        detail: "Social sign-in returned an incomplete MFA setup callback.",
      };
    }

    return {
      type: "mfa_setup_required",
      state,
      setupToken,
      setupUrl,
      setupVerifyUrl,
    };
  }

  return {
    type: "invalid",
    detail: "Social sign-in did not return a recognized callback payload.",
  };
}
