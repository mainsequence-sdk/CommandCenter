const enabledQueryValues = new Set(["1", "true", "yes", "on"]);

export function isDevAutologinRoute(search: string) {
  const value = new URLSearchParams(search).get("dev_autologin");

  return enabledQueryValues.has(value?.trim().toLowerCase() ?? "");
}
