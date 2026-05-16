import { describe, expect, it } from "vitest";

import {
  MARKET_ASSET_SCREENER_HISTORY_INPUT_ID,
  MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID,
  MARKET_ASSET_SCREENER_REFERENCE_INPUT_ID,
  MARKET_ASSET_SCREENER_SEED_INPUT_ID,
} from "../../widget-contracts/marketAssetFrames";
import { mainSequenceAssetScreenerWidget } from "./definition";

describe("mainSequenceAssetScreenerWidget", () => {
  it("registers the four market data lanes as consumer inputs", () => {
    const inputIds = mainSequenceAssetScreenerWidget.io?.inputs?.map((input) => input.id);

    expect(mainSequenceAssetScreenerWidget.id).toBe("ms-markets-asset-screener");
    expect(mainSequenceAssetScreenerWidget.workspaceRuntimeMode).toBe("consumer");
    expect(inputIds).toEqual([
      MARKET_ASSET_SCREENER_SEED_INPUT_ID,
      MARKET_ASSET_SCREENER_REFERENCE_INPUT_ID,
      MARKET_ASSET_SCREENER_HISTORY_INPUT_ID,
      MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID,
    ]);
    expect(mainSequenceAssetScreenerWidget.io?.inputs?.map((input) => input.accepts)).toEqual([
      ["core.tabular_frame@v1"],
      ["core.tabular_frame@v1"],
      ["core.tabular_frame@v1"],
      ["core.tabular_frame@v1"],
    ]);
    expect(mainSequenceAssetScreenerWidget.io?.inputs?.map((input) => input.acceptedOutputIds)).toEqual([
      ["dataset"],
      ["dataset"],
      ["dataset"],
      ["updates"],
    ]);
    expect(mainSequenceAssetScreenerWidget.registryContract?.io?.inputContracts).toEqual([
      "core.tabular_frame@v1",
    ]);
    expect(mainSequenceAssetScreenerWidget.registryContract?.io?.ioNotes).toEqual([
      "seedData initializes latest state and may carry inline referenceValue or sparklineSeries fields.",
      "referenceData supplies historical baselines.",
      "historyData supplies ordered value series for sparkline columns.",
      "liveUpdates mutates latest state only.",
    ]);
    expect(mainSequenceAssetScreenerWidget.registryContract?.configuration?.requiredSetupSteps).toEqual([
      "Bind latest snapshot rows to seedData.",
      "Bind historical reference-point rows to referenceData, or mark inline referenceValue fields on seedData.",
      "Optionally bind bounded historical series rows to historyData for trend sparklines.",
      "Optionally bind WebSocket or incremental latest rows to liveUpdates.",
    ]);
    expect(mainSequenceAssetScreenerWidget.registryContract?.usageGuidance).toMatchObject({
      buildPurpose: expect.stringContaining("asset screener"),
      whenToUse: expect.arrayContaining([
        expect.stringContaining("terminal-style asset table"),
      ]),
      authoringSteps: expect.arrayContaining([
        expect.stringContaining("Bind latest snapshot rows"),
        expect.stringContaining("meta.tableTransforms.computedColumns"),
      ]),
    });
  });
});
