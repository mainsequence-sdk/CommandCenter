import { Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export function MainSequenceInstrumentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title="Instruments"
        description="Instrument workflows will live here once the backend contract for this screen is defined."
        actions={<Badge variant="neutral">Pending API</Badge>}
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div>
            <CardTitle>Instrument registry</CardTitle>
            <CardDescription>
              This surface has been added to Markets and is ready to receive the instrument list and
              detail flows when you provide the endpoint contract.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-8px)] border border-dashed border-border/70 bg-background/24 px-6 py-10 text-center">
            <div className="rounded-full border border-border/70 bg-card/80 p-3 text-muted-foreground">
              <Wrench className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-foreground">Instrument screen scaffolded</div>
              <div className="max-w-2xl text-sm text-muted-foreground">
                Add the instrument list endpoint and any required detail or bulk actions, and this
                page can be converted into the standard Main Sequence registry flow.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
