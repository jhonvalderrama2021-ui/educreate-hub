import html2canvas from "html2canvas";
import { toast } from "sonner";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { SlideRenderer } from "@/components/slides/SlideRenderer";
import { DEFAULT_THEME, type StructuredSlide, type SlideTheme } from "@/lib/slide-types";
import { supabase } from "@/integrations/supabase/client";

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

// ============================================================
// IMAGE PRE-FETCHING — Critical for blank-PDF fix
// ============================================================
// We proxy every Pexels URL through our edge function which returns base64.
// html2canvas can then capture them without CORS taint and without race
// conditions waiting for remote loads.

const imageCache = new Map<string, string>();

async function urlToBase64ViaProxy(url: string): Promise<string | null> {
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url)!;
  try {
    const { data, error } = await supabase.functions.invoke("pexels-proxy", {
      body: { url },
    });
    if (error || !data?.dataUrl) {
      console.warn("pexels-proxy failed:", error || data);
      return null;
    }
    imageCache.set(url, data.dataUrl);
    return data.dataUrl as string;
  } catch (e) {
    console.warn("proxy invoke failed:", e);
    return null;
  }
}

/**
 * Walks the presentation and replaces every slide.image.url with a base64
 * data URL fetched through our edge proxy. Mutates a *clone* and returns it.
 */
async function inlineAllImages(content: any): Promise<any> {
  const cloned = JSON.parse(JSON.stringify(content));
  const slides = cloned.slides || [];
  const tasks: Promise<void>[] = [];
  for (const slide of slides) {
    const url = slide?.image?.url;
    if (!url || url.startsWith("data:")) continue;
    tasks.push(
      urlToBase64ViaProxy(url).then((b64) => {
        if (b64) slide.image.url = b64;
      })
    );
  }
  // Run in parallel but cap concurrency to avoid hammering the proxy.
  const CONCURRENCY = 4;
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    await Promise.all(tasks.slice(i, i + CONCURRENCY));
  }
  return cloned;
}

// ============================================================
// OFF-SCREEN SLIDE RENDERER
// ============================================================
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
    root.render(createElement(SlideRenderer, { slide, theme }) as any);

    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => setTimeout(r, 50));

    if ((document as any).fonts?.ready) await (document as any).fonts.ready;

    // Wait for inline (data:) images to decode — they're already in memory
    const imgs = Array.from(container.querySelectorAll("img"));
    await Promise.all(
      imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          if (typeof (img as any).decode === "function") {
            (img as any).decode().then(done).catch(done);
          }
          setTimeout(done, 4000);
        });
      })
    );

    await new Promise((r) => setTimeout(r, 100));

    return await html2canvas(container, {
      width: SLIDE_W,
      height: SLIDE_H,
      windowWidth: SLIDE_W,
      windowHeight: SLIDE_H,
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      imageTimeout: 5000,
    });
  } finally {
    if (root) try { root.unmount(); } catch {}
    if (container.parentNode) container.parentNode.removeChild(container);
  }
}

// ============================================================
// PUBLIC EXPORTERS
// ============================================================
export async function exportSlidesToPdf(content: any) {
  const slides = content?.slides || [];
  if (slides.length === 0) {
    toast.error("No hay diapositivas para exportar");
    return;
  }

  const isStructured = isStructuredPresentation(content);
  const toastId = toast.loading(`Preparando imágenes...`);

  try {
    // Step 1 — pre-fetch every remote image as base64
    const inlined = isStructured ? await inlineAllImages(content) : content;
    const theme: SlideTheme = inlined?.theme || DEFAULT_THEME;

    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "px", format: [SLIDE_W, SLIDE_H] });

    const total = inlined.slides.length;
    for (let idx = 0; idx < total; idx++) {
      toast.loading(`Generando PDF (${idx + 1}/${total})...`, { id: toastId });
      if (idx > 0) doc.addPage();

      try {
        const canvas = await renderStructuredSlideOffscreen(inlined.slides[idx], theme);
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

    doc.save(`${sanitizeFilename(inlined?.title || "Diapositivas")}.pdf`);
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
  const toastId = toast.loading(`Preparando imágenes...`);

  try {
    const inlined = isStructured ? await inlineAllImages(content) : content;
    const theme: SlideTheme = inlined?.theme || DEFAULT_THEME;

    const pptxgenModule = await import("pptxgenjs");
    const PptxGenJS = pptxgenModule.default;
    const pres = new PptxGenJS();
    pres.layout = "LAYOUT_WIDE";

    const total = inlined.slides.length;
    for (let idx = 0; idx < total; idx++) {
      toast.loading(`Generando PPTX (${idx + 1}/${total})...`, { id: toastId });
      const slide = pres.addSlide();
      try {
        const canvas = await renderStructuredSlideOffscreen(inlined.slides[idx], theme);
        const imgData = canvas.toDataURL("image/png");
        slide.addImage({ data: imgData, x: 0, y: 0, w: "100%", h: "100%" });
      } catch (e) {
        console.warn(`Slide ${idx + 1} render failed`, e);
        slide.addText(`Diapositiva ${idx + 1}`, {
          x: 0.5, y: 2.5, w: 9, h: 1, fontSize: 28, bold: true, color: "333333",
        });
      }
    }

    const fileName = sanitizeFilename(inlined?.title || "Diapositivas");
    await pres.writeFile({ fileName: `${fileName}.pptx` });
    toast.success("Presentación PPTX descargada exitosamente", { id: toastId });
  } catch (e: any) {
    console.error("PPTX export error:", e);
    toast.error("Error al exportar PPTX: " + e.message, { id: toastId });
  }
}
