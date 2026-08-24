import { downloadBlob, exportStamp, fileSafe } from "@/lib/download-file";
import {
  formatExportNumber,
  formatExportPct,
  type ExportModel,
} from "@/lib/export-model";

const NAVY = "1B365D";
const GREEN = "5B8A72";
const RED = "C45C5C";
const AMBER = "C4923A";

function baseName(model: ExportModel): string {
  return `${fileSafe(model.filename)}-${fileSafe(model.kindLabel)}-${exportStamp()}`;
}

function outcomeColor(model: ExportModel): string {
  if (model.outcome.kind === "profit") return GREEN;
  if (model.outcome.kind === "loss") return RED;
  return AMBER;
}

export async function downloadExcelReport(model: ExportModel): Promise<void> {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  const report = [
    ["Northstar Financial export"],
    [model.filename],
    [model.kindLabel, model.dateRangeLabel, model.categoryLabel],
    [],
    ["Result", model.outcome.kind.toUpperCase()],
    ["Percent", formatExportPct(model.outcome.percent)],
    ["Amount", formatExportNumber(model.outcome.amount)],
    ["Basis", model.outcome.basis],
    ["Headline", model.outcome.headline],
    [],
    ["Scale band", model.scale.band],
    ["Value unit", model.scale.unit],
    ["Typical magnitude", formatExportNumber(model.scale.typicalMagnitude)],
    ["Scale", model.scale.summary],
    [],
    ["AI outlook", model.insight.outlook],
    ["Predicted next-period move", model.insight.nextPeriodPct == null ? "n/a" : formatExportPct(model.insight.nextPeriodPct)],
    ["Predictive analysis", model.insight.prediction],
    ...model.insight.drivers.map((driver, index) => [`Driver ${index + 1}`, driver]),
    [],
    ["Forecast", model.forecast.localNarrative],
    ["Rows in export", model.rowCount],
    ["Rows in file", model.fileRowCount],
    ["Columns", model.columnCount],
    ...(model.analysis
      ? [
          [],
          ["Analysis sheet", model.analysis.sheetName],
          ["Visual", model.analysis.visual],
          ["View", model.analysis.title],
          ["Columns field", model.analysis.columns ?? ""],
          ["Values field", model.analysis.values ?? ""],
          ["Color field", model.analysis.color ?? ""],
          ["Filter", model.analysis.filter],
          ["Aggregation", model.analysis.agg],
          ["Note", model.analysis.note],
        ]
      : []),
  ];
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(report), "Report");

  const moves = [
    ["Period", "Previous", "Current", "Change", "Percent", "Direction"],
    ...model.movements.map((item) => [
      item.label,
      item.previous,
      item.current,
      item.change,
      item.changePct,
      item.direction,
    ]),
  ];
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(moves), "Ups and downs");

  if (model.analysis && model.analysis.viewRows.length > 0) {
    const analysisSheet = XLSX.utils.json_to_sheet(model.analysis.viewRows, {
      header: model.analysis.viewHeaders,
      skipHeader: false,
    });
    XLSX.utils.book_append_sheet(book, analysisSheet, "Analysis view");
  }

  const dataSheet = XLSX.utils.json_to_sheet(model.allRows, {
    header: model.headers,
    skipHeader: false,
  });
  XLSX.utils.book_append_sheet(book, dataSheet, "Data");

  const output = XLSX.write(book, {
    bookType: "xlsx",
    type: "array",
    compression: false,
  }) as ArrayBuffer;
  downloadBlob(
    new Blob([new Uint8Array(output)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${baseName(model)}.xlsx`,
  );
}

export async function downloadPptReport(model: ExportModel): Promise<void> {
  const mod = await import("pptxgenjs");
  const PptxGenJS = mod.default;
  const pptx = new PptxGenJS();
  pptx.author = "Northstar Financial";
  pptx.title = `${model.filename} export`;
  pptx.subject = model.outcome.headline;

  const title = pptx.addSlide();
  title.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 5.63, fill: { color: NAVY } });
  title.addText("EXPORT REPORT", {
    x: 0.5,
    y: 1.1,
    w: 9,
    h: 0.4,
    color: "FFFFFF",
    fontSize: 12,
    fontFace: "Calibri",
  });
  title.addText(model.filename, {
    x: 0.5,
    y: 1.6,
    w: 9,
    h: 0.8,
    color: "FFFFFF",
    fontSize: 28,
    fontFace: "Calibri",
    bold: true,
  });
  title.addText(`${model.kindLabel} · ${model.dateRangeLabel} · ${model.categoryLabel}`, {
    x: 0.5,
    y: 2.5,
    w: 9,
    h: 0.4,
    color: "D7E1EC",
    fontSize: 14,
    fontFace: "Calibri",
  });
  title.addText(model.scale.summary, {
    x: 0.5,
    y: 3.3,
    w: 9,
    h: 1.4,
    color: "FFFFFF",
    fontSize: 14,
    fontFace: "Calibri",
  });

  const result = pptx.addSlide();
  result.addText("Profit or loss", { x: 0.5, y: 0.3, w: 9, h: 0.4, color: NAVY, fontSize: 14, bold: true });
  result.addText(model.outcome.kind.toUpperCase(), {
    x: 0.5,
    y: 0.8,
    w: 9,
    h: 0.7,
    color: outcomeColor(model),
    fontSize: 36,
    bold: true,
  });
  result.addText(formatExportPct(model.outcome.percent), {
    x: 0.5,
    y: 1.5,
    w: 9,
    h: 0.5,
    color: NAVY,
    fontSize: 22,
  });
  result.addText(`${model.outcome.headline}\n${model.outcome.basis}\nAmount ${formatExportNumber(model.outcome.amount)} on a ${model.scale.unit} scale.`, {
    x: 0.5,
    y: 2.2,
    w: 9,
    h: 1.5,
    color: "334155",
    fontSize: 14,
  });
  result.addText(model.scale.summary, {
    x: 0.5,
    y: 3.9,
    w: 9,
    h: 1.2,
    color: "64748B",
    fontSize: 12,
  });

  const moves = pptx.addSlide();
  moves.addText("Ups and downs", { x: 0.5, y: 0.25, w: 9, h: 0.35, color: NAVY, fontSize: 16, bold: true });
  moves.addTable(
    [
      [
        { text: "Period", options: { fill: { color: NAVY }, color: "FFFFFF", bold: true } },
        { text: "Previous", options: { fill: { color: NAVY }, color: "FFFFFF", bold: true } },
        { text: "Current", options: { fill: { color: NAVY }, color: "FFFFFF", bold: true } },
        { text: "Change", options: { fill: { color: NAVY }, color: "FFFFFF", bold: true } },
        { text: "%", options: { fill: { color: NAVY }, color: "FFFFFF", bold: true } },
        { text: "Direction", options: { fill: { color: NAVY }, color: "FFFFFF", bold: true } },
      ],
      ...[...model.ups.slice(0, 4), ...model.downs.slice(0, 4)].map((item) => [
        { text: item.label },
        { text: formatExportNumber(item.previous) },
        { text: formatExportNumber(item.current) },
        { text: formatExportNumber(item.change) },
        { text: formatExportPct(item.changePct) },
        {
          text: item.direction.toUpperCase(),
          options: { color: item.direction === "up" ? GREEN : item.direction === "down" ? RED : AMBER, bold: true },
        },
      ]),
    ],
    { x: 0.4, y: 0.7, w: 9.2, colW: [1.8, 1.5, 1.5, 1.4, 1.2, 1.8], fontSize: 11, border: { color: "E2E8F0" } },
  );

  const predict = pptx.addSlide();
  predict.addText("Predictive analysis (AI)", {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.4,
    color: NAVY,
    fontSize: 16,
    bold: true,
  });
  predict.addText(`Outlook: ${model.insight.outlook}`, {
    x: 0.5,
    y: 0.8,
    w: 9,
    h: 0.35,
    color: outcomeColor(model),
    fontSize: 16,
    bold: true,
  });
  predict.addText(model.insight.prediction, {
    x: 0.5,
    y: 1.3,
    w: 9,
    h: 2.2,
    color: "1E293B",
    fontSize: 14,
  });
  predict.addText(model.insight.drivers.map((driver) => `• ${driver}`).join("\n"), {
    x: 0.5,
    y: 3.6,
    w: 9,
    h: 1.6,
    color: "475569",
    fontSize: 12,
  });

  if (model.analysis && model.analysis.viewRows.length > 0) {
    const analysis = pptx.addSlide();
    analysis.addText(model.analysis.sheetName, {
      x: 0.5,
      y: 0.25,
      w: 9,
      h: 0.3,
      color: NAVY,
      fontSize: 16,
      bold: true,
    });
    analysis.addText(model.analysis.title, {
      x: 0.5,
      y: 0.55,
      w: 9,
      h: 0.3,
      color: "64748B",
      fontSize: 12,
    });
    const labels = model.analysis.viewRows.map((row) => row.Category || "");
    const values = model.analysis.viewRows.map((row) => Number(row.Total ?? 0));
    if (labels.length >= 2 && values.some((value) => Number.isFinite(value))) {
      analysis.addChart(pptx.ChartType.bar, [
        { name: model.analysis.values || "Value", labels, values },
      ], { x: 0.4, y: 0.95, w: 9.2, h: 2.6, showValue: true });
    }
    analysis.addTable(
      [
        [
          { text: "Category", options: { fill: { color: NAVY }, color: "FFFFFF", bold: true } },
          { text: "Total", options: { fill: { color: NAVY }, color: "FFFFFF", bold: true } },
        ],
        ...model.analysis.viewRows.slice(0, 10).map((row) => [
          { text: row.Category || "" },
          { text: formatExportNumber(Number(row.Total ?? 0)) },
        ]),
      ],
      { x: 0.4, y: 3.65, w: 9.2, colW: [6.2, 3], fontSize: 11, border: { color: "E2E8F0" } },
    );
  }

  const blob = (await pptx.write({ outputType: "blob" })) as Blob;
  downloadBlob(
    blob,
    `${baseName(model)}.pptx`,
  );
}

export async function downloadPdfReport(model: ExportModel): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 40;
  let y = 48;

  const write = (text: string, options?: { size?: number; color?: string; bold?: boolean; gap?: number }) => {
    pdf.setFont("helvetica", options?.bold ? "bold" : "normal");
    pdf.setFontSize(options?.size ?? 11);
    const color = options?.color ?? "1E293B";
    const r = Number.parseInt(color.slice(0, 2), 16);
    const g = Number.parseInt(color.slice(2, 4), 16);
    const b = Number.parseInt(color.slice(4, 6), 16);
    pdf.setTextColor(r, g, b);
    const lines = pdf.splitTextToSize(text, pageWidth - margin * 2) as string[];
    for (const line of lines) {
      if (y > 760) {
        pdf.addPage();
        y = 48;
      }
      pdf.text(line, margin, y);
      y += (options?.size ?? 11) + 4;
    }
    y += options?.gap ?? 6;
  };

  write("NORTHSTAR FINANCIAL EXPORT", { size: 10, color: NAVY, bold: true, gap: 2 });
  write(model.filename, { size: 18, color: NAVY, bold: true, gap: 4 });
  write(`${model.kindLabel} · ${model.dateRangeLabel} · ${model.categoryLabel}`, { size: 11, color: "64748B" });
  write(model.outcome.kind.toUpperCase(), { size: 28, color: outcomeColor(model), bold: true, gap: 2 });
  write(`${formatExportPct(model.outcome.percent)} · ${formatExportNumber(model.outcome.amount)}`, {
    size: 16,
    color: NAVY,
    bold: true,
  });
  write(model.outcome.headline, { size: 12, bold: true });
  write(`Basis: ${model.outcome.basis}`);
  write(model.scale.summary, { color: "334155" });

  write("Ups", { size: 14, color: GREEN, bold: true, gap: 4 });
  if (model.ups.length === 0) {
    write("No upward periods in this window.");
  } else {
    for (const item of model.ups.slice(0, 8)) {
      write(
        `${item.label}: ${formatExportNumber(item.previous)} → ${formatExportNumber(item.current)} (${formatExportPct(item.changePct)}) UP`,
        { color: GREEN },
      );
    }
  }

  write("Downs", { size: 14, color: RED, bold: true, gap: 4 });
  if (model.downs.length === 0) {
    write("No downward periods in this window.");
  } else {
    for (const item of model.downs.slice(0, 8)) {
      write(
        `${item.label}: ${formatExportNumber(item.previous)} → ${formatExportNumber(item.current)} (${formatExportPct(item.changePct)}) DOWN`,
        { color: RED },
      );
    }
  }

  write("Predictive analysis (AI)", { size: 14, color: NAVY, bold: true });
  write(`Outlook: ${model.insight.outlook}`, { size: 12, bold: true, color: outcomeColor(model) });
  write(model.insight.prediction);
  for (const driver of model.insight.drivers) write(`• ${driver}`, { color: "475569" });
  write(model.forecast.localNarrative, { color: "64748B" });

  if (model.analysis) {
    write("Analysis view", { size: 14, color: NAVY, bold: true });
    write(`${model.analysis.sheetName} · ${model.analysis.visual} · ${model.analysis.agg}`);
    write(model.analysis.title, { bold: true });
    write(
      `Columns ${model.analysis.columns ?? "—"} · Values ${model.analysis.values ?? "—"} · Color ${model.analysis.color ?? "—"} · Filter ${model.analysis.filter}`,
    );
    if (model.analysis.note) write(model.analysis.note);
    write(model.analysis.viewHeaders.join(" | "), { size: 8, bold: true, color: NAVY, gap: 2 });
    for (const row of model.analysis.viewRows.slice(0, 20)) {
      write(
        model.analysis.viewHeaders.map((header) => row[header] ?? "").join(" | "),
        { size: 8, color: "334155", gap: 1 },
      );
    }
  }

  write("Data snapshot", { size: 14, color: NAVY, bold: true });
  write(model.headers.join(" | "), { size: 8, bold: true, color: NAVY, gap: 2 });
  for (const row of model.previewRows) {
    write(model.headers.map((header) => row[header] ?? "").join(" | "), { size: 8, color: "334155", gap: 1 });
  }

  downloadBlob(pdf.output("blob"), `${baseName(model)}.pdf`);
}
