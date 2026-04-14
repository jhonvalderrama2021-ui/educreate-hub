import html2canvas from "html2canvas";
import { toast } from "sonner";

/**
 * Renders a single HTML slide to a canvas image by creating a temporary
 * hidden container, waiting for fonts/icons to load, then capturing.
 */
async function renderSlideToCanvas(html: string): Promise<HTMLCanvasElement> {
  // Create a hidden container at the real slide dimensions
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;left:-9999px;top:0;width:1280px;height:720px;overflow:hidden;z-index:-1;";
  document.body.appendChild(container);

  // Create an iframe so the slide HTML renders in an isolated document
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "width:1280px;height:720px;border:none;";
  iframe.sandbox.add("allow-same-origin");
  container.appendChild(iframe);

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    iframe.srcdoc = html;
  });

  // Wait for fonts & icons to load
  await new Promise((r) => setTimeout(r, 1500));

  const iframeDoc = iframe.contentDocument;
  if (!iframeDoc?.body) {
    document.body.removeChild(container);
    throw new Error("Could not access iframe document");
  }

  const canvas = await html2canvas(iframeDoc.body, {
    width: 1280,
    height: 720,
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

  toast.info("Generando PDF con alta fidelidad visual... Esto puede tardar unos segundos.");

  try {
    const { default: jsPDF } = await import("jspdf");
    // 16:9 landscape at 96 DPI
    const doc = new jsPDF({ orientation: "landscape", unit: "px", format: [1280, 720] });

    for (let idx = 0; idx < slides.length; idx++) {
      if (idx > 0) doc.addPage();
      const slideData = slides[idx];

      if (slideData.html) {
        const canvas = await renderSlideToCanvas(slideData.html);
        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        doc.addImage(imgData, "JPEG", 0, 0, 1280, 720);
      } else {
        // Legacy fallback – white page with text
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, 1280, 720, "F");
        doc.setFontSize(28);
        doc.setFont("helvetica", "bold");
        doc.text(slideData.title || `Diapositiva ${idx + 1}`, 60, 80);
        let y = 130;
        doc.setFontSize(16);
        doc.setFont("helvetica", "normal");
        (slideData.points || []).forEach((p: string) => {
          if (y < 680) {
            doc.text(`• ${p}`, 80, y);
            y += 28;
          }
        });
      }
    }

    doc.save(`${sanitizeFilename(content?.title || "Diapositivas")}.pdf`);
    toast.success("PDF descargado");
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

  toast.info("Generando PPTX con alta fidelidad visual... Esto puede tardar unos segundos.");

  try {
    const pptxgenModule = await import("pptxgenjs");
    const PptxGenJS = pptxgenModule.default;
    const pres = new PptxGenJS();
    pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches

    for (let idx = 0; idx < slides.length; idx++) {
      const slideData = slides[idx];
      const slide = pres.addSlide();

      if (slideData.html) {
        const canvas = await renderSlideToCanvas(slideData.html);
        const imgData = canvas.toDataURL("image/png");
        slide.addImage({
          data: imgData,
          x: 0,
          y: 0,
          w: "100%",
          h: "100%",
        });
      } else {
        // Legacy fallback
        slide.background = { color: slideData.bgColor || "FFFFFF" };
        slide.addText(slideData.title || "", {
          x: 0.5, y: 0.3, w: 12, h: 0.8,
          fontSize: 28, bold: true, color: "0F172A",
        });
        const points = slideData.points || [];
        if (points.length > 0) {
          const bulletText = points.map((p: string) => ({
            text: p,
            options: { bullet: true, fontSize: 16, color: "334155", breakLine: true },
          }));
          slide.addText(bulletText, { x: 0.8, y: 1.4, w: 11, h: 5.5, valign: "top" });
        }
      }
    }

    const fileName = sanitizeFilename(content?.title || "Diapositivas");
    await pres.writeFile({ fileName: `${fileName}.pptx` });
    toast.success("Presentación PPTX descargada");
  } catch (e: any) {
    console.error("PPTX export error:", e);
    toast.error("Error al exportar PPTX: " + e.message);
  }
}
