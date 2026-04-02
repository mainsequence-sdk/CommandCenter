import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
  type ComponentType,
} from "react";

import { Copy, Settings2, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  resolveWidgetHeaderVisibility,
  resolveWidgetTransparentSurface,
} from "@/widgets/shared/chrome";
import { WidgetSchemaForm } from "@/widgets/shared/widget-schema-form";
import {
  resolveDefaultWidgetPresentation,
  resolveWidgetInstancePresentation,
  useResolvedWidgetControllerContext,
} from "@/widgets/shared/widget-schema";
import type {
  WidgetDefinition,
  WidgetInstancePresentation,
  WidgetSettingsComponentProps,
} from "@/widgets/types";

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
        "flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-[6px] border-none bg-transparent text-muted-foreground transition-colors hover:bg-muted/45 hover:text-topbar-foreground",
        className,
      )}
      {...props}
    >
      <Settings2 className="h-3.25 w-3.25" />
    </button>
  );
}

export function WidgetDuplicateTrigger({
  className,
  widgetTitle,
  ...props
}: {
  widgetTitle: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={`Duplicate ${widgetTitle}`}
      title={`Duplicate ${widgetTitle}`}
      className={cn(
        "flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-[6px] border-none bg-transparent text-muted-foreground transition-colors hover:bg-muted/45 hover:text-topbar-foreground",
        className,
      )}
      {...props}
    >
      <Copy className="h-3.25 w-3.25" />
    </button>
  );
}

interface WidgetSettingsPanelProps<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  editable?: boolean;
  closeOnSave?: boolean;
  draftPresentation?: WidgetInstancePresentation;
  draftProps?: TProps;
  draftTitle?: string;
  footerActions?: ReactNode;
  instance: {
    id: string;
    title?: string;
    props?: TProps;
    presentation?: WidgetInstancePresentation;
  };
  onClose: () => void;
  onDraftPresentationChange?: (presentation: WidgetInstancePresentation) => void;
  onDraftPropsChange?: (props: TProps) => void;
  onDraftTitleChange?: (title: string) => void;
  onRemove?: (() => void) | undefined;
  onSave?: (next: {
    title?: string;
    props: TProps;
    presentation: WidgetInstancePresentation;
  }) => void;
  panelDescription?: string;
  panelTitle?: string;
  persistenceNote?: string;
  secondaryActionLabel?: string;
  widget: WidgetDefinition<TProps>;
}

export function WidgetSettingsPanel<
  TProps extends Record<string, unknown> = Record<string, unknown>,
>({
  editable = true,
  closeOnSave = false,
  draftPresentation,
  draftProps,
  draftTitle,
  footerActions,
  instance,
  onClose,
  onDraftPresentationChange,
  onDraftPropsChange,
  onDraftTitleChange,
  onRemove,
  onSave,
  panelDescription = "Adjust the display title and widget props for this instance.",
  panelTitle,
  persistenceNote,
  secondaryActionLabel,
  widget,
}: WidgetSettingsPanelProps<TProps>) {
  const resolvedPanelTitle = panelTitle ?? `${instance.title ?? widget.title} Settings`;
  const resolvedInitialProps = useMemo(
    () => cloneWidgetProps((instance.props ?? widget.exampleProps ?? {}) as TProps),
    [instance.props, widget.exampleProps],
  );
  const initialTitle = instance.title ?? "";
  const resolvedInitialPresentation = useMemo(
    () => resolveWidgetInstancePresentation(widget, instance.presentation),
    [instance.presentation, widget],
  );
  const initialPropsJson = useMemo(
    () => serializeWidgetProps(resolvedInitialProps),
    [resolvedInitialProps],
  );
  const initialProps = useMemo(() => JSON.parse(initialPropsJson) as TProps, [initialPropsJson]);
  const initialPresentationJson = useMemo(
    () => JSON.stringify(resolvedInitialPresentation),
    [resolvedInitialPresentation],
  );
  const initialPresentation = useMemo(
    () => JSON.parse(initialPresentationJson) as WidgetInstancePresentation,
    [initialPresentationJson],
  );
  const [internalInstanceTitle, setInternalInstanceTitle] = useState(initialTitle);
  const [internalDraftProps, setInternalDraftProps] = useState<TProps>(initialProps);
  const [internalDraftPresentation, setInternalDraftPresentation] = useState<WidgetInstancePresentation>(
    initialPresentation,
  );
  const controlledTitle = typeof draftTitle === "string";
  const controlledProps = draftProps !== undefined;
  const controlledPresentation = draftPresentation !== undefined;
  const instanceTitle = controlledTitle ? draftTitle : internalInstanceTitle;
  const resolvedDraftProps = controlledProps ? draftProps : internalDraftProps;
  const resolvedDraftPresentation = controlledPresentation
    ? draftPresentation
    : internalDraftPresentation;
  const [rawPropsValue, setRawPropsValue] = useState(() => serializeWidgetProps(resolvedDraftProps));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const SettingsComponent =
    widget.settingsComponent as
      | ComponentType<WidgetSettingsComponentProps<TProps>>
      | undefined;
  const showRawPropsEditor = widget.showRawPropsEditor !== false;
  const showHeader = resolveWidgetHeaderVisibility(resolvedDraftProps);
  const transparentSurface = resolveWidgetTransparentSurface(resolvedDraftPresentation);
  const sidebarOnly = resolvedDraftPresentation.placementMode === "sidebar";
  const controllerContext = useResolvedWidgetControllerContext(widget, {
    props: resolvedDraftProps,
    instanceId: instance.id,
    mode: "settings",
  });

  useEffect(() => {
    if (!controlledTitle) {
      setInternalInstanceTitle(initialTitle);
    }

    if (!controlledProps) {
      setInternalDraftProps(initialProps);
    }

    if (!controlledPresentation) {
      setInternalDraftPresentation(initialPresentation);
    }

    setRawPropsValue(initialPropsJson);
    setJsonError(null);
  }, [
    controlledPresentation,
    controlledProps,
    controlledTitle,
    initialPresentation,
    initialProps,
    initialPropsJson,
    initialTitle,
    instance.id,
  ]);

  useEffect(() => {
    setRawPropsValue(serializeWidgetProps(resolvedDraftProps));
  }, [resolvedDraftProps]);

  const dirty =
    instanceTitle !== initialTitle ||
    serializeWidgetProps(resolvedDraftProps) !== initialPropsJson ||
    JSON.stringify(resolvedDraftPresentation) !== initialPresentationJson;

  function handleDraftPropsChange(nextProps: TProps) {
    const cloned = cloneWidgetProps(nextProps);
    if (controlledProps) {
      onDraftPropsChange?.(cloned);
    } else {
      setInternalDraftProps(cloned);
    }

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
      if (controlledProps) {
        onDraftPropsChange?.(parsed.props);
      } else {
        setInternalDraftProps(parsed.props);
      }
    }

    setJsonError(null);
  }

  function handleReset() {
    const nextProps = cloneWidgetProps((widget.exampleProps ?? {}) as TProps);
    const nextPresentation = resolveDefaultWidgetPresentation(widget);
    if (controlledTitle) {
      onDraftTitleChange?.("");
    } else {
      setInternalInstanceTitle("");
    }

    if (controlledProps) {
      onDraftPropsChange?.(nextProps);
    } else {
      setInternalDraftProps(nextProps);
    }

    if (controlledPresentation) {
      onDraftPresentationChange?.(nextPresentation);
    } else {
      setInternalDraftPresentation(nextPresentation);
    }

    setRawPropsValue(serializeWidgetProps(nextProps));
    setJsonError(null);
  }

  function handleShowHeaderChange(nextValue: boolean) {
    handleDraftPropsChange({
      ...resolvedDraftProps,
      showHeader: nextValue,
    } as TProps);
  }

  function handleSurfaceModeChange(nextValue: "default" | "transparent") {
    const nextPresentation = {
      ...resolvedDraftPresentation,
      surfaceMode: nextValue,
    };

    if (controlledPresentation) {
      onDraftPresentationChange?.(nextPresentation);
    } else {
      setInternalDraftPresentation(nextPresentation);
    }
  }

  function handlePlacementModeChange(nextValue: "canvas" | "sidebar") {
    const nextPresentation = {
      ...resolvedDraftPresentation,
      placementMode: nextValue,
    };

    if (controlledPresentation) {
      onDraftPresentationChange?.(nextPresentation);
    } else {
      setInternalDraftPresentation(nextPresentation);
    }
  }

  function handleSave() {
    const parsed = showRawPropsEditor
      ? parseWidgetProps<TProps>(rawPropsValue)
      : {
          error: null,
          props: cloneWidgetProps(resolvedDraftProps),
        };

    if (parsed.error || !parsed.props) {
      setJsonError(parsed.error ?? "Invalid JSON.");
      return;
    }

    onSave?.({
      title: instanceTitle.trim() ? instanceTitle.trim() : undefined,
      props: parsed.props,
      presentation: resolvedDraftPresentation,
    });

    if (closeOnSave) {
      onClose();
    }
  }

  function handleRemove() {
    onRemove?.();
    onClose();
  }

  return (
    <section className="overflow-hidden rounded-[calc(var(--radius)+4px)] border border-border/70 bg-card/88 shadow-[var(--shadow-panel)] backdrop-blur">
      <div className="border-b border-border/70 px-5 py-5 md:px-6 md:py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="text-xl font-semibold tracking-tight text-foreground">
              {resolvedPanelTitle}
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">{panelDescription}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{widget.kind}</Badge>
            <Badge variant="neutral">{widget.source}</Badge>
            <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {widget.category}
            </span>
          </div>
        </div>
      </div>
      <div className="space-y-6 px-5 py-5 md:px-6 md:py-6">
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
              if (controlledTitle) {
                onDraftTitleChange?.(event.target.value);
              } else {
                setInternalInstanceTitle(event.target.value);
              }
            }}
            placeholder={widget.title}
            readOnly={!editable}
          />
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="space-y-3">
            <div>
              <div className="text-sm font-medium text-topbar-foreground">Header</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Control whether the widget header is visible during normal viewing. Workspace edit
                mode always shows it.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={showHeader ? "default" : "outline"}
                onClick={() => {
                  handleShowHeaderChange(true);
                }}
                disabled={!editable}
              >
                Show header
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!showHeader ? "default" : "outline"}
                onClick={() => {
                  handleShowHeaderChange(false);
                }}
                disabled={!editable}
              >
                Hide header
              </Button>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <div className="text-sm font-medium text-topbar-foreground">Placement</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose whether this widget renders on the canvas or stays mounted only in the
                widget rail.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={!sidebarOnly ? "default" : "outline"}
                onClick={() => {
                  handlePlacementModeChange("canvas");
                }}
                disabled={!editable}
              >
                Canvas
              </Button>
              <Button
                type="button"
                size="sm"
                variant={sidebarOnly ? "default" : "outline"}
                onClick={() => {
                  handlePlacementModeChange("sidebar");
                }}
                disabled={!editable}
              >
                Sidebar only
              </Button>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <div className="text-sm font-medium text-topbar-foreground">Surface</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Control whether this widget renders as a normal card or a flatter transparent
                surface.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={!transparentSurface ? "default" : "outline"}
                onClick={() => {
                  handleSurfaceModeChange("default");
                }}
                disabled={!editable}
              >
                Card
              </Button>
              <Button
                type="button"
                size="sm"
                variant={transparentSurface ? "default" : "outline"}
                onClick={() => {
                  handleSurfaceModeChange("transparent");
                }}
                disabled={!editable}
              >
                Transparent
              </Button>
            </div>
          </section>
        </div>

        {widget.schema ? (
          <WidgetSchemaForm
            widget={widget}
            draftProps={resolvedDraftProps}
            onDraftPropsChange={handleDraftPropsChange}
            draftPresentation={resolvedDraftPresentation}
            onDraftPresentationChange={(nextPresentation) => {
              if (controlledPresentation) {
                onDraftPresentationChange?.(nextPresentation);
              } else {
                setInternalDraftPresentation(nextPresentation);
              }
            }}
            editable={editable}
            context={controllerContext}
          />
        ) : null}

        {SettingsComponent ? (
          <SettingsComponent
            widget={widget}
            instanceId={instance.id}
            draftProps={resolvedDraftProps}
            onDraftPropsChange={handleDraftPropsChange}
            draftPresentation={resolvedDraftPresentation}
            onDraftPresentationChange={(nextPresentation) => {
              if (controlledPresentation) {
                onDraftPresentationChange?.(nextPresentation);
              } else {
                setInternalDraftPresentation(nextPresentation);
              }
            }}
            controllerContext={controllerContext}
            instanceTitle={instanceTitle}
            onInstanceTitleChange={(nextTitle) => {
              if (controlledTitle) {
                onDraftTitleChange?.(nextTitle);
              } else {
                setInternalInstanceTitle(nextTitle);
              }
            }}
            editable={editable}
          />
        ) : null}

        {showRawPropsEditor ? (
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
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              onClick={handleReset}
              disabled={!editable}
            >
              Reset to defaults
            </Button>
            {editable && onRemove ? (
              <Button variant="danger" onClick={handleRemove}>
                <Trash2 className="h-3.5 w-3.5" />
                Remove widget
              </Button>
            ) : null}
            {footerActions}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              {secondaryActionLabel ?? (editable ? "Cancel" : "Close")}
            </Button>
            {editable ? (
              <Button onClick={handleSave} disabled={Boolean(jsonError) || !dirty}>
                Save settings
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
