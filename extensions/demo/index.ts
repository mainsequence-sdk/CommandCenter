import type { AppExtension } from "@/app/registry/types";

import { demoApp } from "./app";
import { activityFeedWidget } from "./widgets/activity-feed-definition";
import { heatmapMatrixWidget } from "./widgets/heatmap-matrix/definition";
import { marketKpisWidget } from "./widgets/market-kpis-definition";
import { yieldCurvePlotWidget } from "./widgets/yield-curve-plot/definition";

const demoExtension: AppExtension = {
  id: "demo",
  title: "Demo Extension",
  description: "Mock application surfaces and mock-only widgets used for demo-mode builds.",
  widgets: [yieldCurvePlotWidget, heatmapMatrixWidget, marketKpisWidget, activityFeedWidget],
  apps: [demoApp],
};

export default demoExtension;
