import type { AppExtension } from "@/app/registry/types";

import { mainSequenceWorkbenchApp } from "./app";
import { mainSequenceDependencyGraphWidget } from "./widgets/dependency-graph/definition";
import { mainSequenceDataNodeVisualizerWidget } from "./widgets/data-node-visualizer/definition";

const mainSequenceWorkbenchExtension: AppExtension = {
  id: "main_sequence_workbench",
  title: "Main Sequence Workbench",
  description: "Workbench surfaces and widgets for Main Sequence backend administration.",
  widgets: [mainSequenceDependencyGraphWidget, mainSequenceDataNodeVisualizerWidget],
  apps: [mainSequenceWorkbenchApp],
};

export default mainSequenceWorkbenchExtension;
