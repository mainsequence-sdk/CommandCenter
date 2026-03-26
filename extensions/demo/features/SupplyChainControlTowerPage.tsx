import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogTable, type LogTableEntry } from "@/components/ui/log-table";
import { PageHeader } from "@/components/ui/page-header";
import { TimeseriesAreaChart } from "@/components/ui/timeseries-area-chart";

const supplyChainKpis = [
  { label: "OTIF", value: "94.6%", delta: "+0.8 pts", tone: "success" as const },
  { label: "Inventory At Risk", value: "$8.4M", delta: "-12%", tone: "warning" as const },
  { label: "Expedites", value: "12", delta: "+3 today", tone: "danger" as const },
  { label: "Supplier Fill", value: "97.2%", delta: "+0.4 pts", tone: "primary" as const },
];

const backlogSeries = [
  7.8, 7.5, 7.3, 7.1, 6.9, 6.6, 6.8, 6.4, 6.1, 5.9, 5.7, 5.5,
].map((value, index) => ({
  time: Date.UTC(2026, 2, index + 1),
  value,
}));

const facilityStatus = [
  { site: "Monterrey DC", status: "Stable", utilization: "82%", note: "Labor fully staffed" },
  { site: "Rotterdam Port", status: "Watch", utilization: "91%", note: "Vessel queue extending" },
  { site: "Memphis Air Hub", status: "Recovering", utilization: "76%", note: "Expedite lane normalized" },
  { site: "Shenzhen Plant", status: "Constrained", utilization: "94%", note: "Component shortage on line 4" },
];

const laneExceptions = [
  { lane: "Shenzhen -> LA", slip: "18h", containers: 34, owner: "Ocean Ops", risk: "High" },
  { lane: "Monterrey -> Chicago", slip: "6h", containers: 18, owner: "Ground Control", risk: "Medium" },
  { lane: "Rotterdam -> Warsaw", slip: "11h", containers: 22, owner: "EMEA Planning", risk: "Medium" },
  { lane: "Busan -> Seattle", slip: "4h", containers: 14, owner: "Asia Export", risk: "Low" },
];

const supplyAlerts: LogTableEntry[] = [
  {
    id: "supplier-capacitor",
    timestamp: "2026-03-26T06:20:00Z",
    level: "warning",
    source: "Supplier Risk",
    message: "Tier-2 capacitor supplier dropped confirmed April allocation by 14%.",
    status: "Mitigation in progress",
    tags: ["electronics", "allocation"],
    summary: "Procurement is shifting 3.2 weeks of demand to the Czech alternate source.",
  },
  {
    id: "port-rotterdam",
    timestamp: "2026-03-26T05:45:00Z",
    level: "info",
    source: "Port Intelligence",
    message: "Rotterdam berth congestion moved from 1.6 to 2.1 day average dwell.",
    status: "Monitoring",
    tags: ["ocean", "emea"],
    summary: "No service failures yet, but outbound replenishment buffers are tightening for Poland and Germany.",
  },
  {
    id: "cold-chain",
    timestamp: "2026-03-26T04:55:00Z",
    level: "critical",
    source: "Cold Chain",
    message: "Temperature excursion detected on biologics lane ORD -> YYZ.",
    status: "Escalated",
    tags: ["cold-chain", "quality"],
    summary: "Quality hold placed on 6 pallets pending sensor reconciliation and carrier claim review.",
  },
];

function toneToBadge(tone: "danger" | "primary" | "success" | "warning") {
  return tone;
}

function riskToBadge(risk: string) {
  if (risk === "High") {
    return "danger" as const;
  }

  if (risk === "Medium") {
    return "warning" as const;
  }

  return "secondary" as const;
}

function statusToBadge(status: string) {
  if (status === "Stable") {
    return "success" as const;
  }

  if (status === "Constrained") {
    return "danger" as const;
  }

  if (status === "Watch") {
    return "warning" as const;
  }

  return "primary" as const;
}

export function SupplyChainControlTowerPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Supply Chain"
        title="Control Tower"
        description="Mock operating view for inventory pressure, lane risk, supplier reliability, and fulfillment recovery."
      />

      <div className="grid gap-4 xl:grid-cols-4">
        {supplyChainKpis.map((item) => (
          <Card key={item.label}>
            <CardContent className="flex min-h-[136px] flex-col justify-between p-5">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {item.label}
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                  {item.value}
                </div>
              </div>
              <Badge variant={toneToBadge(item.tone)}>{item.delta}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Backlog Days Trend</CardTitle>
            <CardDescription>Open customer-order backlog in days of demand coverage.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <TimeseriesAreaChart
              className="h-full"
              data={backlogSeries}
              valueFormatter={(value) => `${value.toFixed(1)} d`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Facility Pulse</CardTitle>
            <CardDescription>Current utilization and local execution notes by node.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {facilityStatus.map((site) => (
              <div
                key={site.site}
                className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">{site.site}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{site.note}</div>
                  </div>
                  <Badge variant={statusToBadge(site.status)}>{site.status}</Badge>
                </div>
                <div className="mt-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Utilization
                </div>
                <div className="mt-1 text-lg font-semibold text-foreground">{site.utilization}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lane Exceptions</CardTitle>
          <CardDescription>Priority shipments with ETA slippage or capacity imbalance.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-border/70 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="px-3 py-3 font-medium">Lane</th>
                  <th className="px-3 py-3 font-medium">ETA Slip</th>
                  <th className="px-3 py-3 font-medium">Containers</th>
                  <th className="px-3 py-3 font-medium">Owner</th>
                  <th className="px-3 py-3 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {laneExceptions.map((lane) => (
                  <tr key={lane.lane} className="border-b border-border/50">
                    <td className="px-3 py-3 text-sm font-medium text-foreground">{lane.lane}</td>
                    <td className="px-3 py-3 text-sm text-foreground">{lane.slip}</td>
                    <td className="px-3 py-3 text-sm text-foreground">{lane.containers}</td>
                    <td className="px-3 py-3 text-sm text-muted-foreground">{lane.owner}</td>
                    <td className="px-3 py-3">
                      <Badge variant={riskToBadge(lane.risk)}>{lane.risk}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Escalations</CardTitle>
          <CardDescription>Active supplier, logistics, and quality interruptions.</CardDescription>
        </CardHeader>
        <CardContent>
          <LogTable logs={supplyAlerts} />
        </CardContent>
      </Card>
    </div>
  );
}
