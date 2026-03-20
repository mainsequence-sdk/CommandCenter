import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export function MainSequenceMarketsHomePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Main Sequence Markets"
        description="Separate app shell for market-facing Main Sequence workflows."
      />
      <Card>
        <CardHeader>
          <CardTitle>Markets extension scaffold</CardTitle>
          <CardDescription>
            Shared Main Sequence domain code now lives under
            {" "}
            <code>extensions/main_sequence/common</code>
            {" "}
            so this app can grow without depending on Workbench internals.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Add market-specific screens under
            {" "}
            <code>extensions/main_sequence/extensions/markets/features</code>
            {" "}
            and keep reusable Main Sequence transport, UI, and hooks under
            {" "}
            <code>extensions/main_sequence/common</code>.
          </p>
          <p>
            This page is intentionally minimal so the new extension registers cleanly while the
            rest of the Markets surface area is built out.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
