import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideRenderer } from "@/components/slides/SlideRenderer";
import { StructuredSlide, SlideTheme, DEFAULT_THEME, updateSlideField } from "@/lib/slide-types";

interface Props {
  slides: any[];
  title?: string;
  theme?: SlideTheme;
  editable?: boolean;
  onSlideChange?: (index: number, updatedSlide: StructuredSlide) => void;
}

const SLIDE_W = 1280;
const SLIDE_H = 720;

function isStructured(slides: any[]): boolean {
  return slides.length > 0 && !!slides[0]?.layout;
}

export function SlideViewer({ slides, title, theme = DEFAULT_THEME, editable, onSlideChange }: Props) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Disable global slide nav while user is editing inline text
      const target = e.target as HTMLElement | null;
      if (target?.isContentEditable || ["INPUT", "TEXTAREA"].includes(target?.tagName || "")) return;

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

  const structured = isStructured(slides);

  const handleFieldChange = (path: string, value: any) => {
    if (!onSlideChange || !structured) return;
    const updated = updateSlideField(slides[currentSlide] as StructuredSlide, path, value);
    onSlideChange(currentSlide, updated);
  };

  return (
    <div className="space-y-4">
      {editable && (
        <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2 rounded-lg">
          <span className="material-icons" style={{ fontSize: "16px" }}>edit</span>
          <span>Modo edición activo — haz clic sobre cualquier título o texto de la diapositiva para modificarlo.</span>
        </div>
      )}

      {/* Main Slide */}
      <div
        className={`relative ${
          fullscreen
            ? "fixed inset-0 z-50 flex items-center justify-center bg-black"
            : "w-full rounded-xl overflow-hidden shadow-2xl border border-border"
        }`}
        style={fullscreen ? {} : { aspectRatio: "16/9" }}
      >
        <ScaledSlide
          slide={slides[currentSlide]}
          structured={structured}
          theme={theme}
          fullscreen={fullscreen}
          editable={editable && !fullscreen}
          onFieldChange={handleFieldChange}
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
            <ScaledSlide slide={s} structured={structured} theme={theme} thumbnail />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Renders a single slide at fixed 1280x720 and scales to fit container */
function ScaledSlide({
  slide,
  structured,
  theme,
  fullscreen,
  thumbnail,
  editable,
  onFieldChange,
}: {
  slide: any;
  structured: boolean;
  theme: SlideTheme;
  fullscreen?: boolean;
  thumbnail?: boolean;
  editable?: boolean;
  onFieldChange?: (path: string, value: any) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const updateScale = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    if (cw === 0 || ch === 0) return;
    setScale(Math.min(cw / SLIDE_W, ch / SLIDE_H));
  }, []);

  useEffect(() => {
    updateScale();
    const obs = new ResizeObserver(updateScale);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [updateScale, fullscreen]);

  if (structured) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden"
        style={{ position: "relative", background: "#111" }}
      >
        <div
          style={{
            width: `${SLIDE_W}px`,
            height: `${SLIDE_H}px`,
            transform: `scale(${thumbnail ? 160 / SLIDE_W : scale})`,
            transformOrigin: thumbnail ? "top left" : "center center",
            position: "absolute",
            top: thumbnail ? 0 : "50%",
            left: thumbnail ? 0 : "50%",
            marginTop: thumbnail ? 0 : -(SLIDE_H / 2),
            marginLeft: thumbnail ? 0 : -(SLIDE_W / 2),
            fontFamily: "'Inter', sans-serif",
          }}
          className="slide-content"
        >
          <SlideRenderer
            slide={slide as StructuredSlide}
            theme={theme}
            editable={editable && !thumbnail}
            onFieldChange={onFieldChange}
          />
        </div>
      </div>
    );
  }

  // Legacy HTML iframe rendering
  const html = slide?.html || "";
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
