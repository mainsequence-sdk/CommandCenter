import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { WidgetSettingFieldLabel } from "@/widgets/shared/widget-setting-help";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import {
  normalizePortfolioWeightsDataMode,
  type PortfolioWeightsWidgetProps,
} from "./portfolioWeightsRuntime";

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
  const dataMode = normalizePortfolioWeightsDataMode(draftProps);
  const editableInPlace = dataMode === "inline";
  const portfolioId =
    Number.isFinite(Number(draftProps.portfolioId ?? draftProps.targetPortfolioId)) &&
    Number(draftProps.portfolioId ?? draftProps.targetPortfolioId) > 0
      ? String(Math.trunc(Number(draftProps.portfolioId ?? draftProps.targetPortfolioId)))
      : "";
  const variant = editableInPlace
    ? "positions"
    : draftProps.variant === "summary"
      ? "summary"
      : "positions";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">Portfolio widget</Badge>
        <span className="text-sm text-muted-foreground">
          Configure either a backend portfolio source or an inline editable positions table for this instance.
        </span>
      </div>

      <div className="space-y-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/45 p-4">
        <WidgetSettingFieldLabel
          help="Inline mode stores positions directly in widget props and lets workspace authors add assets and edit rows on the canvas. It disables the backend portfolio fetch and always uses the positions view."
          required={false}
          textClassName="text-sm font-medium text-topbar-foreground"
        >
          Editable in place
        </WidgetSettingFieldLabel>
        <label className="flex items-center gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border border-input bg-card/70 accent-primary"
            checked={editableInPlace}
            disabled={!editable}
            onChange={(event) => {
              const nextEditableInPlace = event.target.checked;
              onDraftPropsChange({
                ...draftProps,
                editableInPlace: nextEditableInPlace,
                dataMode: nextEditableInPlace ? "inline" : "portfolio",
                variant: nextEditableInPlace ? "positions" : draftProps.variant,
              });
            }}
          />
          <span>
            Edit positions directly on the canvas instead of configuring them in settings.
          </span>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <WidgetSettingFieldLabel
            help="Used only in portfolio mode. The widget will fetch positions from the Markets portfolio weights endpoint for this portfolio id."
            textClassName="text-sm font-medium text-topbar-foreground"
          >
            Portfolio id
          </WidgetSettingFieldLabel>
          <Input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            placeholder="1"
            value={portfolioId}
            readOnly={!editable || editableInPlace}
            onChange={(event) => {
              onDraftPropsChange({
                ...draftProps,
                portfolioId: normalizeTargetPortfolioId(event.target.value),
              });
            }}
          />
          <p className="text-sm text-muted-foreground">
            {editableInPlace
              ? "Inline mode ignores the portfolio id and uses locally authored rows."
              : "Use the portfolio id from the Markets portfolios surface."}
          </p>
        </label>

        <label className="space-y-2">
          <WidgetSettingFieldLabel
            help="Portfolio mode can render either summary weights or detailed positions. Inline mode always renders position details because those rows are authored directly in the widget."
            textClassName="text-sm font-medium text-topbar-foreground"
          >
            Variant
          </WidgetSettingFieldLabel>
          <Select
            value={variant}
            disabled={!editable || editableInPlace}
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
            {editableInPlace
              ? "Inline mode always uses position details so rows can be edited directly on the canvas."
              : "Summary shows expandable asset rows. Position details uses the fixed five-column market view."}
          </p>
        </label>
      </div>
    </div>
  );
}
