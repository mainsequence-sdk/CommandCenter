import type { AppExtension } from "@/app/registry/types";

import {
  lightweightChartsSpecWidget,
} from "@/widgets/extensions/lightweight-charts/definition";

const lightweightChartsExtension: AppExtension = {
  id: "lightweight-charts",
  title: "Lightweight Charts Extension",
  description: "Optional Lightweight Charts integration for spec-driven safe JSON chart widgets.",
  widgets: [lightweightChartsSpecWidget],
};

export default lightweightChartsExtension;
