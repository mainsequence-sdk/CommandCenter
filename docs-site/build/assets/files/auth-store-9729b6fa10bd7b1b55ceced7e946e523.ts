import { create } from "zustand";

import {
  clearStoredJwtSession,
  verifyJwtMfaSetup,
  loginWithJwt,
  logoutJwtSession,
  persistJwtSession,
  refreshJwtSession,
  resolveStoredJwtSession,
  restoreStoredJwtSession,
  type StoredJwtTokens,
} from "@/auth/jwt-auth";
import { hasAllPermissions } from "@/auth/permissions";
import { loginWithRole } from "@/auth/mock-auth";
import type { AuthLoginChallenge, AuthMode, CompleteMfaSetupInput, LoginInput, Session } from "@/auth/types";
import { env } from "@/config/env";

const restoredJwtSession = env.bypassAuth ? null : restoreStoredJwtSession();
const restoredAuthMode = restoredJwtSession?.tokens.authMode ?? "jwt";
const shouldResolveRestoredSessionBeforeAuth = restoredAuthMode === "runtime_credential";

let refreshTimer: number | null = null;
let loginPromise: Promise<boolean> | null = null;
let refreshPromise: Promise<boolean> | null = null;
let mfaSetupPromise: Promise<boolean> | null = null;

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.trim() : "";
}

function isSessionExpiryError(error: unknown) {
  const message = readErrorMessage(error).toLowerCase();

  return (
    message.includes("token is expired") ||
    message.includes("token has expired") ||
    message.includes("expired token") ||
    message.includes("token not valid") ||
    message.includes("jwt access token is malformed") ||
    message.includes("jwt access token payload is invalid")
  );
}

function getLoginErrorMessage(error: unknown) {
  if (isSessionExpiryError(error)) {
    return "Your session expired. Please sign in again.";
  }

  return error instanceof Error && error.message
    ? error.message
    : "Unable to sign in with the provided credentials.";
}

function clearRefreshTimer() {
  if (refreshTimer) {
    window.clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function scheduleRefresh(tokens: StoredJwtTokens) {
  clearRefreshTimer();

  if (env.bypassAuth || !tokens.refreshToken || !tokens.expiresAt) {
    return;
  }

  const delay = Math.max(tokens.expiresAt - Date.now() - 60_000, 0);
  refreshTimer = window.setTimeout(() => {
    void useAuthStore.getState().refreshSession();
  }, delay);
}

interface AuthState {
  session: Session | null;
  refreshToken: string | null;
  authMode: AuthMode;
  status: "anonymous" | "resolving" | "authenticating" | "authenticated";
  error: string | null;
  challenge: AuthLoginChallenge | null;
  login: (input: LoginInput) => Promise<boolean>;
  completeMfaSetup: (input: CompleteMfaSetupInput) => Promise<boolean>;
  refreshSession: () => Promise<boolean>;
  logout: () => void;
  resetLoginState: () => void;
  can: (permission: string | string[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: shouldResolveRestoredSessionBeforeAuth ? null : restoredJwtSession?.session ?? null,
  refreshToken: shouldResolveRestoredSessionBeforeAuth
    ? null
    : restoredJwtSession?.tokens.refreshToken ?? null,
  authMode: restoredAuthMode,
  status: restoredJwtSession
    ? shouldResolveRestoredSessionBeforeAuth
      ? "resolving"
      : "authenticated"
    : "anonymous",
  error: null,
  challenge: null,
  async login(input) {
    if (loginPromise) {
      return loginPromise;
    }

    const previousChallenge = get().challenge;
    set({ status: "authenticating", error: null });

    loginPromise = (async () => {
      try {
        if (env.bypassAuth) {
          clearStoredJwtSession();
          clearRefreshTimer();
          const session = await loginWithRole(input);
          set({
            session,
            refreshToken: null,
            authMode: "jwt",
            status: "authenticated",
            error: null,
            challenge: null,
          });
          return true;
        }

        const result = await loginWithJwt(input);

        if (result.status === "authenticated") {
          persistJwtSession(result.bundle);
          const { session, tokens } = result.bundle;
          scheduleRefresh(tokens);
          set({
            session,
            refreshToken: tokens.refreshToken,
            authMode: tokens.authMode ?? "jwt",
            status: "authenticated",
            error: null,
            challenge: null,
          });
          return true;
        }

        clearStoredJwtSession();
        clearRefreshTimer();
        set({
          session: null,
          refreshToken: null,
          authMode: "jwt",
          status: "anonymous",
          error: null,
          challenge: result.challenge,
        });
        return false;
      } catch (error) {
        clearStoredJwtSession();
        clearRefreshTimer();
        set({
          error: getLoginErrorMessage(error),
          session: null,
          refreshToken: null,
          authMode: "jwt",
          status: "anonymous",
          challenge: previousChallenge,
        });
        return false;
      } finally {
        loginPromise = null;
      }
    })();

    return loginPromise;
  },
  async completeMfaSetup(input) {
    if (mfaSetupPromise) {
      return mfaSetupPromise;
    }

    const previousChallenge = get().challenge;
    set({ status: "authenticating", error: null });

    mfaSetupPromise = (async () => {
      try {
        const bundle = await verifyJwtMfaSetup(input);
        persistJwtSession(bundle);
        const { session, tokens } = bundle;
        scheduleRefresh(tokens);
        set({
          session,
          refreshToken: tokens.refreshToken,
          authMode: tokens.authMode ?? "jwt",
          status: "authenticated",
          error: null,
          challenge: null,
        });
        return true;
      } catch (error) {
        clearStoredJwtSession();
        clearRefreshTimer();
        set({
          session: null,
          refreshToken: null,
          authMode: "jwt",
          status: "anonymous",
          error: getLoginErrorMessage(error),
          challenge: previousChallenge,
        });
        return false;
      } finally {
        mfaSetupPromise = null;
      }
    })();

    return mfaSetupPromise;
  },
  async refreshSession() {
    if (env.bypassAuth) {
      return false;
    }

    if (refreshPromise) {
      return refreshPromise;
    }

    const refreshToken = get().refreshToken;

    if (get().authMode === "runtime_credential" || !refreshToken) {
      return false;
    }

    refreshPromise = (async () => {
      try {
        const bundle = await refreshJwtSession(refreshToken, get().session?.user);
        persistJwtSession(bundle);
        const { session, tokens } = bundle;
        scheduleRefresh(tokens);
        set({
          session,
          refreshToken: tokens.refreshToken,
          authMode: tokens.authMode ?? "jwt",
          status: "authenticated",
          error: null,
          challenge: null,
        });
        return true;
      } catch (error) {
        clearStoredJwtSession();
        clearRefreshTimer();
        set({
          session: null,
          refreshToken: null,
          authMode: "jwt",
          status: "anonymous",
          error: "Your session expired. Please sign in again.",
          challenge: null,
        });
        return false;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },
  logout() {
    const activeToken = get().session?.token;
    const tokenType = get().session?.tokenType || "Bearer";
    const authMode = get().authMode;

    if (!env.bypassAuth && activeToken && authMode !== "runtime_credential") {
      void logoutJwtSession(activeToken, tokenType).catch(() => {
        // Local sign-out remains immediate even if backend logout fails.
      });
    }

    clearStoredJwtSession();
    clearRefreshTimer();
    set({
      session: null,
      refreshToken: null,
      authMode: "jwt",
      status: "anonymous",
      error: null,
      challenge: null,
    });
  },
  resetLoginState() {
    set({ error: null, challenge: null });
  },
  can(permission) {
    const current = get().session?.user.permissions ?? [];
    const required = Array.isArray(permission) ? permission : [permission];

    return hasAllPermissions(current, required);
  },
}));

if (restoredJwtSession) {
  scheduleRefresh(restoredJwtSession.tokens);

  if (!restoredJwtSession.refreshNow && !shouldResolveRestoredSessionBeforeAuth) {
    useAuthStore.setState({
      session: restoredJwtSession.session,
      refreshToken: restoredJwtSession.tokens.refreshToken,
      authMode: restoredJwtSession.tokens.authMode ?? "jwt",
      status: "authenticated",
      error: null,
    });

    void (async () => {
      try {
        const bundle = await resolveStoredJwtSession(restoredJwtSession);
        persistJwtSession(bundle);
        scheduleRefresh(bundle.tokens);
        useAuthStore.setState({
          session: bundle.session,
          refreshToken: bundle.tokens.refreshToken,
          authMode: bundle.tokens.authMode ?? "jwt",
          status: "authenticated",
          error: null,
        });
      } catch {
        // Keep the restored session if background shell-access rehydration fails.
      }
    })();
  } else {
    void (async () => {
      try {
        const bundle = await resolveStoredJwtSession(restoredJwtSession);
        persistJwtSession(bundle);
        scheduleRefresh(bundle.tokens);
        useAuthStore.setState({
          session: bundle.session,
          refreshToken: bundle.tokens.refreshToken,
          authMode: bundle.tokens.authMode ?? "jwt",
          status: "authenticated",
          error: null,
        });
      } catch (error) {
        clearStoredJwtSession();
        clearRefreshTimer();
        useAuthStore.setState({
          session: null,
          refreshToken: null,
          authMode: "jwt",
          status: "anonymous",
          error: isSessionExpiryError(error)
            ? null
            : "Unable to restore the user session.",
        });
      }
    })();
  }
}
