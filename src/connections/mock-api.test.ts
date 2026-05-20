import { describe, expect, it } from "vitest";

import {
  executeMockApiConnectionQuery,
  MOCK_API_CONNECTION_TYPE_ID,
  MOCK_API_LOCAL_INSTANCE_ID,
  MOCK_API_QUERY_KIND,
} from "./mock-api";

describe("Mock API connection", () => {
  it("converts row JSON into a canonical connection response frame", async () => {
    const response = await executeMockApiConnectionQuery({
      connectionId: MOCK_API_LOCAL_INSTANCE_ID,
      query: {
        kind: MOCK_API_QUERY_KIND,
        responseBody: [
          { x: 1, y: 2, label: "a" },
          { x: 2, y: 4, label: "b" },
        ],
      },
    });

    expect(response.frames).toHaveLength(1);
    expect(response.frames[0]).toMatchObject({
      contract: "core.tabular_frame@v1",
      fields: [
        { name: "x", type: "number", values: [1, 2] },
        { name: "y", type: "number", values: [2, 4] },
        { name: "label", type: "string", values: ["a", "b"] },
      ],
    });
  });

  it("passes through full ConnectionQueryResponse JSON when requested", async () => {
    const response = await executeMockApiConnectionQuery({
      connectionId: MOCK_API_LOCAL_INSTANCE_ID,
      query: {
        kind: MOCK_API_QUERY_KIND,
        responseMode: "connection-query-response",
        responseBody: {
          frames: [
            {
              name: "Direct frame",
              contract: "core.tabular_frame@v1",
              fields: [{ name: "value", type: "number", values: [42] }],
            },
          ],
          traceId: "provided-trace",
        },
      },
    });

    expect(response.traceId).toBe("provided-trace");
    expect(response.frames[0]?.name).toBe("Direct frame");
  });

  it("accepts canonical tabular frame JSON in tabular-frame mode", async () => {
    const response = await executeMockApiConnectionQuery({
      connectionId: MOCK_API_LOCAL_INSTANCE_ID,
      query: {
        kind: MOCK_API_QUERY_KIND,
        responseMode: "tabular-frame",
        responseBody: {
          status: "ready",
          columns: ["unique_identifier", "Symbol", "last_price"],
          rows: [
            {
              unique_identifier: "uid:BTCUSDT",
              Symbol: "BTCUSDT",
              last_price: 109420,
            },
          ],
          meta: {
            tableVisuals: {
              columns: {
                Symbol: { label: "Symbol" },
                last_price: { label: "Last", format: "price" },
              },
            },
          },
        },
      },
    });

    expect(response.frames[0]).toMatchObject({
      contract: "core.tabular_frame@v1",
      fields: [
        { name: "unique_identifier", type: "string", values: ["uid:BTCUSDT"] },
        { name: "Symbol", type: "string", values: ["BTCUSDT"] },
        { name: "last_price", type: "number", values: [109420] },
      ],
      meta: {
        tableVisuals: {
          columns: {
            Symbol: { label: "Symbol" },
            last_price: { label: "Last", format: "price" },
          },
        },
      },
    });
  });

  it("throws local query errors for non-2xx simulated statuses", async () => {
    await expect(
      executeMockApiConnectionQuery({
        connectionId: MOCK_API_LOCAL_INSTANCE_ID,
        query: {
          kind: MOCK_API_QUERY_KIND,
          responseStatus: 500,
          responseBody: { error: "boom" },
        },
      }),
    ).rejects.toThrow("Mock API response failed with HTTP 500.");
  });

  it("uses a stable local type id and sentinel instance id", () => {
    expect(MOCK_API_CONNECTION_TYPE_ID).toBe("command_center.mock_api");
    expect(MOCK_API_LOCAL_INSTANCE_ID).toBe("__local_mock_api__");
  });
});
