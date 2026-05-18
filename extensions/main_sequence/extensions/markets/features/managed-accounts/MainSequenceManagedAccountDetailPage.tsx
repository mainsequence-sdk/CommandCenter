import { useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import {
  fetchManagedAccountSummary,
  formatMainSequenceError,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { portfolioWeightsWidget } from "../../widgets/portfolio-weights-table/definition";
import { PortfolioWeightsWidget } from "../../widgets/portfolio-weights-table/PortfolioWeightsWidget";
import type { PortfolioWeightsWidgetProps } from "../../widgets/portfolio-weights-table/portfolioWeightsRuntime";
import { getManagedAccountsListPath } from "./managedAccountShared";

export const managedAccountDetailTabs = [
  { id: "holdings", label: "Holdings" },
  { id: "rebalance", label: "Rebalance" },
] as const;

export type ManagedAccountDetailTabId =
  (typeof managedAccountDetailTabs)[number]["id"];

const defaultManagedAccountDetailTabId: ManagedAccountDetailTabId = "holdings";

const initialManagedAccountHoldingsEditorProps: PortfolioWeightsWidgetProps = {
  editableInPlace: true,
  dataMode: "inline",
  variant: "positions",
  inlineRows: [],
};

function isManagedAccountDetailTabId(
  value: string | null,
): value is ManagedAccountDetailTabId {
  return managedAccountDetailTabs.some((tab) => tab.id === value);
}

function readPositiveInt(value: string | null | undefined) {
  const parsed = Number(value ?? "");

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function MainSequenceManagedAccountDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const managedAccountId = readPositiveInt(params.accountId);
  const backPath =
    ((location.state as { from?: string } | null)?.from || "").trim() ||
    getManagedAccountsListPath();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedTabId = isManagedAccountDetailTabId(searchParams.get("accountTab"))
    ? searchParams.get("accountTab")
    : defaultManagedAccountDetailTabId;
  const [holdingsEditorVisible, setHoldingsEditorVisible] = useState(false);
  const [holdingsEditorProps, setHoldingsEditorProps] = useState<PortfolioWeightsWidgetProps>(
    initialManagedAccountHoldingsEditorProps,
  );

  const managedAccountSummaryQuery = useQuery({
    queryKey: ["main_sequence", "managed_accounts", "summary", managedAccountId],
    queryFn: () => fetchManagedAccountSummary(managedAccountId as number),
    enabled: managedAccountId !== null,
  });

  function selectTab(tabId: ManagedAccountDetailTabId) {
    const nextParams = new URLSearchParams(location.search);
    nextParams.set("accountTab", tabId);
    navigate(
      {
        pathname: location.pathname,
        search: `?${nextParams.toString()}`,
      },
      { replace: true },
    );
  }

  if (managedAccountId === null) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Main Sequence Markets"
          title="Managed Account"
          description="The requested account id is invalid."
          actions={
            <Button type="button" variant="outline" onClick={() => navigate(backPath)}>
              <ArrowLeft className="h-4 w-4" />
              Back to accounts
            </Button>
          }
        />
      </div>
    );
  }

  const managedAccountTitle =
    managedAccountSummaryQuery.data?.entity.title?.trim() || `Account ${managedAccountId}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title={managedAccountTitle}
        description="Review the canonical managed account summary."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{`ID ${managedAccountId}`}</Badge>
            <Button type="button" variant="outline" onClick={() => navigate(backPath)}>
              <ArrowLeft className="h-4 w-4" />
              Back to accounts
            </Button>
          </div>
        }
      />

      {managedAccountSummaryQuery.isError ? (
        <Card>
          <CardContent className="p-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(managedAccountSummaryQuery.error)}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {managedAccountSummaryQuery.data ? (
        <MainSequenceEntitySummaryCard summary={managedAccountSummaryQuery.data} />
      ) : (
        <Card>
          <CardContent className="flex min-h-40 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading account summary
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b border-border/70 pb-4">
          <div className="flex flex-wrap gap-2">
            {managedAccountDetailTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={
                  tab.id === selectedTabId
                    ? "rounded-[calc(var(--radius)-8px)] border border-primary/35 bg-primary/12 px-3 py-2 text-sm font-medium text-topbar-foreground"
                    : "rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/36 hover:text-foreground"
                }
                onClick={() => selectTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {selectedTabId === "holdings" ? (
            <Card variant="nested">
              <CardHeader className="border-b border-border/70 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base">Holdings</CardTitle>
                    <CardDescription>
                      Use the inline positions editor to draft or review holdings before a dedicated account holdings endpoint exists.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant={holdingsEditorVisible ? "outline" : "default"}
                    onClick={() => {
                      setHoldingsEditorVisible((current) => !current);
                    }}
                  >
                    {holdingsEditorVisible ? "Hide holdings editor" : "Update holdings"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-5">
                {holdingsEditorVisible ? (
                  <PortfolioWeightsWidget
                    widget={portfolioWeightsWidget}
                    props={holdingsEditorProps}
                    editable
                    onPropsChange={setHoldingsEditorProps}
                  />
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Open <span className="font-medium text-foreground">Update holdings</span> to
                    edit positions directly in this account view.
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card variant="nested">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Rebalance</CardTitle>
                <CardDescription>
                  Rebalance content has not been connected to an account endpoint yet.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground">
                Add the managed-account rebalance workflow here when the backend exposes the
                account rebalance view.
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
