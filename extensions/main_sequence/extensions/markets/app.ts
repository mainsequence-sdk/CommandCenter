import { LineChart } from "lucide-react";

import {
  defineSurfaceAssistantContext,
  type AppDefinition,
  type AppSurfaceNavigationSection,
} from "@/apps/types";

import { MainSequenceAssetCategoriesPage } from "./features/asset-categories/MainSequenceAssetCategoriesPage";
import { MainSequenceAssetsPage } from "./features/assets/MainSequenceAssetsPage";
import { MainSequenceCalendarsPage } from "./features/calendars/MainSequenceCalendarsPage";
import { MainSequenceManagedAccountsPage } from "./features/managed-accounts/MainSequenceManagedAccountsPage";
import { MainSequenceFundsPage } from "./features/funds/MainSequenceFundsPage";
import { MainSequenceIndicesPage } from "./features/indices/MainSequenceIndicesPage";
import { MainSequencePortfolioGroupsPage } from "./features/portfolio-groups/MainSequencePortfolioGroupsPage";
import { MainSequenceTargetPortfoliosPage } from "./features/portfolios/MainSequenceTargetPortfoliosPage";
import { MainSequencePricingMarketDataPage } from "./features/pricing-market-data/MainSequencePricingMarketDataPage";

const assetsSection: AppSurfaceNavigationSection = {
  id: "assets",
  label: "Assets",
  order: 10,
};

const portfoliosSection: AppSurfaceNavigationSection = {
  id: "portfolios",
  label: "Portfolios",
  order: 20,
};

const managedAccountsSection: AppSurfaceNavigationSection = {
  id: "managed-accounts",
  label: "Managed Accounts",
  order: 25,
};

const pricingSection: AppSurfaceNavigationSection = {
  id: "pricing",
  label: "Pricing",
  order: 28,
};

const platformSection: AppSurfaceNavigationSection = {
  id: "platform",
  label: "Platform",
  order: 30,
};

export const mainSequenceMarketsApp: AppDefinition = {
  id: "main_sequence_markets",
  title: "Main Sequence Markets",
  description: "Market-facing Main Sequence surfaces that can evolve independently from Workbench.",
  source: "main_sequence_markets",
  icon: LineChart,
  navigationOrder: 300,
  requiredPermissions: ["main_sequence_markets:view"],
  permissionDefinitions: [
    {
      id: "main_sequence_markets:view",
      label: "Main Sequence Markets / view",
      description: "Open the Main Sequence Markets application and its market-facing surfaces.",
      category: "Main Sequence Markets",
    },
  ],
  defaultSurfaceId: "assets",
  surfaces: [
    {
      id: "asset-categories",
      title: "Asset Categories",
      navLabel: "Asset Categories",
      description: "Create, inspect, and delete asset categories with nested migrated asset lists.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Asset Categories. This page shows asset category records and their nested asset relationships.",
        availableActions: [
          "Browse asset categories",
          "Create a category",
          "Open category detail",
          "Delete a category",
        ],
      }),
      navigationSection: assetsSection,
      kind: "page",
      requiredPermissions: ["main_sequence_markets:view"],
      component: MainSequenceAssetCategoriesPage,
    },
    {
      id: "assets",
      title: "Master List",
      navLabel: "Master List",
      description: "Browse market assets and apply API-backed filters.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on the Master List. This page shows market assets with API-backed filters and detail navigation.",
        availableActions: [
          "Browse assets",
          "Apply filters",
          "Open asset details",
        ],
      }),
      navigationSection: assetsSection,
      kind: "page",
      requiredPermissions: ["main_sequence_markets:view"],
      component: MainSequenceAssetsPage,
    },
    {
      id: "indices",
      title: "Indices",
      navLabel: "Indices",
      description: "Browse market indices, inspect the canonical metadata payload, and delete registry records.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Indices. This page shows market index records with API-backed search, detail loading, and delete access.",
        availableActions: [
          "Browse indices",
          "Search indices",
          "Open index detail",
          "Delete an index",
        ],
      }),
      navigationSection: assetsSection,
      kind: "page",
      requiredPermissions: ["main_sequence_markets:view"],
      component: MainSequenceIndicesPage,
    },
    {
      id: "pricing-market-data",
      title: "Pricing Market Data",
      navLabel: "Pricing Market Data",
      description: "Pricing-oriented market data workflows for curves, fixings, and inspection.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Pricing Market Data. This page shows pricing market-data sets and bindings backed by the pricing market-data API.",
        availableActions: [
          "Inspect market data sets",
          "Filter sets by exact set key or status",
          "Inspect market data bindings",
          "Filter bindings by exact set UID or concept key",
        ],
      }),
      navigationSection: pricingSection,
      kind: "page",
      requiredPermissions: ["main_sequence_markets:view"],
      component: MainSequencePricingMarketDataPage,
    },
    {
      id: "calendars",
      title: "Calendars",
      navLabel: "Calendars",
      description: "Browse calendar records and inspect related dates, sessions, and events.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Calendars. This page lists calendar records and opens detail views with dates, sessions, and events tabs.",
        availableActions: [
          "Browse calendars",
          "Search calendars",
          "Open calendar detail",
          "Inspect dates, sessions, and events",
        ],
      }),
      navigationSection: platformSection,
      kind: "page",
      requiredPermissions: ["main_sequence_markets:view"],
      component: MainSequenceCalendarsPage,
    },
    {
      id: "funds",
      title: "Virtual Funds",
      navLabel: "Virtual Funds",
      description: "Browse virtual funds and the portfolio and account linked to each one.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Virtual Funds. This page shows virtual funds, opens virtual-fund detail, and displays holdings.",
        availableActions: [
          "Browse virtual funds",
          "Open virtual fund detail",
          "Inspect virtual fund holdings",
          "Inspect linked portfolios",
          "Inspect linked accounts",
        ],
      }),
      navigationSection: portfoliosSection,
      kind: "page",
      requiredPermissions: ["main_sequence_markets:view"],
      component: MainSequenceFundsPage,
    },
    {
      id: "portfolio-groups",
      title: "Portfolio Groups",
      navLabel: "Portfolio Groups",
      description: "Browse portfolio groups and open direct detail pages backed by the standard DRF endpoints.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Portfolio Groups. This page shows portfolio groups and links into their direct detail pages.",
        availableActions: [
          "Browse portfolio groups",
          "Open group detail",
          "Create or update a group",
        ],
      }),
      navigationSection: portfoliosSection,
      kind: "page",
      requiredPermissions: ["main_sequence_markets:view"],
      component: MainSequencePortfolioGroupsPage,
    },
    {
      id: "portfolios",
      title: "Portfolios",
      navLabel: "Portfolios",
      description: "Browse portfolios and remove selected rows through the backend bulk-delete action.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Portfolios. This page shows portfolios and related backend bulk actions.",
        availableActions: [
          "Browse portfolios",
          "Inspect portfolio details",
          "Bulk delete selected portfolios",
        ],
      }),
      navigationSection: portfoliosSection,
      kind: "page",
      requiredPermissions: ["main_sequence_markets:view"],
      component: MainSequenceTargetPortfoliosPage,
    },
    {
      id: "accounts",
      title: "Accounts",
      navLabel: "Accounts",
      description: "Browse managed accounts and open account detail in the standard markets registry workflow.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Accounts. This page shows managed account records and links into dedicated account detail pages.",
        availableActions: [
          "Browse managed accounts",
          "Search accounts",
          "Open account detail",
        ],
      }),
      navigationSection: managedAccountsSection,
      kind: "page",
      requiredPermissions: ["main_sequence_markets:view"],
      component: MainSequenceManagedAccountsPage,
    },
  ],
};
