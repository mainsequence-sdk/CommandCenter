import type { AppExtension } from "@/app/registry/types";

import { mainSequenceDataNodeConnection } from "./connections/dataNodeConnection";
import { mainSequenceSimpleTableConnection } from "./connections/simpleTableConnection";
import { mainSequenceWorkbenchApp } from "./app";
import { mainSequenceDependencyGraphWidget } from "./widgets/dependency-graph/definition";
import { mainSequenceProjectInfraGraphWidget } from "./widgets/project-infra-graph/definition";

const mainSequenceWorkbenchExtension: AppExtension = {
  id: "main_sequence_workbench",
  title: "Main Sequence Foundry",
  description: "Foundry surfaces and widgets for Main Sequence backend administration.",
  widgets: [
    mainSequenceDependencyGraphWidget,
    mainSequenceProjectInfraGraphWidget,
  ],
  apps: [mainSequenceWorkbenchApp],
  connections: [mainSequenceDataNodeConnection, mainSequenceSimpleTableConnection],
};

export default mainSequenceWorkbenchExtension;
