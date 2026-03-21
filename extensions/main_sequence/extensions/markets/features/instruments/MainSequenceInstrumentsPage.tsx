import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
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

  return `Dynamic table ${dataNode.id}`;
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
  const [discountNodeId, setDiscountNodeId] = useState("");
  const [fixingsNodeId, setFixingsNodeId] = useState("");
  const [selectedDiscountOption, setSelectedDiscountOption] = useState<PickerOption | null>(null);
  const [selectedFixingsOption, setSelectedFixingsOption] = useState<PickerOption | null>(null);
  const [discountSearchValue, setDiscountSearchValue] = useState("");
  const [fixingsSearchValue, setFixingsSearchValue] = useState("");

  const deferredDiscountSearchValue = useDeferredValue(discountSearchValue.trim());
  const deferredFixingsSearchValue = useDeferredValue(fixingsSearchValue.trim());

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
    setSelectedDiscountOption(findCurrentNodeOption(payload, "discount_curves_storage_node"));
    setSelectedFixingsOption(findCurrentNodeOption(payload, "reference_rates_fixings_storage_node"));
    setDiscountSearchValue("");
    setFixingsSearchValue("");
  }, [configurationQuery.data]);

  const discountOptions = useMemo(() => {
    const currentOptions = (configurationQuery.data?.discount_nodes ?? []).map(toCurrentNodeOption);
    const searchedOptions = (discountNodesQuery.data?.results ?? []).map(toDataNodePickerOption);

    return mergePickerOptions(selectedDiscountOption, currentOptions, searchedOptions);
  }, [configurationQuery.data?.discount_nodes, discountNodesQuery.data?.results, selectedDiscountOption]);

  const fixingsOptions = useMemo(() => {
    const currentOptions = (configurationQuery.data?.fixings_nodes ?? []).map(toCurrentNodeOption);
    const searchedOptions = (fixingsNodesQuery.data?.results ?? []).map(toDataNodePickerOption);

    return mergePickerOptions(selectedFixingsOption, currentOptions, searchedOptions);
  }, [configurationQuery.data?.fixings_nodes, fixingsNodesQuery.data?.results, selectedFixingsOption]);

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

  const saveMutation = useMutation({
    mutationFn: () =>
      updateCurrentInstrumentsConfiguration({
        discountCurvesStorageNode: discountNodeId ? Number(discountNodeId) : null,
        referenceRatesFixingsStorageNode: fixingsNodeId ? Number(fixingsNodeId) : null,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(instrumentsConfigurationQueryKey, result);
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

  function selectDiscountNode(nextValue: string) {
    setDiscountNodeId(nextValue);
    setSelectedDiscountOption(discountOptions.find((option) => option.value === nextValue) ?? null);
  }

  function selectFixingsNode(nextValue: string) {
    setFixingsNodeId(nextValue);
    setSelectedFixingsOption(fixingsOptions.find((option) => option.value === nextValue) ?? null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title="Instruments"
        description="Configure the data nodes used by the instrument settings for discount curves and reference-rate fixings."
        actions={
          <>
            <Badge variant="neutral">
              {configurationQuery.isLoading ? "Loading" : canEdit ? "Editable" : "Read only"}
            </Badge>
            <Button
              type="button"
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={!canEdit || !isDirty || saveMutation.isPending || configurationQuery.isLoading}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
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
                    onChange={selectDiscountNode}
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
                    disabled={!canEdit}
                    loading={deferredDiscountSearchValue.length > 0 && discountNodesQuery.isFetching}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span>Type to search for another data node.</span>
                    {discountNodeId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-auto px-0 py-0 text-sm text-primary hover:bg-transparent"
                        disabled={!canEdit}
                        onClick={() => {
                          setDiscountNodeId("");
                          setSelectedDiscountOption(null);
                        }}
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
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
                    onChange={selectFixingsNode}
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
                    disabled={!canEdit}
                    loading={deferredFixingsSearchValue.length > 0 && fixingsNodesQuery.isFetching}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span>Type to search for another data node.</span>
                    {fixingsNodeId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-auto px-0 py-0 text-sm text-primary hover:bg-transparent"
                        disabled={!canEdit}
                        onClick={() => {
                          setFixingsNodeId("");
                          setSelectedFixingsOption(null);
                        }}
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
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
