import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Database, Loader2, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getAppPath } from "@/apps/utils";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  deleteCatalogueRow,
  fetchCatalogueRows,
  formatMainSequenceError,
  listCatalogue,
  mainSequenceRegistryPageSize,
  type CatalogueColumnDefinition,
  type CatalogueRecord,
  type CatalogueRowRecord,
} from "../../../../common/api";

function formatText(value: string | null | undefined, fallback = "Not available") {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function formatCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildCatalogueTitle(record: CatalogueRecord) {
  const identifier = formatText(record.identifier, "");
  const namespace = formatText(record.namespace, "");

  if (namespace && identifier) {
    return `${namespace}.${identifier}`;
  }

  return identifier || namespace || `Catalogue ${record.uid}`;
}

function readRowValue(row: CatalogueRowRecord, column: CatalogueColumnDefinition) {
  if (column.name === "uid") {
    return row.values.uid ?? row.uid;
  }

  return row.values[column.name];
}

function buildDataNodeDetailPath(dataNodeUid: string) {
  const searchParams = new URLSearchParams();
  searchParams.set("msDataNodeUid", dataNodeUid);
  searchParams.set("msDataNodeTab", "details");
  return `${getAppPath("main_sequence_workbench", "data-nodes")}?${searchParams.toString()}`;
}

function buildMetaTableDetailPath(metaTableUid: string) {
  const searchParams = new URLSearchParams();
  searchParams.set("msMetaTableUid", metaTableUid);
  searchParams.set("msMetaTableTab", "details");
  return `${getAppPath("main_sequence_workbench", "meta-tables")}?${searchParams.toString()}`;
}

function PaginationSummary({
  itemLabel,
  offset,
  loadedCount,
}: {
  itemLabel: string;
  offset: number;
  loadedCount: number;
}) {
  const start = loadedCount === 0 ? 0 : offset + 1;
  const end = offset + loadedCount;

  return (
    <div className="text-sm text-muted-foreground">
      {loadedCount === 0 ? `No ${itemLabel}` : `${start}-${end} ${itemLabel}`}
    </div>
  );
}

function PaginationActions({
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: {
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" disabled={!canGoBack} onClick={onBack}>
        Previous
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={!canGoForward} onClick={onForward}>
        Next
      </Button>
    </div>
  );
}

function DetailField({
  label,
  monospace = false,
  value,
}: {
  label: string;
  monospace?: boolean;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className={monospace ? "font-mono text-sm text-foreground" : "text-sm text-foreground"}>
        {value}
      </div>
    </div>
  );
}

export function MainSequenceCataloguePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const pageSize = mainSequenceRegistryPageSize;
  const [catalogueOffset, setCatalogueOffset] = useState(0);
  const [selectedCatalogue, setSelectedCatalogue] = useState<CatalogueRecord | null>(null);
  const [selectedRowsOffset, setSelectedRowsOffset] = useState(0);
  const [pendingDeleteRow, setPendingDeleteRow] = useState<CatalogueRowRecord | null>(null);

  const catalogueQuery = useQuery({
    queryKey: ["main_sequence", "catalogue", "list", catalogueOffset, pageSize],
    queryFn: () =>
      listCatalogue({
        limit: pageSize,
        offset: catalogueOffset,
      }),
  });

  const catalogueRowsQuery = useQuery({
    queryKey: ["main_sequence", "catalogue", "rows", selectedCatalogue?.uid ?? null, selectedRowsOffset, pageSize],
    queryFn: () =>
      fetchCatalogueRows(selectedCatalogue?.uid ?? "", {
        limit: pageSize,
        offset: selectedRowsOffset,
      }),
    enabled: selectedCatalogue?.supports_row_listing === true,
  });

  useEffect(() => {
    setSelectedRowsOffset(0);
    setPendingDeleteRow(null);
  }, [selectedCatalogue?.uid]);

  const deleteRowMutation = useMutation({
    mutationFn: async (row: CatalogueRowRecord) => {
      if (!selectedCatalogue) {
        throw new Error("No catalogue selected.");
      }

      return deleteCatalogueRow(selectedCatalogue.uid, row.uid);
    },
    onSuccess: async (result) => {
      const shouldMoveBackOnePage =
        (catalogueRowsQuery.data?.results.length ?? 0) === 1 && selectedRowsOffset > 0;

      if (shouldMoveBackOnePage) {
        setSelectedRowsOffset((current) => Math.max(0, current - pageSize));
      }

      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "catalogue", "rows", selectedCatalogue?.uid ?? null],
      });

      toast({
        variant: "success",
        title: "Catalogue row deleted",
        description: result.detail,
      });

      setPendingDeleteRow(null);
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Catalogue row delete failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const catalogueRows = catalogueQuery.data?.results ?? [];
  const canGoToPreviousCataloguePage = catalogueOffset > 0;
  const canGoToNextCataloguePage =
    catalogueRows.length >= (catalogueQuery.data?.limit ?? pageSize);

  const detailTitle = selectedCatalogue ? buildCatalogueTitle(selectedCatalogue) : "Catalogue";
  const detailDescription = selectedCatalogue
    ? formatText(selectedCatalogue.description, "Browse the row listing exposed by this backend catalogue record.")
    : "";
  const canDeleteRows = selectedCatalogue?.supports_row_delete === true;
  const selectedColumns = catalogueRowsQuery.data?.columns ?? [];
  const selectedRows = catalogueRowsQuery.data?.results ?? [];
  const canGoToPreviousRowsPage = selectedRowsOffset > 0;
  const canGoToNextRowsPage = selectedRows.length >= (catalogueRowsQuery.data?.limit ?? pageSize);

  const selectedCatalogueBadges = useMemo(() => {
    if (!selectedCatalogue) {
      return [];
    }

    return [
      selectedCatalogue.supports_row_listing ? "Row listing enabled" : "Row listing unavailable",
      selectedCatalogue.supports_row_delete ? "Row delete enabled" : "Row delete unavailable",
    ];
  }, [selectedCatalogue]);

  function openCatalogueRecord(record: CatalogueRecord) {
    const normalizedResourceType = record.resource_type?.trim().toLowerCase() ?? "";

    if (normalizedResourceType === "datanode") {
      navigate(buildDataNodeDetailPath(record.uid));
      return;
    }

    if (normalizedResourceType === "metatable") {
      navigate(buildMetaTableDetailPath(record.uid));
      return;
    }

    setSelectedCatalogue(record);
  }

  if (selectedCatalogue) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Main Sequence Markets"
          title={detailTitle}
          description={detailDescription}
          actions={
            <Button type="button" variant="outline" onClick={() => setSelectedCatalogue(null)}>
              <ArrowLeft className="h-4 w-4" />
              Back to catalogue
            </Button>
          }
        />

        <Card>
          <CardHeader className="border-b border-border/70">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>Catalogue record</CardTitle>
                <CardDescription>
                  Backend metadata for this catalogue registration. The corrected contract does not expose
                  `physical_schema` or `physical_table_name`.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedCatalogueBadges.map((badge) => (
                  <Badge key={badge} variant="neutral">
                    {badge}
                  </Badge>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              <DetailField label="Namespace" value={formatText(selectedCatalogue.namespace)} />
              <DetailField label="Identifier" value={formatText(selectedCatalogue.identifier)} />
              <DetailField label="Model name" value={formatText(selectedCatalogue.model_name)} />
              <DetailField label="Meta table uid" monospace value={formatText(selectedCatalogue.meta_table_uid)} />
              <DetailField label="Storage hash" monospace value={formatText(selectedCatalogue.storage_hash)} />
              <DetailField label="Contract hash" monospace value={formatText(selectedCatalogue.contract_hash)} />
              <DetailField label="SDK version" value={formatText(selectedCatalogue.sdk_version, "Not set")} />
              <DetailField label="Created at" value={formatText(selectedCatalogue.created_at)} />
              <DetailField label="Updated at" value={formatText(selectedCatalogue.updated_at)} />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <DetailField label="Rows endpoint" monospace value={formatText(selectedCatalogue.rows_endpoint)} />
              <DetailField
                label="Delete endpoint template"
                monospace
                value={formatText(selectedCatalogue.delete_endpoint_template)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/70">
            <CardTitle>Columns</CardTitle>
            <CardDescription>
              Column definitions returned by `GET /api/v1/catalog/{'{catalog_uid}'}/rows/`.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {catalogueRowsQuery.isLoading ? (
              <div className="flex min-h-32 items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading catalogue schema
                </div>
              </div>
            ) : null}

            {catalogueRowsQuery.isError ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(catalogueRowsQuery.error)}
              </div>
            ) : null}

            {!catalogueRowsQuery.isLoading && !catalogueRowsQuery.isError && selectedColumns.length === 0 ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45 px-4 py-3 text-sm text-muted-foreground">
                No column definitions were returned for this catalogue entry.
              </div>
            ) : null}

            {!catalogueRowsQuery.isLoading && !catalogueRowsQuery.isError && selectedColumns.length > 0 ? (
              <div className="overflow-hidden rounded-[calc(var(--radius)-4px)] border border-border/70">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-muted/35 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Column</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Nullable</th>
                      <th className="px-4 py-3 font-medium">Primary key</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedColumns.map((column) => (
                      <tr key={column.name} className="border-t border-border/70 align-top">
                        <td className="px-4 py-3 font-mono text-xs text-foreground">{column.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatText(column.type)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{column.nullable ? "Yes" : "No"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{column.primary_key ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/70">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>Rows</CardTitle>
                <CardDescription>
                  Paginated row listing returned by the catalogue rows endpoint.
                </CardDescription>
              </div>
              {selectedCatalogue.supports_row_listing ? (
                <Badge variant="neutral">{`${selectedRows.length} loaded`}</Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {!selectedCatalogue.supports_row_listing ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45 px-4 py-3 text-sm text-muted-foreground">
                This catalogue entry does not expose row listing.
              </div>
            ) : null}

            {selectedCatalogue.supports_row_listing && catalogueRowsQuery.isLoading ? (
              <div className="flex min-h-40 items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading catalogue rows
                </div>
              </div>
            ) : null}

            {selectedCatalogue.supports_row_listing && catalogueRowsQuery.isError ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(catalogueRowsQuery.error)}
              </div>
            ) : null}

            {selectedCatalogue.supports_row_listing &&
            !catalogueRowsQuery.isLoading &&
            !catalogueRowsQuery.isError &&
            selectedRows.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/60">
                  <Database className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="mt-4 space-y-1">
                  <p className="text-sm font-medium text-foreground">No rows returned</p>
                  <p className="text-sm text-muted-foreground">
                    This catalogue page does not currently expose any rows for the selected offset.
                  </p>
                </div>
              </div>
            ) : null}

            {selectedCatalogue.supports_row_listing &&
            !catalogueRowsQuery.isLoading &&
            !catalogueRowsQuery.isError &&
            selectedRows.length > 0 ? (
              <>
                <div className="overflow-hidden rounded-[calc(var(--radius)-4px)] border border-border/70">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-muted/35 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      <tr>
                        {selectedColumns.map((column) => (
                          <th key={column.name} className="px-4 py-3 font-medium">
                            {column.name}
                          </th>
                        ))}
                        {canDeleteRows ? <th className="px-4 py-3 font-medium">Actions</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRows.map((row) => (
                        <tr key={row.uid} className="border-t border-border/70 align-top">
                          {selectedColumns.map((column) => (
                            <td key={`${row.uid}-${column.name}`} className="px-4 py-3 text-muted-foreground">
                              <div className="max-w-sm whitespace-pre-wrap break-words leading-6">
                                {formatCellValue(readRowValue(row, column))}
                              </div>
                            </td>
                          ))}
                          {canDeleteRows ? (
                            <td className="px-4 py-3">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setPendingDeleteRow(row)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </Button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <PaginationSummary
                    itemLabel="rows"
                    offset={catalogueRowsQuery.data?.offset ?? selectedRowsOffset}
                    loadedCount={selectedRows.length}
                  />
                  <PaginationActions
                    canGoBack={canGoToPreviousRowsPage}
                    canGoForward={canGoToNextRowsPage}
                    onBack={() => setSelectedRowsOffset((current) => Math.max(0, current - pageSize))}
                    onForward={() => setSelectedRowsOffset((current) => current + pageSize)}
                  />
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <ActionConfirmationDialog
          open={pendingDeleteRow !== null}
          onClose={() => setPendingDeleteRow(null)}
          title="Delete catalogue row"
          actionLabel="delete"
          confirmButtonLabel="Delete row"
          confirmWord="DELETE"
          objectLabel="catalogue row"
          description="This sends the catalogue row delete endpoint for the selected row uid."
          objectSummary={
            pendingDeleteRow ? (
              <div className="space-y-1">
                <div className="font-medium text-foreground">{detailTitle}</div>
                <div className="font-mono text-xs text-muted-foreground">{pendingDeleteRow.uid}</div>
              </div>
            ) : undefined
          }
          error={deleteRowMutation.isError ? formatMainSequenceError(deleteRowMutation.error) : undefined}
          isPending={deleteRowMutation.isPending}
          onConfirm={() => {
            if (!pendingDeleteRow) {
              return null;
            }

            return deleteRowMutation.mutateAsync(pendingDeleteRow);
          }}
          tone="danger"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title="Catalogue"
        description="Browse backend catalogue registrations and open the row listing each record exposes."
        actions={<Badge variant="neutral">{`${catalogueRows.length} loaded`}</Badge>}
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-1">
            <CardTitle>Catalogue registry</CardTitle>
            <CardDescription>
              This view uses the corrected catalogue contract and intentionally omits `physical_schema`
              and `physical_table_name`.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {catalogueQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading catalogue
              </div>
            </div>
          ) : null}

          {catalogueQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(catalogueQuery.error)}
            </div>
          ) : null}

          {!catalogueQuery.isLoading && !catalogueQuery.isError && catalogueRows.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/60">
                <Database className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="mt-4 space-y-1">
                <p className="text-sm font-medium text-foreground">No catalogue rows found</p>
                <p className="text-sm text-muted-foreground">
                  The backend did not return any catalogue registrations for the current offset.
                </p>
              </div>
            </div>
          ) : null}

          {!catalogueQuery.isLoading && !catalogueQuery.isError && catalogueRows.length > 0 ? (
            <>
              <div className="overflow-hidden rounded-[calc(var(--radius)-4px)] border border-border/70">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-muted/35 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Catalogue</th>
                      <th className="px-4 py-3 font-medium">Namespace</th>
                      <th className="px-4 py-3 font-medium">Model</th>
                      <th className="px-4 py-3 font-medium">Meta table uid</th>
                      <th className="px-4 py-3 font-medium">Storage hash</th>
                      <th className="px-4 py-3 font-medium">Capabilities</th>
                      <th className="px-4 py-3 font-medium">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogueRows.map((record) => (
                      <tr key={record.uid} className="border-t border-border/70 align-top">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="space-y-1 text-left transition-opacity hover:opacity-80"
                            onClick={() => openCatalogueRecord(record)}
                          >
                            <div className="font-medium text-foreground">
                              {formatText(record.identifier, `Catalogue ${record.uid}`)}
                            </div>
                            <div className="font-mono text-xs text-muted-foreground">{record.uid}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatText(record.description, "No description provided.")}
                            </div>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatText(record.namespace)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatText(record.model_name)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {formatText(record.meta_table_uid)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {formatText(record.storage_hash)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="neutral">
                              {record.supports_row_listing ? "Rows enabled" : "Rows unavailable"}
                            </Badge>
                            <Badge variant="neutral">
                              {record.supports_row_delete ? "Delete enabled" : "Delete unavailable"}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatText(record.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <PaginationSummary
                  itemLabel="catalogue rows"
                  offset={catalogueQuery.data?.offset ?? catalogueOffset}
                  loadedCount={catalogueRows.length}
                />
                <PaginationActions
                  canGoBack={canGoToPreviousCataloguePage}
                  canGoForward={canGoToNextCataloguePage}
                  onBack={() => setCatalogueOffset((current) => Math.max(0, current - pageSize))}
                  onForward={() => setCatalogueOffset((current) => current + pageSize)}
                />
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
