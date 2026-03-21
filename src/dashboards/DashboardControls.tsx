import {
  createContext,
  type RefObject,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  Link2,
  Maximize2,
  Minimize2,
  RefreshCw,
} from "lucide-react";
import { useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  DashboardActionsConfig,
  DashboardControlsConfig,
  DashboardControlsState,
  DashboardRefreshConfig,
  DashboardTimeRangeConfig,
  DashboardTimeRangeKey,
} from "@/dashboards/types";
import { cn } from "@/lib/utils";
import { useShellStore } from "@/stores/shell-store";

interface DashboardTimeRangeOption {
  key: DashboardTimeRangeKey;
  label: string;
  durationMs: number;
}

interface ResolvedDashboardControlsConfig {
  enabled: boolean;
  timeRange: {
    enabled: boolean;
    defaultRange: DashboardTimeRangeKey;
    options: DashboardTimeRangeKey[];
    initialState: {
      key: DashboardTimeRangeKey | "custom";
      startMs: number;
      endMs: number;
      startDate: string;
      endDate: string;
    };
  };
  refresh: {
    enabled: boolean;
    defaultIntervalMs: number | null;
    intervals: Array<number | null>;
    initialIntervalMs: number | null;
  };
  actions: {
    enabled: boolean;
    share: boolean;
    view: boolean;
  };
}

interface DashboardControlsContextValue {
  timeRange: DashboardTimeRangeOption;
  timeRangeKey: DashboardTimeRangeKey | "custom";
  timeRangeLabel: string;
  rangeStartMs: number;
  rangeEndMs: number;
  rangeStartDate: string;
  rangeEndDate: string;
  setTimeRangeKey: (value: DashboardTimeRangeKey) => void;
  setCustomRange: (startDate: string, endDate: string) => void;
  refreshIntervalMs: number | null;
  setRefreshIntervalMs: (value: number | null) => void;
  refreshNow: () => Promise<void>;
  isRefreshing: boolean;
  lastRefreshedAt: number | null;
  refreshProgress: number;
  kioskMode: boolean;
  setKioskMode: (value: boolean) => void;
  toggleKioskMode: () => void;
}

const defaultTimeRangeOptions: Record<DashboardTimeRangeKey, DashboardTimeRangeOption> = {
  "15m": { key: "15m", label: "Last 15 min", durationMs: 15 * 60 * 1000 },
  "1h": { key: "1h", label: "Last 1 hour", durationMs: 60 * 60 * 1000 },
  "6h": { key: "6h", label: "Last 6 hours", durationMs: 6 * 60 * 60 * 1000 },
  "24h": { key: "24h", label: "Last 24 hours", durationMs: 24 * 60 * 60 * 1000 },
  "7d": { key: "7d", label: "Last 7 days", durationMs: 7 * 24 * 60 * 60 * 1000 },
  "30d": { key: "30d", label: "Last 30 days", durationMs: 30 * 24 * 60 * 60 * 1000 },
  "90d": { key: "90d", label: "Last 90 days", durationMs: 90 * 24 * 60 * 60 * 1000 },
};

const defaultRefreshIntervals: Array<number | null> = [
  null,
  30000,
  60000,
  300000,
  600000,
  3600000,
];
const defaultDashboardControlsContextValue: DashboardControlsContextValue = {
  timeRange: defaultTimeRangeOptions["30d"],
  timeRangeKey: "30d",
  timeRangeLabel: "Mar 1, 2026 - Mar 31, 2026",
  rangeStartMs: Date.now() - 30 * 24 * 60 * 60 * 1000,
  rangeEndMs: Date.now(),
  rangeStartDate: "2026-03-01",
  rangeEndDate: "2026-03-31",
  setTimeRangeKey: () => undefined,
  setCustomRange: () => undefined,
  refreshIntervalMs: null,
  setRefreshIntervalMs: () => undefined,
  refreshNow: async () => undefined,
  isRefreshing: false,
  lastRefreshedAt: null,
  refreshProgress: 0,
  kioskMode: false,
  setKioskMode: () => undefined,
  toggleKioskMode: () => undefined,
};

const DashboardControlsContext = createContext<DashboardControlsContextValue>(
  defaultDashboardControlsContextValue,
);

function normalizeTimeRangeOptions(config?: DashboardTimeRangeConfig) {
  const options = (config?.options ?? Object.keys(defaultTimeRangeOptions)) as DashboardTimeRangeKey[];
  const validOptions = options.filter((value) => value in defaultTimeRangeOptions);

  return validOptions.length ? validOptions : (Object.keys(defaultTimeRangeOptions) as DashboardTimeRangeKey[]);
}

function normalizeRefreshIntervals(config?: DashboardRefreshConfig) {
  const intervals = config?.intervals ?? defaultRefreshIntervals;
  const normalized = Array.from(
    new Set(
      intervals.filter(
        (value): value is number | null => value === null || (typeof value === "number" && value > 0),
      ),
    ),
  );

  return normalized.length ? normalized : defaultRefreshIntervals;
}

function resolveActionsConfig(config?: DashboardActionsConfig) {
  return {
    enabled: config?.enabled !== false,
    share: config?.share !== false,
    view: config?.view !== false,
  };
}

function resolveInitialTimeRangeState(
  config: DashboardTimeRangeConfig | undefined,
  defaultRange: DashboardTimeRangeKey,
  options: DashboardTimeRangeKey[],
) {
  if (
    config?.selectedRange === "custom" &&
    typeof config.customStartMs === "number" &&
    typeof config.customEndMs === "number" &&
    Number.isFinite(config.customStartMs) &&
    Number.isFinite(config.customEndMs) &&
    config.customStartMs <= config.customEndMs
  ) {
    return {
      key: "custom" as const,
      startMs: config.customStartMs,
      endMs: config.customEndMs,
      startDate: toDateInputValue(new Date(config.customStartMs)),
      endDate: toDateInputValue(new Date(config.customEndMs)),
    };
  }

  const selectedRange =
    config?.selectedRange && config.selectedRange !== "custom" && options.includes(config.selectedRange)
      ? config.selectedRange
      : defaultRange;
  const resolvedRange = resolvePresetRange(selectedRange);

  return {
    key: selectedRange,
    startMs: resolvedRange.startMs,
    endMs: resolvedRange.endMs,
    startDate: resolvedRange.startDate,
    endDate: resolvedRange.endDate,
  };
}

function resolveControlsConfig(controls?: DashboardControlsConfig): ResolvedDashboardControlsConfig {
  const timeRangeOptions = normalizeTimeRangeOptions(controls?.timeRange);
  const refreshIntervals = normalizeRefreshIntervals(controls?.refresh);
  const defaultRange = controls?.timeRange?.defaultRange;
  const defaultIntervalMs = controls?.refresh?.defaultIntervalMs ?? null;
  const actions = resolveActionsConfig(controls?.actions);
  const resolvedDefaultRange =
    defaultRange && timeRangeOptions.includes(defaultRange) ? defaultRange : timeRangeOptions[0]!;
  const selectedIntervalMs = controls?.refresh?.selectedIntervalMs;
  const initialIntervalMs =
    selectedIntervalMs === null
      ? null
      : (typeof selectedIntervalMs === "number" && selectedIntervalMs > 0
        ? selectedIntervalMs
        : undefined);

  return {
    enabled: controls?.enabled !== false,
    timeRange: {
      enabled: controls?.timeRange?.enabled !== false,
      defaultRange: resolvedDefaultRange,
      options: timeRangeOptions,
      initialState: resolveInitialTimeRangeState(
        controls?.timeRange,
        resolvedDefaultRange,
        timeRangeOptions,
      ),
    },
    refresh: {
      enabled: controls?.refresh?.enabled !== false,
      defaultIntervalMs:
        defaultIntervalMs === null
          ? (refreshIntervals.includes(null) ? null : refreshIntervals[0]!)
          : (typeof defaultIntervalMs === "number" && defaultIntervalMs > 0
            ? defaultIntervalMs
            : refreshIntervals[0]!),
      intervals: refreshIntervals,
      initialIntervalMs:
        initialIntervalMs !== undefined
          ? initialIntervalMs
          : (defaultIntervalMs === null
            ? (refreshIntervals.includes(null) ? null : refreshIntervals[0]!)
            : (typeof defaultIntervalMs === "number" && defaultIntervalMs > 0
              ? defaultIntervalMs
              : refreshIntervals[0]!)),
    },
    actions,
  };
}

function formatRefreshInterval(value: number | null) {
  if (value === null) {
    return "Off";
  }

  if (value < 120000) {
    return `${Math.round(value / 1000)}s`;
  }

  if (value % 3600000 === 0) {
    return `${Math.round(value / 3600000)}h`;
  }

  return `${Math.round(value / 60000)}m`;
}

function toDateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatRangeLabel(startMs: number, endMs: number) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${formatter.format(new Date(startMs))} - ${formatter.format(new Date(endMs))}`;
}

function getTimeRangeTriggerLabel(
  key: DashboardTimeRangeKey | "custom",
  startMs: number,
  endMs: number,
) {
  if (key === "custom") {
    return formatRangeLabel(startMs, endMs);
  }

  return defaultTimeRangeOptions[key].label;
}

function resolvePresetRange(key: DashboardTimeRangeKey, now = Date.now()) {
  const option = defaultTimeRangeOptions[key];
  const endMs = now;
  const startMs = endMs - option.durationMs;

  return {
    startMs,
    endMs,
    startDate: toDateInputValue(new Date(startMs)),
    endDate: toDateInputValue(new Date(endMs)),
  };
}

function isValidPresetKey(value: string | null): value is DashboardTimeRangeKey {
  return value !== null && value in defaultTimeRangeOptions;
}

function parseRefreshQueryValue(value: string | null, allowedIntervals: Array<number | null>) {
  if (!value) {
    return undefined;
  }

  if (value === "off") {
    return allowedIntervals.includes(null) ? null : undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  const rounded = Math.round(parsed);

  return allowedIntervals.includes(rounded) || rounded > 0 ? rounded : undefined;
}

function isCustomRefreshInterval(value: number | null, intervals: Array<number | null>) {
  return value !== null && !intervals.includes(value);
}

function buildDashboardShareUrl({
  search,
  timeRangeKey,
  rangeStartMs,
  rangeEndMs,
  refreshIntervalMs,
  kioskMode,
}: {
  search: string;
  timeRangeKey: DashboardTimeRangeKey | "custom";
  rangeStartMs: number;
  rangeEndMs: number;
  refreshIntervalMs: number | null;
  kioskMode: boolean;
}) {
  const url = new URL(window.location.href);
  const searchParams = new URLSearchParams(search);

  if (timeRangeKey === "custom") {
    searchParams.delete("range");
    searchParams.set("from", String(rangeStartMs));
    searchParams.set("to", String(rangeEndMs));
  } else {
    searchParams.set("range", timeRangeKey);
    searchParams.delete("from");
    searchParams.delete("to");
  }

  if (refreshIntervalMs === null) {
    searchParams.delete("refresh");
  } else {
    searchParams.set("refresh", String(refreshIntervalMs));
  }

  if (kioskMode) {
    searchParams.set("kiosk", "1");
  } else {
    searchParams.delete("kiosk");
  }

  url.search = searchParams.toString();

  return url.toString();
}

function useMenuDismiss(
  open: boolean,
  refs: Array<RefObject<HTMLElement | null>>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (refs.some((ref) => ref.current?.contains(target))) {
        return;
      }

      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open, refs]);
}

function TimeRangeSelector({
  options,
  value,
  rangeLabel,
  rangeStartDate,
  rangeEndDate,
  onSelect,
  onApplyCustomRange,
}: {
  options: DashboardTimeRangeKey[];
  value: DashboardTimeRangeKey | "custom";
  rangeLabel: string;
  rangeStartDate: string;
  rangeEndDate: string;
  onSelect: (value: DashboardTimeRangeKey) => void;
  onApplyCustomRange: (startDate: string, endDate: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftStartDate, setDraftStartDate] = useState(rangeStartDate);
  const [draftEndDate, setDraftEndDate] = useState(rangeEndDate);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useMenuDismiss(open, [rootRef, menuRef], () => {
    setOpen(false);
  });

  useEffect(() => {
    if (!open) {
      setDraftStartDate(rangeStartDate);
      setDraftEndDate(rangeEndDate);
    }
  }, [open, rangeEndDate, rangeStartDate]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={cn(
          "flex h-8 items-center gap-2 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-card/82 px-2.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted/35",
          open && "border-primary/60 bg-muted/45",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate">{rangeLabel}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          ref={menuRef}
          className="absolute left-0 top-full z-20 mt-2 w-[280px] overflow-hidden rounded-[calc(var(--radius)+2px)] border border-border/80 bg-card/96 p-1.5 shadow-[var(--shadow-panel)] backdrop-blur"
          role="menu"
        >
          <div className="px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Time range
          </div>
          <div className="mt-1 flex flex-col gap-1">
            {options.map((option) => {
              const selected = option === value;

              return (
                <button
                  key={option}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[calc(var(--radius)-6px)] px-3 py-2 text-left text-sm transition-colors hover:bg-muted/45",
                    selected && "bg-primary/12 text-topbar-foreground",
                  )}
                  onClick={() => {
                    onSelect(option);
                    setOpen(false);
                  }}
                >
                  <span className="flex h-4 w-4 items-center justify-center text-primary">
                    {selected ? <Check className="h-4 w-4" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{defaultTimeRangeOptions[option].label}</span>
                </button>
              );
            })}
          </div>

          <div className="mx-2 my-2 h-px bg-border/70" />

          <div className="space-y-3 px-2 pb-2 pt-1">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Custom dates
            </div>
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  From
                </label>
                <Input
                  type="date"
                  value={draftStartDate}
                  max={draftEndDate}
                  className="h-9"
                  onChange={(event) => {
                    setDraftStartDate(event.target.value);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  To
                </label>
                <Input
                  type="date"
                  value={draftEndDate}
                  min={draftStartDate}
                  className="h-9"
                  onChange={(event) => {
                    setDraftEndDate(event.target.value);
                  }}
                />
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={() => {
                onApplyCustomRange(draftStartDate, draftEndDate);
                setOpen(false);
              }}
            >
              Apply range
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RefreshSelector({
  intervals,
  value,
  onRefresh,
  onSelectInterval,
  isRefreshing,
}: {
  intervals: Array<number | null>;
  value: number | null;
  onRefresh: () => void;
  onSelectInterval: (value: number | null) => void;
  isRefreshing: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [customSeconds, setCustomSeconds] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const customSelected = isCustomRefreshInterval(value, intervals);

  useEffect(() => {
    if (!customSelected || value === null) {
      return;
    }

    setCustomSeconds(String(Math.max(1, Math.round(value / 1000))));
  }, [customSelected, value]);

  useMenuDismiss(open, [rootRef, menuRef], () => {
    setOpen(false);
  });

  function applyCustomInterval() {
    const parsedSeconds = Number(customSeconds);

    if (!Number.isFinite(parsedSeconds) || parsedSeconds <= 0) {
      return;
    }

    setOpen(false);
    onSelectInterval(Math.round(parsedSeconds * 1000));
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="flex h-8 overflow-hidden rounded-[calc(var(--radius)-8px)] border border-border/70 bg-card/82 shadow-sm">
        <button
          type="button"
          className="flex items-center gap-2 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/35"
          onClick={onRefresh}
        >
          <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isRefreshing && "animate-spin")} />
          <span>Refresh</span>
          {value !== null ? (
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {formatRefreshInterval(value)}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          className={cn(
            "flex w-8 items-center justify-center border-l border-border/70 text-muted-foreground transition-colors hover:bg-muted/35",
            open && "bg-muted/45 text-foreground",
          )}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => {
            setOpen((current) => !current);
          }}
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open ? (
        <div
          ref={menuRef}
          className="absolute right-0 top-full z-20 mt-2 w-[220px] overflow-hidden rounded-[calc(var(--radius)+2px)] border border-border/80 bg-card/96 p-1.5 shadow-[var(--shadow-panel)] backdrop-blur"
          role="menu"
        >
          <div className="px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Auto refresh
          </div>
          <div className="mt-1 flex flex-col gap-1">
            {intervals.map((interval) => {
              const selected = interval === value;

              return (
                <button
                  key={interval ?? "off"}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[calc(var(--radius)-6px)] px-3 py-2 text-left text-sm transition-colors hover:bg-muted/45",
                    selected && "bg-primary/12 text-topbar-foreground",
                  )}
                  onClick={() => {
                    setOpen(false);
                    onSelectInterval(interval);
                  }}
                >
                  <span className="flex h-4 w-4 items-center justify-center text-primary">
                    {selected ? <Check className="h-4 w-4" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{formatRefreshInterval(interval)}</span>
                </button>
              );
            })}
          </div>
          <form
            className="mt-2 border-t border-border/70 px-2 pt-2"
            onSubmit={(event) => {
              event.preventDefault();
              applyCustomInterval();
            }}
          >
            <div className="flex items-center justify-between gap-3 pb-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <span>Custom seconds</span>
              {customSelected && value !== null ? <span>{formatRefreshInterval(value)}</span> : null}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                placeholder="Seconds"
                value={customSeconds}
                className="h-8"
                onChange={(event) => {
                  setCustomSeconds(event.target.value);
                }}
              />
              <Button type="submit" size="sm" className="h-8 px-3">
                Apply
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function ShareDashboardButton({
  search,
  timeRangeKey,
  rangeStartMs,
  rangeEndMs,
  refreshIntervalMs,
  kioskMode,
}: {
  search: string;
  timeRangeKey: DashboardTimeRangeKey | "custom";
  rangeStartMs: number;
  rangeEndMs: number;
  refreshIntervalMs: number | null;
  kioskMode: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function handleCopyLink() {
    const link = buildDashboardShareUrl({
      search,
      timeRangeKey,
      rangeStartMs,
      rangeEndMs,
      refreshIntervalMs,
      kioskMode,
    });

    await navigator.clipboard.writeText(link);
    setCopied(true);

    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false);
    }, 1800);
  }

  return (
    <button
      type="button"
      className="flex h-8 items-center gap-2 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-card/82 px-2.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted/35"
      onClick={() => {
        void handleCopyLink();
      }}
    >
      <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
      <span>{copied ? "Copied" : "Share"}</span>
    </button>
  );
}

function DashboardViewMenu({
  search,
  timeRangeKey,
  rangeStartMs,
  rangeEndMs,
  refreshIntervalMs,
}: {
  search: string;
  timeRangeKey: DashboardTimeRangeKey | "custom";
  rangeStartMs: number;
  rangeEndMs: number;
  refreshIntervalMs: number | null;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const kioskMode = useShellStore((state) => state.kioskMode);
  const toggleKioskMode = useShellStore((state) => state.toggleKioskMode);

  useMenuDismiss(open, [rootRef, menuRef], () => {
    setOpen(false);
  });

  function openDashboardInNewTab(includeKiosk: boolean) {
    const link = buildDashboardShareUrl({
      search,
      timeRangeKey,
      rangeStartMs,
      rangeEndMs,
      refreshIntervalMs,
      kioskMode: includeKiosk,
    });

    window.open(link, "_blank", "noopener,noreferrer");
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={cn(
          "flex h-8 items-center gap-2 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-card/82 px-2.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted/35",
          open && "border-primary/60 bg-muted/45",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        {kioskMode ? (
          <Minimize2 className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span>View</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          ref={menuRef}
          className="absolute right-0 top-full z-20 mt-2 w-[208px] overflow-hidden rounded-[calc(var(--radius)+2px)] border border-border/80 bg-card/96 p-1.5 shadow-[var(--shadow-panel)] backdrop-blur"
          role="menu"
        >
          <div className="px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Display
          </div>
          <div className="mt-1 flex flex-col gap-1">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-[calc(var(--radius)-6px)] px-3 py-2 text-left text-sm transition-colors hover:bg-muted/45"
              onClick={() => {
                toggleKioskMode();
                setOpen(false);
              }}
            >
              <span className="flex h-4 w-4 items-center justify-center text-muted-foreground">
                {kioskMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {kioskMode ? "Exit kiosk mode" : "Enter kiosk mode"}
              </span>
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-[calc(var(--radius)-6px)] px-3 py-2 text-left text-sm transition-colors hover:bg-muted/45"
              onClick={() => {
                openDashboardInNewTab(kioskMode);
                setOpen(false);
              }}
            >
              <span className="flex h-4 w-4 items-center justify-center text-muted-foreground">
                <ExternalLink className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate">Open in new tab</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DashboardControlsProvider({
  children,
  controls,
  onStateChange,
}: {
  children: ReactNode;
  controls?: DashboardControlsConfig;
  onStateChange?: (state: DashboardControlsState) => void;
}) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const refreshLockRef = useRef(false);
  const resolvedConfig = useMemo(() => resolveControlsConfig(controls), [controls]);
  const kioskMode = useShellStore((state) => state.kioskMode);
  const setKioskMode = useShellStore((state) => state.setKioskMode);
  const toggleKioskMode = useShellStore((state) => state.toggleKioskMode);
  const [timeRangeKey, setTimeRangeKeyState] = useState<DashboardTimeRangeKey | "custom">(
    resolvedConfig.timeRange.initialState.key,
  );
  const [rangeStartMs, setRangeStartMs] = useState<number>(
    resolvedConfig.timeRange.initialState.startMs,
  );
  const [rangeEndMs, setRangeEndMs] = useState<number>(
    resolvedConfig.timeRange.initialState.endMs,
  );
  const [rangeStartDate, setRangeStartDate] = useState<string>(
    resolvedConfig.timeRange.initialState.startDate,
  );
  const [rangeEndDate, setRangeEndDate] = useState<string>(
    resolvedConfig.timeRange.initialState.endDate,
  );
  const [refreshIntervalMs, setRefreshIntervalMs] = useState<number | null>(
    resolvedConfig.refresh.initialIntervalMs,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [refreshCycleStartedAt, setRefreshCycleStartedAt] = useState<number | null>(null);
  const [refreshProgress, setRefreshProgress] = useState(0);

  useEffect(() => {
    if (timeRangeKey !== "custom" && !resolvedConfig.timeRange.options.includes(timeRangeKey)) {
      const resolvedRange = resolvePresetRange(resolvedConfig.timeRange.defaultRange);
      setTimeRangeKeyState(resolvedConfig.timeRange.defaultRange);
      setRangeStartMs(resolvedRange.startMs);
      setRangeEndMs(resolvedRange.endMs);
      setRangeStartDate(resolvedRange.startDate);
      setRangeEndDate(resolvedRange.endDate);
    }
  }, [resolvedConfig.timeRange.defaultRange, resolvedConfig.timeRange.options, timeRangeKey]);

  useEffect(() => {
    if (
      refreshIntervalMs !== null &&
      typeof refreshIntervalMs === "number" &&
      refreshIntervalMs > 0
    ) {
      return;
    }

    if (!resolvedConfig.refresh.intervals.includes(refreshIntervalMs)) {
      setRefreshIntervalMs(resolvedConfig.refresh.defaultIntervalMs);
    }
  }, [refreshIntervalMs, resolvedConfig.refresh.defaultIntervalMs, resolvedConfig.refresh.intervals]);

  useEffect(() => {
    onStateChange?.({
      timeRangeKey,
      rangeStartMs,
      rangeEndMs,
      refreshIntervalMs,
    });
  }, [onStateChange, rangeEndMs, rangeStartMs, refreshIntervalMs, timeRangeKey]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const queryRange = searchParams.get("range");
    const queryFrom = searchParams.get("from");
    const queryTo = searchParams.get("to");
    const queryRefresh = searchParams.get("refresh");
    const queryKiosk = searchParams.get("kiosk");

    if (resolvedConfig.timeRange.enabled) {
      if (isValidPresetKey(queryRange) && resolvedConfig.timeRange.options.includes(queryRange)) {
        const resolvedRange = resolvePresetRange(queryRange);

        setTimeRangeKeyState(queryRange);
        setRangeStartMs(resolvedRange.startMs);
        setRangeEndMs(resolvedRange.endMs);
        setRangeStartDate(resolvedRange.startDate);
        setRangeEndDate(resolvedRange.endDate);
      } else if (queryFrom && queryTo) {
        const nextStartMs = Number(queryFrom);
        const nextEndMs = Number(queryTo);

        if (
          Number.isFinite(nextStartMs) &&
          Number.isFinite(nextEndMs) &&
          nextStartMs <= nextEndMs
        ) {
          setTimeRangeKeyState("custom");
          setRangeStartMs(nextStartMs);
          setRangeEndMs(nextEndMs);
          setRangeStartDate(toDateInputValue(new Date(nextStartMs)));
          setRangeEndDate(toDateInputValue(new Date(nextEndMs)));
        }
      }
    }

    if (resolvedConfig.refresh.enabled) {
      const nextRefreshInterval = parseRefreshQueryValue(
        queryRefresh,
        resolvedConfig.refresh.intervals,
      );

      if (nextRefreshInterval !== undefined) {
        setRefreshIntervalMs(nextRefreshInterval);
      }
    }

    if (queryKiosk === "1") {
      setKioskMode(true);
    } else if (queryKiosk === "0") {
      setKioskMode(false);
    }
  }, [
    location.search,
    resolvedConfig.refresh.enabled,
    resolvedConfig.refresh.intervals,
    resolvedConfig.timeRange.enabled,
    resolvedConfig.timeRange.options,
    setKioskMode,
  ]);

  useEffect(() => {
    if (!resolvedConfig.refresh.enabled || refreshIntervalMs === null) {
      setRefreshCycleStartedAt(null);
      setRefreshProgress(0);
      return undefined;
    }

    const cycleStartedAt = Date.now();
    setRefreshCycleStartedAt(cycleStartedAt);
    setRefreshProgress(0);

    const timerId = window.setInterval(() => {
      const nextCycleStartedAt = Date.now();
      setRefreshCycleStartedAt(nextCycleStartedAt);
      setRefreshProgress(0);
      void refreshNow();
    }, refreshIntervalMs);

    return () => {
      window.clearInterval(timerId);
    };
  }, [refreshIntervalMs, resolvedConfig.refresh.enabled]);

  useEffect(() => {
    if (!resolvedConfig.refresh.enabled || refreshIntervalMs === null || refreshCycleStartedAt === null) {
      setRefreshProgress(0);
      return undefined;
    }

    const activeRefreshIntervalMs = refreshIntervalMs;
    const activeRefreshCycleStartedAt = refreshCycleStartedAt;

    function updateRefreshProgress() {
      const elapsed = Date.now() - activeRefreshCycleStartedAt;
      setRefreshProgress(Math.max(0, Math.min(1, elapsed / activeRefreshIntervalMs)));
    }

    updateRefreshProgress();

    const timerId = window.setInterval(updateRefreshProgress, 120);

    return () => {
      window.clearInterval(timerId);
    };
  }, [refreshCycleStartedAt, refreshIntervalMs, resolvedConfig.refresh.enabled]);

  async function refreshNow() {
    if (refreshLockRef.current) {
      return;
    }

    if (resolvedConfig.refresh.enabled && refreshIntervalMs !== null) {
      const cycleStartedAt = Date.now();
      setRefreshCycleStartedAt(cycleStartedAt);
      setRefreshProgress(0);
    }

    refreshLockRef.current = true;
    setIsRefreshing(true);
    setLastRefreshedAt(Date.now());

    try {
      await queryClient.invalidateQueries();
    } finally {
      refreshLockRef.current = false;
      setIsRefreshing(false);
    }
  }

  function setTimeRangeKey(value: DashboardTimeRangeKey) {
    const resolvedRange = resolvePresetRange(value);

    setTimeRangeKeyState(value);
    setRangeStartMs(resolvedRange.startMs);
    setRangeEndMs(resolvedRange.endMs);
    setRangeStartDate(resolvedRange.startDate);
    setRangeEndDate(resolvedRange.endDate);
  }

  function setCustomRange(startDate: string, endDate: string) {
    if (!startDate || !endDate) {
      return;
    }

    const startDateValue = new Date(`${startDate}T00:00:00`);
    const endDateValue = new Date(`${endDate}T23:59:59`);
    const startMs = startDateValue.getTime();
    const endMs = endDateValue.getTime();

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
      return;
    }

    setTimeRangeKeyState("custom");
    setRangeStartMs(startMs);
    setRangeEndMs(endMs);
    setRangeStartDate(startDate);
    setRangeEndDate(endDate);
  }

  const value = useMemo<DashboardControlsContextValue>(
    () => ({
      timeRange:
        defaultTimeRangeOptions[
          timeRangeKey === "custom" ? resolvedConfig.timeRange.defaultRange : timeRangeKey
        ],
      timeRangeKey,
      timeRangeLabel: getTimeRangeTriggerLabel(timeRangeKey, rangeStartMs, rangeEndMs),
      rangeStartMs,
      rangeEndMs,
      rangeStartDate,
      rangeEndDate,
      setTimeRangeKey,
      setCustomRange,
      refreshIntervalMs,
      setRefreshIntervalMs,
      refreshNow,
      isRefreshing,
      lastRefreshedAt,
      refreshProgress,
      kioskMode,
      setKioskMode,
      toggleKioskMode,
    }),
    [
      isRefreshing,
      kioskMode,
      lastRefreshedAt,
      refreshProgress,
      rangeEndDate,
      rangeEndMs,
      rangeStartDate,
      rangeStartMs,
      refreshIntervalMs,
      setKioskMode,
      timeRangeKey,
      toggleKioskMode,
      resolvedConfig.timeRange.defaultRange,
    ],
  );

  return (
    <DashboardControlsContext.Provider value={value}>
      {children}
    </DashboardControlsContext.Provider>
  );
}

export function useDashboardControls() {
  return useContext(DashboardControlsContext);
}

export function DashboardRefreshProgressLine({ className }: { className?: string }) {
  const { refreshIntervalMs, refreshProgress } = useDashboardControls();

  return (
    <div className={cn("pointer-events-none absolute inset-x-0 top-0 z-50 h-px overflow-hidden", className)}>
      <div className="absolute inset-0 bg-border/60" />
      {refreshIntervalMs !== null ? (
        <div
          className="absolute inset-y-0 left-0 origin-left"
          style={{
            width: "100%",
            transform: `scaleX(${refreshProgress})`,
            backgroundImage:
              "linear-gradient(90deg, color-mix(in srgb, var(--primary) 88%, transparent) 0%, color-mix(in srgb, var(--accent) 84%, transparent) 58%, color-mix(in srgb, var(--foreground) 62%, transparent) 100%)",
          }}
        />
      ) : null}
    </div>
  );
}

export function DashboardDataControls({
  controls,
  leftActions,
}: {
  controls?: DashboardControlsConfig;
  leftActions?: ReactNode;
}) {
  const location = useLocation();
  const resolvedConfig = useMemo(() => resolveControlsConfig(controls), [controls]);
  const {
    timeRangeKey,
    timeRangeLabel,
    rangeStartMs,
    rangeEndMs,
    rangeStartDate,
    rangeEndDate,
    setTimeRangeKey,
    setCustomRange,
    refreshIntervalMs,
    setRefreshIntervalMs,
    refreshNow,
    isRefreshing,
    kioskMode,
  } = useDashboardControls();

  if (!resolvedConfig.enabled) {
    return null;
  }

  if (
    !resolvedConfig.timeRange.enabled &&
    !resolvedConfig.refresh.enabled &&
    !resolvedConfig.actions.enabled
  ) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {leftActions ? <div className="flex flex-wrap items-center gap-2">{leftActions}</div> : null}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {resolvedConfig.timeRange.enabled ? (
          <TimeRangeSelector
            options={resolvedConfig.timeRange.options}
            value={timeRangeKey}
            rangeLabel={timeRangeLabel}
            rangeStartDate={rangeStartDate}
            rangeEndDate={rangeEndDate}
            onSelect={setTimeRangeKey}
            onApplyCustomRange={setCustomRange}
          />
        ) : null}
        {resolvedConfig.refresh.enabled ? (
          <RefreshSelector
            intervals={resolvedConfig.refresh.intervals}
            value={refreshIntervalMs}
            onRefresh={() => {
              void refreshNow();
            }}
            onSelectInterval={setRefreshIntervalMs}
            isRefreshing={isRefreshing}
          />
        ) : null}
        {resolvedConfig.actions.enabled && resolvedConfig.actions.share ? (
          <ShareDashboardButton
            search={location.search}
            timeRangeKey={timeRangeKey}
            rangeStartMs={rangeStartMs}
            rangeEndMs={rangeEndMs}
            refreshIntervalMs={refreshIntervalMs}
            kioskMode={kioskMode}
          />
        ) : null}
        {resolvedConfig.actions.enabled && resolvedConfig.actions.view ? (
          <DashboardViewMenu
            search={location.search}
            timeRangeKey={timeRangeKey}
            rangeStartMs={rangeStartMs}
            rangeEndMs={rangeEndMs}
            refreshIntervalMs={refreshIntervalMs}
          />
        ) : null}
      </div>
    </div>
  );
}
