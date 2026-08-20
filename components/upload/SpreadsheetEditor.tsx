"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ClipboardPaste,
  Copy,
  Eraser,
  Filter,
  Highlighter,
  Italic,
  ListFilter,
  PaintBucket,
  Paintbrush,
  Plus,
  Redo2,
  Scissors,
  Search,
  Sigma,
  Strikethrough,
  Table,
  Trash2,
  Type,
  Underline,
  Undo2,
} from "lucide-react";
import { navyButtonClass } from "@/components/upload/upload-ui";
import { toolbarButtonClass } from "@/components/filters/FilterBar";
import {
  REQUIRED_HEADERS,
  applyColumnMapping,
  type ColumnMapping,
  type RawCsvRow,
  type RequiredHeader,
} from "@/lib/csv";
import {
  checkField,
  failingRowIds,
  inspectRows,
  mappedRowsFromRaw,
  type CellIssue,
} from "@/lib/upload-validate";

export type CellStyle = {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  fill?: string;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  wrap?: boolean;
  border?: boolean;
  numberFormat?: "general" | "number" | "currency" | "percent";
  decimals?: number;
  preset?: "normal" | "heading" | "input" | "good" | "bad" | "neutral";
};

type Selection = {
  row: number;
  col: number;
  rowEnd: number;
  colEnd: number;
};

type Snapshot = {
  headers: string[];
  rows: RawCsvRow[];
  styles: Record<string, CellStyle>;
};

const FONTS = ["Calibri", "Arial", "Georgia", "Inter", "monospace"];
const SIZES = [10, 11, 12, 14, 16, 18];
const FILLS = ["#ffffff", "#fff2cc", "#c6efce", "#ffc7ce", "#ddebf7", "#f6e8e8", "#e8f1eb", "#f8f0e3"];
const COLORS = ["#1e293b", "#1b365d", "#c45c5c", "#5b8a72", "#c4923a", "#ffffff"];

function styleKey(row: number, header: string): string {
  return `${row}:${header}`;
}

function emptyRow(headers: string[]): RawCsvRow {
  return Object.fromEntries(headers.map((header) => [header, ""]));
}

function cloneRows(rows: RawCsvRow[]): RawCsvRow[] {
  return rows.map((row) => ({ ...row }));
}

function normalizeSelection(selection: Selection): Selection {
  return {
    row: Math.min(selection.row, selection.rowEnd),
    col: Math.min(selection.col, selection.colEnd),
    rowEnd: Math.max(selection.row, selection.rowEnd),
    colEnd: Math.max(selection.col, selection.colEnd),
  };
}

function inSelection(selection: Selection, row: number, col: number): boolean {
  const next = normalizeSelection(selection);
  return row >= next.row && row <= next.rowEnd && col >= next.col && col <= next.colEnd;
}

function displayValue(raw: string, style?: CellStyle): string {
  if (!style?.numberFormat || style.numberFormat === "general" || raw === "") return raw;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return raw;
  const decimals = style.decimals ?? 2;
  if (style.numberFormat === "percent") return `${parsed.toFixed(decimals)}%`;
  if (style.numberFormat === "currency") {
    return parsed.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return parsed.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function cellCss(style?: CellStyle): CSSProperties {
  const preset = style?.preset;
  const fill =
    style?.fill ??
    (preset === "good"
      ? "#c6efce"
      : preset === "bad"
        ? "#ffc7ce"
        : preset === "neutral"
          ? "#fff2cc"
          : preset === "input"
            ? "#ddebf7"
            : preset === "heading"
              ? "#1b365d"
              : undefined);
  const color =
    style?.color ?? (preset === "heading" ? "#ffffff" : undefined);
  return {
    fontFamily: style?.fontFamily,
    fontSize: style?.fontSize ? `${style.fontSize}px` : undefined,
    fontWeight: style?.bold || preset === "heading" ? 700 : undefined,
    fontStyle: style?.italic ? "italic" : undefined,
    textDecoration: [style?.underline ? "underline" : "", style?.strike ? "line-through" : ""]
      .filter(Boolean)
      .join(" ") || undefined,
    color,
    backgroundColor: fill,
    textAlign: style?.align,
    verticalAlign: style?.valign,
    whiteSpace: style?.wrap ? "pre-wrap" : "nowrap",
  };
}

function RibbonBtn({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-sm text-foreground transition-colors duration-150 hover:bg-background disabled:opacity-40 ${
        active ? "bg-navy/10 text-navy" : ""
      }`}
    >
      {children}
    </button>
  );
}

function RibbonGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 border-r border-border px-2 last:border-r-0">
      <div className="flex flex-wrap items-center gap-0.5">{children}</div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

export function SpreadsheetEditor({
  fileName,
  headers,
  rows,
  mapping,
  flaggedIds,
  onRowsChange,
  onCancel,
  onSave,
  busy,
  saveError,
}: {
  fileName: string;
  headers: string[];
  rows: RawCsvRow[];
  mapping: ColumnMapping;
  flaggedIds: string[];
  onRowsChange: (next: RawCsvRow[]) => void;
  onCancel: () => void;
  onSave: () => void;
  busy?: boolean;
  saveError?: string | null;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [styles, setStyles] = useState<Record<string, CellStyle>>({});
  const [selection, setSelection] = useState<Selection>({
    row: 0,
    col: 0,
    rowEnd: 0,
    colEnd: 0,
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [clip, setClip] = useState<{ values: string[][]; styles: (CellStyle | undefined)[][] } | null>(null);
  const [painter, setPainter] = useState<CellStyle | null>(null);
  const [filterFlagged, setFilterFlagged] = useState(true);
  const [columnFilter, setColumnFilter] = useState("");
  const [find, setFind] = useState("");
  const [findIndex, setFindIndex] = useState(0);
  const [tableOn, setTableOn] = useState(true);
  const [highlightEmpty, setHighlightEmpty] = useState(false);

  const mappedRows = useMemo(
    () => mappedRowsFromRaw(applyColumnMapping(rows, mapping)),
    [rows, mapping],
  );
  const issues = useMemo(() => inspectRows(mappedRows), [mappedRows]);
  const issueIndex = useMemo(() => {
    const map = new Map<string, CellIssue>();
    for (const issue of issues) {
      map.set(`${issue.rowId}:${issue.field}`, issue);
    }
    return map;
  }, [issues]);
  const stillFailing = failingRowIds(issues);
  const reverseMapping = useMemo(() => {
    const map = new Map<string, RequiredHeader>();
    for (const field of REQUIRED_HEADERS) {
      if (mapping[field]) map.set(mapping[field], field);
    }
    return map;
  }, [mapping]);

  const visibleIndexes = useMemo(() => {
    return rows
      .map((_, index) => index)
      .filter((index) => {
        if (filterFlagged && flaggedIds.length > 0 && !flaggedIds.includes(`r${index}`)) {
          return false;
        }
        if (!columnFilter) return true;
        const needle = columnFilter.toLowerCase();
        return headers.some((header) =>
          String(rows[index]?.[header] ?? "").toLowerCase().includes(needle),
        );
      });
  }, [rows, filterFlagged, flaggedIds, columnFilter, headers]);

  const matches = useMemo(() => {
    const needle = find.trim().toLowerCase();
    if (!needle) return [] as Array<{ row: number; col: number }>;
    const next: Array<{ row: number; col: number }> = [];
    visibleIndexes.forEach((row) => {
      headers.forEach((header, col) => {
        if (String(rows[row]?.[header] ?? "").toLowerCase().includes(needle)) {
          next.push({ row, col });
        }
      });
    });
    return next;
  }, [find, visibleIndexes, headers, rows]);

  const resolved = flaggedIds.filter((id) => !stillFailing.has(id)).length;
  const selected = normalizeSelection(selection);
  const activeHeader = headers[selected.col] ?? headers[0] ?? "";
  const activeValue = rows[selected.row]?.[activeHeader] ?? "";
  const activeStyle = styles[styleKey(selected.row, activeHeader)] ?? {};
  const activeField = reverseMapping.get(activeHeader);
  const activeIssue = activeField
    ? issueIndex.get(`r${selected.row}:${activeField}`)
    : undefined;

  const pushHistory = useCallback(() => {
    setHistory((current) => [
      ...current.slice(-49),
      { headers, rows: cloneRows(rows), styles: { ...styles } },
    ]);
    setFuture([]);
  }, [headers, rows, styles]);

  const restore = (snapshot: Snapshot) => {
    onRowsChange(snapshot.rows);
    setStyles(snapshot.styles);
  };

  function undo() {
    const snapshot = history[history.length - 1];
    if (!snapshot) return;
    setFuture((current) => [{ headers, rows: cloneRows(rows), styles: { ...styles } }, ...current]);
    setHistory((current) => current.slice(0, -1));
    restore(snapshot);
  }

  function redo() {
    const snapshot = future[0];
    if (!snapshot) return;
    setHistory((current) => [...current, { headers, rows: cloneRows(rows), styles: { ...styles } }]);
    setFuture((current) => current.slice(1));
    restore(snapshot);
  }

  function selectedCells(): Array<{ row: number; col: number; header: string }> {
    const next = normalizeSelection(selection);
    const cells: Array<{ row: number; col: number; header: string }> = [];
    for (let row = next.row; row <= next.rowEnd; row += 1) {
      for (let col = next.col; col <= next.colEnd; col += 1) {
        const header = headers[col];
        if (header) cells.push({ row, col, header });
      }
    }
    return cells;
  }

  function commitValue(row: number, header: string, value: string) {
    if ((rows[row]?.[header] ?? "") === value) return;
    pushHistory();
    onRowsChange(
      rows.map((item, index) => (index === row ? { ...item, [header]: value } : item)),
    );
  }

  function patchStyles(mutate: (current: CellStyle) => CellStyle) {
    pushHistory();
    setStyles((current) => {
      const next = { ...current };
      for (const cell of selectedCells()) {
        const key = styleKey(cell.row, cell.header);
        next[key] = mutate(next[key] ?? {});
      }
      return next;
    });
  }

  function copySelection(cut = false) {
    const next = normalizeSelection(selection);
    const values: string[][] = [];
    const copiedStyles: (CellStyle | undefined)[][] = [];
    for (let row = next.row; row <= next.rowEnd; row += 1) {
      const valueRow: string[] = [];
      const styleRow: (CellStyle | undefined)[] = [];
      for (let col = next.col; col <= next.colEnd; col += 1) {
        const header = headers[col] ?? "";
        valueRow.push(rows[row]?.[header] ?? "");
        styleRow.push(styles[styleKey(row, header)]);
      }
      values.push(valueRow);
      copiedStyles.push(styleRow);
    }
    setClip({ values, styles: copiedStyles });
    const tsv = values.map((line) => line.join("\t")).join("\n");
    void navigator.clipboard?.writeText(tsv);
    if (cut) {
      pushHistory();
      const cleared = cloneRows(rows);
      for (let row = next.row; row <= next.rowEnd; row += 1) {
        for (let col = next.col; col <= next.colEnd; col += 1) {
          const header = headers[col];
          if (header) cleared[row][header] = "";
        }
      }
      onRowsChange(cleared);
    }
  }

  function pasteSelection(text?: string) {
    const source = clip;
    const lines = (text ?? source?.values.map((row) => row.join("\t")).join("\n") ?? "")
      .replace(/\r/g, "")
      .split("\n")
      .filter((line, index, all) => !(index === all.length - 1 && line === ""));
    const values = lines.map((line) => line.split("\t"));
    if (values.length === 0) return;
    pushHistory();
    const origin = normalizeSelection(selection);
    const next = cloneRows(rows);
    const nextStyles = { ...styles };
    values.forEach((line, rowOffset) => {
      line.forEach((value, colOffset) => {
        const row = origin.row + rowOffset;
        const col = origin.col + colOffset;
        const header = headers[col];
        if (!header || row >= next.length) return;
        next[row][header] = value;
        const copied = source?.styles[rowOffset]?.[colOffset];
        if (copied) nextStyles[styleKey(row, header)] = { ...copied };
      });
    });
    onRowsChange(next);
    setStyles(nextStyles);
  }

  function insertRow() {
    pushHistory();
    const at = normalizeSelection(selection).rowEnd + 1;
    const next = [...cloneRows(rows)];
    next.splice(at, 0, emptyRow(headers));
    onRowsChange(next);
  }

  function deleteRows() {
    const nextSel = normalizeSelection(selection);
    if (rows.length <= 1) return;
    pushHistory();
    onRowsChange(rows.filter((_, index) => index < nextSel.row || index > nextSel.rowEnd));
    setSelection({ row: Math.min(nextSel.row, rows.length - 2), col: nextSel.col, rowEnd: Math.min(nextSel.row, rows.length - 2), colEnd: nextSel.col });
  }

  function clearCells(kind: "all" | "contents" | "formats") {
    pushHistory();
    if (kind !== "formats") {
      const next = cloneRows(rows);
      for (const cell of selectedCells()) next[cell.row][cell.header] = "";
      onRowsChange(next);
    }
    if (kind !== "contents") {
      setStyles((current) => {
        const next = { ...current };
        for (const cell of selectedCells()) delete next[styleKey(cell.row, cell.header)];
        return next;
      });
    }
  }

  function autoSum() {
    const nextSel = normalizeSelection(selection);
    if (nextSel.col !== nextSel.colEnd) return;
    const header = headers[nextSel.col];
    if (!header) return;
    const values = [];
    for (let row = nextSel.row; row <= nextSel.rowEnd; row += 1) {
      const parsed = Number(rows[row]?.[header]);
      if (Number.isFinite(parsed)) values.push(parsed);
    }
    const total = values.reduce((sum, value) => sum + value, 0);
    const target = nextSel.rowEnd + 1;
    pushHistory();
    if (target >= rows.length) {
      onRowsChange([...cloneRows(rows), { ...emptyRow(headers), [header]: String(total) }]);
      return;
    }
    onRowsChange(
      rows.map((row, index) => (index === target ? { ...row, [header]: String(total) } : row)),
    );
  }

  function sortColumn(direction: "asc" | "desc") {
    const header = activeHeader;
    if (!header) return;
    pushHistory();
    const next = cloneRows(rows);
    next.sort((a, b) => {
      const left = a[header] ?? "";
      const right = b[header] ?? "";
      const leftNum = Number(left);
      const rightNum = Number(right);
      const compared =
        Number.isFinite(leftNum) && Number.isFinite(rightNum)
          ? leftNum - rightNum
          : left.localeCompare(right, undefined, { sensitivity: "base" });
      return direction === "asc" ? compared : -compared;
    });
    onRowsChange(next);
  }

  function jumpFind(delta: number) {
    if (matches.length === 0) return;
    const nextIndex = (findIndex + delta + matches.length) % matches.length;
    setFindIndex(nextIndex);
    const match = matches[nextIndex];
    if (!match) return;
    setSelection({ row: match.row, col: match.col, rowEnd: match.row, colEnd: match.col });
  }

  function onGridKey(event: KeyboardEvent<HTMLDivElement>) {
    if (editing) return;
    const meta = event.metaKey || event.ctrlKey;
    if (meta && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (meta && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redo();
      return;
    }
    if (meta && event.key.toLowerCase() === "c") {
      event.preventDefault();
      copySelection(false);
      return;
    }
    if (meta && event.key.toLowerCase() === "x") {
      event.preventDefault();
      copySelection(true);
      return;
    }
    if (meta && event.key.toLowerCase() === "v") {
      event.preventDefault();
      void navigator.clipboard?.readText().then((text) => pasteSelection(text));
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      clearCells("contents");
      return;
    }
    if (event.key === "Enter" || event.key === "F2") {
      event.preventDefault();
      setDraft(activeValue);
      setEditing(true);
      return;
    }
    const move = { row: selected.row, col: selected.col };
    if (event.key === "ArrowDown") move.row = Math.min(rows.length - 1, selected.row + 1);
    else if (event.key === "ArrowUp") move.row = Math.max(0, selected.row - 1);
    else if (event.key === "ArrowRight") move.col = Math.min(headers.length - 1, selected.col + 1);
    else if (event.key === "ArrowLeft") move.col = Math.max(0, selected.col - 1);
    else return;
    event.preventDefault();
    setSelection({ ...move, rowEnd: move.row, colEnd: move.col });
  }

  function selectCell(row: number, col: number, extend: boolean) {
    if (painter) {
      patchStyles(() => ({ ...painter }));
      setPainter(null);
    }
    if (extend) {
      setSelection((current) => ({ ...current, rowEnd: row, colEnd: col }));
      return;
    }
    setSelection({ row, col, rowEnd: row, colEnd: col });
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-navy">Edit data</p>
          <h1 className="text-base font-semibold text-foreground">{fileName}</h1>
          <p className="text-xs text-muted">
            {resolved} of {flaggedIds.length || stillFailing.size} flagged rows resolved
            {activeHeader ? ` · ${activeHeader}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className={toolbarButtonClass}>
            Cancel
          </button>
          <button type="button" disabled={busy} onClick={onSave} className={navyButtonClass}>
            {busy ? "Saving…" : "Save and Continue"}
          </button>
        </div>
      </div>

      <div className="border-b border-border bg-[#f3f2f1]">
        <div className="flex gap-4 px-3 pt-2 text-xs font-medium">
          <span className="border-b-2 border-navy pb-1 text-navy">Home</span>
        </div>
        <div className="flex flex-wrap items-stretch gap-0 px-2 py-2">
          <RibbonGroup label="Undo">
            <RibbonBtn label="Undo" disabled={history.length === 0} onClick={undo}>
              <Undo2 size={14} />
            </RibbonBtn>
            <RibbonBtn label="Redo" disabled={future.length === 0} onClick={redo}>
              <Redo2 size={14} />
            </RibbonBtn>
          </RibbonGroup>
          <RibbonGroup label="Clipboard">
            <RibbonBtn label="Paste" onClick={() => pasteSelection()}>
              <ClipboardPaste size={14} />
            </RibbonBtn>
            <RibbonBtn label="Cut" onClick={() => copySelection(true)}>
              <Scissors size={14} />
            </RibbonBtn>
            <RibbonBtn label="Copy" onClick={() => copySelection(false)}>
              <Copy size={14} />
            </RibbonBtn>
            <RibbonBtn
              label="Format painter"
              active={Boolean(painter)}
              onClick={() => setPainter(painter ? null : { ...activeStyle })}
            >
              <Paintbrush size={14} />
            </RibbonBtn>
          </RibbonGroup>
          <RibbonGroup label="Font">
            <select
              value={activeStyle.fontFamily ?? "Calibri"}
              onChange={(event) => patchStyles((style) => ({ ...style, fontFamily: event.target.value }))}
              className="h-7 max-w-[7.5rem] rounded-sm border border-border bg-white px-1 text-xs"
            >
              {FONTS.map((font) => (
                <option key={font}>{font}</option>
              ))}
            </select>
            <select
              value={activeStyle.fontSize ?? 11}
              onChange={(event) =>
                patchStyles((style) => ({ ...style, fontSize: Number(event.target.value) }))
              }
              className="h-7 rounded-sm border border-border bg-white px-1 text-xs"
            >
              {SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <RibbonBtn label="Bold" active={activeStyle.bold} onClick={() => patchStyles((style) => ({ ...style, bold: !style.bold }))}>
              <Bold size={14} />
            </RibbonBtn>
            <RibbonBtn label="Italic" active={activeStyle.italic} onClick={() => patchStyles((style) => ({ ...style, italic: !style.italic }))}>
              <Italic size={14} />
            </RibbonBtn>
            <RibbonBtn label="Underline" active={activeStyle.underline} onClick={() => patchStyles((style) => ({ ...style, underline: !style.underline }))}>
              <Underline size={14} />
            </RibbonBtn>
            <RibbonBtn label="Strikethrough" active={activeStyle.strike} onClick={() => patchStyles((style) => ({ ...style, strike: !style.strike }))}>
              <Strikethrough size={14} />
            </RibbonBtn>
            <RibbonBtn label="Border" active={activeStyle.border} onClick={() => patchStyles((style) => ({ ...style, border: !style.border }))}>
              <Table size={14} />
            </RibbonBtn>
            {FILLS.map((fill) => (
              <button
                key={fill}
                type="button"
                title={`Fill ${fill}`}
                onClick={() => patchStyles((style) => ({ ...style, fill }))}
                className="h-4 w-4 rounded-sm border border-border"
                style={{ backgroundColor: fill }}
              />
            ))}
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                title={`Font ${color}`}
                onClick={() => patchStyles((style) => ({ ...style, color }))}
                className="flex h-4 w-4 items-center justify-center rounded-sm border border-border text-[9px] font-bold"
                style={{ color, backgroundColor: color === "#ffffff" ? "#1e293b" : "#fff" }}
              >
                A
              </button>
            ))}
          </RibbonGroup>
          <RibbonGroup label="Alignment">
            <RibbonBtn label="Align left" active={activeStyle.align === "left"} onClick={() => patchStyles((style) => ({ ...style, align: "left" }))}>
              <AlignLeft size={14} />
            </RibbonBtn>
            <RibbonBtn label="Align center" active={activeStyle.align === "center"} onClick={() => patchStyles((style) => ({ ...style, align: "center" }))}>
              <AlignCenter size={14} />
            </RibbonBtn>
            <RibbonBtn label="Align right" active={activeStyle.align === "right"} onClick={() => patchStyles((style) => ({ ...style, align: "right" }))}>
              <AlignRight size={14} />
            </RibbonBtn>
            <RibbonBtn label="Top" active={activeStyle.valign === "top"} onClick={() => patchStyles((style) => ({ ...style, valign: "top" }))}>
              <span className="text-[9px] font-semibold">T</span>
            </RibbonBtn>
            <RibbonBtn label="Middle" active={activeStyle.valign === "middle"} onClick={() => patchStyles((style) => ({ ...style, valign: "middle" }))}>
              <span className="text-[9px] font-semibold">M</span>
            </RibbonBtn>
            <RibbonBtn label="Bottom" active={activeStyle.valign === "bottom"} onClick={() => patchStyles((style) => ({ ...style, valign: "bottom" }))}>
              <span className="text-[9px] font-semibold">B</span>
            </RibbonBtn>
            <RibbonBtn label="Wrap text" active={activeStyle.wrap} onClick={() => patchStyles((style) => ({ ...style, wrap: !style.wrap }))}>
              <span className="text-[9px] font-semibold">Wr</span>
            </RibbonBtn>
          </RibbonGroup>
          <RibbonGroup label="Number">
            <select
              value={activeStyle.numberFormat ?? "general"}
              onChange={(event) =>
                patchStyles((style) => ({
                  ...style,
                  numberFormat: event.target.value as CellStyle["numberFormat"],
                }))
              }
              className="h-7 rounded-sm border border-border bg-white px-1 text-xs"
            >
              <option value="general">General</option>
              <option value="number">Number</option>
              <option value="currency">Currency</option>
              <option value="percent">Percent</option>
            </select>
            <RibbonBtn
              label="More decimals"
              onClick={() =>
                patchStyles((style) => ({ ...style, decimals: Math.min(6, (style.decimals ?? 2) + 1) }))
              }
            >
              .00
            </RibbonBtn>
            <RibbonBtn
              label="Fewer decimals"
              onClick={() =>
                patchStyles((style) => ({ ...style, decimals: Math.max(0, (style.decimals ?? 2) - 1) }))
              }
            >
              .0
            </RibbonBtn>
          </RibbonGroup>
          <RibbonGroup label="Styles">
            <RibbonBtn label="Highlight empties" active={highlightEmpty} onClick={() => setHighlightEmpty((value) => !value)}>
              <Highlighter size={14} />
            </RibbonBtn>
            <RibbonBtn label="Format as table" active={tableOn} onClick={() => setTableOn((value) => !value)}>
              <PaintBucket size={14} />
            </RibbonBtn>
            {(["normal", "heading", "input", "good", "bad", "neutral"] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                title={preset}
                onClick={() => patchStyles((style) => ({ ...style, preset: preset === "normal" ? undefined : preset }))}
                className="rounded-sm px-1.5 py-0.5 text-[10px] capitalize hover:bg-background"
              >
                {preset}
              </button>
            ))}
          </RibbonGroup>
          <RibbonGroup label="Cells">
            <RibbonBtn label="Insert row" onClick={insertRow}>
              <Plus size={14} />
            </RibbonBtn>
            <RibbonBtn label="Delete rows" onClick={deleteRows}>
              <Trash2 size={14} />
            </RibbonBtn>
            <RibbonBtn label="Clear" onClick={() => clearCells("all")}>
              <Eraser size={14} />
            </RibbonBtn>
          </RibbonGroup>
          <RibbonGroup label="Editing">
            <RibbonBtn label="AutoSum" onClick={autoSum}>
              <Sigma size={14} />
            </RibbonBtn>
            <RibbonBtn label="Sort A to Z" onClick={() => sortColumn("asc")}>
              <ListFilter size={14} />
            </RibbonBtn>
            <RibbonBtn label="Sort Z to A" onClick={() => sortColumn("desc")}>
              <Filter size={14} />
            </RibbonBtn>
            <RibbonBtn label="Flagged rows only" active={filterFlagged} onClick={() => setFilterFlagged((value) => !value)}>
              <Search size={14} />
            </RibbonBtn>
            <input
              value={columnFilter}
              onChange={(event) => setColumnFilter(event.target.value)}
              placeholder="Filter"
              className="h-7 w-24 rounded-sm border border-border px-1.5 text-xs"
            />
            <input
              value={find}
              onChange={(event) => {
                setFind(event.target.value);
                setFindIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  jumpFind(1);
                }
              }}
              placeholder="Find"
              className="h-7 w-24 rounded-sm border border-border px-1.5 text-xs"
            />
          </RibbonGroup>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-sm">
        <span className="w-16 shrink-0 text-xs font-medium text-muted">
          {activeHeader ? `${selected.row + 2}${String.fromCharCode(65 + (selected.col % 26))}` : ""}
        </span>
        <Type size={14} className="text-muted" />
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              commitValue(selected.row, activeHeader, draft);
              setEditing(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") setEditing(false);
            }}
            className="h-7 flex-1 rounded-sm border border-navy px-2 text-sm outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(activeValue);
              setEditing(true);
            }}
            className="h-7 flex-1 truncate rounded-sm border border-border bg-white px-2 text-left text-sm"
          >
            {activeValue || " "}
          </button>
        )}
      </div>

      {saveError ? <p className="px-4 py-2 text-sm text-rag-red">{saveError}</p> : null}
      {activeIssue ? (
        <p className="px-4 py-1 text-xs text-rag-red">
          {activeIssue.field} {activeIssue.message}
        </p>
      ) : issues.length > 0 ? (
        <p className="px-4 py-1 text-xs text-rag-red">
          {stillFailing.size} row{stillFailing.size === 1 ? "" : "s"} still fail validation. Fix the
          highlighted cells before saving.
        </p>
      ) : null}

      <div
        ref={gridRef}
        tabIndex={0}
        onKeyDown={onGridKey}
        className="min-h-0 flex-1 overflow-auto outline-none"
      >
        <table className="w-max min-w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 border border-border bg-[#eee] px-2 py-1 text-[10px] text-muted">
                #
              </th>
              {headers.map((header, col) => (
                <th
                  key={header}
                  onClick={(event) => selectCell(selected.row, col, event.shiftKey)}
                  className={`min-w-[8.5rem] border border-border px-2 py-1 text-xs font-semibold ${
                    tableOn ? "bg-navy text-white" : "bg-[#eee] text-foreground"
                  }`}
                >
                  {header}
                  {reverseMapping.get(header) ? (
                    <span className="ml-1 block text-[10px] font-normal opacity-80">
                      → {reverseMapping.get(header)}
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleIndexes.map((row, visual) => {
              const rowOk = !stillFailing.has(`r${row}`);
              return (
                <tr key={`r${row}`}>
                  <td className="sticky left-0 z-10 border border-border bg-[#f8f8f8] px-2 py-1 text-[10px] text-muted">
                    {visual + 1}
                  </td>
                  {headers.map((header, col) => {
                    const field = reverseMapping.get(header);
                    const issue = field ? issueIndex.get(`r${row}:${field}`) : undefined;
                    const live =
                      editing && selected.row === row && selected.col === col && field
                        ? checkField(field, draft)
                        : issue;
                    const value = rows[row]?.[header] ?? "";
                    const style = styles[styleKey(row, header)];
                    const selectedCell = inSelection(selection, row, col);
                    const empty = highlightEmpty && value === "";
                    const zebra = tableOn && visual % 2 === 1 ? "#f7f8fa" : undefined;
                    return (
                      <td
                        key={header}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          gridRef.current?.focus();
                          selectCell(row, col, event.shiftKey);
                        }}
                        onDoubleClick={() => {
                          setSelection({ row, col, rowEnd: row, colEnd: col });
                          setDraft(value);
                          setEditing(true);
                        }}
                        className={`min-w-[8.5rem] border px-0 py-0 ${
                          style?.border || tableOn ? "border-border" : "border-border/60"
                        } ${selectedCell ? "outline outline-2 outline-navy -outline-offset-1" : ""}`}
                        style={{
                          backgroundColor: live
                            ? "var(--rag-red-bg)"
                            : empty
                              ? "var(--rag-amber-bg)"
                              : cellCss(style).backgroundColor ?? zebra,
                        }}
                      >
                        {editing && selected.row === row && selected.col === col ? (
                          <input
                            autoFocus
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onBlur={() => {
                              commitValue(row, header, draft);
                              setEditing(false);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") event.currentTarget.blur();
                              if (event.key === "Escape") setEditing(false);
                            }}
                            className="h-8 w-full bg-white px-2 text-sm outline-none"
                          />
                        ) : (
                          <div
                            className="flex h-8 items-center px-2"
                            style={cellCss(style)}
                          >
                            <span className="truncate">
                              {displayValue(value, style) || (live ? "" : "")}
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="w-6 border border-transparent px-1 text-rag-green">
                    {rowOk ? "✓" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-[#f3f2f1] px-3 py-1 text-[11px] text-muted">
        <span>Ready · {headers.length} columns from this file · {rows.length} rows</span>
        <span>{matches.length > 0 ? `${matches.length} find matches` : `${visibleIndexes.length} rows shown`}</span>
      </div>
    </div>
  );
}
