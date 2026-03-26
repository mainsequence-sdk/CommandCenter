import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import type { MainSequenceDependencyGraphWidgetProps } from "./MainSequenceDependencyGraphWidget";
import { LocalTimeSerieQuickSearchPicker } from "../data-node-shared/LocalTimeSerieQuickSearchPicker";

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
  const { t } = useTranslation();
  const direction = draftProps.direction === "upstream" ? "upstream" : "downstream";
  const localTimeSerieId =
    Number.isFinite(Number(draftProps.localTimeSerieId)) && Number(draftProps.localTimeSerieId) > 0
      ? String(Math.trunc(Number(draftProps.localTimeSerieId)))
      : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">{t("mainSequenceDependencyGraph.widget.badge")}</Badge>
        <span className="text-sm text-muted-foreground">
          {t("mainSequenceDependencyGraph.settings.description")}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">
            {t("mainSequenceDependencyGraph.settings.localTimeSerieId")}
          </span>
          <LocalTimeSerieQuickSearchPicker
            value={localTimeSerieId ? Number(localTimeSerieId) : undefined}
            onChange={(nextId) => {
              onDraftPropsChange({
                ...draftProps,
                localTimeSerieId: nextId,
              });
            }}
            editable={editable}
            queryScope="dependency_graph_widget"
            placeholder="Select a local update"
            searchPlaceholder="Search local updates"
            selectionHelpText={t("mainSequenceDependencyGraph.settings.localTimeSerieIdHelp")}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">
            {t("mainSequenceDependencyGraph.settings.direction")}
          </span>
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
            <option value="downstream">
              {t("mainSequenceDependencyGraph.settings.directionDownstreamShort")}
            </option>
            <option value="upstream">
              {t("mainSequenceDependencyGraph.settings.directionUpstreamShort")}
            </option>
          </Select>
          <p className="text-sm text-muted-foreground">
            {t("mainSequenceDependencyGraph.settings.directionHelp")}
          </p>
        </label>
      </div>
    </div>
  );
}
