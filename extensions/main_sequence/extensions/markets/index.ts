import type { AppExtension } from "@/app/registry/types";

import { mainSequenceMarketsApp } from "./app";
import { portfolioWeightsWidget } from "./widgets/portfolio-weights-table/definition";
import { yieldCurvePlotWidget } from "./widgets/yield-curve-plot/definition";

const mainSequenceMarketsExtension: AppExtension = {
  id: "main_sequence_markets",
  title: "Main Sequence Markets",
  description: "Markets surfaces built on top of the shared Main Sequence common layer.",
  widgets: [portfolioWeightsWidget, yieldCurvePlotWidget],
  apps: [mainSequenceMarketsApp],
};

export default mainSequenceMarketsExtension;
