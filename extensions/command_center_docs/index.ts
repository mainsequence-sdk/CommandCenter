import type { AppExtension } from "@/app/registry/types";

import { commandCenterDocsApp } from "./app";

const commandCenterDocsExtension: AppExtension = {
  id: "command_center_docs",
  title: "Command Center Docs",
  description: "In-app user documentation for Command Center.",
  apps: [commandCenterDocsApp],
};

export default commandCenterDocsExtension;
