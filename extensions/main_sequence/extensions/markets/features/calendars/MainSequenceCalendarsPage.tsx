import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";

import {
  fetchCalendarDetail,
  fetchCalendarSummary,
  formatMainSequenceError,
  listCalendarDates,
  listCalendarEvents,
  listCalendars,
  listCalendarSessions,
  mainSequenceRegistryPageSize,
  type CalendarDateRecord,
  type CalendarEventRecord,
  type CalendarListFilters,
  type CalendarRecord,
  type CalendarSessionRecord,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";

type CalendarDetailTab = "details" | "dates" | "sessions" | "events";

const calendarUidParam = "msCalendarUid";
const calendarTabParam = "msCalendarTab";
const calendarStartDateParam = "msCalendarStartDate";
const calendarEndDateParam = "msCalendarEndDate";
const defaultCalendarTab: CalendarDetailTab = "details";

const calendarTabs = [
  { id: "details", label: "Details" },
  { id: "dates", label: "Dates" },
  { id: "sessions", label: "Sessions" },
  { id: "events", label: "Events" },
] as const satisfies readonly { id: CalendarDetailTab; label: string }[];

function readPositiveInt(value: string | null) {
  const parsed = Number(value ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeCalendarUid(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeCalendarTab(value: string | null): CalendarDetailTab {
  return calendarTabs.some((tab) => tab.id === value)
    ? (value as CalendarDetailTab)
    : defaultCalendarTab;
}

function normalizeCalendarDate(value: string | null) {
  const normalized = value?.trim();

  return normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function setOrDeleteParam(nextParams: URLSearchParams, key: string, value: string) {
  if (value.trim()) {
    nextParams.set(key, value);
    return;
  }

  nextParams.delete(key);
}

function formatText(value: string | null | undefined, fallback = "Not available") {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function formatBoolean(value: boolean) {
  return value ? "Yes" : "No";
}

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function formatCalendarTitle(calendar: CalendarRecord) {
  return formatText(
    calendar.display_name,
    formatText(calendar.unique_identifier, `Calendar ${calendar.uid}`),
  );
}

function formatCalendarWindowDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDefaultCalendarWindow() {
  const start = new Date();
  start.setDate(start.getDate() - 360);
  const end = new Date();
  end.setDate(end.getDate() + 360);

  return {
    startDate: formatCalendarWindowDate(start),
    endDate: formatCalendarWindowDate(end),
  };
}

function PaginationActions({
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: {
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" disabled={!canGoBack} onClick={onBack}>
        Previous
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={!canGoForward} onClick={onForward}>
        Next
      </Button>
    </div>
  );
}

function DetailValue({
  label,
  value,
  monospace = false,
}: {
  label: string;
  value: string;
  monospace?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className={monospace ? "font-mono text-sm text-foreground" : "text-sm text-foreground"}>
        {value}
      </div>
    </div>
  );
}

function EmptyRelationshipRows({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function RelationshipShell({
  children,
  controls,
  description,
  isError,
  isLoading,
  title,
}: {
  children: ReactNode;
  controls?: ReactNode;
  description: string;
  isError: boolean;
  isLoading: boolean;
  title: string;
}) {
  return (
    <Card>
      <CardHeader className="border-b border-border/70">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {controls}
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading {title.toLowerCase()}
          </div>
        ) : null}
        {isError ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            Failed to load {title.toLowerCase()}.
          </div>
        ) : null}
        {!isLoading && !isError ? children : null}
      </CardContent>
    </Card>
  );
}

function CalendarDatesTable({
  rows,
}: {
  rows: CalendarDateRecord[];
}) {
  if (rows.length === 0) {
    return <EmptyRelationshipRows message="No calendar dates were returned for this window." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <th className="px-4 pb-2">Date</th>
            <th className="px-4 pb-2">Business</th>
            <th className="px-4 pb-2">Holiday</th>
            <th className="px-4 pb-2">Weekend</th>
            <th className="px-4 pb-2">Early Close</th>
            <th className="px-4 pb-2">Holiday Name</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.uid}>
              <td className={getRegistryTableCellClassName(false, "left")}>{row.local_date}</td>
              <td className={getRegistryTableCellClassName(false)}>{formatBoolean(row.is_business_day)}</td>
              <td className={getRegistryTableCellClassName(false)}>{formatBoolean(row.is_holiday)}</td>
              <td className={getRegistryTableCellClassName(false)}>{formatBoolean(row.is_weekend)}</td>
              <td className={getRegistryTableCellClassName(false)}>{formatBoolean(row.is_early_close)}</td>
              <td className={getRegistryTableCellClassName(false, "right")}>
                {formatText(row.holiday_name)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CalendarSessionsTable({
  rows,
}: {
  rows: CalendarSessionRecord[];
}) {
  if (rows.length === 0) {
    return <EmptyRelationshipRows message="No calendar sessions were returned for this window." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <th className="px-4 pb-2">Date</th>
            <th className="px-4 pb-2">Session</th>
            <th className="px-4 pb-2">Opens</th>
            <th className="px-4 pb-2">Closes</th>
            <th className="px-4 pb-2">Timezone</th>
            <th className="px-4 pb-2">Primary</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.uid}>
              <td className={getRegistryTableCellClassName(false, "left")}>{row.local_date}</td>
              <td className={getRegistryTableCellClassName(false)}>{row.session_label}</td>
              <td className={getRegistryTableCellClassName(false)}>{formatText(row.opens_at)}</td>
              <td className={getRegistryTableCellClassName(false)}>{formatText(row.closes_at)}</td>
              <td className={getRegistryTableCellClassName(false)}>{formatText(row.timezone)}</td>
              <td className={getRegistryTableCellClassName(false, "right")}>
                {formatBoolean(row.is_primary)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CalendarEventsTable({
  rows,
}: {
  rows: CalendarEventRecord[];
}) {
  if (rows.length === 0) {
    return <EmptyRelationshipRows message="No calendar events were returned for this window." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <th className="px-4 pb-2">Date</th>
            <th className="px-4 pb-2">Time</th>
            <th className="px-4 pb-2">Type</th>
            <th className="px-4 pb-2">Label</th>
            <th className="px-4 pb-2">Target</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.uid}>
              <td className={getRegistryTableCellClassName(false, "left")}>
                {formatText(row.event_date)}
              </td>
              <td className={getRegistryTableCellClassName(false)}>{formatText(row.event_time)}</td>
              <td className={getRegistryTableCellClassName(false)}>{row.event_type}</td>
              <td className={getRegistryTableCellClassName(false)}>{row.event_label}</td>
              <td className={getRegistryTableCellClassName(false, "right")}>
                {[
                  row.target_type,
                  row.target_identifier,
                  row.target_uid,
                ]
                  .map((value) => value?.trim())
                  .filter(Boolean)
                  .join(" · ") || "Not available"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CalendarRelationshipDateFilters({
  endDate,
  onChangeEndDate,
  onChangeStartDate,
  onReset,
  startDate,
}: {
  endDate: string;
  onChangeEndDate: (value: string) => void;
  onChangeStartDate: (value: string) => void;
  onReset: () => void;
  startDate: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Start Date
          </span>
          <Input
            type="date"
            value={startDate}
            onChange={(event) => onChangeStartDate(event.target.value)}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            End Date
          </span>
          <Input
            type="date"
            value={endDate}
            onChange={(event) => onChangeEndDate(event.target.value)}
          />
        </label>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onReset}>
        Reset Window
      </Button>
    </div>
  );
}

type CalendarRelationshipName = "dates" | "sessions" | "events";

function readRelationshipUrlCandidate(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  for (const key of ["url", "list_url", "href", "endpoint"]) {
    const candidate = record[key];

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function readCalendarRelationshipUrl(
  summaryPayload: unknown,
  relationshipName: CalendarRelationshipName,
) {
  if (!summaryPayload || typeof summaryPayload !== "object") {
    return null;
  }

  const extensions = (summaryPayload as { extensions?: unknown }).extensions;

  if (!extensions || typeof extensions !== "object") {
    return null;
  }

  const relationships = (extensions as Record<string, unknown>).relationships;

  if (!relationships || typeof relationships !== "object") {
    return null;
  }

  if (Array.isArray(relationships)) {
    for (const relationship of relationships) {
      if (!relationship || typeof relationship !== "object") {
        continue;
      }

      const record = relationship as Record<string, unknown>;
      const name = [record.key, record.name, record.type]
        .find((value) => typeof value === "string" && value.trim()) as string | undefined;

      if (name === relationshipName) {
        return readRelationshipUrlCandidate(record);
      }
    }

    return null;
  }

  const relationshipRecord = relationships as Record<string, unknown>;
  const directKeys = [
    relationshipName,
    `${relationshipName}_url`,
    `${relationshipName}Url`,
  ];

  for (const key of directKeys) {
    const candidate = readRelationshipUrlCandidate(relationshipRecord[key]);

    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function CalendarDetailView({
  activeTab,
  calendarUid,
  onBack,
  onSelectTab,
}: {
  activeTab: CalendarDetailTab;
  calendarUid: string;
  onBack: () => void;
  onSelectTab: (tab: CalendarDetailTab) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pageSize = mainSequenceRegistryPageSize;
  const [relationshipOffset, setRelationshipOffset] = useState(0);
  const defaultCalendarWindow = useMemo(() => getDefaultCalendarWindow(), []);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const calendarStartDate =
    normalizeCalendarDate(searchParams.get(calendarStartDateParam)) ?? defaultCalendarWindow.startDate;
  const calendarEndDate =
    normalizeCalendarDate(searchParams.get(calendarEndDateParam)) ?? defaultCalendarWindow.endDate;
  const calendarWindow = useMemo(
    () => ({
      startDate: calendarStartDate,
      endDate: calendarEndDate,
    }),
    [calendarEndDate, calendarStartDate],
  );

  const summaryQuery = useQuery({
    queryKey: ["main_sequence", "calendars", "summary", calendarUid],
    queryFn: () => fetchCalendarSummary(calendarUid),
  });

  const detailQuery = useQuery({
    queryKey: ["main_sequence", "calendars", "detail", calendarUid],
    queryFn: () => fetchCalendarDetail(calendarUid),
  });

  const datesRelationshipUrl = readCalendarRelationshipUrl(summaryQuery.data, "dates");
  const sessionsRelationshipUrl = readCalendarRelationshipUrl(summaryQuery.data, "sessions");
  const eventsRelationshipUrl = readCalendarRelationshipUrl(summaryQuery.data, "events");

  const datesQuery = useQuery({
    enabled: activeTab === "dates",
    queryKey: [
      "main_sequence",
      "calendars",
      "dates",
      calendarUid,
      calendarWindow,
      relationshipOffset,
      pageSize,
      datesRelationshipUrl,
    ],
    queryFn: () =>
      listCalendarDates(
        calendarUid,
        {
          ...calendarWindow,
          limit: pageSize,
          offset: relationshipOffset,
        },
        datesRelationshipUrl,
      ),
  });

  const sessionsQuery = useQuery({
    enabled: activeTab === "sessions",
    queryKey: [
      "main_sequence",
      "calendars",
      "sessions",
      calendarUid,
      calendarWindow,
      relationshipOffset,
      pageSize,
      sessionsRelationshipUrl,
    ],
    queryFn: () =>
      listCalendarSessions(
        calendarUid,
        {
          ...calendarWindow,
          limit: pageSize,
          offset: relationshipOffset,
        },
        sessionsRelationshipUrl,
      ),
  });

  const eventsQuery = useQuery({
    enabled: activeTab === "events",
    queryKey: [
      "main_sequence",
      "calendars",
      "events",
      calendarUid,
      calendarWindow,
      relationshipOffset,
      pageSize,
      eventsRelationshipUrl,
    ],
    queryFn: () =>
      listCalendarEvents(
        calendarUid,
        {
          ...calendarWindow,
          limit: pageSize,
          offset: relationshipOffset,
        },
        eventsRelationshipUrl,
      ),
  });

  useEffect(() => {
    setRelationshipOffset(0);
  }, [activeTab, calendarUid]);

  function updateSearchParams(
    update: (nextParams: URLSearchParams) => void,
    { replace = false }: { replace?: boolean } = {},
  ) {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);
    const nextSearch = nextParams.toString();

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace },
    );
  }

  function updateCalendarDateWindow(
    key: typeof calendarStartDateParam | typeof calendarEndDateParam,
    value: string,
  ) {
    updateSearchParams(
      (nextParams) => {
        setOrDeleteParam(nextParams, key, value);
      },
      { replace: true },
    );
    setRelationshipOffset(0);
  }

  function resetCalendarDateWindow() {
    updateSearchParams(
      (nextParams) => {
        nextParams.delete(calendarStartDateParam);
        nextParams.delete(calendarEndDateParam);
      },
      { replace: true },
    );
    setRelationshipOffset(0);
  }

  const detail = detailQuery.data ?? null;
  const title = detail ? formatCalendarTitle(detail) : `Calendar ${calendarUid}`;
  const activeRelationshipRows =
    activeTab === "dates"
      ? datesQuery.data ?? []
      : activeTab === "sessions"
        ? sessionsQuery.data ?? []
        : activeTab === "events"
          ? eventsQuery.data ?? []
          : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title={title}
        description="Calendar detail, summary, and related date/session/event rows."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Back to calendars
          </Button>
        }
      />

      {summaryQuery.isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading calendar summary
          </CardContent>
        </Card>
      ) : summaryQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(summaryQuery.error)}
        </div>
      ) : summaryQuery.data ? (
        <MainSequenceEntitySummaryCard
          summary={summaryQuery.data}
          onSummaryUpdated={() =>
            queryClient.invalidateQueries({
              queryKey: ["main_sequence", "calendars", "summary", calendarUid],
            })
          }
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {calendarTabs.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            size="sm"
            variant={activeTab === tab.id ? "default" : "outline"}
            onClick={() => onSelectTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "details" ? (
        <Card>
          <CardHeader className="border-b border-border/70">
            <CardTitle>Calendar Detail</CardTitle>
            <CardDescription>
              Source of truth from `GET /api/v1/calendar/{calendarUid}/?response_format=frontend_detail`.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            {detailQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading calendar detail
              </div>
            ) : detailQuery.isError ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(detailQuery.error)}
              </div>
            ) : detail ? (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <DetailValue label="UID" value={detail.uid} monospace />
                  <DetailValue label="Identifier" value={detail.unique_identifier} monospace />
                  <DetailValue label="Type" value={detail.calendar_type} />
                  <DetailValue label="Timezone" value={formatText(detail.timezone)} />
                  <DetailValue label="Source" value={formatText(detail.source)} />
                  <DetailValue label="Source Identifier" value={formatText(detail.source_identifier)} />
                  <DetailValue label="Valid From" value={formatText(detail.valid_from)} />
                  <DetailValue label="Valid To" value={formatText(detail.valid_to)} />
                  <DetailValue label="Display Name" value={formatText(detail.display_name)} />
                </div>
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45">
                  <div className="border-b border-border/70 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Metadata JSON
                  </div>
                  <pre className="overflow-x-auto px-4 py-4 font-mono text-xs text-foreground">
                    {safeJsonStringify(detail.metadata_json ?? {})}
                  </pre>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "dates" ? (
        <RelationshipShell
          title="Dates"
          description={`Calendar date facts between ${calendarWindow.startDate} and ${calendarWindow.endDate}.`}
          isLoading={datesQuery.isLoading}
          isError={datesQuery.isError}
          controls={
            <CalendarRelationshipDateFilters
              startDate={calendarWindow.startDate}
              endDate={calendarWindow.endDate}
              onChangeStartDate={(value) => updateCalendarDateWindow(calendarStartDateParam, value)}
              onChangeEndDate={(value) => updateCalendarDateWindow(calendarEndDateParam, value)}
              onReset={resetCalendarDateWindow}
            />
          }
        >
          <CalendarDatesTable rows={datesQuery.data ?? []} />
        </RelationshipShell>
      ) : null}

      {activeTab === "sessions" ? (
        <RelationshipShell
          title="Sessions"
          description={`Intraday sessions between ${calendarWindow.startDate} and ${calendarWindow.endDate}.`}
          isLoading={sessionsQuery.isLoading}
          isError={sessionsQuery.isError}
          controls={
            <CalendarRelationshipDateFilters
              startDate={calendarWindow.startDate}
              endDate={calendarWindow.endDate}
              onChangeStartDate={(value) => updateCalendarDateWindow(calendarStartDateParam, value)}
              onChangeEndDate={(value) => updateCalendarDateWindow(calendarEndDateParam, value)}
              onReset={resetCalendarDateWindow}
            />
          }
        >
          <CalendarSessionsTable rows={sessionsQuery.data ?? []} />
        </RelationshipShell>
      ) : null}

      {activeTab === "events" ? (
        <RelationshipShell
          title="Events"
          description={`Calendar-level events between ${calendarWindow.startDate} and ${calendarWindow.endDate}.`}
          isLoading={eventsQuery.isLoading}
          isError={eventsQuery.isError}
          controls={
            <CalendarRelationshipDateFilters
              startDate={calendarWindow.startDate}
              endDate={calendarWindow.endDate}
              onChangeStartDate={(value) => updateCalendarDateWindow(calendarStartDateParam, value)}
              onChangeEndDate={(value) => updateCalendarDateWindow(calendarEndDateParam, value)}
              onReset={resetCalendarDateWindow}
            />
          }
        >
          <CalendarEventsTable rows={eventsQuery.data ?? []} />
        </RelationshipShell>
      ) : null}

      {activeTab !== "details" ? (
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {activeRelationshipRows.length === 0
              ? "No rows loaded"
              : `${relationshipOffset + 1}-${relationshipOffset + activeRelationshipRows.length} rows`}
          </div>
          <PaginationActions
            canGoBack={relationshipOffset > 0}
            canGoForward={activeRelationshipRows.length >= pageSize}
            onBack={() => setRelationshipOffset((current) => Math.max(0, current - pageSize))}
            onForward={() => setRelationshipOffset((current) => current + pageSize)}
          />
        </div>
      ) : null}
    </div>
  );
}

export function MainSequenceCalendarsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedCalendarUid = normalizeCalendarUid(searchParams.get(calendarUidParam));
  const selectedCalendarTab = normalizeCalendarTab(searchParams.get(calendarTabParam));
  const searchValue = searchParams.get("search") ?? "";
  const pageSize = mainSequenceRegistryPageSize;
  const offsetParam = readPositiveInt(searchParams.get("offset"));
  const offset = offsetParam ?? 0;
  const deferredSearchValue = useDeferredValue(searchValue);

  const calendarFilters = useMemo(
    () =>
      ({
        search: deferredSearchValue,
        limit: pageSize,
        offset,
      }) satisfies CalendarListFilters,
    [deferredSearchValue, offset, pageSize],
  );

  const calendarsQuery = useQuery({
    enabled: selectedCalendarUid === null,
    queryKey: ["main_sequence", "calendars", "list", calendarFilters],
    queryFn: () => listCalendars(calendarFilters),
  });

  const calendarPage = calendarsQuery.data ?? null;
  const pageRows = calendarPage?.results ?? [];
  const loadedCount = pageRows.length;

  function updateSearchParams(
    update: (nextParams: URLSearchParams) => void,
    { replace = false }: { replace?: boolean } = {},
  ) {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);
    const nextSearch = nextParams.toString();

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace },
    );
  }

  function updateSearch(value: string) {
    updateSearchParams(
      (nextParams) => {
        nextParams.delete(calendarUidParam);
        setOrDeleteParam(nextParams, "search", value);
        nextParams.set("limit", String(pageSize));
        nextParams.set("offset", "0");
      },
      { replace: true },
    );
  }

  function openCalendar(calendarUid: string) {
    updateSearchParams((nextParams) => {
      nextParams.set(calendarUidParam, calendarUid);
      nextParams.set(calendarTabParam, defaultCalendarTab);
    });
  }

  function closeCalendar() {
    updateSearchParams((nextParams) => {
      nextParams.delete(calendarUidParam);
      nextParams.delete(calendarTabParam);
    });
  }

  function selectCalendarTab(tab: CalendarDetailTab) {
    updateSearchParams((nextParams) => {
      nextParams.set(calendarTabParam, tab);
    });
  }

  if (selectedCalendarUid !== null) {
    return (
      <CalendarDetailView
        activeTab={selectedCalendarTab}
        calendarUid={selectedCalendarUid}
        onBack={closeCalendar}
        onSelectTab={selectCalendarTab}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title="Calendars"
        description="Browse calendar identity records and inspect dates, sessions, and events."
        actions={<Badge variant="neutral">{`${loadedCount} loaded`}</Badge>}
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Calendar Registry</CardTitle>
              <CardDescription>
                Lists `GET /api/v1/calendar/?response_format=frontend_list` records.
              </CardDescription>
            </div>
            <MainSequenceRegistrySearch
              actionMenuLabel="Calendar actions"
              accessory={<Badge variant="neutral">{`${loadedCount} rows`}</Badge>}
              value={searchValue}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search calendars"
              searchClassName="max-w-xl"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {calendarsQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading calendars
              </div>
            </div>
          ) : null}

          {calendarsQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(calendarsQuery.error)}
            </div>
          ) : null}

          {!calendarsQuery.isLoading && !calendarsQuery.isError && loadedCount === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No calendars found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a different search or adjust calendar filters.
              </p>
            </div>
          ) : null}

          {!calendarsQuery.isLoading && !calendarsQuery.isError && loadedCount > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="px-4 pb-2">Calendar</th>
                    <th className="px-4 pb-2">Type</th>
                    <th className="px-4 pb-2">Timezone</th>
                    <th className="px-4 pb-2">Source</th>
                    <th className="px-4 pb-2">Validity</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((calendar) => (
                    <tr key={calendar.uid}>
                      <td className={getRegistryTableCellClassName(false, "left")}>
                        <button
                          type="button"
                          className="min-w-0 text-left transition-opacity hover:opacity-80"
                          onClick={() => openCalendar(calendar.uid)}
                        >
                          <div className="truncate font-medium text-foreground">
                            {formatCalendarTitle(calendar)}
                          </div>
                          <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                            {calendar.unique_identifier}
                          </div>
                        </button>
                      </td>
                      <td className={getRegistryTableCellClassName(false)}>{calendar.calendar_type}</td>
                      <td className={getRegistryTableCellClassName(false)}>
                        {formatText(calendar.timezone)}
                      </td>
                      <td className={getRegistryTableCellClassName(false)}>
                        {[calendar.source, calendar.source_identifier]
                          .map((value) => value?.trim())
                          .filter(Boolean)
                          .join(" · ") || "Not available"}
                      </td>
                      <td className={getRegistryTableCellClassName(false, "right")}>
                        {[calendar.valid_from, calendar.valid_to]
                          .map((value) => formatText(value, "open"))
                          .join(" → ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {loadedCount === 0 ? "No calendars loaded" : `${offset + 1}-${offset + loadedCount} calendars`}
        </div>
        <PaginationActions
          canGoBack={offset > 0}
          canGoForward={Boolean(calendarPage?.next)}
          onBack={() =>
            updateSearchParams((nextParams) => {
              nextParams.set("limit", String(pageSize));
              nextParams.set("offset", String(Math.max(0, offset - pageSize)));
            })
          }
          onForward={() =>
            updateSearchParams((nextParams) => {
              nextParams.set("limit", String(pageSize));
              nextParams.set("offset", String(offset + pageSize));
            })
          }
        />
      </div>
    </div>
  );
}
