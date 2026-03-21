import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText, Loader2, Receipt } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toaster";
import { getRegistryTableCellClassName } from "../../../../../extensions/main_sequence/common/components/registryTable";

import { listBillingInvoices, resolveAdminBrowserUrl, type BillingInvoiceRecord } from "./api";
import { AdminSurfaceLayout } from "./shared";

function formatAdminError(error: unknown) {
  return error instanceof Error ? error.message : "The invoices request failed.";
}

function formatAmount(cents: number, currency?: string | null) {
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

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toISOString().slice(0, 10);
}

function renderInvoiceStatus(invoice: BillingInvoiceRecord) {
  if (invoice.paid) {
    return <Badge variant="success">Paid</Badge>;
  }

  if (invoice.status === "open") {
    return <Badge variant="warning">Open</Badge>;
  }

  if (invoice.status === "void") {
    return <Badge variant="neutral">Void</Badge>;
  }

  if (invoice.status === "uncollectible") {
    return <Badge variant="danger">Uncollectible</Badge>;
  }

  return <Badge variant="neutral">Unpaid</Badge>;
}

export function AdminInvoicesPage() {
  const { toast } = useToast();
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const currentCursor =
    cursorStack.length > 0 ? cursorStack[cursorStack.length - 1] : undefined;
  const originUrl =
    typeof window === "undefined"
      ? ""
      : new URL(`${window.location.pathname}${window.location.search}`, window.location.origin).toString();
  const invoicesQuery = useQuery({
    queryKey: ["admin", "billing", "invoices", currentCursor ?? "", originUrl],
    queryFn: () =>
      listBillingInvoices({
        startingAfter: currentCursor || undefined,
        originUrl: originUrl || undefined,
      }),
    staleTime: 60_000,
    retry: false,
  });
  const invoices = invoicesQuery.data?.invoices ?? [];
  const nextCursor = invoicesQuery.data?.next_starting_after ?? null;
  const pageIndex = cursorStack.length;
  const pageLabel = `Page ${pageIndex + 1}`;

  function openInvoiceTarget(path: string) {
    const openedWindow = window.open(resolveAdminBrowserUrl(path), "_blank", "noopener,noreferrer");

    if (!openedWindow) {
      toast({
        variant: "error",
        title: "Invoice action blocked",
        description: "Allow pop-ups for this site to open the invoice in a new tab.",
      });
    }
  }

  return (
    <AdminSurfaceLayout
      title="Invoices"
      description="Billing invoice history and downloadable statements for the current organization."
    >
      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Invoice registry</CardTitle>
              <CardDescription>
                This list uses the billing invoices endpoint with cursor-based pagination.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">{pageLabel}</Badge>
              <Badge variant="neutral">{`${invoices.length} invoices loaded`}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {invoicesQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading invoices
              </div>
            </div>
          ) : null}

          {invoicesQuery.isError ? (
            <div className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatAdminError(invoicesQuery.error)}
              </div>
            </div>
          ) : null}

          {!invoicesQuery.isLoading && !invoicesQuery.isError && invoices.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Receipt className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No invoices found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                The billing endpoint returned no invoices for this organization.
              </p>
            </div>
          ) : null}

          {!invoicesQuery.isLoading && !invoicesQuery.isError && invoices.length > 0 ? (
            <>
              <div className="overflow-x-auto px-4 py-4">
                <table
                  className="w-full min-w-[1040px] border-separate text-sm"
                  style={{ borderSpacing: "0 var(--table-row-gap-y)" }}
                >
                  <thead>
                    <tr
                      className="text-left uppercase tracking-[0.18em] text-muted-foreground"
                      style={{ fontSize: "var(--table-meta-font-size)" }}
                    >
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                        Invoice
                      </th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">Date</th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">Status</th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                        Amount due
                      </th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                        Amount paid
                      </th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                        Remaining
                      </th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => {
                      const invoiceLabel = invoice.number || invoice.id;

                      return (
                        <tr key={invoice.id}>
                          <td className={getRegistryTableCellClassName(false, "left")}>
                            <div className="font-medium text-foreground">{invoiceLabel}</div>
                            <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                              {invoice.id}
                            </div>
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            <span className="text-muted-foreground">
                              {formatDate(invoice.created)}
                            </span>
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            {renderInvoiceStatus(invoice)}
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            <span className="text-foreground">
                              {formatAmount(invoice.amount_due, invoice.currency)}
                            </span>
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            <span className="text-foreground">
                              {formatAmount(invoice.amount_paid, invoice.currency)}
                            </span>
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            <span className="text-foreground">
                              {formatAmount(invoice.amount_remaining, invoice.currency)}
                            </span>
                          </td>
                          <td className={getRegistryTableCellClassName(false, "right")}>
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openInvoiceTarget(invoice.view_url)}
                              >
                                <ExternalLink className="h-4 w-4" />
                                View
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openInvoiceTarget(invoice.pdf_url)}
                              >
                                <FileText className="h-4 w-4" />
                                PDF
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  {`Page ${pageIndex + 1}${currentCursor ? ` · starting_after=${currentCursor}` : ""}`}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={cursorStack.length === 0 || invoicesQuery.isFetching}
                    onClick={() => {
                      setCursorStack((current) => current.slice(0, -1));
                    }}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!invoicesQuery.data?.has_more || !nextCursor || invoicesQuery.isFetching}
                    onClick={() => {
                      if (!nextCursor) {
                        return;
                      }

                      setCursorStack((current) => [...current, nextCursor]);
                    }}
                  >
                    {invoicesQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Next
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </AdminSurfaceLayout>
  );
}
