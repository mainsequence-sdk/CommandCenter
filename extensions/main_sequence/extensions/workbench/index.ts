import type { AppExtension } from "@/app/registry/types";

import { mainSequenceDataNodeFilterWidget } from "./widgets/data-node-filter/definition";
import { mainSequenceWorkbenchApp } from "./app";
import { mainSequenceDataNodeGraphWidget } from "./widgets/data-node-visualizer/definition";
import { mainSequenceDataNodeStatisticWidget } from "./widgets/data-node-statistic/definition";
import { mainSequenceDataNodeTableWidget } from "./widgets/data-node-table/definition";
import { mainSequenceDependencyGraphWidget } from "./widgets/dependency-graph/definition";

const mainSequenceWorkbenchExtension: AppExtension = {
  id: "main_sequence_workbench",
  title: "Main Sequence Forge",
  description: "Forge surfaces and widgets for Main Sequence backend administration.",
  widgets: [
    mainSequenceDependencyGraphWidget,
    mainSequenceDataNodeGraphWidget,
    mainSequenceDataNodeFilterWidget,
    mainSequenceDataNodeStatisticWidget,
    mainSequenceDataNodeTableWidget,
  ],
  apps: [mainSequenceWorkbenchApp],
};

export default mainSequenceWorkbenchExtension;
