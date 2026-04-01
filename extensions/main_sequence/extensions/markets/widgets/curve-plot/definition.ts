import { LineChart } from "lucide-react";

import { defineWidget } from "@/widgets/types";

import { mainSequenceCurvePlotWidgetController } from "./controller";
import { CurvePlotWidget } from "./CurvePlotWidget";
import type { MainSequenceCurvePlotWidgetProps } from "./curvePlotModel";
import { curvePlotSettingsSchema } from "./schema";

export const mainSequenceCurvePlotWidget = defineWidget<MainSequenceCurvePlotWidgetProps>({
  id: "main-sequence-curve-plot",
  title: "Curve Plot",
  description: "DataNode-backed tenor curve chart rendered from mapped maturity and yield fields.",
  category: "Rates",
  kind: "chart",
  source: "main_sequence_markets",
  requiredPermissions: ["marketdata:read"],
  tags: ["main-sequence", "markets", "yield-curve", "rates", "lightweight-charts", "data-node"],
  exampleProps: {
    sourceMode: "filter_widget",
    maturityUnit: "auto",
  },
  mockProps: {
    sourceMode: "filter_widget",
    maturityUnit: "auto",
  },
  railIcon: LineChart,
  schema: curvePlotSettingsSchema,
  controller: mainSequenceCurvePlotWidgetController,
  component: CurvePlotWidget,
});
