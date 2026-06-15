import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function formatSessionTimestamp(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatNumber(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return new Intl.NumberFormat().format(value);
}

export function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return `${value}%`;
}

export function formatBoolean(value: boolean | null) {
  if (value === null) {
    return null;
  }

  return value ? "Enabled" : "Disabled";
}

export function formatCurrency(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(value);
}

export function SessionField({
  label,
  description,
  value,
  mono = false,
}: {
  label: string;
  description?: string | null;
  value: string | null;
  mono?: boolean;
}) {
  if (!value) {
    return null;
  }

  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className={cn("text-sm text-foreground", mono && "font-mono text-[13px]")}>{value}</div>
      {description ? <div className="text-xs leading-5 text-muted-foreground">{description}</div> : null}
    </div>
  );
}

export function SessionSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card variant="nested">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
