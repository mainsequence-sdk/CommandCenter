import {
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type ComponentType,
} from "react";

import { Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { WidgetDefinition, WidgetSettingsComponentProps } from "@/widgets/types";

function cloneWidgetProps<T extends Record<string, unknown>>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function serializeWidgetProps(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2);
}

function parseWidgetProps<T extends Record<string, unknown>>(value: string) {
  try {
    const parsed = JSON.parse(value || "{}");

    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      return {
        error: "Widget props must be a JSON object.",
        props: null,
      };
    }

    return {
      error: null,
      props: parsed as T,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid JSON.",
      props: null,
    };
  }
}

export function WidgetSettingsTrigger({
  className,
  widgetTitle,
  ...props
}: {
  widgetTitle: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={`Open settings for ${widgetTitle}`}
      title={`Open settings for ${widgetTitle}`}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/35 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-topbar-foreground",
        className,
      )}
      {...props}
    >
      <Settings2 className="h-3.5 w-3.5" />
    </button>
  );
}

interface WidgetSettingsDialogProps<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  editable?: boolean;
  instance: {
    id: string;
    title?: string;
    props?: TProps;
  };
  onClose: () => void;
  onSave?: (next: { title?: string; props: TProps }) => void;
  open: boolean;
  persistenceNote?: string;
  widget: WidgetDefinition<TProps>;
}

export function WidgetSettingsDialog<
  TProps extends Record<string, unknown> = Record<string, unknown>,
>({
  editable = true,
  instance,
  onClose,
  onSave,
  open,
  persistenceNote,
  widget,
}: WidgetSettingsDialogProps<TProps>) {
  const initialProps = useMemo(
    () => cloneWidgetProps((instance.props ?? widget.exampleProps ?? {}) as TProps),
    [instance.props, widget.exampleProps],
  );
  const initialTitle = instance.title ?? "";
  const [instanceTitle, setInstanceTitle] = useState(initialTitle);
  const [draftProps, setDraftProps] = useState<TProps>(initialProps);
  const [rawPropsValue, setRawPropsValue] = useState(() => serializeWidgetProps(initialProps));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const SettingsComponent =
    widget.settingsComponent as
      | ComponentType<WidgetSettingsComponentProps<TProps>>
      | undefined;

  useEffect(() => {
    if (!open) {
      return;
    }

    setInstanceTitle(initialTitle);
    setDraftProps(initialProps);
    setRawPropsValue(serializeWidgetProps(initialProps));
    setJsonError(null);
  }, [initialProps, initialTitle, open, instance.id]);

  const dirty =
    instanceTitle !== initialTitle ||
    serializeWidgetProps(draftProps) !== serializeWidgetProps(initialProps);

  function handleDraftPropsChange(nextProps: TProps) {
    const cloned = cloneWidgetProps(nextProps);
    setDraftProps(cloned);
    setRawPropsValue(serializeWidgetProps(cloned));
    setJsonError(null);
  }

  function handleRawPropsChange(value: string) {
    setRawPropsValue(value);

    const parsed = parseWidgetProps<TProps>(value);

    if (parsed.error) {
      setJsonError(parsed.error);
      return;
    }

    if (parsed.props) {
      setDraftProps(parsed.props);
    }

    setJsonError(null);
  }

  function handleReset() {
    const nextProps = cloneWidgetProps((widget.exampleProps ?? {}) as TProps);
    setInstanceTitle("");
    setDraftProps(nextProps);
    setRawPropsValue(serializeWidgetProps(nextProps));
    setJsonError(null);
  }

  function handleSave() {
    const parsed = parseWidgetProps<TProps>(rawPropsValue);

    if (parsed.error || !parsed.props) {
      setJsonError(parsed.error ?? "Invalid JSON.");
      return;
    }

    onSave?.({
      title: instanceTitle.trim() ? instanceTitle.trim() : undefined,
      props: parsed.props,
    });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${instance.title ?? widget.title} Settings`}
      description="Adjust the display title and widget props for this instance."
      className="max-w-[min(880px,calc(100vw-24px))]"
      contentClassName="px-5 py-5 md:px-6 md:py-6"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">{widget.kind}</Badge>
          <Badge variant="neutral">{widget.source}</Badge>
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {widget.category}
          </span>
        </div>

        {persistenceNote ? (
          <div className="rounded-[calc(var(--radius)-2px)] border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {persistenceNote}
          </div>
        ) : null}

        <section className="space-y-3">
          <div>
            <div className="text-sm font-medium text-topbar-foreground">Display title</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Leave blank to fall back to the widget default title.
            </p>
          </div>
          <Input
            value={instanceTitle}
            onChange={(event) => {
              setInstanceTitle(event.target.value);
            }}
            placeholder={widget.title}
            readOnly={!editable}
          />
        </section>

        {SettingsComponent ? (
          <SettingsComponent
            widget={widget}
            draftProps={draftProps}
            onDraftPropsChange={handleDraftPropsChange}
            instanceTitle={instanceTitle}
            onInstanceTitleChange={setInstanceTitle}
            editable={editable}
          />
        ) : null}

        <section className="space-y-3">
          <div>
            <div className="text-sm font-medium text-topbar-foreground">Props JSON</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Advanced editor for the widget instance props object.
            </p>
          </div>
          <Textarea
            value={rawPropsValue}
            onChange={(event) => {
              handleRawPropsChange(event.target.value);
            }}
            className="min-h-[240px] font-mono text-xs leading-6"
            readOnly={!editable}
            spellCheck={false}
          />
          <p className={cn("text-sm", jsonError ? "text-danger" : "text-muted-foreground")}>
            {jsonError ?? "Props must stay a JSON object."}
          </p>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
          <Button
            variant="ghost"
            onClick={handleReset}
            disabled={!editable}
          >
            Reset to defaults
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              {editable ? "Cancel" : "Close"}
            </Button>
            {editable ? (
              <Button onClick={handleSave} disabled={Boolean(jsonError) || !dirty}>
                Save settings
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
