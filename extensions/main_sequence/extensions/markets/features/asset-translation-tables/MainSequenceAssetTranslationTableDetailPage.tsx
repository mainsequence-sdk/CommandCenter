import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Database, Loader2, PencilLine, Plus, Trash2 } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  createAssetTranslationTableRule,
  deleteAssetTranslationTable,
  deleteAssetTranslationTableRule,
  fetchAssetTranslationTableDetail,
  formatMainSequenceError,
  listAssetTranslationTableRules,
  updateAssetTranslationTable,
  updateAssetTranslationTableRule,
  type AssetTranslationTableRuleListFilters,
  type AssetTranslationTableRuleListRow,
} from "../../../../common/api";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import {
  AssetTranslationTableEditorDialog,
  AssetTranslationTableRuleEditorDialog,
  buildAssetTranslationTableDeleteSummary,
  buildAssetTranslationTableInitialValues,
  buildAssetTranslationTableRuleDeleteSummary,
  buildAssetTranslationTableRuleInitialValues,
  buildAssetTranslationTableRulePayload,
  buildAssetTranslationTableUpdatePayload,
  buildTranslationTableListRowFromDetail,
  formatTranslationDateTime,
  formatTranslationTableValue,
  getAssetTranslationTablesListPath,
  readTranslationTableDetailString,
  renderTranslationTableDetailValue,
  type AssetTranslationTableEditorValues,
  type AssetTranslationTableRuleEditorMode,
  type AssetTranslationTableRuleEditorValues,
} from "./assetTranslationTableShared";

const translationTableRulesPageSize = 20;

type RuleEditorState = {
  mode: AssetTranslationTableRuleEditorMode;
  rule: AssetTranslationTableRuleListRow | null;
};

function readPositiveInt(value: string | null | undefined) {
  const parsed = Number(value ?? "");

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readDeleteDetail(result: unknown, fallback: string) {
  if (result && typeof result === "object" && "detail" in result) {
    const detail = (result as { detail?: unknown }).detail;

    if (typeof detail === "string" && detail.trim()) {
      return detail.trim();
    }
  }

  return fallback;
}

export function MainSequenceAssetTranslationTableDetailPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleEditorState, setRuleEditorState] = useState<RuleEditorState | null>(null);
  const [ruleDeleteTarget, setRuleDeleteTarget] = useState<AssetTranslationTableRuleListRow | null>(
    null,
  );
  const [rulesSearchValue, setRulesSearchValue] = useState("");
  const [rulesPageIndex, setRulesPageIndex] = useState(0);

  const tableId = readPositiveInt(params.tableId);
  const deferredRulesSearchValue = useDeferredValue(rulesSearchValue);
  const backPath =
    ((location.state as { from?: string } | null)?.from || "").trim() ||
    getAssetTranslationTablesListPath();

  const tableDetailQuery = useQuery({
    queryKey: ["main_sequence", "asset_translation_tables", "detail", tableId],
    queryFn: () => fetchAssetTranslationTableDetail(tableId as number),
    enabled: tableId !== null,
  });

  const rulesFilters = useMemo(
    () =>
      ({
        search: deferredRulesSearchValue,
        page: rulesPageIndex + 1,
        pageSize: translationTableRulesPageSize,
      }) satisfies AssetTranslationTableRuleListFilters,
    [deferredRulesSearchValue, rulesPageIndex],
  );

  const rulesQuery = useQuery({
    queryKey: ["main_sequence", "asset_translation_tables", "rules", tableId, rulesFilters],
    queryFn: () => listAssetTranslationTableRules(tableId as number, rulesFilters),
    enabled: tableId !== null,
  });

  const rulesRows = rulesQuery.data?.rows ?? [];
  const rulesPagination = rulesQuery.data?.pagination;
  const rulesTotalCount = rulesPagination?.total_items ?? rulesRows.length;
  const rulesPageSize = rulesPagination?.page_size ?? translationTableRulesPageSize;
  const rulesTotalPages =
    rulesPagination?.total_pages ?? Math.max(1, Math.ceil(rulesTotalCount / rulesPageSize));

  useEffect(() => {
    setRulesSearchValue("");
    setRulesPageIndex(0);
  }, [tableId]);

  useEffect(() => {
    setRulesPageIndex(0);
  }, [deferredRulesSearchValue]);

  useEffect(() => {
    if (rulesPageIndex > rulesTotalPages - 1) {
      setRulesPageIndex(rulesTotalPages - 1);
    }
  }, [rulesPageIndex, rulesTotalPages]);

  const renameTableMutation = useMutation({
    mutationFn: (values: AssetTranslationTableEditorValues) =>
      updateAssetTranslationTable(tableId as number, buildAssetTranslationTableUpdatePayload(values)),
    onSuccess: async (table) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "asset_translation_tables"],
      });

      toast({
        variant: "success",
        title: "Translation table updated",
        description: `${table.unique_identifier || `Table ${table.id}`} was updated.`,
      });

      setRenameDialogOpen(false);
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Translation table update failed",
        description: error instanceof Error ? error.message : "The request failed.",
      });
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: (values: AssetTranslationTableRuleEditorValues) =>
      createAssetTranslationTableRule(
        tableId as number,
        buildAssetTranslationTableRulePayload(values),
      ),
    onSuccess: async (rule) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "asset_translation_tables"],
      });

      toast({
        variant: "success",
        title: "Rule created",
        description: `${rule.markets_time_serie_unique_identifier || `Rule ${rule.id}`} was added.`,
      });

      setRuleEditorState(null);
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Rule creation failed",
        description: error instanceof Error ? error.message : "The request failed.",
      });
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({
      ruleId,
      values,
    }: {
      ruleId: number;
      values: AssetTranslationTableRuleEditorValues;
    }) =>
      updateAssetTranslationTableRule(
        tableId as number,
        ruleId,
        buildAssetTranslationTableRulePayload(values),
      ),
    onSuccess: async (rule) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "asset_translation_tables"],
      });

      toast({
        variant: "success",
        title: "Rule updated",
        description: `${rule.markets_time_serie_unique_identifier || `Rule ${rule.id}`} was updated.`,
      });

      setRuleEditorState(null);
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Rule update failed",
        description: error instanceof Error ? error.message : "The request failed.",
      });
    },
  });

  const selectedTableRow = tableDetailQuery.data
    ? buildTranslationTableListRowFromDetail(tableDetailQuery.data)
    : null;

  function submitRename(values: AssetTranslationTableEditorValues) {
    if (tableId === null) {
      return;
    }

    try {
      renameTableMutation.mutate(values);
    } catch (error) {
      toast({
        variant: "error",
        title: "Translation table update failed",
        description: error instanceof Error ? error.message : "The request failed.",
      });
    }
  }

  function submitRule(values: AssetTranslationTableRuleEditorValues) {
    if (tableId === null || !ruleEditorState) {
      return;
    }

    try {
      if (ruleEditorState.mode === "create") {
        createRuleMutation.mutate(values);
        return;
      }

      if (!ruleEditorState.rule) {
        throw new Error("Rule id is missing.");
      }

      updateRuleMutation.mutate({
        ruleId: ruleEditorState.rule.id,
        values,
      });
    } catch (error) {
      toast({
        variant: "error",
        title: ruleEditorState.mode === "create" ? "Rule creation failed" : "Rule update failed",
        description: error instanceof Error ? error.message : "The request failed.",
      });
    }
  }

  async function handleDeleteTableSuccess() {
    await queryClient.invalidateQueries({
      queryKey: ["main_sequence", "asset_translation_tables"],
    });

    navigate(backPath, { replace: true });
  }

  async function handleDeleteRuleSuccess() {
    await queryClient.invalidateQueries({
      queryKey: ["main_sequence", "asset_translation_tables"],
    });

    setRuleDeleteTarget(null);
  }

  if (tableId === null) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Main Sequence Markets"
          title="Asset Translation Table"
          description="The requested translation table id is invalid."
          actions={
            <Button type="button" variant="outline" onClick={() => navigate(backPath)}>
              <ArrowLeft className="h-4 w-4" />
              Back to translation tables
            </Button>
          }
        />
      </div>
    );
  }

  const tableTitle =
    tableDetailQuery.data?.selected_table.text?.trim() ||
    tableDetailQuery.data?.title?.trim() ||
    `Translation Table ${tableId}`;
  const tableSubtitle =
    tableDetailQuery.data?.selected_table.sub_text?.trim() ||
    `${readTranslationTableDetailString(tableDetailQuery.data ?? null, "rules_number") || "0"} rules`;
  const canEditTable = tableDetailQuery.data?.actions.can_edit ?? false;
  const canDeleteTable = tableDetailQuery.data?.actions.can_delete ?? false;
  const isRuleMutationPending = createRuleMutation.isPending || updateRuleMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title={tableTitle}
        description={tableSubtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(backPath)}>
              <ArrowLeft className="h-4 w-4" />
              Back to translation tables
            </Button>
            {canEditTable ? (
              <Button type="button" variant="outline" onClick={() => setRenameDialogOpen(true)}>
                <PencilLine className="h-4 w-4" />
                Rename
              </Button>
            ) : null}
            {canDeleteTable && selectedTableRow ? (
              <Button type="button" variant="danger" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : null}
          </div>
        }
      />

      {tableDetailQuery.isLoading ? (
        <Card>
          <CardContent className="flex min-h-56 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading translation table
            </div>
          </CardContent>
        </Card>
      ) : null}

      {tableDetailQuery.isError ? (
        <Card>
          <CardContent className="p-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(tableDetailQuery.error)}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {tableDetailQuery.data ? (
        <>
          <Card>
            <CardHeader className="border-b border-border/70">
              <div>
                <CardTitle>Translation table details</CardTitle>
                <CardDescription>
                  These fields come from the `frontend_detail` payload for the selected table.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 pt-6 md:grid-cols-2 xl:grid-cols-3">
              {tableDetailQuery.data.details.map((field) => (
                <div
                  key={field.name}
                  className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-3"
                >
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {field.label}
                  </div>
                  <div className="mt-2 text-sm text-foreground">
                    {renderTranslationTableDetailValue(field)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/70">
              <div className="space-y-4">
                <div>
                  <CardTitle>Rules</CardTitle>
                  <CardDescription>
                    Manage translation rules for this table without leaving the detail page.
                  </CardDescription>
                </div>

                <MainSequenceRegistrySearch
                  accessory={
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="neutral">{`${rulesTotalCount} rules`}</Badge>
                      {canEditTable ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            setRuleEditorState({
                              mode: "create",
                              rule: null,
                            })
                          }
                        >
                          <Plus className="h-4 w-4" />
                          Create rule
                        </Button>
                      ) : null}
                    </div>
                  }
                  value={rulesSearchValue}
                  onChange={(event) => setRulesSearchValue(event.target.value)}
                  placeholder="Search by security type, market sector, time serie, exchange, or column"
                  searchClassName="max-w-xl"
                />
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-6">
              {rulesQuery.isLoading ? (
                <div className="flex min-h-52 items-center justify-center">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading rules
                  </div>
                </div>
              ) : null}

              {rulesQuery.isError ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatMainSequenceError(rulesQuery.error)}
                </div>
              ) : null}

              {!rulesQuery.isLoading && !rulesQuery.isError && rulesRows.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                    <Database className="h-6 w-6" />
                  </div>
                  <div className="mt-4 text-sm font-medium text-foreground">No rules found</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Try a different search or create a rule to populate this table.
                  </p>
                </div>
              ) : null}

              {!rulesQuery.isLoading && !rulesQuery.isError && rulesRows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1320px] border-separate border-spacing-y-2 text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        <th className="px-4 pb-2">Security type</th>
                        <th className="px-4 pb-2">Security market sector</th>
                        <th className="px-4 pb-2">Markets time serie UID</th>
                        <th className="px-4 pb-2">Target exchange</th>
                        <th className="px-4 pb-2">Default column</th>
                        <th className="px-4 pb-2">Creation date</th>
                        <th className="px-4 pb-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rulesRows.map((rule) => (
                        <tr key={rule.id}>
                          <td className={getRegistryTableCellClassName(false, "left")}>
                            {formatTranslationTableValue(rule.security_type)}
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            {formatTranslationTableValue(rule.security_market_sector)}
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            <span className="font-mono text-xs text-foreground">
                              {formatTranslationTableValue(rule.markets_time_serie_unique_identifier)}
                            </span>
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            {formatTranslationTableValue(rule.target_exchange_code)}
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            {formatTranslationTableValue(rule.default_column_name)}
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            {formatTranslationDateTime(rule.creation_date)}
                          </td>
                          <td className={getRegistryTableCellClassName(false, "right")}>
                            <div className="flex justify-end gap-2">
                              {canEditTable ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setRuleEditorState({
                                        mode: "edit",
                                        rule,
                                      })
                                    }
                                  >
                                    <PencilLine className="h-4 w-4" />
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setRuleDeleteTarget(rule)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                  </Button>
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground">Read only</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>

            <MainSequenceRegistryPagination
              count={rulesTotalCount}
              itemLabel="rules"
              pageIndex={rulesPageIndex}
              pageSize={rulesPageSize}
              onPageChange={setRulesPageIndex}
            />
          </Card>

          <AssetTranslationTableEditorDialog
            mode="edit"
            open={renameDialogOpen}
            onClose={() => {
              if (!renameTableMutation.isPending) {
                setRenameDialogOpen(false);
              }
            }}
            onSubmit={submitRename}
            isPending={renameTableMutation.isPending}
            error={renameTableMutation.error}
            initialValues={buildAssetTranslationTableInitialValues(tableDetailQuery.data, selectedTableRow)}
          />

          <AssetTranslationTableRuleEditorDialog
            mode={ruleEditorState?.mode ?? "create"}
            open={ruleEditorState !== null}
            onClose={() => {
              if (!isRuleMutationPending) {
                setRuleEditorState(null);
              }
            }}
            onSubmit={submitRule}
            isPending={isRuleMutationPending}
            error={
              ruleEditorState?.mode === "edit" ? updateRuleMutation.error : createRuleMutation.error
            }
            initialValues={buildAssetTranslationTableRuleInitialValues(ruleEditorState?.rule)}
          />

          <ActionConfirmationDialog
            actionLabel="delete the selected translation table"
            confirmButtonLabel="Delete table"
            confirmWord="DELETE"
            description="This uses the translation-table DELETE endpoint for the current table."
            errorToast={{
              title: "Translation table deletion failed",
              description: (error) =>
                error instanceof Error ? error.message : "The request failed.",
            }}
            objectLabel="translation table"
            objectSummary={
              selectedTableRow ? buildAssetTranslationTableDeleteSummary([selectedTableRow]) : null
            }
            onClose={() => setDeleteDialogOpen(false)}
            onConfirm={() => deleteAssetTranslationTable(tableId)}
            onSuccess={handleDeleteTableSuccess}
            open={deleteDialogOpen}
            successToast={{
              title: "Translation table deleted",
              description: (result) =>
                readDeleteDetail(result, `${tableTitle} was deleted.`),
            }}
            title="Delete translation table"
            tone="danger"
          />

          <ActionConfirmationDialog
            actionLabel="delete the selected translation rule"
            confirmButtonLabel="Delete rule"
            confirmWord="DELETE"
            description="This removes the rule from the current translation table."
            errorToast={{
              title: "Rule deletion failed",
              description: (error) =>
                error instanceof Error ? error.message : "The request failed.",
            }}
            objectLabel="translation rule"
            objectSummary={buildAssetTranslationTableRuleDeleteSummary(ruleDeleteTarget)}
            onClose={() => setRuleDeleteTarget(null)}
            onConfirm={() =>
              deleteAssetTranslationTableRule(tableId, ruleDeleteTarget?.id as number)
            }
            onSuccess={handleDeleteRuleSuccess}
            open={ruleDeleteTarget !== null}
            successToast={{
              title: "Rule removed",
              description: (result) =>
                readDeleteDetail(result, "Rule deleted successfully."),
            }}
            title="Delete translation rule"
            tone="danger"
          />
        </>
      ) : null}
    </div>
  );
}
