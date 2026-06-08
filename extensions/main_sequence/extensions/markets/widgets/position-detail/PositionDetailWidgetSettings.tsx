import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { WidgetSettingFieldLabel } from "@/widgets/shared/widget-setting-help";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import {
  normalizePositionDetailSourceType,
  type PositionDetailSourceType,
  type PositionDetailWidgetProps,
} from "./positionDetailRuntime";

function normalizeAccountUid(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

const sourceTypeHelpText: Record<PositionDetailSourceType, string> = {
  portfolio:
    "Portfolio source rows are always interpreted as weight from notional exposure. Backend hydration is available from the portfolio weights endpoint until local rows are authored.",
  account:
    "Account source hydrates the canonical holdings snapshot first, then saves edited holdings back through the managed-account add-holdings endpoint with a top-level holdings datetime.",
  target_position:
    "Target allocation source rows can use weight from notional exposure, units, or constant notional.",
  target_positions_account:
    "Target allocation account rows can hydrate the latest or exact account target allocation assignment, then save an account-scoped assignment back through the managed-account add-target-positions endpoint with a top-level target allocation datetime.",
};

export function PositionDetailWidgetSettings({
  draftProps,
  editable,
  onDraftPropsChange,
}: WidgetSettingsComponentProps<PositionDetailWidgetProps>) {
  const sourceType = normalizePositionDetailSourceType(draftProps);
  const portfolioUid =
    typeof draftProps.portfolioUid === "string"
      ? draftProps.portfolioUid
      : typeof draftProps.targetPortfolioUid === "string"
        ? draftProps.targetPortfolioUid
        : "";
  const accountUid = typeof draftProps.accountUid === "string" ? draftProps.accountUid : "";
  const variant =
    draftProps.editableInPlace === true || sourceType !== "portfolio"
      ? "positions"
      : draftProps.variant === "summary"
        ? "summary"
        : "positions";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">Position Detail widget</Badge>
        <span className="text-sm text-muted-foreground">
          Choose the domain source contract first. Inline editing applies to every source type.
        </span>
      </div>

      <label className="space-y-2">
        <WidgetSettingFieldLabel
          help="Source type determines how rows are interpreted. Portfolio rows are weights, account rows are holdings rows with a top-level holdings datetime, target allocation rows are local-authored, and target allocation account rows save to an account assignment endpoint."
          textClassName="text-sm font-medium text-topbar-foreground"
        >
          Source type
        </WidgetSettingFieldLabel>
        <Select
          value={sourceType}
          disabled={!editable}
          onChange={(event) => {
            onDraftPropsChange({
              ...draftProps,
              sourceType: event.target.value as PositionDetailSourceType,
              variant:
                event.target.value === "portfolio" && draftProps.editableInPlace !== true
                  ? draftProps.variant
                  : "positions",
            });
          }}
        >
          <option value="portfolio">Portfolio</option>
          <option value="account">Account</option>
          <option value="target_position">Target Allocation</option>
          <option value="target_positions_account">Target Allocation Account</option>
        </Select>
        <p className="text-sm text-muted-foreground">{sourceTypeHelpText[sourceType]}</p>
      </label>

      <div className="space-y-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/45 p-4">
        <WidgetSettingFieldLabel
          help="When enabled, authors can add assets and edit rows directly on the widget canvas. Portfolio widgets can still start from hydrated backend rows before those rows are persisted locally."
          required={false}
          textClassName="text-sm font-medium text-topbar-foreground"
        >
          Editable in place
        </WidgetSettingFieldLabel>
        <label className="flex items-center gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border border-input bg-card/70 accent-primary"
            checked={draftProps.editableInPlace === true}
            disabled={!editable}
            onChange={(event) => {
              onDraftPropsChange({
                ...draftProps,
                editableInPlace: event.target.checked,
                variant:
                  event.target.checked || sourceType !== "portfolio"
                    ? "positions"
                    : draftProps.variant,
              });
            }}
          />
          <span>Edit positions directly on the canvas for this widget instance.</span>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <WidgetSettingFieldLabel
            help="Used only when the source type is Portfolio and no local rows have been authored yet."
            textClassName="text-sm font-medium text-topbar-foreground"
          >
            Portfolio UID
          </WidgetSettingFieldLabel>
          <Input
            type="text"
            placeholder="portfolio-uid"
            value={portfolioUid}
            readOnly={!editable || sourceType !== "portfolio"}
            onChange={(event) => {
              onDraftPropsChange({
                ...draftProps,
                portfolioUid: normalizeAccountUid(event.target.value),
              });
            }}
          />
          <p className="text-sm text-muted-foreground">
            {sourceType === "portfolio"
              ? "Hydrates portfolio rows from the portfolio weights endpoint until you persist local rows."
              : "Ignored for account and target allocation source types."}
          </p>
        </label>

        <label className="space-y-2">
          <WidgetSettingFieldLabel
            help="Used when the source type is Account for holdings hydration, or Target Allocation Account for account-scoped target allocation saves."
            textClassName="text-sm font-medium text-topbar-foreground"
          >
            Account uid
          </WidgetSettingFieldLabel>
          <Input
            type="text"
            placeholder="managed-account-uid"
            value={accountUid}
            readOnly={
              !editable ||
              (sourceType !== "account" && sourceType !== "target_positions_account")
            }
            onChange={(event) => {
              onDraftPropsChange({
                ...draftProps,
                accountUid: normalizeAccountUid(event.target.value),
              });
            }}
          />
          <p className="text-sm text-muted-foreground">
            {sourceType === "account"
              ? "Hydrates latest account holdings from the canonical holdings endpoint until you enter edit mode and save a new holdings snapshot."
              : sourceType === "target_positions_account"
                ? "Required for account target allocation hydration and saves through the target-positions and add-target-positions endpoints."
              : "Ignored for portfolio and target allocation source types."}
          </p>
        </label>

        <label className="space-y-2">
          <WidgetSettingFieldLabel
            help="Only portfolio widgets can render the summary view. Account and target allocation widgets always use detailed positions."
            textClassName="text-sm font-medium text-topbar-foreground"
          >
            Variant
          </WidgetSettingFieldLabel>
          <Select
            value={variant}
            disabled={!editable || sourceType !== "portfolio" || draftProps.editableInPlace === true}
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
            {sourceType === "portfolio" && draftProps.editableInPlace !== true
              ? "Summary is available only for hydrated portfolio data. Once you edit inline, the widget uses detailed positions."
              : "Account, target allocation, and target allocation account sources always render detailed positions."}
          </p>
        </label>
      </div>
    </div>
  );
}
