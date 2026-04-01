import type { AppExtension } from "@/app/registry/types";

import { mainSequenceMarketsApp } from "./app";
import { mainSequenceCurvePlotWidget } from "./widgets/curve-plot/definition";
import { mainSequenceZeroCurveWidget } from "./widgets/zero-curve/definition";

const mainSequenceMarketsExtension: AppExtension = {
  id: "main_sequence_markets",
  title: "Main Sequence Markets",
  description: "Markets surfaces built on top of the shared Main Sequence common layer.",
  widgets: [mainSequenceCurvePlotWidget, mainSequenceZeroCurveWidget],
  apps: [mainSequenceMarketsApp],
};

export default mainSequenceMarketsExtension;
