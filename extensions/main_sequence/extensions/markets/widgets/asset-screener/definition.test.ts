import { describe, expect, it } from "vitest";

import {
  MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID,
  MARKET_ASSET_SCREENER_SEED_INPUT_ID,
} from "../../widget-contracts/marketAssetFrames";
import { getManagedConnectionConsumerAdapter } from "@/widgets/shared/managed-connection-consumer-registry";
import { mainSequenceAssetScreenerWidget } from "./definition";

describe("mainSequenceAssetScreenerWidget", () => {
  it("registers seed data and live updates as consumer inputs", () => {
    const inputIds = mainSequenceAssetScreenerWidget.io?.inputs?.map((input) => input.id);

    expect(mainSequenceAssetScreenerWidget.id).toBe("ms-markets-asset-screener");
    expect(mainSequenceAssetScreenerWidget.workspaceRuntimeMode).toBe("consumer");
    expect(inputIds).toEqual([
      MARKET_ASSET_SCREENER_SEED_INPUT_ID,
      MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID,
    ]);
    expect(mainSequenceAssetScreenerWidget.io?.inputs?.map((input) => input.accepts)).toEqual([
      ["core.tabular_frame@v1"],
      ["core.tabular_frame@v1"],
    ]);
    expect(mainSequenceAssetScreenerWidget.io?.inputs?.map((input) => input.acceptedOutputIds)).toEqual([
      ["dataset"],
      ["updates"],
    ]);
    expect(mainSequenceAssetScreenerWidget.registryContract?.io?.inputContracts).toEqual([
      "core.tabular_frame@v1",
    ]);
    expect(mainSequenceAssetScreenerWidget.registryContract?.io?.ioNotes).toEqual([
      "seedData initializes latest state and carries referenceValue or sparklineSeries fields.",
      "liveUpdates mutates latest state only.",
      "Selection outputs are published from screener runtime state and stay keyed to canonical asset identity.",
    ]);
    expect(mainSequenceAssetScreenerWidget.registryContract?.configuration?.requiredSetupSteps).toEqual([
      "Bind the full semantic snapshot to seedData, or click Add connection to create a hidden managed source.",
      "Put referenceValue and sparklineSeries fields in seedData metadata.",
      "Optionally bind WebSocket or incremental latest rows to liveUpdates.",
    ]);
    expect(mainSequenceAssetScreenerWidget.registryContract?.capabilities).toMatchObject({
      supportsManagedConnectionSource: true,
      supportedSourceModes: ["bound", "connection", "connection-stream"],
    });
    expect(mainSequenceAssetScreenerWidget.registryContract?.usageGuidance).toMatchObject({
      buildPurpose: expect.stringContaining("asset screener"),
      whenToUse: expect.arrayContaining([
        expect.stringContaining("terminal-style asset table"),
      ]),
      authoringSteps: expect.arrayContaining([
        expect.stringContaining("Bind the full snapshot"),
        expect.stringContaining("meta.tableTransforms.computedColumns"),
      ]),
    });
  });

  it("registers a managed connection adapter for Add connection", () => {
    const adapter = getManagedConnectionConsumerAdapter(mainSequenceAssetScreenerWidget.id);

    expect(adapter?.sourceInputId).toBe(MARKET_ASSET_SCREENER_SEED_INPUT_ID);
    expect(adapter?.streamSourceInputId).toBe(MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID);
    expect(adapter?.sourceOutputId).toBe("dataset");
    expect(adapter?.streamSourceOutputId).toBe("updates");
  });
});
