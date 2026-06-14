import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  addPortfolioGroupPortfolio,
  deletePortfolioGroup,
  fetchPortfolioGroupDetail,
  formatMainSequenceError,
  listPortfolioGroupPortfolios,
  removePortfolioGroupPortfolio,
  searchTargetPortfolioOptions,
  updatePortfolioGroup,
  type PortfolioGroupPortfolioListRow,
  type PortfolioGroupRecord,
  type TargetPortfolioSearchOption,
} from "../../../../common/api";
import {
  buildUpdatePortfolioGroupPayload,
  formatPortfolioGroupValue,
  getPortfolioGroupDescription,
  getPortfolioGroupTitle,
  getPortfolioGroupUniqueIdentifier,
  getPortfolioGroupsListPath,
  getPortfolioSearchOptionLabel,
  getTargetPortfolioDetailPath,
  PortfolioGroupEditorDialog,
  type PortfolioGroupEditorValues,
} from "./portfolioGroupShared";

type PortfolioGroupDetailTabId = "settings" | "overview";

type RemovePortfolioIntent = {
  uid: string;
  title: string;
};

const portfolioGroupDetailTabs: Array<{ id: PortfolioGroupDetailTabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "settings", label: "Settings" },
];
const portfolioGroupMembershipPageSize = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readUid(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (isRecord(value) && typeof value.uid === "string" && value.uid.trim()) {
    return value.uid.trim();
  }

  return null;
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
  return normalized === "portfolios" || normalized === "portfolio_uids";
}

function getPortfolioListRowTitle(portfolio: PortfolioGroupPortfolioListRow) {
  return readTrimmedString(portfolio.unique_identifier) || `Portfolio ${portfolio.uid}`;
}

function serializeMetadataJson(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "{}";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function buildEditorInitialValues(
  portfolioGroup: PortfolioGroupRecord | null | undefined,
): PortfolioGroupEditorValues {
  return {
    uniqueIdentifier: getPortfolioGroupUniqueIdentifier(portfolioGroup) ?? "",
    displayName: readTrimmedString(portfolioGroup?.display_name) ?? "",
    description: getPortfolioGroupDescription(portfolioGroup) ?? "",
    metadataJson: serializeMetadataJson(portfolioGroup?.metadata_json),
  };
}

function readDeleteDetail(result: unknown) {
  if (
    result &&
    typeof result === "object" &&
    "detail" in result &&
    typeof (result as { detail?: unknown }).detail === "string"
  ) {
    const detail = (result as { detail: string }).detail.trim();
    return detail.length > 0 ? detail : undefined;
  }

  return undefined;
}

function PortfolioGroupNestedValue({
  value,
  fieldKey,
  depth = 0,
}: {
  value: unknown;
  fieldKey?: string;
  depth?: number;
}) {
  if (isBlankValue(value)) {
    return <div className="text-sm text-muted-foreground">Not available</div>;
  }

  if (depth >= 4) {
    return <div className="text-sm text-foreground">{formatPortfolioGroupValue(value, fieldKey)}</div>;
  }

  if (Array.isArray(value)) {
    if (isPortfolioField(fieldKey) && value.every((entry) => readUid(entry) !== null)) {
      return (
        <div className="space-y-2">
          {value.map((entry, index) => {
            const portfolioUid = readUid(entry);

            if (portfolioUid === null) {
              return null;
            }

            return (
              <div
                key={`${fieldKey ?? "portfolio"}-${portfolioUid}-${index}`}
                className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-card/65 px-3 py-3"
              >
                <Link
                  to={getTargetPortfolioDetailPath(portfolioUid)}
                  className="text-sm font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
                >
                  {`Portfolio ${portfolioUid}`}
                </Link>
                <div className="mt-1 text-xs text-muted-foreground">{`UID ${portfolioUid}`}</div>
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
              <PortfolioGroupNestedValue value={entry} fieldKey={fieldKey} depth={depth + 1} />
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
              <PortfolioGroupNestedValue value={entryValue} fieldKey={key} depth={depth + 1} />
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
    ["uid", 1],
    ["name", 2],
    ["display_name", 3],
    ["portfolio_group_name", 4],
    ["unique_identifier", 5],
    ["description", 6],
    ["metadata_json", 7],
    ["creation_date", 8],
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
      <div className="text-xs text-muted-foreground">{`UID ${target.uid}`}</div>
    </div>
  );
}

function renderGroupSummary(portfolioGroup: PortfolioGroupRecord | null | undefined) {
  if (!portfolioGroup) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="font-medium text-foreground">{getPortfolioGroupTitle(portfolioGroup)}</div>
      <div className="text-xs text-muted-foreground">{`UID ${portfolioGroup.uid}`}</div>
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
  const [selectedPortfolioOption, setSelectedPortfolioOption] =
    useState<TargetPortfolioSearchOption | null>(null);
  const [removePortfolioIntent, setRemovePortfolioIntent] = useState<RemovePortfolioIntent | null>(
    null,
  );
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteGroupDialogOpen, setDeleteGroupDialogOpen] = useState(false);

  const portfolioGroupUid = params.groupUid?.trim() ?? "";
  const deferredPortfolioSearchValue = useDeferredValue(portfolioSearchValue);
  const backPath =
    ((location.state as { from?: string } | null)?.from || "").trim() ||
    getPortfolioGroupsListPath();

  const portfolioGroupDetailQuery = useQuery({
    queryKey: ["main_sequence", "portfolio_groups", "detail", portfolioGroupUid],
    queryFn: () => fetchPortfolioGroupDetail(portfolioGroupUid),
    enabled: Boolean(portfolioGroupUid),
  });

  const groupPortfoliosQuery = useQuery({
    queryKey: [
      "main_sequence",
      "portfolio_groups",
      "detail",
      portfolioGroupUid,
      "portfolios",
      { limit: portfolioGroupMembershipPageSize, offset: 0 },
    ],
    queryFn: () =>
      listPortfolioGroupPortfolios(portfolioGroupUid, {
        limit: portfolioGroupMembershipPageSize,
        offset: 0,
      }),
    enabled: Boolean(portfolioGroupUid),
  });

  const linkedPortfolioRows = groupPortfoliosQuery.data?.results ?? [];
  const linkedPortfolioUids = useMemo(
    () => linkedPortfolioRows.map((portfolio) => portfolio.uid),
    [linkedPortfolioRows],
  );

  const detailEntries = useMemo(
    () =>
      portfolioGroupDetailQuery.data ? buildOrderedEntries(portfolioGroupDetailQuery.data) : [],
    [portfolioGroupDetailQuery.data],
  );

  const editInitialValues = useMemo(
    () => buildEditorInitialValues(portfolioGroupDetailQuery.data),
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
      Boolean(portfolioGroupUid) &&
      activeTabId === "settings" &&
      deferredPortfolioSearchValue.trim().length > 0,
  });

  const availablePortfolioOptions = useMemo(
    () =>
      (portfolioSearchQuery.data?.results ?? []).filter(
        (option) => !linkedPortfolioUids.includes(option.uid),
      ),
    [linkedPortfolioUids, portfolioSearchQuery.data?.results],
  );

  useEffect(() => {
    if (!selectedPortfolioOption) {
      return;
    }

    const stillAvailable = availablePortfolioOptions.some(
      (option) => option.uid === selectedPortfolioOption.uid,
    );

    if (!stillAvailable) {
      setSelectedPortfolioOption(null);
    }
  }, [availablePortfolioOptions, selectedPortfolioOption]);

  const addPortfolioMutation = useMutation({
    mutationFn: (portfolioUid: string) =>
      addPortfolioGroupPortfolio(portfolioGroupUid, {
        portfolio_uid: portfolioUid,
      }),
    onSuccess: async (_membership, portfolioUid) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "portfolio_groups"],
      });

      toast({
        title: "Portfolio added",
        description: `${getPortfolioSearchOptionLabel(
          selectedPortfolioOption ?? { uid: portfolioUid, unique_identifier: "" },
        )} was added to this portfolio group.`,
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
    mutationFn: (portfolioUid: string) =>
      removePortfolioGroupPortfolio(portfolioGroupUid, portfolioUid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "portfolio_groups"],
      });
    },
  });

  const updatePortfolioGroupMutation = useMutation({
    mutationFn: (values: PortfolioGroupEditorValues) =>
      updatePortfolioGroup(portfolioGroupUid, buildUpdatePortfolioGroupPayload(values)),
    onSuccess: async (updatedPortfolioGroup) => {
      queryClient.setQueryData(
        ["main_sequence", "portfolio_groups", "detail", portfolioGroupUid],
        updatedPortfolioGroup,
      );
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "portfolio_groups"],
      });

      setEditDialogOpen(false);
      toast({
        title: "Portfolio group updated",
        description: `${getPortfolioGroupTitle(updatedPortfolioGroup)} was updated.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Portfolio group update failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const deletePortfolioGroupMutation = useMutation({
    mutationFn: () => deletePortfolioGroup(portfolioGroupUid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "portfolio_groups"],
      });
    },
  });

  if (!portfolioGroupUid) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Main Sequence Markets"
          title="Portfolio Group"
          description="The requested portfolio group uid is invalid."
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
    getPortfolioGroupTitle(portfolioGroupDetailQuery.data) || `Portfolio Group ${portfolioGroupUid}`;
  const uniqueIdentifier = getPortfolioGroupUniqueIdentifier(portfolioGroupDetailQuery.data);
  const description = getPortfolioGroupDescription(portfolioGroupDetailQuery.data);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title={title}
        description={
          uniqueIdentifier ||
          description ||
          "Manage portfolio classification metadata and memberships."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{`UID ${portfolioGroupUid}`}</Badge>
            <Button type="button" variant="outline" onClick={() => navigate(backPath)}>
              <ArrowLeft className="h-4 w-4" />
              Back to portfolio groups
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditDialogOpen(true)}
              disabled={!portfolioGroupDetailQuery.data}
            >
              <Pencil className="h-4 w-4" />
              Edit group
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => setDeleteGroupDialogOpen(true)}
              disabled={!portfolioGroupDetailQuery.data}
            >
              <Trash2 className="h-4 w-4" />
              Delete group
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
                    <CardTitle>Add portfolio membership</CardTitle>
                    <CardDescription>
                      Search portfolios, select one result, and add one membership to this group.
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
                        const selected = selectedPortfolioOption?.uid === option.uid;

                        return (
                          <button
                            key={option.uid}
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
                              <div className="mt-1 text-xs text-muted-foreground">{`UID ${option.uid}`}</div>
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

                        addPortfolioMutation.mutate(selectedPortfolioOption.uid);
                      }}
                      disabled={!selectedPortfolioOption || addPortfolioMutation.isPending}
                    >
                      {addPortfolioMutation.isPending ? (
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
                      Current members from `GET /api/v1/portfolio-group/{portfolioGroupUid}/portfolios/`.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-6">
                  {groupPortfoliosQuery.isLoading ? (
                    <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-10 text-center text-sm text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading group portfolios
                      </div>
                    </div>
                  ) : null}

                  {groupPortfoliosQuery.isError ? (
                    <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                      {formatMainSequenceError(groupPortfoliosQuery.error)}
                    </div>
                  ) : null}

                  {!groupPortfoliosQuery.isLoading &&
                  !groupPortfoliosQuery.isError &&
                  linkedPortfolioRows.length === 0 ? (
                    <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-10 text-center text-sm text-muted-foreground">
                      This group does not have any linked portfolios yet.
                    </div>
                  ) : null}

                  {linkedPortfolioRows.map((linkedPortfolio) => {
                    const linkedPortfolioTitle = getPortfolioListRowTitle(linkedPortfolio);

                    return (
                      <div
                        key={linkedPortfolio.uid}
                        className="flex items-start justify-between gap-3 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-4"
                      >
                        <div className="min-w-0">
                          <Link
                            to={getTargetPortfolioDetailPath(linkedPortfolio.uid)}
                            className="text-sm font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
                          >
                            {linkedPortfolioTitle}
                          </Link>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {`UID ${linkedPortfolio.uid}`}
                          </div>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-danger hover:bg-danger/10 hover:text-danger"
                          onClick={() =>
                            setRemovePortfolioIntent({
                              uid: linkedPortfolio.uid,
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
                  })}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardHeader className="border-b border-border/70">
                <div>
                  <CardTitle>Portfolio group details</CardTitle>
                  <CardDescription>
                    These fields come directly from `GET /api/v1/portfolio-group/{portfolioGroupUid}/`.
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
                        <PortfolioGroupNestedValue value={value} fieldKey={key} />
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

      <PortfolioGroupEditorDialog
        open={editDialogOpen}
        onClose={() => {
          if (!updatePortfolioGroupMutation.isPending) {
            setEditDialogOpen(false);
          }
        }}
        onSubmit={(values) => updatePortfolioGroupMutation.mutate(values)}
        isPending={updatePortfolioGroupMutation.isPending}
        error={updatePortfolioGroupMutation.error}
        initialValues={editInitialValues}
        mode="edit"
        submitLabel="Save group"
      />

      <ActionConfirmationDialog
        open={removePortfolioIntent !== null}
        onClose={() => {
          if (!removePortfolioMutation.isPending) {
            setRemovePortfolioIntent(null);
          }
        }}
        onConfirm={() =>
          removePortfolioIntent ? removePortfolioMutation.mutateAsync(removePortfolioIntent.uid) : null
        }
        onSuccess={() => {
          setRemovePortfolioIntent(null);
        }}
        title="Remove portfolio"
        description="This removes only the membership row between this portfolio group and the selected portfolio."
        tone="danger"
        actionLabel="remove the selected portfolio"
        confirmButtonLabel="Remove portfolio"
        confirmWord="REMOVE"
        objectLabel="portfolio"
        objectSummary={renderRemoveSummary(removePortfolioIntent)}
        isPending={removePortfolioMutation.isPending}
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

      <ActionConfirmationDialog
        open={deleteGroupDialogOpen}
        onClose={() => {
          if (!deletePortfolioGroupMutation.isPending) {
            setDeleteGroupDialogOpen(false);
          }
        }}
        onConfirm={() => deletePortfolioGroupMutation.mutateAsync()}
        onSuccess={() => {
          setDeleteGroupDialogOpen(false);
          navigate(backPath);
        }}
        title="Delete portfolio group"
        description="This deletes the portfolio group metadata. Membership rows cascade, and portfolios remain."
        tone="danger"
        actionLabel="delete this portfolio group"
        confirmButtonLabel="Delete group"
        confirmWord="DELETE"
        objectLabel="portfolio group"
        objectSummary={renderGroupSummary(portfolioGroupDetailQuery.data)}
        isPending={deletePortfolioGroupMutation.isPending}
        error={
          deletePortfolioGroupMutation.isError
            ? formatMainSequenceError(deletePortfolioGroupMutation.error)
            : undefined
        }
        successToast={{
          title: "Portfolio group deleted",
          description: (result) => readDeleteDetail(result) || "The portfolio group was removed.",
        }}
      />
    </div>
  );
}
