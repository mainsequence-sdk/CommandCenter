import { LineChart } from "lucide-react";

import type { AppDefinition, AppSurfaceNavigationSection } from "@/apps/types";

import { MainSequenceMarketsHomePage } from "./features/MainSequenceMarketsHomePage";

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
  defaultSurfaceId: "market-overview",
  surfaces: [
    {
      id: "market-overview",
      title: "Market Overview",
      navLabel: "Overview",
      description: "Landing surface for the Main Sequence Markets extension.",
      navigationSection: marketsSection,
      kind: "page",
      requiredPermissions: ["marketdata:read"],
      component: MainSequenceMarketsHomePage,
    },
  ],
};
