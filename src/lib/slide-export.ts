import html2canvas from "html2canvas";
import { toast } from "sonner";

const SLIDE_W = 1280;
const SLIDE_H = 720;

/**
 * Renders a single HTML slide to a canvas by creating a temporary iframe,
 * waiting for fonts/icons to load, then capturing with html2canvas.
 */
async function renderSlideToCanvas(html: string): Promise<HTMLCanvasElement> {
  const container = document.createElement("div");
  container.style.cssText =
    `position:fixed;left:-9999px;top:0;width:${SLIDE_W}px;height:${SLIDE_H}px;overflow:hidden;z-index:-1;`;
  document.body.appendChild(container);

  const iframe = document.createElement("iframe");
  iframe.style.cssText = `width:${SLIDE_W}px;height:${SLIDE_H}px;border:none;`;
  iframe.sandbox.add("allow-same-origin");
  container.appendChild(iframe);

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    iframe.srcdoc = html;
  });

  // Wait for fonts & icons
  await new Promise((r) => setTimeout(r, 2000));

  const iframeDoc = iframe.contentDocument;
  if (!iframeDoc?.body) {
    document.body.removeChild(container);
    throw new Error("Could not access iframe document");
  }

  const canvas = await html2canvas(iframeDoc.body, {
    width: SLIDE_W,
    height: SLIDE_H,
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  document.body.removeChild(container);
  return canvas;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .substring(0, 50);
}

export async function exportSlidesToPdf(content: any) {
  const slides = content?.slides || [];
  if (slides.length === 0) {
    toast.error("No hay diapositivas para exportar");
    return;
  }

  toast.info(`Generando PDF (${slides.length} diapositivas)... Esto puede tardar unos segundos.`);

  try {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "px", format: [SLIDE_W, SLIDE_H] });

    for (let idx = 0; idx < slides.length; idx++) {
      if (idx > 0) doc.addPage();
      const slideData = slides[idx];

      if (slideData.html) {
        try {
          const canvas = await renderSlideToCanvas(slideData.html);
          const imgData = canvas.toDataURL("image/jpeg", 0.92);
          doc.addImage(imgData, "JPEG", 0, 0, SLIDE_W, SLIDE_H);
        } catch (e) {
          console.warn(`Slide ${idx + 1} render failed, using fallback`, e);
          doc.setFillColor(255, 255, 255);
          doc.rect(0, 0, SLIDE_W, SLIDE_H, "F");
          doc.setFontSize(24);
          doc.text(`Diapositiva ${idx + 1}`, 60, 80);
        }
      }
    }

    doc.save(`${sanitizeFilename(content?.title || "Diapositivas")}.pdf`);
    toast.success("PDF descargado exitosamente");
  } catch (e: any) {
    console.error("PDF export error:", e);
    toast.error("Error al exportar PDF: " + e.message);
  }
}

export async function exportSlidesToPptx(content: any) {
  const slides = content?.slides || [];
  if (slides.length === 0) {
    toast.error("No hay diapositivas para exportar");
    return;
  }

  toast.info(`Generando PPTX (${slides.length} diapositivas)... Esto puede tardar unos segundos.`);

  try {
    const pptxgenModule = await import("pptxgenjs");
    const PptxGenJS = pptxgenModule.default;
    const pres = new PptxGenJS();
    pres.layout = "LAYOUT_WIDE";

    for (let idx = 0; idx < slides.length; idx++) {
      const slideData = slides[idx];
      const slide = pres.addSlide();

      if (slideData.html) {
        try {
          const canvas = await renderSlideToCanvas(slideData.html);
          const imgData = canvas.toDataURL("image/png");
          slide.addImage({
            data: imgData,
            x: 0,
            y: 0,
            w: "100%",
            h: "100%",
          });
        } catch (e) {
          console.warn(`Slide ${idx + 1} render failed`, e);
          slide.addText(`Diapositiva ${idx + 1}`, {
            x: 0.5, y: 2.5, w: 9, h: 1,
            fontSize: 28, bold: true, color: "333333",
          });
        }
      }
    }

    const fileName = sanitizeFilename(content?.title || "Diapositivas");
    await pres.writeFile({ fileName: `${fileName}.pptx` });
    toast.success("Presentación PPTX descargada exitosamente");
  } catch (e: any) {
    console.error("PPTX export error:", e);
    toast.error("Error al exportar PPTX: " + e.message);
  }
}
