import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  widgetTightFormDescriptionClass,
  widgetTightFormFieldClass,
  widgetTightFormInputClass,
  widgetTightFormLabelClass,
  widgetTightFormSectionClass,
  widgetTightFormTitleClass,
} from "@/widgets/shared/form-density";
import type { TabularMergeKeyMapping } from "@/widgets/shared/incremental-tabular-consumer";
import { WidgetSettingFieldLabel } from "@/widgets/shared/widget-setting-help";

export interface TabularMergeMappingEditorProps {
  addButtonLabel?: string;
  description: string;
  editable: boolean;
  emptyDescription: string;
  help: string;
  idBase: string;
  liveFieldLabel?: string;
  liveFieldOptions: string[];
  mappings: TabularMergeKeyMapping[];
  onChange: (mappings: TabularMergeKeyMapping[]) => void;
  seedFieldLabel?: string;
  seedFieldOptions: string[];
  showNoSharedFieldSuggestion?: boolean;
  title: string;
}

export function getTabularMergeMappingIssues(input: {
  liveFieldLabel?: string;
  liveFieldOptions: string[];
  mappings: TabularMergeKeyMapping[];
  seedFieldLabel?: string;
  seedFieldOptions: string[];
}) {
  const seedFieldOptionSet = new Set(input.seedFieldOptions);
  const liveFieldOptionSet = new Set(input.liveFieldOptions);
  const seedFieldLabel = input.seedFieldLabel ?? "Seed field";
  const liveFieldLabel = input.liveFieldLabel ?? "Live field";

  return input.mappings.flatMap((mapping, index) => {
    const seedField = typeof mapping.seedField === "string" ? mapping.seedField.trim() : "";
    const liveField = typeof mapping.liveField === "string" ? mapping.liveField.trim() : "";
    const issues: string[] = [];

    if ((seedField && !liveField) || (!seedField && liveField)) {
      issues.push(`Mapping ${index + 1} needs both a ${seedFieldLabel.toLowerCase()} and a ${liveFieldLabel.toLowerCase()}.`);
    }

    if (seedField && input.seedFieldOptions.length > 0 && !seedFieldOptionSet.has(seedField)) {
      issues.push(`${seedFieldLabel} "${seedField}" is not present in the current input.`);
    }

    if (liveField && input.liveFieldOptions.length > 0 && !liveFieldOptionSet.has(liveField)) {
      issues.push(`${liveFieldLabel} "${liveField}" is not present in the current input.`);
    }

    return issues;
  });
}

export function shouldSuggestTabularMergeMapping(input: {
  liveFieldOptions: string[];
  mappings: TabularMergeKeyMapping[];
  seedFieldOptions: string[];
}) {
  const liveFieldOptionSet = new Set(input.liveFieldOptions);

  return (
    input.mappings.length === 0 &&
    input.seedFieldOptions.length > 0 &&
    input.liveFieldOptions.length > 0 &&
    input.seedFieldOptions.every((field) => !liveFieldOptionSet.has(field))
  );
}

export function TabularMergeMappingEditor({
  addButtonLabel = "Add mapping",
  description,
  editable,
  emptyDescription,
  help,
  idBase,
  liveFieldLabel = "Live field",
  liveFieldOptions,
  mappings,
  onChange,
  seedFieldLabel = "Seed field",
  seedFieldOptions,
  showNoSharedFieldSuggestion = true,
  title,
}: TabularMergeMappingEditorProps) {
  const issues = getTabularMergeMappingIssues({
    liveFieldLabel,
    liveFieldOptions,
    mappings,
    seedFieldLabel,
    seedFieldOptions,
  });
  const shouldSuggestMapping =
    showNoSharedFieldSuggestion &&
    shouldSuggestTabularMergeMapping({
      liveFieldOptions,
      mappings,
      seedFieldOptions,
    });

  return (
    <section className={widgetTightFormSectionClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={widgetTightFormTitleClass}>{title}</div>
          <p className={widgetTightFormDescriptionClass}>{description}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!editable}
          onClick={() => {
            onChange([...mappings, { seedField: "", liveField: "" }]);
          }}
        >
          {addButtonLabel}
        </Button>
      </div>

      <div className="space-y-3">
        {mappings.length > 0 ? (
          <div className="space-y-2">
            {mappings.map((mapping, index) => (
              <div
                key={`merge-mapping-${index}`}
                className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
              >
                <div className={widgetTightFormFieldClass}>
                  <WidgetSettingFieldLabel className={widgetTightFormLabelClass} help={help}>
                    {seedFieldLabel}
                  </WidgetSettingFieldLabel>
                  <Input
                    className={widgetTightFormInputClass}
                    value={mapping.seedField}
                    placeholder="symbol"
                    list={`${idBase}-seed-fields`}
                    disabled={!editable}
                    onChange={(event) => {
                      const nextMappings = [...mappings];
                      nextMappings[index] = {
                        ...mapping,
                        seedField: event.target.value,
                      };
                      onChange(nextMappings);
                    }}
                  />
                </div>
                <div className={widgetTightFormFieldClass}>
                  <WidgetSettingFieldLabel className={widgetTightFormLabelClass} help={help}>
                    {liveFieldLabel}
                  </WidgetSettingFieldLabel>
                  <Input
                    className={widgetTightFormInputClass}
                    value={mapping.liveField}
                    placeholder="symbol"
                    list={`${idBase}-live-fields`}
                    disabled={!editable}
                    onChange={(event) => {
                      const nextMappings = [...mappings];
                      nextMappings[index] = {
                        ...mapping,
                        liveField: event.target.value,
                      };
                      onChange(nextMappings);
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!editable}
                  onClick={() => {
                    onChange(mappings.filter((_entry, mappingIndex) => mappingIndex !== index));
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className={widgetTightFormDescriptionClass}>{emptyDescription}</p>
        )}

        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/20 px-3 py-2 text-xs leading-5 text-muted-foreground">
          <div>
            Example: to update rows by symbol, add one mapping with {seedFieldLabel.toLowerCase()}{" "}
            <span className="font-mono text-foreground">symbol</span> and {liveFieldLabel.toLowerCase()}{" "}
            <span className="font-mono text-foreground">symbol</span>.
          </div>
          <div>
            To update by symbol and exchange, add two mappings:{" "}
            <span className="font-mono text-foreground">symbol {"->"} symbol</span> and{" "}
            <span className="font-mono text-foreground">exchange {"->"} exchange</span>.
          </div>
          <div>
            If the live feed uses different names, map the retained field to the incoming field,
            for example <span className="font-mono text-foreground">symbol {"->"} ticker</span>.
          </div>
        </div>

        {issues.length > 0 ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            {issues.map((issue) => (
              <div key={issue}>{issue}</div>
            ))}
          </div>
        ) : null}
        {shouldSuggestMapping ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            The two inputs do not expose shared field names. Add a merge mapping before expecting
            incoming rows to patch retained rows.
          </div>
        ) : null}

        <datalist id={`${idBase}-seed-fields`}>
          {seedFieldOptions.map((field) => (
            <option key={field} value={field} />
          ))}
        </datalist>
        <datalist id={`${idBase}-live-fields`}>
          {liveFieldOptions.map((field) => (
            <option key={field} value={field} />
          ))}
        </datalist>
      </div>
    </section>
  );
}
