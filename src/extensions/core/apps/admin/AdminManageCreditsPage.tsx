import type { ReactNode } from "react";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {
  fetchCurrentOrganizationId,
  getOrganizationCredits,
  type OrganizationCreditsResponse,
} from "./api";
import { AdminSurfaceLayout } from "./shared";

function formatAdminError(error: unknown) {
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

function formatCurrencyCode(currency: string) {
  const normalizedCurrency = currency.trim().toUpperCase();
  return normalizedCurrency || "USD";
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

function CreditsContent({
  credits,
}: {
  credits: OrganizationCreditsResponse;
}) {
  const autoReloadCurrency = credits.auto_reload.currency || credits.currency;
  const autoReloadStatus = credits.auto_reload.enabled ? "Enabled" : "Disabled";
  const spendableStatus = credits.has_spendable_credits ? "Available" : "Exhausted";

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-3">
        <MetricCard
          label="Credit Balance"
          value={formatAmount(credits.balance_cents, credits.currency)}
          detail={`${credits.balance_cents} cents currently posted to the organization ledger`}
        />
        <MetricCard
          label="Spendable Status"
          value={spendableStatus}
          detail={
            credits.has_spendable_credits
              ? "Credits are currently available for cost-generating operations."
              : "No spendable credits are currently available."
          }
        />
        <MetricCard
          label="Auto Reload"
          value={autoReloadStatus}
          detail={
            credits.auto_reload.enabled
              ? `Threshold ${formatAmount(credits.auto_reload.threshold_cents, autoReloadCurrency)}`
              : "Automatic credit reload is currently disabled."
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Card>
          <CardHeader className="border-b border-border/70">
            <CardTitle>Auto-reload configuration</CardTitle>
            <CardDescription>
              Review the current threshold, reload amount, and payment readiness.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <div className="space-y-0">
              <DetailRow
                label="Status"
                value={
                  <Badge variant={credits.auto_reload.enabled ? "success" : "neutral"}>
                    {autoReloadStatus}
                  </Badge>
                }
              />
              <DetailRow
                label="Threshold"
                value={formatAmount(credits.auto_reload.threshold_cents, autoReloadCurrency)}
              />
              <DetailRow
                label="Reload amount"
                value={formatAmount(credits.auto_reload.reload_amount_cents, autoReloadCurrency)}
              />
              <DetailRow
                label="Monthly limit"
                value={formatAmount(credits.auto_reload.monthly_limit_cents, autoReloadCurrency)}
              />
              <DetailRow
                label="Payment method"
                value={
                  <Badge
                    variant={credits.auto_reload.has_payment_method ? "success" : "warning"}
                  >
                    {credits.auto_reload.has_payment_method ? "On file" : "Missing"}
                  </Badge>
                }
              />
              <DetailRow
                label="Currency"
                value={<Badge variant="neutral">{formatCurrencyCode(autoReloadCurrency)}</Badge>}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/70">
            <CardTitle>Credit account</CardTitle>
            <CardDescription>
              Current organization-scoped credit state returned by the billing API.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <div className="space-y-0">
              <DetailRow label="Organization ID" value={String(credits.organization_id)} />
              <DetailRow
                label="Balance"
                value={formatAmount(credits.balance_cents, credits.currency)}
              />
              <DetailRow
                label="Currency"
                value={<Badge variant="neutral">{formatCurrencyCode(credits.currency)}</Badge>}
              />
              <DetailRow
                label="Spendable"
                value={
                  <Badge
                    variant={credits.has_spendable_credits ? "success" : "warning"}
                  >
                    {spendableStatus}
                  </Badge>
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export function AdminManageCreditsPage() {
  const organizationIdQuery = useQuery({
    queryKey: ["admin", "organization", "id"],
    queryFn: fetchCurrentOrganizationId,
    staleTime: 300_000,
  });
  const creditsQuery = useQuery({
    queryKey: ["admin", "organization", organizationIdQuery.data, "credits"],
    queryFn: () => getOrganizationCredits(organizationIdQuery.data!),
    enabled: typeof organizationIdQuery.data === "number",
    retry: false,
    staleTime: 60_000,
  });

  const loading = organizationIdQuery.isLoading || creditsQuery.isLoading;
  const error = organizationIdQuery.error ?? creditsQuery.error;

  return (
    <AdminSurfaceLayout
      title="Manage Credits"
      description="Review current organization credits and the active auto-reload configuration."
    >
      {loading ? (
        <Card>
          <CardContent className="flex min-h-40 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading organization credits
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!loading && error ? (
        <Card>
          <CardContent className="p-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatAdminError(error)}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!loading && !error && creditsQuery.data ? (
        <CreditsContent credits={creditsQuery.data} />
      ) : null}
    </AdminSurfaceLayout>
  );
}
