/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConnectionInstance } from "@/connections/types";

import type { AdapterFromApiCompiledContract } from "./index";
import {
  clearAdapterFromApiDirectDiscoverySessionCache,
  compileAdapterFromApiDirectContract,
  discoverAdapterFromApiDirectContract,
  queryAdapterFromApiDirect,
  queryAdapterFromApiDirectRaw,
  readAdapterFromApiDirectDiscoverySessionCache,
  writeAdapterFromApiDirectDiscoverySessionCache,
} from "./directTransport";

const directConnection: ConnectionInstance = {
  id: "direct-markets",
  typeId: "command_center.adapter_from_api",
  typeVersion: 1,
  name: "Direct Markets",
  publicConfig: {
    transportMode: "direct",
    debugApiBaseUrl: "http://127.0.0.1:8021",
    compiledContract: {
      contractVersion: 1,
      adapter: {
        type: "adapter-from-api",
      },
      configVariables: [],
      secretVariables: [],
      availableOperations: [
        {
          operationId: "listAccounts",
          method: "GET",
          path: "/api/v1/account/",
          kind: "query",
          capabilities: ["query"],
          parameters: {
            path: [],
            query: [],
            headers: [],
          },
          responseMappings: [],
        },
      ],
    },
  },
  secureFields: {},
  status: "ok",
  createdAt: "2026-06-10T00:00:00.000Z",
  updatedAt: "2026-06-10T00:00:00.000Z",
};

describe("Adapter From API direct transport", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("passes through undeclared query parameters to the upstream URL", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await queryAdapterFromApiDirectRaw(directConnection, {
      connectionId: directConnection.id,
      query: {
        kind: "api-operation",
        operationId: "listAccounts",
        parameters: {
          path: {},
          query: {
            limit: "25",
            offset: "0",
          },
          headers: {},
        },
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstFetchCall = fetchMock.mock.calls[0] as unknown[] | undefined;
    const requestUrl = new URL(String(firstFetchCall?.[0]));
    expect(requestUrl.pathname).toBe("/api/v1/account/");
    expect(requestUrl.searchParams.get("limit")).toBe("25");
    expect(requestUrl.searchParams.get("offset")).toBe("0");
  });

  it("wraps native frame responses declared by operation responseContract", async () => {
    const nativeFrame = {
      name: "Asset Monitor",
      contract: "core.tabular_frame@v1",
      fields: [
        {
          name: "Symbol",
          type: "string",
          values: ["BTC"],
        },
      ],
    };
    const connection: ConnectionInstance = {
      ...directConnection,
      publicConfig: {
        ...directConnection.publicConfig,
        compiledContract: {
          ...(directConnection.publicConfig.compiledContract as AdapterFromApiCompiledContract),
          availableOperations: [
            {
              operationId: "getAssetMonitorFrame",
              method: "GET",
              path: "/api/v1/asset/monitor/frame/",
              kind: "query",
              capabilities: ["query"],
              parameters: {
                path: [],
                query: [],
                headers: [],
              },
              responseContract: "core.tabular_frame@v1",
              responseModel: "TabularFrameResponse",
              responseMappings: [],
            },
          ],
        },
      },
    };
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(nativeFrame), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const response = await queryAdapterFromApiDirect(connection, {
      connectionId: connection.id,
      requestedOutputContract: "core.tabular_frame@v1",
      query: {
        kind: "api-operation",
        operationId: "getAssetMonitorFrame",
        parameters: {
          path: {},
          query: {},
          headers: {},
        },
        body: null,
      },
    });

    expect(response.frames).toEqual([nativeFrame]);
    const firstFetchCall = fetchMock.mock.calls[0] as unknown[] | undefined;
    const requestUrl = new URL(String(firstFetchCall?.[0]));
    expect(requestUrl.pathname).toBe("/api/v1/asset/monitor/frame/");
  });

  it("wraps native tabular source responses declared by operation responseContract", async () => {
    const nativeTabularSource = {
      status: "ready",
      columns: ["symbol", "price"],
      rows: [
        {
          symbol: "BTC",
          price: 101,
        },
      ],
      fields: [
        {
          key: "symbol",
          type: "string",
        },
        {
          key: "price",
          type: "number",
        },
      ],
    };
    const connection: ConnectionInstance = {
      ...directConnection,
      publicConfig: {
        ...directConnection.publicConfig,
        compiledContract: {
          ...(directConnection.publicConfig.compiledContract as AdapterFromApiCompiledContract),
          availableOperations: [
            {
              operationId: "getAssetMonitorFrame",
              method: "GET",
              path: "/api/v1/asset/monitor/frame/",
              kind: "query",
              capabilities: ["query"],
              parameters: {
                path: [],
                query: [],
                headers: [],
              },
              responseContract: "core.tabular_frame@v1",
              responseModel: "TabularFrameResponse",
              responseMappings: [],
            },
          ],
        },
      },
    };
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(nativeTabularSource), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const response = await queryAdapterFromApiDirect(connection, {
      connectionId: connection.id,
      requestedOutputContract: "core.tabular_frame@v1",
      query: {
        kind: "api-operation",
        operationId: "getAssetMonitorFrame",
        parameters: {
          path: {},
          query: {},
          headers: {},
        },
        body: null,
      },
    });

    expect(response.frames).toEqual([
      {
        contract: "core.tabular_frame@v1",
        fields: [
          {
            name: "symbol",
            type: "string",
            values: ["BTC"],
          },
          {
            name: "price",
            type: "number",
            values: [101],
          },
        ],
      },
    ]);
  });

  it("stores OpenAPI info.x-logo branding during direct discovery", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);

      if (requestUrl.endsWith("/.well-known/command-center/connection-contract")) {
        return new Response(
          JSON.stringify({
            contractVersion: 1,
            adapter: {
              type: "adapter-from-api",
              id: "markets",
              title: "Markets API",
            },
            configVariables: [],
            secretVariables: [],
            availableOperations: [
              {
                operationId: "listAssets",
                method: "GET",
                path: "/api/v1/asset/",
                kind: "query",
                parameters: {
                  path: [],
                  query: [],
                  headers: [],
                },
                responseMappings: [],
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      return new Response(
        JSON.stringify({
          openapi: "3.1.0",
          info: {
            title: "Markets API",
            "x-logo": {
              url: "/static/markets-logo.svg",
              altText: "Markets",
              backgroundColor: "#111827",
              href: "/docs",
            },
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await discoverAdapterFromApiDirectContract("http://127.0.0.1:8021");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.compiledContract.openapi?.logo).toEqual({
      url: "http://127.0.0.1:8021/static/markets-logo.svg",
      altText: "Markets",
      backgroundColor: "#111827",
      href: "http://127.0.0.1:8021/docs",
      source: "openapi.info.x-logo",
    });
  });

  it("does not block direct discovery when optional OpenAPI metadata hangs", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);

      if (requestUrl.endsWith("/.well-known/command-center/connection-contract")) {
        return new Response(
          JSON.stringify({
            contractVersion: 1,
            adapter: {
              type: "adapter-from-api",
              id: "markets",
              title: "Markets API",
            },
            configVariables: [],
            secretVariables: [],
            availableOperations: [
              {
                operationId: "getAssetMonitorFrame",
                method: "GET",
                path: "/api/v1/asset/monitor/frame/",
                kind: "query",
                capabilities: ["query"],
                parameters: {
                  path: [],
                  query: [],
                  headers: [],
                },
                responseMappings: [],
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const discoveryPromise = discoverAdapterFromApiDirectContract("http://127.0.0.1:8021");
    await vi.advanceTimersByTimeAsync(1000);
    const result = await discoveryPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.compiledContract.availableOperations?.[0]?.path).toBe(
      "/api/v1/asset/monitor/frame/",
    );
    expect(result.compiledContract.openapi?.logo).toBeUndefined();
  });

  it("excludes display-only logo metadata from the compiled contract checksum", async () => {
    const contractPayload = {
      contractVersion: 1,
      adapter: {
        type: "adapter-from-api",
        id: "markets",
        title: "Markets API",
      },
      configVariables: [],
      secretVariables: [],
      availableOperations: [
        {
          operationId: "listAssets",
          method: "GET",
          path: "/api/v1/asset/",
          kind: "query",
          parameters: {
            path: [],
            query: [],
            headers: [],
          },
          responseMappings: [],
        },
      ],
    };

    const firstContract = await compileAdapterFromApiDirectContract(contractPayload, {
      apiBaseUrl: "http://127.0.0.1:8021",
      openApiUrl: "http://127.0.0.1:8021/openapi.json",
      openApiLogo: {
        url: "http://127.0.0.1:8021/static/first-logo.svg",
        source: "openapi.info.x-logo",
      },
    });
    const secondContract = await compileAdapterFromApiDirectContract(contractPayload, {
      apiBaseUrl: "http://127.0.0.1:8021",
      openApiUrl: "http://127.0.0.1:8021/openapi.json",
      openApiLogo: {
        url: "http://127.0.0.1:8021/static/second-logo.svg",
        source: "openapi.info.x-logo",
      },
    });

    expect(firstContract.openapi?.logo?.url).not.toBe(secondContract.openapi?.logo?.url);
    expect(firstContract.checksum).toBe(secondContract.checksum);
  });

  it("stores direct discovery results in session storage by connection id", async () => {
    const connectionId = "direct-cache-connection";
    const result = {
      apiBaseUrl: "http://127.0.0.1:8021",
      contractDefinitionUrl:
        "http://127.0.0.1:8021/.well-known/command-center/connection-contract",
      openApiUrl: "http://127.0.0.1:8021/openapi.json",
      compiledContract: {
        contractVersion: 1,
        adapter: {
          type: "adapter-from-api" as const,
          title: "Markets API",
        },
        availableOperations: [
          {
            operationId: "listAssets",
            method: "GET",
            path: "/api/v1/asset/",
            kind: "query" as const,
          },
        ],
      },
    };

    clearAdapterFromApiDirectDiscoverySessionCache(connectionId);
    writeAdapterFromApiDirectDiscoverySessionCache(connectionId, result);

    expect(
      readAdapterFromApiDirectDiscoverySessionCache(connectionId, {
        apiBaseUrl: "http://127.0.0.1:8021/",
      })?.compiledContract.adapter?.title,
    ).toBe("Markets API");
    expect(
      readAdapterFromApiDirectDiscoverySessionCache(connectionId, {
        apiBaseUrl: "http://127.0.0.1:8022",
      }),
    ).toBeUndefined();
    expect(
      readAdapterFromApiDirectDiscoverySessionCache(connectionId, {
        apiBaseUrl: "http://127.0.0.1:8021",
        contractVersion: "v2",
      }),
    ).toBeUndefined();
  });

  it("uses cached direct discovery contracts when the persisted direct instance has no compiled contract", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ results: [{ uid: "asset-1" }] }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const connection: ConnectionInstance = {
      ...directConnection,
      id: "direct-cache-runtime",
      publicConfig: {
        transportMode: "direct",
        debugApiBaseUrl: "http://127.0.0.1:8021",
      },
    };

    clearAdapterFromApiDirectDiscoverySessionCache(connection.id);
    writeAdapterFromApiDirectDiscoverySessionCache(connection.id, {
      apiBaseUrl: "http://127.0.0.1:8021",
      contractDefinitionUrl:
        "http://127.0.0.1:8021/.well-known/command-center/connection-contract",
      openApiUrl: "http://127.0.0.1:8021/openapi.json",
      compiledContract: directConnection.publicConfig
        .compiledContract as AdapterFromApiCompiledContract,
    });
    vi.stubGlobal("fetch", fetchMock);

    await queryAdapterFromApiDirectRaw(connection, {
      connectionId: connection.id,
      query: {
        kind: "api-operation",
        operationId: "listAccounts",
        parameters: {
          path: {},
          query: {
            search: "asset",
          },
          headers: {},
        },
      },
    });

    const firstFetchCall = fetchMock.mock.calls[0] as unknown[] | undefined;
    const requestUrl = new URL(String(firstFetchCall?.[0]));
    expect(requestUrl.pathname).toBe("/api/v1/account/");
    expect(requestUrl.searchParams.get("search")).toBe("asset");
  });

  it("prefers cached direct discovery contracts over stale persisted direct contracts", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const connection: ConnectionInstance = {
      ...directConnection,
      id: "direct-cache-refresh",
    };

    clearAdapterFromApiDirectDiscoverySessionCache(connection.id);
    writeAdapterFromApiDirectDiscoverySessionCache(connection.id, {
      apiBaseUrl: "http://127.0.0.1:8021",
      contractDefinitionUrl:
        "http://127.0.0.1:8021/.well-known/command-center/connection-contract",
      openApiUrl: "http://127.0.0.1:8021/openapi.json",
      compiledContract: {
        ...(directConnection.publicConfig.compiledContract as AdapterFromApiCompiledContract),
        availableOperations: [
          {
            operationId: "assetMonitorFrame",
            method: "GET",
            path: "/api/v1/asset/monitor/frame/",
            parameters: {
              path: [],
              query: [],
              headers: [],
            },
            responseMappings: [],
          },
        ],
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    await queryAdapterFromApiDirectRaw(connection, {
      connectionId: connection.id,
      query: {
        kind: "api-operation",
        operationId: "assetMonitorFrame",
        parameters: {
          path: {},
          query: {},
          headers: {},
        },
      },
    });

    const firstFetchCall = fetchMock.mock.calls[0] as unknown[] | undefined;
    const requestUrl = new URL(String(firstFetchCall?.[0]));
    expect(requestUrl.pathname).toBe("/api/v1/asset/monitor/frame/");
  });

  it("treats GET resource operations as query-capable API operations", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const connection: ConnectionInstance = {
      ...directConnection,
      id: "direct-get-resource",
      publicConfig: {
        ...directConnection.publicConfig,
        compiledContract: {
          ...(directConnection.publicConfig.compiledContract as AdapterFromApiCompiledContract),
          availableOperations: [
            {
              operationId: "assetMonitorFrame",
              method: "GET",
              path: "/api/v1/asset/monitor/frame/",
              kind: "resource",
              capabilities: ["resource"],
              parameters: {
                path: [],
                query: [],
                headers: [],
              },
              responseMappings: [],
            },
          ],
        },
      },
    };

    vi.stubGlobal("fetch", fetchMock);

    await queryAdapterFromApiDirectRaw(connection, {
      connectionId: connection.id,
      query: {
        kind: "api-operation",
        operationId: "assetMonitorFrame",
        parameters: {
          path: {},
          query: {},
          headers: {},
        },
      },
    });

    const firstFetchCall = fetchMock.mock.calls[0] as unknown[] | undefined;
    const requestUrl = new URL(String(firstFetchCall?.[0]));
    expect(requestUrl.pathname).toBe("/api/v1/asset/monitor/frame/");
  });

  it("substitutes path placeholders by declared parameter name", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ uid: "account-1" }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const connection: ConnectionInstance = {
      ...directConnection,
      publicConfig: {
        ...directConnection.publicConfig,
        compiledContract: {
          ...(directConnection.publicConfig.compiledContract as Record<string, unknown>),
          availableOperations: [
            {
              operationId: "getAccount",
              method: "GET",
              path: "/api/v1/account/{uid}/",
              kind: "query",
              capabilities: ["query"],
              parameters: {
                path: [
                  {
                    key: "accountUid",
                    name: "uid",
                    label: "Account UID",
                    type: "string",
                    required: true,
                  },
                ],
                query: [],
                headers: [],
              },
              responseMappings: [],
            },
          ],
        },
      },
    };

    vi.stubGlobal("fetch", fetchMock);

    await queryAdapterFromApiDirectRaw(connection, {
      connectionId: connection.id,
      query: {
        kind: "api-operation",
        operationId: "getAccount",
        parameters: {
          path: {
            accountUid: "account-1",
          },
          query: {},
          headers: {},
        },
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstFetchCall = fetchMock.mock.calls[0] as unknown[] | undefined;
    const requestUrl = new URL(String(firstFetchCall?.[0]));
    expect(requestUrl.pathname).toBe("/api/v1/account/account-1/");
  });

  it("infers required path parameters from operation path placeholders", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ uid: "portfolio-1" }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const connection: ConnectionInstance = {
      ...directConnection,
      publicConfig: {
        ...directConnection.publicConfig,
        compiledContract: {
          ...(directConnection.publicConfig.compiledContract as Record<string, unknown>),
          availableOperations: [
            {
              operationId: "getPortfolioWeights",
              method: "GET",
              path: "/api/v1/portfolio/{uid}/weights/",
              kind: "query",
              capabilities: ["query"],
              parameters: {
                path: [],
                query: [],
                headers: [],
              },
              responseMappings: [],
            },
          ],
        },
      },
    };

    vi.stubGlobal("fetch", fetchMock);

    await queryAdapterFromApiDirectRaw(connection, {
      connectionId: connection.id,
      query: {
        kind: "api-operation",
        operationId: "getPortfolioWeights",
        parameters: {
          path: {
            uid: "portfolio-1",
          },
          query: {},
          headers: {},
        },
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstFetchCall = fetchMock.mock.calls[0] as unknown[] | undefined;
    const requestUrl = new URL(String(firstFetchCall?.[0]));
    expect(requestUrl.pathname).toBe("/api/v1/portfolio/portfolio-1/weights/");
  });

  it("explains direct DELETE failures as browser preflight failures", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const connection: ConnectionInstance = {
      ...directConnection,
      publicConfig: {
        ...directConnection.publicConfig,
        compiledContract: {
          ...(directConnection.publicConfig.compiledContract as Record<string, unknown>),
          availableOperations: [
            {
              operationId: "deletePortfolioWeights",
              method: "DELETE",
              path: "/api/v1/portfolio/{uid}/weights/",
              kind: "mutation",
              capabilities: ["mutation"],
              parameters: {
                path: [],
                query: [
                  {
                    key: "weightsDate",
                    name: "weights_date",
                    label: "Weights date",
                    type: "string",
                  },
                ],
                headers: [],
              },
              responseMappings: [],
            },
          ],
        },
      },
    };

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      queryAdapterFromApiDirectRaw(
        connection,
        {
          connectionId: connection.id,
          query: {
            kind: "api-operation",
            operationId: "deletePortfolioWeights",
            parameters: {
              path: {
                uid: "portfolio-1",
              },
              query: {
                weightsDate: "2020-07-10T00:00:00Z",
              },
              headers: {},
            },
          },
        },
        {
          allowNonQueryOperation: true,
        },
      ),
    ).rejects.toThrow(
      "the browser sends an OPTIONS CORS preflight before the real request",
    );
  });
});
