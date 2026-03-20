import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FolderPlus, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ObjectStorageBrowser } from "@/components/ui/object-storage-browser";
import { useToast } from "@/components/ui/toaster";

import {
  createBucketFolder,
  fetchBucketBrowse,
  fetchBucketSummary,
  formatMainSequenceError,
  uploadBucketArtifact,
  type BucketBrowseResponse,
  type BucketRecord,
  type BucketSummaryHeader,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";

export type BucketBrowserSort = "name" | "created_by_pod" | "creation_date" | "resource" | "size";

export interface BucketBrowserState {
  prefix: string;
  search: string;
  sort: BucketBrowserSort;
  dir: "asc" | "desc";
  page: number;
}

function buildFallbackBucketSummary(bucket: BucketRecord): BucketSummaryHeader {
  return {
    entity: {
      id: bucket.id,
      type: "bucket",
      title: bucket.name,
    },
    badges: [
      {
        key: "state",
        label: "Bucket",
        tone: "neutral",
      },
    ],
    inline_fields: [],
    highlight_fields: [
      {
        key: "name",
        label: "Bucket name",
        value: bucket.name,
        kind: "text",
      },
    ],
    stats: [],
  };
}

export function MainSequenceBucketDetail({
  browserState,
  bucketId,
  initialBucket,
  onBack,
  onUpdateBrowserState,
}: {
  browserState: BucketBrowserState;
  bucketId: number;
  initialBucket: BucketRecord | null;
  onBack: () => void;
  onUpdateBrowserState: (nextState: BucketBrowserState) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFilename, setUploadFilename] = useState("");

  const bucketSummaryQuery = useQuery({
    queryKey: ["main_sequence", "buckets", "summary", bucketId],
    queryFn: () => fetchBucketSummary(bucketId),
    enabled: bucketId > 0,
  });

  const bucketBrowseQuery = useQuery({
    queryKey: [
      "main_sequence",
      "buckets",
      "browse",
      bucketId,
      browserState.prefix,
      browserState.search,
      browserState.sort,
      browserState.dir,
      browserState.page,
    ],
    queryFn: () => fetchBucketBrowse(bucketId, browserState),
    enabled: bucketId > 0,
  });

  useEffect(() => {
    if (uploadFile) {
      setUploadFilename(uploadFile.name);
    }
  }, [uploadFile]);

  const createFolderMutation = useMutation({
    mutationFn: (name: string) =>
      createBucketFolder(bucketId, {
        prefix: browserState.prefix,
        name,
      }),
    onSuccess: async (response) => {
      toast({
        variant: "success",
        title: "Folder created",
        description: response.detail,
      });

      setCreateFolderDialogOpen(false);
      setFolderName("");
      onUpdateBrowserState({
        prefix: response.prefix,
        search: "",
        sort: "name",
        dir: "asc",
        page: 1,
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "buckets", "browse", bucketId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "buckets", "summary", bucketId],
        }),
      ]);
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Folder creation failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const uploadArtifactMutation = useMutation({
    mutationFn: () => {
      if (!uploadFile) {
        throw new Error("A file is required.");
      }

      return uploadBucketArtifact(bucketId, {
        file: uploadFile,
        prefix: browserState.prefix,
        filename: uploadFilename.trim() || uploadFile.name,
      });
    },
    onSuccess: async () => {
      toast({
        variant: "success",
        title: "Artifact uploaded",
        description: "The file was uploaded to the current bucket folder.",
      });

      setUploadDialogOpen(false);
      setUploadFile(null);
      setUploadFilename("");

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "buckets", "browse", bucketId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "buckets", "summary", bucketId],
        }),
      ]);
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Artifact upload failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const summary =
    bucketSummaryQuery.data ?? (initialBucket ? buildFallbackBucketSummary(initialBucket) : null);
  const bucketTitle =
    summary?.entity.title ??
    bucketBrowseQuery.data?.bucket_name ??
    initialBucket?.name ??
    `Bucket ${bucketId}`;
  const browsePayload = bucketBrowseQuery.data;

  const browserActions = useMemo(
    () => (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            createFolderMutation.reset();
            setFolderName("");
            setCreateFolderDialogOpen(true);
          }}
        >
          <FolderPlus className="h-4 w-4" />
          Create folder
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            uploadArtifactMutation.reset();
            setUploadFile(null);
            setUploadFilename("");
            setUploadDialogOpen(true);
          }}
        >
          <Upload className="h-4 w-4" />
          Upload file
        </Button>
      </>
    ),
    [createFolderMutation, uploadArtifactMutation],
  );

  function openPrefix(prefix: string) {
    onUpdateBrowserState({
      prefix,
      search: "",
      sort: "name",
      dir: "asc",
      page: 1,
    });
  }

  function updateSearch(search: string) {
    onUpdateBrowserState({
      ...browserState,
      search,
      page: 1,
    });
  }

  function updateSort(sort: string) {
    onUpdateBrowserState({
      ...browserState,
      sort: sort as BucketBrowserSort,
      page: 1,
    });
  }

  function updateDir(dir: "asc" | "desc") {
    onUpdateBrowserState({
      ...browserState,
      dir,
      page: 1,
    });
  }

  function updatePage(page: number) {
    onUpdateBrowserState({
      ...browserState,
      page,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            type="button"
            className="transition-colors hover:text-foreground"
            onClick={onBack}
          >
            Buckets
          </button>
          <span>/</span>
          <span className="text-foreground">{bucketTitle}</span>
        </div>
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back to buckets
        </Button>
      </div>

      {bucketSummaryQuery.isError && !summary ? (
        <Card>
          <CardContent className="p-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(bucketSummaryQuery.error)}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {summary ? (
        <MainSequenceEntitySummaryCard summary={summary} />
      ) : (
        <Card>
          <CardContent className="flex min-h-40 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading bucket summary
            </div>
          </CardContent>
        </Card>
      )}

      {bucketBrowseQuery.isLoading && !browsePayload ? (
        <div className="flex min-h-[420px] items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading bucket browser
          </div>
        </div>
      ) : null}

      {bucketBrowseQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(bucketBrowseQuery.error)}
        </div>
      ) : null}

      {browsePayload ? (
        <ObjectStorageBrowser
          actions={browserActions}
          breadcrumbs={browsePayload.breadcrumbs}
          currentPrefix={browsePayload.current_prefix}
          dir={browserState.dir}
          fileCount={browsePayload.stats.file_count}
          files={browsePayload.files.map((file) => ({
            id: file.id,
            name: file.name,
            displayName: file.display_name,
            createdByPod: file.created_by_pod,
            createdByResourceName: file.created_by_resource_name,
            creationDateDisplay: file.creation_date_display,
            sizeDisplay: file.size_display,
            contentUrl: file.content_url,
          }))}
          folderCount={browsePayload.stats.folder_count}
          folders={browsePayload.folders.map((folder) => ({
            rowId: folder.row_id,
            name: folder.name,
            prefix: folder.prefix,
            countFiles: folder.count_files,
            countSubfolders: folder.count_subfolders,
          }))}
          onDirChange={updateDir}
          onOpenPrefix={openPrefix}
          onPageChange={updatePage}
          onSearchChange={updateSearch}
          onSortChange={updateSort}
          pagination={{
            page: browsePayload.pagination.page,
            totalPages: browsePayload.pagination.total_pages,
            totalItems: browsePayload.pagination.total_items,
            hasNext: browsePayload.pagination.has_next,
            hasPrevious: browsePayload.pagination.has_previous,
            startIndex: browsePayload.pagination.start_index,
            endIndex: browsePayload.pagination.end_index,
          }}
          searchValue={browserState.search}
          sort={browserState.sort}
        />
      ) : null}

      <Dialog
        title="Create folder"
        open={createFolderDialogOpen}
        onClose={() => {
          if (!createFolderMutation.isPending) {
            setCreateFolderDialogOpen(false);
          }
        }}
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Folder name
            </label>
            <Input
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="new-folder"
              autoFocus
            />
          </div>

          {createFolderMutation.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(createFolderMutation.error)}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateFolderDialogOpen(false)}
              disabled={createFolderMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => createFolderMutation.mutate(folderName.trim())}
              disabled={createFolderMutation.isPending || !folderName.trim()}
            >
              {createFolderMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FolderPlus className="h-4 w-4" />
              )}
              Create folder
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        title="Upload file"
        open={uploadDialogOpen}
        onClose={() => {
          if (!uploadArtifactMutation.isPending) {
            setUploadDialogOpen(false);
          }
        }}
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              File
            </label>
            <input
              type="file"
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
              className="block w-full rounded-[calc(var(--radius)-6px)] border border-input bg-card/70 px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-ring/30"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Filename
            </label>
            <Input
              value={uploadFilename}
              onChange={(event) => setUploadFilename(event.target.value)}
              placeholder="report.csv"
            />
          </div>

          {uploadArtifactMutation.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(uploadArtifactMutation.error)}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setUploadDialogOpen(false)}
              disabled={uploadArtifactMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => uploadArtifactMutation.mutate()}
              disabled={uploadArtifactMutation.isPending || !uploadFile}
            >
              {uploadArtifactMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload file
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
