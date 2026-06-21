import { useEffect, useMemo, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Database, Loader2, Table2 } from "lucide-react";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";

import {
  formatMainSequenceError,
  importMetaTablesFromDataSource,
  type MetaTableImportFromDataSourceRelation,
  type MetaTableImportFromDataSourceResponse,
} from "../../../../common/api";
import { MainSequenceSelectionCheckbox } from "../../../../common/components/MainSequenceSelectionCheckbox";

function getStatusBadgeVariant(status: string) {
  const normalizedStatus = status.trim().toLowerCase();

  if (normalizedStatus === "created" || normalizedStatus === "updated") {
    return "success" as const;
  }

  if (normalizedStatus === "unchanged") {
    return "neutral" as const;
  }

  if (normalizedStatus === "skipped") {
    return "warning" as const;
  }

  if (normalizedStatus === "failed") {
    return "danger" as const;
  }

  return "primary" as const;
}

function formatRelationKind(value: string) {
  return value
    .trim()
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatStatusLabel(value: string) {
  if (value === "created") {
    return "New";
  }

  if (value === "updated") {
    return "Refreshed";
  }

  if (value === "unchanged") {
    return "Up to date";
  }

  return value
    .trim()
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function getRelationName(relation: MetaTableImportFromDataSourceRelation) {
  return relation.physical_table_name.trim();
}

function getSelectableRelationNames(response: MetaTableImportFromDataSourceResponse | null) {
  if (!response?.dry_run) {
    return [];
  }

  return Array.from(
    new Set(
      response.relations
        .map((relation) => getRelationName(relation))
        .filter((relationName) => relationName.length > 0),
    ),
  );
}

export function MainSequenceProjectDataSourceMetaTableImportDialog({
  dataSourceUid,
  open,
  onClose,
  onOpenMetaTables,
}: {
  dataSourceUid: string;
  open: boolean;
  onClose: () => void;
  onOpenMetaTables: (namespace: string | null | undefined) => void;
}) {
  const queryClient = useQueryClient();
  const [previewResponse, setPreviewResponse] = useState<MetaTableImportFromDataSourceResponse | null>(null);
  const [importResponse, setImportResponse] = useState<MetaTableImportFromDataSourceResponse | null>(null);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [selectedRelationNames, setSelectedRelationNames] = useState<string[]>([]);

  const activeResponse = importResponse ?? previewResponse;
  const selectableRelationNames = useMemo(
    () => getSelectableRelationNames(previewResponse),
    [previewResponse],
  );
  const selectedRelationCount = selectedRelationNames.length;
  const allPreviewRelationsSelected =
    selectableRelationNames.length > 0 && selectedRelationCount === selectableRelationNames.length;
  const somePreviewRelationsSelected =
    selectedRelationCount > 0 && selectedRelationCount < selectableRelationNames.length;

  const importMutation = useMutation({
    mutationFn: async (dryRun: boolean) =>
      importMetaTablesFromDataSource({
        data_source_uid: dataSourceUid,
        namespace: null,
        dry_run: dryRun,
        include_views: true,
        follow_foreign_keys: true,
        refresh_existing: true,
        strict: false,
        identifier_strategy: "none",
        relation_names: dryRun ? [] : selectedRelationNames,
        exclude_relation_names: [],
        stale_policy: "report_only",
      }),
    onSuccess: async (response, dryRun) => {
      if (dryRun) {
        setPreviewResponse(response);
        setImportResponse(null);
        setSelectedRelationNames((current) => {
          const availableRelations = getSelectableRelationNames(response);

          if (availableRelations.length === 0) {
            return [];
          }

          if (!previewResponse && current.length === 0) {
            return availableRelations;
          }

          return current.filter((relationName) => availableRelations.includes(relationName));
        });
        return;
      }

      setImportResponse(response);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["main_sequence", "meta_tables"] }),
        queryClient.invalidateQueries({ queryKey: ["main_sequence", "namespaces"] }),
      ]);
    },
  });

  useEffect(() => {
    if (open) {
      return;
    }

    setPreviewResponse(null);
    setImportResponse(null);
    setConfirmImportOpen(false);
    setSelectedRelationNames([]);
    importMutation.reset();
  }, [importMutation, open]);

  const relationSummary = useMemo(() => {
    const response = activeResponse;

    if (!response) {
      return {
        relationCount: 0,
      };
    }

    return {
      relationCount: response.relations.length,
    };
  }, [activeResponse]);

  function toggleSelectedRelation(relationName: string) {
    setSelectedRelationNames((current) =>
      current.includes(relationName)
        ? current.filter((candidate) => candidate !== relationName)
        : [...current, relationName],
    );
  }

  function setAllSelectedRelations(nextSelected: boolean) {
    setSelectedRelationNames(nextSelected ? selectableRelationNames : []);
  }

  return (
    <Dialog
      title="Import tables"
      description="Preview the tables and views available from this data source, then confirm the import."
      open={open}
      onClose={() => {
        if (!importMutation.isPending) {
          onClose();
        }
      }}
      className="max-w-[min(1120px,calc(100vw-24px))]"
    >
      <div className="space-y-5">
        {!activeResponse ? (
          <Card>
            <CardHeader className="border-b border-border/70">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4 text-primary" />
                Preview import
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-5">
              <p className="text-sm text-foreground">
                We will inspect this data source and show the tables and views that can be imported.
                Nothing is written during the preview step.
              </p>
              <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/20 px-4 py-3 text-sm text-muted-foreground">
                After reviewing the preview, you will confirm the import in a separate confirmation modal.
              </div>
            </CardContent>
          </Card>
        ) : null}

        {importMutation.isError ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatMainSequenceError(importMutation.error)}
          </div>
        ) : null}

        {activeResponse ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="border-b border-border/70">
                <CardTitle className="text-base">
                  {activeResponse.dry_run ? "Preview results" : "Import results"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Found", activeResponse.counts.discovered],
                    ["New", activeResponse.counts.created],
                    ["Refreshed", activeResponse.counts.updated],
                    ["Up to date", activeResponse.counts.unchanged],
                    ["Skipped", activeResponse.counts.skipped],
                    ["Failed", activeResponse.counts.failed],
                    ["Missing from scan", activeResponse.counts.stale],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/20 px-3 py-3"
                    >
                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        {label}
                      </div>
                      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {activeResponse.dry_run ? (
                          <MainSequenceSelectionCheckbox
                            ariaLabel={
                              allPreviewRelationsSelected ? "Clear imported table selection" : "Select all imported tables"
                            }
                            checked={allPreviewRelationsSelected}
                            indeterminate={somePreviewRelationsSelected}
                            onChange={() => setAllSelectedRelations(!allPreviewRelationsSelected)}
                          />
                        ) : null}
                        <div className="text-sm font-medium text-foreground">Tables and views</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="neutral">
                          {`${relationSummary.relationCount} item${relationSummary.relationCount === 1 ? "" : "s"}`}
                        </Badge>
                        {activeResponse.dry_run ? (
                          <Badge variant={selectedRelationCount > 0 ? "primary" : "warning"}>
                            {`${selectedRelationCount} selected`}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    {activeResponse.dry_run ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 px-3 text-xs"
                          onClick={() => setAllSelectedRelations(true)}
                        >
                          Select all
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 px-3 text-xs"
                          onClick={() => setAllSelectedRelations(false)}
                        >
                          Clear selection
                        </Button>
                        <span>Confirm import will submit only the selected physical relation names.</span>
                      </div>
                    ) : null}
                    <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                      {activeResponse.relations.map((relation, index) => {
                        const relationName = getRelationName(relation);
                        const isSelected = activeResponse.dry_run
                          ? selectedRelationNames.includes(relationName)
                          : false;

                        return (
                          <div
                            key={`${relation.physical_table_name}-${relation.status}-${index}`}
                            className={`rounded-[calc(var(--radius)-8px)] border px-4 py-3 ${
                              activeResponse.dry_run && isSelected
                                ? "border-primary/50 bg-primary/5"
                                : "border-border/70 bg-background/20"
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex min-w-0 items-start gap-3">
                                {activeResponse.dry_run ? (
                                  <MainSequenceSelectionCheckbox
                                    ariaLabel={`Select ${relation.physical_table_name} for import`}
                                    checked={isSelected}
                                    onChange={() => toggleSelectedRelation(relationName)}
                                    className="mt-1"
                                  />
                                ) : null}
                                <div className="min-w-0">
                                  <div className="font-medium text-foreground">{relation.physical_table_name}</div>
                                  <div className="mt-1 flex flex-wrap gap-2">
                                    <Badge variant="neutral">{formatRelationKind(relation.relation_kind)}</Badge>
                                    <Badge variant={getStatusBadgeVariant(relation.status)}>
                                      {formatStatusLabel(relation.status)}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {relation.warnings && relation.warnings.length > 0 ? (
                              <div className="mt-3 rounded-[calc(var(--radius)-10px)] border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                                <div className="font-medium">Warnings</div>
                                <ul className="mt-1 list-disc space-y-1 pl-4">
                                  {relation.warnings.map((warning, warningIndex) => (
                                    <li key={`${relation.physical_table_name}-warning-${warningIndex}`}>{warning}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                            {relation.error ? (
                              <div className="mt-3 rounded-[calc(var(--radius)-10px)] border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                                <div className="font-medium">Failure</div>
                                <div className="mt-1">{relation.error}</div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/20 px-4 py-3">
                      <div className="text-sm font-medium text-foreground">Existing imports not found</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Informational only. This does not delete any physical tables.
                      </div>
                      {activeResponse.stale.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {activeResponse.stale.map((staleRecord, index) => (
                            <div
                              key={`${staleRecord.physical_table_name}-${index}`}
                              className="rounded-[calc(var(--radius)-10px)] border border-border/70 bg-background/35 px-3 py-2"
                            >
                              <div className="text-sm text-foreground">{staleRecord.physical_table_name}</div>
                              <div className="mt-1 text-xs text-muted-foreground">{staleRecord.reason}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-muted-foreground">Nothing extra was reported here.</div>
                      )}
                    </div>

                    <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/20 px-4 py-3">
                      <div className="text-sm font-medium text-foreground">Warnings</div>
                      {activeResponse.warnings.length > 0 ? (
                        <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                          {activeResponse.warnings.map((warning, index) => (
                            <li key={`warning-${index}`}>{warning}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mt-3 text-sm text-muted-foreground">No request-level warnings.</div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
          <div className="flex flex-wrap gap-2">
            {importResponse?.namespace ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenMetaTables(importResponse.namespace)}
              >
                <ArrowUpRight className="h-4 w-4" />
                Open Meta Tables
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={importMutation.isPending}>
              Close
            </Button>

            {importResponse ? null : previewResponse ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => importMutation.mutate(true)}
                  disabled={importMutation.isPending}
                >
                  {importMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Table2 className="h-4 w-4" />
                  )}
                  Refresh preview
                </Button>
                <Button
                  type="button"
                  onClick={() => setConfirmImportOpen(true)}
                  disabled={importMutation.isPending || selectedRelationCount === 0}
                >
                  <Database className="h-4 w-4" />
                  Confirm import
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={() => importMutation.mutate(true)}
                disabled={importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Table2 className="h-4 w-4" />
                )}
                Run preview
              </Button>
            )}
          </div>
        </div>
      </div>

      <ActionConfirmationDialog
        title="Confirm import"
        open={confirmImportOpen}
        onClose={() => {
          if (!importMutation.isPending) {
            setConfirmImportOpen(false);
          }
        }}
        tone="warning"
        actionLabel="import these tables"
        objectLabel="data source import"
        confirmWord="IMPORT TABLES"
        confirmButtonLabel="Import tables"
        description="This will create or refresh imported table definitions for the items shown in the preview."
        specialText="This writes import metadata only. It does not delete physical tables, and anything missing from the preview remains report-only."
        objectSummary={
          activeResponse ? (
            <>
              <div className="font-medium">
                {`${selectedRelationCount} selected relation${selectedRelationCount === 1 ? "" : "s"} will be imported`}
              </div>
              <div className="mt-1 text-muted-foreground">
                {`${activeResponse.counts.discovered} found in preview, ${activeResponse.counts.created} new, ${activeResponse.counts.updated} refreshed`}
              </div>
            </>
          ) : (
            <>
              <div className="font-medium">Imported tables</div>
              <div className="mt-1 text-muted-foreground">This action will use the current preview.</div>
            </>
          )
        }
        isPending={importMutation.isPending}
        onConfirm={() => importMutation.mutateAsync(false)}
        onSuccess={() => {
          setConfirmImportOpen(false);
        }}
        errorToast={{
          title: "Table import failed",
          description: (error) => formatMainSequenceError(error),
          variant: "error",
        }}
      />
    </Dialog>
  );
}
