function toBooleanEnv(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

const rawEnv = import.meta.env as Record<string, string | undefined>;

export const env = {
  apiBaseUrl: rawEnv.VITE_API_BASE_URL ?? "http://localhost:8000/api",
  wsUrl: rawEnv.VITE_WS_URL ?? "ws://localhost:8000/ws",
  useMockData: toBooleanEnv(rawEnv.VITE_USE_MOCK_DATA, true),
  bypassAuth: toBooleanEnv(rawEnv.VITE_BYPASS_AUTH, false),
  includeAui: toBooleanEnv(rawEnv.INCLUDE_AUI ?? rawEnv.VITE_INCLUDE_AUI, true),
  includeWorkspaces: toBooleanEnv(
    rawEnv.INCLUDE_WORKSPACES ?? rawEnv.VITE_INCLUDE_WORKSPACES,
    true,
  ),
} as const;
