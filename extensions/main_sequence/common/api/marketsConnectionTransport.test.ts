/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";

import {
  buildMainSequenceMarketsConnectionRequest,
  buildMainSequenceMarketsConnectionQueryRequest,
  isMainSequenceMarketsConnectionRequestUrl,
  unwrapAdapterFromApiRawOperationBody,
} from "./marketsConnectionTransport";

describe("Main Sequence Markets connection transport", () => {
  it("detects only /api/v1 requests as Markets adapter-bound requests", () => {
    expect(
      isMainSequenceMarketsConnectionRequestUrl(
        new URL("https://markets.example.com/api/v1/asset/"),
      ),
    ).toBe(true);
    expect(
      isMainSequenceMarketsConnectionRequestUrl(
        new URL("https://main.example.com/orm/api/ts_manager/dynamic_table/"),
      ),
    ).toBe(false);
  });

  it("builds a raw adapter request from the existing endpoint/path/search inputs", () => {
    const request = buildMainSequenceMarketsConnectionRequest({
      baseUrl: "https://command-center.example.com",
      endpoint: "/api/v1/asset/",
      path: "AAPL/summary/",
      init: {
        method: "POST",
        body: JSON.stringify({ include_asset_detail: true }),
      },
      search: {
        response_format: "frontend_detail",
        empty: "",
        omitted: undefined,
      },
    });

    expect(request).toMatchObject({
      method: "POST",
      path: "/api/v1/asset/AAPL/summary/",
      body: { include_asset_detail: true },
      url: "/api/v1/asset/AAPL/summary/?response_format=frontend_detail",
    });
    expect(request?.query.get("response_format")).toBe("frontend_detail");
    expect(request?.query.has("empty")).toBe(false);
    expect(request?.query.has("omitted")).toBe(false);
  });

  it("returns null for non-Markets requests", () => {
    expect(
      buildMainSequenceMarketsConnectionRequest({
        baseUrl: "https://command-center.example.com",
        endpoint: "/orm/api/ts_manager/dynamic_table/",
      }),
    ).toBeNull();
  });

  it("maps path placeholders to declared Adapter From API parameter keys", () => {
    const request = buildMainSequenceMarketsConnectionRequest({
      baseUrl: "https://command-center.example.com",
      endpoint: "/api/v1/account/",
      path: "account-1/",
    });

    expect(request).not.toBeNull();

    const connectionRequest = buildMainSequenceMarketsConnectionQueryRequest(
      {
        id: "markets",
        typeId: "command_center.adapter_from_api",
        typeVersion: 1,
        name: "Markets",
        publicConfig: {
          applicationBindings: [
            {
              appId: "main_sequence_markets",
              role: "primary-api",
            },
          ],
          compiledContract: {
            contractVersion: 1,
            availableOperations: [
              {
                operationId: "getAccount",
                method: "GET",
                path: "/api/v1/account/{uid}/",
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
              },
            ],
          },
        },
        secureFields: {},
        status: "ok",
        createdAt: "2026-06-10T00:00:00.000Z",
        updatedAt: "2026-06-10T00:00:00.000Z",
      },
      request!,
    );

    expect(connectionRequest.query.parameters?.path).toEqual({
      accountUid: "account-1",
    });
  });

  it("uses the path placeholder when the operation omits path parameter definitions", () => {
    const request = buildMainSequenceMarketsConnectionRequest({
      baseUrl: "https://command-center.example.com",
      endpoint: "/api/v1/portfolio/",
      path: "portfolio-1/weights/",
    });

    expect(request).not.toBeNull();

    const connectionRequest = buildMainSequenceMarketsConnectionQueryRequest(
      {
        id: "markets",
        typeId: "command_center.adapter_from_api",
        typeVersion: 1,
        name: "Markets",
        publicConfig: {
          applicationBindings: [
            {
              appId: "main_sequence_markets",
              role: "primary-api",
            },
          ],
          compiledContract: {
            contractVersion: 1,
            availableOperations: [
              {
                operationId: "getPortfolioWeights",
                method: "GET",
                path: "/api/v1/portfolio/{uid}/weights/",
                parameters: {
                  path: [],
                  query: [],
                  headers: [],
                },
              },
            ],
          },
        },
        secureFields: {},
        status: "ok",
        createdAt: "2026-06-10T00:00:00.000Z",
        updatedAt: "2026-06-10T00:00:00.000Z",
      },
      request!,
    );

    expect(connectionRequest.query.parameters?.path).toEqual({
      uid: "portfolio-1",
    });
  });

  it("maps DELETE portfolio weights path and query names through the compiled contract", () => {
    const request = buildMainSequenceMarketsConnectionRequest({
      baseUrl: "https://command-center.example.com",
      endpoint: "/api/v1/portfolio/",
      path: "portfolio-1/weights/",
      init: {
        method: "DELETE",
      },
      search: {
        weights_date: "2026-06-07T10:30:00Z",
      },
    });

    expect(request).not.toBeNull();

    const connectionRequest = buildMainSequenceMarketsConnectionQueryRequest(
      {
        id: "markets",
        typeId: "command_center.adapter_from_api",
        typeVersion: 1,
        name: "Markets",
        publicConfig: {
          applicationBindings: [
            {
              appId: "main_sequence_markets",
              role: "primary-api",
            },
          ],
          compiledContract: {
            contractVersion: 1,
            availableOperations: [
              {
                operationId: "deletePortfolioWeights",
                method: "DELETE",
                path: "/api/v1/portfolio/{uid}/weights/",
                parameters: {
                  path: [
                    {
                      key: "portfolioUid",
                      name: "uid",
                      label: "Portfolio UID",
                      type: "string",
                      required: true,
                    },
                  ],
                  query: [
                    {
                      key: "weightsDate",
                      name: "weights_date",
                      label: "Weights date",
                      type: "string",
                      required: false,
                    },
                  ],
                  headers: [],
                },
              },
            ],
          },
        },
        secureFields: {},
        status: "ok",
        createdAt: "2026-06-10T00:00:00.000Z",
        updatedAt: "2026-06-10T00:00:00.000Z",
      },
      request!,
    );

    expect(connectionRequest.cacheMode).toBe("bypass");
    expect(connectionRequest.query).toMatchObject({
      kind: "api-operation",
      operationId: "deletePortfolioWeights",
      parameters: {
        path: {
          portfolioUid: "portfolio-1",
        },
        query: {
          weightsDate: "2026-06-07T10:30:00Z",
        },
        headers: {},
      },
    });
  });

  it("unwraps Adapter From API raw operation envelopes back to the upstream body", () => {
    expect(
      unwrapAdapterFromApiRawOperationBody({
        result: {
          operationId: "listAssets",
          statusCode: 200,
          contentType: "application/json",
          headers: {},
          body: {
            results: [{ uid: "asset-1" }],
          },
        },
        warnings: [],
        traceId: "trace-1",
      }),
    ).toEqual({
      results: [{ uid: "asset-1" }],
    });
  });
});
