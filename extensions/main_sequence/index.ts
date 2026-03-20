import { Command } from "lucide-react";

import type { AppExtension } from "@/app/registry/types";
import type { AppDefinition, AppSurfaceNavigationSection } from "@/apps/types";
import { commandCenterConfig } from "@/config/command-center";

import { MainSequenceBucketsPage } from "./features/buckets/MainSequenceBucketsPage";
import { MainSequenceClustersPage } from "./features/clusters/MainSequenceClustersPage";
import { MainSequenceConstantsPage } from "./features/constants/MainSequenceConstantsPage";
import { MainSequenceDataNodesPage } from "./features/data-nodes/MainSequenceDataNodesPage";
import { MainSequenceJobsPage } from "./features/jobs/MainSequenceJobsPage";
import { MainSequencePhysicalDataSourcesPage } from "./features/physical-data-sources/MainSequencePhysicalDataSourcesPage";
import { MainSequenceProjectDataSourcesPage } from "./features/project-data-sources/MainSequenceProjectDataSourcesPage";
import { MainSequenceProjectsPage } from "./features/projects/MainSequenceProjectsPage";
import { MainSequenceSecretsPage } from "./features/secrets/MainSequenceSecretsPage";
import { mainSequenceDependencyGraphWidget } from "./widgets/dependency-graph/definition";
import { mainSequenceDataNodeVisualizerWidget } from "./widgets/data-node-visualizer/definition";

const workspaceSection: AppSurfaceNavigationSection = {
  id: "workspace",
  label: "Workspace",
  order: 10,
};

const operationsSection: AppSurfaceNavigationSection = {
  id: "operations",
  label: "Operations",
  order: 20,
};

const dataSection: AppSurfaceNavigationSection = {
  id: "data",
  label: "Data",
  order: 30,
};

const mainSequenceApp: AppDefinition = {
  id: "main_sequence",
  title: "Main Sequence",
  description: "CRUD console for Main Sequence backend resources.",
  source: "main_sequence",
  icon: Command,
  requiredPermissions: ["main_sequence:view"],
  permissionDefinitions: [
    {
      id: "main_sequence:view",
      label: "Main Sequence / open",
      description: "Open the Main Sequence application in the shell.",
      category: "Main Sequence",
    },
    {
      id: "main_sequence.workspace:view",
      label: "Workspace / view",
      description: "Open workspace surfaces such as Projects, Constants, and Secrets.",
      category: "Main Sequence",
    },
    {
      id: "main_sequence.operations:view",
      label: "Operations / view",
      description: "Open operational surfaces such as Jobs.",
      category: "Main Sequence",
    },
    {
      id: "main_sequence.data:view",
      label: "Data / view",
      description: "Open data-facing surfaces such as Buckets and DataNodes.",
      category: "Main Sequence",
    },
  ],
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
      navigationSection: workspaceSection,
      kind: "page",
      requiredPermissions: ["main_sequence.workspace:view"],
      component: MainSequenceProjectsPage,
    },
    {
      id: "jobs",
      title: "Jobs",
      navLabel: "Jobs",
      description: "Browse and manage jobs across all Main Sequence projects.",
      navigationSection: operationsSection,
      kind: "page",
      requiredPermissions: ["main_sequence.operations:view"],
      component: MainSequenceJobsPage,
    },
    {
      id: "clusters",
      title: "Clusters",
      navLabel: "Clusters",
      description: "Browse cluster records and open the cluster detail flow by UUID.",
      navigationSection: operationsSection,
      kind: "page",
      requiredPermissions: ["main_sequence.operations:view"],
      component: MainSequenceClustersPage,
    },
    {
      id: "buckets",
      title: "Buckets",
      navLabel: "Buckets",
      description: "Browse and manage bucket objects.",
      navigationSection: dataSection,
      kind: "page",
      requiredPermissions: ["main_sequence.data:view"],
      component: MainSequenceBucketsPage,
    },
    {
      id: "constants",
      title: "Constants Search",
      navLabel: "Constants",
      description: "Search and manage Main Sequence constants.",
      navigationSection: workspaceSection,
      kind: "page",
      requiredPermissions: ["main_sequence.workspace:view"],
      component: MainSequenceConstantsPage,
    },
    {
      id: "secrets",
      title: "Secrets Search",
      navLabel: "Secrets",
      description: "Search and create Main Sequence secrets.",
      navigationSection: workspaceSection,
      kind: "page",
      requiredPermissions: ["main_sequence.workspace:view"],
      component: MainSequenceSecretsPage,
    },
    {
      id: "project-data-sources",
      title: "Project Data Sources",
      navLabel: "Project Data Sources",
      description: "Search and manage project data source records.",
      navigationSection: dataSection,
      kind: "page",
      requiredPermissions: ["main_sequence.data:view"],
      component: MainSequenceProjectDataSourcesPage,
    },
    {
      id: "physical-data-sources",
      title: "Physical Data Sources",
      navLabel: "Physical Data Sources",
      description: "Search and manage physical data source records.",
      navigationSection: dataSection,
      kind: "page",
      requiredPermissions: ["main_sequence.data:view"],
      component: MainSequencePhysicalDataSourcesPage,
    },
    {
      id: "data-nodes",
      title: "DataNodes",
      navLabel: "DataNodes",
      description: "List DynamicTableMetaDatas from ts_manager.",
      navigationSection: dataSection,
      kind: "page",
      requiredPermissions: ["main_sequence.data:view"],
      component: MainSequenceDataNodesPage,
    },
  ],
};

const mainSequenceExtension: AppExtension = {
  id: "main_sequence",
  title: "Main Sequence",
  description: "Main Sequence API-backed app extension.",
  widgets: [mainSequenceDependencyGraphWidget, mainSequenceDataNodeVisualizerWidget],
  apps: [mainSequenceApp],
};

export default mainSequenceExtension;
