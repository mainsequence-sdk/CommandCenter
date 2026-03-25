import { useEffect, useRef, type ReactNode } from "react";

import { useAuthStore } from "@/auth/auth-store";
import { i18n } from "@/i18n";
import {
  defaultLanguage,
  isSupportedLanguage,
  type SupportedLanguage,
} from "@/i18n/config";
import {
  fetchCommandCenterPreferences,
  hasConfiguredPreferencesEndpoint,
  updateCommandCenterPreferences,
  type CommandCenterPreferencesSnapshot,
} from "@/preferences/api";
import { useShellStore } from "@/stores/shell-store";
import { useTheme } from "@/themes/ThemeProvider";

function resolveActiveLanguage(): SupportedLanguage {
  const activeLanguage = i18n.resolvedLanguage ?? i18n.language;
  return isSupportedLanguage(activeLanguage) ? activeLanguage : defaultLanguage;
}

function buildCurrentSnapshot(themeId: string): CommandCenterPreferencesSnapshot {
  const shellState = useShellStore.getState();

  return {
    language: resolveActiveLanguage(),
    themeId,
    favoriteSurfaceIds: shellState.favoriteSurfaceIds,
    favoriteWorkspaceIds: shellState.favoriteWorkspaceIds,
  };
}

function serializeSnapshot(snapshot: CommandCenterPreferencesSnapshot) {
  return JSON.stringify(snapshot);
}

function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

export function CommandCenterPreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const sessionUserId = useAuthStore((state) => state.session?.user.id ?? null);
  const endpointConfigured = hasConfiguredPreferencesEndpoint();
  const { setThemeById, themeId } = useTheme();
  const applyingRemoteStateRef = useRef(false);
  const hydratedUserIdRef = useRef<string | null>(null);
  const lastSyncedSnapshotKeyRef = useRef<string | null>(null);
  const pendingSnapshotRef = useRef<CommandCenterPreferencesSnapshot | null>(null);
  const syncInFlightRef = useRef(false);

  useEffect(() => {
    if (!endpointConfigured) {
      hydratedUserIdRef.current = null;
      lastSyncedSnapshotKeyRef.current = null;
      pendingSnapshotRef.current = null;
      return;
    }

    if (!sessionUserId) {
      hydratedUserIdRef.current = null;
      lastSyncedSnapshotKeyRef.current = null;
      pendingSnapshotRef.current = null;
      useShellStore.getState().hydratePersistedPreferences({
        favoriteSurfaceIds: [],
        favoriteWorkspaceIds: [],
      });
      return;
    }

    let cancelled = false;
    hydratedUserIdRef.current = null;
    lastSyncedSnapshotKeyRef.current = null;
    pendingSnapshotRef.current = null;
    useShellStore.getState().hydratePersistedPreferences({
      favoriteSurfaceIds: [],
      favoriteWorkspaceIds: [],
    });

    async function hydratePreferences() {
      try {
        const snapshot = await fetchCommandCenterPreferences();

        if (cancelled) {
          return;
        }

        applyingRemoteStateRef.current = true;

        try {
          useShellStore.getState().hydratePersistedPreferences(snapshot);

          if (resolveActiveLanguage() !== snapshot.language) {
            await i18n.changeLanguage(snapshot.language);
          }

          if (snapshot.themeId && snapshot.themeId !== themeId) {
            setThemeById(snapshot.themeId);
          }
        } finally {
          applyingRemoteStateRef.current = false;
        }

        lastSyncedSnapshotKeyRef.current = serializeSnapshot(snapshot);
      } catch (error) {
        if (!cancelled) {
          console.warn(
            "[command-center] Unable to hydrate backend preferences.",
            error,
          );
          lastSyncedSnapshotKeyRef.current = serializeSnapshot(buildCurrentSnapshot(themeId));
        }
      } finally {
        applyingRemoteStateRef.current = false;

        if (!cancelled) {
          hydratedUserIdRef.current = sessionUserId;
        }
      }
    }

    void hydratePreferences();

    return () => {
      cancelled = true;
    };
  }, [endpointConfigured, sessionUserId]);

  useEffect(() => {
    if (!endpointConfigured || !sessionUserId) {
      return;
    }

    let active = true;

    async function flushPendingSnapshot() {
      if (syncInFlightRef.current) {
        return;
      }

      syncInFlightRef.current = true;

      try {
        while (active && pendingSnapshotRef.current) {
          const snapshot = pendingSnapshotRef.current;
          pendingSnapshotRef.current = null;

          if (hydratedUserIdRef.current !== sessionUserId) {
            continue;
          }

          const snapshotKey = serializeSnapshot(snapshot);

          if (snapshotKey === lastSyncedSnapshotKeyRef.current) {
            continue;
          }

          try {
            const normalizedSnapshot = await updateCommandCenterPreferences(snapshot);

            if (!active || hydratedUserIdRef.current !== sessionUserId) {
              return;
            }

            const normalizedSnapshotKey = serializeSnapshot(normalizedSnapshot);
            lastSyncedSnapshotKeyRef.current = normalizedSnapshotKey;

            if (normalizedSnapshotKey !== serializeSnapshot(buildCurrentSnapshot(themeId))) {
              applyingRemoteStateRef.current = true;

              try {
                useShellStore.getState().hydratePersistedPreferences(normalizedSnapshot);

                if (resolveActiveLanguage() !== normalizedSnapshot.language) {
                  await i18n.changeLanguage(normalizedSnapshot.language);
                }

                if (normalizedSnapshot.themeId && normalizedSnapshot.themeId !== themeId) {
                  setThemeById(normalizedSnapshot.themeId);
                }
              } finally {
                applyingRemoteStateRef.current = false;
              }
            }
          } catch (error) {
            console.warn(
              "[command-center] Unable to sync backend preferences.",
              error,
            );
            return;
          }
        }
      } finally {
        syncInFlightRef.current = false;
      }
    }

    function scheduleSync() {
      if (applyingRemoteStateRef.current || hydratedUserIdRef.current !== sessionUserId) {
        return;
      }

      pendingSnapshotRef.current = buildCurrentSnapshot(themeId);
      void flushPendingSnapshot();
    }

    const unsubscribeShellStore = useShellStore.subscribe((state, previousState) => {
      const favoriteSurfacesChanged = !areStringArraysEqual(
        state.favoriteSurfaceIds,
        previousState.favoriteSurfaceIds,
      );
      const favoriteWorkspacesChanged = !areStringArraysEqual(
        state.favoriteWorkspaceIds,
        previousState.favoriteWorkspaceIds,
      );

      if (favoriteSurfacesChanged || favoriteWorkspacesChanged) {
        scheduleSync();
      }
    });

    function handleLanguageChanged(language: string) {
      if (isSupportedLanguage(language)) {
        scheduleSync();
      }
    }

    i18n.on("languageChanged", handleLanguageChanged);
    scheduleSync();

    return () => {
      active = false;
      i18n.off("languageChanged", handleLanguageChanged);
      unsubscribeShellStore();
    };
  }, [endpointConfigured, sessionUserId, setThemeById, themeId]);

  return <>{children}</>;
}
