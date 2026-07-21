function toBooleanEnv(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

const rawEnv = import.meta.env as Record<string, string | undefined>;
const isDevRuntime = import.meta.env.DEV;
const devLoginIdentifier =
  rawEnv.VITE_COMMAND_CENTER_DEV_LOGIN_IDENTIFIER?.trim() ?? "";
const devLoginPassword = rawEnv.VITE_COMMAND_CENTER_DEV_LOGIN_PASSWORD ?? "";
const hasDevLoginCredentials = Boolean(devLoginIdentifier && devLoginPassword);

export const env = {
  apiBaseUrl: rawEnv.VITE_API_BASE_URL ?? "http://localhost:8000",
  debugMainSequence: rawEnv.VITE_DEBUG_MAIN_SEQUENCE?.trim() ?? "",
  useMockData: toBooleanEnv(rawEnv.VITE_USE_MOCK_DATA, true),
  bypassAuth: toBooleanEnv(rawEnv.VITE_BYPASS_AUTH, false),
  debugChat: toBooleanEnv(rawEnv.VITE_DEBUG_CHAT, false),
  includeAui: toBooleanEnv(rawEnv.VITE_INCLUDE_AUI, true),
  includeWorkspaces: toBooleanEnv(rawEnv.VITE_INCLUDE_WORKSPACES, true),
  devLogin: {
    enabled: isDevRuntime && hasDevLoginCredentials,
    identifier: isDevRuntime ? devLoginIdentifier : "",
    password: isDevRuntime ? devLoginPassword : "",
  },
} as const;
