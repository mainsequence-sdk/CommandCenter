import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Hash, Loader2, Package, Plus, Trash2 } from "lucide-react";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toaster";

import {
  bulkDeleteProjectImages,
  createProjectImage,
  fetchProjectImageCommitHashes,
  formatMainSequenceError,
  listProjectImages,
  mainSequenceRegistryPageSize,
  type ProjectImageCommitHashOption,
  type ProjectImageOption,
} from "../../../../common/api";
import { PickerField } from "../../../../common/components/PickerField";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { MainSequenceSelectionCheckbox } from "../../../../common/components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import { useRegistrySelection } from "../../../../common/hooks/useRegistrySelection";

function truncateMiddle(value: string, maxLength = 28) {
  if (value.length <= maxLength) {
    return value;
  }

  const head = value.slice(0, Math.ceil(maxLength / 2) - 1);
  const tail = value.slice(-Math.floor(maxLength / 2) + 2);
  return `${head}...${tail}`;
}

function formatProjectImageLabel(image: ProjectImageOption) {
  return image.project_repo_hash?.trim() ? truncateMiddle(image.project_repo_hash) : "Latest";
}

function formatProjectImageStatus(image: ProjectImageOption) {
  return image.is_ready ? "Ready" : "Building";
}

function hasBuildingImages(images: ProjectImageOption[] | undefined) {
  return (images ?? []).some((image) => !image.is_ready);
}

function toCommitHashPickerOption(commit: ProjectImageCommitHashOption) {
  return {
    value: commit.value,
    label: commit.label,
    description: commit.is_dynamic
      ? "Uses the latest project state."
      : commit.created_display
        ? `Created ${commit.created_display}`
        : undefined,
    keywords: [
      commit.commit_hash ?? "",
      commit.short_hash,
      commit.created_display,
      commit.has_image ? "image" : "",
      commit.is_dynamic ? "dynamic latest" : "",
    ],
  };
}

export function MainSequenceProjectImagesTab({
  projectId,
}: {
  projectId: number;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filterValue, setFilterValue] = useState("");
  const [imagesPageIndex, setImagesPageIndex] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedCommitHash, setSelectedCommitHash] = useState("");
  const [imagesPendingDelete, setImagesPendingDelete] = useState<ProjectImageOption[]>([]);
  const deferredFilterValue = useDeferredValue(filterValue);

  const imagesQuery = useQuery({
    queryKey: ["main_sequence", "projects", "images", projectId, imagesPageIndex],
    queryFn: () =>
      listProjectImages(projectId, {
        limit: mainSequenceRegistryPageSize,
        offset: imagesPageIndex * mainSequenceRegistryPageSize,
      }),
    enabled: projectId > 0,
    refetchInterval: (query) =>
      hasBuildingImages(query.state.data?.results) ? 60_000 : false,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    setImagesPageIndex(0);
  }, [deferredFilterValue]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil((imagesQuery.data?.count ?? 0) / mainSequenceRegistryPageSize),
    );

    if (imagesPageIndex > totalPages - 1) {
      setImagesPageIndex(totalPages - 1);
    }
  }, [imagesPageIndex, imagesQuery.data?.count]);

  const filteredImages = useMemo(() => {
    const needle = deferredFilterValue.trim().toLowerCase();

    return (imagesQuery.data?.results ?? []).filter((image) => {
      if (!needle) {
        return true;
      }

      return [
        String(image.id),
        image.project_repo_hash ?? "",
        image.base_image?.title ?? "",
        image.base_image?.description ?? "",
        formatProjectImageStatus(image),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [deferredFilterValue, imagesQuery.data?.results]);

  const imageSelection = useRegistrySelection(filteredImages);
  const commitHashesQuery = useQuery({
    queryKey: ["main_sequence", "projects", "images", "commit-hashes", projectId],
    queryFn: () => fetchProjectImageCommitHashes(projectId),
    enabled: createDialogOpen && projectId > 0,
    staleTime: 300_000,
  });

  const commitHashOptions = useMemo(
    () =>
      (commitHashesQuery.data?.commits ?? [])
        .filter((commit) => !commit.is_dynamic)
        .map(toCommitHashPickerOption),
    [commitHashesQuery.data?.commits],
  );

  useEffect(() => {
    if (!createDialogOpen) {
      return;
    }

    setSelectedCommitHash("");
  }, [createDialogOpen]);

  useEffect(() => {
    if (!createDialogOpen || commitHashOptions.length === 0) {
      return;
    }

    if (!commitHashOptions.some((option) => option.value === selectedCommitHash)) {
      setSelectedCommitHash(commitHashOptions[0]?.value ?? "");
    }
  }, [commitHashOptions, createDialogOpen, selectedCommitHash]);

  const createImageMutation = useMutation({
    mutationFn: createProjectImage,
    onSuccess: async (image) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "images", projectId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "job-images", projectId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "summary", projectId],
      });

      toast({
        variant: "success",
        title: "Image creation started",
        description: `${formatProjectImageLabel(image)} was queued for this project.`,
      });

      setCreateDialogOpen(false);
      setSelectedCommitHash("");
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Image creation failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: async (images: ProjectImageOption[]) =>
      bulkDeleteProjectImages(images.map((image) => image.id)),
    onSuccess: async (result, images) => {
      const deletedCount = result.deleted_count ?? images.length;
      setImagesPendingDelete([]);
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "images", projectId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "job-images", projectId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "summary", projectId],
      });

      if (deletedCount > 0) {
        toast({
          variant: "success",
          title: deletedCount === 1 ? "Image deleted" : "Images deleted",
          description:
            deletedCount === 1 ? "The selected image was deleted." : `${deletedCount} images were deleted.`,
        });
      }

      imageSelection.clearSelection();
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Image deletion failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const imageBulkActions =
    imageSelection.selectedCount > 0
      ? [
          {
            id: "delete-images",
            label:
              imageSelection.selectedCount === 1
                ? "Delete selected image"
                : "Delete selected images",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () => {
              deleteImageMutation.reset();
              setImagesPendingDelete(imageSelection.selectedItems);
            },
          },
        ]
      : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-medium text-foreground">Project images</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse built images for this project and queue new image builds.
          </p>
        </div>
        <MainSequenceRegistrySearch
          actionMenuLabel="Image actions"
          accessory={
            <>
              <Badge variant="neutral">{`${imagesQuery.data?.count ?? 0} images`}</Badge>
              <Button
                size="sm"
                onClick={() => {
                  createImageMutation.reset();
                  setSelectedCommitHash("");
                  setCreateDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Create image
              </Button>
            </>
          }
          bulkActions={imageBulkActions}
          clearSelectionLabel="Clear images"
          onClearSelection={imageSelection.clearSelection}
          renderSelectionSummary={(selectionCount) => `${selectionCount} images selected`}
          value={filterValue}
          onChange={(event) => setFilterValue(event.target.value)}
          placeholder="Filter by id, repo hash, base image, or status"
          searchClassName="max-w-lg"
          selectionCount={imageSelection.selectedCount}
        />
      </div>

      {imagesQuery.isLoading ? (
        <div className="flex min-h-64 items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading images
          </div>
        </div>
      ) : null}

      {imagesQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(imagesQuery.error)}
        </div>
      ) : null}

      {!imagesQuery.isLoading && !imagesQuery.isError && filteredImages.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
            <Package className="h-6 w-6" />
          </div>
          <div className="mt-4 text-sm font-medium text-foreground">No images found</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Create an image or clear the current filter.
          </p>
        </div>
      ) : null}

      {!imagesQuery.isLoading && !imagesQuery.isError && filteredImages.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="w-12 px-3 pb-2">
                  <MainSequenceSelectionCheckbox
                    ariaLabel="Select all visible images"
                    checked={imageSelection.allSelected}
                    indeterminate={imageSelection.someSelected}
                    onChange={imageSelection.toggleAll}
                  />
                </th>
                <th className="px-4 pb-2">Image</th>
                <th className="px-4 pb-2">Repo hash</th>
                <th className="px-4 pb-2">Base image</th>
                <th className="px-4 pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredImages.map((image) => {
                const selected = imageSelection.isSelected(image.id);

                return (
                  <tr key={image.id}>
                    <td className={getRegistryTableCellClassName(selected, "left")}>
                      <MainSequenceSelectionCheckbox
                        ariaLabel={`Select image ${image.id}`}
                        checked={selected}
                        onChange={() => imageSelection.toggleSelection(image.id)}
                      />
                    </td>
                    <td className={getRegistryTableCellClassName(selected)}>
                      <div className="flex items-start gap-2">
                        <Package className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium text-foreground">{`Image ${image.id}`}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Project ID {image.related_project}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={getRegistryTableCellClassName(selected)}>
                      <div className="flex items-start gap-2">
                        <Hash className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <div>
                          <div
                            className="font-mono text-xs text-foreground"
                            title={image.project_repo_hash ?? "Latest"}
                          >
                            {formatProjectImageLabel(image)}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {image.project_repo_hash ? "Pinned commit" : "Latest project image"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={getRegistryTableCellClassName(selected)}>
                      <div className="text-foreground">{image.base_image?.title ?? "Default"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {image.base_image?.description ?? "Project default base image"}
                      </div>
                    </td>
                    <td className={getRegistryTableCellClassName(selected, "right")}>
                      {image.is_ready ? (
                        <Badge variant="success">{formatProjectImageStatus(image)}</Badge>
                      ) : (
                        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/35 px-3 py-1 text-xs font-medium text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Building</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {!imagesQuery.isLoading && !imagesQuery.isError && (imagesQuery.data?.count ?? 0) > 0 ? (
        <MainSequenceRegistryPagination
          count={imagesQuery.data?.count ?? 0}
          itemLabel="images"
          pageIndex={imagesPageIndex}
          pageSize={mainSequenceRegistryPageSize}
          onPageChange={setImagesPageIndex}
        />
      ) : null}

      <Dialog
        title="Create image"
        open={createDialogOpen}
        onClose={() => {
          if (!createImageMutation.isPending) {
            setCreateDialogOpen(false);
          }
        }}
        className="max-w-[min(760px,calc(100vw-24px))] overflow-visible"
        contentClassName="overflow-visible px-5 py-5 md:px-6 md:py-6"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Commit hash
            </div>
            <PickerField
              value={selectedCommitHash}
              onChange={setSelectedCommitHash}
              options={commitHashOptions}
              placeholder="Select a commit hash"
              searchPlaceholder="Search commit hashes"
              emptyMessage="No pinned commits available."
              loading={commitHashesQuery.isLoading}
            />
          </div>

          {commitHashesQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(commitHashesQuery.error)}
            </div>
          ) : null}

          {createImageMutation.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(createImageMutation.error)}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={createImageMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                createImageMutation.mutate({
                  related_project_id: projectId,
                  project_repo_hash: selectedCommitHash,
                })
              }
              disabled={
                createImageMutation.isPending ||
                commitHashesQuery.isLoading ||
                commitHashesQuery.isError ||
                commitHashOptions.length === 0 ||
                !commitHashOptions.some((option) => option.value === selectedCommitHash)
              }
            >
              {createImageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create image
            </Button>
          </div>
        </div>
      </Dialog>

      <ActionConfirmationDialog
        title={imagesPendingDelete.length > 1 ? "Delete images" : "Delete image"}
        open={imagesPendingDelete.length > 0}
        onClose={() => {
          if (!deleteImageMutation.isPending) {
            setImagesPendingDelete([]);
          }
        }}
        tone="danger"
        actionLabel="delete"
        objectLabel={imagesPendingDelete.length > 1 ? "images" : "image"}
        confirmWord={imagesPendingDelete.length > 1 ? "DELETE IMAGES" : "DELETE IMAGE"}
        confirmButtonLabel={imagesPendingDelete.length > 1 ? "Delete images" : "Delete image"}
        description="This action removes the selected images."
        specialText="This action cannot be undone."
        objectSummary={
          imagesPendingDelete.length === 1 ? (
            <>
              <div className="font-medium">{`Image ${imagesPendingDelete[0]?.id}`}</div>
              <div className="mt-1 text-muted-foreground">
                {imagesPendingDelete[0] ? formatProjectImageLabel(imagesPendingDelete[0]) : null}
              </div>
            </>
          ) : (
            <>
              <div className="font-medium">{imagesPendingDelete.length} images selected</div>
              <div className="mt-1 text-muted-foreground">
                {imagesPendingDelete
                  .slice(0, 3)
                  .map((image) => `Image ${image.id}`)
                  .join(", ")}
                {imagesPendingDelete.length > 3 ? ", ..." : ""}
              </div>
            </>
          )
        }
        error={
          deleteImageMutation.isError ? formatMainSequenceError(deleteImageMutation.error) : undefined
        }
        isPending={deleteImageMutation.isPending}
        onConfirm={() => {
          if (imagesPendingDelete.length === 0) {
            return;
          }

          return deleteImageMutation.mutateAsync(imagesPendingDelete);
        }}
      />
    </div>
  );
}
