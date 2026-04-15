import { Code2, LineChart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useResolvedWidgetOrganizationConfiguration } from "@/widgets/WidgetOrganizationConfigurationProvider";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import {
  EChartsSpecWidget,
  starterOptionBuilderSource,
  starterOptionJson,
  type EChartsSpecWidgetProps,
} from "./EChartsSpecWidget";

function normalizeOptionJsonDraftValue(value: unknown) {
  if (typeof value === "string") {
    return value.trim() || starterOptionJson;
  }

  if (value === undefined) {
    return starterOptionJson;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return starterOptionJson;
  }
}

export function EChartsSpecWidgetSettings({
  widget,
  draftProps,
  editable,
  onDraftPropsChange,
  resolvedInputs,
}: WidgetSettingsComponentProps<EChartsSpecWidgetProps>) {
  const organizationConfiguration = useResolvedWidgetOrganizationConfiguration(widget);
  const effectiveMode = organizationConfiguration.resolvedConfig &&
    typeof organizationConfiguration.resolvedConfig.capabilityMode === "string"
      ? organizationConfiguration.resolvedConfig.capabilityMode
      : "safe-json";
  const allowUnsafeJavaScript = effectiveMode === "unsafe-custom-js";
  const previewProps: EChartsSpecWidgetProps = {
    sourceMode:
      draftProps.sourceMode === "javascript" && allowUnsafeJavaScript
        ? "javascript"
        : "json",
    optionJson: normalizeOptionJsonDraftValue(draftProps.optionJson),
    optionBuilderSource:
      typeof draftProps.optionBuilderSource === "string" && draftProps.optionBuilderSource.trim()
        ? draftProps.optionBuilderSource.trim()
        : starterOptionBuilderSource,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="primary">ECharts</Badge>
        <Badge variant="neutral">Spec-driven</Badge>
        <Badge variant="neutral">Org configuration capable</Badge>
      </div>

      <div className="text-sm text-muted-foreground">
        This widget renders an ECharts option payload from widget props. It can also consume one
        bound JSON props payload from another widget and resolve organization-scoped defaults and
        capability ceilings before the option is rendered.
      </div>

      <section className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/30 px-4 py-3">
        <div className="text-sm font-medium text-topbar-foreground">Effective organization mode</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border/70 bg-card/70 px-2.5 py-1">
            {effectiveMode}
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
          JSON mode is always available. Unsafe JavaScript mode is only available when the effective
          organization capability is <strong>unsafe-custom-js</strong>.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          JSON color fields can use semantic theme tokens such as <code>$theme.primary</code> or{" "}
          <code>{'{ "$themeToken": "warning", "alpha": 0.18 }'}</code>.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Theme chart palettes are also available through <code>$palette.categorical.0</code> and{" "}
          <code>{'{ "$paletteScale": "sequential.primary", "index": 4, "steps": 7 }'}</code>.
        </p>
      </section>

      <section className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/30 px-4 py-3">
        <div className="text-sm font-medium text-topbar-foreground">Binding support</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Bind one <code>core.value.json@v1</code> payload into the <strong>Props JSON</strong>{" "}
          input when an AppComponent or another upstream widget should publish the ECharts widget
          props dynamically. The bound JSON object is merged over the saved local props, and it can
          provide the chart option either as <code>optionJson</code> or directly as{" "}
          <code>option</code>.
        </p>
        {resolvedInputs?.["props-json"] ? (
          <div className="mt-3 text-xs text-muted-foreground">
            A Props JSON binding is currently configured for this instance.
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div>
          <div className="text-sm font-medium text-topbar-foreground">Source mode</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose whether the widget renders a parsed JSON option or executes a local JavaScript
            builder.
          </p>
        </div>

        <Select
          value={
            draftProps.sourceMode === "javascript" && allowUnsafeJavaScript
              ? "javascript"
              : "json"
          }
          disabled={!editable}
          onChange={(event) => {
            const nextMode = event.target.value === "javascript" && allowUnsafeJavaScript
              ? "javascript"
              : "json";

            onDraftPropsChange({
              ...draftProps,
              sourceMode: nextMode,
            });
          }}
        >
          <option value="json">JSON option</option>
          <option value="javascript" disabled={!allowUnsafeJavaScript}>
            JavaScript builder
          </option>
        </Select>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-topbar-foreground">
              {previewProps.sourceMode === "javascript" ? "JavaScript builder" : "Option JSON"}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {previewProps.sourceMode === "javascript"
                ? "Provide a JavaScript function body that returns one ECharts option object."
                : "Provide a JSON object that ECharts can consume directly. Functions are not parsed from JSON, but color fields can reference semantic theme tokens and theme chart palettes."}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!editable}
            onClick={() => {
              onDraftPropsChange({
                ...draftProps,
                sourceMode: previewProps.sourceMode,
                optionJson:
                  previewProps.sourceMode === "javascript"
                    ? draftProps.optionJson
                    : starterOptionJson,
                optionBuilderSource:
                  previewProps.sourceMode === "javascript"
                    ? starterOptionBuilderSource
                    : draftProps.optionBuilderSource,
              });
            }}
          >
            Use starter example
          </Button>
        </div>

        {previewProps.sourceMode === "json" ? (
          <div className="text-xs text-muted-foreground">
            The default starter is a palette-driven animated bar chart inspired by the ECharts
            `bar-animation-delay` example, but kept JSON-safe so it works in `safe-json` mode.
          </div>
        ) : null}

        <Textarea
          value={
            previewProps.sourceMode === "javascript"
              ? (typeof draftProps.optionBuilderSource === "string" ? draftProps.optionBuilderSource : "")
              : normalizeOptionJsonDraftValue(draftProps.optionJson)
          }
          readOnly={!editable}
          spellCheck={false}
          className="min-h-[260px] font-mono text-xs leading-6"
          placeholder={
            previewProps.sourceMode === "javascript"
              ? "return { title: { text: \"Desk chart\" }, ... };"
              : "{\n  \"title\": { \"text\": \"Desk chart\" },\n  \"series\": [{ \"itemStyle\": { \"color\": \"$theme.primary\" } }]\n}"
          }
          onChange={(event) => {
            if (previewProps.sourceMode === "javascript") {
              onDraftPropsChange({
                ...draftProps,
                optionBuilderSource: event.target.value,
              });
              return;
            }

            onDraftPropsChange({
              ...draftProps,
              optionJson: event.target.value,
            });
          }}
        />
      </section>

      <section className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/30 px-4 py-3">
        <div className="text-sm font-medium text-topbar-foreground">Trusted snippet ids</div>
        <p className="mt-1 text-sm text-muted-foreground">
          In <strong>trusted-snippets</strong> mode, the widget supports these custom JSON keys:
          `tooltip.formatterSnippetId`, `xAxis[].axisLabel.formatterSnippetId`,
          `yAxis[].axisLabel.formatterSnippetId`, and `series[].label.formatterSnippetId`.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border/70 bg-card/70 px-2.5 py-1">
            tooltip.series-value-v1
          </span>
          <span className="rounded-full border border-border/70 bg-card/70 px-2.5 py-1">
            tooltip.axis-shared-v1
          </span>
          <span className="rounded-full border border-border/70 bg-card/70 px-2.5 py-1">
            axis.compact-number-v1
          </span>
          <span className="rounded-full border border-border/70 bg-card/70 px-2.5 py-1">
            axis.percent-v1
          </span>
          <span className="rounded-full border border-border/70 bg-card/70 px-2.5 py-1">
            series.value-v1
          </span>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <div className="text-sm font-medium text-topbar-foreground">Preview</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Preview renders through the same widget component and org-capability path as the canvas
            widget.
          </p>
        </div>

        <div className="overflow-hidden rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/24">
          <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {previewProps.sourceMode === "javascript" ? (
              <Code2 className="h-3.5 w-3.5" />
            ) : (
              <LineChart className="h-3.5 w-3.5" />
            )}
            Preview
          </div>
          <div className="h-[320px] p-3">
            <EChartsSpecWidget widget={widget} props={previewProps} resolvedInputs={resolvedInputs} />
          </div>
        </div>
      </section>
    </div>
  );
}
