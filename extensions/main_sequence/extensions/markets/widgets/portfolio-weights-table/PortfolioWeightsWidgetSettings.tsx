import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import type { PortfolioWeightsWidgetProps } from "./portfolioWeightsRuntime";

function normalizeTargetPortfolioId(value: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.trunc(parsed);
}

export function PortfolioWeightsWidgetSettings({
  draftProps,
  editable,
  onDraftPropsChange,
}: WidgetSettingsComponentProps<PortfolioWeightsWidgetProps>) {
  const portfolioId =
    Number.isFinite(Number(draftProps.portfolioId ?? draftProps.targetPortfolioId)) &&
    Number(draftProps.portfolioId ?? draftProps.targetPortfolioId) > 0
      ? String(Math.trunc(Number(draftProps.portfolioId ?? draftProps.targetPortfolioId)))
      : "";
  const variant = draftProps.variant === "summary" ? "summary" : "positions";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">Portfolio widget</Badge>
        <span className="text-sm text-muted-foreground">
          Configure the target portfolio source and choose whether this instance shows summary weights or position details.
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">Portfolio id</span>
          <Input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            placeholder="1"
            value={portfolioId}
            readOnly={!editable}
            onChange={(event) => {
              onDraftPropsChange({
                ...draftProps,
                portfolioId: normalizeTargetPortfolioId(event.target.value),
              });
            }}
          />
          <p className="text-sm text-muted-foreground">
            Use the portfolio id from the Markets portfolios surface.
          </p>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">Variant</span>
          <Select
            value={variant}
            disabled={!editable}
            onChange={(event) => {
              onDraftPropsChange({
                ...draftProps,
                variant: event.target.value === "summary" ? "summary" : "positions",
              });
            }}
          >
            <option value="positions">Position details</option>
            <option value="summary">Weights summary</option>
          </Select>
          <p className="text-sm text-muted-foreground">
            Summary shows expandable asset rows. Position details uses the fixed five-column market view.
          </p>
        </label>
      </div>
    </div>
  );
}
