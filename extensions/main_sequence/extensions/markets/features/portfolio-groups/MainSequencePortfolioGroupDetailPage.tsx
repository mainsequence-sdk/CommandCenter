import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  appendPortfolioGroupPortfolios,
  fetchPortfolioGroupDetail,
  fetchTargetPortfolioSummary,
  formatMainSequenceError,
  removePortfolioGroupPortfolios,
  searchTargetPortfolioOptions,
  type PortfolioGroupRecord,
  type TargetPortfolioSearchOption,
} from "../../../../common/api";
import {
  formatPortfolioGroupValue,
  getPortfolioGroupCreationDate,
  getPortfolioGroupDescription,
  getPortfolioGroupTitle,
  getPortfolioGroupUniqueIdentifier,
  getPortfolioGroupsListPath,
  getPortfolioSearchOptionLabel,
  getTargetPortfolioDetailPath,
} from "./portfolioGroupShared";

type PortfolioGroupDetailTabId = "settings" | "overview";

type RemovePortfolioIntent = {
  id: number;
  title: string;
};

const portfolioGroupDetailTabs: Array<{ id: PortfolioGroupDetailTabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "settings", label: "Settings" },
];

function readPositiveInt(value: unknown) {
  const parsed = Number(value ?? "");

  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isBlankValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim().length === 0) ||
    (Array.isArray(value) && value.length === 0)
  );
}

function isPortfolioField(fieldKey?: string) {
  const normalized = (fieldKey ?? "").trim().toLowerCase();
  return normalized === "portfolios" || normalized === "portfolio_ids";
}

function extractPortfolioIds(portfolioGroup: PortfolioGroupRecord | null | undefined) {
  if (!portfolioGroup) {
    return [];
  }

  const rawValues = [portfolioGroup.portfolios, portfolioGroup.portfolio_ids].filter(Array.isArray);
  const ids = rawValues.flatMap((value) => value.map((entry) => readPositiveInt(entry)));

  return Array.from(new Set(ids.filter((id): id is number => id !== null))).sort((left, right) => left - right);
}

function getPortfolioSummaryTitle(
  summary: Awaited<ReturnType<typeof fetchTargetPortfolioSummary>> | null | undefined,
) {
  const title = summary?.entity?.title;
  return typeof title === "string" && title.trim() ? title.trim() : null;
}

function PortfolioGroupNestedValue({
  value,
  fieldKey,
  depth = 0,
  portfolioTitlesById,
  loadingPortfolioIds,
}: {
  value: unknown;
  fieldKey?: string;
  depth?: number;
  portfolioTitlesById?: Map<number, string>;
  loadingPortfolioIds?: Set<number>;
}) {
  if (isBlankValue(value)) {
    return <div className="text-sm text-muted-foreground">Not available</div>;
  }

  if (depth >= 4) {
    return <div className="text-sm text-foreground">{formatPortfolioGroupValue(value, fieldKey)}</div>;
  }

  if (Array.isArray(value)) {
    if (isPortfolioField(fieldKey) && value.every((entry) => readPositiveInt(entry) !== null)) {
      return (
        <div className="space-y-2">
          {value.map((entry, index) => {
            const portfolioId = readPositiveInt(entry);

            if (portfolioId === null) {
              return null;
            }

            const portfolioTitle = portfolioTitlesById?.get(portfolioId) ?? null;
            const isLoading = loadingPortfolioIds?.has(portfolioId) ?? false;

            return (
              <div
                key={`${fieldKey ?? "portfolio"}-${portfolioId}-${index}`}
                className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-card/65 px-3 py-3"
              >
                <Link
                  to={getTargetPortfolioDetailPath(portfolioId)}
                  className="text-sm font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
                >
                  {portfolioTitle || (isLoading ? `Loading portfolio ${portfolioId}` : `Portfolio ${portfolioId}`)}
                </Link>
                <div className="mt-1 text-xs text-muted-foreground">{`ID ${portfolioId}`}</div>
              </div>
            );
          })}
        </div>
      );
    }

    if (value.every((entry) => !isRecord(entry) && !Array.isArray(entry))) {
      return (
        <div className="flex flex-wrap gap-2">
          {value.map((entry, index) => (
            <div
              key={`${fieldKey ?? "value"}-${index}`}
              className="rounded-[calc(var(--radius)-10px)] border border-border/50 bg-card/65 px-2.5 py-1 text-xs text-foreground"
            >
              {formatPortfolioGroupValue(entry, fieldKey)}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {value.map((entry, index) => (
          <div
            key={`${fieldKey ?? "value"}-${index}`}
            className="rounded-[calc(var(--radius)-8px)] border border-border/50 bg-card/65 px-3 py-3"
          >
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Item {index + 1}
            </div>
            <div className="mt-2">
              <PortfolioGroupNestedValue
                value={entry}
                fieldKey={fieldKey}
                depth={depth + 1}
                portfolioTitlesById={portfolioTitlesById}
                loadingPortfolioIds={loadingPortfolioIds}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).filter(([, entryValue]) => !isBlankValue(entryValue));

    if (entries.length === 0) {
      return <div className="text-sm text-muted-foreground">No fields</div>;
    }

    return (
      <div className="grid gap-3 md:grid-cols-2">
        {entries.map(([key, entryValue]) => (
          <div
            key={key}
            className="rounded-[calc(var(--radius)-8px)] border border-border/50 bg-card/65 px-3 py-3"
          >
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}
            </div>
            <div className="mt-2">
              <PortfolioGroupNestedValue
                value={entryValue}
                fieldKey={key}
                depth={depth + 1}
                portfolioTitlesById={portfolioTitlesById}
                loadingPortfolioIds={loadingPortfolioIds}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <div className="text-sm text-foreground">{formatPortfolioGroupValue(value, fieldKey)}</div>;
}

function buildOrderedEntries(portfolioGroup: PortfolioGroupRecord) {
  const entries = Object.entries(portfolioGroup).filter(([, value]) => !isBlankValue(value));
  const order = new Map<string, number>([
    ["id", 0],
    ["name", 1],
    ["display_name", 2],
    ["portfolio_group_name", 3],
    ["unique_identifier", 4],
    ["description", 5],
    ["creation_date", 6],
    ["portfolios", 7],
  ]);

  return entries.sort(([leftKey], [rightKey]) => {
    const leftOrder = order.get(leftKey) ?? 100;
    const rightOrder = order.get(rightKey) ?? 100;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return leftKey.localeCompare(rightKey);
  });
}

function renderRemoveSummary(target: RemovePortfolioIntent | null) {
  if (!target) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="font-medium text-foreground">{target.title}</div>
      <div className="text-xs text-muted-foreground">{`ID ${target.id}`}</div>
    </div>
  );
}

export function MainSequencePortfolioGroupDetailPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [activeTabId, setActiveTabId] = useState<PortfolioGroupDetailTabId>("overview");
  const [portfolioSearchValue, setPortfolioSearchValue] = useState("");
  const [selectedPortfolioOption, setSelectedPortfolioOption] = useState<TargetPortfolioSearchOption | null>(null);
  const [removePortfolioIntent, setRemovePortfolioIntent] = useState<RemovePortfolioIntent | null>(null);

  const portfolioGroupId = readPositiveInt(params.groupId);
  const deferredPortfolioSearchValue = useDeferredValue(portfolioSearchValue);
  const backPath =
    ((location.state as { from?: string } | null)?.from || "").trim() ||
    getPortfolioGroupsListPath();

  const portfolioGroupDetailQuery = useQuery({
    queryKey: ["main_sequence", "portfolio_groups", "detail", portfolioGroupId],
    queryFn: () => fetchPortfolioGroupDetail(portfolioGroupId as number),
    enabled: portfolioGroupId !== null,
  });

  const linkedPortfolioIds = useMemo(
    () => extractPortfolioIds(portfolioGroupDetailQuery.data),
    [portfolioGroupDetailQuery.data],
  );

  const linkedPortfolioQueries = useQueries({
    queries: linkedPortfolioIds.map((linkedPortfolioId) => ({
      queryKey: ["main_sequence", "target_portfolios", "summary", linkedPortfolioId],
      queryFn: () => fetchTargetPortfolioSummary(linkedPortfolioId),
      enabled: linkedPortfolioIds.length > 0,
    })),
  });

  const portfolioTitlesById = useMemo(() => {
    const nextMap = new Map<number, string>();

    linkedPortfolioIds.forEach((linkedPortfolioId, index) => {
      const title = getPortfolioSummaryTitle(linkedPortfolioQueries[index]?.data);

      if (title) {
        nextMap.set(linkedPortfolioId, title);
      }
    });

    return nextMap;
  }, [linkedPortfolioIds, linkedPortfolioQueries]);

  const loadingPortfolioIds = useMemo(() => {
    const nextSet = new Set<number>();

    linkedPortfolioIds.forEach((linkedPortfolioId, index) => {
      if (linkedPortfolioQueries[index]?.isLoading) {
        nextSet.add(linkedPortfolioId);
      }
    });

    return nextSet;
  }, [linkedPortfolioIds, linkedPortfolioQueries]);

  const detailEntries = useMemo(
    () =>
      portfolioGroupDetailQuery.data ? buildOrderedEntries(portfolioGroupDetailQuery.data) : [],
    [portfolioGroupDetailQuery.data],
  );

  const portfolioSearchQuery = useQuery({
    queryKey: ["main_sequence", "target_portfolios", "search_options", deferredPortfolioSearchValue],
    queryFn: () =>
      searchTargetPortfolioOptions({
        search: deferredPortfolioSearchValue,
        limit: 8,
        offset: 0,
      }),
    enabled:
      portfolioGroupId !== null &&
      activeTabId === "settings" &&
      deferredPortfolioSearchValue.trim().length > 0,
  });

  const availablePortfolioOptions = useMemo(
    () =>
      (portfolioSearchQuery.data?.results ?? []).filter(
        (option) => !linkedPortfolioIds.includes(option.id),
      ),
    [linkedPortfolioIds, portfolioSearchQuery.data?.results],
  );

  useEffect(() => {
    if (!selectedPortfolioOption) {
      return;
    }

    const stillAvailable = availablePortfolioOptions.some((option) => option.id === selectedPortfolioOption.id);

    if (!stillAvailable) {
      setSelectedPortfolioOption(null);
    }
  }, [availablePortfolioOptions, selectedPortfolioOption]);

  const appendPortfolioMutation = useMutation({
    mutationFn: (portfolioId: number) =>
      appendPortfolioGroupPortfolios(portfolioGroupId as number, {
        portfolios: [portfolioId],
      }),
    onSuccess: async (updatedPortfolioGroup, portfolioId) => {
      queryClient.setQueryData(
        ["main_sequence", "portfolio_groups", "detail", portfolioGroupId],
        updatedPortfolioGroup,
      );
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "portfolio_groups"],
      });

      toast({
        title: "Portfolio added",
        description: `${portfolioTitlesById.get(portfolioId) || getPortfolioSearchOptionLabel(selectedPortfolioOption ?? { id: portfolioId, portfolio_name: "" })} was added to ${getPortfolioGroupTitle(updatedPortfolioGroup)}.`,
      });

      setPortfolioSearchValue("");
      setSelectedPortfolioOption(null);
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Add portfolio failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const removePortfolioMutation = useMutation({
    mutationFn: (portfolioId: number) =>
      removePortfolioGroupPortfolios(portfolioGroupId as number, {
        portfolios: [portfolioId],
      }),
    onSuccess: async (updatedPortfolioGroup) => {
      queryClient.setQueryData(
        ["main_sequence", "portfolio_groups", "detail", portfolioGroupId],
        updatedPortfolioGroup,
      );
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "portfolio_groups"],
      });
    },
  });

  if (portfolioGroupId === null) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Main Sequence Markets"
          title="Portfolio Group"
          description="The requested portfolio group id is invalid."
          actions={
            <Button type="button" variant="outline" onClick={() => navigate(backPath)}>
              <ArrowLeft className="h-4 w-4" />
              Back to portfolio groups
            </Button>
          }
        />
      </div>
    );
  }

  const title =
    getPortfolioGroupTitle(portfolioGroupDetailQuery.data) || `Portfolio Group ${portfolioGroupId}`;
  const uniqueIdentifier = getPortfolioGroupUniqueIdentifier(portfolioGroupDetailQuery.data);
  const description = getPortfolioGroupDescription(portfolioGroupDetailQuery.data);
  const creationDate = getPortfolioGroupCreationDate(portfolioGroupDetailQuery.data);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title={title}
        description={
          uniqueIdentifier || description || "Manage the portfolios linked to this portfolio group."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{`ID ${portfolioGroupId}`}</Badge>
            {creationDate ? (
              <Badge variant="neutral">
                {formatPortfolioGroupValue(creationDate, "creation_date")}
              </Badge>
            ) : null}
            <Button type="button" variant="outline" onClick={() => navigate(backPath)}>
              <ArrowLeft className="h-4 w-4" />
              Back to portfolio groups
            </Button>
          </div>
        }
      />

      {portfolioGroupDetailQuery.isLoading ? (
        <Card>
          <CardContent className="flex min-h-56 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading portfolio group detail
            </div>
          </CardContent>
        </Card>
      ) : null}

      {portfolioGroupDetailQuery.isError ? (
        <Card>
          <CardContent className="p-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(portfolioGroupDetailQuery.error)}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {portfolioGroupDetailQuery.data ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {portfolioGroupDetailTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={
                  tab.id === activeTabId
                    ? "rounded-full border border-primary/35 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
                    : "rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/25 hover:text-primary"
                }
                onClick={() => setActiveTabId(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTabId === "settings" ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <Card>
                <CardHeader className="border-b border-border/70">
                  <div>
                    <CardTitle>Portfolio group settings</CardTitle>
                    <CardDescription>
                      Search target portfolios, select one result, and add it to this group without
                      leaving the page.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Search portfolios
                    </label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={portfolioSearchValue}
                        onChange={(event) => {
                          setPortfolioSearchValue(event.target.value);
                          setSelectedPortfolioOption(null);
                        }}
                        placeholder="Search portfolios"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  {portfolioSearchQuery.isLoading ? (
                    <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Searching portfolios
                      </div>
                    </div>
                  ) : null}

                  {portfolioSearchQuery.isError ? (
                    <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                      {formatMainSequenceError(portfolioSearchQuery.error)}
                    </div>
                  ) : null}

                  {deferredPortfolioSearchValue.trim().length === 0 ? (
                    <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-4 text-sm text-muted-foreground">
                      Start typing to query the portfolios endpoint and select a portfolio to add.
                    </div>
                  ) : null}

                  {deferredPortfolioSearchValue.trim().length > 0 &&
                  !portfolioSearchQuery.isLoading &&
                  !portfolioSearchQuery.isError &&
                  availablePortfolioOptions.length === 0 ? (
                    <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-4 text-sm text-muted-foreground">
                      No matching portfolios were found or every match is already linked to this
                      group.
                    </div>
                  ) : null}

                  {availablePortfolioOptions.length > 0 ? (
                    <div className="space-y-2">
                      {availablePortfolioOptions.map((option) => {
                        const selected = selectedPortfolioOption?.id === option.id;

                        return (
                          <button
                            key={option.id}
                            type="button"
                            className={
                              selected
                                ? "flex w-full items-start justify-between gap-3 rounded-[calc(var(--radius)-8px)] border border-primary/35 bg-primary/10 px-4 py-3 text-left"
                                : "flex w-full items-start justify-between gap-3 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-3 text-left transition-colors hover:border-primary/25 hover:bg-primary/5"
                            }
                            onClick={() => setSelectedPortfolioOption(option)}
                          >
                            <div className="min-w-0">
                              <div className="font-medium text-foreground">
                                {getPortfolioSearchOptionLabel(option)}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">{`ID ${option.id}`}</div>
                            </div>
                            {selected ? <Badge variant="primary">Selected</Badge> : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={() => {
                        if (!selectedPortfolioOption) {
                          return;
                        }

                        appendPortfolioMutation.mutate(selectedPortfolioOption.id);
                      }}
                      disabled={!selectedPortfolioOption || appendPortfolioMutation.isPending}
                    >
                      {appendPortfolioMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Add selected portfolio
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b border-border/70">
                  <div>
                    <CardTitle>Group portfolios</CardTitle>
                    <CardDescription>
                      Current portfolio members resolved from the ids stored on this portfolio
                      group.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-6">
                  {linkedPortfolioIds.length === 0 ? (
                    <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-10 text-center text-sm text-muted-foreground">
                      This group does not have any linked portfolios yet.
                    </div>
                  ) : (
                    linkedPortfolioIds.map((linkedPortfolioId) => {
                      const linkedPortfolioTitle =
                        portfolioTitlesById.get(linkedPortfolioId) ||
                        (loadingPortfolioIds.has(linkedPortfolioId)
                          ? `Loading portfolio ${linkedPortfolioId}`
                          : `Portfolio ${linkedPortfolioId}`);

                      return (
                        <div
                          key={linkedPortfolioId}
                          className="flex items-start justify-between gap-3 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-4"
                        >
                          <div className="min-w-0">
                            <Link
                              to={getTargetPortfolioDetailPath(linkedPortfolioId)}
                              className="text-sm font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
                            >
                              {linkedPortfolioTitle}
                            </Link>
                            <div className="mt-1 text-xs text-muted-foreground">{`ID ${linkedPortfolioId}`}</div>
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-danger hover:bg-danger/10 hover:text-danger"
                            onClick={() =>
                              setRemovePortfolioIntent({
                                id: linkedPortfolioId,
                                title: linkedPortfolioTitle,
                              })
                            }
                            disabled={removePortfolioMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </Button>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardHeader className="border-b border-border/70">
                <div>
                  <CardTitle>Portfolio group details</CardTitle>
                  <CardDescription>
                    These fields come directly from `GET /orm/api/assets/portfolio_group/{portfolioGroupId}/`.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                {detailEntries.length > 0 ? (
                  detailEntries.map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-4"
                    >
                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        {key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}
                      </div>
                      <div className="mt-3">
                        <PortfolioGroupNestedValue
                          value={value}
                          fieldKey={key}
                          portfolioTitlesById={portfolioTitlesById}
                          loadingPortfolioIds={loadingPortfolioIds}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-10 text-center text-sm text-muted-foreground">
                    No portfolio group fields were returned.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      <ActionConfirmationDialog
        open={removePortfolioIntent !== null}
        onClose={() => {
          if (!removePortfolioMutation.isPending) {
            setRemovePortfolioIntent(null);
          }
        }}
        onConfirm={() =>
          removePortfolioIntent ? removePortfolioMutation.mutateAsync(removePortfolioIntent.id) : null
        }
        onSuccess={() => {
          setRemovePortfolioIntent(null);
        }}
        title="Remove portfolio"
        description="This removes the selected portfolio from the current portfolio group."
        tone="danger"
        actionLabel="remove the selected portfolio"
        confirmButtonLabel="Remove portfolio"
        confirmWord="REMOVE"
        objectLabel="portfolio"
        objectSummary={renderRemoveSummary(removePortfolioIntent)}
        errorToast={{
          title: "Remove portfolio failed",
          description: (error) => formatMainSequenceError(error),
        }}
        successToast={{
          title: "Portfolio removed",
          description: () =>
            removePortfolioIntent
              ? `${removePortfolioIntent.title} was removed from this portfolio group.`
              : "The portfolio was removed.",
        }}
      />
    </div>
  );
}
