import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, BorderStyle, ImageRun, Header, PageBreak, Table, TableRow, TableCell, WidthType, ShadingType, VerticalAlign } from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import { escribirConSimbolos, partirEnRenglones } from "@/lib/simbolos-pdf";

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
/**
 * Construye el documento y devuelve el Blob, SIN descargarlo.
 *
 * Separado de la descarga a proposito: es la unica forma de comprobar en las
 * pruebas que el archivo sale bien formado. Un DOCX corrupto solo se nota al
 * abrirlo, y para entonces el docente ya esta delante de sus estudiantes.
 */
export async function construirDocx(
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

  return await Packer.toBlob(doc);
}

// ---------- PDF ----------
/** Construye el PDF y devuelve el Blob, sin descargarlo. */
export async function construirPdf(
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
    /*
     * Se escribe con el ayudante de símbolos porque las fuentes estándar del
     * PDF no tienen √ ≠ ≤ π ni los subíndices, y jsPDF los cambia por otro
     * carácter sin avisar: un examen de matemáticas perdía la raíz cuadrada y
     * H₂O se imprimía roto. Ver src/lib/simbolos-pdf.ts.
     *
     * Cuando el texto no lleva símbolos —lo normal— el ayudante escribe de
     * una sola vez, igual que antes.
     */
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = partirEnRenglones(doc, text, maxWidth - indent, { size, bold });
    for (const line of lines) {
      if (y > pageHeight - 20) newPage();
      escribirConSimbolos(doc, line, margin + indent, y, { size, bold });
      y += size * 0.5;
    }
    y += 2;
  };

  // For stories the cover page renders its own decorative title — skip default header.
  if (resourceType !== "story") {
    addText(title, 18, true);
    if (content.subject) addText(`Área: ${content.subject}`, 11);

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
  }

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
          escribirConSimbolos(doc, `${num}. ${q.correct ?? "—"}`, x, rowY, { size: 10 });
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
      if (content.grade) addText(`Grado: ${content.grade}`, 10);
      if (content.methodology) addText(`Metodología: ${content.methodology}`, 10);
      if (content.duration) addText(`Duración: ${content.duration}`, 10);
      if (content.groupOrganization) addText(`Organización: ${content.groupOrganization}`, 10);
      if (Array.isArray(content.learningGoals) && content.learningGoals.length) {
        addText("Metas de aprendizaje", 12, true);
        content.learningGoals.forEach((m: string) => addText(`• ${m}`, 10, false, 5));
      }
      if (content.materials?.length) addText(`Materiales: ${content.materials.join(", ")}`, 10);
      y += 3;
      content.activities?.forEach((a: any) => {
        addText(`Actividad ${a.number}: ${a.title}`, 12, true);
        if (a.purpose) addText(a.purpose, 9, false, 5);
        if (a.description) addText(a.description, 10, false, 5);
        if (Array.isArray(a.instructions)) {
          a.instructions.forEach((paso: string, i: number) => addText(`${i + 1}. ${paso}`, 10, false, 10));
        } else if (a.instructions) {
          addText(`Instrucciones: ${a.instructions}`, 10, false, 5);
        }
        if (Array.isArray(a.questions) && a.questions.length) {
          addText("Preguntas orientadoras:", 10, true, 5);
          a.questions.forEach((q: string) => addText(`- ${q}`, 10, false, 10));
        }
        if (a.product) addText(`Producto: ${a.product}`, 10, false, 5);
        if (a.duration) addText(`Duración: ${a.duration}`, 9, false, 5);
        y += 3;
      });
      if (content.differentiation?.support || content.differentiation?.extension) {
        addText("Atención a la diversidad", 12, true);
        if (content.differentiation.support) addText(`Apoyo: ${content.differentiation.support}`, 10, false, 5);
        if (content.differentiation.extension) addText(`Profundización: ${content.differentiation.extension}`, 10, false, 5);
        y += 3;
      }
      if (content.evaluation) {
        addText("Evaluación", 12, true);
        if (typeof content.evaluation === "string") {
          addText(content.evaluation, 10);
        } else {
          if (content.evaluation.instrument) addText(`Instrumento: ${content.evaluation.instrument}`, 10, false, 5);
          content.evaluation.criteria?.forEach((c: any) => addText(`• ${c.criterion}: ${c.indicator}`, 10, false, 5));
        }
      }
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

    case "lesson_plan": {
      const list = (items: any, indent = 5, prefix = "• ") => {
        if (!Array.isArray(items)) return;
        items.forEach((it: string) => addText(`${prefix}${it}`, 10, false, indent));
      };

      if (content.grade) addText(`Grado: ${content.grade}`, 10);
      if (content.duration) addText(`Duración: ${content.duration}`, 10);
      if (content.topic) addText(`Tema: ${content.topic}`, 10);
      if (content.standard) addText(`Estándar: ${content.standard}`, 9);
      if (content.dba) addText(`DBA: ${content.dba}`, 9);
      if (content.objective) addText(`Objetivo: ${content.objective}`, 10);
      y += 3;

      if (Array.isArray(content.learningGoals) && content.learningGoals.length) {
        addText("Metas de aprendizaje", 12, true);
        list(content.learningGoals);
        y += 3;
      }
      if (Array.isArray(content.priorKnowledge) && content.priorKnowledge.length) {
        addText("Saberes previos", 12, true);
        list(content.priorKnowledge);
        y += 3;
      }
      if (Array.isArray(content.materials) && content.materials.length) {
        addText("Materiales", 12, true);
        list(content.materials);
        y += 3;
      }

      content.phases?.forEach((p: any) => {
        addText(`${p.name} (${p.duration})`, 12, true);
        if (p.purpose) addText(p.purpose, 9, false, 5);
        if (Array.isArray(p.teacherActions) && p.teacherActions.length) {
          addText("Docente:", 10, true, 5);
          list(p.teacherActions, 10, "- ");
        }
        if (Array.isArray(p.studentActions) && p.studentActions.length) {
          addText("Estudiantes:", 10, true, 5);
          list(p.studentActions, 10, "- ");
        }
        if (Array.isArray(p.questions) && p.questions.length) {
          addText("Preguntas orientadoras:", 10, true, 5);
          list(p.questions, 10, "- ");
        }
        // Formato anterior
        if (p.activities) addText(p.activities, 10, false, 5);
        if (p.resources) addText(`Recursos: ${p.resources}`, 9, false, 5);
        y += 3;
      });

      if (content.differentiation?.support || content.differentiation?.extension) {
        addText("Atención a la diversidad", 12, true);
        if (content.differentiation.support) addText(`Apoyo: ${content.differentiation.support}`, 10, false, 5);
        if (content.differentiation.extension) addText(`Profundización: ${content.differentiation.extension}`, 10, false, 5);
        y += 3;
      }

      if (content.evaluation) {
        addText("Evaluación", 12, true);
        if (typeof content.evaluation === "string") {
          addText(content.evaluation, 10);
        } else {
          if (content.evaluation.type) addText(`Tipo: ${content.evaluation.type}`, 10, false, 5);
          if (content.evaluation.instrument) addText(`Instrumento: ${content.evaluation.instrument}`, 10, false, 5);
          content.evaluation.criteria?.forEach((c: any) => {
            addText(`• ${c.criterion}: ${c.indicator}`, 10, false, 5);
          });
        }
        y += 3;
      }

      if (content.homework) { addText("Tarea", 12, true); addText(content.homework, 10); y += 3; }
      if (Array.isArray(content.references) && content.references.length) {
        addText("Referencias", 12, true);
        list(content.references);
      }
      break;
    }

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
      // Helper: elegant serif title
      const addStoryTitle = (text: string, size: number) => {
        doc.setFont("times", "bold");
        doc.setFontSize(size);
        const lines = doc.splitTextToSize(text, maxWidth);
        for (const line of lines) {
          if (y > pageHeight - 20) newPage();
          doc.text(line, pageWidth / 2, y, { align: "center" });
          y += size * 0.55;
        }
        y += 3;
      };
      const addStoryBody = (text: string) => {
        doc.setFont("times", "normal");
        doc.setFontSize(12);
        const paragraphs = text.split(/\n\n+/);
        for (const para of paragraphs) {
          const lines = partirEnRenglones(doc, para, maxWidth, { size: 12 });
          for (const line of lines) {
            if (y > pageHeight - 20) newPage();
            escribirConSimbolos(doc, line, margin, y, { size: 12 });
            y += 6;
          }
          y += 3;
        }
      };

      // ---- COVER PAGE: full page, image fills + title centered ----
      if (content.coverImageUrl || content.title) {
        // We are already on page 1 with topOffset
        if (content.coverImageUrl) {
          try {
            const cover = await urlToDataUrl(content.coverImageUrl);
            const dims = await getImageDims(cover);
            // Use most of the page for the cover image
            const availH = pageHeight - topOffset - 60; // leave room for title
            const availW = maxWidth;
            let w = availW;
            let h = (dims.h / dims.w) * w;
            if (h > availH) {
              h = availH;
              w = (dims.w / dims.h) * h;
            }
            const x = margin + (maxWidth - w) / 2;
            doc.addImage(cover, "PNG", x, y, w, h, undefined, "FAST");
            y += h + 10;
          } catch { /* ignore */ }
        }
        // Decorative title under the cover
        addStoryTitle(content.title || title, 26);
        if (content.character) {
          doc.setFont("times", "italic");
          doc.setFontSize(12);
          const ptxt = `Protagonista: ${content.character}${content.characterType ? ` (${content.characterType})` : ""}`;
          if (y > pageHeight - 20) newPage();
          doc.text(ptxt, pageWidth / 2, y, { align: "center" });
          y += 8;
        }
      }

      // ---- CHAPTERS: each on its own page, image + text fit together ----
      for (let i = 0; i < (content.chapters || []).length; i++) {
        const ch = content.chapters[i];
        newPage();

        addStoryTitle(ch.title, 18);

        // Pre-load image and shrink so the WHOLE text + image fit on one page
        let imgData: string | null = null;
        let imgW = 0, imgH = 0;
        if (ch.imageUrl) {
          try {
            imgData = await urlToDataUrl(ch.imageUrl);
            const dims = await getImageDims(imgData);
            // Estimate text height: chars / chars-per-line * line-height
            doc.setFont("times", "normal");
            doc.setFontSize(12);
            const textLines = doc.splitTextToSize(ch.text, maxWidth).length;
            const estTextH = textLines * 6 + 12;
            const availTotal = pageHeight - y - 20;
            const maxImgH = Math.max(40, availTotal - estTextH - 8);
            imgW = maxWidth * 0.75;
            imgH = (dims.h / dims.w) * imgW;
            if (imgH > maxImgH) {
              imgH = maxImgH;
              imgW = (dims.w / dims.h) * imgH;
            }
            // Hard cap so it never dominates
            const absoluteCap = (pageHeight - topOffset) * 0.4;
            if (imgH > absoluteCap) {
              imgH = absoluteCap;
              imgW = (dims.w / dims.h) * imgH;
            }
          } catch { imgData = null; }
        }

        if (imgData) {
          doc.addImage(imgData, "PNG", margin + (maxWidth - imgW) / 2, y, imgW, imgH, undefined, "FAST");
          y += imgH + 6;
        }
        addStoryBody(ch.text);
      }
      if (content.moral) {
        newPage();
        addStoryTitle("Moraleja", 20);
        doc.setFont("times", "italic");
        doc.setFontSize(13);
        const lines = doc.splitTextToSize(content.moral, maxWidth);
        for (const line of lines) {
          if (y > pageHeight - 20) newPage();
          doc.text(line, pageWidth / 2, y, { align: "center" });
          y += 7;
        }
      }
      break;
    }
  }

  return doc.output("blob");
}

async function buildDocxContent(title: string, resourceType: string, content: any): Promise<(Paragraph | Table)[]> {
  const isStory = resourceType === "story";
  const STORY_FONT = "Georgia";
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: isStory ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: isStory ? { before: 400, after: 400 } : undefined,
      heading: isStory ? undefined : HeadingLevel.HEADING_1,
      children: [new TextRun(
        isStory
          ? { text: content.title || title, bold: true, font: STORY_FONT, size: 56 }
          : { text: title, bold: true },
      )],
    }),
  ];

  if (content.subject && !isStory) {
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

  if (!isStory) children.push(new Paragraph({ children: [] }));

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

    case "workshop": {
      const linea = (label: string, valor?: string) => {
        if (valor) children.push(new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(valor)] }));
      };
      const vinetas = (items: any, indent = 400) => {
        if (!Array.isArray(items)) return;
        items.forEach((it: string) =>
          children.push(new Paragraph({ indent: { left: indent }, children: [new TextRun(`• ${it}`)] })));
      };

      linea("Objetivo", content.objective);
      linea("Grado", content.grade);
      linea("Metodología", content.methodology);
      linea("Duración", content.duration);
      linea("Organización", content.groupOrganization);
      if (Array.isArray(content.learningGoals) && content.learningGoals.length) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Metas de aprendizaje")] }));
        vinetas(content.learningGoals);
      }
      if (Array.isArray(content.materials) && content.materials.length) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Materiales")] }));
        vinetas(content.materials);
      }
      children.push(new Paragraph({ children: [] }));

      content.activities?.forEach((a: any) => {
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: `Actividad ${a.number}: ${a.title}` })],
        }));
        if (a.purpose) children.push(new Paragraph({ children: [new TextRun({ text: a.purpose, italics: true })] }));
        if (a.description) children.push(new Paragraph({ children: [new TextRun(a.description)] }));
        if (Array.isArray(a.instructions)) {
          a.instructions.forEach((paso: string, i: number) =>
            children.push(new Paragraph({ indent: { left: 400 }, children: [new TextRun(`${i + 1}. ${paso}`)] })));
        } else if (a.instructions) {
          children.push(new Paragraph({ children: [new TextRun({ text: `Instrucciones: ${a.instructions}`, italics: true })] }));
        }
        if (Array.isArray(a.questions) && a.questions.length) {
          children.push(new Paragraph({ children: [new TextRun({ text: "Preguntas orientadoras", bold: true })] }));
          vinetas(a.questions);
        }
        linea("Producto", a.product);
        linea("Duración", a.duration);
      });

      if (content.differentiation?.support || content.differentiation?.extension) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Atención a la diversidad")] }));
        linea("Apoyo", content.differentiation.support);
        linea("Profundización", content.differentiation.extension);
      }

      if (content.evaluation) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Evaluación")] }));
        if (typeof content.evaluation === "string") {
          children.push(new Paragraph({ children: [new TextRun(content.evaluation)] }));
        } else {
          linea("Instrumento", content.evaluation.instrument);
          vinetas(content.evaluation.criteria?.map((c: any) => `${c.criterion}: ${c.indicator}`));
        }
      }
      break;
    }

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

    case "lesson_plan": {
      const meta = (label: string, value?: string) => {
        if (value) children.push(new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(value)] }));
      };
      const heading = (text: string) =>
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] }));
      const bullets = (items: any, indent = 400) => {
        if (!Array.isArray(items)) return;
        items.forEach((it: string) =>
          children.push(new Paragraph({ indent: { left: indent }, children: [new TextRun(`• ${it}`)] })));
      };

      meta("Grado", content.grade);
      meta("Duración", content.duration);
      meta("Tema", content.topic);
      meta("Estándar", content.standard);
      meta("DBA", content.dba);
      meta("Objetivo", content.objective);
      children.push(new Paragraph({ children: [] }));

      if (Array.isArray(content.learningGoals) && content.learningGoals.length) {
        heading("Metas de aprendizaje");
        bullets(content.learningGoals);
      }
      if (Array.isArray(content.priorKnowledge) && content.priorKnowledge.length) {
        heading("Saberes previos");
        bullets(content.priorKnowledge);
      }
      if (Array.isArray(content.materials) && content.materials.length) {
        heading("Materiales");
        bullets(content.materials);
      }

      content.phases?.forEach((p: any) => {
        heading(`${p.name} (${p.duration})`);
        if (p.purpose) children.push(new Paragraph({ children: [new TextRun({ text: p.purpose, italics: true })] }));
        if (Array.isArray(p.teacherActions) && p.teacherActions.length) {
          children.push(new Paragraph({ children: [new TextRun({ text: "Docente", bold: true })] }));
          bullets(p.teacherActions);
        }
        if (Array.isArray(p.studentActions) && p.studentActions.length) {
          children.push(new Paragraph({ children: [new TextRun({ text: "Estudiantes", bold: true })] }));
          bullets(p.studentActions);
        }
        if (Array.isArray(p.questions) && p.questions.length) {
          children.push(new Paragraph({ children: [new TextRun({ text: "Preguntas orientadoras", bold: true })] }));
          bullets(p.questions);
        }
        // Formato anterior
        if (p.activities) children.push(new Paragraph({ children: [new TextRun(p.activities)] }));
        if (p.resources) children.push(new Paragraph({ children: [new TextRun({ text: `Recursos: ${p.resources}`, italics: true })] }));
      });

      if (content.differentiation?.support || content.differentiation?.extension) {
        heading("Atención a la diversidad");
        meta("Apoyo", content.differentiation.support);
        meta("Profundización", content.differentiation.extension);
      }

      if (content.evaluation) {
        heading("Evaluación");
        if (typeof content.evaluation === "string") {
          children.push(new Paragraph({ children: [new TextRun(content.evaluation)] }));
        } else {
          meta("Tipo", content.evaluation.type);
          meta("Instrumento", content.evaluation.instrument);
          bullets(content.evaluation.criteria?.map((c: any) => `${c.criterion}: ${c.indicator}`));
        }
      }

      if (content.homework) {
        heading("Tarea");
        children.push(new Paragraph({ children: [new TextRun(content.homework)] }));
      }
      if (Array.isArray(content.references) && content.references.length) {
        heading("Referencias");
        bullets(content.references);
      }
      break;
    }

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
      // Story uses elegant serif typography
      const STORY_FONT = "Georgia";

      // ---- COVER PAGE: image + decorative title, all on first page ----
      // Replace the default top title (added at top of buildDocxContent) is hard,
      // so we just keep adding cover content; the title above will already render.
      if (content.coverImageUrl) {
        try {
          const cover = await urlToDataUrl(content.coverImageUrl);
          const { bytes, type } = dataUrlToUint8(cover);
          const dims = await getImageDims(cover);
          const w = 520;
          const h = (dims.h / dims.w) * w;
          children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
            children: [new ImageRun({ type, data: bytes, transformation: { width: w, height: Math.min(h, 520) } } as any)],
          }));
        } catch { /* ignore */ }
      }
      // Decorative cover title (the auto title from buildDocxContent already exists,
      // so add a stylized restatement only if there's a character)
      if (content.character) {
        children.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200 },
          children: [new TextRun({
            text: `Protagonista: ${content.character}${content.characterType ? ` (${content.characterType})` : ""}`,
            italics: true,
            font: STORY_FONT,
            size: 26,
          })],
        }));
      }

      const chapters = content.chapters || [];
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        // Each chapter starts on its own page
        children.push(new Paragraph({
          pageBreakBefore: true,
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 240 },
          children: [new TextRun({
            text: ch.title,
            bold: true,
            font: STORY_FONT,
            size: 40, // 20pt
          })],
        }));
        if (ch.imageUrl) {
          try {
            const img = await urlToDataUrl(ch.imageUrl);
            const { bytes, type } = dataUrlToUint8(img);
            const dims = await getImageDims(img);
            const w = 360;
            const h = (dims.h / dims.w) * w;
            children.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              children: [new ImageRun({ type, data: bytes, transformation: { width: w, height: Math.min(h, 280) } } as any)],
            }));
          } catch { /* ignore */ }
        }
        ch.text.split(/\n\n+/).forEach((p: string) => {
          children.push(new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 160, line: 320 },
            children: [new TextRun({ text: p, font: STORY_FONT, size: 24 })],
          }));
        });
      }
      if (content.moral) {
        children.push(new Paragraph({
          pageBreakBefore: true,
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 240 },
          children: [new TextRun({ text: "Moraleja", bold: true, font: STORY_FONT, size: 36 })],
        }));
        children.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: content.moral, italics: true, font: STORY_FONT, size: 26 })],
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

/**
 * Las dos envolturas que usa la interfaz. Se mantienen los nombres para no
 * tocar las siete pantallas que ya las llaman.
 */
export async function exportToDocx(
  title: string,
  resourceType: string,
  content: any,
  options: ExportOptions = {},
): Promise<void> {
  const blob = await construirDocx(title, resourceType, content, options);
  saveAs(blob, `${sanitizeFilename(title)}.docx`);
}

export async function exportToPdf(
  title: string,
  resourceType: string,
  content: any,
  options: ExportOptions = {},
): Promise<void> {
  const blob = await construirPdf(title, resourceType, content, options);
  saveAs(blob, `${sanitizeFilename(title)}.pdf`);
}

