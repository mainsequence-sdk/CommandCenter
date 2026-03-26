import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import {
  normalizeYieldCurveComparisonMode,
  normalizeYieldCurveMarket,
  normalizeYieldCurveScenario,
  yieldCurveComparisonOptions,
  yieldCurveMarketOptions,
  yieldCurveScenarioOptions,
} from "./mock-data";
import type { YieldCurvePlotWidgetProps } from "./YieldCurvePlotWidget";

export function YieldCurvePlotWidgetSettings({
  draftProps,
  editable,
  onDraftPropsChange,
}: WidgetSettingsComponentProps<YieldCurvePlotWidgetProps>) {
  const market = normalizeYieldCurveMarket(draftProps.market);
  const scenario = normalizeYieldCurveScenario(draftProps.scenario);
  const comparisonMode = normalizeYieldCurveComparisonMode(draftProps.comparisonMode);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="primary">Yield curve</Badge>
        <Badge variant="neutral">Lightweight Charts</Badge>
        <Badge variant="warning">Mock data</Badge>
      </div>

      <div className="text-sm text-muted-foreground">
        This first pass stays mock-only. Use the settings below to switch the curve family, shape,
        and time-gradient history stack rendered by the dashboard instance.
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">Curve family</span>
          <Select
            value={market}
            disabled={!editable}
            onChange={(event) => {
              onDraftPropsChange({
                ...draftProps,
                market: normalizeYieldCurveMarket(event.target.value),
              });
            }}
          >
            {yieldCurveMarketOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">Curve shape</span>
          <Select
            value={scenario}
            disabled={!editable}
            onChange={(event) => {
              onDraftPropsChange({
                ...draftProps,
                scenario: normalizeYieldCurveScenario(event.target.value),
              });
            }}
          >
            {yieldCurveScenarioOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">History mode</span>
          <Select
            value={comparisonMode}
            disabled={!editable}
            onChange={(event) => {
              onDraftPropsChange({
                ...draftProps,
                comparisonMode: normalizeYieldCurveComparisonMode(event.target.value),
              });
            }}
          >
            {yieldCurveComparisonOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
      </div>
    </div>
  );
}
