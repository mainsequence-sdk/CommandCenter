export type StaticSiteEmbedThemeMode = "dark" | "light";

type StaticSiteEmbedHandshake = {
  channel: string;
  version: 1;
};

type StaticSiteEmbedMessage = StaticSiteEmbedHandshake & {
  type: string;
  payload: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function resolveStaticSiteEmbedOrigin(launchUrl: string) {
  const url = new URL(launchUrl);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Static-site launch URLs must use HTTP or HTTPS.");
  }

  return url.origin;
}

export function readStaticSiteEmbedHandshake(value: unknown): StaticSiteEmbedHandshake | null {
  if (!isRecord(value)) {
    return null;
  }

  const channel = typeof value.channel === "string" ? value.channel.trim() : "";

  if (!channel.startsWith("mainsequence.") || value.version !== 1 || value.type !== "ready") {
    return null;
  }

  return { channel, version: 1 };
}

export function buildStaticSiteEmbedInitializeMessage({
  handshake,
  themeId,
  themeMode,
  userUid,
}: {
  handshake: StaticSiteEmbedHandshake;
  themeId: string;
  themeMode: StaticSiteEmbedThemeMode;
  userUid: string | null;
}): StaticSiteEmbedMessage {
  return {
    ...handshake,
    type: "initialize",
    payload: {
      theme: themeMode,
      themeId,
      user: userUid
        ? {
            id: userUid,
            uid: userUid,
            user_uid: userUid,
          }
        : null,
    },
  };
}
