import { useMemo } from "react";

import { Link2, Link2Off } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  resolveWidgetFieldState,
  updateWidgetFieldExposure,
  useVisibleWidgetSchemaFields,
} from "@/widgets/shared/widget-schema";
import { WidgetSettingFieldLabel } from "@/widgets/shared/widget-setting-help";
import type {
  WidgetDefinition,
  WidgetInstancePresentation,
  WidgetSettingsSchema,
} from "@/widgets/types";

function resolveSectionFields<TProps extends Record<string, unknown>, TContext>(
  schema: WidgetSettingsSchema<TProps, TContext>,
  sectionId: string,
  visibleFieldIds: Set<string>,
) {
  return schema.fields.filter((field) => field.sectionId === sectionId && visibleFieldIds.has(field.id));
}

export function WidgetSchemaForm<
  TProps extends Record<string, unknown> = Record<string, unknown>,
  TContext = unknown,
>({
  widget,
  draftProps,
  draftPresentation,
  onDraftPropsChange,
  onDraftPresentationChange,
  editable,
  context,
}: {
  widget: WidgetDefinition<TProps>;
  draftProps: TProps;
  draftPresentation: WidgetInstancePresentation;
  onDraftPropsChange: (props: TProps) => void;
  onDraftPresentationChange: (presentation: WidgetInstancePresentation) => void;
  editable: boolean;
  context: TContext;
}) {
  const schema = widget.schema as WidgetSettingsSchema<TProps, TContext> | undefined;
  const visibleFields = useVisibleWidgetSchemaFields(widget, draftProps, editable, context);
  const visibleFieldIds = useMemo(
    () => new Set(visibleFields.map((field) => field.id)),
    [visibleFields],
  );

  if (!schema || visibleFields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-5">
      {schema.sections.map((section) => {
        const sectionFields = resolveSectionFields(schema, section.id, visibleFieldIds);

        if (sectionFields.length === 0) {
          return null;
        }

        return (
          <section
            key={section.id}
            className="space-y-4 rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/24 p-4"
          >
            <div className="space-y-1">
              <div className="text-sm font-medium text-topbar-foreground">{section.title}</div>
              {section.description ? (
                <p className="text-sm text-muted-foreground">{section.description}</p>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {sectionFields.map((field, index) => {
                const SettingsRenderer = field.renderSettings;

                if (!SettingsRenderer) {
                  return null;
                }

                const fieldState = resolveWidgetFieldState(draftPresentation, field, index);
                const canPop = field.pop?.canPop === true;

                return (
                  <div
                    key={field.id}
                    className={cn(
                      "space-y-2 border-border/40 pt-4 first:border-t-0 first:pt-0",
                      field.settingsColumnSpan === 1 ? "border-t md:col-span-1" : "border-t md:col-span-2",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <WidgetSettingFieldLabel
                        className="text-sm font-medium text-foreground"
                        help={field.description}
                      >
                        {field.label}
                      </WidgetSettingFieldLabel>

                      {canPop ? (
                        <Button
                          type="button"
                          size="sm"
                          variant={fieldState.visible ? "default" : "outline"}
                          disabled={!editable}
                          className="shrink-0"
                          onClick={() => {
                            onDraftPresentationChange(
                              updateWidgetFieldExposure(
                                draftPresentation,
                                field,
                                !fieldState.visible,
                                index,
                              ),
                            );
                          }}
                        >
                          {fieldState.visible ? (
                            <Link2 className="h-3.5 w-3.5" />
                          ) : (
                            <Link2Off className="h-3.5 w-3.5" />
                          )}
                          {fieldState.visible ? "Shown on canvas" : "Show on canvas"}
                        </Button>
                      ) : null}
                    </div>

                    <div className={cn("min-h-0")}>
                      <SettingsRenderer
                        field={field}
                        widget={widget}
                        draftProps={draftProps}
                        onDraftPropsChange={onDraftPropsChange}
                        draftPresentation={draftPresentation}
                        onDraftPresentationChange={onDraftPresentationChange}
                        editable={editable}
                        context={context}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
