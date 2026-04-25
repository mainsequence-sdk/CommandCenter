import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
  type ComponentType,
} from "react";

import { Copy, Loader2, Settings2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isWorkspaceRowWidgetId } from "@/dashboards/structural-widgets";
import {
  WidgetPreviewModeBoundary,
  resolveWidgetMockProps,
  resolveWidgetMockResolvedInputs,
  resolveWidgetMockRuntimeState,
  resolveWidgetMockTitle,
} from "@/features/widgets/widget-explorer";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  resolveWidgetHeaderVisibility,
  resolveWidgetTransparentSurface,
} from "@/widgets/shared/chrome";
import { WidgetErrorBoundary } from "@/widgets/shared/widget-error-boundary";
import { WidgetFrame } from "@/widgets/shared/widget-frame";
import { WidgetSchemaForm } from "@/widgets/shared/widget-schema-form";
import {
  resolveDefaultWidgetPresentation,
  resolveWidgetInstancePresentation,
  useResolvedWidgetControllerContext,
} from "@/widgets/shared/widget-schema";
import type {
  ResolvedWidgetInputs,
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

function resolveWidgetMockPresentation<TProps extends Record<string, unknown>>(
  widget: WidgetDefinition<TProps>,
  basePresentation: WidgetInstancePresentation,
) {
  return cloneWidgetProps({
    ...basePresentation,
    ...(widget.mockPresentation ?? {}),
  });
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

function WidgetSettingsLoadingState() {
  return (
    <section className="space-y-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-topbar-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Loading widget configuration
      </div>
      <p className="text-sm text-muted-foreground">
        Preparing schema fields, controller context, and widget-specific settings.
      </p>
      <div className="space-y-3">
        <Skeleton className="h-10 rounded-[calc(var(--radius)-8px)]" />
        <Skeleton className="h-28 rounded-[calc(var(--radius)-8px)]" />
        <Skeleton className="h-24 rounded-[calc(var(--radius)-8px)]" />
      </div>
    </section>
  );
}

function WidgetSettingsMetaField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-baseline sm:gap-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="min-w-0 break-words text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function WidgetSettingsSelectField({
  description,
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  description: string;
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  options: Array<{
    label: string;
    value: string;
  }>;
  value: string;
}) {
  return (
    <section className="space-y-3">
      <div>
        <div className="text-sm font-medium text-topbar-foreground">{label}</div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Select
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        disabled={disabled}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </section>
  );
}

function WidgetPanelPreview<
  TProps extends Record<string, unknown> = Record<string, unknown>,
>({
  demoMode,
  hasDemoPreview,
  instanceId,
  instanceTitle,
  onDemoModeChange,
  onRuntimeStateChange,
  previewResolvedInputs,
  previewRuntimeState,
  presentation,
  props,
  widget,
}: {
  demoMode: boolean;
  hasDemoPreview: boolean;
  instanceId: string;
  instanceTitle: string;
  onDemoModeChange: (nextValue: boolean) => void;
  onRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
  previewResolvedInputs?: ResolvedWidgetInputs;
  previewRuntimeState?: Record<string, unknown>;
  presentation: WidgetInstancePresentation;
  props: TProps;
  widget: WidgetDefinition<TProps>;
}) {
  const previewShellWidget = widget as unknown as WidgetDefinition<Record<string, unknown>>;
  const PreviewComponent = widget.component;
  const showHeader = resolveWidgetHeaderVisibility(props);

  return (
    <WidgetErrorBoundary
      widgetId={widget.id}
      widgetTitle={instanceTitle}
      instanceId={instanceId}
      surface="settings"
    >
      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-topbar-foreground">Panel preview</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Live preview of the widget panel with the current draft settings.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/70 px-3 py-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border bg-transparent accent-primary"
              checked={demoMode}
              disabled={!hasDemoPreview}
              onChange={(event) => {
                onDemoModeChange(event.target.checked);
              }}
            />
            <span className="font-medium">Demo data for preview</span>
          </label>
        </div>
        {demoMode ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-primary/35 bg-primary/8 px-3 py-2 text-sm text-muted-foreground">
            Editing demo configuration only. The real widget settings are unchanged until demo mode
            is turned off.
          </div>
        ) : null}
        <WidgetPreviewModeBoundary
          fallback={<Skeleton className="h-[420px] rounded-[var(--radius)]" />}
        >
          <div className="h-[420px] min-h-0">
            <div className="h-full min-h-0">
              <WidgetFrame
                widget={previewShellWidget}
                instance={{
                  title: instanceTitle,
                  props,
                }}
                presentation={presentation}
                showDragHandle={false}
                showExplorerTrigger={false}
                showHeader={showHeader}
                showHeaderMeta={false}
                style={{ height: "100%" }}
              >
                <PreviewComponent
                  widget={widget}
                  instanceId={instanceId}
                  instanceTitle={instanceTitle}
                  props={props}
                  presentation={presentation}
                  runtimeState={previewRuntimeState}
                  resolvedInputs={previewResolvedInputs}
                  onRuntimeStateChange={onRuntimeStateChange}
                />
              </WidgetFrame>
            </div>
          </div>
        </WidgetPreviewModeBoundary>
      </section>
    </WidgetErrorBoundary>
  );
}

function WidgetSettingsAdvancedSections<
  TProps extends Record<string, unknown> = Record<string, unknown>,
>({
  controlledPresentation,
  controlledTitle,
  editable,
  instance,
  instanceTitle,
  onDraftPresentationChange,
  onDraftPropsChange,
  onDraftTitleChange,
  previewMode,
  resolvedInputs,
  resolvedDraftPresentation,
  resolvedDraftProps,
  widget,
}: {
  controlledPresentation: boolean;
  controlledTitle: boolean;
  editable: boolean;
  instance: {
    id: string;
  };
  instanceTitle: string;
  onDraftPresentationChange?: (presentation: WidgetInstancePresentation) => void;
  onDraftPropsChange: (props: TProps) => void;
  onDraftTitleChange?: (title: string) => void;
  previewMode?: boolean;
  resolvedInputs?: ResolvedWidgetInputs;
  resolvedDraftPresentation: WidgetInstancePresentation;
  resolvedDraftProps: TProps;
  widget: WidgetDefinition<TProps>;
}) {
  const SettingsComponent =
    widget.settingsComponent as
      | ComponentType<WidgetSettingsComponentProps<TProps>>
      | undefined;
  const controllerContext = useResolvedWidgetControllerContext(widget, {
    props: resolvedDraftProps,
    instanceId: instance.id,
    mode: previewMode ? "preview" : "settings",
    resolvedInputs,
  });

  const content = (
    <>
      {widget.schema ? (
        <WidgetSchemaForm
          widget={widget}
          draftProps={resolvedDraftProps}
          onDraftPropsChange={onDraftPropsChange}
          draftPresentation={resolvedDraftPresentation}
          onDraftPresentationChange={(nextPresentation) => {
            onDraftPresentationChange?.(nextPresentation);
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
          onDraftPropsChange={onDraftPropsChange}
          draftPresentation={resolvedDraftPresentation}
          onDraftPresentationChange={(nextPresentation) => {
            onDraftPresentationChange?.(nextPresentation);
          }}
          resolvedInputs={resolvedInputs}
          controllerContext={controllerContext}
          instanceTitle={instanceTitle}
          onInstanceTitleChange={(nextTitle) => {
            onDraftTitleChange?.(nextTitle);
          }}
          editable={editable}
        />
      ) : null}
    </>
  );

  return (
    <WidgetErrorBoundary
      widgetId={widget.id}
      widgetTitle={instanceTitle}
      instanceId={instance.id}
      surface="settings"
    >
      {previewMode ? (
        <WidgetPreviewModeBoundary fallback={<WidgetSettingsLoadingState />}>
          {content}
        </WidgetPreviewModeBoundary>
      ) : (
        content
      )}
    </WidgetErrorBoundary>
  );
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
  const hasDemoPreview =
    widget.mockProps !== undefined ||
    widget.exampleProps !== undefined ||
    widget.mockTitle !== undefined ||
    widget.mockPresentation !== undefined ||
    widget.mockResolvedInputs !== undefined ||
    widget.mockRuntimeState !== undefined;
  const mockTitle = useMemo(() => resolveWidgetMockTitle(widget), [widget]);
  const mockPropsJson = useMemo(
    () => serializeWidgetProps(resolveWidgetMockProps(widget)),
    [widget],
  );
  const mockProps = useMemo(() => JSON.parse(mockPropsJson) as TProps, [mockPropsJson]);
  const mockPresentationJson = useMemo(
    () => JSON.stringify(resolveWidgetMockPresentation(widget, resolvedInitialPresentation)),
    [resolvedInitialPresentation, widget],
  );
  const mockPresentation = useMemo(
    () => JSON.parse(mockPresentationJson) as WidgetInstancePresentation,
    [mockPresentationJson],
  );
  const mockResolvedInputsJson = useMemo(
    () => JSON.stringify(resolveWidgetMockResolvedInputs(widget)),
    [widget],
  );
  const mockResolvedInputs = useMemo(
    () => JSON.parse(mockResolvedInputsJson) as ResolvedWidgetInputs,
    [mockResolvedInputsJson],
  );
  const mockRuntimeStateJson = useMemo(
    () => JSON.stringify(resolveWidgetMockRuntimeState(widget)),
    [widget],
  );
  const mockRuntimeState = useMemo(
    () =>
      mockRuntimeStateJson
        ? (JSON.parse(mockRuntimeStateJson) as Record<string, unknown>)
        : undefined,
    [mockRuntimeStateJson],
  );
  const [internalInstanceTitle, setInternalInstanceTitle] = useState(initialTitle);
  const [internalDraftProps, setInternalDraftProps] = useState<TProps>(initialProps);
  const [internalDraftPresentation, setInternalDraftPresentation] = useState<WidgetInstancePresentation>(
    initialPresentation,
  );
  const [useDemoData, setUseDemoData] = useState(hasDemoPreview);
  const [demoDraftTitle, setDemoDraftTitle] = useState(mockTitle);
  const [demoDraftProps, setDemoDraftProps] = useState<TProps>(mockProps);
  const [demoDraftPresentation, setDemoDraftPresentation] = useState<WidgetInstancePresentation>(
    mockPresentation,
  );
  const [demoDraftRuntimeState, setDemoDraftRuntimeState] = useState<
    Record<string, unknown> | undefined
  >(mockRuntimeState);
  const controlledTitle = typeof draftTitle === "string";
  const controlledProps = draftProps !== undefined;
  const controlledPresentation = draftPresentation !== undefined;
  const instanceTitle = controlledTitle ? draftTitle : internalInstanceTitle;
  const resolvedDraftProps = controlledProps ? draftProps : internalDraftProps;
  const resolvedDraftPresentation = controlledPresentation
    ? draftPresentation
    : internalDraftPresentation;
  const demoModeActive = useDemoData && hasDemoPreview;
  const activeInstanceTitle = demoModeActive ? demoDraftTitle : instanceTitle;
  const activeDraftProps = demoModeActive ? demoDraftProps : resolvedDraftProps;
  const activeDraftPresentation = demoModeActive
    ? demoDraftPresentation
    : resolvedDraftPresentation;
  const fixedPlacementMode = widget.fixedPlacementMode;
  const placementLocked = fixedPlacementMode !== undefined;
  const effectiveActiveDraftPresentation = fixedPlacementMode
    ? {
        ...activeDraftPresentation,
        placementMode: fixedPlacementMode,
      }
    : activeDraftPresentation;
  const activeResolvedInputs = demoModeActive ? mockResolvedInputs : undefined;
  const activePreviewRuntimeState = demoModeActive ? demoDraftRuntimeState : undefined;
  const [rawPropsValue, setRawPropsValue] = useState(() => serializeWidgetProps(activeDraftProps));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const SettingsComponent =
    widget.settingsComponent as
      | ComponentType<WidgetSettingsComponentProps<TProps>>
      | undefined;
  const [heavySectionsReady, setHeavySectionsReady] = useState(false);
  const showRawPropsEditor = widget.showRawPropsEditor !== false;
  const showHeader = resolveWidgetHeaderVisibility(activeDraftProps);
  const transparentSurface = resolveWidgetTransparentSurface(effectiveActiveDraftPresentation);
  const sidebarOnly = effectiveActiveDraftPresentation.placementMode === "sidebar";
  const hasAdvancedSections = Boolean(widget.schema || SettingsComponent);
  const showPanelPreview = !isWorkspaceRowWidgetId(widget.id);

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
    setDemoDraftTitle(mockTitle);
    setDemoDraftProps(mockProps);
    setDemoDraftPresentation(mockPresentation);
    setDemoDraftRuntimeState(mockRuntimeState);
    setUseDemoData(hasDemoPreview);
  }, [
    hasDemoPreview,
    instance.id,
    mockPresentation,
    mockProps,
    mockRuntimeState,
    mockTitle,
    widget.id,
  ]);

  useEffect(() => {
    setRawPropsValue(serializeWidgetProps(activeDraftProps));
  }, [activeDraftProps]);

  useEffect(() => {
    setHeavySectionsReady(false);

    const frameId =
      typeof window !== "undefined"
        ? window.requestAnimationFrame(() => {
            setHeavySectionsReady(true);
          })
        : null;
    const timeoutId =
      frameId == null
        ? setTimeout(() => {
            setHeavySectionsReady(true);
          }, 0)
        : null;

    return () => {
      if (frameId != null && typeof window !== "undefined") {
        window.cancelAnimationFrame(frameId);
      }

      if (timeoutId != null) {
        clearTimeout(timeoutId);
      }
    };
  }, [instance.id, widget.id]);

  const dirty =
    instanceTitle !== initialTitle ||
    serializeWidgetProps(resolvedDraftProps) !== initialPropsJson ||
    JSON.stringify(resolvedDraftPresentation) !== initialPresentationJson;

  function handleRealDraftPropsChange(nextProps: TProps) {
    const cloned = cloneWidgetProps(nextProps);
    if (controlledProps) {
      onDraftPropsChange?.(cloned);
    } else {
      setInternalDraftProps(cloned);
    }

    setRawPropsValue(serializeWidgetProps(cloned));
    setJsonError(null);
  }

  function handleDemoDraftPropsChange(nextProps: TProps) {
    const cloned = cloneWidgetProps(nextProps);
    setDemoDraftProps(cloned);
    setRawPropsValue(serializeWidgetProps(cloned));
    setJsonError(null);
  }

  function handleDraftPropsChange(nextProps: TProps) {
    if (demoModeActive) {
      handleDemoDraftPropsChange(nextProps);
      return;
    }

    handleRealDraftPropsChange(nextProps);
  }

  function handleRawPropsChange(value: string) {
    setRawPropsValue(value);

    const parsed = parseWidgetProps<TProps>(value);

    if (parsed.error) {
      setJsonError(parsed.error);
      return;
    }

    if (parsed.props) {
      if (demoModeActive) {
        setDemoDraftProps(parsed.props);
      } else if (controlledProps) {
        onDraftPropsChange?.(parsed.props);
      } else {
        setInternalDraftProps(parsed.props);
      }
    }

    setJsonError(null);
  }

  function handleReset() {
    if (demoModeActive) {
      setDemoDraftTitle(mockTitle);
      setDemoDraftProps(mockProps);
      setDemoDraftPresentation(mockPresentation);
      setDemoDraftRuntimeState(mockRuntimeState);
      setRawPropsValue(serializeWidgetProps(mockProps));
      setJsonError(null);
      return;
    }

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
      ...activeDraftProps,
      showHeader: nextValue,
    } as TProps);
  }

  function handleSurfaceModeChange(nextValue: "default" | "transparent") {
    const nextPresentation = {
      ...effectiveActiveDraftPresentation,
      surfaceMode: nextValue,
    };

    if (demoModeActive) {
      setDemoDraftPresentation(nextPresentation);
    } else if (controlledPresentation) {
      onDraftPresentationChange?.(nextPresentation);
    } else {
      setInternalDraftPresentation(nextPresentation);
    }
  }

  function handlePlacementModeChange(nextValue: "canvas" | "sidebar") {
    if (placementLocked) {
      return;
    }

    const nextPresentation = {
      ...effectiveActiveDraftPresentation,
      placementMode: nextValue,
    };

    if (demoModeActive) {
      setDemoDraftPresentation(nextPresentation);
    } else if (controlledPresentation) {
      onDraftPresentationChange?.(nextPresentation);
    } else {
      setInternalDraftPresentation(nextPresentation);
    }
  }

  function handleSave() {
    if (demoModeActive) {
      return;
    }

    const parsed = showRawPropsEditor
      ? parseWidgetProps<TProps>(rawPropsValue)
      : {
          error: null,
          props: cloneWidgetProps(activeDraftProps),
        };

    if (parsed.error || !parsed.props) {
      setJsonError(parsed.error ?? "Invalid JSON.");
      return;
    }

    onSave?.({
      title: activeInstanceTitle.trim() ? activeInstanceTitle.trim() : undefined,
      props: parsed.props,
      presentation: effectiveActiveDraftPresentation,
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
          <div className="grid min-w-[220px] gap-2">
            <WidgetSettingsMetaField label="Widget kind" value={widget.kind} />
            <WidgetSettingsMetaField label="Widget source" value={widget.source} />
            <WidgetSettingsMetaField label="Widget category" value={widget.category} />
          </div>
        </div>
      </div>
      <div className="space-y-6 px-5 py-5 md:px-6 md:py-6">
        {persistenceNote ? (
          <div className="rounded-[calc(var(--radius)-2px)] border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {persistenceNote}
          </div>
        ) : null}

        {showPanelPreview ? (
          <WidgetPanelPreview
            demoMode={demoModeActive}
            hasDemoPreview={hasDemoPreview}
            instanceId={instance.id}
            instanceTitle={activeInstanceTitle.trim() || (demoModeActive ? mockTitle : widget.title)}
            onDemoModeChange={setUseDemoData}
            onRuntimeStateChange={demoModeActive ? setDemoDraftRuntimeState : undefined}
            previewResolvedInputs={activeResolvedInputs}
            previewRuntimeState={activePreviewRuntimeState}
            props={activeDraftProps}
            presentation={effectiveActiveDraftPresentation}
            widget={widget}
          />
        ) : null}

        <section className="space-y-3">
          <div>
            <div className="text-sm font-medium text-topbar-foreground">Display title</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Leave blank to fall back to the widget default title.
            </p>
          </div>
          <Input
            value={activeInstanceTitle}
            onChange={(event) => {
              if (demoModeActive) {
                setDemoDraftTitle(event.target.value);
              } else if (controlledTitle) {
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
          <WidgetSettingsSelectField
            label="Header"
            description="Control whether the widget header is visible during normal viewing. Workspace edit mode always shows it."
            value={showHeader ? "visible" : "hidden"}
            onChange={(nextValue) => {
              handleShowHeaderChange(nextValue === "visible");
            }}
            disabled={!editable}
            options={[
              { value: "visible", label: "Header: Visible" },
              { value: "hidden", label: "Header: Hidden" },
            ]}
          />

          <WidgetSettingsSelectField
            label="Placement"
            description={
              placementLocked
                ? "This widget is defined as sidebar-only and stays mounted in the widget rail."
                : "Choose whether this widget renders on the canvas or stays mounted only in the widget rail."
            }
            value={sidebarOnly ? "sidebar" : "canvas"}
            onChange={(nextValue) => {
              handlePlacementModeChange(nextValue === "sidebar" ? "sidebar" : "canvas");
            }}
            disabled={!editable || placementLocked}
            options={[
              { value: "canvas", label: "Placement: Canvas" },
              { value: "sidebar", label: "Placement: Sidebar only" },
            ]}
          />

          <WidgetSettingsSelectField
            label="Surface"
            description="Control whether this widget renders as a normal card or a flatter transparent surface."
            value={transparentSurface ? "transparent" : "default"}
            onChange={(nextValue) => {
              handleSurfaceModeChange(nextValue === "transparent" ? "transparent" : "default");
            }}
            disabled={!editable}
            options={[
              { value: "default", label: "Surface: Card" },
              { value: "transparent", label: "Surface: Transparent" },
            ]}
          />
        </div>

        {hasAdvancedSections ? (
          heavySectionsReady ? (
            <WidgetSettingsAdvancedSections
              controlledPresentation={controlledPresentation}
              controlledTitle={controlledTitle}
              editable={editable}
              instance={instance}
              instanceTitle={activeInstanceTitle}
              onDraftPresentationChange={(nextPresentation) => {
                const resolvedNextPresentation = fixedPlacementMode
                  ? {
                      ...nextPresentation,
                      placementMode: fixedPlacementMode,
                    }
                  : nextPresentation;

                if (demoModeActive) {
                  setDemoDraftPresentation(resolvedNextPresentation);
                } else if (controlledPresentation) {
                  onDraftPresentationChange?.(resolvedNextPresentation);
                } else {
                  setInternalDraftPresentation(resolvedNextPresentation);
                }
              }}
              onDraftPropsChange={handleDraftPropsChange}
              onDraftTitleChange={(nextTitle) => {
                if (demoModeActive) {
                  setDemoDraftTitle(nextTitle);
                } else if (controlledTitle) {
                  onDraftTitleChange?.(nextTitle);
                } else {
                  setInternalInstanceTitle(nextTitle);
                }
              }}
              previewMode={demoModeActive}
              resolvedInputs={activeResolvedInputs}
              resolvedDraftPresentation={effectiveActiveDraftPresentation}
              resolvedDraftProps={activeDraftProps}
              widget={widget}
            />
          ) : (
            <WidgetSettingsLoadingState />
          )
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
            {demoModeActive ? (
              <div className="text-sm text-muted-foreground">
                Demo mode is isolated. Turn it off to save real widget changes.
              </div>
            ) : null}
            <Button variant="outline" onClick={onClose}>
              {secondaryActionLabel ?? (editable ? "Cancel" : "Close")}
            </Button>
            {editable ? (
              <Button onClick={handleSave} disabled={demoModeActive || Boolean(jsonError) || !dirty}>
                Save settings
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
