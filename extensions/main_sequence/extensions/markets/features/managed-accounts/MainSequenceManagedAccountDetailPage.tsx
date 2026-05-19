import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import {
  fetchManagedAccountHoldingsPositionDetails,
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
  { id: "target-position", label: "Target Position" },
] as const;

export type ManagedAccountDetailTabId =
  (typeof managedAccountDetailTabs)[number]["id"];

const defaultManagedAccountDetailTabId: ManagedAccountDetailTabId = "holdings";

function buildManagedAccountHoldingsWidgetProps(
  accountId: number | null,
): PortfolioWeightsWidgetProps {
  return {
    editableInPlace: true,
    sourceType: "account",
    accountId: accountId ?? undefined,
    variant: "positions",
    positionRows: [],
  };
}

const initialManagedAccountTargetPositionEditorProps: PortfolioWeightsWidgetProps = {
  editableInPlace: true,
  sourceType: "target_position",
  variant: "positions",
  positionRows: [],
};

function isManagedAccountDetailTabId(
  value: string | null,
): value is ManagedAccountDetailTabId {
  return managedAccountDetailTabs.some((tab) => tab.id === value);
}

function normalizeManagedAccountDetailTabId(value: string | null): ManagedAccountDetailTabId | null {
  if (value === "rebalance") {
    return "target-position";
  }

  return isManagedAccountDetailTabId(value) ? value : null;
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
  const selectedTabId =
    normalizeManagedAccountDetailTabId(searchParams.get("accountTab")) ??
    defaultManagedAccountDetailTabId;
  const [targetPositionEditorProps, setTargetPositionEditorProps] =
    useState<PortfolioWeightsWidgetProps>(initialManagedAccountTargetPositionEditorProps);
  const [holdingsWidgetProps, setHoldingsWidgetProps] =
    useState<PortfolioWeightsWidgetProps>(() =>
      buildManagedAccountHoldingsWidgetProps(managedAccountId),
    );

  useEffect(
    () => {
      setHoldingsWidgetProps(buildManagedAccountHoldingsWidgetProps(managedAccountId));
    },
    [managedAccountId],
  );

  const managedAccountSummaryQuery = useQuery({
    queryKey: ["main_sequence", "managed_accounts", "summary", managedAccountId],
    queryFn: () => fetchManagedAccountSummary(managedAccountId as number),
    enabled: managedAccountId !== null,
  });

  const holdingsRuntimeQuery = useQuery({
    queryKey: [
      "main_sequence",
      "managed_accounts",
      "holdings",
      managedAccountId,
    ],
    queryFn: () => fetchManagedAccountHoldingsPositionDetails(managedAccountId as number),
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
                <CardTitle className="text-base">Holdings</CardTitle>
                <CardDescription>
                  Review the latest canonical holdings snapshot resolved directly from the managed account.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                <PortfolioWeightsWidget
                  widget={portfolioWeightsWidget}
                  props={holdingsWidgetProps}
                  editable
                  onPropsChange={setHoldingsWidgetProps}
                  runtimeState={
                    holdingsRuntimeQuery.isError
                      ? {
                          status: "error",
                          error: formatMainSequenceError(holdingsRuntimeQuery.error),
                          accountId: managedAccountId ?? undefined,
                          variant: "positions",
                          payload: undefined,
                        }
                      : holdingsRuntimeQuery.isLoading
                        ? {
                            status: "loading",
                            error: undefined,
                            accountId: managedAccountId ?? undefined,
                            variant: "positions",
                            payload: undefined,
                          }
                        : holdingsRuntimeQuery.data
                          ? {
                              status: "success",
                              error: undefined,
                              accountId: managedAccountId ?? undefined,
                              variant: "positions",
                              payload: holdingsRuntimeQuery.data,
                            }
                          : undefined
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <Card variant="nested">
              <CardHeader className="border-b border-border/70 pb-4">
                <CardTitle className="text-base">Target Position</CardTitle>
                <CardDescription>
                  Draft or review target-position rows directly in this account view until a dedicated target-position endpoint exists.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                <PortfolioWeightsWidget
                  widget={portfolioWeightsWidget}
                  props={targetPositionEditorProps}
                  editable
                  onPropsChange={setTargetPositionEditorProps}
                />
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
