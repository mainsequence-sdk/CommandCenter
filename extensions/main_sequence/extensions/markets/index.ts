import type { AppExtension } from "@/app/registry/types";

import { mainSequenceMarketsApp } from "./app";

const mainSequenceMarketsExtension: AppExtension = {
  id: "main_sequence_markets",
  title: "Main Sequence Markets",
  description: "Markets surfaces built on top of the shared Main Sequence common layer.",
  apps: [mainSequenceMarketsApp],
};

export default mainSequenceMarketsExtension;
