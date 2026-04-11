function toBooleanEnv(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

const rawEnv = import.meta.env as Record<string, string | undefined>;

export const env = {
  apiBaseUrl: rawEnv.VITE_API_BASE_URL ?? "http://127.0.0.1:8000",
  wsUrl: rawEnv.VITE_WS_URL ?? "ws://localhost:8000/ws",
  useMockData: toBooleanEnv(rawEnv.VITE_USE_MOCK_DATA, true),
  bypassAuth: toBooleanEnv(rawEnv.VITE_BYPASS_AUTH, false),
  debugChat: toBooleanEnv(rawEnv.VITE_DEBUG_CHAT, false),
  includeWebsockets: toBooleanEnv(rawEnv.VITE_INCLUDE_WEBSOCKETS, true),
  includeAui: toBooleanEnv(rawEnv.VITE_INCLUDE_AUI, true),
  includeWorkspaces: toBooleanEnv(rawEnv.VITE_INCLUDE_WORKSPACES, true),
} as const;
