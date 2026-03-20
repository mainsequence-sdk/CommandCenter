import { useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";

import {
  fetchDataNodeCompressionPolicy,
  fetchDataNodeRetentionPolicy,
  formatMainSequenceError,
  saveDataNodeCompressionPolicy,
  saveDataNodeRetentionPolicy,
  type DataNodeCompressionPolicyConfig,
  type DataNodePolicyState,
  type DataNodeRetentionPolicyConfig,
} from "../../../../common/api";

function toDateTimeLocalValue(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toOptionalIsoString(value: string) {
  if (!value.trim()) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function formatLastModified(value?: string | null) {
  if (!value) {
    return "Not saved yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function getPolicyStatusVariant<TConfig>(policyState: DataNodePolicyState<TConfig> | undefined) {
  if (!policyState) {
    return "neutral" as const;
  }

  if (!policyState.supported) {
    return "danger" as const;
  }

  if (policyState.exists) {
    return "success" as const;
  }

  return "warning" as const;
}

function getPolicyStatusLabel<TConfig>(policyState: DataNodePolicyState<TConfig> | undefined) {
  if (!policyState) {
    return "Unknown";
  }

  if (!policyState.supported) {
    return "Unsupported";
  }

  if (policyState.exists) {
    return "Configured";
  }

  return "Not configured";
}

function PolicyField({
  label,
  placeholder,
  required = false,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "datetime-local";
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
        {required ? " *" : ""}
      </div>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function CompressionPolicyCard({
  dataNodeId,
}: {
  dataNodeId: number;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [compressAfter, setCompressAfter] = useState("");
  const [scheduleInterval, setScheduleInterval] = useState("");
  const [initialStart, setInitialStart] = useState("");
  const [timezone, setTimezone] = useState("UTC");

  const compressionPolicyQuery = useQuery({
    queryKey: ["main_sequence", "data_nodes", "compression_policy", dataNodeId],
    queryFn: () => fetchDataNodeCompressionPolicy(dataNodeId),
    enabled: dataNodeId > 0,
  });

  useEffect(() => {
    const config = compressionPolicyQuery.data?.config;

    setCompressAfter(config?.compress_after ?? "");
    setScheduleInterval(config?.schedule_interval ?? "");
    setInitialStart(toDateTimeLocalValue(config?.initial_start));
    setTimezone(config?.timezone ?? "UTC");
  }, [compressionPolicyQuery.data]);

  const saveCompressionMutation = useMutation({
    mutationFn: () =>
      saveDataNodeCompressionPolicy(dataNodeId, {
        compress_after: compressAfter.trim(),
        schedule_interval: scheduleInterval.trim() || null,
        initial_start: toOptionalIsoString(initialStart),
        timezone: timezone.trim() || null,
      }),
    onSuccess: async (policyState) => {
      const wasConfigured = compressionPolicyQuery.data?.exists ?? false;

      queryClient.setQueryData(
        ["main_sequence", "data_nodes", "compression_policy", dataNodeId],
        policyState,
      );
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "data_nodes", "summary", dataNodeId],
      });

      toast({
        variant: "success",
        title: "Compression policy saved",
        description: wasConfigured
          ? "The compression policy was updated."
          : "The compression policy was created.",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Compression policy save failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const policyState = compressionPolicyQuery.data;
  const config = policyState?.config as DataNodeCompressionPolicyConfig | null | undefined;

  return (
    <Card variant="nested">
      <CardHeader className="border-b border-border/70 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Compression policy</CardTitle>
            <CardDescription>Configure Timescale compression for this data node.</CardDescription>
          </div>
          <Badge variant={getPolicyStatusVariant(policyState)}>
            {getPolicyStatusLabel(policyState)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        {compressionPolicyQuery.isLoading ? (
          <div className="flex min-h-56 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading compression policy
            </div>
          </div>
        ) : null}

        {compressionPolicyQuery.isError ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatMainSequenceError(compressionPolicyQuery.error)}
          </div>
        ) : null}

        {!compressionPolicyQuery.isLoading && !compressionPolicyQuery.isError && policyState && !policyState.supported ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            {policyState.detail || "Compression policies are not supported for this data node."}
          </div>
        ) : null}

        {!compressionPolicyQuery.isLoading &&
        !compressionPolicyQuery.isError &&
        policyState?.supported ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveCompressionMutation.mutateAsync();
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <PolicyField
                label="Compress after"
                placeholder="7 days"
                required
                value={compressAfter}
                onChange={setCompressAfter}
              />
              <PolicyField
                label="Schedule interval"
                placeholder="12 hours"
                value={scheduleInterval}
                onChange={setScheduleInterval}
              />
              <PolicyField
                label="Initial start"
                type="datetime-local"
                value={initialStart}
                onChange={setInitialStart}
              />
              <PolicyField
                label="Timezone"
                placeholder="UTC"
                value={timezone}
                onChange={setTimezone}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                Last modified {formatLastModified(config?.last_modified)}
              </div>
              <Button
                type="submit"
                disabled={saveCompressionMutation.isPending || !compressAfter.trim()}
              >
                {saveCompressionMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Save compression policy
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RetentionPolicyCard({
  dataNodeId,
}: {
  dataNodeId: number;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dropAfter, setDropAfter] = useState("");
  const [scheduleInterval, setScheduleInterval] = useState("");
  const [initialStart, setInitialStart] = useState("");
  const [timezone, setTimezone] = useState("UTC");

  const retentionPolicyQuery = useQuery({
    queryKey: ["main_sequence", "data_nodes", "retention_policy", dataNodeId],
    queryFn: () => fetchDataNodeRetentionPolicy(dataNodeId),
    enabled: dataNodeId > 0,
  });

  useEffect(() => {
    const config = retentionPolicyQuery.data?.config;

    setDropAfter(config?.drop_after ?? "");
    setScheduleInterval(config?.schedule_interval ?? "");
    setInitialStart(toDateTimeLocalValue(config?.initial_start));
    setTimezone(config?.timezone ?? "UTC");
  }, [retentionPolicyQuery.data]);

  const saveRetentionMutation = useMutation({
    mutationFn: () =>
      saveDataNodeRetentionPolicy(dataNodeId, {
        drop_after: dropAfter.trim(),
        schedule_interval: scheduleInterval.trim() || null,
        initial_start: toOptionalIsoString(initialStart),
        timezone: timezone.trim() || null,
      }),
    onSuccess: async (policyState) => {
      const wasConfigured = retentionPolicyQuery.data?.exists ?? false;

      queryClient.setQueryData(
        ["main_sequence", "data_nodes", "retention_policy", dataNodeId],
        policyState,
      );
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "data_nodes", "summary", dataNodeId],
      });

      toast({
        variant: "success",
        title: "Retention policy saved",
        description: wasConfigured
          ? "The retention policy was updated."
          : "The retention policy was created.",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Retention policy save failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const policyState = retentionPolicyQuery.data;
  const config = policyState?.config as DataNodeRetentionPolicyConfig | null | undefined;

  return (
    <Card variant="nested">
      <CardHeader className="border-b border-border/70 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Retention policy</CardTitle>
            <CardDescription>Configure retention cleanup for this data node.</CardDescription>
          </div>
          <Badge variant={getPolicyStatusVariant(policyState)}>
            {getPolicyStatusLabel(policyState)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        {retentionPolicyQuery.isLoading ? (
          <div className="flex min-h-56 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading retention policy
            </div>
          </div>
        ) : null}

        {retentionPolicyQuery.isError ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatMainSequenceError(retentionPolicyQuery.error)}
          </div>
        ) : null}

        {!retentionPolicyQuery.isLoading && !retentionPolicyQuery.isError && policyState && !policyState.supported ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            {policyState.detail || "Retention policies are not supported for this data node."}
          </div>
        ) : null}

        {!retentionPolicyQuery.isLoading &&
        !retentionPolicyQuery.isError &&
        policyState?.supported ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveRetentionMutation.mutateAsync();
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <PolicyField
                label="Drop after"
                placeholder="30 days"
                required
                value={dropAfter}
                onChange={setDropAfter}
              />
              <PolicyField
                label="Schedule interval"
                placeholder="1 day"
                value={scheduleInterval}
                onChange={setScheduleInterval}
              />
              <PolicyField
                label="Initial start"
                type="datetime-local"
                value={initialStart}
                onChange={setInitialStart}
              />
              <PolicyField
                label="Timezone"
                placeholder="UTC"
                value={timezone}
                onChange={setTimezone}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                Last modified {formatLastModified(config?.last_modified)}
              </div>
              <Button
                type="submit"
                disabled={saveRetentionMutation.isPending || !dropAfter.trim()}
              >
                {saveRetentionMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Save retention policy
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function MainSequenceDataNodePoliciesTab({
  dataNodeId,
}: {
  dataNodeId: number;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <CompressionPolicyCard dataNodeId={dataNodeId} />
      <RetentionPolicyCard dataNodeId={dataNodeId} />
    </div>
  );
}
