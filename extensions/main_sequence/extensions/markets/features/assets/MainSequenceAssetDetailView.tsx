import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, LineChart, Loader2, ShoppingCart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  fetchAssetDetail,
  fetchAssetOrderFormFields,
  formatMainSequenceError,
  type AssetDetailField,
  type AssetDetailResponse,
  type AssetListRow,
  type AssetOrderFormConfig,
  type AssetOrderFormField,
  type AssetOrderFormFieldChoice,
  type AssetTradingViewAlert,
  type AssetTradingViewConfig,
} from "../../../../common/api";

export const assetDetailTabs = [
  { id: "metadata", label: "Metadata" },
  { id: "trading-view", label: "TradingView" },
] as const;

export type AssetDetailTabId = (typeof assetDetailTabs)[number]["id"];

export function isAssetDetailTabId(value: string | null): value is AssetDetailTabId {
  return assetDetailTabs.some((tab) => tab.id === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatAssetValue(value: string | null | undefined, fallback = "Not available") {
  return value?.trim() || fallback;
}

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function formatUnknownValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  if (Array.isArray(value)) {
    if (value.every((entry) => ["string", "number", "boolean"].includes(typeof entry))) {
      return value.map((entry) => String(entry)).join(", ");
    }

    return safeJsonStringify(value);
  }

  if (typeof value === "object") {
    return safeJsonStringify(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

function formatFieldInputValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return safeJsonStringify(value);
}

function getAssetTitle(detail: AssetDetailResponse | null, initialAsset: AssetListRow | null) {
  return (
    detail?.name?.trim() ||
    initialAsset?.name?.trim() ||
    detail?.ticker?.trim() ||
    initialAsset?.ticker?.trim() ||
    detail?.unique_identifier?.trim() ||
    initialAsset?.unique_identifier?.trim() ||
    detail?.figi?.trim() ||
    initialAsset?.figi?.trim() ||
    `Asset ${detail?.id ?? initialAsset?.id ?? ""}`.trim()
  );
}

function getAssetMetadataRows(detail: AssetDetailResponse | null) {
  if (!detail) {
    return [];
  }

  if (Array.isArray(detail.details)) {
    return detail.details;
  }

  const metadata = detail.metadata;
  return Array.isArray(metadata) ? (metadata as AssetDetailField[]) : [];
}

function getAssetTradingView(detail: AssetDetailResponse | null) {
  if (!detail || !isRecord(detail.trading_view)) {
    return null;
  }

  return detail.trading_view as AssetTradingViewConfig;
}

function getAssetOrderForm(detail: AssetDetailResponse | null) {
  if (!detail || !isRecord(detail.order_form)) {
    return null;
  }

  return detail.order_form as AssetOrderFormConfig;
}

function getAssetOrderTypes(orderForm: AssetOrderFormConfig | null) {
  if (!orderForm || !Array.isArray(orderForm.order_types)) {
    return [];
  }

  return orderForm.order_types
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function getDefaultOrderType(orderForm: AssetOrderFormConfig | null, orderTypes: string[]) {
  const requestedDefault = orderForm?.default_order_type?.trim();

  if (requestedDefault && orderTypes.includes(requestedDefault)) {
    return requestedDefault;
  }

  return orderTypes[0] ?? "";
}

function getOrderFieldKey(field: AssetOrderFormField, index: number) {
  const rawKey = field.key ?? field.name ?? field.label;
  const trimmed = typeof rawKey === "string" ? rawKey.trim() : "";
  return trimmed || `field-${index}`;
}

function normalizeOrderFieldChoices(field: AssetOrderFormField): AssetOrderFormFieldChoice[] {
  const rawChoices = Array.isArray(field.choices)
    ? field.choices
    : Array.isArray(field.options)
      ? field.options
      : [];

  return rawChoices.flatMap((choice) => {
    if (typeof choice === "string" || typeof choice === "number" || typeof choice === "boolean") {
      return [
        {
          value: choice,
          label: String(choice),
        },
      ];
    }

    if (isRecord(choice)) {
      const value = choice.value;
      const label =
        (typeof choice.label === "string" && choice.label.trim()) ||
        (typeof choice.name === "string" && choice.name.trim()) ||
        (value !== null && value !== undefined ? String(value) : "");

      if (
        (typeof value === "string" || typeof value === "number" || typeof value === "boolean") &&
        label
      ) {
        return [
          {
            value,
            label,
            description:
              typeof choice.description === "string" && choice.description.trim()
                ? choice.description.trim()
                : undefined,
          },
        ];
      }
    }

    return [];
  });
}

function getOrderFieldEditor(field: AssetOrderFormField) {
  const editor = (field.editor ?? field.type ?? "").trim().toLowerCase();

  if (["checkbox", "toggle", "boolean", "bool"].includes(editor)) {
    return "checkbox";
  }

  if (["textarea", "json", "code"].includes(editor)) {
    return "textarea";
  }

  if (["number", "integer", "float", "decimal"].includes(editor)) {
    return "number";
  }

  if (["select", "choice", "choices", "enum"].includes(editor)) {
    return "select";
  }

  return normalizeOrderFieldChoices(field).length > 0 ? "select" : "text";
}

function buildOrderFieldDefaults(fields: AssetOrderFormField[]) {
  return fields.reduce<Record<string, unknown>>((values, field, index) => {
    values[getOrderFieldKey(field, index)] = field.value ?? "";
    return values;
  }, {});
}

function resolveLinkFieldValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed
      ? {
          href: trimmed,
          label: trimmed,
        }
      : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const hrefCandidate =
    (typeof value.href === "string" && value.href.trim()) ||
    (typeof value.url === "string" && value.url.trim()) ||
    (typeof value.link === "string" && value.link.trim()) ||
    "";
  const labelCandidate =
    (typeof value.label === "string" && value.label.trim()) ||
    (typeof value.title === "string" && value.title.trim()) ||
    (typeof value.name === "string" && value.name.trim()) ||
    hrefCandidate;

  return hrefCandidate
    ? {
        href: hrefCandidate,
        label: labelCandidate || hrefCandidate,
      }
    : null;
}

function getTradingViewAlerts(tradingView: AssetTradingViewConfig | null) {
  if (!tradingView || !Array.isArray(tradingView.alerts)) {
    return [];
  }

  return tradingView.alerts.filter(
    (alert): alert is AssetTradingViewAlert | string =>
      typeof alert === "string" || isRecord(alert),
  );
}

function getTradingViewAlertTitle(alert: AssetTradingViewAlert | string, index: number) {
  if (typeof alert === "string") {
    return alert;
  }

  return (
    alert.title?.trim() ||
    alert.label?.trim() ||
    alert.name?.trim() ||
    alert.condition?.trim() ||
    `Alert ${index + 1}`
  );
}

function getTradingViewAlertDescription(alert: AssetTradingViewAlert | string) {
  if (typeof alert === "string") {
    return null;
  }

  return (
    alert.message?.trim() ||
    alert.description?.trim() ||
    alert.condition?.trim() ||
    null
  );
}

function renderMetadataFieldValue(field: AssetDetailField) {
  if (field.value_type === "link") {
    const linkValue = resolveLinkFieldValue(field.value);

    if (!linkValue) {
      return <div className="text-sm text-muted-foreground">Not available</div>;
    }

    return (
      <a
        href={linkValue.href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:text-primary/80"
      >
        <span className="truncate">{linkValue.label}</span>
        <ArrowUpRight className="h-3.5 w-3.5" />
      </a>
    );
  }

  if (field.value_type === "pricing_detail") {
    return (
      <pre className="overflow-x-auto rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/36 px-4 py-4 text-xs text-foreground">
        {safeJsonStringify(field.value)}
      </pre>
    );
  }

  return <div className="text-sm text-foreground">{formatUnknownValue(field.value)}</div>;
}

function AssetMetadataSection({
  rows,
}: {
  rows: AssetDetailField[];
}) {
  return (
    <Card variant="nested">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Metadata</CardTitle>
        <CardDescription>
          Asset detail rows returned by the frontend detail serializer.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {rows.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((field, index) => {
              const fieldKey = field.key?.trim() || `${field.label}-${index}`;
              const fullWidth = field.value_type === "pricing_detail";

              return (
                <div
                  key={fieldKey}
                  className={`rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/30 px-4 py-4 ${
                    fullWidth ? "lg:col-span-2" : ""
                  }`}
                >
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {field.label}
                  </div>
                  <div className="mt-3">{renderMetadataFieldValue(field)}</div>
                  {field.meta || field.description ? (
                    <div className="mt-3 text-xs text-muted-foreground">
                      {field.meta?.trim() || field.description?.trim()}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/30 px-4 py-4 text-sm text-muted-foreground">
            No frontend detail metadata was returned for this asset.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TradingViewSection({
  tradingView,
}: {
  tradingView: AssetTradingViewConfig | null;
}) {
  const alerts = useMemo(() => getTradingViewAlerts(tradingView), [tradingView]);

  return (
    <Card variant="nested">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <LineChart className="h-4 w-4" />
          TradingView
        </CardTitle>
        <CardDescription>
          Symbol and alert metadata returned for the TradingView integration.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {!tradingView?.enabled ? (
          <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/30 px-4 py-4 text-sm text-muted-foreground">
            TradingView is not enabled for this asset.
          </div>
        ) : (
          <>
            <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/30 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Symbol
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="primary">{formatAssetValue(tradingView.symbol, "Not configured")}</Badge>
                <Badge variant="success">Enabled</Badge>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-foreground">Alerts</div>
                <Badge variant="neutral">{`${alerts.length} configured`}</Badge>
              </div>

              {alerts.length > 0 ? (
                <div className="grid gap-3">
                  {alerts.map((alert, index) => {
                    const alertRecord = isRecord(alert) ? (alert as AssetTradingViewAlert) : null;
                    const severity = alertRecord?.severity?.trim();
                    const description = getTradingViewAlertDescription(alert);

                    return (
                      <div
                        key={
                          typeof alert === "string"
                            ? `${alert}-${index}`
                            : String(alert.id ?? alert.label ?? alert.title ?? index)
                        }
                        className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/30 px-4 py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-foreground">
                              {getTradingViewAlertTitle(alert, index)}
                            </div>
                            {description ? (
                              <div className="mt-2 text-sm text-muted-foreground">{description}</div>
                            ) : null}
                          </div>
                          {severity ? <Badge variant="warning">{severity}</Badge> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/30 px-4 py-4 text-sm text-muted-foreground">
                  No TradingView alerts are configured for this asset.
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function renderOrderFieldControl(
  field: AssetOrderFormField,
  fieldKey: string,
  value: unknown,
  onChange: (nextValue: unknown) => void,
) {
  const editor = getOrderFieldEditor(field);
  const choices = normalizeOrderFieldChoices(field);
  const disabled = Boolean(field.read_only);

  if (editor === "checkbox") {
    return (
      <label className="flex items-center gap-3 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-3 text-sm text-foreground">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border border-input"
        />
        <span>{field.label?.trim() || fieldKey}</span>
      </label>
    );
  }

  if (editor === "select") {
    const selectedValue = value === null || value === undefined ? "" : String(value);

    return (
      <select
        value={selectedValue}
        onChange={(event) => {
          const nextValue = choices.find(
            (choice) => String(choice.value) === event.target.value,
          )?.value;
          onChange(nextValue ?? event.target.value);
        }}
        disabled={disabled}
        className="flex h-10 w-full rounded-[calc(var(--radius)-6px)] border border-input bg-card/70 px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-ring/30"
      >
        <option value="">Select an option</option>
        {choices.map((choice) => (
          <option key={`${fieldKey}-${String(choice.value)}`} value={String(choice.value)}>
            {choice.label}
          </option>
        ))}
      </select>
    );
  }

  if (editor === "textarea") {
    return (
      <Textarea
        value={formatFieldInputValue(value)}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={field.placeholder ?? ""}
        rows={4}
      />
    );
  }

  return (
    <Input
      type={editor === "number" ? "number" : "text"}
      value={formatFieldInputValue(value)}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      placeholder={field.placeholder ?? ""}
    />
  );
}

function AssetOrderDialog({
  assetId,
  assetTitle,
  onClose,
  open,
  orderForm,
}: {
  assetId: number;
  assetTitle: string;
  onClose: () => void;
  open: boolean;
  orderForm: AssetOrderFormConfig | null;
}) {
  const orderTypes = useMemo(() => getAssetOrderTypes(orderForm), [orderForm]);
  const defaultOrderType = useMemo(
    () => getDefaultOrderType(orderForm, orderTypes),
    [orderForm, orderTypes],
  );
  const [selectedOrderType, setSelectedOrderType] = useState(defaultOrderType);
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedOrderType((current) =>
      orderTypes.includes(current) ? current : defaultOrderType,
    );
  }, [defaultOrderType, open, orderTypes]);

  const orderFieldsQuery = useQuery({
    queryKey: ["main_sequence", "assets", "order_fields", assetId, selectedOrderType],
    queryFn: () => fetchAssetOrderFormFields(assetId, selectedOrderType),
    enabled: open && assetId > 0 && Boolean(selectedOrderType),
  });

  useEffect(() => {
    if (!orderFieldsQuery.data) {
      return;
    }

    setFieldValues(buildOrderFieldDefaults(orderFieldsQuery.data));
  }, [orderFieldsQuery.data, selectedOrderType]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Order ticket · ${assetTitle}`}
      description="Order submission is still deferred. This drawer only loads the asset-specific order fields."
      className="ml-auto h-[min(92vh,860px)] max-w-[min(760px,calc(100vw-24px))]"
      contentClassName="space-y-5"
    >
      {orderTypes.length === 0 ? (
        <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/30 px-4 py-4 text-sm text-muted-foreground">
          No order types were provided for this asset.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Order type
            </label>
            <select
              value={selectedOrderType}
              onChange={(event) => setSelectedOrderType(event.target.value)}
              className="flex h-10 w-full rounded-[calc(var(--radius)-6px)] border border-input bg-card/70 px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-ring/30"
              aria-label="Select order type"
            >
              {orderTypes.map((orderType) => (
                <option key={orderType} value={orderType}>
                  {orderType}
                </option>
              ))}
            </select>
            {orderForm?.default_order_type ? (
              <div className="text-xs text-muted-foreground">
                {`Default order type: ${orderForm.default_order_type}`}
              </div>
            ) : null}
          </div>

          {orderFieldsQuery.isLoading ? (
            <div className="flex min-h-40 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading order fields
              </div>
            </div>
          ) : null}

          {orderFieldsQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-8px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(orderFieldsQuery.error)}
            </div>
          ) : null}

          {!orderFieldsQuery.isLoading && !orderFieldsQuery.isError ? (
            <div className="space-y-4">
              {orderFieldsQuery.data && orderFieldsQuery.data.length > 0 ? (
                orderFieldsQuery.data.map((field, index) => {
                  const fieldKey = getOrderFieldKey(field, index);
                  const fieldValue = fieldValues[fieldKey] ?? field.value ?? "";

                  return (
                    <div key={fieldKey} className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <label className="text-sm font-medium text-foreground">
                            {field.label?.trim() || fieldKey}
                          </label>
                          {field.required ? (
                            <span className="ml-2 text-xs uppercase tracking-[0.16em] text-warning">
                              Required
                            </span>
                          ) : null}
                        </div>
                        {field.read_only ? <Badge variant="neutral">Read only</Badge> : null}
                      </div>

                      {renderOrderFieldControl(field, fieldKey, fieldValue, (nextValue) => {
                        setFieldValues((current) => ({
                          ...current,
                          [fieldKey]: nextValue,
                        }));
                      })}

                      {field.help_text?.trim() || field.description?.trim() ? (
                        <div className="text-xs text-muted-foreground">
                          {field.help_text?.trim() || field.description?.trim()}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/30 px-4 py-4 text-sm text-muted-foreground">
                  No order fields were returned for this order type.
                </div>
              )}

              <div className="flex items-center justify-between gap-3 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-4">
                <div className="text-sm text-muted-foreground">
                  Order submission will be added in a later phase.
                </div>
                <Button type="button" disabled>
                  Submit order
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </Dialog>
  );
}

export function MainSequenceAssetDetailView({
  activeTabId,
  assetId,
  initialAsset,
  onBack,
  onSelectTab,
}: {
  activeTabId: AssetDetailTabId;
  assetId: number;
  initialAsset: AssetListRow | null;
  onBack: () => void;
  onSelectTab: (tabId: AssetDetailTabId) => void;
}) {
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);

  const assetDetailQuery = useQuery({
    queryKey: ["main_sequence", "assets", "detail", assetId],
    queryFn: () => fetchAssetDetail(assetId),
    enabled: assetId > 0,
  });

  useEffect(() => {
    setOrderDialogOpen(false);
  }, [assetId]);

  const assetDetail = assetDetailQuery.data ?? null;
  const metadataRows = useMemo(() => getAssetMetadataRows(assetDetail), [assetDetail]);
  const tradingView = useMemo(() => getAssetTradingView(assetDetail), [assetDetail]);
  const orderForm = useMemo(() => getAssetOrderForm(assetDetail), [assetDetail]);
  const orderTypes = useMemo(() => getAssetOrderTypes(orderForm), [orderForm]);
  const assetTitle = getAssetTitle(assetDetail, initialAsset);
  const subtitleParts = [
    assetDetail?.ticker?.trim() || initialAsset?.ticker?.trim() || null,
    assetDetail?.exchange_code?.trim() || initialAsset?.exchange_code?.trim() || null,
    assetDetail?.security_type?.trim() || initialAsset?.security_type?.trim() || null,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            type="button"
            className="transition-colors hover:text-foreground"
            onClick={onBack}
          >
            Master List
          </button>
          <span>/</span>
          <span className="text-foreground">{assetTitle}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {orderTypes.length > 0 ? (
            <Button type="button" size="sm" onClick={() => setOrderDialogOpen(true)}>
              <ShoppingCart className="h-4 w-4" />
              Order ticket
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Back to master list
          </Button>
        </div>
      </div>

      {assetDetailQuery.isLoading && !assetDetail ? (
        <Card>
          <CardContent className="flex min-h-48 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading asset details
            </div>
          </CardContent>
        </Card>
      ) : null}

      {assetDetailQuery.isError ? (
        <Card>
          <CardContent className="p-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(assetDetailQuery.error)}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {assetDetail ? (
        <>
          <Card>
            <CardHeader className="border-b border-border/70">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle>{assetTitle}</CardTitle>
                  <CardDescription>
                    {subtitleParts.length > 0
                      ? subtitleParts.join(" · ")
                      : "Asset detail screen backed by the frontend detail serializer."}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">{`ID ${assetId}`}</Badge>
                  {(assetDetail.unique_identifier ?? initialAsset?.unique_identifier)?.trim() ? (
                    <Badge variant="neutral">
                      {formatAssetValue(
                        assetDetail.unique_identifier ?? initialAsset?.unique_identifier,
                      )}
                    </Badge>
                  ) : null}
                  <Badge
                    variant={
                      assetDetail.is_custom_by_organization ?? initialAsset?.is_custom_by_organization
                        ? "warning"
                        : "neutral"
                    }
                  >
                    {assetDetail.is_custom_by_organization ?? initialAsset?.is_custom_by_organization
                      ? "Custom"
                      : "Standard"}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {assetDetailTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={
                      tab.id === activeTabId
                        ? "rounded-[calc(var(--radius)-8px)] border border-primary/35 bg-primary/12 px-3 py-2 text-sm font-medium text-topbar-foreground"
                        : "rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/36 hover:text-foreground"
                    }
                    onClick={() => onSelectTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              {activeTabId === "metadata" ? (
                <AssetMetadataSection rows={metadataRows} />
              ) : (
                <TradingViewSection tradingView={tradingView} />
              )}
            </CardContent>
          </Card>

          <AssetOrderDialog
            assetId={assetId}
            assetTitle={assetTitle}
            onClose={() => setOrderDialogOpen(false)}
            open={orderDialogOpen}
            orderForm={orderForm}
          />
        </>
      ) : null}
    </div>
  );
}
