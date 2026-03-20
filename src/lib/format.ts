const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 1,
  notation: "compact",
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number, compact = false) {
  return compact
    ? compactCurrencyFormatter.format(value)
    : currencyFormatter.format(value);
}

export function formatNumber(value: number) {
  return integerFormatter.format(value);
}

export function formatDecimal(value: number) {
  return decimalFormatter.format(value);
}

export function formatPercent(value: number, digits = 2) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}%`;
}

export function formatSignedCurrency(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${currencyFormatter.format(value)}`;
}
