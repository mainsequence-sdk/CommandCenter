import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Braces,
  FileJson,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";

import {
  createConstant,
  deleteConstant,
  fetchConstant,
  formatMainSequenceError,
  listConstants,
  mainSequenceRegistryPageSize,
  type ConstantRecord,
} from "../../../../common/api";
import { MainSequencePermissionsTab } from "../../../../common/components/MainSequencePermissionsTab";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { MainSequenceSelectionCheckbox } from "../../../../common/components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import { useRegistrySelection } from "../../../../common/hooks/useRegistrySelection";

const mainSequenceConstantIdParam = "msConstantId";
type ConstantDetailTabId = "overview" | "permissions";
const constantDetailTabs = [
  { id: "overview", label: "Overview" },
  { id: "permissions", label: "Permissions" },
] as const;

function formatConstantCategory(constant: ConstantRecord) {
  return constant.category?.trim() || "Uncategorized";
}

function formatConstantValuePreview(value: unknown, maxLength = 84) {
  const rawValue =
    typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? String(value ?? "");

  if (rawValue.length <= maxLength) {
    return rawValue;
  }

  return `${rawValue.slice(0, maxLength - 3)}...`;
}

function formatConstantValueDetail(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function parseConstantInputValue(rawValue: string) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return "";
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return rawValue;
  }
}

export function MainSequenceConstantsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [filterValue, setFilterValue] = useState("");
  const [constantsPageIndex, setConstantsPageIndex] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [constantName, setConstantName] = useState("");
  const [constantValue, setConstantValue] = useState("");
  const [constantsPendingDelete, setConstantsPendingDelete] = useState<ConstantRecord[]>([]);
  const [selectedDetailTabId, setSelectedDetailTabId] = useState<ConstantDetailTabId>("overview");
  const deferredFilterValue = useDeferredValue(filterValue);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedConstantId = Number(searchParams.get(mainSequenceConstantIdParam) ?? "");
  const isConstantDetailOpen = Number.isFinite(selectedConstantId) && selectedConstantId > 0;

  const constantsQuery = useQuery({
    queryKey: ["main_sequence", "constants", "list", constantsPageIndex],
    queryFn: () =>
      listConstants({
        limit: mainSequenceRegistryPageSize,
        offset: constantsPageIndex * mainSequenceRegistryPageSize,
      }),
  });

  const constantDetailQuery = useQuery({
    queryKey: ["main_sequence", "constants", "detail", selectedConstantId],
    queryFn: () => fetchConstant(selectedConstantId),
    enabled: isConstantDetailOpen,
  });

  useEffect(() => {
    setConstantsPageIndex(0);
  }, [deferredFilterValue]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil((constantsQuery.data?.count ?? 0) / mainSequenceRegistryPageSize),
    );

    if (constantsPageIndex > totalPages - 1) {
      setConstantsPageIndex(totalPages - 1);
    }
  }, [constantsPageIndex, constantsQuery.data?.count]);

  const filteredConstants = useMemo(() => {
    const needle = deferredFilterValue.trim().toLowerCase();

    return (constantsQuery.data?.results ?? []).filter((constant) => {
      if (!needle) {
        return true;
      }

      return [
        String(constant.id),
        constant.name,
        constant.category ?? "",
        formatConstantValuePreview(constant.value, 160),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [constantsQuery.data?.results, deferredFilterValue]);

  const constantSelection = useRegistrySelection(filteredConstants);
  const selectedConstantFromList = useMemo(
    () => filteredConstants.find((constant) => constant.id === selectedConstantId) ?? null,
    [filteredConstants, selectedConstantId],
  );
  const selectedConstant = constantDetailQuery.data ?? selectedConstantFromList;
  const constantTitle =
    selectedConstant?.name ??
    (isConstantDetailOpen ? `Constant ${selectedConstantId}` : "Constant");

  useEffect(() => {
    setSelectedDetailTabId("overview");
  }, [selectedConstantId]);

  const createConstantMutation = useMutation({
    mutationFn: createConstant,
    onSuccess: async (constant) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "constants"],
      });

      toast({
        variant: "success",
        title: "Constant created",
        description: `${constant.name} is now available.`,
      });

      setCreateDialogOpen(false);
      setConstantName("");
      setConstantValue("");
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Constant creation failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const deleteConstantMutation = useMutation({
    mutationFn: async (constants: ConstantRecord[]) =>
      Promise.allSettled(constants.map((constant) => deleteConstant(constant.id))),
    onSuccess: async (results, constants) => {
      const failedConstants = constants.filter((_, index) => results[index]?.status === "rejected");
      const deletedCount = constants.length - failedConstants.length;

      setConstantsPendingDelete([]);
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "constants"],
      });

      if (failedConstants.length > 0) {
        toast({
          variant: "error",
          title:
            failedConstants.length === constants.length
              ? "Constant deletion failed"
              : "Some constants could not be deleted",
          description:
            failedConstants.length === constants.length
              ? "No selected constants were deleted."
              : `${failedConstants.length} of ${constants.length} selected constants could not be deleted.`,
        });
      }

      if (deletedCount > 0) {
        toast({
          variant: "success",
          title: deletedCount === 1 ? "Constant deleted" : "Constants deleted",
          description:
            deletedCount === 1
              ? `${constants.find((constant) => !failedConstants.some((failed) => failed.id === constant.id))?.name ?? "Constant"} was deleted.`
              : `${deletedCount} constants were deleted.`,
        });
      }

      constantSelection.setSelection(failedConstants.map((constant) => constant.id));
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Constant deletion failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const constantBulkActions =
    constantSelection.selectedCount > 0
      ? [
          {
            id: "delete-constants",
            label:
              constantSelection.selectedCount === 1
                ? "Delete selected constant"
                : "Delete selected constants",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () => {
              deleteConstantMutation.reset();
              setConstantsPendingDelete(constantSelection.selectedItems);
            },
          },
        ]
      : [];

  function updateSearchParams(update: (nextParams: URLSearchParams) => void) {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);
    const nextSearch = nextParams.toString();

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: false },
    );
  }

  function openConstantDetail(constantId: number) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceConstantIdParam, String(constantId));
    });
  }

  function closeConstantDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequenceConstantIdParam);
    });
  }

  if (isConstantDetailOpen) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button
              type="button"
              className="transition-colors hover:text-foreground"
              onClick={closeConstantDetail}
            >
              Constants
            </button>
            <span>/</span>
            <span className="text-foreground">{constantTitle}</span>
          </div>
          <Button variant="outline" size="sm" onClick={closeConstantDetail}>
            <ArrowLeft className="h-4 w-4" />
            Back to constants
          </Button>
        </div>

        {constantDetailQuery.isLoading && !selectedConstant ? (
          <Card>
            <CardContent className="flex min-h-48 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading constant details
              </div>
            </CardContent>
          </Card>
        ) : null}

        {constantDetailQuery.isError ? (
          <Card>
            <CardContent className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(constantDetailQuery.error)}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {selectedConstant ? (
          <Card>
            <CardHeader className="border-b border-border/70">
              <div className="flex flex-wrap items-center gap-2">
                {constantDetailTabs.map((tab) => {
                  const active = tab.id === selectedDetailTabId;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={
                        active
                          ? "rounded-full border border-primary/40 bg-primary/12 px-3 py-1.5 text-xs font-medium text-primary"
                          : "rounded-full border border-border/70 bg-background/35 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                      }
                      onClick={() => setSelectedDetailTabId(tab.id)}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent className="p-5">
              {selectedDetailTabId === "overview" ? (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Name
                    </div>
                    <div className="text-base font-medium text-foreground">{selectedConstant.name}</div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      <Braces className="h-3.5 w-3.5" />
                      Value
                    </div>
                    <pre className="overflow-x-auto rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-4 text-sm text-foreground">
                      {formatConstantValueDetail(selectedConstant.value)}
                    </pre>
                  </div>
                </div>
              ) : (
                <MainSequencePermissionsTab
                  objectUrl="constant"
                  objectId={selectedConstant.id}
                  entityLabel="Constant"
                  enabled={selectedDetailTabId === "permissions"}
                />
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence"
        title="Constants Search"
        description="Search and manage application constants."
        actions={<Badge variant="neutral">{`${constantsQuery.data?.count ?? 0} constants`}</Badge>}
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>Constants registry</CardTitle>
              <CardDescription>
                Search across constant names, categories, and values.
              </CardDescription>
            </div>
            <MainSequenceRegistrySearch
              actionMenuLabel="Constant actions"
              accessory={
                <Button
                  size="sm"
                  onClick={() => {
                    createConstantMutation.reset();
                    setConstantName("");
                    setConstantValue("");
                    setCreateDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Create constant
                </Button>
              }
              bulkActions={constantBulkActions}
              clearSelectionLabel="Clear constants"
              onClearSelection={constantSelection.clearSelection}
              renderSelectionSummary={(selectionCount) => `${selectionCount} constants selected`}
              value={filterValue}
              onChange={(event) => setFilterValue(event.target.value)}
              placeholder="Filter by name, category, or value"
              searchClassName="max-w-lg"
              selectionCount={constantSelection.selectedCount}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {constantsQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading constants
              </div>
            </div>
          ) : null}

          {constantsQuery.isError ? (
            <div className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(constantsQuery.error)}
              </div>
            </div>
          ) : null}

          {!constantsQuery.isLoading && !constantsQuery.isError && filteredConstants.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <FileJson className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No constants found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Create a constant or clear the current filter.
              </p>
            </div>
          ) : null}

          {!constantsQuery.isLoading && !constantsQuery.isError && filteredConstants.length > 0 ? (
            <div className="overflow-x-auto px-4 py-4">
              <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="w-12 px-3 pb-2">
                      <MainSequenceSelectionCheckbox
                        ariaLabel="Select all visible constants"
                        checked={constantSelection.allSelected}
                        indeterminate={constantSelection.someSelected}
                        onChange={constantSelection.toggleAll}
                      />
                    </th>
                    <th className="px-4 pb-2">Name</th>
                    <th className="px-4 pb-2">Category</th>
                    <th className="px-4 pb-2">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConstants.map((constant) => {
                    const selected = constantSelection.isSelected(constant.id);

                    return (
                      <tr key={constant.id}>
                        <td className={getRegistryTableCellClassName(selected, "left")}>
                          <MainSequenceSelectionCheckbox
                            ariaLabel={`Select ${constant.name}`}
                            checked={selected}
                            onChange={() => constantSelection.toggleSelection(constant.id)}
                          />
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <button
                            type="button"
                            className="group inline-flex items-center gap-1.5 rounded-sm text-left font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
                            onClick={() => openConstantDetail(constant.id)}
                          >
                            <span>{constant.name}</span>
                            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                          </button>
                          <div className="mt-1 text-xs text-muted-foreground">{`Constant ID ${constant.id}`}</div>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <Badge variant={constant.category ? "primary" : "neutral"}>
                            {formatConstantCategory(constant)}
                          </Badge>
                        </td>
                        <td className={getRegistryTableCellClassName(selected, "right")}>
                          <div className="max-w-[420px] whitespace-pre-wrap break-words font-mono text-xs text-foreground">
                            {formatConstantValuePreview(constant.value)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {!constantsQuery.isLoading &&
          !constantsQuery.isError &&
          (constantsQuery.data?.count ?? 0) > 0 ? (
            <MainSequenceRegistryPagination
              count={constantsQuery.data?.count ?? 0}
              itemLabel="constants"
              pageIndex={constantsPageIndex}
              pageSize={mainSequenceRegistryPageSize}
              onPageChange={setConstantsPageIndex}
            />
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        title="Create constant"
        open={createDialogOpen}
        onClose={() => {
          if (!createConstantMutation.isPending) {
            setCreateDialogOpen(false);
          }
        }}
        className="max-w-[min(720px,calc(100vw-24px))]"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Name
            </label>
            <Input
              autoFocus
              value={constantName}
              onChange={(event) => setConstantName(event.target.value)}
              placeholder="CONSTANT__NAME"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Value
            </label>
            <Textarea
              value={constantValue}
              onChange={(event) => setConstantValue(event.target.value)}
              placeholder='{"enabled": true}'
              className="min-h-52 font-mono text-xs"
            />
            <div className="text-xs text-muted-foreground">
              JSON values are parsed automatically. Plain text is stored as a string.
            </div>
          </div>

          {createConstantMutation.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(createConstantMutation.error)}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateDialogOpen(false)}
              disabled={createConstantMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!constantName.trim()) {
                  toast({
                    variant: "error",
                    title: "Constant creation failed",
                    description: "Name is required.",
                  });
                  return;
                }

                createConstantMutation.mutate({
                  name: constantName.trim(),
                  value: parseConstantInputValue(constantValue),
                });
              }}
              disabled={createConstantMutation.isPending || !constantName.trim()}
            >
              {createConstantMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create constant
            </Button>
          </div>
        </div>
      </Dialog>

      <ActionConfirmationDialog
        title={
          constantsPendingDelete.length > 1 ? "Delete constants" : "Delete constant"
        }
        open={constantsPendingDelete.length > 0}
        onClose={() => {
          if (!deleteConstantMutation.isPending) {
            setConstantsPendingDelete([]);
          }
        }}
        tone="danger"
        actionLabel="delete"
        objectLabel={constantsPendingDelete.length > 1 ? "constants" : "constant"}
        confirmWord={
          constantsPendingDelete.length > 1 ? "DELETE CONSTANTS" : "DELETE CONSTANT"
        }
        confirmButtonLabel={
          constantsPendingDelete.length > 1 ? "Delete constants" : "Delete constant"
        }
        description="This action removes the selected constants."
        specialText="This action cannot be undone."
        objectSummary={
          constantsPendingDelete.length === 1 ? (
            <>
              <div className="font-medium">{constantsPendingDelete[0]?.name}</div>
              <div className="mt-1 text-muted-foreground">
                {constantsPendingDelete[0]
                  ? `Constant ID ${constantsPendingDelete[0].id}`
                  : null}
              </div>
            </>
          ) : (
            <>
              <div className="font-medium">
                {constantsPendingDelete.length} constants selected
              </div>
              <div className="mt-1 text-muted-foreground">
                {constantsPendingDelete
                  .slice(0, 3)
                  .map((constant) => constant.name)
                  .join(", ")}
                {constantsPendingDelete.length > 3 ? ", ..." : ""}
              </div>
            </>
          )
        }
        error={
          deleteConstantMutation.isError
            ? formatMainSequenceError(deleteConstantMutation.error)
            : undefined
        }
        isPending={deleteConstantMutation.isPending}
        onConfirm={() => {
          if (constantsPendingDelete.length === 0) {
            return;
          }

          return deleteConstantMutation.mutateAsync(constantsPendingDelete);
        }}
      />
    </div>
  );
}
