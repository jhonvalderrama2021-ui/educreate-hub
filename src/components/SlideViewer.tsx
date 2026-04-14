import { useState, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SlideData {
  html: string;
  // Legacy support
  title?: string;
  subtitle?: string;
  content?: string;
  points?: string[];
  leftContent?: string;
  rightContent?: string;
  layout?: "title" | "content" | "two_columns" | "image_text";
  bgColor?: string;
  imageQuery?: string;
  imageUrl?: string;
}

interface Props {
  slides: SlideData[];
  title?: string;
}

export function SlideViewer({ slides, title }: Props) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  if (!slides || slides.length === 0) {
    return <p className="text-muted-foreground text-center py-8">No se generaron diapositivas.</p>;
  }

  const slide = slides[currentSlide];
  const isHtmlSlide = !!slide.html;

  return (
    <div className="space-y-4">
      {/* Main Slide */}
      <div
        className={`relative w-full rounded-xl overflow-hidden shadow-2xl border border-border bg-white ${
          fullscreen ? "fixed inset-0 z-50 rounded-none border-none" : ""
        }`}
        style={fullscreen ? {} : { aspectRatio: "16/9" }}
      >
        {isHtmlSlide ? (
          <HtmlSlideRenderer html={slide.html} fullscreen={fullscreen} />
        ) : (
          <LegacySlideRenderer slide={slide} />
        )}

        {/* Controls overlay */}
        <div className="absolute bottom-3 left-4 text-xs text-muted-foreground/60 bg-black/20 px-2 py-1 rounded">
          {currentSlide + 1} / {slides.length}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8 bg-black/20 hover:bg-black/40 text-white"
          onClick={() => setFullscreen(!fullscreen)}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>

        {fullscreen && (
          <Button
            variant="ghost"
            className="absolute top-2 left-2 text-white bg-black/30 hover:bg-black/50"
            onClick={() => setFullscreen(false)}
          >
            ✕ Cerrar
          </Button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
          disabled={currentSlide === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>

        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`h-2 rounded-full transition-all ${
                i === currentSlide ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
          disabled={currentSlide === slides.length - 1}
        >
          Siguiente <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Thumbnail strip */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {slides.map((s, i) => (
          <button
            key={i}
            onClick={() => setCurrentSlide(i)}
            className={`shrink-0 w-36 rounded-lg overflow-hidden border-2 transition-all ${
              i === currentSlide ? "border-primary shadow-lg" : "border-border hover:border-primary/40"
            }`}
            style={{ aspectRatio: "16/9" }}
          >
            {s.html ? (
              <HtmlSlideRenderer html={s.html} thumbnail />
            ) : (
              <div
                className="p-2 h-full flex flex-col justify-center"
                style={{ backgroundColor: `#${s.bgColor || "1a1a2e"}` }}
              >
                <p className={`text-[7px] font-bold leading-tight truncate ${
                  isLightBg(s.bgColor || "1a1a2e") ? "text-gray-900" : "text-white"
                }`}>
                  {s.title || `Diapositiva ${i + 1}`}
                </p>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function HtmlSlideRenderer({ html, fullscreen, thumbnail }: { html: string; fullscreen?: boolean; thumbnail?: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleLoad = useCallback(() => {
    if (!iframeRef.current) return;
    // Disable any links/interactions inside iframe
    try {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        const style = doc.createElement("style");
        style.textContent = `
          * { pointer-events: none !important; }
          body { margin: 0; overflow: hidden; }
        `;
        doc.head.appendChild(style);
      }
    } catch { /* cross-origin, ignore */ }
  }, []);

  if (thumbnail) {
    return (
      <div className="w-full h-full overflow-hidden bg-white">
        <iframe
          ref={iframeRef}
          srcDoc={html}
          className="border-0"
          style={{
            width: "1280px",
            height: "720px",
            transform: "scale(0.112)",
            transformOrigin: "top left",
            pointerEvents: "none",
          }}
          sandbox="allow-same-origin"
          onLoad={handleLoad}
          title="Slide thumbnail"
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-hidden flex items-center justify-center bg-gray-100">
      <div className="relative w-full" style={{ paddingBottom: fullscreen ? "100vh" : "56.25%" }}>
        <iframe
          ref={iframeRef}
          srcDoc={html}
          className="absolute inset-0 w-full h-full border-0"
          sandbox="allow-same-origin"
          onLoad={handleLoad}
          title="Slide preview"
        />
      </div>
    </div>
  );
}

function LegacySlideRenderer({ slide }: { slide: any }) {
  const bgHex = slide.bgColor || "1a1a2e";
  const isLight = isLightBg(bgHex);
  const textClass = isLight ? "text-gray-900" : "text-white";
  const subtextClass = isLight ? "text-gray-600" : "text-white/80";

  return (
    <div className="absolute inset-0 p-8 md:p-12 flex flex-col" style={{ backgroundColor: `#${bgHex}` }}>
      {slide.layout === "title" ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <h2 className={`text-2xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight ${textClass}`}>
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p className={`text-base md:text-xl ${subtextClass} max-w-2xl`}>{slide.subtitle}</p>
          )}
        </div>
      ) : slide.layout === "two_columns" ? (
        <>
          <h2 className={`text-xl md:text-3xl font-bold mb-6 ${textClass}`}>{slide.title}</h2>
          <div className="flex-1 grid grid-cols-2 gap-6">
            <div className={`text-sm md:text-base ${subtextClass} whitespace-pre-line`}>{slide.leftContent}</div>
            <div className={`text-sm md:text-base ${subtextClass} whitespace-pre-line`}>{slide.rightContent}</div>
          </div>
        </>
      ) : (
        <>
          <h2 className={`text-xl md:text-3xl font-bold mb-6 ${textClass}`}>{slide.title}</h2>
          <div className="flex-1 flex flex-col gap-3 overflow-auto">
            {slide.points?.map((point: string, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: isLight ? "#6366f1" : "#818cf8" }} />
                <p className={`text-sm md:text-base ${subtextClass}`}>{point}</p>
              </div>
            ))}
            {slide.content && <p className={`text-sm md:text-base ${subtextClass} mt-2`}>{slide.content}</p>}
          </div>
        </>
      )}
    </div>
  );
}

function isLightBg(hex: string): boolean {
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}
