import { describe, expect, it } from "vitest";

import {
  buildStaticSiteEmbedInitializeMessage,
  readStaticSiteEmbedHandshake,
  resolveStaticSiteEmbedOrigin,
} from "./staticSiteEmbedBridge";

describe("static-site embed bridge", () => {
  it("accepts a versioned Main Sequence ready handshake", () => {
    expect(
      readStaticSiteEmbedHandshake({
        channel: "mainsequence.fund-competition",
        version: 1,
        type: "ready",
        payload: {},
      }),
    ).toEqual({ channel: "mainsequence.fund-competition", version: 1 });

    expect(readStaticSiteEmbedHandshake({ channel: "untrusted", version: 1, type: "ready" }))
      .toBeNull();
    expect(
      readStaticSiteEmbedHandshake({
        channel: "mainsequence.fund-competition",
        version: 2,
        type: "ready",
      }),
    ).toBeNull();
  });

  it("builds an initialize message with only the user UID and current theme", () => {
    expect(
      buildStaticSiteEmbedInitializeMessage({
        handshake: { channel: "mainsequence.fund-competition", version: 1 },
        themeId: "main-sequence-space",
        themeMode: "dark",
        userUid: "user-public-uid",
      }),
    ).toEqual({
      channel: "mainsequence.fund-competition",
      version: 1,
      type: "initialize",
      payload: {
        theme: "dark",
        themeId: "main-sequence-space",
        user: {
          id: "user-public-uid",
          uid: "user-public-uid",
          user_uid: "user-public-uid",
        },
      },
    });
  });

  it("pins messaging to the launch URL origin", () => {
    expect(
      resolveStaticSiteEmbedOrigin(
        "https://site.example.com/.mainsequence/launch#token=one-use-token",
      ),
    ).toBe("https://site.example.com");
    expect(() => resolveStaticSiteEmbedOrigin("javascript:alert(1)")).toThrow("HTTP or HTTPS");
  });

});
