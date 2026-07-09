import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2, RefreshCw, Settings2, Users, Wallet } from "lucide-react";

import type { AppUser } from "@/auth/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";
import { WidgetSettingHelp } from "@/widgets/shared/widget-setting-help";
import { MainSequenceRegistrySearch } from "../../../../../extensions/main_sequence/common/components/MainSequenceRegistrySearch";
import { getRegistryTableCellClassName } from "../../../../../extensions/main_sequence/common/components/registryTable";

import {
  allocateOrganizationUserCredits,
  buildOrganizationCreditsAutoReloadPath,
  buildOrganizationCreditsCheckoutPath,
  buildOrganizationCreditsUsersPath,
  fetchCurrentOrganizationUid,
  getOrganizationCredits,
  listOrganizationUserCredits,
  listOrganizationUsers,
  loadOrganizationCreditsAutoReload,
  submitOrganizationCreditsCheckout,
  updateOrganizationCreditsAutoReload,
  updateOrganizationUserCreditPolicy,
  type OrganizationCreditsAutoReloadConfig,
  type OrganizationCreditsFormFieldDescriptor,
  type OrganizationCreditsPolicy,
  type UserCreditsState,
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

function formatAmountInput(cents: number) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function parseDollarsToCents(rawValue: string) {
  const normalized = rawValue.trim().replace(/\$/g, "").replace(/,/g, "");

  if (!normalized || !/^\d+(\.\d{0,2})?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

function buildReturnUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  return new URL(`${window.location.pathname}${window.location.search}`, window.location.origin).toString();
}

function generateClientRequestKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildFieldHelpLookup(fields: OrganizationCreditsFormFieldDescriptor[] | undefined) {
  return Object.fromEntries(
    (fields ?? [])
      .filter(
        (field): field is OrganizationCreditsFormFieldDescriptor & { help_text: string } =>
          typeof field.help_text === "string" && field.help_text.trim().length > 0,
      )
      .map((field) => [field.name, field.help_text.trim()]),
  );
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

function createAutoReloadDraft(config: OrganizationCreditsAutoReloadConfig) {
  return {
    enabled: config.enabled ? "true" : "false",
    threshold: formatAmountInput(config.threshold_cents),
    reloadAmount: formatAmountInput(config.reload_amount_cents),
    monthlyLimit: formatAmountInput(config.monthly_limit_cents),
    currency: config.currency || "usd",
    stripePaymentMethodId: "",
  };
}

function createPolicyDraft(policy: OrganizationCreditsPolicy | null, currency: string) {
  const resolvedMode = normalizePolicyMode(policy?.mode, policy?.is_enabled ?? true);

  return {
    mode: resolvedMode,
    monthlyLimit: formatAmountInput(policy?.monthly_limit_cents ?? 0),
    autoReloadEnabled: policy?.auto_reload_enabled ? "true" : "false",
    autoReloadThreshold: formatAmountInput(policy?.auto_reload_threshold_cents ?? 0),
    autoReloadAmount: formatAmountInput(policy?.auto_reload_amount_cents ?? 0),
    autoReloadMonthlyLimit: formatAmountInput(policy?.auto_reload_monthly_limit_cents ?? 0),
    currency: policy?.currency || currency,
  };
}

function createAllocationDraft() {
  return {
    amount: "",
    reference: "",
    description: "",
  };
}

function readUserDisplayName(user: AppUser | null | undefined, userId: number) {
  if (user?.name?.trim()) {
    return user.name.trim();
  }

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName;
  }

  if (user?.email?.trim()) {
    return user.email.trim();
  }

  return `User ${userId}`;
}

function readUserSecondaryLabel(user: AppUser | null | undefined, userId: number) {
  if (user?.email?.trim()) {
    return user.email.trim();
  }

  return `#${userId}`;
}

function FieldLabel({
  children,
  help,
  htmlFor,
}: {
  children: ReactNode;
  help?: string;
  htmlFor?: string;
}) {
  const labelContent = htmlFor ? <label htmlFor={htmlFor}>{children}</label> : <span>{children}</span>;

  return (
    <div className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-muted-foreground">
      {labelContent}
      {help ? <WidgetSettingHelp content={help} /> : null}
    </div>
  );
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

interface CreditsUserRow extends UserCreditsState {
  userName: string;
  userSecondary: string;
  normalizedMode: "allocated" | "organization_pool" | "disabled";
  searchText: string;
}

export function AdminManageCreditsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const purchaseIntentRef = useRef<{ signature: string; key: string } | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState("50.00");
  const [autoReloadDraft, setAutoReloadDraft] = useState<ReturnType<typeof createAutoReloadDraft> | null>(null);
  const [policyDialogUserId, setPolicyDialogUserId] = useState<number | null>(null);
  const [policyDraft, setPolicyDraft] = useState<ReturnType<typeof createPolicyDraft> | null>(null);
  const [allocationDialogUserId, setAllocationDialogUserId] = useState<number | null>(null);
  const [allocationDraft, setAllocationDraft] = useState(createAllocationDraft);
  const deferredSearchValue = useDeferredValue(searchValue);
  const normalizedSearchValue = deferredSearchValue.trim().toLowerCase();

  const organizationUidQuery = useQuery({
    queryKey: ["admin", "organization", "uid"],
    queryFn: fetchCurrentOrganizationUid,
    staleTime: 300_000,
  });
  const creditsQuery = useQuery({
    queryKey: ["admin", "organization", organizationUidQuery.data, "credits"],
    queryFn: () => getOrganizationCredits(organizationUidQuery.data!),
    enabled: typeof organizationUidQuery.data === "string",
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const credits = creditsQuery.data;
  const organizationUid = credits?.organization_uid ?? organizationUidQuery.data ?? null;
  const autoReloadPath =
    credits?.actions?.load_auto_reload?.url ??
    (typeof organizationUid === "string" ? buildOrganizationCreditsAutoReloadPath(organizationUid) : "");
  const checkoutPath =
    credits?.forms?.purchase_checkout?.url ??
    credits?.actions?.purchase_checkout?.url ??
    (typeof organizationUid === "string" ? buildOrganizationCreditsCheckoutPath(organizationUid) : "");
  const autoReloadSubmitPath =
    credits?.forms?.auto_reload?.url ??
    credits?.actions?.update_auto_reload?.url ??
    (typeof organizationUid === "string" ? buildOrganizationCreditsAutoReloadPath(organizationUid) : "");
  const userCreditsPath =
    credits?.actions?.list_user_credits?.url ??
    (typeof organizationUid === "string" ? buildOrganizationCreditsUsersPath(organizationUid) : "");
  const autoReloadQuery = useQuery({
    queryKey: ["admin", "organization", organizationUid, "credits", "auto-reload", autoReloadPath],
    queryFn: () => loadOrganizationCreditsAutoReload(autoReloadPath),
    enabled: Boolean(autoReloadPath),
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const userCreditsQuery = useQuery({
    queryKey: ["admin", "organization", organizationUid, "credits", "users", userCreditsPath],
    queryFn: () => listOrganizationUserCredits(userCreditsPath),
    enabled: Boolean(userCreditsPath),
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const organizationUsersQuery = useQuery({
    queryKey: ["admin", "organization-users", "lookup"],
    queryFn: () => listOrganizationUsers({ limit: 500 }),
    enabled: typeof organizationUid === "string",
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const purchaseMutation = useMutation({
    mutationFn: ({
      path,
      payload,
    }: {
      path: string;
      payload: Parameters<typeof submitOrganizationCreditsCheckout>[1];
    }) => submitOrganizationCreditsCheckout(path, payload),
    onSuccess: (result) => {
      if (!result.checkout_url) {
        toast({
          variant: "error",
          title: "Checkout failed",
          description: "The checkout session did not return a redirect URL.",
        });
        return;
      }

      window.location.assign(result.checkout_url);
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Checkout failed",
        description: formatAdminError(error),
      });
    },
  });
  const autoReloadMutation = useMutation({
    mutationFn: ({
      path,
      payload,
    }: {
      path: string;
      payload: Parameters<typeof updateOrganizationCreditsAutoReload>[1];
    }) => updateOrganizationCreditsAutoReload(path, payload),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin", "organization", organizationUid, "credits"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin", "organization", organizationUid, "credits", "auto-reload"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["user", "credits"],
        }),
      ]);

      setAutoReloadDraft(createAutoReloadDraft(result));
      toast({
        variant: "success",
        title: "Auto-reload settings saved",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Auto-reload update failed",
        description: formatAdminError(error),
      });
    },
  });
  const policyMutation = useMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: number;
      payload: Parameters<typeof updateOrganizationUserCreditPolicy>[2];
    }) => updateOrganizationUserCreditPolicy(organizationUid!, userId, payload),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin", "organization", organizationUid, "credits", "users"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["user", "credits"],
        }),
      ]);

      setPolicyDialogUserId(null);
      setPolicyDraft(null);
      toast({
        variant: "success",
        title: "User credit policy saved",
        description: `User ${variables.userId}`,
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Policy update failed",
        description: formatAdminError(error),
      });
    },
  });
  const allocationMutation = useMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: number;
      payload: Parameters<typeof allocateOrganizationUserCredits>[2];
    }) => allocateOrganizationUserCredits(organizationUid!, userId, payload),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin", "organization", organizationUid, "credits"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin", "organization", organizationUid, "credits", "users"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["user", "credits"],
        }),
      ]);

      setAllocationDialogUserId(null);
      setAllocationDraft(createAllocationDraft());
      toast({
        variant: "success",
        title: "Credits allocated",
        description: `User ${variables.userId}`,
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Credit allocation failed",
        description: formatAdminError(error),
      });
    },
  });

  const autoReloadSource = autoReloadQuery.data ?? credits?.auto_reload ?? null;
  const autoReloadSourceKey = autoReloadSource
    ? [
        autoReloadSource.enabled ? "1" : "0",
        autoReloadSource.threshold_cents,
        autoReloadSource.reload_amount_cents,
        autoReloadSource.monthly_limit_cents,
        autoReloadSource.currency,
        autoReloadSource.has_payment_method ? "1" : "0",
      ].join("|")
    : "";
  const userLookupById = useMemo(() => {
    const result = new Map<number, AppUser>();

    for (const user of organizationUsersQuery.data?.results ?? []) {
      const userId = Number(user.id);

      if (Number.isFinite(userId) && userId > 0) {
        result.set(userId, user);
      }
    }

    return result;
  }, [organizationUsersQuery.data?.results]);
  const userCreditRows = useMemo<CreditsUserRow[]>(() => {
    return (userCreditsQuery.data ?? [])
      .map((row) => {
        const matchedUser = userLookupById.get(row.user_id);
        const normalizedMode = normalizePolicyMode(
          row.policy?.mode,
          row.policy?.is_enabled ?? true,
        );
        const userName = readUserDisplayName(matchedUser, row.user_id);
        const userSecondary = readUserSecondaryLabel(matchedUser, row.user_id);
        const userUid = matchedUser?.uid?.trim() || "";

        return {
          ...row,
          userName,
          userSecondary,
          normalizedMode,
          searchText: [userName, userSecondary, userUid, row.user_id, normalizedMode]
            .join(" ")
            .toLowerCase(),
        };
      })
      .sort((left, right) => left.userName.localeCompare(right.userName));
  }, [userCreditsQuery.data, userLookupById]);
  const filteredUserCreditRows = useMemo(() => {
    if (!normalizedSearchValue) {
      return userCreditRows;
    }

    return userCreditRows.filter((row) => row.searchText.includes(normalizedSearchValue));
  }, [normalizedSearchValue, userCreditRows]);
  const policyTarget = useMemo(
    () => userCreditRows.find((row) => row.user_id === policyDialogUserId) ?? null,
    [policyDialogUserId, userCreditRows],
  );
  const allocationTarget = useMemo(
    () => userCreditRows.find((row) => row.user_id === allocationDialogUserId) ?? null,
    [allocationDialogUserId, userCreditRows],
  );
  const policySourceKey = policyTarget
    ? [
        policyTarget.user_id,
        policyTarget.normalizedMode,
        policyTarget.policy?.monthly_limit_cents ?? 0,
        policyTarget.policy?.auto_reload_enabled ? "1" : "0",
        policyTarget.policy?.auto_reload_threshold_cents ?? 0,
        policyTarget.policy?.auto_reload_amount_cents ?? 0,
        policyTarget.policy?.auto_reload_monthly_limit_cents ?? 0,
        policyTarget.policy?.currency ?? policyTarget.currency,
      ].join("|")
    : "";
  const purchaseFieldHelp = useMemo(
    () => buildFieldHelpLookup(credits?.forms?.purchase_checkout?.fields),
    [credits?.forms?.purchase_checkout?.fields],
  );
  const autoReloadFieldHelp = useMemo(
    () => buildFieldHelpLookup(credits?.forms?.auto_reload?.fields),
    [credits?.forms?.auto_reload?.fields],
  );
  const loading = organizationUidQuery.isLoading || creditsQuery.isLoading;
  const error = organizationUidQuery.error ?? creditsQuery.error;
  const managedUserCount = userCreditRows.length;
  const allocatedUserCount = userCreditRows.filter((row) => row.normalizedMode === "allocated").length;
  const directPoolUserCount = userCreditRows.filter((row) => row.normalizedMode === "organization_pool").length;
  const lookupTruncated =
    typeof organizationUsersQuery.data?.count === "number" &&
    organizationUsersQuery.data.count > (organizationUsersQuery.data.results?.length ?? 0);

  useEffect(() => {
    if (!autoReloadSource) {
      setAutoReloadDraft(null);
      return;
    }

    setAutoReloadDraft(createAutoReloadDraft(autoReloadSource));
  }, [autoReloadSource, autoReloadSourceKey]);

  useEffect(() => {
    if (!policyTarget) {
      setPolicyDraft(null);
      return;
    }

    setPolicyDraft(createPolicyDraft(policyTarget.policy, policyTarget.currency));
  }, [policySourceKey, policyTarget]);

  function getPurchaseIntentKey(signature: string) {
    if (purchaseIntentRef.current?.signature === signature) {
      return purchaseIntentRef.current.key;
    }

    const key = generateClientRequestKey();
    purchaseIntentRef.current = {
      signature,
      key,
    };
    return key;
  }

  function handleRefreshBalance() {
    void Promise.all([
      creditsQuery.refetch(),
      autoReloadQuery.refetch(),
      userCreditsQuery.refetch(),
    ]);
  }

  function handlePurchaseSubmit() {
    if (!checkoutPath) {
      toast({
        variant: "error",
        title: "Checkout unavailable",
        description: "Credit purchase is not available right now.",
      });
      return;
    }

    const amountCents = parseDollarsToCents(purchaseAmount);
    if (!amountCents || amountCents <= 0) {
      toast({
        variant: "error",
        title: "Invalid purchase amount",
        description: "Enter a dollar amount greater than $0.00.",
      });
      return;
    }

    const returnUrl = buildReturnUrl();
    const signature = [checkoutPath, amountCents, returnUrl].join("|");

    purchaseMutation.mutate({
      path: checkoutPath,
      payload: {
        amount_cents: amountCents,
        success_url: returnUrl,
        cancel_url: returnUrl,
        idempotency_key: getPurchaseIntentKey(signature),
      },
    });
  }

  function handleAutoReloadReset() {
    if (!autoReloadSource) {
      return;
    }

    setAutoReloadDraft(createAutoReloadDraft(autoReloadSource));
  }

  function handleAutoReloadSubmit() {
    if (!autoReloadDraft || !autoReloadSubmitPath) {
      toast({
        variant: "error",
        title: "Auto-reload unavailable",
        description: "Auto-reload settings are not available right now.",
      });
      return;
    }

    const thresholdCents = parseDollarsToCents(autoReloadDraft.threshold);
    const reloadAmountCents = parseDollarsToCents(autoReloadDraft.reloadAmount);
    const monthlyLimitCents = parseDollarsToCents(autoReloadDraft.monthlyLimit);

    if (
      thresholdCents === null ||
      reloadAmountCents === null ||
      monthlyLimitCents === null
    ) {
      toast({
        variant: "error",
        title: "Invalid auto-reload amounts",
        description: "Threshold, reload amount, and monthly limit must be valid dollar amounts.",
      });
      return;
    }

    autoReloadMutation.mutate({
      path: autoReloadSubmitPath,
      payload: {
        enabled: autoReloadDraft.enabled === "true",
        threshold_cents: thresholdCents,
        reload_amount_cents: reloadAmountCents,
        monthly_limit_cents: monthlyLimitCents,
        currency: autoReloadDraft.currency || credits?.currency || "usd",
        stripe_payment_method_id: autoReloadDraft.stripePaymentMethodId.trim() || undefined,
      },
    });
  }

  function handlePolicySubmit() {
    if (!policyTarget || !policyDraft) {
      return;
    }

    const monthlyLimitCents = parseDollarsToCents(policyDraft.monthlyLimit);
    const autoReloadThresholdCents = parseDollarsToCents(policyDraft.autoReloadThreshold);
    const autoReloadAmountCents = parseDollarsToCents(policyDraft.autoReloadAmount);
    const autoReloadMonthlyLimitCents = parseDollarsToCents(policyDraft.autoReloadMonthlyLimit);

    if (
      monthlyLimitCents === null ||
      autoReloadThresholdCents === null ||
      autoReloadAmountCents === null ||
      autoReloadMonthlyLimitCents === null
    ) {
      toast({
        variant: "error",
        title: "Invalid policy amounts",
        description: "Policy amount fields must be valid dollar amounts.",
      });
      return;
    }

    policyMutation.mutate({
      userId: policyTarget.user_id,
      payload: {
        is_enabled: policyDraft.mode !== "disabled",
        mode: policyDraft.mode,
        monthly_limit_cents: monthlyLimitCents,
        auto_reload_enabled: policyDraft.autoReloadEnabled === "true",
        auto_reload_threshold_cents: autoReloadThresholdCents,
        auto_reload_amount_cents: autoReloadAmountCents,
        auto_reload_monthly_limit_cents: autoReloadMonthlyLimitCents,
        currency: policyDraft.currency || policyTarget.currency,
      },
    });
  }

  function handleAllocationSubmit() {
    if (!allocationTarget) {
      return;
    }

    const amountCents = parseDollarsToCents(allocationDraft.amount);
    if (!amountCents || amountCents <= 0) {
      toast({
        variant: "error",
        title: "Invalid allocation amount",
        description: "Enter a dollar amount greater than $0.00.",
      });
      return;
    }

    allocationMutation.mutate({
      userId: allocationTarget.user_id,
      payload: {
        amount_cents: amountCents,
        reference: allocationDraft.reference.trim() || undefined,
        description: allocationDraft.description.trim() || undefined,
      },
    });
  }

  return (
    <AdminSurfaceLayout
      title="Manage Credits"
      description="Manage organization prepaid credits, auto-reload settings, and user budget allocations."
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

      {!loading && !error && credits ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Organization Balance"
              value={formatAmount(credits.balance_cents, credits.currency)}
              detail="Current prepaid balance for this organization"
            />
            <MetricCard
              label="Spendable Status"
              value={credits.has_spendable_credits ? "Available" : "Exhausted"}
              detail={
                credits.has_spendable_credits
                  ? "Credits are available to use right now."
                  : "Add credits to continue using paid features."
              }
            />
            <MetricCard
              label="Auto-reload"
              value={autoReloadSource?.enabled ? "Enabled" : "Disabled"}
              detail={
                autoReloadSource
                  ? `Threshold ${formatAmount(autoReloadSource.threshold_cents, autoReloadSource.currency || credits.currency)}`
                  : "No auto-reload configuration loaded."
              }
            />
            <MetricCard
              label="Managed Users"
              value={String(managedUserCount)}
              detail={`${allocatedUserCount} allocated, ${directPoolUserCount} using the organization pool`}
            />
          </div>

          <Card>
            <CardHeader className="border-b border-border/70">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Organization credit account</CardTitle>
                  <CardDescription>
                    Refresh the current organization balance and launch prepaid-credit checkout.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">{formatCurrencyCode(credits.currency)}</Badge>
                  <Badge variant={credits.has_spendable_credits ? "success" : "warning"}>
                    {credits.has_spendable_credits ? "Spendable" : "No spendable credits"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-5">
              <div className="space-y-0">
                <DetailRow label="Organization UID" value={credits.organization_uid ?? organizationUid ?? ""} />
                <DetailRow
                  label="Balance"
                  value={formatAmount(credits.balance_cents, credits.currency)}
                />
                <DetailRow
                  label="Refresh action"
                  value={
                    <span className="inline-flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleRefreshBalance}
                        disabled={
                          creditsQuery.isFetching ||
                          autoReloadQuery.isFetching ||
                          userCreditsQuery.isFetching
                        }
                      >
                        {creditsQuery.isFetching ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        {credits.actions?.refresh_balance?.label || "Refresh credit balance"}
                      </Button>
                    </span>
                  }
                />
              </div>

              <div className="rounded-[calc(var(--radius)-2px)] border border-border/70 bg-background/35 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Buy prepaid organization credits
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Enter the amount you want to add to the organization balance.
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                  <div>
                    <FieldLabel help={purchaseFieldHelp.amount_cents} htmlFor="org-credit-purchase-amount">
                      Purchase amount
                    </FieldLabel>
                    <Input
                      id="org-credit-purchase-amount"
                      inputMode="decimal"
                      value={purchaseAmount}
                      onChange={(event) => setPurchaseAmount(event.target.value)}
                      placeholder="50.00"
                      disabled={purchaseMutation.isPending}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      onClick={handlePurchaseSubmit}
                      disabled={purchaseMutation.isPending}
                    >
                      {purchaseMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      {credits.actions?.purchase_checkout?.label || "Buy prepaid credits"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/70">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Auto-reload settings</CardTitle>
                  <CardDescription>
                    Threshold means when to reload. Reload amount means how much to buy. Monthly limit caps total auto-buys for the calendar month.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={autoReloadSource?.enabled ? "success" : "warning"}>
                    {autoReloadSource?.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                  <Badge variant={autoReloadSource?.has_payment_method ? "success" : "warning"}>
                    {autoReloadSource?.has_payment_method ? "Payment method on file" : "No payment method"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-5">
              {autoReloadQuery.isLoading && !autoReloadDraft ? (
                <div className="flex min-h-24 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-3 h-4 w-4 animate-spin" />
                  Loading auto-reload settings
                </div>
              ) : null}

              {autoReloadQuery.isError && !autoReloadDraft ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatAdminError(autoReloadQuery.error)}
                </div>
              ) : null}

              {autoReloadDraft ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <FieldLabel help={autoReloadFieldHelp.enabled} htmlFor="auto-reload-enabled">
                        Enable auto-reload
                      </FieldLabel>
                      <Select
                        id="auto-reload-enabled"
                        value={autoReloadDraft.enabled}
                        onChange={(event) =>
                          setAutoReloadDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  enabled: event.target.value,
                                }
                              : current,
                          )
                        }
                        disabled={autoReloadMutation.isPending}
                      >
                        <option value="false">Disabled</option>
                        <option value="true">Enabled</option>
                      </Select>
                    </div>

                    <div>
                      <FieldLabel help={autoReloadFieldHelp.threshold_cents} htmlFor="auto-reload-threshold">
                        Reload threshold
                      </FieldLabel>
                      <Input
                        id="auto-reload-threshold"
                        inputMode="decimal"
                        value={autoReloadDraft.threshold}
                        onChange={(event) =>
                          setAutoReloadDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  threshold: event.target.value,
                                }
                              : current,
                          )
                        }
                        disabled={autoReloadMutation.isPending}
                      />
                    </div>

                    <div>
                      <FieldLabel help={autoReloadFieldHelp.reload_amount_cents} htmlFor="auto-reload-amount">
                        Reload amount
                      </FieldLabel>
                      <Input
                        id="auto-reload-amount"
                        inputMode="decimal"
                        value={autoReloadDraft.reloadAmount}
                        onChange={(event) =>
                          setAutoReloadDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  reloadAmount: event.target.value,
                                }
                              : current,
                          )
                        }
                        disabled={autoReloadMutation.isPending}
                      />
                    </div>

                    <div>
                      <FieldLabel help={autoReloadFieldHelp.monthly_limit_cents} htmlFor="auto-reload-monthly-limit">
                        Monthly reload limit
                      </FieldLabel>
                      <Input
                        id="auto-reload-monthly-limit"
                        inputMode="decimal"
                        value={autoReloadDraft.monthlyLimit}
                        onChange={(event) =>
                          setAutoReloadDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  monthlyLimit: event.target.value,
                                }
                              : current,
                          )
                        }
                        disabled={autoReloadMutation.isPending}
                      />
                    </div>

                    <div>
                      <FieldLabel help={autoReloadFieldHelp.currency} htmlFor="auto-reload-currency">
                        Currency
                      </FieldLabel>
                      <Input
                        id="auto-reload-currency"
                        value={formatCurrencyCode(autoReloadDraft.currency)}
                        readOnly
                        disabled
                      />
                    </div>

                    <div>
                      <FieldLabel
                        help={autoReloadFieldHelp.stripe_payment_method_id}
                        htmlFor="auto-reload-payment-method"
                      >
                        Payment method ID
                      </FieldLabel>
                      <Input
                        id="auto-reload-payment-method"
                        value={autoReloadDraft.stripePaymentMethodId}
                        onChange={(event) =>
                          setAutoReloadDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  stripePaymentMethodId: event.target.value,
                                }
                              : current,
                          )
                        }
                        placeholder={
                          autoReloadSource?.has_payment_method
                            ? "Replace the current payment method"
                            : "Add a payment method"
                        }
                        disabled={autoReloadMutation.isPending}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 rounded-[calc(var(--radius)-2px)] border border-border/70 bg-background/35 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Add or replace the payment method used for auto-reload billing.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleAutoReloadReset}
                        disabled={autoReloadMutation.isPending}
                      >
                        Reset
                      </Button>
                      <Button
                        type="button"
                        onClick={handleAutoReloadSubmit}
                        disabled={autoReloadMutation.isPending}
                      >
                        {autoReloadMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Settings2 className="h-4 w-4" />
                        )}
                        {credits.actions?.update_auto_reload?.label || "Save auto-reload settings"}
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/70">
              <div className="space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>User credit budgets</CardTitle>
                    <CardDescription>
                      Review each user’s budget state, update policy mode, and allocate credits.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{`${managedUserCount} users`}</Badge>
                    <Badge variant="neutral">{`${allocatedUserCount} allocated`}</Badge>
                    <Badge variant="neutral">{`${directPoolUserCount} org pool`}</Badge>
                  </div>
                </div>

                <MainSequenceRegistrySearch
                  accessory={
                    lookupTruncated ? (
                      <Badge variant="warning">User labels limited to first 500 org users</Badge>
                    ) : null
                  }
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search by name, email, user UID, or policy mode"
                  searchClassName="max-w-xl"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {userCreditsQuery.isLoading ? (
                <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-3 h-4 w-4 animate-spin" />
                  Loading user credit budgets
                </div>
              ) : null}

              {!userCreditsQuery.isLoading && userCreditsQuery.isError ? (
                <div className="p-5">
                  <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {formatAdminError(userCreditsQuery.error)}
                  </div>
                </div>
              ) : null}

              {!userCreditsQuery.isLoading &&
              !userCreditsQuery.isError &&
              filteredUserCreditRows.length === 0 ? (
                <div className="px-5 py-14 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="mt-4 text-sm font-medium text-foreground">
                    {managedUserCount > 0 ? "No matching users found" : "No user credit budgets returned"}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {managedUserCount > 0
                      ? "Clear the current search to review all user credit budgets."
                      : "No user credit budgets have been set up for this organization yet."}
                  </p>
                </div>
              ) : null}

              {!userCreditsQuery.isLoading &&
              !userCreditsQuery.isError &&
              filteredUserCreditRows.length > 0 ? (
                <div className="overflow-x-auto px-4 py-4">
                  <table
                    className="w-full min-w-[1080px] border-separate text-sm"
                    style={{ borderSpacing: "0 var(--table-row-gap-y)" }}
                  >
                    <thead>
                      <tr
                        className="text-left uppercase tracking-[0.18em] text-muted-foreground"
                        style={{ fontSize: "var(--table-meta-font-size)" }}
                      >
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">User</th>
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">Available</th>
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">Policy</th>
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">Monthly limit</th>
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">Allocated balance</th>
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">User auto-reload</th>
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUserCreditRows.map((row) => (
                        <tr key={row.user_id}>
                          <td className={getRegistryTableCellClassName(false, "left")}>
                            <div className="font-medium text-foreground">{row.userName}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{row.userSecondary}</div>
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            <div className="font-medium text-foreground">
                              {formatAmount(row.available_cents, row.currency)}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              User balance {formatAmount(row.user_balance_cents, row.currency)}
                            </div>
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={getPolicyBadgeVariant(row.normalizedMode)}>
                                {formatPolicyMode(row.normalizedMode)}
                              </Badge>
                              <Badge
                                variant={row.has_spendable_credits ? "success" : "warning"}
                              >
                                {row.has_spendable_credits ? "Spendable" : "Exhausted"}
                              </Badge>
                            </div>
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            {formatAmount(row.policy?.monthly_limit_cents ?? 0, row.currency)}
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            {formatAmount(row.policy?.allocated_cents ?? row.user_balance_cents, row.currency)}
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={row.policy?.auto_reload_enabled ? "success" : "neutral"}
                              >
                                {row.policy?.auto_reload_enabled ? "Enabled" : "Off"}
                              </Badge>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Threshold {formatAmount(row.policy?.auto_reload_threshold_cents ?? 0, row.currency)}
                            </div>
                          </td>
                          <td className={getRegistryTableCellClassName(false, "right")}>
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setPolicyDialogUserId(row.user_id);
                                }}
                              >
                                Edit policy
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  setAllocationDialogUserId(row.user_id);
                                  setAllocationDraft(createAllocationDraft());
                                }}
                              >
                                Allocate
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}

      <Dialog
        open={Boolean(policyTarget && policyDraft)}
        onClose={() => {
          if (policyMutation.isPending) {
            return;
          }

          setPolicyDialogUserId(null);
          setPolicyDraft(null);
        }}
        title={policyTarget ? `Edit credit policy for ${policyTarget.userName}` : "Edit credit policy"}
        description="Set how this user can spend credits, including direct organization-pool access or an allocated budget."
        className="max-w-[min(860px,calc(100vw-24px))]"
      >
        {policyTarget && policyDraft ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard
                label="Available"
                value={formatAmount(policyTarget.available_cents, policyTarget.currency)}
                detail="Current spendable amount for this user"
              />
              <MetricCard
                label="Allocated balance"
                value={formatAmount(
                  policyTarget.policy?.allocated_cents ?? policyTarget.user_balance_cents,
                  policyTarget.currency,
                )}
                detail="Current allocated user budget"
              />
              <MetricCard
                label="Organization balance"
                value={formatAmount(policyTarget.organization_balance_cents, policyTarget.currency)}
                detail="Organization-wide prepaid balance"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel htmlFor="user-credit-policy-mode">Mode</FieldLabel>
                <Select
                  id="user-credit-policy-mode"
                  value={policyDraft.mode}
                  onChange={(event) =>
                    setPolicyDraft((current) =>
                      current
                        ? {
                            ...current,
                            mode: event.target.value as typeof current.mode,
                          }
                        : current,
                    )
                  }
                  disabled={policyMutation.isPending}
                >
                  <option value="allocated">Allocated budget</option>
                  <option value="organization_pool">Organization pool</option>
                  <option value="disabled">Disabled</option>
                </Select>
              </div>

              <div>
                <FieldLabel htmlFor="user-credit-policy-monthly-limit">Monthly limit</FieldLabel>
                <Input
                  id="user-credit-policy-monthly-limit"
                  inputMode="decimal"
                  value={policyDraft.monthlyLimit}
                  onChange={(event) =>
                    setPolicyDraft((current) =>
                      current
                        ? {
                            ...current,
                            monthlyLimit: event.target.value,
                          }
                        : current,
                    )
                  }
                  disabled={policyMutation.isPending}
                />
              </div>

              <div>
                <FieldLabel htmlFor="user-credit-policy-auto-reload-enabled">
                  User auto-reload
                </FieldLabel>
                <Select
                  id="user-credit-policy-auto-reload-enabled"
                  value={policyDraft.autoReloadEnabled}
                  onChange={(event) =>
                    setPolicyDraft((current) =>
                      current
                        ? {
                            ...current,
                            autoReloadEnabled: event.target.value,
                          }
                        : current,
                    )
                  }
                  disabled={policyMutation.isPending}
                >
                  <option value="false">Disabled</option>
                  <option value="true">Enabled</option>
                </Select>
              </div>

              <div>
                <FieldLabel htmlFor="user-credit-policy-currency">Currency</FieldLabel>
                <Input
                  id="user-credit-policy-currency"
                  value={formatCurrencyCode(policyDraft.currency)}
                  readOnly
                  disabled
                />
              </div>

              <div>
                <FieldLabel htmlFor="user-credit-policy-auto-threshold">
                  Auto-reload threshold
                </FieldLabel>
                <Input
                  id="user-credit-policy-auto-threshold"
                  inputMode="decimal"
                  value={policyDraft.autoReloadThreshold}
                  onChange={(event) =>
                    setPolicyDraft((current) =>
                      current
                        ? {
                            ...current,
                            autoReloadThreshold: event.target.value,
                          }
                        : current,
                    )
                  }
                  disabled={policyMutation.isPending}
                />
              </div>

              <div>
                <FieldLabel htmlFor="user-credit-policy-auto-amount">Auto-reload amount</FieldLabel>
                <Input
                  id="user-credit-policy-auto-amount"
                  inputMode="decimal"
                  value={policyDraft.autoReloadAmount}
                  onChange={(event) =>
                    setPolicyDraft((current) =>
                      current
                        ? {
                            ...current,
                            autoReloadAmount: event.target.value,
                          }
                        : current,
                    )
                  }
                  disabled={policyMutation.isPending}
                />
              </div>

              <div>
                <FieldLabel htmlFor="user-credit-policy-auto-monthly-limit">
                  Auto-reload monthly limit
                </FieldLabel>
                <Input
                  id="user-credit-policy-auto-monthly-limit"
                  inputMode="decimal"
                  value={policyDraft.autoReloadMonthlyLimit}
                  onChange={(event) =>
                    setPolicyDraft((current) =>
                      current
                        ? {
                            ...current,
                            autoReloadMonthlyLimit: event.target.value,
                          }
                        : current,
                    )
                  }
                  disabled={policyMutation.isPending}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPolicyDialogUserId(null);
                  setPolicyDraft(null);
                }}
                disabled={policyMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handlePolicySubmit}
                disabled={policyMutation.isPending}
              >
                {policyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save policy
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(allocationTarget)}
        onClose={() => {
          if (allocationMutation.isPending) {
            return;
          }

          setAllocationDialogUserId(null);
          setAllocationDraft(createAllocationDraft());
        }}
        title={allocationTarget ? `Allocate credits to ${allocationTarget.userName}` : "Allocate credits"}
        description="Allocate additional prepaid credits to this user budget."
        className="max-w-[min(760px,calc(100vw-24px))]"
      >
        {allocationTarget ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard
                label="Available"
                value={formatAmount(allocationTarget.available_cents, allocationTarget.currency)}
                detail="Current spendable user balance"
              />
              <MetricCard
                label="User Balance"
                value={formatAmount(allocationTarget.user_balance_cents, allocationTarget.currency)}
                detail="Current user credit balance"
              />
              <MetricCard
                label="Org Balance"
                value={formatAmount(
                  allocationTarget.organization_balance_cents,
                  allocationTarget.currency,
                )}
                detail="Organization-wide prepaid balance"
              />
            </div>

            <div className="grid gap-4">
              <div>
                <FieldLabel htmlFor="user-credit-allocation-amount">Allocation amount</FieldLabel>
                <Input
                  id="user-credit-allocation-amount"
                  inputMode="decimal"
                  value={allocationDraft.amount}
                  onChange={(event) =>
                    setAllocationDraft((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  placeholder="30.00"
                  disabled={allocationMutation.isPending}
                />
              </div>

              <div>
                <FieldLabel htmlFor="user-credit-allocation-reference">Reference</FieldLabel>
                <Input
                  id="user-credit-allocation-reference"
                  value={allocationDraft.reference}
                  onChange={(event) =>
                    setAllocationDraft((current) => ({
                      ...current,
                      reference: event.target.value,
                    }))
                  }
                  placeholder="optional-client-reference"
                  disabled={allocationMutation.isPending}
                />
              </div>

              <div>
                <FieldLabel htmlFor="user-credit-allocation-description">Description</FieldLabel>
                <Textarea
                  id="user-credit-allocation-description"
                  value={allocationDraft.description}
                  onChange={(event) =>
                    setAllocationDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Initial user budget"
                  className="min-h-28"
                  disabled={allocationMutation.isPending}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAllocationDialogUserId(null);
                  setAllocationDraft(createAllocationDraft());
                }}
                disabled={allocationMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleAllocationSubmit}
                disabled={allocationMutation.isPending}
              >
                {allocationMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wallet className="h-4 w-4" />
                )}
                Allocate credits
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </AdminSurfaceLayout>
  );
}
