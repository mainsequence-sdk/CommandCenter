import { LineChart } from "lucide-react";

import { defineWidget } from "@/widgets/types";

import { mainSequenceZeroCurveWidgetController } from "./controller";
import { zeroCurveSettingsSchema } from "./schema";
import { ZeroCurveWidget } from "./ZeroCurveWidget";
import type { MainSequenceZeroCurveWidgetProps } from "./zeroCurveModel";

export const mainSequenceZeroCurveWidget = defineWidget<MainSequenceZeroCurveWidgetProps>({
  id: "main-sequence-zero-curve",
  title: "Zero Curve",
  description: "Compressed Curve Data Node chart rendered on a numeric days axis with ECharts.",
  category: "Rates",
  kind: "chart",
  source: "main_sequence_markets",
  requiredPermissions: ["marketdata:read"],
  tags: ["main-sequence", "markets", "zero-curve", "rates", "echarts", "data-node"],
  exampleProps: {
    sourceMode: "filter_widget",
  },
  mockProps: {
    sourceMode: "filter_widget",
  },
  railIcon: LineChart,
  schema: zeroCurveSettingsSchema,
  controller: mainSequenceZeroCurveWidgetController,
  component: ZeroCurveWidget,
});
