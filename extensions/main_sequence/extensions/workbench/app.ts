import { Command } from "lucide-react";

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
import { MainSequenceSimpleTablesPage } from "./features/simple-tables/MainSequenceSimpleTablesPage";
import { MainSequenceStreamlitPage } from "./features/streamlit/MainSequenceStreamlitPage";
import { MainSequenceTimeScaleDbServicesPage } from "./features/timescaledb-services/MainSequenceTimeScaleDbServicesPage";

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

const resourcesSection: AppSurfaceNavigationSection = {
  id: "resources",
  label: "Resources",
  order: 15,
};

const dataSection: AppSurfaceNavigationSection = {
  id: "data",
  label: "Data",
  order: 30,
};

const deploymentServicesSection: AppSurfaceNavigationSection = {
  id: "deployment-services",
  label: "Deployment Services",
  order: 25,
};

export const mainSequenceWorkbenchApp: AppDefinition = {
  id: "main_sequence_workbench",
  title: "Main Sequence Foundry",
  description: "CRUD console for Main Sequence backend resources.",
  source: "main_sequence_workbench",
  icon: Command,
  requiredPermissions: ["main_sequence_foundry:view"],
  permissionDefinitions: [
    {
      id: "main_sequence_foundry:view",
      label: "Main Sequence Foundry / view",
      description: "Open the Main Sequence Foundry application and its backend resource surfaces.",
      category: "Main Sequence Foundry",
    },
  ],
  defaultSurfaceId: "projects",
  notificationSources: [
    {
      id: "main-sequence-workbench-notifications",
      title: "Main Sequence Foundry",
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
      requiredPermissions: ["main_sequence_foundry:view"],
      component: MainSequenceProjectsPage,
    },
    {
      id: "jobs",
      title: "Jobs",
      navLabel: "Jobs",
      description: "Browse and manage jobs across all Main Sequence projects.",
      navigationSection: operationsSection,
      kind: "page",
      requiredPermissions: ["main_sequence_foundry:view"],
      component: MainSequenceJobsPage,
    },
    {
      id: "streamlit",
      title: "Streamlit",
      navLabel: "Streamlit",
      description: "Browse public Streamlit releases from the resource gallery.",
      navigationSection: resourcesSection,
      kind: "page",
      requiredPermissions: ["main_sequence_foundry:view"],
      component: MainSequenceStreamlitPage,
    },
    {
      id: "timescaledb-services",
      title: "TimeScaleDB Services",
      navLabel: "TimeScaleDB Services",
      description: "Browse read-only deployment services backed by the pods TimeScaleDB service endpoints.",
      navigationSection: deploymentServicesSection,
      kind: "page",
      requiredPermissions: ["main_sequence_foundry:view"],
      component: MainSequenceTimeScaleDbServicesPage,
    },
    {
      id: "clusters",
      title: "Clusters",
      navLabel: "Clusters",
      description: "Browse cluster records and open the cluster detail flow by UUID.",
      navigationSection: operationsSection,
      kind: "page",
      requiredPermissions: ["main_sequence_foundry:view"],
      component: MainSequenceClustersPage,
    },
    {
      id: "buckets",
      title: "Buckets",
      navLabel: "Buckets",
      description: "Browse and manage bucket objects.",
      navigationSection: dataSection,
      kind: "page",
      requiredPermissions: ["main_sequence_foundry:view"],
      component: MainSequenceBucketsPage,
    },
    {
      id: "constants",
      title: "Constants Search",
      navLabel: "Constants",
      description: "Search and manage Main Sequence constants.",
      navigationSection: workspaceSection,
      kind: "page",
      requiredPermissions: ["main_sequence_foundry:view"],
      component: MainSequenceConstantsPage,
    },
    {
      id: "secrets",
      title: "Secrets Search",
      navLabel: "Secrets",
      description: "Search and create Main Sequence secrets.",
      navigationSection: workspaceSection,
      kind: "page",
      requiredPermissions: ["main_sequence_foundry:view"],
      component: MainSequenceSecretsPage,
    },
    {
      id: "project-data-sources",
      title: "Project Data Sources",
      navLabel: "Project Data Sources",
      description: "Search and manage project data source records.",
      navigationSection: dataSection,
      kind: "page",
      requiredPermissions: ["main_sequence_foundry:view"],
      component: MainSequenceProjectDataSourcesPage,
    },
    {
      id: "physical-data-sources",
      title: "Physical Data Sources",
      navLabel: "Physical Data Sources",
      description: "Search and manage physical data source records.",
      navigationSection: dataSection,
      kind: "page",
      requiredPermissions: ["main_sequence_foundry:view"],
      component: MainSequencePhysicalDataSourcesPage,
    },
    {
      id: "data-nodes",
      title: "DataNodes",
      navLabel: "DataNodes",
      description: "List DynamicTableMetaDatas from ts_manager.",
      navigationSection: dataSection,
      kind: "page",
      requiredPermissions: ["main_sequence_foundry:view"],
      component: MainSequenceDataNodesPage,
    },
    {
      id: "simple-tables",
      title: "Simple Tables",
      navLabel: "Simple Tables",
      description: "Browse and bulk delete ts_manager simple_table records.",
      navigationSection: dataSection,
      kind: "page",
      requiredPermissions: ["main_sequence_foundry:view"],
      component: MainSequenceSimpleTablesPage,
    },
  ],
};
