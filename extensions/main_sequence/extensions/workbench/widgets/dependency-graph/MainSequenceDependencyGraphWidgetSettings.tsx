import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import type { MainSequenceDependencyGraphWidgetProps } from "./MainSequenceDependencyGraphWidget";

function normalizeLocalTimeSerieId(value: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.trunc(parsed);
}

export function MainSequenceDependencyGraphWidgetSettings({
  draftProps,
  editable,
  onDraftPropsChange,
}: WidgetSettingsComponentProps<MainSequenceDependencyGraphWidgetProps>) {
  const direction = draftProps.direction === "upstream" ? "upstream" : "downstream";
  const localTimeSerieId =
    Number.isFinite(Number(draftProps.localTimeSerieId)) && Number(draftProps.localTimeSerieId) > 0
      ? String(Math.trunc(Number(draftProps.localTimeSerieId)))
      : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">Graph widget</Badge>
        <span className="text-sm text-muted-foreground">
          Configure the LocalTimeSerie source and graph direction for this widget instance.
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">LocalTimeSerie id</span>
          <Input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            placeholder="716"
            value={localTimeSerieId}
            readOnly={!editable}
            onChange={(event) => {
              onDraftPropsChange({
                ...draftProps,
                localTimeSerieId: normalizeLocalTimeSerieId(event.target.value),
              });
            }}
          />
          <p className="text-sm text-muted-foreground">
            Use the local update id from the Data Nodes detail view.
          </p>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">Direction</span>
          <Select
            value={direction}
            disabled={!editable}
            onChange={(event) => {
              onDraftPropsChange({
                ...draftProps,
                direction: event.target.value === "upstream" ? "upstream" : "downstream",
              });
            }}
          >
            <option value="downstream">Downstream</option>
            <option value="upstream">Upstream</option>
          </Select>
          <p className="text-sm text-muted-foreground">
            Downstream follows impacted dependents. Upstream shows source dependencies.
          </p>
        </label>
      </div>
    </div>
  );
}
