import type { AppExtension } from "@/app/registry/types";
import { echartsSpecWidget } from "@/widgets/extensions/echarts/definition";

const echartsExtension: AppExtension = {
  id: "echarts",
  title: "ECharts Extension",
  description: "Optional ECharts integration for spec-driven chart widgets with organization-scoped capability controls.",
  widgets: [echartsSpecWidget],
};

export default echartsExtension;
