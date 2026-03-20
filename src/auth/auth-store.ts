import { create } from "zustand";

import {
  clearStoredJwtSession,
  loginWithJwt,
  persistJwtSession,
  refreshJwtSession,
  resolveStoredJwtSession,
  restoreStoredJwtSession,
  type StoredJwtTokens,
} from "@/auth/jwt-auth";
import { hasAllPermissions } from "@/auth/permissions";
import { loginWithRole } from "@/auth/mock-auth";
import type { LoginInput, Session } from "@/auth/types";
import { env } from "@/config/env";

const restoredJwtSession = env.bypassAuth ? null : restoreStoredJwtSession();

let refreshTimer: number | null = null;
let loginPromise: Promise<boolean> | null = null;
let refreshPromise: Promise<boolean> | null = null;

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
  status: "anonymous" | "resolving" | "authenticating" | "authenticated";
  error: string | null;
  login: (input: LoginInput) => Promise<boolean>;
  refreshSession: () => Promise<boolean>;
  logout: () => void;
  can: (permission: string | string[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: restoredJwtSession?.session ?? null,
  refreshToken: restoredJwtSession?.tokens.refreshToken ?? null,
  status: restoredJwtSession ? "authenticated" : "anonymous",
  error: null,
  async login(input) {
    if (loginPromise) {
      return loginPromise;
    }

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
            status: "authenticated",
            error: null,
          });
          return true;
        }

        const bundle = await loginWithJwt(input);
        persistJwtSession(bundle);
        const { session, tokens } = bundle;
        scheduleRefresh(tokens);
        set({
          session,
          refreshToken: tokens.refreshToken,
          status: "authenticated",
          error: null,
        });
        return true;
      } catch (error) {
        set({
          error:
            error instanceof Error
              ? error.message
              : "Unable to sign in with the provided credentials.",
          session: null,
          refreshToken: null,
          status: "anonymous",
        });
        clearStoredJwtSession();
        clearRefreshTimer();
        return false;
      } finally {
        loginPromise = null;
      }
    })();

    return loginPromise;
  },
  async refreshSession() {
    if (env.bypassAuth) {
      return false;
    }

    if (refreshPromise) {
      return refreshPromise;
    }

    const refreshToken = get().refreshToken;

    if (!refreshToken) {
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
          status: "authenticated",
          error: null,
        });
        return true;
      } catch (error) {
        clearStoredJwtSession();
        clearRefreshTimer();
        set({
          session: null,
          refreshToken: null,
          status: "anonymous",
          error:
            error instanceof Error
              ? error.message
              : "The session expired and could not be refreshed.",
        });
        return false;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },
  logout() {
    clearStoredJwtSession();
    clearRefreshTimer();
    set({ session: null, refreshToken: null, status: "anonymous", error: null });
  },
  can(permission) {
    const current = get().session?.user.permissions ?? [];
    const required = Array.isArray(permission) ? permission : [permission];

    return hasAllPermissions(current, required);
  },
}));

if (restoredJwtSession) {
  scheduleRefresh(restoredJwtSession.tokens);

  if (!restoredJwtSession.refreshNow) {
    useAuthStore.setState({
      session: restoredJwtSession.session,
      refreshToken: restoredJwtSession.tokens.refreshToken,
      status: "authenticated",
      error: null,
    });
  } else {
    void (async () => {
      try {
        const bundle = await resolveStoredJwtSession(restoredJwtSession);
        persistJwtSession(bundle);
        scheduleRefresh(bundle.tokens);
        useAuthStore.setState({
          session: bundle.session,
          refreshToken: bundle.tokens.refreshToken,
          status: "authenticated",
          error: null,
        });
      } catch (error) {
        clearStoredJwtSession();
        clearRefreshTimer();
        useAuthStore.setState({
          session: null,
          refreshToken: null,
          status: "anonymous",
          error:
            error instanceof Error
              ? error.message
              : "Unable to restore the user session.",
        });
      }
    })();
  }
}
