import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, LayoutDashboard, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  fetchResourceReleaseExchangeLaunch,
  formatMainSequenceError,
  listResourceReleaseGallery,
  mainSequenceRegistryPageSize,
  type ResourceReleaseExchangeLaunchResponse,
  type ResourceReleaseGalleryRecord,
} from "../../../../common/api";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";

const streamlitDashboardReleaseKind = "streamlit_dashboard";

function matchesDashboardSearch(dashboard: ResourceReleaseGalleryRecord, needle: string) {
  if (!needle) {
    return true;
  }

  return [
    dashboard.title,
    dashboard.resource_name,
    dashboard.project_name,
    dashboard.subdomain,
    dashboard.public_url ?? "",
    String(dashboard.id),
    String(dashboard.project_id),
    String(dashboard.resource_id),
  ]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

function formatRepoHash(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return value.length > 12 ? value.slice(0, 12) : value;
}

function DashboardMetaItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/35 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm text-foreground">{value}</div>
    </div>
  );
}

function resolveExchangeLaunchTarget(payload: ResourceReleaseExchangeLaunchResponse) {
  if (payload.mode === "url") {
    return payload.url;
  }

  const launchUrl = new URL(payload.rpc_url, window.location.origin);
  launchUrl.hash = new URLSearchParams({ token: payload.token }).toString();

  return launchUrl.toString();
}

export function MainSequenceStreamlitPage() {
  const { toast } = useToast();
  const [searchValue, setSearchValue] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedDashboardId, setSelectedDashboardId] = useState<number | null>(null);
  const [launchingDashboardId, setLaunchingDashboardId] = useState<number | null>(null);
  const deferredSearchValue = useDeferredValue(searchValue);
  const normalizedSearchValue = deferredSearchValue.trim().toLowerCase();

  const dashboardsQuery = useQuery({
    queryKey: ["main_sequence", "resource-release-gallery", "streamlit"],
    queryFn: () => listResourceReleaseGallery({ exclude: "agents" }),
  });

  const dashboards = useMemo(
    () =>
      (dashboardsQuery.data?.results ?? []).filter(
        (release) => release.release_kind === streamlitDashboardReleaseKind,
      ),
    [dashboardsQuery.data?.results],
  );
  const filteredDashboards = useMemo(
    () => dashboards.filter((dashboard) => matchesDashboardSearch(dashboard, normalizedSearchValue)),
    [dashboards, normalizedSearchValue],
  );
  const totalItems = filteredDashboards.length;
  const selectedDashboard = useMemo(
    () => dashboards.find((dashboard) => dashboard.id === selectedDashboardId) ?? null,
    [dashboards, selectedDashboardId],
  );
  const pageRows = useMemo(() => {
    const start = pageIndex * mainSequenceRegistryPageSize;
    return filteredDashboards.slice(start, start + mainSequenceRegistryPageSize);
  }, [filteredDashboards, pageIndex]);

  useEffect(() => {
    setPageIndex(0);
  }, [normalizedSearchValue]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalItems / mainSequenceRegistryPageSize));

    if (pageIndex > totalPages - 1) {
      setPageIndex(totalPages - 1);
    }
  }, [pageIndex, totalItems]);

  async function openStreamlitRelease(dashboard: ResourceReleaseGalleryRecord) {
    const fallbackUrl = dashboard.public_url;

    if (!dashboard.exchange_launch_url && !fallbackUrl) {
      toast({
        variant: "error",
        title: "Launch target unavailable",
        description: "This Streamlit release does not expose a launch URL yet.",
      });
      return;
    }

    const openedWindow = window.open("", "_blank");

    if (!openedWindow) {
      toast({
        variant: "error",
        title: "Streamlit launch blocked",
        description: "Allow pop-ups for this site to open Streamlit in a new tab.",
      });
      return;
    }

    openedWindow.opener = null;
    setLaunchingDashboardId(dashboard.id);

    try {
      const targetUrl = dashboard.exchange_launch_url
        ? resolveExchangeLaunchTarget(
            await fetchResourceReleaseExchangeLaunch(dashboard.exchange_launch_url),
          )
        : fallbackUrl;

      if (!targetUrl) {
        throw new Error("No launch target was returned for this Streamlit release.");
      }

      openedWindow.location.href = targetUrl;
    } catch (error) {
      openedWindow.close();
      toast({
        variant: "error",
        title: "Unable to open Streamlit",
        description: formatMainSequenceError(error),
      });
    } finally {
      setLaunchingDashboardId((currentDashboardId) =>
        currentDashboardId === dashboard.id ? null : currentDashboardId,
      );
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence"
        title="Streamlit"
        description="Browse published Streamlit releases and open their exchange launch targets."
        actions={<Badge variant="neutral">{`${totalItems} releases`}</Badge>}
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Streamlit gallery</CardTitle>
              <CardDescription>
                Streamlit resource releases from the gallery endpoint, excluding agent-backed entries.
              </CardDescription>
            </div>
            <MainSequenceRegistrySearch
              accessory={<Badge variant="neutral">{`${totalItems} releases`}</Badge>}
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search by title, project, resource, subdomain, or release id"
              searchClassName="max-w-xl"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {dashboardsQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading Streamlit releases
              </div>
            </div>
          ) : null}

          {dashboardsQuery.isError ? (
            <div className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(dashboardsQuery.error)}
              </div>
            </div>
          ) : null}

          {!dashboardsQuery.isLoading && !dashboardsQuery.isError && totalItems === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <LayoutDashboard className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No Streamlit releases found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Adjust the current search or publish a Streamlit resource release to populate this gallery.
              </p>
            </div>
          ) : null}

          {!dashboardsQuery.isLoading && !dashboardsQuery.isError && totalItems > 0 ? (
            <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
              {pageRows.map((dashboard) => {
                const title = dashboard.title || dashboard.resource_name || `Dashboard ${dashboard.id}`;
                const resourceName =
                  dashboard.resource_name || `Resource ${dashboard.resource_id}`;
                const projectName = dashboard.project_name || `Project ${dashboard.project_id}`;
                const subtitle = [resourceName, dashboard.subdomain].filter(Boolean).join(" · ");
                const isLaunching = launchingDashboardId === dashboard.id;
                const canLaunch = Boolean(dashboard.exchange_launch_url || dashboard.public_url);

                return (
                  <Card key={dashboard.id} className="border-border/70 bg-card/80">
                    <CardHeader className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="primary">Streamlit</Badge>
                        <Badge variant="neutral">{projectName}</Badge>
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-base">{title}</CardTitle>
                        <CardDescription>{subtitle || `Release #${dashboard.id}`}</CardDescription>
                      </div>
                    </CardHeader>

                    <CardContent className="flex items-center justify-between gap-3 pt-0">
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{`#${dashboard.id}`}</span>
                        <span>{` · ${formatRepoHash(dashboard.project_repo_hash)}`}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedDashboardId(dashboard.id)}
                        >
                          Details
                        </Button>
                        {canLaunch ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void openStreamlitRelease(dashboard)}
                            disabled={isLaunching}
                          >
                            {isLaunching ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            )}
                            {isLaunching ? "Opening" : "Open"}
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : null}

          {!dashboardsQuery.isLoading && !dashboardsQuery.isError && totalItems > 0 ? (
            <MainSequenceRegistryPagination
              count={totalItems}
              itemLabel="streamlit releases"
              pageIndex={pageIndex}
              pageSize={mainSequenceRegistryPageSize}
              onPageChange={setPageIndex}
            />
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={selectedDashboard !== null}
        onClose={() => setSelectedDashboardId(null)}
        title={
          selectedDashboard?.title ||
          selectedDashboard?.resource_name ||
          (selectedDashboard ? `Streamlit release ${selectedDashboard.id}` : "Streamlit details")
        }
        description={
          selectedDashboard
            ? [
                selectedDashboard.project_name || `Project ${selectedDashboard.project_id}`,
                selectedDashboard.resource_name || `Resource ${selectedDashboard.resource_id}`,
              ].join(" · ")
            : undefined
        }
        className="max-w-[min(760px,calc(100vw-24px))]"
      >
        {selectedDashboard ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">Streamlit</Badge>
              <Badge variant="neutral">
                {selectedDashboard.project_name || `Project ${selectedDashboard.project_id}`}
              </Badge>
              <Badge variant="neutral">{`Release #${selectedDashboard.id}`}</Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <DashboardMetaItem
                label="Project"
                value={selectedDashboard.project_name || `Project ${selectedDashboard.project_id}`}
              />
              <DashboardMetaItem
                label="Resource"
                value={
                  selectedDashboard.resource_name ||
                  `Resource ${selectedDashboard.resource_id}`
                }
              />
              <DashboardMetaItem
                label="Subdomain"
                value={selectedDashboard.subdomain || "Not available"}
              />
              <DashboardMetaItem
                label="Image"
                value={
                  selectedDashboard.image_id
                    ? String(selectedDashboard.image_id)
                    : "Not available"
                }
              />
              <DashboardMetaItem
                label="Repo hash"
                value={formatRepoHash(selectedDashboard.project_repo_hash)}
              />
              <DashboardMetaItem
                label="Release kind"
                value={selectedDashboard.release_kind || "Not available"}
              />
            </div>

            <div className="rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/35 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Public URL
              </div>
              {selectedDashboard.public_url ? (
                <div className="mt-2 break-all font-mono text-xs text-primary">
                  {selectedDashboard.public_url}
                </div>
              ) : (
                <div className="mt-2 text-sm text-muted-foreground">Not available</div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedDashboardId(null)}
              >
                Close
              </Button>
              {selectedDashboard.exchange_launch_url || selectedDashboard.public_url ? (
                <Button
                  type="button"
                  onClick={() => void openStreamlitRelease(selectedDashboard)}
                  disabled={launchingDashboardId === selectedDashboard.id}
                >
                  {launchingDashboardId === selectedDashboard.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                  {launchingDashboardId === selectedDashboard.id
                    ? "Opening Streamlit"
                    : "Open Streamlit"}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
