import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType } from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

export async function exportToDocx(title: string, resourceType: string, content: any) {
  const children = buildDocxContent(title, resourceType, content);

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 24 } } },
    },
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${sanitizeFilename(title)}.docx`);
}

export function exportToPdf(title: string, resourceType: string, content: any) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  const addText = (text: string, size: number, bold = false, indent = 0) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, maxWidth - indent);
    for (const line of lines) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(line, margin + indent, y);
      y += size * 0.5;
    }
    y += 2;
  };

  addText(title, 18, true);
  if (content.subject) addText(`Área: ${content.subject}`, 11);
  y += 5;

  switch (resourceType) {
    case "icfes":
    case "quiz":
      content.questions?.forEach((q: any) => {
        addText(`${q.number}. ${q.question}`, 11, true);
        if (q.context) addText(q.context, 10, false, 5);
        if (q.options) {
          if (Array.isArray(q.options)) {
            q.options.forEach((opt: string, i: number) => addText(`  ${String.fromCharCode(65 + i)}. ${opt}`, 10, false, 10));
          } else {
            Object.entries(q.options).forEach(([k, v]) => addText(`  ${k}. ${v}`, 10, false, 10));
          }
        }
        addText(`Respuesta: ${q.correct}`, 10, true, 5);
        if (q.explanation) addText(`Explicación: ${q.explanation}`, 9, false, 5);
        y += 3;
      });
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
  }

  doc.save(`${sanitizeFilename(title)}.pdf`);
}

function buildDocxContent(title: string, resourceType: string, content: any): Paragraph[] {
  const children: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: title, bold: true })] }),
  ];

  if (content.subject) {
    children.push(new Paragraph({ children: [new TextRun({ text: `Área: ${content.subject}`, italics: true, size: 22 })] }));
  }

  children.push(new Paragraph({ children: [] }));

  switch (resourceType) {
    case "icfes":
    case "quiz":
      content.questions?.forEach((q: any) => {
        children.push(new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({ text: `${q.number}. ${q.question}`, bold: true })],
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
        }
        children.push(new Paragraph({
          indent: { left: 400 },
          children: [new TextRun({ text: `Respuesta correcta: ${q.correct}`, bold: true, color: "2E7D32" })],
        }));
        if (q.explanation) {
          children.push(new Paragraph({
            indent: { left: 400 },
            children: [new TextRun({ text: `Explicación: ${q.explanation}`, italics: true, size: 20 })],
          }));
        }
      });
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
  }

  return children;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, "").trim().replace(/\s+/g, "_").substring(0, 50);
}
