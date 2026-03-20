import { Command } from "lucide-react";

import type { AppExtension } from "@/app/registry/types";
import type { AppDefinition } from "@/apps/types";
import { commandCenterConfig } from "@/config/command-center";

import { MainSequenceConstantsPage } from "./features/constants/MainSequenceConstantsPage";
import { MainSequenceDataNodesPage } from "./features/data-nodes/MainSequenceDataNodesPage";
import { MainSequenceJobsPage } from "./features/jobs/MainSequenceJobsPage";
import { MainSequenceProjectsPage } from "./features/projects/MainSequenceProjectsPage";
import { MainSequenceSecretsPage } from "./features/secrets/MainSequenceSecretsPage";

const mainSequenceApp: AppDefinition = {
  id: "main_sequence",
  title: "Main Sequence",
  description: "CRUD console for Main Sequence backend resources.",
  source: "main_sequence",
  icon: Command,
  defaultSurfaceId: "projects",
  notificationSources: [
    {
      id: "main-sequence-notifications",
      title: "Main Sequence",
      listPath: commandCenterConfig.notifications.listUrl,
      detailPath: commandCenterConfig.notifications.detailUrl,
      markReadPath: commandCenterConfig.notifications.markReadUrl,
      dismissPath: commandCenterConfig.notifications.dismissUrl,
      markAllReadPath: commandCenterConfig.notifications.markAllReadUrl,
      dismissAllPath: commandCenterConfig.notifications.dismissAllUrl,
      listQuery: {
        limit: 50,
      },
    },
  ],
  surfaces: [
    {
      id: "projects",
      title: "Projects",
      navLabel: "Projects",
      description: "Create, list, and delete Main Sequence projects.",
      kind: "page",
      component: MainSequenceProjectsPage,
    },
    {
      id: "jobs",
      title: "Jobs",
      navLabel: "Jobs",
      description: "Browse and manage jobs across all Main Sequence projects.",
      kind: "page",
      component: MainSequenceJobsPage,
    },
    {
      id: "constants",
      title: "Constants Search",
      navLabel: "Constants",
      description: "Search and manage Main Sequence constants.",
      kind: "page",
      component: MainSequenceConstantsPage,
    },
    {
      id: "secrets",
      title: "Secrets Search",
      navLabel: "Secrets",
      description: "Search and create Main Sequence secrets.",
      kind: "page",
      component: MainSequenceSecretsPage,
    },
    {
      id: "data-nodes",
      title: "DataNodes",
      navLabel: "DataNodes",
      description: "List DynamicTableMetaDatas from ts_manager.",
      kind: "page",
      component: MainSequenceDataNodesPage,
    },
  ],
};

const mainSequenceExtension: AppExtension = {
  id: "main_sequence",
  title: "Main Sequence",
  description: "Main Sequence API-backed app extension.",
  apps: [mainSequenceApp],
};

export default mainSequenceExtension;
