import { useEffect, useMemo, useState } from "react";

import { AllCommunityModule, type ColDef } from "ag-grid-community";
import { AgGridProvider, AgGridReact } from "ag-grid-react";
import { Plus, Table2, Trash2, Upload } from "lucide-react";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getThemeTightnessMetrics } from "@/themes/tightness";
import { useTheme } from "@/themes/ThemeProvider";
import { createAgGridTerminalTheme } from "@/widgets/extensions/ag-grid/grid-theme";

import type { ManualTableColumnDefinition } from "@/widgets/shared/tabular-widget-source";

const agGridModules = [AllCommunityModule];

const manualColumnTypeOptions: Array<{
  label: string;
  value: ManualTableColumnDefinition["type"];
}> = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "integer", label: "Integer" },
  { value: "boolean", label: "Boolean" },
  { value: "datetime", label: "Datetime" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "json", label: "JSON" },
];

type ManualGridRow = Record<string, unknown> & {
  __manualRowId: string;
};

function buildFallbackColumnKey(index: number) {
  return `column_${index + 1}`;
}

function createUniqueColumnKey(
  requestedKey: string,
  existingKeys: string[],
  fallbackIndex: number,
) {
  const trimmed = requestedKey.trim();
  const baseKey = trimmed || buildFallbackColumnKey(fallbackIndex);
  const usedKeys = new Set(existingKeys.filter((key) => key !== trimmed));

  if (!usedKeys.has(baseKey)) {
    return baseKey;
  }

  let suffix = 2;
  let candidate = `${baseKey}_${suffix}`;

  while (usedKeys.has(candidate)) {
    suffix += 1;
    candidate = `${baseKey}_${suffix}`;
  }

  return candidate;
}

function buildEmptyRow(columns: readonly ManualTableColumnDefinition[]) {
  return Object.fromEntries(columns.map((column) => [column.key, ""])) as Record<string, unknown>;
}

function buildManualGridRows(
  columns: readonly ManualTableColumnDefinition[],
  rows: readonly Record<string, unknown>[],
) {
  return rows.map<ManualGridRow>((row, index) => ({
    __manualRowId: `manual-row-${index}`,
    ...Object.fromEntries(
      columns.map((column) => [column.key, row[column.key] ?? ""]),
    ),
  }));
}

function splitDelimitedLine(line: string, delimiter: "," | "\t") {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === "\"") {
      if (insideQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === delimiter && !insideQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

function detectDelimiter(text: string): "," | "\t" {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  return tabCount > commaCount ? "\t" : ",";
}

function parseDelimitedText(text: string) {
  const normalizedText = text.replace(/\r\n/g, "\n").trim();

  if (!normalizedText) {
    return [];
  }

  const delimiter = detectDelimiter(normalizedText);

  return normalizedText
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .map((line) => splitDelimitedLine(line, delimiter));
}

function inferImportedColumnType(values: readonly string[]): ManualTableColumnDefinition["type"] {
  const nonEmptyValues = values.map((value) => value.trim()).filter((value) => value.length > 0);

  if (nonEmptyValues.length === 0) {
    return "string";
  }

  if (nonEmptyValues.every((value) => /^(true|false)$/i.test(value))) {
    return "boolean";
  }

  if (nonEmptyValues.every((value) => /^-?\d+$/.test(value))) {
    return "integer";
  }

  if (nonEmptyValues.every((value) => Number.isFinite(Number(value)))) {
    return "number";
  }

  return "string";
}

function buildImportedManualTable(
  text: string,
  useFirstRowAsHeaders: boolean,
) {
  const parsedRows = parseDelimitedText(text);

  if (parsedRows.length === 0) {
    return null;
  }

  const maxColumnCount = parsedRows.reduce(
    (maximum, row) => Math.max(maximum, row.length),
    0,
  );

  if (maxColumnCount === 0) {
    return null;
  }

  const sourceHeaders = useFirstRowAsHeaders
    ? (parsedRows[0] ?? [])
    : [];
  const dataRows = useFirstRowAsHeaders
    ? parsedRows.slice(1)
    : parsedRows;

  const headerCandidates = Array.from({ length: maxColumnCount }, (_, index) => {
    return sourceHeaders[index] ?? buildFallbackColumnKey(index);
  });

  const nextColumns = headerCandidates.reduce<ManualTableColumnDefinition[]>(
    (accumulator, headerCandidate, index) => {
      const nextKey = createUniqueColumnKey(
        headerCandidate,
        accumulator.map((column) => column.key),
        index,
      );
      const nextType = inferImportedColumnType(
        dataRows.map((row) => row[index] ?? ""),
      );

      accumulator.push({
        key: nextKey,
        type: nextType,
      });
      return accumulator;
    },
    [],
  );

  const nextRows = dataRows.map<Record<string, unknown>>((row) =>
    Object.fromEntries(
      nextColumns.map((column, index) => [column.key, row[index] ?? ""]),
    ),
  );

  return {
    columns: nextColumns,
    rows: nextRows,
  };
}

function ColumnKeyInput({
  columnKey,
  disabled,
  onCommit,
}: {
  columnKey: string;
  disabled: boolean;
  onCommit: (nextValue: string) => void;
}) {
  const [value, setValue] = useState(columnKey);

  useEffect(() => {
    setValue(columnKey);
  }, [columnKey]);

  return (
    <Input
      value={value}
      disabled={disabled}
      onChange={(event) => {
        setValue(event.target.value);
      }}
      onBlur={() => {
        onCommit(value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onCommit(value);
        }
      }}
      className="h-8"
      placeholder="Column name"
    />
  );
}

export function ManualTableEditor({
  columns,
  editable,
  rows,
  onChange,
}: {
  columns: ManualTableColumnDefinition[];
  editable: boolean;
  rows: Array<Record<string, unknown>>;
  onChange: (nextState: {
    columns: ManualTableColumnDefinition[];
    rows: Array<Record<string, unknown>>;
  }) => void;
}) {
  const { resolvedTokens } = useTheme();
  const tightnessMetrics = getThemeTightnessMetrics("default");
  const theme = useMemo(
    () => createAgGridTerminalTheme(resolvedTokens, tightnessMetrics.table),
    [resolvedTokens, tightnessMetrics.table],
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftColumns, setDraftColumns] = useState<ManualTableColumnDefinition[]>(columns);
  const [draftRows, setDraftRows] = useState<Array<Record<string, unknown>>>(rows);
  const [importText, setImportText] = useState("");
  const [importMode, setImportMode] = useState<"headers" | "data">("headers");
  const [importError, setImportError] = useState<string | null>(null);
  const normalizedRows = useMemo(
    () => rows.map((row) => ({ ...row })),
    [rows],
  );
  const normalizedDraftRows = useMemo(
    () => draftRows.map((row) => ({ ...row })),
    [draftRows],
  );
  const gridRows = useMemo(
    () => buildManualGridRows(draftColumns, normalizedDraftRows),
    [draftColumns, normalizedDraftRows],
  );
  const previewColumnLabels = columns.slice(0, 6).map((column) => column.key);
  const modalDirty = useMemo(
    () =>
      JSON.stringify({
        columns: draftColumns,
        rows: normalizedDraftRows,
      }) !==
      JSON.stringify({
        columns,
        rows: normalizedRows,
      }),
    [columns, draftColumns, normalizedDraftRows, normalizedRows],
  );

  useEffect(() => {
    if (editorOpen) {
      return;
    }

    setDraftColumns(columns);
    setDraftRows(rows);
  }, [columns, editorOpen, rows]);

  function resetEditorState() {
    setDraftColumns(columns);
    setDraftRows(rows);
    setImportText("");
    setImportMode("headers");
    setImportError(null);
  }

  function openEditor() {
    resetEditorState();
    setEditorOpen(true);
  }

  function closeEditor() {
    resetEditorState();
    setEditorOpen(false);
  }

  function applyEditorChanges() {
    onChange({
      columns: draftColumns,
      rows: normalizedDraftRows,
    });
    setImportText("");
    setImportMode("headers");
    setImportError(null);
    setEditorOpen(false);
  }

  function handleAddColumn() {
    const nextColumn: ManualTableColumnDefinition = {
      key: createUniqueColumnKey("", draftColumns.map((column) => column.key), draftColumns.length),
      type: "string",
    };
    const nextColumns = [...draftColumns, nextColumn];
    const nextRows = normalizedDraftRows.map((row) => ({
      ...row,
      [nextColumn.key]: "",
    }));

    setDraftColumns(nextColumns);
    setDraftRows(nextRows);
  }

  function handleRemoveColumn(columnIndex: number) {
    const column = draftColumns[columnIndex];

    if (!column) {
      return;
    }

    const nextColumns = draftColumns.filter((_, index) => index !== columnIndex);
    const nextRows = normalizedDraftRows.map((row) => {
      const { [column.key]: _removed, ...rest } = row;
      return rest;
    });

    setDraftColumns(nextColumns);
    setDraftRows(nextRows);
  }

  function handleRenameColumn(columnIndex: number, requestedKey: string) {
    const currentColumn = draftColumns[columnIndex];

    if (!currentColumn) {
      return;
    }

    const nextKey = createUniqueColumnKey(
      requestedKey,
      draftColumns
        .filter((_, index) => index !== columnIndex)
        .map((column) => column.key),
      columnIndex,
    );

    if (nextKey === currentColumn.key) {
      return;
    }

    const nextColumns = draftColumns.map((column, index) =>
      index === columnIndex ? { ...column, key: nextKey } : column,
    );
    const nextRows = normalizedDraftRows.map((row) => {
      const nextRow = { ...row };
      nextRow[nextKey] = row[currentColumn.key] ?? "";
      delete nextRow[currentColumn.key];
      return nextRow;
    });

    setDraftColumns(nextColumns);
    setDraftRows(nextRows);
  }

  function handleColumnTypeChange(
    columnIndex: number,
    nextType: ManualTableColumnDefinition["type"],
  ) {
    setDraftColumns(
      draftColumns.map((column, index) =>
        index === columnIndex ? { ...column, type: nextType } : column,
      ),
    );
  }

  function handleAddRow() {
    setDraftRows([...normalizedDraftRows, buildEmptyRow(draftColumns)]);
  }

  function handleRemoveRow(rowIndex: number) {
    if (rowIndex < 0) {
      return;
    }

    setDraftRows(normalizedDraftRows.filter((_, index) => index !== rowIndex));
  }

  function handleCellChange(
    rowIndex: number,
    columnKey: string,
    nextValue: unknown,
  ) {
    setDraftRows(
      normalizedDraftRows.map((row, index) =>
        index === rowIndex
          ? {
              ...row,
              [columnKey]: nextValue,
            }
          : row,
      ),
    );
  }

  function handleImportReplace() {
    const importedTable = buildImportedManualTable(importText, importMode === "headers");

    if (!importedTable) {
      setImportError("Paste a CSV or spreadsheet table before importing.");
      return;
    }

    setDraftColumns(importedTable.columns);
    setDraftRows(importedTable.rows);
    setImportError(null);
    setImportText("");
  }

  const columnDefs = useMemo<ColDef<ManualGridRow>[]>(
    () => [
      {
        colId: "__manualActions",
        headerName: "#",
        width: 78,
        editable: false,
        resizable: false,
        sortable: false,
        pinned: "left",
        suppressMovable: true,
        cellRenderer: (params: { node: { rowIndex: number | null } }) => {
          const rowIndex = params.node.rowIndex ?? 0;

          return (
            <div className="flex h-full items-center justify-between gap-2 px-1">
              <span className="text-[11px] text-muted-foreground">
                {(rowIndex + 1).toLocaleString()}
              </span>
              {editable ? (
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-background/70 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => {
                    handleRemoveRow(rowIndex);
                  }}
                  aria-label={`Remove row ${rowIndex + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          );
        },
      },
      ...draftColumns.map<ColDef<ManualGridRow>>((column) => ({
        field: column.key,
        headerName: column.key,
        editable,
        resizable: true,
        minWidth: 160,
        flex: 1,
      })),
    ],
    [draftColumns, editable],
  );
  const defaultColDef = useMemo<ColDef<ManualGridRow>>(
    () => ({
      editable,
      sortable: false,
      filter: false,
      suppressHeaderMenuButton: true,
      suppressMovable: true,
    }),
    [editable],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/26 px-4 py-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">
            {columns.length.toLocaleString()} columns • {normalizedRows.length.toLocaleString()} rows
          </div>
          <div className="text-sm text-muted-foreground">
            Open the editor to paste CSV or spreadsheet data and edit it in a grid.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!editable}
            onClick={() => {
              openEditor();
            }}
          >
            <Table2 className="h-4 w-4" />
            Open editor
          </Button>
        </div>
      </div>

      {columns.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {previewColumnLabels.map((label) => (
            <span
              key={label}
              className="inline-flex items-center rounded-full border border-border/70 bg-background/40 px-2.5 py-1 text-xs text-muted-foreground"
            >
              {label}
            </span>
          ))}
          {columns.length > previewColumnLabels.length ? (
            <span className="inline-flex items-center rounded-full border border-border/70 bg-background/30 px-2.5 py-1 text-xs text-muted-foreground">
              +{(columns.length - previewColumnLabels.length).toLocaleString()} more
            </span>
          ) : null}
        </div>
      ) : (
        <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/20 px-4 py-4 text-sm text-muted-foreground">
          No columns yet. Open the editor to add columns manually or paste a full table from a spreadsheet.
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        Column names stay unique. Open the editor to change the manual table, then click Apply to update the workspace draft.
      </div>

      <Dialog
        open={editorOpen}
        onClose={closeEditor}
        title="Manual table editor"
        description="Edit the local table in a grid and import CSV or spreadsheet data. Apply commits these changes to the workspace draft."
        className="max-w-[min(1380px,calc(100vw-24px))]"
        contentClassName="space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-3">
          <div className="text-sm text-muted-foreground">
            {draftColumns.length.toLocaleString()} columns • {normalizedDraftRows.length.toLocaleString()} rows
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!editable}
              onClick={handleAddColumn}
            >
              <Plus className="h-4 w-4" />
              Add column
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!editable || draftColumns.length === 0}
              onClick={handleAddRow}
            >
              <Plus className="h-4 w-4" />
              Add row
            </Button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-5">
            <section className="space-y-3 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 p-4">
              <div className="space-y-1">
                <div className="text-sm font-medium text-topbar-foreground">Columns</div>
                <p className="text-sm text-muted-foreground">
                  Rename columns, choose types, and remove fields before applying the manual table.
                </p>
              </div>

              {draftColumns.length === 0 ? (
                <div className="rounded-[calc(var(--radius)-8px)] border border-dashed border-border/70 bg-background/20 px-4 py-5 text-sm text-muted-foreground">
                  Add a column or import a table to start editing rows.
                </div>
              ) : (
                <div className="space-y-3">
                  {draftColumns.map((column, columnIndex) => (
                    <div
                      key={column.key}
                      className="space-y-2 rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/36 p-3"
                    >
                      <ColumnKeyInput
                        columnKey={column.key}
                        disabled={!editable}
                        onCommit={(nextValue) => {
                          handleRenameColumn(columnIndex, nextValue);
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <Select
                          value={column.type}
                          disabled={!editable}
                          onChange={(event) => {
                            handleColumnTypeChange(
                              columnIndex,
                              event.target.value as ManualTableColumnDefinition["type"],
                            );
                          }}
                          className="h-8 min-w-[140px]"
                        >
                          {manualColumnTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!editable}
                          onClick={() => {
                            handleRemoveColumn(columnIndex);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 p-4">
              <div className="space-y-1">
                <div className="text-sm font-medium text-topbar-foreground">Paste CSV or spreadsheet data</div>
                <p className="text-sm text-muted-foreground">
                  Paste CSV or tab-separated rows from a spreadsheet. Import replaces the current manual table.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  First row
                </label>
                <Select
                  value={importMode}
                  disabled={!editable}
                  onChange={(event) => {
                    setImportMode(event.target.value === "data" ? "data" : "headers");
                  }}
                  className="h-8"
                >
                  <option value="headers">Use first row as column names</option>
                  <option value="data">Treat every row as data</option>
                </Select>
              </div>

              <Textarea
                value={importText}
                disabled={!editable}
                onChange={(event) => {
                  setImportText(event.target.value);
                  if (importError) {
                    setImportError(null);
                  }
                }}
                placeholder={"Year\tRevenue\n2021\t120\n2022\t145"}
                className="min-h-[180px] resize-y font-mono text-xs"
              />

              {importError ? (
                <div className="rounded-[calc(var(--radius)-8px)] border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                  {importError}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={!editable}
                  onClick={handleImportReplace}
                >
                  <Upload className="h-4 w-4" />
                  Import pasted data
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!editable || !importText}
                  onClick={() => {
                    setImportText("");
                    setImportError(null);
                  }}
                >
                  Clear pasted text
                </Button>
              </div>
            </section>
          </div>

          <section className="space-y-3 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 p-4">
            <div className="space-y-1">
              <div className="text-sm font-medium text-topbar-foreground">Grid editor</div>
              <p className="text-sm text-muted-foreground">
                Edit cells directly in the grid. You can still remove individual rows from the first column.
              </p>
            </div>

            {draftColumns.length === 0 ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-[calc(var(--radius)-8px)] border border-dashed border-border/70 bg-background/20 px-4 py-6 text-sm text-muted-foreground">
                Add a column or import a table to open the grid editor.
              </div>
            ) : (
              <AgGridProvider modules={agGridModules}>
                <div className="h-[min(62vh,640px)] min-h-[420px] overflow-hidden rounded-[calc(var(--radius)-8px)] border border-border/70 bg-card/70">
                  <AgGridReact<ManualGridRow>
                    theme={theme}
                    rowData={gridRows}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    animateRows
                    singleClickEdit
                    stopEditingWhenCellsLoseFocus
                    enableCellTextSelection
                    rowHeight={36}
                    headerHeight={36}
                    onCellValueChanged={(event) => {
                      const rowIndex = event.node.rowIndex;
                      const columnKey = event.colDef.field;

                      if (rowIndex == null || !columnKey || columnKey === "__manualActions") {
                        return;
                      }

                      handleCellChange(rowIndex, columnKey, event.newValue ?? "");
                    }}
                  />
                </div>
              </AgGridProvider>
            )}
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
          <div className="text-sm text-muted-foreground">
            {modalDirty
              ? "Unsaved editor changes. Apply to update the workspace draft."
              : "No pending editor changes."}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={closeEditor}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!editable || !modalDirty}
              onClick={applyEditorChanges}
            >
              Apply
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
