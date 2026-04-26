import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ConnectionConfigEditorProps } from "@/connections/types";
import { WidgetSettingFieldLabel } from "@/widgets/shared/widget-setting-help";

import {
  DEFAULT_MASSIVE_ASSET_CLASSES,
  MASSIVE_ASSET_CLASS_OPTIONS,
  MASSIVE_CONFIG_FIELD_HELP,
  type MassiveAssetClass,
  type MassivePublicConfig,
  type MassiveQueryCachePolicy,
} from "./massiveShared";

function updateConfig(
  value: MassivePublicConfig,
  onChange: (value: MassivePublicConfig) => void,
  patch: Partial<MassivePublicConfig>,
) {
  onChange({ ...value, ...patch });
}

function readOptionalNumber(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeAssetClasses(value: MassivePublicConfig["enabledAssetClasses"]) {
  return Array.isArray(value) && value.length > 0 ? value : [...DEFAULT_MASSIVE_ASSET_CLASSES];
}

function Field({
  children,
  help,
  label,
  required,
}: {
  children: React.ReactNode;
  help: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <WidgetSettingFieldLabel
        className="text-xs font-medium text-muted-foreground"
        help={help}
        required={required}
      >
        {label}
      </WidgetSettingFieldLabel>
      {children}
    </label>
  );
}

export function MassiveConnectionConfigEditor({
  disabled = false,
  onChange,
  value,
}: ConnectionConfigEditorProps<MassivePublicConfig>) {
  const enabledAssetClasses = normalizeAssetClasses(value.enabledAssetClasses);

  function toggleAssetClass(assetClass: MassiveAssetClass, checked: boolean) {
    const nextAssetClasses = checked
      ? Array.from(new Set([...enabledAssetClasses, assetClass]))
      : enabledAssetClasses.filter((entry) => entry !== assetClass);

    updateConfig(value, onChange, {
      enabledAssetClasses:
        nextAssetClasses.length > 0 ? nextAssetClasses : [...DEFAULT_MASSIVE_ASSET_CLASSES],
    });
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-2">
        <Field label="Base URL" help={MASSIVE_CONFIG_FIELD_HELP.baseUrl}>
          <Input
            value={value.baseUrl ?? ""}
            onChange={(event) => updateConfig(value, onChange, { baseUrl: event.target.value })}
            disabled={disabled}
            placeholder="https://api.massive.com"
          />
        </Field>

        <Field label="Default limit" help={MASSIVE_CONFIG_FIELD_HELP.defaultLimit}>
          <Input
            type="number"
            min={1}
            max={50000}
            value={value.defaultLimit ?? ""}
            onChange={(event) =>
              updateConfig(value, onChange, { defaultLimit: readOptionalNumber(event.target.value) })
            }
            disabled={disabled}
            placeholder="1000"
          />
        </Field>
      </section>

      <section className="space-y-2">
        <WidgetSettingFieldLabel
          className="text-xs font-medium text-muted-foreground"
          help={MASSIVE_CONFIG_FIELD_HELP.enabledAssetClasses}
          required
        >
          Enabled asset classes
        </WidgetSettingFieldLabel>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {MASSIVE_ASSET_CLASS_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex min-h-10 items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border bg-transparent accent-primary"
                checked={enabledAssetClasses.includes(option.value)}
                onChange={(event) => toggleAssetClass(option.value, event.target.checked)}
                disabled={disabled}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Field label="Maximum rows" help={MASSIVE_CONFIG_FIELD_HELP.maxRows}>
          <Input
            type="number"
            min={1}
            max={50000}
            value={value.maxRows ?? ""}
            onChange={(event) =>
              updateConfig(value, onChange, { maxRows: readOptionalNumber(event.target.value) })
            }
            disabled={disabled}
            placeholder="50000"
          />
        </Field>

        <Field label="Request timeout ms" help={MASSIVE_CONFIG_FIELD_HELP.requestTimeoutMs}>
          <Input
            type="number"
            min={1000}
            max={30000}
            value={value.requestTimeoutMs ?? ""}
            onChange={(event) =>
              updateConfig(value, onChange, {
                requestTimeoutMs: readOptionalNumber(event.target.value),
              })
            }
            disabled={disabled}
            placeholder="10000"
          />
        </Field>

        <Field label="Query cache policy" help={MASSIVE_CONFIG_FIELD_HELP.queryCachePolicy}>
          <Select
            value={value.queryCachePolicy ?? "read"}
            onChange={(event) =>
              updateConfig(value, onChange, {
                queryCachePolicy: event.target.value as MassiveQueryCachePolicy,
              })
            }
            disabled={disabled}
          >
            <option value="read">read</option>
            <option value="disabled">disabled</option>
          </Select>
        </Field>

        <Field label="Query cache TTL ms" help={MASSIVE_CONFIG_FIELD_HELP.queryCacheTtlMs}>
          <Input
            type="number"
            min={0}
            value={value.queryCacheTtlMs ?? ""}
            onChange={(event) =>
              updateConfig(value, onChange, {
                queryCacheTtlMs: readOptionalNumber(event.target.value),
              })
            }
            disabled={disabled}
            placeholder="30000"
          />
        </Field>

        <Field label="Metadata cache TTL ms" help={MASSIVE_CONFIG_FIELD_HELP.metadataCacheTtlMs}>
          <Input
            type="number"
            min={0}
            value={value.metadataCacheTtlMs ?? ""}
            onChange={(event) =>
              updateConfig(value, onChange, {
                metadataCacheTtlMs: readOptionalNumber(event.target.value),
              })
            }
            disabled={disabled}
            placeholder="300000"
          />
        </Field>
      </section>

      <section className="grid gap-3 xl:grid-cols-3">
        <label className="flex items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2.5">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border bg-transparent accent-primary"
            checked={value.enableBetaEndpoints ?? false}
            onChange={(event) =>
              updateConfig(value, onChange, { enableBetaEndpoints: event.target.checked })
            }
            disabled={disabled}
          />
          <WidgetSettingFieldLabel
            help={MASSIVE_CONFIG_FIELD_HELP.enableBetaEndpoints}
            textClassName="text-sm font-medium text-foreground"
          >
            Enable beta endpoints
          </WidgetSettingFieldLabel>
        </label>

        <label className="flex items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2.5">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border bg-transparent accent-primary"
            checked={value.enableDeprecatedEndpoints ?? false}
            onChange={(event) =>
              updateConfig(value, onChange, { enableDeprecatedEndpoints: event.target.checked })
            }
            disabled={disabled}
          />
          <WidgetSettingFieldLabel
            help={MASSIVE_CONFIG_FIELD_HELP.enableDeprecatedEndpoints}
            textClassName="text-sm font-medium text-foreground"
          >
            Enable deprecated endpoints
          </WidgetSettingFieldLabel>
        </label>

        <label className="flex items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2.5">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border bg-transparent accent-primary"
            checked={value.dedupeInFlight ?? true}
            onChange={(event) =>
              updateConfig(value, onChange, { dedupeInFlight: event.target.checked })
            }
            disabled={disabled}
          />
          <WidgetSettingFieldLabel
            help={MASSIVE_CONFIG_FIELD_HELP.dedupeInFlight}
            textClassName="text-sm font-medium text-foreground"
          >
            Dedupe in-flight queries
          </WidgetSettingFieldLabel>
        </label>
      </section>
    </div>
  );
}
