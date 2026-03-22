import type { AppExtension } from "@/app/registry/types";

import { mainSequenceWorkbenchApp } from "./app";
import { mainSequenceDataNodeGraphWidget } from "./widgets/data-node-visualizer/definition";
import { mainSequenceDataNodeTableWidget } from "./widgets/data-node-table/definition";

const mainSequenceWorkbenchExtension: AppExtension = {
  id: "main_sequence_workbench",
  title: "Main Sequence Workbench",
  description: "Workbench surfaces and widgets for Main Sequence backend administration.",
  widgets: [mainSequenceDataNodeGraphWidget, mainSequenceDataNodeTableWidget],
  apps: [mainSequenceWorkbenchApp],
};

export default mainSequenceWorkbenchExtension;
