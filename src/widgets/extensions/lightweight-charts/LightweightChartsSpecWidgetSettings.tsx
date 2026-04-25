import { LineChart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useResolvedWidgetOrganizationConfiguration } from "@/widgets/WidgetOrganizationConfigurationProvider";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import {
  LightweightChartsSpecWidget,
  starterSpecJson,
  type LightweightChartsSpecWidgetProps,
} from "./LightweightChartsSpecWidget";

function normalizeSpecJsonDraftValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value === undefined) {
    return "";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

export function LightweightChartsSpecWidgetSettings({
  widget,
  draftProps,
  editable,
  onDraftPropsChange,
  resolvedInputs,
}: WidgetSettingsComponentProps<LightweightChartsSpecWidgetProps>) {
  const organizationConfiguration = useResolvedWidgetOrganizationConfiguration(widget);
  const resourceBudget = organizationConfiguration.resolvedConfig &&
    typeof organizationConfiguration.resolvedConfig === "object" &&
    organizationConfiguration.resolvedConfig !== null &&
    "resourceBudget" in organizationConfiguration.resolvedConfig &&
    typeof organizationConfiguration.resolvedConfig.resourceBudget === "object" &&
    organizationConfiguration.resolvedConfig.resourceBudget !== null
      ? organizationConfiguration.resolvedConfig.resourceBudget as Record<string, unknown>
      : null;
  const previewProps: LightweightChartsSpecWidgetProps = {
    specJson: normalizeSpecJsonDraftValue(draftProps.specJson),
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="primary">Lightweight Charts</Badge>
        <Badge variant="neutral">Spec-driven</Badge>
        <Badge variant="neutral">Safe JSON</Badge>
        <Badge variant="neutral">Org configuration capable</Badge>
      </div>

      <div className="text-sm text-muted-foreground">
        This widget renders a declarative Lightweight Charts spec from widget props. It can consume
        one bound JSON props payload from another widget and resolves organization-scoped resource
        budgets plus theme tokens and chart palettes before the chart is rendered.
      </div>

      <section className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/30 px-4 py-3">
        <div className="text-sm font-medium text-topbar-foreground">Effective organization mode</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border/70 bg-card/70 px-2.5 py-1">
            safe-json
          </span>
          {organizationConfiguration.overrideRecord ? (
            <span className="rounded-full border border-border/70 bg-card/70 px-2.5 py-1">
              Override row {organizationConfiguration.overrideRecord.id}
            </span>
          ) : (
            <span className="rounded-full border border-border/70 bg-card/70 px-2.5 py-1">
              Widget default
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          This first version is JSON-only. The saved content is a declarative chart spec, not a JS
          builder.
        </p>
        {resourceBudget ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {typeof resourceBudget.maxSeriesCount === "number" ? (
              <span className="rounded-full border border-border/70 bg-card/70 px-2.5 py-1">
                {resourceBudget.maxSeriesCount} series max
              </span>
            ) : null}
            {typeof resourceBudget.maxPointsPerSeries === "number" ? (
              <span className="rounded-full border border-border/70 bg-card/70 px-2.5 py-1">
                {resourceBudget.maxPointsPerSeries.toLocaleString()} points/series max
              </span>
            ) : null}
            {typeof resourceBudget.maxMarkersPerSeries === "number" ? (
              <span className="rounded-full border border-border/70 bg-card/70 px-2.5 py-1">
                {resourceBudget.maxMarkersPerSeries.toLocaleString()} markers/series max
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/30 px-4 py-3">
        <div className="text-sm font-medium text-topbar-foreground">Binding support</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Bind one <code>core.value.json@v1</code> payload into the <strong>Props JSON</strong>{" "}
          input when an AppComponent or another upstream widget should publish the Lightweight
          Charts widget props dynamically. A valid binding replaces saved local props, and it can
          provide the chart spec as <code>specJson</code>, under <code>spec</code>, or as the raw
          spec object directly.
        </p>
        {resolvedInputs?.["props-json"] ? (
          <div className="mt-3 text-xs text-muted-foreground">
            A Props JSON binding is currently configured for this instance.
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-topbar-foreground">Spec JSON</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Provide one declarative Lightweight Charts spec. Color fields can use semantic theme
              tokens and theme chart palettes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!editable}
              onClick={() => {
                onDraftPropsChange({
                  ...draftProps,
                  specJson: "",
                });
              }}
            >
              Clear local spec
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!editable}
              onClick={() => {
                onDraftPropsChange({
                  ...draftProps,
                  specJson: starterSpecJson,
                });
              }}
            >
              Use starter example
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Supported theme syntax includes <code>$theme.primary</code>,{" "}
          <code>{'{ "$themeToken": "warning", "alpha": 0.18 }'}</code>,{" "}
          <code>$palette.categorical.0</code>, and{" "}
          <code>{'{ "$paletteScale": "sequential.primary", "index": 4, "steps": 7 }'}</code>.
        </div>

        <Textarea
          value={normalizeSpecJsonDraftValue(draftProps.specJson)}
          readOnly={!editable}
          spellCheck={false}
          className="min-h-[320px] font-mono text-xs leading-6"
          placeholder={starterSpecJson}
          onChange={(event) => {
            onDraftPropsChange({
              ...draftProps,
              specJson: event.target.value,
            });
          }}
        />
      </section>

    </div>
  );
}
