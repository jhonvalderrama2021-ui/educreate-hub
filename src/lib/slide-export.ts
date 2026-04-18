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
// IMAGE PRE-FETCHING via Pexels proxy → base64 (CORS-safe)
// ============================================================
const imageCache = new Map<string, string>();

async function urlToBase64ViaProxy(url: string): Promise<string | null> {
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url)!;
  try {
    const { data, error } = await supabase.functions.invoke("pexels-proxy", { body: { url } });
    if (error || !data?.dataUrl) return null;
    imageCache.set(url, data.dataUrl);
    return data.dataUrl as string;
  } catch {
    return null;
  }
}

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
  const CONCURRENCY = 4;
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    await Promise.all(tasks.slice(i, i + CONCURRENCY));
  }
  return cloned;
}

// ============================================================
// VISIBLE OFF-SCREEN RENDER
// We position a 1280x720 stage well off-screen (left:-20000px) but with
// FULL opacity & visibility — html2canvas needs a visible, painted layer.
// ============================================================
async function renderSlideToCanvas(
  slide: StructuredSlide,
  theme: SlideTheme
): Promise<HTMLCanvasElement> {
  const stage = document.createElement("div");
  stage.setAttribute("data-export-stage", "1");
  stage.style.cssText = [
    "position:fixed",
    "left:-20000px",       // off-screen but rendered
    "top:0",
    `width:${SLIDE_W}px`,
    `height:${SLIDE_H}px`,
    "overflow:hidden",
    "background:#ffffff",
    "z-index:0",
    // KEEP visible — opacity 1, no display:none, no visibility:hidden
    "opacity:1",
    "transform:none",
  ].join(";");
  document.body.appendChild(stage);

  let root: Root | null = null;
  try {
    root = createRoot(stage);
    root.render(createElement(SlideRenderer, { slide, theme }) as any);

    // Two RAFs to guarantee React commit + browser paint
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
    await new Promise((r) => setTimeout(r, 80));

    if ((document as any).fonts?.ready) {
      try { await (document as any).fonts.ready; } catch {}
    }

    // Wait for inlined images to fully decode
    const imgs = Array.from(stage.querySelectorAll("img"));
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
          setTimeout(done, 5000);
        });
      })
    );

    await new Promise((r) => setTimeout(r, 120));

    return await html2canvas(stage, {
      width: SLIDE_W,
      height: SLIDE_H,
      windowWidth: SLIDE_W,
      windowHeight: SLIDE_H,
      x: 0,
      y: 0,
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      imageTimeout: 8000,
      foreignObjectRendering: false,
    });
  } finally {
    if (root) try { root.unmount(); } catch {}
    if (stage.parentNode) stage.parentNode.removeChild(stage);
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
  const toastId = toast.loading("Preparando imágenes...");

  try {
    const inlined = isStructured ? await inlineAllImages(content) : content;
    const theme: SlideTheme = inlined?.theme || DEFAULT_THEME;

    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "px", format: [SLIDE_W, SLIDE_H] });

    const total = inlined.slides.length;
    for (let idx = 0; idx < total; idx++) {
      toast.loading(`Generando PDF (${idx + 1}/${total})...`, { id: toastId });
      if (idx > 0) doc.addPage();

      try {
        const canvas = await renderSlideToCanvas(inlined.slides[idx], theme);
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
    toast.success("PDF descargado", { id: toastId });
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
  const toastId = toast.loading("Preparando imágenes...");

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
        const canvas = await renderSlideToCanvas(inlined.slides[idx], theme);
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
    toast.success("PPTX descargado", { id: toastId });
  } catch (e: any) {
    console.error("PPTX export error:", e);
    toast.error("Error al exportar PPTX: " + e.message, { id: toastId });
  }
}
