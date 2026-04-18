import html2canvas from "html2canvas";
import { toast } from "sonner";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { SlideRenderer } from "@/components/slides/SlideRenderer";
import { DEFAULT_THEME, type StructuredSlide, type SlideTheme } from "@/lib/slide-types";

const SLIDE_W = 1280;
const SLIDE_H = 720;

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .substring(0, 50);
}

function isStructuredPresentation(content: any): boolean {
  return content?.slides?.[0]?.layout !== undefined;
}

/**
 * Renders a structured slide off-screen at full 1280x720 resolution
 * using React, waits for fonts/images, then captures with html2canvas.
 */
async function renderStructuredSlideOffscreen(
  slide: StructuredSlide,
  theme: SlideTheme
): Promise<HTMLCanvasElement> {
  const container = document.createElement("div");
  container.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    `width:${SLIDE_W}px`,
    `height:${SLIDE_H}px`,
    "overflow:hidden",
    "z-index:-9999",
    "pointer-events:none",
    "opacity:0",
    "background:#ffffff",
    "font-family:'Inter',sans-serif",
  ].join(";");
  document.body.appendChild(container);

  let root: Root | null = null;
  try {
    root = createRoot(container);
    root.render(
      createElement(SlideRenderer, { slide, theme }) as any
    );

    // Allow React to commit + initial paint
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => setTimeout(r, 50));

    // Wait for fonts (Material Icons + Inter + Space Grotesk)
    if ((document as any).fonts?.ready) {
      await (document as any).fonts.ready;
    }

    // Wait for all images inside the slide to load
    const imgs = Array.from(container.querySelectorAll("img"));
    await Promise.all(
      imgs.map((img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              const done = () => resolve();
              img.addEventListener("load", done, { once: true });
              img.addEventListener("error", done, { once: true });
              setTimeout(done, 4000);
            })
      )
    );

    // Final settle frame
    await new Promise((r) => setTimeout(r, 100));

    const canvas = await html2canvas(container, {
      width: SLIDE_W,
      height: SLIDE_H,
      windowWidth: SLIDE_W,
      windowHeight: SLIDE_H,
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      imageTimeout: 5000,
    });

    return canvas;
  } finally {
    if (root) {
      try { root.unmount(); } catch {}
    }
    if (container.parentNode) container.parentNode.removeChild(container);
  }
}

/**
 * Legacy: render free HTML slide in iframe and capture.
 */
async function renderHtmlSlideToCanvas(html: string): Promise<HTMLCanvasElement> {
  const container = document.createElement("div");
  container.style.cssText =
    `position:fixed;left:-9999px;top:0;width:${SLIDE_W}px;height:${SLIDE_H}px;overflow:hidden;z-index:-1;`;
  document.body.appendChild(container);

  const iframe = document.createElement("iframe");
  iframe.style.cssText = `width:${SLIDE_W}px;height:${SLIDE_H}px;border:none;`;
  iframe.sandbox.add("allow-same-origin");
  iframe.sandbox.add("allow-scripts");
  container.appendChild(iframe);

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    iframe.srcdoc = html;
  });

  await new Promise((r) => setTimeout(r, 1500));

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

async function captureSlide(
  slideData: any,
  theme: SlideTheme,
  isStructured: boolean
): Promise<HTMLCanvasElement> {
  if (isStructured) {
    return renderStructuredSlideOffscreen(slideData as StructuredSlide, theme);
  }
  if (slideData.html) {
    return renderHtmlSlideToCanvas(slideData.html);
  }
  throw new Error("Slide has no renderable content");
}

export async function exportSlidesToPdf(content: any) {
  const slides = content?.slides || [];
  if (slides.length === 0) {
    toast.error("No hay diapositivas para exportar");
    return;
  }

  const isStructured = isStructuredPresentation(content);
  const theme: SlideTheme = content?.theme || DEFAULT_THEME;
  const toastId = toast.loading(`Generando PDF (0/${slides.length})...`);

  try {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "px", format: [SLIDE_W, SLIDE_H] });

    for (let idx = 0; idx < slides.length; idx++) {
      toast.loading(`Generando PDF (${idx + 1}/${slides.length})...`, { id: toastId });
      if (idx > 0) doc.addPage();

      try {
        const canvas = await captureSlide(slides[idx], theme, isStructured);
        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        doc.addImage(imgData, "JPEG", 0, 0, SLIDE_W, SLIDE_H);
      } catch (e) {
        console.warn(`Slide ${idx + 1} render failed`, e);
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, SLIDE_W, SLIDE_H, "F");
        doc.setFontSize(24);
        doc.text(`Diapositiva ${idx + 1}`, 60, 80);
      }
    }

    doc.save(`${sanitizeFilename(content?.title || "Diapositivas")}.pdf`);
    toast.success("PDF descargado exitosamente", { id: toastId });
  } catch (e: any) {
    console.error("PDF export error:", e);
    toast.error("Error al exportar PDF: " + e.message, { id: toastId });
  }
}

export async function exportSlidesToPptx(content: any) {
  const slides = content?.slides || [];
  if (slides.length === 0) {
    toast.error("No hay diapositivas para exportar");
    return;
  }

  const isStructured = isStructuredPresentation(content);
  const theme: SlideTheme = content?.theme || DEFAULT_THEME;
  const toastId = toast.loading(`Generando PPTX (0/${slides.length})...`);

  try {
    const pptxgenModule = await import("pptxgenjs");
    const PptxGenJS = pptxgenModule.default;
    const pres = new PptxGenJS();
    pres.layout = "LAYOUT_WIDE";

    for (let idx = 0; idx < slides.length; idx++) {
      toast.loading(`Generando PPTX (${idx + 1}/${slides.length})...`, { id: toastId });
      const slide = pres.addSlide();

      try {
        const canvas = await captureSlide(slides[idx], theme, isStructured);
        const imgData = canvas.toDataURL("image/png");
        slide.addImage({ data: imgData, x: 0, y: 0, w: "100%", h: "100%" });
      } catch (e) {
        console.warn(`Slide ${idx + 1} render failed`, e);
        slide.addText(`Diapositiva ${idx + 1}`, {
          x: 0.5, y: 2.5, w: 9, h: 1, fontSize: 28, bold: true, color: "333333",
        });
      }
    }

    const fileName = sanitizeFilename(content?.title || "Diapositivas");
    await pres.writeFile({ fileName: `${fileName}.pptx` });
    toast.success("Presentación PPTX descargada exitosamente", { id: toastId });
  } catch (e: any) {
    console.error("PPTX export error:", e);
    toast.error("Error al exportar PPTX: " + e.message, { id: toastId });
  }
}
