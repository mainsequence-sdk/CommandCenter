import { useEffect, useMemo, useState } from "react";

import { ChevronDown, FileCode2, Loader2 } from "lucide-react";
import { Diff, Hunk, parseDiff, type FileData } from "react-diff-view";

import { useAuthStore } from "@/auth/auth-store";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { RepoDiffSessionTool } from "../../../assistant-ui/session-tools";
import { fetchRepoDiff, type RepoDiffFile, type RepoDiffResponse } from "../repo-diff-api";

import "react-diff-view/style/index.css";
import "./repo-diff.css";

const repoDiffCache = new Map<string, RepoDiffResponse>();

function normalizeDiffPath(value: string | null | undefined) {
  if (!value || value === "/dev/null") {
    return "";
  }

  return value.replace(/^a\//, "").replace(/^b\//, "");
}

function getParsedFilePath(file: FileData) {
  return normalizeDiffPath(file.newPath) || normalizeDiffPath(file.oldPath);
}

function formatRepoDiffBase(base: RepoDiffResponse["diff"]["base"]) {
  return base === "staged_and_worktree" ? "Working Tree" : "HEAD";
}

function formatRepoDiffStatus(status: RepoDiffFile["status"]) {
  return status.replace(/_/g, " ");
}

function formatRepoDiffFlags(file: RepoDiffFile) {
  const flags = [
    file.staged ? "staged" : null,
    file.unstaged ? "unstaged" : null,
    file.untracked ? "untracked" : null,
  ].filter((entry): entry is string => Boolean(entry));

  return flags.join(" · ");
}

function RepoDiffFileButton({
  file,
  isSelected,
  onSelect,
}: {
  file: RepoDiffFile;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const flags = formatRepoDiffFlags(file);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-[14px] border px-3 py-2.5 text-left transition-colors",
        isSelected
          ? "border-primary/45 bg-primary/10"
          : "border-border/60 bg-background/45 hover:bg-background/60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-mono text-[12px] font-medium text-foreground">
            {file.path}
          </div>
          {file.originalPath ? (
            <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
              from {file.originalPath}
            </div>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {formatRepoDiffStatus(file.status)}
        </span>
      </div>

      {flags ? <div className="mt-1 text-[11px] text-muted-foreground">{flags}</div> : null}
    </button>
  );
}

function RepoDiffContent({
  error,
  isLoading,
  parsedDiff,
  selectedFile,
  selectedPath,
  setSelectedPath,
  snapshot,
}: {
  error: string | null;
  isLoading: boolean;
  parsedDiff: { files: FileData[]; error: string | null };
  selectedFile: RepoDiffFile | null;
  selectedPath: string | null;
  setSelectedPath: (value: string) => void;
  snapshot: RepoDiffResponse | null;
}) {
  const visibleFiles = useMemo(() => {
    if (!selectedPath) {
      return parsedDiff.files;
    }

    return parsedDiff.files.filter((file) => getParsedFilePath(file) === selectedPath);
  }, [parsedDiff.files, selectedPath]);

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex items-center gap-2 rounded-[14px] border border-border/60 bg-background/45 px-3 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading repository diff
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[14px] border border-danger/30 bg-danger/8 px-3 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {snapshot && !snapshot.diff.hasChanges ? (
        <div className="rounded-[14px] border border-dashed border-border/60 px-3 py-3 text-sm text-muted-foreground">
          No repository changes are available for this session.
        </div>
      ) : null}

      {snapshot && snapshot.diff.files.length > 0 ? (
        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Changed Files
          </div>
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {snapshot.diff.files.map((file) => (
              <RepoDiffFileButton
                key={`${file.path}:${file.status}`}
                file={file}
                isSelected={selectedPath === file.path}
                onSelect={() => {
                  setSelectedPath(file.path);
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {parsedDiff.error ? (
        <div className="rounded-[14px] border border-danger/30 bg-danger/8 px-3 py-3 text-sm text-danger">
          {parsedDiff.error}
        </div>
      ) : null}

      {snapshot && snapshot.diff.hasChanges && !parsedDiff.error ? (
        visibleFiles.length > 0 ? (
          <div className="space-y-3">
            {visibleFiles.map((file, index) => {
              const filePath = getParsedFilePath(file);
              const metadata =
                snapshot.diff.files.find((entry) => entry.path === filePath) ?? selectedFile;

              return (
                <div key={`${file.oldRevision}-${file.newRevision}-${index}`} className="space-y-2">
                  <div className="rounded-[14px] border border-border/60 bg-background/55 px-3 py-2.5">
                    <div className="truncate font-mono text-[12px] font-medium text-foreground">
                      {filePath || metadata?.path || "Changed file"}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      {metadata ? (
                        <span className="rounded-full border border-border/60 px-2 py-0.5 uppercase tracking-[0.14em]">
                          {formatRepoDiffStatus(metadata.status)}
                        </span>
                      ) : null}
                      {metadata?.originalPath ? (
                        <span className="truncate font-mono">from {metadata.originalPath}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[14px] border border-border/60 bg-background/55">
                    <div className="ms-repo-diff-view max-h-[50rem] overflow-auto">
                      <Diff
                        diffType={file.type}
                        viewType="unified"
                        hunks={file.hunks}
                        className="ms-repo-diff-table"
                        lineClassName="ms-repo-diff-line"
                        gutterClassName="ms-repo-diff-gutter"
                        codeClassName="ms-repo-diff-code"
                      >
                        {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
                      </Diff>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[14px] border border-dashed border-border/60 px-3 py-3 text-sm text-muted-foreground">
            {selectedFile
              ? `No textual diff hunks are available for ${selectedFile.path}.`
              : "No textual diff hunks are available for this session."}
          </div>
        )
      ) : null}

      {!isLoading && !error && !snapshot ? (
        <div className="rounded-[14px] border border-dashed border-border/60 px-3 py-3 text-sm text-muted-foreground">
          Repository diff data is not available yet.
        </div>
      ) : null}
    </div>
  );
}

export function RepoDiffTool({ tool }: { tool: RepoDiffSessionTool }) {
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<RepoDiffResponse | null>(
    () => repoDiffCache.get(tool.url) ?? null,
  );
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSnapshot(repoDiffCache.get(tool.url) ?? null);
    setSelectedPath(null);
    setError(null);
    setIsLoading(false);
  }, [tool.url]);

  useEffect(() => {
    if (snapshot || isLoading) {
      return;
    }

    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    void fetchRepoDiff({
      url: tool.url,
      signal: controller.signal,
      token: sessionToken,
      tokenType: sessionTokenType,
    })
      .then((next) => {
        if (controller.signal.aborted) {
          return;
        }

        repoDiffCache.set(tool.url, next);
        setSnapshot(next);
      })
      .catch((nextError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(nextError instanceof Error ? nextError.message : "Unable to load repo diff.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [sessionToken, sessionTokenType, snapshot, tool.url]);

  useEffect(() => {
    if (!snapshot) {
      setSelectedPath(null);
      return;
    }

    setSelectedPath((current) => {
      if (current && snapshot.diff.files.some((file) => file.path === current)) {
        return current;
      }

      return snapshot.diff.files[0]?.path ?? null;
    });
  }, [snapshot]);

  const parsedDiff = useMemo(() => {
    const patch = snapshot?.diff.patch ?? "";

    if (!patch.trim()) {
      return { files: [] as FileData[], error: null };
    }

    try {
      return {
        files: parseDiff(patch),
        error: null,
      };
    } catch (nextError) {
      return {
        files: [] as FileData[],
        error: nextError instanceof Error ? nextError.message : "Unable to parse repo diff.",
      };
    }
  }, [snapshot?.diff.patch]);

  const selectedFile = useMemo(
    () => snapshot?.diff.files.find((file) => file.path === selectedPath) ?? null,
    [selectedPath, snapshot?.diff.files],
  );

  const summary = isLoading
    ? "Loading repository diff"
    : error
      ? "Diff failed to load"
      : snapshot
        ? snapshot.diff.hasChanges
          ? `${snapshot.diff.files.length} changed file${snapshot.diff.files.length === 1 ? "" : "s"}`
          : "No repository changes"
        : "Inspect repository changes for this session";

  return (
    <section className="rounded-[16px] border border-border/60 bg-background/45">
      <button
        type="button"
        aria-haspopup="dialog"
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
        onClick={() => {
          setIsModalOpen(true);
        }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <FileCode2 className="h-4 w-4 text-primary" />
            <span className="font-mono">repo_diff</span>
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{summary}</div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {snapshot ? (
            <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {formatRepoDiffBase(snapshot.diff.base)}
            </span>
          ) : null}
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 -rotate-90 text-muted-foreground" />
          )}
        </div>
      </button>

      <Dialog
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
        }}
        title="Repository Diff"
        description={summary}
        className="max-w-[min(1200px,calc(100vw-24px))]"
        contentClassName="max-h-[min(86vh,960px)]"
      >
        <RepoDiffContent
          error={error}
          isLoading={isLoading}
          parsedDiff={parsedDiff}
          selectedFile={selectedFile}
          selectedPath={selectedPath}
          setSelectedPath={setSelectedPath}
          snapshot={snapshot}
        />
      </Dialog>
    </section>
  );
}
