import type { AppExtension } from "@/app/registry/types";

import { priceChartWidget } from "@/widgets/extensions/lightweight-charts/definition";

const lightweightChartsExtension: AppExtension = {
  id: "lightweight-charts",
  title: "Lightweight Charts Extension",
  description: "Optional market chart integration kept outside the core library.",
  widgets: [priceChartWidget],
};

export default lightweightChartsExtension;
