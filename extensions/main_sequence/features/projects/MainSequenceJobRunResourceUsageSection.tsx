import { Activity, HardDrive, MemoryStick } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TimeseriesAreaChart } from "@/components/ui/timeseries-area-chart";

import type { ResourceUsageChartPoint } from "../../api";

function formatMetricValue(value: number | null, suffix: string) {
  if (value === null || !Number.isFinite(value)) {
    return "No data";
  }

  return `${value.toFixed(2)}${suffix}`;
}

function getLatestMetricValue(
  points: ResourceUsageChartPoint[],
  key: "cpu_cores" | "memory_gib" | "disk_gib",
) {
  const latestPoint = points.at(-1);
  const value = latestPoint?.[key];
  return typeof value === "number" ? value : null;
}

export function MainSequenceJobRunResourceUsageSection({
  points,
}: {
  points: ResourceUsageChartPoint[];
}) {
  if (points.length === 0) {
    return null;
  }

  const charts = [
    {
      key: "cpu_cores",
      label: "CPU",
      detail: formatMetricValue(getLatestMetricValue(points, "cpu_cores"), " cores"),
      icon: Activity,
      color: "#4da3ff",
      valueFormatter: (value: number) => `${value.toFixed(2)} cores`,
    },
    {
      key: "memory_gib",
      label: "Memory",
      detail: formatMetricValue(getLatestMetricValue(points, "memory_gib"), " GiB"),
      icon: MemoryStick,
      color: "#22c55e",
      valueFormatter: (value: number) => `${value.toFixed(2)} GiB`,
    },
    {
      key: "disk_gib",
      label: "Disk",
      detail: formatMetricValue(getLatestMetricValue(points, "disk_gib"), " GiB"),
      icon: HardDrive,
      color: "#f59e0b",
      valueFormatter: (value: number) => `${value.toFixed(2)} GiB`,
    },
  ] as const;

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {charts.map((chart) => {
        const Icon = chart.icon;

        return (
          <Card key={chart.key}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {chart.label}
                  </div>
                  <div className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                    {chart.detail}
                  </div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/45 text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <TimeseriesAreaChart
                className="h-44"
                color={chart.color}
                data={points.map((point) => ({
                  time: point.time,
                  value: point[chart.key],
                }))}
                valueFormatter={chart.valueFormatter}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
