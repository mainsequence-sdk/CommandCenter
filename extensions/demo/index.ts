import type { AppExtension } from "@/app/registry/types";

import { demoApp } from "./app";
import { heatmapMatrixWidget } from "./widgets/heatmap-matrix/definition";
import { yieldCurvePlotWidget } from "./widgets/yield-curve-plot/definition";

const demoExtension: AppExtension = {
  id: "demo",
  title: "Demo Extension",
  description: "Mock application surfaces and mock-only widgets used for demo-mode builds.",
  mockOnly: true,
  widgets: [yieldCurvePlotWidget, heatmapMatrixWidget],
  apps: [demoApp],
};

export default demoExtension;
