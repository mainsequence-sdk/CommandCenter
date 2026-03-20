function toBooleanEnv(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api",
  wsUrl: import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/ws",
  useMockData: toBooleanEnv(import.meta.env.VITE_USE_MOCK_DATA, true),
  bypassAuth: toBooleanEnv(import.meta.env.VITE_BYPASS_AUTH, false),
} as const;
