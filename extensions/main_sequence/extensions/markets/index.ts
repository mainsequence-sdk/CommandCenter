import type { AppExtension } from "@/app/registry/types";

import { mainSequenceMarketsApp } from "./app";
import { mainSequenceAssetScreenerWidget } from "./widgets/asset-screener/definition";
import { mainSequenceCurvePlotWidget } from "./widgets/curve-plot/definition";
import { mainSequenceOhlcBarsWidget } from "./widgets/ohlc-bars/definition";
import { positionDetailWidget } from "./widgets/position-detail/definition";
import { mainSequenceZeroCurveWidget } from "./widgets/zero-curve/definition";

const mainSequenceMarketsExtension: AppExtension = {
  id: "main_sequence_markets",
  title: "Main Sequence Markets",
  description: "Markets surfaces built on top of the shared Main Sequence common layer.",
  widgets: [
    mainSequenceAssetScreenerWidget,
    mainSequenceCurvePlotWidget,
    mainSequenceZeroCurveWidget,
    mainSequenceOhlcBarsWidget,
    positionDetailWidget,
  ],
  apps: [mainSequenceMarketsApp],
};

export default mainSequenceMarketsExtension;
