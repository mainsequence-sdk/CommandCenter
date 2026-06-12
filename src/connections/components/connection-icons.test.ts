/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";

import type {
  AnyConnectionTypeDefinition,
  ConnectionInstance,
} from "@/connections/types";

import {
  resolveConnectionInstanceIconDescriptor,
  resolveConnectionTypeIconDescriptor,
} from "./connection-icons";
import {
  clearAdapterFromApiDirectDiscoverySessionCache,
  writeAdapterFromApiDirectDiscoverySessionCache,
} from "../../../connections/adapter-from-api/directTransport";

const adapterFromApiType = {
  id: "command_center.adapter_from_api",
  version: 1,
  title: "Adapter From API",
  description: "Adapter From API",
  source: "command_center",
  category: "APIs",
  capabilities: ["query"],
  accessMode: "proxy",
  iconUrl: "/adapter-icon.svg",
  publicConfigSchema: { version: 1, fields: [] },
  queryModels: [],
} satisfies AnyConnectionTypeDefinition;

function createAdapterFromApiInstance(publicConfig: Record<string, unknown>): ConnectionInstance {
  return {
    id: "markets",
    typeId: "command_center.adapter_from_api",
    typeVersion: 1,
    name: "Markets",
    publicConfig,
    secureFields: {},
    status: "ok",
    createdAt: "2026-06-11T00:00:00.000Z",
    updatedAt: "2026-06-11T00:00:00.000Z",
  };
}

describe("connection icon descriptors", () => {
  it("prefers OpenAPI x-logo metadata for Adapter From API instances", () => {
    const descriptor = resolveConnectionInstanceIconDescriptor(
      createAdapterFromApiInstance({
        compiledContract: {
          adapter: {
            title: "Markets API",
          },
          openapi: {
            logo: {
              url: "http://127.0.0.1:8021/static/logo.svg",
              altText: "Markets",
              backgroundColor: "#111827",
            },
          },
        },
      }),
      adapterFromApiType,
    );

    expect(descriptor).toEqual({
      title: "Markets API",
      iconUrl: "http://127.0.0.1:8021/static/logo.svg",
      imageAlt: "Markets logo",
      backgroundColor: "#111827",
    });
  });

  it("falls back to the connection type icon when the dynamic logo URL is unsafe", () => {
    const descriptor = resolveConnectionInstanceIconDescriptor(
      createAdapterFromApiInstance({
        compiledContract: {
          adapter: {
            title: "Markets API",
          },
          openapi: {
            logo: {
              url: "javascript:alert(1)",
              altText: "Markets",
            },
          },
        },
      }),
      adapterFromApiType,
    );

    expect(descriptor).toEqual(resolveConnectionTypeIconDescriptor(adapterFromApiType));
  });

  it("uses session-cached direct discovery branding when backend config omits the logo", () => {
    const connectionId = "markets-session-logo";

    clearAdapterFromApiDirectDiscoverySessionCache(connectionId);
    writeAdapterFromApiDirectDiscoverySessionCache(connectionId, {
      apiBaseUrl: "http://127.0.0.1:8021",
      contractDefinitionUrl:
        "http://127.0.0.1:8021/.well-known/command-center/connection-contract",
      openApiUrl: "http://127.0.0.1:8021/openapi.json",
      compiledContract: {
        contractVersion: 1,
        adapter: {
          type: "adapter-from-api",
          title: "Markets API",
        },
        openapi: {
          logo: {
            url: "http://127.0.0.1:8021/static/logo.svg",
            altText: "Markets",
            source: "openapi.info.x-logo",
          },
        },
        availableOperations: [],
      },
    });

    const descriptor = resolveConnectionInstanceIconDescriptor(
      {
        ...createAdapterFromApiInstance({
          debugApiBaseUrl: "http://127.0.0.1:8021",
          compiledContract: {
            contractVersion: 1,
            adapter: {
              type: "adapter-from-api",
              title: "Markets API",
            },
            availableOperations: [],
          },
        }),
        id: connectionId,
      },
      adapterFromApiType,
    );

    expect(descriptor.iconUrl).toBe("http://127.0.0.1:8021/static/logo.svg");
    expect(descriptor.imageAlt).toBe("Markets logo");

    clearAdapterFromApiDirectDiscoverySessionCache(connectionId);
  });
});
