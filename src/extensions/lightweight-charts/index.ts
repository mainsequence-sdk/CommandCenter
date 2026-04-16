import type { AppExtension } from "@/app/registry/types";

import {
  lightweightChartsSpecWidget,
  priceChartWidget,
} from "@/widgets/extensions/lightweight-charts/definition";

const lightweightChartsExtension: AppExtension = {
  id: "lightweight-charts",
  title: "Lightweight Charts Extension",
  description: "Optional Lightweight Charts integration for both legacy market charts and spec-driven safe JSON chart widgets.",
  widgets: [priceChartWidget, lightweightChartsSpecWidget],
};

export default lightweightChartsExtension;
