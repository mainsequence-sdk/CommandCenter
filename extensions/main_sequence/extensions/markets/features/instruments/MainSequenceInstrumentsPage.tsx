import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  fetchDataNodeDetail,
  fetchCurrentInstrumentsConfiguration,
  formatMainSequenceError,
  listDataNodes,
  updateCurrentInstrumentsConfiguration,
  type DataNodeSummary,
  type InstrumentsConfigurationCurrentResponse,
} from "../../../../common/api";
import { PickerField, type PickerOption } from "../../../../common/components/PickerField";

const instrumentsConfigurationQueryKey = ["main_sequence", "markets", "instruments", "current"];
const dataNodeOptionLimit = 15;

function getDataNodeTitle(dataNode: DataNodeSummary) {
  const identifier = dataNode.identifier?.trim();

  if (identifier) {
    return identifier;
  }

  const storageHash = dataNode.storage_hash?.trim();

  if (storageHash) {
    return storageHash;
  }

  return `Data node ${dataNode.id}`;
}

function getDataSourceLabel(dataNode: DataNodeSummary) {
  if (!dataNode.data_source?.related_resource) {
    return "No data source";
  }

  return (
    dataNode.data_source.related_resource.display_name?.trim() ||
    dataNode.data_source.related_resource.name?.trim() ||
    "No data source"
  );
}

function toDataNodePickerOption(dataNode: DataNodeSummary): PickerOption {
  const label = getDataNodeTitle(dataNode);
  const descriptionParts = [
    dataNode.storage_hash?.trim() && dataNode.storage_hash !== label ? dataNode.storage_hash : null,
    getDataSourceLabel(dataNode),
  ].filter((value): value is string => Boolean(value && value.trim()));

  return {
    value: String(dataNode.id),
    label,
    description: descriptionParts.join(" • ") || undefined,
    keywords: [String(dataNode.id), dataNode.identifier ?? "", dataNode.storage_hash ?? "", getDataSourceLabel(dataNode)],
  };
}

function toCurrentNodeOption(node: { id: number; label: string }): PickerOption {
  return {
    value: String(node.id),
    label: node.label.trim() || `Dynamic table ${node.id}`,
  };
}

function mergePickerOptions(
  selectedOption: PickerOption | null,
  currentOptions: PickerOption[],
  searchedOptions: PickerOption[],
) {
  const optionsByValue = new Map<string, PickerOption>();

  [selectedOption, ...currentOptions, ...searchedOptions].forEach((option) => {
    if (!option) {
      return;
    }

    optionsByValue.set(option.value, option);
  });

  return [...optionsByValue.values()];
}

function findOptionByValue(options: PickerOption[], value: string) {
  return options.find((option) => option.value === value) ?? null;
}

function findCurrentNodeOption(
  payload: InstrumentsConfigurationCurrentResponse,
  key: "discount_curves_storage_node" | "reference_rates_fixings_storage_node",
) {
  const selectedId = payload[key];

  if (!selectedId) {
    return null;
  }

  const optionSource =
    key === "discount_curves_storage_node" ? payload.discount_nodes : payload.fixings_nodes;
  const selectedNode = optionSource.find((node) => node.id === selectedId);

  return selectedNode ? toCurrentNodeOption(selectedNode) : null;
}

export function MainSequenceInstrumentsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [discountNodeId, setDiscountNodeId] = useState("");
  const [fixingsNodeId, setFixingsNodeId] = useState("");
  const [discountSearchValue, setDiscountSearchValue] = useState("");
  const [fixingsSearchValue, setFixingsSearchValue] = useState("");

  const deferredDiscountSearchValue = useDeferredValue(discountSearchValue.trim());
  const deferredFixingsSearchValue = useDeferredValue(fixingsSearchValue.trim());
  const selectedDiscountNodeId = discountNodeId ? Number(discountNodeId) : null;
  const selectedFixingsNodeId = fixingsNodeId ? Number(fixingsNodeId) : null;

  const configurationQuery = useQuery({
    queryKey: instrumentsConfigurationQueryKey,
    queryFn: () => fetchCurrentInstrumentsConfiguration(),
    staleTime: 60_000,
  });

  const discountNodesQuery = useQuery({
    queryKey: [
      "main_sequence",
      "markets",
      "instruments",
      "discount_nodes",
      deferredDiscountSearchValue,
    ],
    queryFn: () =>
      listDataNodes({
        limit: dataNodeOptionLimit,
        light: true,
        offset: 0,
        q: deferredDiscountSearchValue,
      }),
    enabled: deferredDiscountSearchValue.length > 0,
    staleTime: 300_000,
  });

  const fixingsNodesQuery = useQuery({
    queryKey: [
      "main_sequence",
      "markets",
      "instruments",
      "fixings_nodes",
      deferredFixingsSearchValue,
    ],
    queryFn: () =>
      listDataNodes({
        limit: dataNodeOptionLimit,
        light: true,
        offset: 0,
        q: deferredFixingsSearchValue,
      }),
    enabled: deferredFixingsSearchValue.length > 0,
    staleTime: 300_000,
  });

  const selectedDiscountNodeQuery = useQuery({
    queryKey: [
      "main_sequence",
      "markets",
      "instruments",
      "selected_discount_node",
      selectedDiscountNodeId,
    ],
    queryFn: () => fetchDataNodeDetail(selectedDiscountNodeId as number),
    enabled: Number.isInteger(selectedDiscountNodeId) && (selectedDiscountNodeId as number) > 0,
    staleTime: 300_000,
  });

  const selectedFixingsNodeQuery = useQuery({
    queryKey: [
      "main_sequence",
      "markets",
      "instruments",
      "selected_fixings_node",
      selectedFixingsNodeId,
    ],
    queryFn: () => fetchDataNodeDetail(selectedFixingsNodeId as number),
    enabled: Number.isInteger(selectedFixingsNodeId) && (selectedFixingsNodeId as number) > 0,
    staleTime: 300_000,
  });

  useEffect(() => {
    const payload = configurationQuery.data;

    if (!payload) {
      return;
    }

    setDiscountNodeId(
      payload.discount_curves_storage_node ? String(payload.discount_curves_storage_node) : "",
    );
    setFixingsNodeId(
      payload.reference_rates_fixings_storage_node
        ? String(payload.reference_rates_fixings_storage_node)
        : "",
    );
    setIsEditing(false);
    setDiscountSearchValue("");
    setFixingsSearchValue("");
  }, [configurationQuery.data]);

  const currentDiscountOptions = useMemo(
    () => (configurationQuery.data?.discount_nodes ?? []).map(toCurrentNodeOption),
    [configurationQuery.data?.discount_nodes],
  );
  const currentFixingsOptions = useMemo(
    () => (configurationQuery.data?.fixings_nodes ?? []).map(toCurrentNodeOption),
    [configurationQuery.data?.fixings_nodes],
  );
  const searchedDiscountOptions = useMemo(
    () => (discountNodesQuery.data?.results ?? []).map(toDataNodePickerOption),
    [discountNodesQuery.data?.results],
  );
  const searchedFixingsOptions = useMemo(
    () => (fixingsNodesQuery.data?.results ?? []).map(toDataNodePickerOption),
    [fixingsNodesQuery.data?.results],
  );
  const selectedDiscountOption = useMemo(() => {
    if (!discountNodeId) {
      return null;
    }

    const detailedOption = selectedDiscountNodeQuery.data
      ? toDataNodePickerOption(selectedDiscountNodeQuery.data)
      : null;

    return (
      detailedOption ??
      findOptionByValue(searchedDiscountOptions, discountNodeId) ??
      findOptionByValue(currentDiscountOptions, discountNodeId) ??
      (configurationQuery.data
        ? findCurrentNodeOption(configurationQuery.data, "discount_curves_storage_node")
        : null)
    );
  }, [
    configurationQuery.data,
    currentDiscountOptions,
    discountNodeId,
    searchedDiscountOptions,
    selectedDiscountNodeQuery.data,
  ]);
  const selectedFixingsOption = useMemo(() => {
    if (!fixingsNodeId) {
      return null;
    }

    const detailedOption = selectedFixingsNodeQuery.data
      ? toDataNodePickerOption(selectedFixingsNodeQuery.data)
      : null;

    return (
      detailedOption ??
      findOptionByValue(searchedFixingsOptions, fixingsNodeId) ??
      findOptionByValue(currentFixingsOptions, fixingsNodeId) ??
      (configurationQuery.data
        ? findCurrentNodeOption(configurationQuery.data, "reference_rates_fixings_storage_node")
        : null)
    );
  }, [
    configurationQuery.data,
    currentFixingsOptions,
    fixingsNodeId,
    searchedFixingsOptions,
    selectedFixingsNodeQuery.data,
  ]);

  const discountOptions = useMemo(() => {
    return mergePickerOptions(
      selectedDiscountOption,
      currentDiscountOptions,
      searchedDiscountOptions,
    );
  }, [currentDiscountOptions, searchedDiscountOptions, selectedDiscountOption]);

  const fixingsOptions = useMemo(() => {
    return mergePickerOptions(selectedFixingsOption, currentFixingsOptions, searchedFixingsOptions);
  }, [currentFixingsOptions, searchedFixingsOptions, selectedFixingsOption]);

  const configuration = configurationQuery.data;
  const initialDiscountNodeId = configuration?.discount_curves_storage_node
    ? String(configuration.discount_curves_storage_node)
    : "";
  const initialFixingsNodeId = configuration?.reference_rates_fixings_storage_node
    ? String(configuration.reference_rates_fixings_storage_node)
    : "";
  const isDirty =
    discountNodeId !== initialDiscountNodeId || fixingsNodeId !== initialFixingsNodeId;
  const canEdit = Boolean(configuration?.can_edit);
  const fieldsDisabled = !canEdit || !isEditing;

  const saveMutation = useMutation({
    mutationFn: () =>
      updateCurrentInstrumentsConfiguration({
        discountCurvesStorageNode: discountNodeId ? Number(discountNodeId) : null,
        referenceRatesFixingsStorageNode: fixingsNodeId ? Number(fixingsNodeId) : null,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(instrumentsConfigurationQueryKey, result);
      setIsEditing(false);
      toast({
        variant: "success",
        title: "Instrument configuration updated",
        description: "The storage nodes were saved.",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Instrument configuration update failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title="Instruments"
        description="Configure the data nodes used by the instrument settings for discount curves and reference-rate fixings."
        actions={
          <>
            {canEdit && !isEditing ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
                disabled={configurationQuery.isLoading}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            ) : null}
            {canEdit && isEditing ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDiscountNodeId(initialDiscountNodeId);
                    setFixingsNodeId(initialFixingsNodeId);
                    setDiscountSearchValue("");
                    setFixingsSearchValue("");
                    setIsEditing(false);
                  }}
                  disabled={saveMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => saveMutation.mutate()}
                  disabled={!isDirty || saveMutation.isPending || configurationQuery.isLoading}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div>
            <CardTitle>Instrument configuration</CardTitle>
            <CardDescription>
              Pick the data nodes used for curves and fixings, then save the changes.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          {configurationQuery.isLoading ? (
            <div className="flex min-h-56 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading instrument configuration
              </div>
            </div>
          ) : null}

          {configurationQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(configurationQuery.error)}
            </div>
          ) : null}

          {!configurationQuery.isLoading && !configurationQuery.isError && configuration ? (
            <>
              {!canEdit ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/25 px-4 py-3 text-sm text-muted-foreground">
                  You can review the current node assignments here, but only organization admins can change them.
                </div>
              ) : null}

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Discount curves storage node
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Select the data node used to store discount curves.
                    </p>
                  </div>
                  <PickerField
                    value={discountNodeId}
                    onChange={setDiscountNodeId}
                    options={discountOptions}
                    placeholder="Select a data node"
                    searchPlaceholder="Search data nodes"
                    emptyMessage={
                      deferredDiscountSearchValue.length > 0
                        ? "No matching data nodes."
                        : "Type to search data nodes."
                    }
                    searchable
                    searchValue={discountSearchValue}
                    onSearchValueChange={setDiscountSearchValue}
                    disabled={fieldsDisabled}
                    loading={
                      selectedDiscountNodeQuery.isFetching ||
                      (deferredDiscountSearchValue.length > 0 && discountNodesQuery.isFetching)
                    }
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span>Type to search for another data node.</span>
                    {discountNodeId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-auto px-0 py-0 text-sm text-primary hover:bg-transparent"
                        disabled={fieldsDisabled}
                        onClick={() => {
                          setDiscountNodeId("");
                          setDiscountSearchValue("");
                        }}
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
                  {selectedDiscountNodeQuery.isError ? (
                    <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                      {formatMainSequenceError(selectedDiscountNodeQuery.error)}
                    </div>
                  ) : null}
                  {discountNodesQuery.isError ? (
                    <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                      {formatMainSequenceError(discountNodesQuery.error)}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Reference rates fixings storage node
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Select the data node used to store reference-rate fixings.
                    </p>
                  </div>
                  <PickerField
                    value={fixingsNodeId}
                    onChange={setFixingsNodeId}
                    options={fixingsOptions}
                    placeholder="Select a data node"
                    searchPlaceholder="Search data nodes"
                    emptyMessage={
                      deferredFixingsSearchValue.length > 0
                        ? "No matching data nodes."
                        : "Type to search data nodes."
                    }
                    searchable
                    searchValue={fixingsSearchValue}
                    onSearchValueChange={setFixingsSearchValue}
                    disabled={fieldsDisabled}
                    loading={
                      selectedFixingsNodeQuery.isFetching ||
                      (deferredFixingsSearchValue.length > 0 && fixingsNodesQuery.isFetching)
                    }
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span>Type to search for another data node.</span>
                    {fixingsNodeId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-auto px-0 py-0 text-sm text-primary hover:bg-transparent"
                        disabled={fieldsDisabled}
                        onClick={() => {
                          setFixingsNodeId("");
                          setFixingsSearchValue("");
                        }}
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
                  {selectedFixingsNodeQuery.isError ? (
                    <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                      {formatMainSequenceError(selectedFixingsNodeQuery.error)}
                    </div>
                  ) : null}
                  {fixingsNodesQuery.isError ? (
                    <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                      {formatMainSequenceError(fixingsNodesQuery.error)}
                    </div>
                  ) : null}
                </div>
              </div>

              {saveMutation.isError ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatMainSequenceError(saveMutation.error)}
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
