import type { ReactNode } from "react";

import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { getCurrentUserCredits, type OrganizationCreditsPolicy } from "./apps/admin/api";

function formatCreditsError(error: unknown) {
  return error instanceof Error ? error.message : "The credits request failed.";
}

function formatAmount(cents: number, currency: string) {
  const amount = Number(cents || 0) / 100;
  const normalizedCurrency = String(currency || "usd").toUpperCase();

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: normalizedCurrency,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function normalizePolicyMode(
  mode: OrganizationCreditsPolicy["mode"] | undefined,
  isEnabled = true,
): "allocated" | "organization_pool" | "disabled" {
  if (!isEnabled) {
    return "disabled";
  }

  if (mode === "organization_pool") {
    return "organization_pool";
  }

  if (mode === "disabled") {
    return "disabled";
  }

  return "allocated";
}

function formatPolicyMode(mode: "allocated" | "organization_pool" | "disabled") {
  switch (mode) {
    case "organization_pool":
      return "Organization pool";
    case "disabled":
      return "Disabled";
    default:
      return "Allocated";
  }
}

function getPolicyBadgeVariant(mode: "allocated" | "organization_pool" | "disabled") {
  switch (mode) {
    case "organization_pool":
      return "primary" as const;
    case "disabled":
      return "warning" as const;
    default:
      return "success" as const;
  }
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
        <div className="mt-2 text-[var(--font-size-card-value)] font-semibold tracking-tight text-foreground">
          {value}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-3 last:border-b-0 last:pb-0 first:pt-0">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-right text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

export function UserCreditsSettingsSection() {
  const userCreditsQuery = useQuery({
    queryKey: ["user", "credits"],
    queryFn: getCurrentUserCredits,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const credits = userCreditsQuery.data;
  const policyMode = normalizePolicyMode(credits?.policy?.mode, credits?.policy?.is_enabled ?? true);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void userCreditsQuery.refetch();
          }}
          disabled={userCreditsQuery.isFetching}
        >
          {userCreditsQuery.isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {userCreditsQuery.isLoading ? (
        <Card>
          <CardContent className="flex min-h-40 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your credits
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!userCreditsQuery.isLoading && userCreditsQuery.isError ? (
        <Card>
          <CardContent className="p-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatCreditsError(userCreditsQuery.error)}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!userCreditsQuery.isLoading && !userCreditsQuery.isError && credits ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Available"
              value={formatAmount(credits.available_cents, credits.currency)}
              detail="What you can spend right now"
            />
            <MetricCard
              label="Your Balance"
              value={formatAmount(credits.user_balance_cents, credits.currency)}
              detail="Current balance assigned to your account"
            />
            <MetricCard
              label="Organization Balance"
              value={formatAmount(credits.organization_balance_cents, credits.currency)}
              detail="Current organization prepaid balance"
            />
          </div>

          <Card>
            <CardHeader className="border-b border-border/70">
              <CardTitle>Credit policy</CardTitle>
              <CardDescription>
                Review the credit policy currently applied to your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <div className="space-y-0">
                <DetailRow
                  label="Policy mode"
                  value={
                    <Badge variant={getPolicyBadgeVariant(policyMode)}>
                      {formatPolicyMode(policyMode)}
                    </Badge>
                  }
                />
                <DetailRow
                  label="Monthly limit"
                  value={formatAmount(credits.policy?.monthly_limit_cents ?? 0, credits.currency)}
                />
                <DetailRow
                  label="Spendable"
                  value={
                    <Badge variant={credits.has_spendable_credits ? "success" : "warning"}>
                      {credits.has_spendable_credits ? "Available" : "Exhausted"}
                    </Badge>
                  }
                />
                <DetailRow
                  label="Auto-reload"
                  value={
                    <Badge variant={credits.policy?.auto_reload_enabled ? "success" : "neutral"}>
                      {credits.policy?.auto_reload_enabled ? "Enabled" : "Off"}
                    </Badge>
                  }
                />
                <DetailRow
                  label="Auto-reload threshold"
                  value={formatAmount(
                    credits.policy?.auto_reload_threshold_cents ?? 0,
                    credits.currency,
                  )}
                />
                <DetailRow
                  label="Auto-reload amount"
                  value={formatAmount(
                    credits.policy?.auto_reload_amount_cents ?? 0,
                    credits.currency,
                  )}
                />
                <DetailRow
                  label="Auto-reload monthly limit"
                  value={formatAmount(
                    credits.policy?.auto_reload_monthly_limit_cents ?? 0,
                    credits.currency,
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
