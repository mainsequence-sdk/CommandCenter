import { Command } from "lucide-react";

import {
  defineSurfaceAssistantContext,
  type AppDefinition,
  type AppSurfaceNavigationSection,
} from "@/apps/types";
import { commandCenterConfig } from "@/config/command-center";

import { MainSequenceBucketsPage } from "./features/buckets/MainSequenceBucketsPage";
import { MainSequenceClustersPage } from "./features/clusters/MainSequenceClustersPage";
import { MainSequenceConstantsPage } from "./features/constants/MainSequenceConstantsPage";
import { MainSequenceDataNodesPage } from "./features/data-nodes/MainSequenceDataNodesPage";
import { MainSequenceJobsPage } from "./features/jobs/MainSequenceJobsPage";
import { MainSequenceNamespacesPage } from "./features/namespaces/MainSequenceNamespacesPage";
import { MainSequencePhysicalDataSourcesPage } from "./features/physical-data-sources/MainSequencePhysicalDataSourcesPage";
import { MainSequenceProjectDataSourcesPage } from "./features/project-data-sources/MainSequenceProjectDataSourcesPage";
import { MainSequenceProjectsPage } from "./features/projects/MainSequenceProjectsPage";
import { MainSequenceScalableServicesPage } from "./features/scalable-services/MainSequenceScalableServicesPage";
import { MainSequenceSecretsPage } from "./features/secrets/MainSequenceSecretsPage";
import { MainSequenceMetaTablesPage } from "./features/simple-tables/MainSequenceSimpleTablesPage";
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

const tenancyInfrastructureSection: AppSurfaceNavigationSection = {
  id: "tenancy-infrastructure",
  label: "Tenancy Infrastructure",
  order: 25,
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
  order: 28,
};

export const mainSequenceWorkbenchApp: AppDefinition = {
  id: "main_sequence_workbench",
  title: "Main Sequence Foundry",
  description: "CRUD console for Main Sequence backend resources.",
  source: "main_sequence_workbench",
  icon: Command,
  navigationOrder: 200,
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
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Foundry Projects. This page shows Main Sequence projects and project-level workflows.",
        availableActions: [
          "Browse projects",
          "Open a project",
          "Create a project",
          "Delete a project",
        ],
      }),
      navigationSection: workspaceSection,
      kind: "page",
      component: MainSequenceProjectsPage,
    },
    {
      id: "jobs",
      title: "Jobs",
      navLabel: "Jobs",
      description: "Browse and manage jobs across all Main Sequence projects.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Foundry Jobs. This page lists jobs across projects and exposes job operations.",
        availableActions: [
          "Browse jobs",
          "Inspect job details",
          "Review run state",
        ],
      }),
      navigationSection: operationsSection,
      kind: "page",
      component: MainSequenceJobsPage,
    },
    {
      id: "streamlit",
      title: "Streamlit",
      navLabel: "Streamlit",
      description: "Browse public Streamlit releases from the resource gallery.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Streamlit releases. This page shows public Streamlit resources from the gallery.",
        availableActions: [
          "Browse Streamlit releases",
          "Inspect release details",
          "Launch a release",
        ],
      }),
      navigationSection: resourcesSection,
      kind: "page",
      component: MainSequenceStreamlitPage,
    },
    {
      id: "scalable-services",
      title: "Scalable Service",
      navLabel: "Scalable Service",
      description: "Internal deep-link detail surface for scalable-service runtimes.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on a Scalable Service detail surface. This page is opened from runtime-linked flows and shows the selected scalable-service runtime.",
        availableActions: [
          "Inspect service details",
          "Review runtime pods",
        ],
      }),
      navigationSection: deploymentServicesSection,
      kind: "page",
      hidden: true,
      component: MainSequenceScalableServicesPage,
    },
    {
      id: "timescaledb-services",
      title: "TimeScaleDB Services",
      navLabel: "TimeScaleDB Services",
      description: "Browse read-only deployment services backed by the pods TimeScaleDB service endpoints.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on TimeScaleDB Services. This page shows deployment services backed by TimeScaleDB endpoints.",
        availableActions: [
          "Browse services",
          "Inspect service status",
        ],
      }),
      navigationSection: tenancyInfrastructureSection,
      kind: "page",
      component: MainSequenceTimeScaleDbServicesPage,
    },
    {
      id: "clusters",
      title: "Clusters",
      navLabel: "Clusters",
      description: "Browse cluster records and open the cluster detail flow by UUID.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Foundry Clusters. This page lists cluster records and links into cluster detail views.",
        availableActions: [
          "Browse clusters",
          "Open a cluster detail view",
          "Inspect cluster state",
        ],
      }),
      navigationSection: tenancyInfrastructureSection,
      kind: "page",
      component: MainSequenceClustersPage,
    },
    {
      id: "buckets",
      title: "Buckets",
      navLabel: "Buckets",
      description: "Browse and manage bucket objects.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Buckets. This page shows bucket records and bucket-related object state.",
        availableActions: [
          "Browse buckets",
          "Inspect bucket contents",
          "Manage bucket records",
        ],
      }),
      navigationSection: dataSection,
      kind: "page",
      component: MainSequenceBucketsPage,
    },
    {
      id: "constants",
      title: "Constants Search",
      navLabel: "Constants",
      description: "Search and manage Main Sequence constants.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Constants. This page is used to search and manage Main Sequence constants.",
        availableActions: [
          "Search constants",
          "Inspect constant values",
          "Create or delete constants",
        ],
      }),
      navigationSection: workspaceSection,
      kind: "page",
      component: MainSequenceConstantsPage,
    },
    {
      id: "secrets",
      title: "Secrets Search",
      navLabel: "Secrets",
      description: "Search and create Main Sequence secrets.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Secrets. This page is used to search and create Main Sequence secrets.",
        availableActions: [
          "Search secrets",
          "Create a secret",
          "Inspect secret records",
        ],
      }),
      navigationSection: workspaceSection,
      kind: "page",
      component: MainSequenceSecretsPage,
    },
    {
      id: "project-data-sources",
      title: "Project Data Sources",
      navLabel: "Project Data Sources",
      description: "Search and manage project data source records.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Project Data Sources. This page shows project-scoped data source records.",
        availableActions: [
          "Browse project data sources",
          "Inspect source records",
          "Create or update a source",
        ],
      }),
      navigationSection: dataSection,
      kind: "page",
      component: MainSequenceProjectDataSourcesPage,
    },
    {
      id: "physical-data-sources",
      title: "Physical Data Sources",
      navLabel: "Physical Data Sources",
      description: "Search and manage physical data source records.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Physical Data Sources. This page shows physical data source records and their status.",
        availableActions: [
          "Browse physical data sources",
          "Inspect source details",
          "Create or update a source",
        ],
      }),
      navigationSection: dataSection,
      kind: "page",
      component: MainSequencePhysicalDataSourcesPage,
    },
    {
      id: "data-nodes",
      title: "DataNodes",
      navLabel: "DataNodes",
      description: "List DynamicTableMetaDatas from ts_manager.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on DataNodes. This page lists dynamic table metadata records from ts_manager.",
        availableActions: [
          "Browse data nodes",
          "Inspect data node summaries",
          "Open related data flows",
        ],
      }),
      navigationSection: dataSection,
      kind: "page",
      component: MainSequenceDataNodesPage,
    },
    {
      id: "namespaces",
      title: "Namespaces",
      navLabel: "Namespaces",
      description: "Browse ts_manager namespaces and inspect related Meta Tables and Data Nodes.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Foundry Namespaces. This page lists ts_manager namespaces and opens the Meta Tables and Data Nodes registered under a selected namespace.",
        availableActions: [
          "Browse namespaces",
          "Open namespace detail",
          "Inspect related meta tables",
          "Inspect related data nodes",
        ],
      }),
      navigationSection: dataSection,
      kind: "page",
      component: MainSequenceNamespacesPage,
    },
    {
      id: "meta-tables",
      title: "Meta Tables",
      navLabel: "Meta Tables",
      description: "Browse and bulk delete ts_manager meta_table records.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Meta Tables. This page shows meta_table records and related table operations.",
        availableActions: [
          "Browse meta tables",
          "Inspect table details",
          "Bulk delete table records",
        ],
      }),
      navigationSection: dataSection,
      kind: "page",
      component: MainSequenceMetaTablesPage,
    },
  ],
};
