import html2canvas from "html2canvas";
import { toast } from "sonner";
import { StructuredPresentation, DEFAULT_THEME } from "@/lib/slide-types";

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
 * Captures a slide element from the DOM as a canvas.
 * For structured slides, we render them in a hidden container and capture.
 */
async function captureSlideToCanvas(slideIndex: number): Promise<HTMLCanvasElement | null> {
  // Find the slide thumbnail or main slide elements in the DOM
  // We'll use a temporary render approach
  const slideElements = document.querySelectorAll('[data-slide-export]');
  
  if (slideElements[slideIndex]) {
    const el = slideElements[slideIndex] as HTMLElement;
    
    // Wait for images to load
    const images = el.querySelectorAll('img');
    await Promise.all(
      Array.from(images).map(img =>
        img.complete ? Promise.resolve() : new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        })
      )
    );
    
    // Wait for fonts
    await document.fonts.ready;
    
    return html2canvas(el, {
      width: SLIDE_W,
      height: SLIDE_H,
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
  }
  
  return null;
}

/**
 * Legacy: render HTML slide in iframe and capture
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

/**
 * For structured slides: create a temporary DOM element with the slide content,
 * render it, and capture to canvas.
 */
async function renderStructuredSlideToCanvas(
  slideData: any,
  theme: any,
  renderFn: (container: HTMLElement, slide: any, theme: any) => void
): Promise<HTMLCanvasElement> {
  const container = document.createElement("div");
  container.style.cssText =
    `position:fixed;left:-9999px;top:0;width:${SLIDE_W}px;height:${SLIDE_H}px;overflow:hidden;z-index:-1;`;
  document.body.appendChild(container);

  const slideEl = document.createElement("div");
  slideEl.style.cssText = `width:${SLIDE_W}px;height:${SLIDE_H}px;`;
  container.appendChild(slideEl);

  // Use the render function to populate
  renderFn(slideEl, slideData, theme);

  await document.fonts.ready;
  await new Promise((r) => setTimeout(r, 500));

  // Wait for images
  const images = slideEl.querySelectorAll('img');
  await Promise.all(
    Array.from(images).map(img =>
      img.complete ? Promise.resolve() : new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      })
    )
  );

  const canvas = await html2canvas(slideEl, {
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

export async function exportSlidesToPdf(content: any) {
  const slides = content?.slides || [];
  if (slides.length === 0) {
    toast.error("No hay diapositivas para exportar");
    return;
  }

  const isStructured = isStructuredPresentation(content);
  toast.info(`Generando PDF (${slides.length} diapositivas)... Esto puede tardar unos segundos.`);

  try {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "px", format: [SLIDE_W, SLIDE_H] });

    for (let idx = 0; idx < slides.length; idx++) {
      if (idx > 0) doc.addPage();
      const slideData = slides[idx];

      try {
        let canvas: HTMLCanvasElement;
        
        if (isStructured) {
          // For structured slides, capture from the active viewer DOM
          const exported = await captureSlideFromViewer(idx, slides.length);
          if (exported) {
            canvas = exported;
          } else {
            throw new Error("Could not capture slide");
          }
        } else if (slideData.html) {
          canvas = await renderHtmlSlideToCanvas(slideData.html);
        } else {
          throw new Error("No content");
        }
        
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

  const isStructured = isStructuredPresentation(content);
  toast.info(`Generando PPTX (${slides.length} diapositivas)... Esto puede tardar unos segundos.`);

  try {
    const pptxgenModule = await import("pptxgenjs");
    const PptxGenJS = pptxgenModule.default;
    const pres = new PptxGenJS();
    pres.layout = "LAYOUT_WIDE";

    for (let idx = 0; idx < slides.length; idx++) {
      const slideData = slides[idx];
      const slide = pres.addSlide();

      try {
        let canvas: HTMLCanvasElement;
        
        if (isStructured) {
          const exported = await captureSlideFromViewer(idx, slides.length);
          if (exported) {
            canvas = exported;
          } else {
            throw new Error("Could not capture slide");
          }
        } else if (slideData.html) {
          canvas = await renderHtmlSlideToCanvas(slideData.html);
        } else {
          throw new Error("No content");
        }

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

    const fileName = sanitizeFilename(content?.title || "Diapositivas");
    await pres.writeFile({ fileName: `${fileName}.pptx` });
    toast.success("Presentación PPTX descargada exitosamente");
  } catch (e: any) {
    console.error("PPTX export error:", e);
    toast.error("Error al exportar PPTX: " + e.message);
  }
}

/**
 * Captures a structured slide by temporarily navigating the viewer
 * and capturing each slide from the DOM.
 */
async function captureSlideFromViewer(slideIndex: number, totalSlides: number): Promise<HTMLCanvasElement | null> {
  // Look for the main slide render container
  const slideContainer = document.querySelector('.slide-content');
  if (!slideContainer) return null;
  
  const parent = slideContainer.parentElement;
  if (!parent) return null;

  // Wait for content to render
  await document.fonts.ready;
  await new Promise(r => setTimeout(r, 300));
  
  // Wait for images
  const images = slideContainer.querySelectorAll('img');
  await Promise.all(
    Array.from(images).map(img =>
      img.complete ? Promise.resolve() : new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      })
    )
  );

  return html2canvas(slideContainer as HTMLElement, {
    width: SLIDE_W,
    height: SLIDE_H,
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#F0F4F8",
    logging: false,
  });
}
