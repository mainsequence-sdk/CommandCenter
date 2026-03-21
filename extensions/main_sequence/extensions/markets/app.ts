import { LineChart } from "lucide-react";

import type { AppDefinition, AppSurfaceNavigationSection } from "@/apps/types";

import { MainSequenceAssetCategoriesPage } from "./features/asset-categories/MainSequenceAssetCategoriesPage";
import { MainSequenceAssetTranslationTablesPage } from "./features/asset-translation-tables/MainSequenceAssetTranslationTablesPage";
import { MainSequenceAssetsPage } from "./features/assets/MainSequenceAssetsPage";
import { MainSequenceExecutionVenuesPage } from "./features/execution-venues/MainSequenceExecutionVenuesPage";
import { MainSequenceTargetPortfoliosPage } from "./features/portfolios/MainSequenceTargetPortfoliosPage";

const marketsSection: AppSurfaceNavigationSection = {
  id: "markets",
  label: "Markets",
  order: 10,
};

export const mainSequenceMarketsApp: AppDefinition = {
  id: "main_sequence_markets",
  title: "Main Sequence Markets",
  description: "Market-facing Main Sequence surfaces that can evolve independently from Workbench.",
  source: "main_sequence_markets",
  icon: LineChart,
  requiredPermissions: ["marketdata:read"],
  defaultSurfaceId: "assets",
  surfaces: [
    {
      id: "asset-translation-tables",
      title: "Asset Translation Tables",
      navLabel: "Translation Tables",
      description: "Manage asset translation tables and the translation rules embedded inside each table.",
      navigationSection: marketsSection,
      kind: "page",
      requiredPermissions: ["marketdata:read"],
      component: MainSequenceAssetTranslationTablesPage,
    },
    {
      id: "asset-categories",
      title: "Asset Categories",
      navLabel: "Asset Categories",
      description: "Create, inspect, and delete asset categories with nested migrated asset lists.",
      navigationSection: marketsSection,
      kind: "page",
      requiredPermissions: ["marketdata:read"],
      component: MainSequenceAssetCategoriesPage,
    },
    {
      id: "assets",
      title: "Master List",
      navLabel: "Master List",
      description: "Browse market assets and apply API-backed filters.",
      navigationSection: marketsSection,
      kind: "page",
      requiredPermissions: ["marketdata:read"],
      component: MainSequenceAssetsPage,
    },
    {
      id: "portfolios",
      title: "Portfolios",
      navLabel: "Portfolios",
      description: "Browse target portfolios and remove selected rows through the backend bulk-delete action.",
      navigationSection: marketsSection,
      kind: "page",
      requiredPermissions: ["marketdata:read"],
      component: MainSequenceTargetPortfoliosPage,
    },
    {
      id: "execution-venues",
      title: "Execution Venues",
      navLabel: "Execution Venues",
      description: "Browse execution venues and manage their basic metadata.",
      navigationSection: marketsSection,
      kind: "page",
      requiredPermissions: ["marketdata:read"],
      component: MainSequenceExecutionVenuesPage,
    },
  ],
};
