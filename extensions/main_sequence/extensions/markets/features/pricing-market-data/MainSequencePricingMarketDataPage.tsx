import { BarChart3 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export function MainSequencePricingMarketDataPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title="Pricing Market Data"
        description="Pricing-oriented market data workflows for Main Sequence Markets."
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex items-start gap-3">
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45 p-2 text-muted-foreground">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <CardTitle>Pricing Market Data</CardTitle>
              <CardDescription>
                This surface is ready for pricing data registries, curves, fixings, and market-data
                inspection workflows.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3 text-sm text-muted-foreground">
            Pricing market data content has not been wired to a backend contract yet.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
