import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Database, Loader2 } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import {
  fetchManagedAccountHoldingsPositionDetails,
  fetchManagedAccountTargetPositionsPositionDetails,
  fetchManagedAccountSummary,
  formatMainSequenceError,
  listVirtualFunds,
  mainSequenceRegistryPageSize,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import { positionDetailWidget } from "../../widgets/position-detail/definition";
import { PositionDetailWidget } from "../../widgets/position-detail/PositionDetailWidget";
import type { PositionDetailWidgetProps } from "../../widgets/position-detail/positionDetailRuntime";
import { getVirtualFundDetailPath } from "../funds/fundShared";
import { openMainSequenceMarketsSummaryLink } from "../summaryLinks";
import { getManagedAccountsListPath } from "./managedAccountShared";

export const managedAccountDetailTabs = [
  { id: "holdings", label: "Holdings" },
  { id: "target-allocation", label: "Target Allocation" },
  { id: "virtual-funds", label: "Virtual Funds" },
] as const;

export type ManagedAccountDetailTabId =
  (typeof managedAccountDetailTabs)[number]["id"];

const defaultManagedAccountDetailTabId: ManagedAccountDetailTabId = "holdings";

function buildManagedAccountHoldingsWidgetProps(
  accountUid: string | null,
): PositionDetailWidgetProps {
  return {
    editableInPlace: true,
    sourceType: "account",
    accountUid: accountUid ?? undefined,
    variant: "positions",
    positionRows: [],
  };
}

function buildManagedAccountTargetPositionWidgetProps(
  accountUid: string | null,
): PositionDetailWidgetProps {
  return {
    editableInPlace: true,
    sourceType: "target_positions_account",
    accountUid: accountUid ?? undefined,
    variant: "positions",
    positionRows: [],
  };
}

function isManagedAccountDetailTabId(
  value: string | null,
): value is ManagedAccountDetailTabId {
  return managedAccountDetailTabs.some((tab) => tab.id === value);
}

function normalizeManagedAccountDetailTabId(value: string | null): ManagedAccountDetailTabId | null {
  if (value === "rebalance" || value === "target-position") {
    return "target-allocation";
  }

  return isManagedAccountDetailTabId(value) ? value : null;
}

function normalizeManagedAccountUid(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function formatVirtualFundUid(value: string | null | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : "UID unavailable";
}

function formatLinkedUid(value: string | null | undefined, label: string) {
  const trimmedValue = value?.trim();
  return trimmedValue ? `${label} ${trimmedValue}` : `${label} not linked`;
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
    useState<PositionDetailWidgetProps>(() =>
      buildManagedAccountTargetPositionWidgetProps(managedAccountUid),
    );
  const [holdingsWidgetProps, setHoldingsWidgetProps] =
    useState<PositionDetailWidgetProps>(() =>
      buildManagedAccountHoldingsWidgetProps(managedAccountUid),
    );

  useEffect(
    () => {
      setHoldingsWidgetProps(buildManagedAccountHoldingsWidgetProps(managedAccountUid));
    },
    [managedAccountUid],
  );

  useEffect(
    () => {
      setTargetPositionEditorProps(buildManagedAccountTargetPositionWidgetProps(managedAccountUid));
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

  const targetPositionsRuntimeQuery = useQuery({
    queryKey: [
      "main_sequence",
      "managed_accounts",
      "target_positions",
      managedAccountUid,
    ],
    queryFn: () =>
      fetchManagedAccountTargetPositionsPositionDetails(managedAccountUid as string),
    enabled: managedAccountUid !== null,
  });

  const virtualFundsQuery = useQuery({
    queryKey: [
      "main_sequence",
      "virtual_funds",
      "account_detail",
      managedAccountUid,
    ],
    queryFn: () =>
      listVirtualFunds({
        accountUid: managedAccountUid as string,
        limit: mainSequenceRegistryPageSize,
        offset: 0,
      }),
    enabled: managedAccountUid !== null && selectedTabId === "virtual-funds",
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
  const headerDescription = `UID ${managedAccountUid}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title={managedAccountTitle}
        description={headerDescription || "Review the canonical managed account summary."}
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
        <MainSequenceEntitySummaryCard
          summary={managedAccountSummaryQuery.data}
          onSummaryItemLinkClick={(linkUrl) =>
            openMainSequenceMarketsSummaryLink(navigate, linkUrl)
          }
        />
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
                <PositionDetailWidget
                  widget={positionDetailWidget}
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
          ) : selectedTabId === "target-allocation" ? (
            <Card variant="nested">
              <CardHeader className="border-b border-border/70 pb-4">
                <CardTitle className="text-base">Target Allocation</CardTitle>
                <CardDescription>
                  Draft or review target allocation rows directly in this account view and save them through the account target allocation assignment endpoint.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                <PositionDetailWidget
                  widget={positionDetailWidget}
                  props={targetPositionEditorProps}
                  editable
                  onPropsChange={setTargetPositionEditorProps}
                  runtimeState={
                    targetPositionsRuntimeQuery.isError
                      ? {
                          status: "error",
                          error: formatMainSequenceError(targetPositionsRuntimeQuery.error),
                          accountUid: managedAccountUid ?? undefined,
                          variant: "positions",
                          payload: undefined,
                        }
                      : targetPositionsRuntimeQuery.isLoading
                        ? {
                            status: "loading",
                            error: undefined,
                            accountUid: managedAccountUid ?? undefined,
                            variant: "positions",
                            payload: undefined,
                          }
                        : targetPositionsRuntimeQuery.data
                          ? {
                              status: "success",
                              error: undefined,
                              accountUid: managedAccountUid ?? undefined,
                              variant: "positions",
                              payload: targetPositionsRuntimeQuery.data,
                            }
                          : undefined
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <Card variant="nested">
              <CardHeader className="border-b border-border/70 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Virtual Funds</CardTitle>
                    <CardDescription>
                      Review virtual funds linked to this managed account.
                    </CardDescription>
                  </div>
                  <Badge variant="neutral">
                    {`${virtualFundsQuery.data?.count ?? 0} funds`}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                {virtualFundsQuery.isLoading ? (
                  <div className="flex min-h-48 items-center justify-center">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading virtual funds
                    </div>
                  </div>
                ) : null}

                {virtualFundsQuery.isError ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {formatMainSequenceError(virtualFundsQuery.error)}
                  </div>
                ) : null}

                {!virtualFundsQuery.isLoading &&
                !virtualFundsQuery.isError &&
                (virtualFundsQuery.data?.results ?? []).length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                      <Database className="h-6 w-6" />
                    </div>
                    <div className="mt-4 text-sm font-medium text-foreground">
                      No virtual funds linked
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      This account does not have virtual funds in the current registry result.
                    </p>
                  </div>
                ) : null}

                {!virtualFundsQuery.isLoading &&
                !virtualFundsQuery.isError &&
                (virtualFundsQuery.data?.results ?? []).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          <th className="px-4 pb-2">Virtual Fund</th>
                          <th className="px-4 pb-2">Portfolio</th>
                          <th className="px-4 pb-2">Account</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(virtualFundsQuery.data?.results ?? []).map((fund) => (
                          <tr key={fund.uid}>
                            <td className={getRegistryTableCellClassName(false, "left")}>
                              <Link
                                to={getVirtualFundDetailPath(fund.uid)}
                                className="group inline-flex max-w-full items-center gap-1.5 font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary focus-visible:text-primary focus-visible:decoration-primary focus-visible:outline-none"
                              >
                                <span className="truncate">
                                  {formatVirtualFundUid(fund.unique_identifier)}
                                </span>
                                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                              </Link>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {formatVirtualFundUid(fund.uid)}
                              </div>
                            </td>
                            <td className={getRegistryTableCellClassName(false)}>
                              <div className="font-mono text-sm text-foreground">
                                {formatLinkedUid(fund.target_portfolio_uid, "Portfolio UID")}
                              </div>
                            </td>
                            <td className={getRegistryTableCellClassName(false, "right")}>
                              <div className="font-mono text-sm text-foreground">
                                {formatLinkedUid(fund.account_uid, "Account UID")}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(virtualFundsQuery.data?.count ?? 0) >
                    (virtualFundsQuery.data?.results ?? []).length ? (
                      <div className="mt-3 text-xs text-muted-foreground">
                        Showing the first {virtualFundsQuery.data?.results.length ?? 0} linked
                        virtual funds.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
