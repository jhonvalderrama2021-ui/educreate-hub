import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, BorderStyle, ImageRun, Header, PageBreak, Table, TableRow, TableCell, WidthType, ShadingType, VerticalAlign } from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

export interface ExportOptions {
  /** data URL or remote URL of a logo, placed top-right of every page */
  logoDataUrl?: string;
  /** data URL or remote URL of a watermark image, centered behind content */
  watermarkDataUrl?: string;
  /** 0..1, default 0.12 */
  watermarkOpacity?: number;
}

// ---------- helpers ----------
async function urlToDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function dataUrlToUint8(dataUrl: string): { bytes: Uint8Array; type: "png" | "jpg" | "gif" } {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|gif);base64,(.+)$/i);
  if (!match) throw new Error("Imagen inválida");
  const ext = match[1].toLowerCase();
  const type: "png" | "jpg" | "gif" = ext === "jpeg" || ext === "jpg" ? "jpg" : (ext as "png" | "gif");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, type };
}

async function getImageDims(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = dataUrl;
  });
}

// ---------- DOCX ----------
export async function exportToDocx(
  title: string,
  resourceType: string,
  content: any,
  options: ExportOptions = {},
) {
  const logoData = options.logoDataUrl ? await urlToDataUrl(options.logoDataUrl) : undefined;
  const watermarkData = options.watermarkDataUrl ? await urlToDataUrl(options.watermarkDataUrl) : undefined;

  const headerChildren: Paragraph[] = [];

  // Watermark behind the page (centered, faded) using floating image
  if (watermarkData) {
    const { bytes, type } = dataUrlToUint8(watermarkData);
    const wmDims = await getImageDims(watermarkData);
    const wmWidth = 400;
    const wmHeight = (wmDims.h / wmDims.w) * wmWidth;
    headerChildren.push(
      new Paragraph({
        children: [
          new ImageRun({
            type,
            data: bytes,
            transformation: { width: wmWidth, height: wmHeight },
            floating: {
              horizontalPosition: {
                relative: "page",
                align: "center",
              },
              verticalPosition: {
                relative: "page",
                align: "center",
              },
              behindDocument: true,
            },
          } as any),
        ],
      }),
    );
  }

  if (logoData) {
    const { bytes, type } = dataUrlToUint8(logoData);
    headerChildren.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new ImageRun({
            type,
            data: bytes,
            transformation: { width: 80, height: 80 },
          } as any),
        ],
      }),
    );
  }

  const children = await buildDocxContent(title, resourceType, content);

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 24 } } },
    },
    sections: [
      {
        headers: headerChildren.length ? { default: new Header({ children: headerChildren }) } : undefined,
        children: children as any,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${sanitizeFilename(title)}.docx`);
}

// ---------- PDF ----------
export async function exportToPdf(
  title: string,
  resourceType: string,
  content: any,
  options: ExportOptions = {},
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  const logoData = options.logoDataUrl ? await urlToDataUrl(options.logoDataUrl) : undefined;
  const watermarkData = options.watermarkDataUrl ? await urlToDataUrl(options.watermarkDataUrl) : undefined;
  const watermarkOpacity = options.watermarkOpacity ?? 0.12;

  let logoDims: { w: number; h: number } | undefined;
  let watermarkDims: { w: number; h: number } | undefined;
  if (logoData) logoDims = await getImageDims(logoData);
  if (watermarkData) watermarkDims = await getImageDims(watermarkData);

  const decorate = () => {
    // Watermark first (background)
    if (watermarkData && watermarkDims) {
      const targetW = pageWidth * 0.6;
      const targetH = (watermarkDims.h / watermarkDims.w) * targetW;
      const x = (pageWidth - targetW) / 2;
      const yy = (pageHeight - targetH) / 2;
      const gState = (doc as any).GState ? new (doc as any).GState({ opacity: watermarkOpacity }) : null;
      if (gState && (doc as any).setGState) (doc as any).setGState(gState);
      try {
        doc.addImage(watermarkData, "PNG", x, yy, targetW, targetH, undefined, "FAST");
      } catch {/* ignore */}
      if (gState && (doc as any).setGState) (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));
    }
    // Logo top-right
    if (logoData && logoDims) {
      const targetW = 25;
      const targetH = (logoDims.h / logoDims.w) * targetW;
      try {
        doc.addImage(logoData, "PNG", pageWidth - margin - targetW, 8, targetW, targetH, undefined, "FAST");
      } catch {/* ignore */}
    }
  };

  decorate();
  // top offset to avoid logo overlap
  const topOffset = logoData ? 30 : 20;
  y = topOffset;

  const newPage = () => {
    doc.addPage();
    decorate();
    y = topOffset;
  };

  const addText = (text: string, size: number, bold = false, indent = 0) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, maxWidth - indent);
    for (const line of lines) {
      if (y > pageHeight - 20) newPage();
      doc.text(line, margin + indent, y);
      y += size * 0.5;
    }
    y += 2;
  };

  addText(title, 18, true);
  if (content.subject) addText(`Área: ${content.subject}`, 11);

  // Student name + date fields for exam-type resources
  if (["icfes", "quiz", "true_false", "mixed"].includes(resourceType)) {
    y += 4;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const lineY = y;
    doc.text("Nombre:", margin, lineY);
    doc.line(margin + 18, lineY + 1, margin + maxWidth * 0.55, lineY + 1);
    doc.text("Fecha:", margin + maxWidth * 0.6, lineY);
    doc.line(margin + maxWidth * 0.6 + 14, lineY + 1, margin + maxWidth, lineY + 1);
    y += 8;
  }
  y += 5;

  switch (resourceType) {
    case "icfes":
    case "quiz":
    case "true_false":
    case "mixed":
      // ---- Questions only (no answers inline) ----
      content.questions?.forEach((q: any, idx: number) => {
        const num = q.number || idx + 1;
        addText(`${num}. ${q.question}`, 11, true);
        if (q.context) addText(q.context, 10, false, 5);
        if (q.options) {
          if (Array.isArray(q.options)) {
            q.options.forEach((opt: string, i: number) => addText(`  ${String.fromCharCode(65 + i)}. ${opt}`, 10, false, 10));
          } else {
            Object.entries(q.options).forEach(([k, v]) => addText(`  ${k}. ${v}`, 10, false, 10));
          }
        } else if (q.type === "true_false") {
          // Draw two checkbox squares: ☐ Verdadero  ☐ Falso
          if (y > pageHeight - 20) newPage();
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          const baseX = margin + 10;
          const boxSize = 3.2;
          const boxY = y - boxSize + 0.5;
          doc.setLineWidth(0.3);
          doc.rect(baseX, boxY, boxSize, boxSize);
          doc.text("Verdadero", baseX + boxSize + 2, y);
          const falseX = baseX + 35;
          doc.rect(falseX, boxY, boxSize, boxSize);
          doc.text("Falso", falseX + boxSize + 2, y);
          y += 6;
        }
        y += 3;
      });

      // ---- Answer sheet on its own page (teacher only) ----
      if (content.questions?.length) {
        // Only break to new page if there isn't enough room left
        if (y > topOffset + 20) newPage();
        addText("HOJA DE RESPUESTAS — USO DEL DOCENTE", 14, true);
        y += 4;
        const cols = 4;
        const colWidth = maxWidth / cols;
        let col = 0;
        const startY = y;
        let rowY = y;
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        content.questions.forEach((q: any, idx: number) => {
          const num = q.number || idx + 1;
          if (rowY > pageHeight - 20) {
            newPage();
            rowY = y;
            col = 0;
          }
          const x = margin + col * colWidth;
          doc.text(`${num}. ${q.correct ?? "—"}`, x, rowY);
          col++;
          if (col >= cols) { col = 0; rowY += 8; }
        });
        y = rowY + 12;
        const hasExplanations = content.questions.some((q: any) => q.explanation);
        if (hasExplanations) {
          if (y > pageHeight - 40) newPage();
          addText("Explicaciones", 12, true);
          content.questions.forEach((q: any, idx: number) => {
            if (!q.explanation) return;
            addText(`${q.number || idx + 1}. ${q.explanation}`, 9, false, 5);
          });
        }
      }
      break;

    case "workshop":
      if (content.objective) addText(`Objetivo: ${content.objective}`, 11);
      if (content.duration) addText(`Duración: ${content.duration}`, 10);
      if (content.materials?.length) addText(`Materiales: ${content.materials.join(", ")}`, 10);
      y += 3;
      content.activities?.forEach((a: any) => {
        addText(`Actividad ${a.number}: ${a.title}`, 12, true);
        addText(a.description, 10, false, 5);
        if (a.instructions) addText(`Instrucciones: ${a.instructions}`, 10, false, 5);
        if (a.duration) addText(`Duración: ${a.duration}`, 9, false, 5);
        y += 3;
      });
      if (content.evaluation) { addText("Evaluación", 12, true); addText(content.evaluation, 10); }
      break;

    case "guide":
      if (content.introduction) addText(content.introduction, 10);
      if (content.objectives?.length) {
        addText("Objetivos:", 11, true);
        content.objectives.forEach((o: string) => addText(`• ${o}`, 10, false, 5));
      }
      y += 3;
      content.sections?.forEach((s: any) => {
        addText(`${s.number}. ${s.title}`, 12, true);
        addText(s.content, 10, false, 5);
        if (s.examples?.length) {
          addText("Ejemplos:", 10, true, 5);
          s.examples.forEach((e: string) => addText(`• ${e}`, 9, false, 10));
        }
        y += 3;
      });
      if (content.summary) { addText("Resumen", 12, true); addText(content.summary, 10); }
      break;

    case "lesson_plan":
      if (content.grade) addText(`Grado: ${content.grade}`, 10);
      if (content.duration) addText(`Duración: ${content.duration}`, 10);
      if (content.objective) addText(`Objetivo: ${content.objective}`, 10);
      y += 3;
      content.phases?.forEach((p: any) => {
        addText(`${p.name} (${p.duration})`, 12, true);
        addText(p.activities, 10, false, 5);
        if (p.resources) addText(`Recursos: ${p.resources}`, 9, false, 5);
        y += 3;
      });
      if (content.evaluation) { addText("Evaluación", 12, true); addText(content.evaluation, 10); }
      break;

    case "rubric":
      if (content.objective) addText(`Objetivo: ${content.objective}`, 10);
      y += 3;
      content.criteria?.forEach((c: any) => {
        addText(c.name, 12, true);
        Object.entries(c.descriptions || {}).forEach(([level, desc]) => {
          addText(`${level}: ${desc}`, 10, false, 5);
        });
        if (c.weight) addText(`Peso: ${c.weight}%`, 9, false, 5);
        y += 3;
      });
      break;

    case "crossword": {
      // Render crossword grid
      const rows: number = content.rows;
      const cols: number = content.cols;
      const grid: string[][] = content.grid;
      const numbered: { row: number; col: number; n: number }[] = content.numbered || [];
      const cellSize = Math.min(10, (maxWidth - 4) / cols);
      const gridStartX = margin + (maxWidth - cellSize * cols) / 2;
      let gridStartY = y;
      const gridHeight = cellSize * rows;
      if (gridStartY + gridHeight > pageHeight - 20) {
        newPage();
        gridStartY = y;
      }

      const numMap = new Map<string, number>();
      numbered.forEach((n) => numMap.set(`${n.row}-${n.col}`, n.n));

      doc.setLineWidth(0.3);
      doc.setDrawColor(0);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = gridStartX + c * cellSize;
          const yy = gridStartY + r * cellSize;
          const letter = grid[r][c];
          if (!letter) continue; // skip empty cells — no black background
          // White cell with border
          doc.setFillColor(255, 255, 255);
          doc.rect(x, yy, cellSize, cellSize, "FD");
          const num = numMap.get(`${r}-${c}`);
          if (num !== undefined) {
            doc.setFontSize(Math.max(4, cellSize * 0.3));
            doc.setFont("helvetica", "normal");
            doc.setTextColor(0);
            doc.text(String(num), x + 0.5, yy + cellSize * 0.32);
          }
        }
      }
      y = gridStartY + gridHeight + 6;

      // Clues
      const drawClues = (heading: string, list: any[]) => {
        if (y > pageHeight - 30) newPage();
        addText(heading, 12, true);
        list.forEach((c) => addText(`${c.number}. ${c.clue}`, 9, false, 4));
        y += 2;
      };
      drawClues("Horizontales", content.across || []);
      drawClues("Verticales", content.down || []);

      // Solution sheet on its own page
      newPage();
      addText("SOLUCIÓN — USO DEL DOCENTE", 14, true);
      y += 2;
      let sgY = y;
      if (sgY + gridHeight > pageHeight - 20) { newPage(); sgY = y; }
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = gridStartX + c * cellSize;
          const yy = sgY + r * cellSize;
          const letter = grid[r][c];
          if (!letter) continue;
          doc.setDrawColor(0);
          doc.setFillColor(255, 255, 255);
          doc.rect(x, yy, cellSize, cellSize, "FD");
          doc.setFontSize(Math.max(5, cellSize * 0.55));
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0);
          doc.text(letter, x + cellSize / 2, yy + cellSize * 0.7, { align: "center" });
        }
      }
      y = sgY + gridHeight + 6;
      break;
    }

    case "story": {
      // Cover image
      if (content.coverImageUrl) {
        try {
          const cover = await urlToDataUrl(content.coverImageUrl);
          const dims = await getImageDims(cover);
          const w = maxWidth * 0.85;
          const h = (dims.h / dims.w) * w;
          if (y + h > pageHeight - 20) newPage();
          doc.addImage(cover, "PNG", margin + (maxWidth - w) / 2, y, w, h, undefined, "FAST");
          y += h + 5;
        } catch { /* ignore */ }
      }
      if (content.character) {
        addText(`Protagonista: ${content.character}${content.characterType ? ` (${content.characterType})` : ""}`, 10, false);
        y += 2;
      }
      for (let i = 0; i < (content.chapters || []).length; i++) {
        const ch = content.chapters[i];
        if (y > pageHeight - 40) newPage();
        addText(`${i + 1}. ${ch.title}`, 13, true);
        if (ch.imageUrl) {
          try {
            const img = await urlToDataUrl(ch.imageUrl);
            const dims = await getImageDims(img);
            const w = maxWidth * 0.7;
            const h = (dims.h / dims.w) * w;
            if (y + h > pageHeight - 20) newPage();
            doc.addImage(img, "PNG", margin + (maxWidth - w) / 2, y, w, h, undefined, "FAST");
            y += h + 4;
          } catch { /* ignore */ }
        }
        addText(ch.text, 11, false);
        y += 4;
      }
      if (content.moral) {
        if (y > pageHeight - 30) newPage();
        addText("Moraleja", 12, true);
        addText(content.moral, 11, false);
      }
      break;
    }
  }

  doc.save(`${sanitizeFilename(title)}.pdf`);
}

async function buildDocxContent(title: string, resourceType: string, content: any): Promise<(Paragraph | Table)[]> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: title, bold: true })] }),
  ];

  if (content.subject) {
    children.push(new Paragraph({ children: [new TextRun({ text: `Área: ${content.subject}`, italics: true, size: 22 })] }));
  }

  // Student name + date for exam-type resources
  if (["icfes", "quiz", "true_false", "mixed"].includes(resourceType)) {
    children.push(new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({ text: "Nombre: ", bold: true }),
        new TextRun({ text: "______________________________________     " }),
        new TextRun({ text: "Fecha: ", bold: true }),
        new TextRun({ text: "____________________" }),
      ],
    }));
  }

  children.push(new Paragraph({ children: [] }));

  switch (resourceType) {
    case "icfes":
    case "quiz":
    case "true_false":
    case "mixed":
      // Questions WITHOUT inline answers
      content.questions?.forEach((q: any, idx: number) => {
        const num = q.number || idx + 1;
        children.push(new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({ text: `${num}. ${q.question}`, bold: true })],
        }));
        if (q.context) {
          children.push(new Paragraph({ children: [new TextRun({ text: q.context, italics: true, size: 20 })] }));
        }
        if (q.options) {
          if (Array.isArray(q.options)) {
            q.options.forEach((opt: string, i: number) => {
              children.push(new Paragraph({
                indent: { left: 400 },
                children: [new TextRun({ text: `${String.fromCharCode(65 + i)}. ${opt}` })],
              }));
            });
          } else {
            Object.entries(q.options).forEach(([k, v]) => {
              children.push(new Paragraph({
                indent: { left: 400 },
                children: [new TextRun({ text: `${k}. ${v}` })],
              }));
            });
          }
        } else if (q.type === "true_false") {
          children.push(new Paragraph({
            indent: { left: 400 },
            children: [new TextRun({ text: "☐ Verdadero    ☐ Falso" })],
          }));
        }
      });

      // Answer sheet on its own page
      if (content.questions?.length) {
        children.push(new Paragraph({ children: [new PageBreak()] }));
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Hoja de respuestas — Uso del docente", bold: true })],
        }));
        children.push(new Paragraph({ children: [] }));
        // 4 per line
        const perLine = 4;
        for (let i = 0; i < content.questions.length; i += perLine) {
          const chunk = content.questions.slice(i, i + perLine);
          const text = chunk
            .map((q: any, j: number) => `${q.number || i + j + 1}. ${q.correct ?? "—"}`)
            .join("    ");
          children.push(new Paragraph({ children: [new TextRun({ text, bold: true })] }));
        }
        const hasExplanations = content.questions.some((q: any) => q.explanation);
        if (hasExplanations) {
          children.push(new Paragraph({ children: [] }));
          children.push(new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "Explicaciones" })],
          }));
          content.questions.forEach((q: any, idx: number) => {
            if (!q.explanation) return;
            children.push(new Paragraph({
              children: [
                new TextRun({ text: `${q.number || idx + 1}. `, bold: true }),
                new TextRun({ text: q.explanation, italics: true, size: 20 }),
              ],
            }));
          });
        }
      }
      break;

    case "workshop":
      if (content.objective) children.push(new Paragraph({ children: [new TextRun({ text: `Objetivo: ${content.objective}` })] }));
      if (content.duration) children.push(new Paragraph({ children: [new TextRun({ text: `Duración: ${content.duration}` })] }));
      children.push(new Paragraph({ children: [] }));
      content.activities?.forEach((a: any) => {
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: `Actividad ${a.number}: ${a.title}` })],
        }));
        children.push(new Paragraph({ children: [new TextRun(a.description)] }));
        if (a.instructions) children.push(new Paragraph({ children: [new TextRun({ text: `Instrucciones: ${a.instructions}`, italics: true })] }));
      });
      break;

    case "guide":
      if (content.introduction) children.push(new Paragraph({ children: [new TextRun(content.introduction)] }));
      children.push(new Paragraph({ children: [] }));
      content.sections?.forEach((s: any) => {
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: `${s.number}. ${s.title}` })],
        }));
        children.push(new Paragraph({ children: [new TextRun(s.content)] }));
      });
      if (content.summary) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Resumen")] }));
        children.push(new Paragraph({ children: [new TextRun(content.summary)] }));
      }
      break;

    case "lesson_plan":
      if (content.grade) children.push(new Paragraph({ children: [new TextRun(`Grado: ${content.grade}`)] }));
      if (content.duration) children.push(new Paragraph({ children: [new TextRun(`Duración: ${content.duration}`)] }));
      if (content.objective) children.push(new Paragraph({ children: [new TextRun(`Objetivo: ${content.objective}`)] }));
      children.push(new Paragraph({ children: [] }));
      content.phases?.forEach((p: any) => {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(`${p.name} (${p.duration})`)] }));
        children.push(new Paragraph({ children: [new TextRun(p.activities)] }));
        if (p.resources) children.push(new Paragraph({ children: [new TextRun({ text: `Recursos: ${p.resources}`, italics: true })] }));
      });
      break;

    case "rubric":
      if (content.objective) children.push(new Paragraph({ children: [new TextRun(`Objetivo: ${content.objective}`)] }));
      children.push(new Paragraph({ children: [] }));
      content.criteria?.forEach((c: any) => {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(c.name)] }));
        Object.entries(c.descriptions || {}).forEach(([level, desc]) => {
          children.push(new Paragraph({
            indent: { left: 400 },
            children: [
              new TextRun({ text: `${level}: `, bold: true }),
              new TextRun({ text: String(desc) }),
            ],
          }));
        });
      });
      break;

    case "crossword": {
      const rows: number = content.rows;
      const cols: number = content.cols;
      const grid: string[][] = content.grid;
      const numbered: { row: number; col: number; n: number }[] = content.numbered || [];
      const numMap = new Map<string, number>();
      numbered.forEach((n) => numMap.set(`${n.row}-${n.col}`, n.n));

      const cellWidth = Math.max(360, Math.floor(9000 / cols));
      const buildGridTable = (showLetters: boolean) => {
        const tableRows: TableRow[] = [];
        for (let r = 0; r < rows; r++) {
          const cells: TableCell[] = [];
          for (let c = 0; c < cols; c++) {
            const letter = grid[r][c];
            const num = numMap.get(`${r}-${c}`);
            const isBlack = !letter;
            const para: Paragraph[] = [];
            if (!isBlack) {
              const runs: TextRun[] = [];
              if (num !== undefined) runs.push(new TextRun({ text: String(num), size: 12, superScript: true }));
              if (showLetters) runs.push(new TextRun({ text: letter, bold: true, size: 22 }));
              para.push(new Paragraph({ alignment: AlignmentType.CENTER, children: runs }));
            } else {
              para.push(new Paragraph({ children: [] }));
            }
            cells.push(new TableCell({
              width: { size: cellWidth, type: WidthType.DXA },
              shading: isBlack ? { fill: "FFFFFF", type: ShadingType.CLEAR, color: "auto" } : undefined,
              borders: isBlack ? {
                top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              } : undefined,
              verticalAlign: VerticalAlign.CENTER,
              children: para,
            }));
          }
          tableRows.push(new TableRow({ height: { value: cellWidth, rule: "exact" } as any, children: cells }));
        }
        return new Table({
          width: { size: cellWidth * cols, type: WidthType.DXA },
          columnWidths: Array(cols).fill(cellWidth),
          rows: tableRows,
        });
      };

      children.push(buildGridTable(false));
      children.push(new Paragraph({ children: [] }));

      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Horizontales")] }));
      (content.across || []).forEach((c: any) => children.push(
        new Paragraph({ children: [new TextRun({ text: `${c.number}. `, bold: true }), new TextRun(c.clue)] }),
      ));
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Verticales")] }));
      (content.down || []).forEach((c: any) => children.push(
        new Paragraph({ children: [new TextRun({ text: `${c.number}. `, bold: true }), new TextRun(c.clue)] }),
      ));

      // Solution page
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Solución — Uso del docente", bold: true })],
      }));
      children.push(new Paragraph({ children: [] }));
      children.push(buildGridTable(true));
      break;
    }

    case "story": {
      if (content.coverImageUrl) {
        try {
          const cover = await urlToDataUrl(content.coverImageUrl);
          const { bytes, type } = dataUrlToUint8(cover);
          const dims = await getImageDims(cover);
          const w = 480;
          const h = (dims.h / dims.w) * w;
          children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ type, data: bytes, transformation: { width: w, height: h } } as any)],
          }));
        } catch { /* ignore */ }
      }
      if (content.character) {
        children.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `Protagonista: ${content.character}${content.characterType ? ` (${content.characterType})` : ""}`, italics: true })],
        }));
      }
      const chapters = content.chapters || [];
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: `${i + 1}. ${ch.title}`, bold: true })],
        }));
        if (ch.imageUrl) {
          try {
            const img = await urlToDataUrl(ch.imageUrl);
            const { bytes, type } = dataUrlToUint8(img);
            const dims = await getImageDims(img);
            const w = 420;
            const h = (dims.h / dims.w) * w;
            children.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new ImageRun({ type, data: bytes, transformation: { width: w, height: h } } as any)],
            }));
          } catch { /* ignore */ }
        }
        ch.text.split(/\n\n+/).forEach((p: string) => {
          children.push(new Paragraph({ children: [new TextRun(p)], spacing: { after: 120 } }));
        });
      }
      if (content.moral) {
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Moraleja", bold: true })],
        }));
        children.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: content.moral, italics: true })],
        }));
      }
      break;
    }
  }

  return children;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, "").trim().replace(/\s+/g, "_").substring(0, 50);
}
