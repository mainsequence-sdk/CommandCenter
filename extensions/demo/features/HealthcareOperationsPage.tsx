import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogTable, type LogTableEntry } from "@/components/ui/log-table";
import { PageHeader } from "@/components/ui/page-header";
import { TimeseriesAreaChart } from "@/components/ui/timeseries-area-chart";

const healthcareKpis = [
  { label: "ED Wait", value: "27 min", delta: "-6 min", tone: "success" as const },
  { label: "Occupancy", value: "88%", delta: "+3 pts", tone: "warning" as const },
  { label: "OR Utilization", value: "79%", delta: "+5 pts", tone: "primary" as const },
  { label: "Staffing Gap", value: "14 FTE", delta: "-2 today", tone: "danger" as const },
];

const arrivalSeries = [
  142, 148, 151, 147, 154, 159, 163, 158, 156, 161, 166, 169,
].map((value, index) => ({
  time: Date.UTC(2026, 2, index + 1),
  value,
}));

const unitCapacity = [
  { unit: "ICU", census: "28 / 32", status: "Tight", note: "2 ventilator holds" },
  { unit: "ED", census: "61 / 74", status: "Stable", note: "Door-to-doc under target" },
  { unit: "Med-Surg", census: "124 / 138", status: "Busy", note: "Discharge queue after 14:00" },
  { unit: "OR", census: "17 / 22", status: "Stable", note: "Block utilization improving" },
];

const staffingBoard = [
  { team: "Night ICU RN", open: 4, agency: 2, risk: "High" },
  { team: "ED Physician", open: 1, agency: 0, risk: "Low" },
  { team: "Transport", open: 3, agency: 1, risk: "Medium" },
  { team: "Sterile Processing", open: 2, agency: 0, risk: "Medium" },
];

const operationsIncidents: LogTableEntry[] = [
  {
    id: "ed-surge",
    timestamp: "2026-03-26T06:40:00Z",
    level: "warning",
    source: "ED Command",
    message: "Respiratory triage queue exceeded surge threshold for 22 minutes.",
    status: "Resolved",
    tags: ["ed", "throughput"],
    summary: "Observation beds were flexed and triage nurse coverage was rebalanced from fast track.",
  },
  {
    id: "or-turnover",
    timestamp: "2026-03-26T05:15:00Z",
    level: "info",
    source: "Perioperative Ops",
    message: "Turnover time improved below target across orthopedic block.",
    status: "On target",
    tags: ["or", "efficiency"],
    summary: "Average turnover dropped to 24 minutes after sterile processing staffing shift.",
  },
  {
    id: "icu-capacity",
    timestamp: "2026-03-26T04:25:00Z",
    level: "critical",
    source: "Capacity Command",
    message: "ICU bed availability fell to 2 staffed beds during overnight transfer wave.",
    status: "Escalated",
    tags: ["icu", "capacity"],
    summary: "Hospital command opened progressive-care overflow and accelerated discharge rounds for step-down candidates.",
  },
];

function toneToBadge(tone: "danger" | "primary" | "success" | "warning") {
  return tone;
}

function unitStatusToBadge(status: string) {
  if (status === "Tight") {
    return "danger" as const;
  }

  if (status === "Busy") {
    return "warning" as const;
  }

  return "success" as const;
}

function staffingRiskToBadge(risk: string) {
  if (risk === "High") {
    return "danger" as const;
  }

  if (risk === "Medium") {
    return "warning" as const;
  }

  return "secondary" as const;
}

export function HealthcareOperationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Healthcare Operations"
        title="Hospital Command Center"
        description="Mock operating view for patient flow, unit utilization, staffing pressure, and perioperative throughput."
      />

      <div className="grid gap-4 xl:grid-cols-4">
        {healthcareKpis.map((item) => (
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

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Daily Arrivals</CardTitle>
            <CardDescription>Emergency arrivals trend across the current 12-day planning window.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <TimeseriesAreaChart
              className="h-full"
              data={arrivalSeries}
              valueFormatter={(value) => `${Math.round(value)} pts`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unit Capacity</CardTitle>
            <CardDescription>Bed pressure and operating notes by care area.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {unitCapacity.map((unit) => (
              <div
                key={unit.unit}
                className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-foreground">{unit.unit}</div>
                  <Badge variant={unitStatusToBadge(unit.status)}>{unit.status}</Badge>
                </div>
                <div className="mt-3 text-2xl font-semibold text-foreground">{unit.census}</div>
                <div className="mt-1 text-xs text-muted-foreground">{unit.note}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Staffing Focus</CardTitle>
            <CardDescription>Open roles and agency dependency by operating team.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {staffingBoard.map((row) => (
              <div
                key={row.team}
                className="flex items-center justify-between gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 p-4"
              >
                <div>
                  <div className="text-sm font-medium text-foreground">{row.team}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {row.open} open shifts, {row.agency} agency assignments
                  </div>
                </div>
                <Badge variant={staffingRiskToBadge(row.risk)}>{row.risk}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operational Events</CardTitle>
            <CardDescription>Throughput and capacity escalations routed through command.</CardDescription>
          </CardHeader>
          <CardContent>
            <LogTable logs={operationsIncidents} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
