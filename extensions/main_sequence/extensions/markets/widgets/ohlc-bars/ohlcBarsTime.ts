import { TickMarkType, type Time } from "lightweight-charts";

export type OhlcTimeAxisMode = "date" | "datetime";

function createDateTimeFormatter(
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
) {
  try {
    return new Intl.DateTimeFormat(locale || undefined, options);
  } catch {
    return new Intl.DateTimeFormat(undefined, options);
  }
}

export function resolveOhlcChartTimeMs(time: Time) {
  if (typeof time === "number") {
    return time * 1000;
  }

  if (typeof time === "string") {
    const parsed = Date.parse(time);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return Date.UTC(time.year, time.month - 1, time.day);
}

export function formatOhlcUtcDateKey(timestampMs: number) {
  return new Date(timestampMs).toISOString().slice(0, 10);
}

export function formatOhlcAxisTickLabel(args: {
  locale?: string;
  tickMarkType: TickMarkType;
  time: Time;
  timeAxisMode: OhlcTimeAxisMode;
}) {
  const { locale, tickMarkType, time, timeAxisMode } = args;
  const timestampMs = resolveOhlcChartTimeMs(time);

  if (timestampMs === null) {
    return String(time);
  }

  if (timeAxisMode === "date") {
    return formatOhlcUtcDateKey(timestampMs);
  }

  switch (tickMarkType) {
    case TickMarkType.Year:
      return createDateTimeFormatter(locale, {
        year: "numeric",
      }).format(new Date(timestampMs));
    case TickMarkType.Month:
      return createDateTimeFormatter(locale, {
        month: "short",
        year: "numeric",
      }).format(new Date(timestampMs));
    case TickMarkType.DayOfMonth:
      return createDateTimeFormatter(locale, {
        day: "numeric",
        month: "short",
      }).format(new Date(timestampMs));
    case TickMarkType.TimeWithSeconds:
      return createDateTimeFormatter(locale, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(timestampMs));
    case TickMarkType.Time:
    default:
      return createDateTimeFormatter(locale, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(timestampMs));
  }
}

export function formatOhlcCrosshairTimeLabel(args: {
  includeSeconds?: boolean;
  locale?: string;
  time: Time;
  timeAxisMode: OhlcTimeAxisMode;
}) {
  const { includeSeconds, locale, time, timeAxisMode } = args;
  const timestampMs = resolveOhlcChartTimeMs(time);

  if (timestampMs === null) {
    return String(time);
  }

  if (timeAxisMode === "date") {
    return formatOhlcUtcDateKey(timestampMs);
  }

  return createDateTimeFormatter(locale, {
    dateStyle: "medium",
    timeStyle: includeSeconds ? "medium" : "short",
  }).format(new Date(timestampMs));
}
