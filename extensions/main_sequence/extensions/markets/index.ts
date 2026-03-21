import type { AppExtension } from "@/app/registry/types";

import { mainSequenceMarketsApp } from "./app";
import { portfolioWeightsWidget } from "./widgets/portfolio-weights-table/definition";

const mainSequenceMarketsExtension: AppExtension = {
  id: "main_sequence_markets",
  title: "Main Sequence Markets",
  description: "Markets surfaces built on top of the shared Main Sequence common layer.",
  widgets: [portfolioWeightsWidget],
  apps: [mainSequenceMarketsApp],
};

export default mainSequenceMarketsExtension;
