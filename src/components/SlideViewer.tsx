import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SlideData {
  html?: string;
  title?: string;
  subtitle?: string;
  content?: string;
  points?: string[];
  leftContent?: string;
  rightContent?: string;
  layout?: string;
  bgColor?: string;
}

interface Props {
  slides: SlideData[];
  title?: string;
}

export function SlideViewer({ slides, title }: Props) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setCurrentSlide((p) => Math.max(0, p - 1));
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setCurrentSlide((p) => Math.min(slides.length - 1, p + 1));
      } else if (e.key === "Escape" && fullscreen) {
        setFullscreen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [slides.length, fullscreen]);

  if (!slides || slides.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        No se generaron diapositivas.
      </p>
    );
  }

  const slide = slides[currentSlide];

  return (
    <div className="space-y-4">
      {/* Main Slide */}
      <div
        ref={containerRef}
        className={`relative bg-gray-900 ${
          fullscreen
            ? "fixed inset-0 z-50 flex items-center justify-center"
            : "w-full rounded-xl overflow-hidden shadow-2xl border border-border"
        }`}
        style={fullscreen ? {} : { aspectRatio: "16/9" }}
      >
        <SlideIframe
          html={slide.html || ""}
          fullscreen={fullscreen}
        />

        {/* Controls overlay */}
        <div className="absolute bottom-3 left-4 text-xs text-white/90 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full font-medium z-10">
          {currentSlide + 1} / {slides.length}
        </div>

        <div className="absolute top-3 right-3 flex gap-2 z-10">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm"
            onClick={() => setFullscreen(!fullscreen)}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>

        {fullscreen && (
          <Button
            variant="ghost"
            className="absolute top-3 left-3 text-white bg-black/40 hover:bg-black/60 backdrop-blur-sm z-10"
            onClick={() => setFullscreen(false)}
          >
            ✕ Cerrar
          </Button>
        )}

        {/* Side navigation arrows (only in fullscreen) */}
        {fullscreen && currentSlide > 0 && (
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-3 backdrop-blur-sm z-10"
            onClick={() => setCurrentSlide((p) => p - 1)}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {fullscreen && currentSlide < slides.length - 1 && (
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-3 backdrop-blur-sm z-10"
            onClick={() => setCurrentSlide((p) => p + 1)}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
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
                i === currentSlide
                  ? "w-6 bg-primary"
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
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
      <div className="flex gap-2 overflow-x-auto pb-2 px-1">
        {slides.map((s, i) => (
          <button
            key={i}
            onClick={() => setCurrentSlide(i)}
            className={`shrink-0 w-40 rounded-lg overflow-hidden border-2 transition-all ${
              i === currentSlide
                ? "border-primary shadow-lg ring-2 ring-primary/20"
                : "border-border hover:border-primary/40"
            }`}
            style={{ aspectRatio: "16/9" }}
          >
            <SlideIframe html={s.html || ""} thumbnail />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Renders a slide HTML in an iframe with proper scaling */
function SlideIframe({
  html,
  fullscreen,
  thumbnail,
}: {
  html: string;
  fullscreen?: boolean;
  thumbnail?: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const SLIDE_W = 1280;
  const SLIDE_H = 720;

  const updateScale = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (cw === 0 || ch === 0) return;
    const s = Math.min(cw / SLIDE_W, ch / SLIDE_H);
    setScale(s);
  }, []);

  useEffect(() => {
    updateScale();
    const obs = new ResizeObserver(updateScale);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [updateScale, fullscreen]);

  if (thumbnail) {
    return (
      <div className="w-full h-full overflow-hidden bg-white relative">
        <iframe
          srcDoc={html}
          className="border-0 pointer-events-none"
          style={{
            width: `${SLIDE_W}px`,
            height: `${SLIDE_H}px`,
            transform: `scale(${160 / SLIDE_W})`,
            transformOrigin: "top left",
            position: "absolute",
            top: 0,
            left: 0,
          }}
          sandbox="allow-same-origin allow-scripts"
          title="Slide thumbnail"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-hidden"
      style={{ background: "#111" }}
    >
      <iframe
        ref={iframeRef}
        srcDoc={html}
        className="border-0"
        style={{
          width: `${SLIDE_W}px`,
          height: `${SLIDE_H}px`,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          flexShrink: 0,
        }}
        sandbox="allow-same-origin allow-scripts"
        title="Slide preview"
      />
    </div>
  );
}
