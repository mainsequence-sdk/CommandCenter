import { Badge } from "@/components/ui/badge";
import type { ResolvedWidgetInput, WidgetSettingsComponentProps } from "@/widgets/types";

export interface DebugStreamWidgetProps extends Record<string, unknown> {}

function describeResolvedInput(
  input: ResolvedWidgetInput | ResolvedWidgetInput[] | undefined,
) {
  const entry = Array.isArray(input) ? input[0] : input;

  if (!entry) {
    return {
      status: "unbound",
      contractId: undefined,
      sourceWidgetId: undefined,
      sourceOutputId: undefined,
    };
  }

  return {
    status: entry.status,
    contractId: entry.contractId,
    sourceWidgetId: entry.sourceWidgetId,
    sourceOutputId: entry.sourceOutputId,
  };
}

export function DebugStreamWidgetSettings({
  resolvedInputs,
}: WidgetSettingsComponentProps<DebugStreamWidgetProps>) {
  const sourceInput = describeResolvedInput(resolvedInputs?.sourceData);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="primary">Debug</Badge>
        <Badge variant="neutral">Core widget</Badge>
        <Badge variant="neutral">Consumer only</Badge>
      </div>

      <div className="text-sm text-muted-foreground">
        This widget does not have authoring props. Bind <code>sourceData</code> in the Bindings
        tab, then use the panel preview to inspect what the consumer path actually resolved.
      </div>

      <section className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-4">
        <div className="text-sm font-medium text-topbar-foreground">Current binding snapshot</div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Status</div>
            <div className="mt-1 text-sm text-foreground">{sourceInput.status}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Contract</div>
            <div className="mt-1 break-all text-sm text-foreground">
              {sourceInput.contractId ?? "No resolved contract"}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Source widget</div>
            <div className="mt-1 break-all text-sm text-foreground">
              {sourceInput.sourceWidgetId ?? "No source widget selected"}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Source output</div>
            <div className="mt-1 break-all text-sm text-foreground">
              {sourceInput.sourceOutputId ?? "No source output selected"}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
