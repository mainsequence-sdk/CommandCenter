import { LineChart } from "lucide-react";

import type { AppDefinition, AppSurfaceNavigationSection } from "@/apps/types";

import { MainSequenceAssetCategoriesPage } from "./features/asset-categories/MainSequenceAssetCategoriesPage";
import { MainSequenceAssetTranslationTablesPage } from "./features/asset-translation-tables/MainSequenceAssetTranslationTablesPage";
import { MainSequenceAssetsPage } from "./features/assets/MainSequenceAssetsPage";
import { MainSequenceExecutionVenuesPage } from "./features/execution-venues/MainSequenceExecutionVenuesPage";
import { MainSequenceFundsPage } from "./features/funds/MainSequenceFundsPage";
import { MainSequenceInstrumentsPage } from "./features/instruments/MainSequenceInstrumentsPage";
import { MainSequencePortfolioGroupsPage } from "./features/portfolio-groups/MainSequencePortfolioGroupsPage";
import { MainSequenceTargetPortfoliosPage } from "./features/portfolios/MainSequenceTargetPortfoliosPage";

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

const settingsSection: AppSurfaceNavigationSection = {
  id: "settings",
  label: "Settings",
  order: 30,
};

export const mainSequenceMarketsApp: AppDefinition = {
  id: "main_sequence_markets",
  title: "Main Sequence Markets",
  description: "Market-facing Main Sequence surfaces that can evolve independently from Workbench.",
  source: "main_sequence_markets",
  icon: LineChart,
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
      id: "asset-translation-tables",
      title: "Asset Translation Tables",
      navLabel: "Translation Tables",
      description: "Manage asset translation tables and the translation rules embedded inside each table.",
      navigationSection: settingsSection,
      kind: "page",
      requiredPermissions: ["main_sequence_markets:view"],
      component: MainSequenceAssetTranslationTablesPage,
    },
    {
      id: "asset-categories",
      title: "Asset Categories",
      navLabel: "Asset Categories",
      description: "Create, inspect, and delete asset categories with nested migrated asset lists.",
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
      navigationSection: assetsSection,
      kind: "page",
      requiredPermissions: ["main_sequence_markets:view"],
      component: MainSequenceAssetsPage,
    },
    {
      id: "funds",
      title: "Virtual Funds",
      navLabel: "Virtual Funds",
      description: "Browse virtual funds and the portfolio and account linked to each one.",
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
      navigationSection: portfoliosSection,
      kind: "page",
      requiredPermissions: ["main_sequence_markets:view"],
      component: MainSequencePortfolioGroupsPage,
    },
    {
      id: "portfolios",
      title: "Portfolios",
      navLabel: "Portfolios",
      description: "Browse target portfolios and remove selected rows through the backend bulk-delete action.",
      navigationSection: portfoliosSection,
      kind: "page",
      requiredPermissions: ["main_sequence_markets:view"],
      component: MainSequenceTargetPortfoliosPage,
    },
    {
      id: "instruments",
      title: "Instruments",
      navLabel: "Instruments",
      description: "Placeholder surface for upcoming instrument registry and detail workflows.",
      navigationSection: settingsSection,
      kind: "page",
      requiredPermissions: ["main_sequence_markets:view"],
      component: MainSequenceInstrumentsPage,
    },
    {
      id: "execution-venues",
      title: "Execution Venues",
      navLabel: "Execution Venues",
      description: "Browse execution venues and manage their basic metadata.",
      navigationSection: settingsSection,
      kind: "page",
      requiredPermissions: ["main_sequence_markets:view"],
      component: MainSequenceExecutionVenuesPage,
    },
  ],
};
