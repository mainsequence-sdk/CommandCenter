import { describe, expect, it } from "vitest";

import { buildConnectionQueryDraftSeed, resolveConnectionAuthoringQueryModels } from "@/connections/connectionAuthoringContract";
import type { AnyConnectionTypeDefinition, ConnectionInstance } from "@/connections/types";

import alpacaMarketDataConnection from "../../connections/alpaca";
import binanceMarketDataConnection from "../../connections/binance";
import fredEconomicDataConnection from "../../connections/fred";
import massiveMarketDataConnection from "../../connections/massive";
import postgreSqlConnection, {
  POSTGRESQL_DEFAULT_SQL_TABLE_QUERY,
} from "../../connections/postgresql";
import { timescaleDbConnection } from "../../connections/timescaledb";
import { mainSequenceDataNodeConnection } from "../../extensions/main_sequence/extensions/workbench/connections/dataNodeConnection";
import { mainSequenceSimpleTableConnection } from "../../extensions/main_sequence/extensions/workbench/connections/simpleTableConnection";

function createConnectionInstance(
  connectionType: AnyConnectionTypeDefinition,
  publicConfig: Record<string, unknown> = {},
): ConnectionInstance {
  return {
    id: `${connectionType.id}-instance`,
    typeId: connectionType.id,
    typeVersion: connectionType.version,
    name: `${connectionType.title} Default`,
    publicConfig,
    secureFields: {},
    status: "ok",
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
  };
}

describe("connection authoring contract", () => {
  it("filters Massive query models through the shared contract", () => {
    const connectionInstance = createConnectionInstance(massiveMarketDataConnection, {
      enabledAssetClasses: ["economy"],
      enableBetaEndpoints: false,
      enableDeprecatedEndpoints: false,
    });

    const queryModels = resolveConnectionAuthoringQueryModels({
      connectionInstance,
      connectionType: massiveMarketDataConnection,
    });

    expect(queryModels.some((model) => model.id === "massive-economy-treasury-yields")).toBe(true);
    expect(queryModels.some((model) => model.id === "massive-stocks-custom-bars")).toBe(false);
  });

  it("seeds Simple Table SQL defaults from the shared contract", () => {
    const draft = buildConnectionQueryDraftSeed({
      connectionInstance: createConnectionInstance(mainSequenceSimpleTableConnection, {
        simpleTableId: "00000000-0000-0000-0000-000000000123",
        defaultLimit: 250,
      }),
      connectionType: mainSequenceSimpleTableConnection,
    });

    expect(draft.queryModelId).toBe("simple-table-sql");
    expect(draft.query).toEqual({
      kind: "simple-table-sql",
      sql: "select *\nfrom {{simple_table}}\nlimit 100",
    });
    expect(draft.maxRows).toBe(250);
  });

  it("seeds Data Node request defaults from the shared contract", () => {
    const draft = buildConnectionQueryDraftSeed({
      connectionInstance: createConnectionInstance(mainSequenceDataNodeConnection, {
        dataNodeId: "00000000-0000-0000-0000-000000000714",
        defaultLimit: 321,
      }),
      connectionType: mainSequenceDataNodeConnection,
    });

    expect(draft.queryModelId).toBe("data-node-rows-between-dates");
    expect(draft.query).toEqual({ kind: "data-node-rows-between-dates" });
    expect(draft.timeRangeMode).toBe("fixed");
    expect(draft.maxRows).toBe(321);
  });

  it("seeds market and macro connection defaults through the same shared path", () => {
    const alpacaDraft = buildConnectionQueryDraftSeed({
      connectionInstance: createConnectionInstance(alpacaMarketDataConnection, {}),
      connectionType: alpacaMarketDataConnection,
    });
    const binanceDraft = buildConnectionQueryDraftSeed({
      connectionInstance: createConnectionInstance(binanceMarketDataConnection, {}),
      connectionType: binanceMarketDataConnection,
    });
    const fredDraft = buildConnectionQueryDraftSeed({
      connectionInstance: createConnectionInstance(fredEconomicDataConnection, {}),
      connectionType: fredEconomicDataConnection,
    });

    expect(alpacaDraft.queryModelId).toBe("alpaca-equity-ohlc");
    expect(alpacaDraft.maxRows).toBe(1000);
    expect(alpacaDraft.timeRangeMode).toBe("fixed");

    expect(binanceDraft.queryModelId).toBe("binance-spot-prices");
    expect(binanceDraft.maxRows).toBe(1000);

    expect(fredDraft.queryModelId).toBe("fred-series-observations");
    expect(fredDraft.maxRows).toBe(1000);
    expect(fredDraft.timeRangeMode).toBe("fixed");
  });

  it("seeds PostgreSQL-compatible Explore defaults through the shared authoring contract", () => {
    const postgreSqlDraft = buildConnectionQueryDraftSeed({
      connectionInstance: createConnectionInstance(postgreSqlConnection, {
        defaultSchema: "public",
      }),
      connectionType: postgreSqlConnection,
    });
    const timescaleDraft = buildConnectionQueryDraftSeed({
      connectionInstance: createConnectionInstance(timescaleDbConnection, {
        defaultSchema: "public",
      }),
      connectionType: timescaleDbConnection,
    });

    expect(postgreSqlDraft.queryModelId).toBe("sql-table");
    expect(postgreSqlDraft.query).toEqual({
      kind: "sql-table",
      sql: POSTGRESQL_DEFAULT_SQL_TABLE_QUERY,
    });
    expect(postgreSqlDraft.maxRows).toBe(100);
    expect(postgreSqlDraft.timeRangeMode).toBe("none");

    expect(timescaleDraft.queryModelId).toBe("sql-table");
    expect(timescaleDraft.query).toEqual({
      kind: "sql-table",
      sql: POSTGRESQL_DEFAULT_SQL_TABLE_QUERY,
    });
    expect(timescaleDraft.maxRows).toBe(100);
    expect(timescaleDraft.timeRangeMode).toBe("none");
  });

  it("seeds stream drafts from streamable query models instead of HTTP defaults", () => {
    const streamDraft = buildConnectionQueryDraftSeed({
      authoringMode: "stream",
      connectionInstance: createConnectionInstance(binanceMarketDataConnection, {
        marketTypes: ["spot", "usdm_futures"],
      }),
      connectionType: binanceMarketDataConnection,
    });

    expect(streamDraft.queryModelId).toBe("binance-spot-ohlc");
    expect(streamDraft.query).toEqual({
      kind: "binance-spot-ohlc",
      symbols: [],
      interval: "1m",
    });
    expect(streamDraft.timeRangeMode).toBe("fixed");
    expect(typeof streamDraft.fixedStartMs).toBe("number");
    expect(typeof streamDraft.fixedEndMs).toBe("number");
  });
});
