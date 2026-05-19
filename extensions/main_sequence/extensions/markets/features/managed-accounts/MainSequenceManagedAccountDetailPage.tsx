import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

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
  accountUid: string | null,
): PortfolioWeightsWidgetProps {
  return {
    editableInPlace: true,
    sourceType: "account",
    accountUid: accountUid ?? undefined,
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

function normalizeManagedAccountUid(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function MainSequenceManagedAccountDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const managedAccountUid = normalizeManagedAccountUid(params.accountUid);
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
      buildManagedAccountHoldingsWidgetProps(managedAccountUid),
    );

  useEffect(
    () => {
      setHoldingsWidgetProps(buildManagedAccountHoldingsWidgetProps(managedAccountUid));
    },
    [managedAccountUid],
  );

  const managedAccountSummaryQuery = useQuery({
    queryKey: ["main_sequence", "managed_accounts", "summary", managedAccountUid],
    queryFn: () => fetchManagedAccountSummary(managedAccountUid as string),
    enabled: managedAccountUid !== null,
  });

  const holdingsRuntimeQuery = useQuery({
    queryKey: [
      "main_sequence",
      "managed_accounts",
      "holdings",
      managedAccountUid,
    ],
    queryFn: () => fetchManagedAccountHoldingsPositionDetails(managedAccountUid as string),
    enabled: managedAccountUid !== null,
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

  if (managedAccountUid === null) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Main Sequence Markets"
          title="Managed Account"
          description="The requested account uid is invalid."
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
    managedAccountSummaryQuery.data?.entity.title?.trim() || "Managed account";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title={managedAccountTitle}
        description="Review the canonical managed account summary."
        actions={
          <Button type="button" variant="outline" onClick={() => navigate(backPath)}>
            <ArrowLeft className="h-4 w-4" />
            Back to accounts
          </Button>
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
                          accountUid: managedAccountUid ?? undefined,
                          variant: "positions",
                          payload: undefined,
                        }
                      : holdingsRuntimeQuery.isLoading
                        ? {
                            status: "loading",
                            error: undefined,
                            accountUid: managedAccountUid ?? undefined,
                            variant: "positions",
                            payload: undefined,
                          }
                        : holdingsRuntimeQuery.data
                          ? {
                              status: "success",
                              error: undefined,
                              accountUid: managedAccountUid ?? undefined,
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
